import Database from "better-sqlite3";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, resolve } from "node:path";
import {
  FREE_DELIVERY_THRESHOLD,
  categoriesSeed,
  productsSeed,
  type AdminAuditEvent,
  type CartItem,
  type Category,
  type CustomerProfile,
  type DeliveryMethod,
  type Order,
  type OrderItem,
  type OrderStatus,
  type PaymentStatus,
  type Product,
  type StockMovement
} from "../src/shared/index.js";

loadLocalEnv();

type TelegramUserPayload = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

type OrderCreateBody = {
  telegramUserId?: string;
  customerName?: string;
  phone?: string;
  address?: string;
  comment?: string;
  deliveryMethod?: DeliveryMethod;
  idempotencyKey?: string;
  items?: CartItem[];
};

const host = process.env.API_HOST ?? "0.0.0.0";
const port = Number(process.env.API_PORT ?? 8787);
const databasePath = resolve(process.cwd(), process.env.SQLITE_DB_PATH ?? process.env.API_DB_PATH ?? "data/app.sqlite");
const freeDeliveryThreshold = readMoneyEnv(process.env.VITE_FREE_DELIVERY_THRESHOLD, FREE_DELIVERY_THRESHOLD);
const adminToken = process.env.API_ADMIN_TOKEN ?? "";
const adminTelegramIds = new Set((process.env.API_ADMIN_TELEGRAM_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean));
const requireTelegramAuth = process.env.API_REQUIRE_TELEGRAM_AUTH === "true";
const catalogVersion = "2026-08-menu-v4";

mkdirSync(dirname(databasePath), { recursive: true });
const db = new Database(databasePath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
initDatabase();

const server = createServer(async (request, response) => {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    await route(request, response, url);
  } catch (error) {
    if (error instanceof HttpError) {
      sendJson(response, error.statusCode, { error: error.message });
      return;
    }

    const message = error instanceof Error ? error.message : "Internal server error";
    sendJson(response, 500, { error: message });
  }
});

server.listen(port, host, () => {
  console.log(`API server started: http://${host}:${port}`);
  console.log(`SQLite database: ${databasePath}`);
});

async function route(request: IncomingMessage, response: ServerResponse, url: URL) {
  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, { ok: true, database: "sqlite" });
    return;
  }

  if (request.method === "GET" && url.pathname === "/categories") {
    sendJson(response, 200, getVisibleCategories());
    return;
  }

  if (request.method === "GET" && url.pathname === "/products") {
    sendJson(response, 200, getVisibleProducts());
    return;
  }

  if (request.method === "POST" && url.pathname === "/users") {
    const telegramUser = validateTelegramRequest(request);
    const body = await readJsonBody<Partial<CustomerProfile> & { name?: string }>(request);
    const user = upsertUser({
      telegramUserId: String(telegramUser?.id ?? body.telegramUserId ?? "").trim(),
      name: body.name,
      firstName: telegramUser?.first_name ?? body.firstName,
      lastName: telegramUser?.last_name ?? body.lastName,
      username: telegramUser?.username ?? body.username,
      phone: body.phone,
      lastAddress: body.lastAddress
    });
    sendJson(response, 200, user);
    return;
  }

  if (request.method === "GET" && url.pathname === "/orders") {
    const telegramUserId = String(url.searchParams.get("telegramUserId") ?? "").trim();
    sendJson(response, 200, getOrders(telegramUserId || undefined));
    return;
  }

  if (request.method === "POST" && url.pathname === "/orders") {
    const telegramUser = validateTelegramRequest(request);
    const body = await readJsonBody<OrderCreateBody>(request);
    const order = createOrder(body, telegramUser);
    sendJson(response, 201, order);
    return;
  }

  if (request.method === "GET" && url.pathname === "/admin/orders") {
    requireAdmin(request);
    sendJson(response, 200, getOrders());
    return;
  }

  if (request.method === "GET" && url.pathname === "/admin/users") {
    requireAdmin(request);
    sendJson(response, 200, getUsers());
    return;
  }

  if (request.method === "GET" && url.pathname === "/admin/products") {
    requireAdmin(request);
    sendJson(response, 200, getProducts());
    return;
  }

  if (request.method === "POST" && url.pathname === "/admin/products") {
    const actor = requireAdmin(request);
    const body = await readJsonBody<Partial<Product>>(request);
    sendJson(response, 201, createProduct(body, actor));
    return;
  }

  if (request.method === "GET" && url.pathname === "/admin/categories") {
    requireAdmin(request);
    sendJson(response, 200, getCategories());
    return;
  }

  if (request.method === "POST" && url.pathname === "/admin/categories") {
    const actor = requireAdmin(request);
    const body = await readJsonBody<Partial<Category>>(request);
    sendJson(response, 201, createCategory(body, actor));
    return;
  }

  if (request.method === "GET" && url.pathname === "/admin/stock-movements") {
    requireAdmin(request);
    sendJson(response, 200, getStockMovements());
    return;
  }

  if (request.method === "GET" && url.pathname === "/admin/audit-events") {
    requireAdmin(request);
    sendJson(response, 200, getAuditEvents());
    return;
  }

  const orderStatusMatch = url.pathname.match(/^\/admin\/orders\/([^/]+)\/status$/);
  if (request.method === "PATCH" && orderStatusMatch) {
    const actor = requireAdmin(request);
    const body = await readJsonBody<{ status?: OrderStatus; comment?: string }>(request);
    sendJson(response, 200, updateOrderStatus(orderStatusMatch[1], body.status, actor, body.comment));
    return;
  }

  const orderPaymentMatch = url.pathname.match(/^\/admin\/orders\/([^/]+)\/payment$/);
  if (request.method === "PATCH" && orderPaymentMatch) {
    const actor = requireAdmin(request);
    const body = await readJsonBody<{ paymentStatus?: PaymentStatus }>(request);
    sendJson(response, 200, updatePaymentStatus(orderPaymentMatch[1], body.paymentStatus, actor));
    return;
  }

  const productMatch = url.pathname.match(/^\/admin\/products\/([^/]+)$/);
  if (request.method === "PATCH" && productMatch) {
    const actor = requireAdmin(request);
    const body = await readJsonBody<Partial<Product>>(request);
    sendJson(response, 200, updateProduct(productMatch[1], body, actor));
    return;
  }

  const categoryMatch = url.pathname.match(/^\/admin\/categories\/([^/]+)$/);
  if (request.method === "PATCH" && categoryMatch) {
    const actor = requireAdmin(request);
    const body = await readJsonBody<Partial<Category>>(request);
    sendJson(response, 200, updateCategory(categoryMatch[1], body, actor));
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      is_visible INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      price INTEGER NOT NULL,
      unit TEXT NOT NULL,
      unit_label TEXT NOT NULL,
      image_url TEXT NOT NULL,
      stock INTEGER NOT NULL,
      is_visible INTEGER NOT NULL,
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      telegram_user_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      username TEXT,
      phone TEXT,
      last_address TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number TEXT NOT NULL UNIQUE,
      telegram_user_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT,
      delivery_method TEXT NOT NULL,
      delivery_price INTEGER NOT NULL,
      items_total INTEGER NOT NULL,
      total INTEGER NOT NULL,
      payment_status TEXT NOT NULL,
      status TEXT NOT NULL,
      comment TEXT,
      idempotency_key TEXT,
      items_json TEXT NOT NULL,
      status_history_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(telegram_user_id, idempotency_key)
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      delta INTEGER NOT NULL,
      previous_stock INTEGER NOT NULL,
      next_stock INTEGER NOT NULL,
      reason TEXT NOT NULL,
      order_id TEXT,
      changed_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      details_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const categoryCount = db.prepare("SELECT COUNT(*) AS count FROM categories").get() as { count: number };
  if (categoryCount.count === 0) {
    const insertCategory = db.prepare("INSERT INTO categories (id, title, sort_order, is_visible) VALUES (@id, @title, @sortOrder, @isVisible)");
    const insertProduct = db.prepare(`
      INSERT INTO products (id, category_id, title, description, price, unit, unit_label, image_url, stock, is_visible, sort_order)
      VALUES (@id, @categoryId, @title, @description, @price, @unit, @unitLabel, @imageUrl, @stock, @isVisible, @sortOrder)
    `);
    const seed = db.transaction(() => {
      for (const category of categoriesSeed) insertCategory.run({ ...category, isVisible: Number(category.isVisible) });
      for (const product of productsSeed) insertProduct.run({ ...product, isVisible: Number(product.isVisible) });
    });
    seed();
  }

  syncCatalogSeed();
}

function syncCatalogSeed() {
  const currentVersion = db.prepare("SELECT value FROM app_settings WHERE key = ?").get("catalog_version") as
    | { value: string }
    | undefined;
  if (currentVersion?.value === catalogVersion) return;

  const upsertCategory = db.prepare(`
    INSERT INTO categories (id, title, sort_order, is_visible)
    VALUES (@id, @title, @sortOrder, @isVisible)
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title,
      sort_order=excluded.sort_order,
      is_visible=excluded.is_visible
  `);
  const upsertProduct = db.prepare(`
    INSERT INTO products (id, category_id, title, description, price, unit, unit_label, image_url, stock, is_visible, sort_order)
    VALUES (@id, @categoryId, @title, @description, @price, @unit, @unitLabel, @imageUrl, @stock, @isVisible, @sortOrder)
    ON CONFLICT(id) DO UPDATE SET
      category_id=excluded.category_id,
      title=excluded.title,
      description=excluded.description,
      price=excluded.price,
      unit=excluded.unit,
      unit_label=excluded.unit_label,
      image_url=excluded.image_url,
      is_visible=excluded.is_visible,
      sort_order=excluded.sort_order
  `);
  const setVersion = db.prepare(`
    INSERT INTO app_settings (key, value) VALUES ('catalog_version', ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value
  `);

  db.transaction(() => {
    for (const category of categoriesSeed) upsertCategory.run({ ...category, isVisible: Number(category.isVisible) });
    for (const product of productsSeed) upsertProduct.run({ ...product, isVisible: Number(product.isVisible) });
    const productIds = productsSeed.map((product) => product.id);
    const categoryIds = categoriesSeed.map((category) => category.id);
    db.prepare(`DELETE FROM products WHERE id NOT IN (${productIds.map(() => "?").join(", ")})`).run(...productIds);
    db.prepare(`DELETE FROM categories WHERE id NOT IN (${categoryIds.map(() => "?").join(", ")})`).run(...categoryIds);
    setVersion.run(catalogVersion);
  })();
}

function createOrder(body: OrderCreateBody, telegramUser: TelegramUserPayload | null) {
  const telegramUserId = String(telegramUser?.id ?? body.telegramUserId ?? "").trim();
  const customerName = normalizeText(body.customerName, 80);
  const phone = normalizeText(body.phone, 40);
  const comment = normalizeText(body.comment, 500) || null;
  const deliveryMethod = normalizeDeliveryMethod(body.deliveryMethod);
  const items = normalizeCartItems(body.items);
  const idempotencyKey = normalizeText(body.idempotencyKey, 120) || null;

  if (!telegramUserId || !customerName || !phone || items.length === 0) {
    throw new HttpError(400, "telegramUserId, customerName, phone and items are required");
  }

  if (idempotencyKey) {
    const existingOrder = getOrderByIdempotencyKey(telegramUserId, idempotencyKey);
    if (existingOrder) return existingOrder;
  }

  if (deliveryMethod !== "pickup" && !normalizeText(body.address, 240)) {
    throw new HttpError(400, "address is required for delivery");
  }

  return db.transaction(() => {
    const orderItems = createOrderItems(items);
    const itemsTotal = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const deliveryPrice = 0;
    const actualDeliveryMethod: DeliveryMethod =
      deliveryMethod === "pickup" ? "pickup" : itemsTotal >= freeDeliveryThreshold ? "free_delivery" : "paid_delivery";
    const now = new Date().toISOString();
    const order: Order = {
      id: randomUUID(),
      orderNumber: createOrderNumber(),
      telegramUserId,
      customerName,
      phone,
      address: actualDeliveryMethod === "pickup" ? null : normalizeText(body.address, 240),
      deliveryMethod: actualDeliveryMethod,
      deliveryPrice,
      itemsTotal,
      total: itemsTotal,
      paymentStatus: "pending",
      status: "new",
      comment,
      idempotencyKey,
      items: orderItems,
      statusHistory: [{ status: "new", changedBy: "miniapp", changedAt: now, comment: null }],
      createdAt: now,
      updatedAt: now
    };

    for (const item of orderItems) {
      applyStockDelta(item.productId, -item.quantity, "order_created", order.id, "miniapp");
    }

    insertOrder(order);
    upsertUser({
      telegramUserId,
      name: customerName,
      firstName: telegramUser?.first_name ?? null,
      lastName: telegramUser?.last_name ?? null,
      username: telegramUser?.username ?? null,
      phone,
      lastAddress: order.address
    });
    addAuditEvent("miniapp", "order.create", "order", order.id, { orderNumber: order.orderNumber, total: order.total });
    return order;
  })();
}

function createOrderItems(items: CartItem[]): OrderItem[] {
  return items.map((item) => {
    const product = getProduct(item.productId);
    if (!product || item.quantity <= 0) throw new HttpError(400, "Order contains invalid items");
    if (!product.isVisible) throw new HttpError(409, `${product.title}: product is not available`);
    if (product.stock < item.quantity) throw new HttpError(409, `${product.title}: not enough stock`);
    return {
      productId: product.id,
      title: product.title,
      price: product.price,
      quantity: item.quantity,
      lineTotal: product.price * item.quantity
    };
  });
}

function updateOrderStatus(orderId: string, nextStatus: OrderStatus | undefined, actor: string, comment?: string) {
  if (!nextStatus || !isOrderStatus(nextStatus)) throw new HttpError(400, "Valid status is required");
  return db.transaction(() => {
    const order = getOrder(orderId);
    if (!order) throw new HttpError(404, "Order not found");
    if (order.status === nextStatus) return order;

    const now = new Date().toISOString();
    const previousStatus = order.status;
    order.status = nextStatus;
    order.updatedAt = now;
    order.statusHistory = [
      ...(order.statusHistory ?? []),
      { status: nextStatus, changedBy: actor, changedAt: now, comment: normalizeText(comment, 300) || null }
    ];

    if (nextStatus === "cancelled" && previousStatus !== "cancelled") {
      for (const item of order.items) applyStockDelta(item.productId, item.quantity, "order_cancelled", order.id, actor);
      order.paymentStatus = order.paymentStatus === "paid" ? "manual_check" : "cancelled";
    }

    saveOrder(order);
    addAuditEvent(actor, "order.status.update", "order", order.id, { previousStatus, nextStatus });
    return order;
  })();
}

function updatePaymentStatus(orderId: string, paymentStatus: PaymentStatus | undefined, actor: string) {
  if (!paymentStatus || !isPaymentStatus(paymentStatus)) throw new HttpError(400, "Valid paymentStatus is required");
  const order = getOrder(orderId);
  if (!order) throw new HttpError(404, "Order not found");
  const previousPaymentStatus = order.paymentStatus;
  order.paymentStatus = paymentStatus;
  order.updatedAt = new Date().toISOString();
  saveOrder(order);
  addAuditEvent(actor, "order.payment.update", "order", order.id, { previousPaymentStatus, paymentStatus });
  return order;
}

function updateProduct(
  productId: string,
  patch: Partial<Product>,
  actor: string
) {
  return db.transaction(() => {
    const product = getProduct(productId);
    if (!product) throw new HttpError(404, "Product not found");
    const previous = { ...product };

    if (patch.categoryId !== undefined) {
      const category = getCategory(normalizeText(patch.categoryId, 80));
      if (!category) throw new HttpError(400, "categoryId must reference an existing category");
      product.categoryId = category.id;
    }
    if (patch.title !== undefined) product.title = normalizeText(patch.title, 120);
    if (patch.description !== undefined) product.description = normalizeText(patch.description, 600);
    if (patch.imageUrl !== undefined) product.imageUrl = normalizeText(patch.imageUrl, 500);
    if (patch.unit !== undefined) product.unit = normalizeProductUnit(patch.unit);
    if (patch.unitLabel !== undefined) product.unitLabel = normalizeText(patch.unitLabel, 80);
    if (patch.price !== undefined) product.price = normalizeNonNegativeInteger(patch.price, "price");
    if (patch.sortOrder !== undefined) product.sortOrder = normalizeNonNegativeInteger(patch.sortOrder, "sortOrder");
    if (patch.isVisible !== undefined) product.isVisible = Boolean(patch.isVisible);
    if (patch.stock !== undefined) {
      const nextStock = normalizeNonNegativeInteger(patch.stock, "stock");
      const delta = nextStock - product.stock;
      if (delta !== 0) applyStockDelta(product.id, delta, "admin_adjustment", null, actor);
    }

    saveProduct(product);
    addAuditEvent(actor, "product.update", "product", product.id, { previous, next: product });
    return product;
  })();
}

function createProduct(body: Partial<Product>, actor: string) {
  const id = normalizeSlug(body.id ?? `product-${Date.now()}`);
  if (!id) throw new HttpError(400, "id is required");
  if (getProduct(id)) throw new HttpError(409, "Product already exists");

  const categoryId = normalizeText(body.categoryId, 80);
  if (!getCategory(categoryId)) throw new HttpError(400, "categoryId must reference an existing category");

  const product: Product = {
    id,
    categoryId,
    title: normalizeText(body.title, 120) || "Новый товар",
    description: normalizeText(body.description, 600) || "Описание появится позже.",
    price: normalizeNonNegativeInteger(body.price ?? 0, "price"),
    unit: normalizeProductUnit(body.unit ?? "piece"),
    unitLabel: normalizeText(body.unitLabel, 80) || "1 шт.",
    imageUrl: normalizeText(body.imageUrl, 500) || "images/products/dumplings-assorted.jpg",
    stock: normalizeNonNegativeInteger(body.stock ?? 0, "stock"),
    isVisible: Boolean(body.isVisible ?? false),
    sortOrder: normalizeNonNegativeInteger(body.sortOrder ?? 1000, "sortOrder")
  };

  db.prepare(`
    INSERT INTO products (id, category_id, title, description, price, unit, unit_label, image_url, stock, is_visible, sort_order)
    VALUES (@id, @categoryId, @title, @description, @price, @unit, @unitLabel, @imageUrl, @stock, @isVisible, @sortOrder)
  `).run({ ...product, isVisible: Number(product.isVisible) });
  addAuditEvent(actor, "product.create", "product", product.id, { product });
  return product;
}

function createCategory(body: Partial<Category>, actor: string) {
  const id = normalizeSlug(body.id ?? `category-${Date.now()}`);
  if (!id) throw new HttpError(400, "id is required");
  if (getCategory(id)) throw new HttpError(409, "Category already exists");

  const category: Category = {
    id,
    title: normalizeText(body.title, 120) || "Новая категория",
    sortOrder: normalizeNonNegativeInteger(body.sortOrder ?? 1000, "sortOrder"),
    isVisible: Boolean(body.isVisible ?? true)
  };
  db.prepare("INSERT INTO categories (id, title, sort_order, is_visible) VALUES (@id, @title, @sortOrder, @isVisible)").run({
    ...category,
    isVisible: Number(category.isVisible)
  });
  addAuditEvent(actor, "category.create", "category", category.id, { category });
  return category;
}

function updateCategory(categoryId: string, patch: Partial<Category>, actor: string) {
  const category = getCategory(categoryId);
  if (!category) throw new HttpError(404, "Category not found");
  const previous = { ...category };
  if (patch.title !== undefined) category.title = normalizeText(patch.title, 120);
  if (patch.sortOrder !== undefined) category.sortOrder = normalizeNonNegativeInteger(patch.sortOrder, "sortOrder");
  if (patch.isVisible !== undefined) category.isVisible = Boolean(patch.isVisible);

  db.prepare("UPDATE categories SET title=@title, sort_order=@sortOrder, is_visible=@isVisible WHERE id=@id").run({
    ...category,
    isVisible: Number(category.isVisible)
  });
  addAuditEvent(actor, "category.update", "category", category.id, { previous, next: category });
  return category;
}

function applyStockDelta(productId: string, delta: number, reason: StockMovement["reason"], orderId: string | null, changedBy: string) {
  const product = getProduct(productId);
  if (!product) throw new HttpError(404, "Product not found");
  const previousStock = product.stock;
  const nextStock = previousStock + delta;
  if (nextStock < 0) throw new HttpError(409, `${product.title}: not enough stock`);
  product.stock = nextStock;
  saveProduct(product);
  insertStockMovement({ id: randomUUID(), productId, delta, previousStock, nextStock, reason, orderId, changedBy, createdAt: new Date().toISOString() });
}

function upsertUser(input: {
  telegramUserId: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  phone?: string | null;
  lastAddress?: string | null;
}) {
  const telegramUserId = String(input.telegramUserId ?? "").trim();
  if (!telegramUserId) throw new HttpError(400, "telegramUserId is required");
  const existing = getUser(telegramUserId);
  const now = new Date().toISOString();
  const user: CustomerProfile = {
    telegramUserId,
    name: normalizeText(input.name, 100) || existing?.name || "Гость",
    firstName: normalizeText(input.firstName, 100) || existing?.firstName || null,
    lastName: normalizeText(input.lastName, 100) || existing?.lastName || null,
    username: normalizeText(input.username, 100) || existing?.username || null,
    phone: normalizeText(input.phone, 40) || existing?.phone || null,
    lastAddress: normalizeText(input.lastAddress, 240) || existing?.lastAddress || null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    lastSeenAt: now
  };
  db.prepare(`
    INSERT INTO users (telegram_user_id, name, first_name, last_name, username, phone, last_address, created_at, updated_at, last_seen_at)
    VALUES (@telegramUserId, @name, @firstName, @lastName, @username, @phone, @lastAddress, @createdAt, @updatedAt, @lastSeenAt)
    ON CONFLICT(telegram_user_id) DO UPDATE SET
      name=excluded.name, first_name=excluded.first_name, last_name=excluded.last_name, username=excluded.username,
      phone=excluded.phone, last_address=excluded.last_address, updated_at=excluded.updated_at, last_seen_at=excluded.last_seen_at
  `).run(user);
  return user;
}

function getVisibleCategories() {
  return (db.prepare("SELECT * FROM categories WHERE is_visible = 1 ORDER BY sort_order").all() as CategoryRow[]).map(mapCategory);
}

function getCategories() {
  return (db.prepare("SELECT * FROM categories ORDER BY sort_order").all() as CategoryRow[]).map(mapCategory);
}

function getCategory(id: string) {
  const row = db.prepare("SELECT * FROM categories WHERE id = ?").get(id) as CategoryRow | undefined;
  return row ? mapCategory(row) : null;
}

function getProducts() {
  return (db.prepare("SELECT * FROM products ORDER BY category_id, sort_order").all() as ProductRow[]).map(mapProduct);
}

function getVisibleProducts() {
  return (db.prepare("SELECT * FROM products WHERE is_visible = 1 ORDER BY category_id, sort_order").all() as ProductRow[]).map(mapProduct);
}

function getProduct(id: string) {
  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(id) as ProductRow | undefined;
  return row ? mapProduct(row) : null;
}

function saveProduct(product: Product) {
  db.prepare(`
    UPDATE products SET title=@title, description=@description, price=@price, unit=@unit, unit_label=@unitLabel,
      image_url=@imageUrl, stock=@stock, is_visible=@isVisible, sort_order=@sortOrder
    WHERE id=@id
  `).run({ ...product, isVisible: Number(product.isVisible) });
}

function getUser(telegramUserId: string) {
  const row = db.prepare("SELECT * FROM users WHERE telegram_user_id = ?").get(telegramUserId) as UserRow | undefined;
  return row ? mapUser(row) : null;
}

function getUsers() {
  return (db.prepare("SELECT * FROM users ORDER BY last_seen_at DESC").all() as UserRow[]).map(mapUser);
}

function getOrders(telegramUserId?: string) {
  const rows = telegramUserId
    ? (db.prepare(`
        SELECT o.*, u.username AS telegram_username, u.name AS telegram_display_name
        FROM orders o
        LEFT JOIN users u ON u.telegram_user_id = o.telegram_user_id
        WHERE o.telegram_user_id = ?
        ORDER BY o.created_at DESC
      `).all(telegramUserId) as OrderRow[])
    : (db.prepare(`
        SELECT o.*, u.username AS telegram_username, u.name AS telegram_display_name
        FROM orders o
        LEFT JOIN users u ON u.telegram_user_id = o.telegram_user_id
        ORDER BY o.created_at DESC
      `).all() as OrderRow[]);
  return rows.map(mapOrder);
}

function getOrder(id: string) {
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as OrderRow | undefined;
  return row ? mapOrder(row) : null;
}

function getOrderByIdempotencyKey(telegramUserId: string, idempotencyKey: string) {
  const row = db.prepare("SELECT * FROM orders WHERE telegram_user_id = ? AND idempotency_key = ?").get(telegramUserId, idempotencyKey) as OrderRow | undefined;
  return row ? mapOrder(row) : null;
}

function insertOrder(order: Order) {
  db.prepare(`
    INSERT INTO orders (
      id, order_number, telegram_user_id, customer_name, phone, address, delivery_method, delivery_price,
      items_total, total, payment_status, status, comment, idempotency_key, items_json, status_history_json, created_at, updated_at
    ) VALUES (
      @id, @orderNumber, @telegramUserId, @customerName, @phone, @address, @deliveryMethod, @deliveryPrice,
      @itemsTotal, @total, @paymentStatus, @status, @comment, @idempotencyKey, @itemsJson, @statusHistoryJson, @createdAt, @updatedAt
    )
  `).run(orderParams(order));
}

function saveOrder(order: Order) {
  db.prepare(`
    UPDATE orders SET payment_status=@paymentStatus, status=@status, status_history_json=@statusHistoryJson,
      updated_at=@updatedAt, comment=@comment
    WHERE id=@id
  `).run(orderParams(order));
}

function orderParams(order: Order) {
  return { ...order, itemsJson: JSON.stringify(order.items), statusHistoryJson: JSON.stringify(order.statusHistory) };
}

function insertStockMovement(movement: StockMovement) {
  db.prepare(`
    INSERT INTO stock_movements (id, product_id, delta, previous_stock, next_stock, reason, order_id, changed_by, created_at)
    VALUES (@id, @productId, @delta, @previousStock, @nextStock, @reason, @orderId, @changedBy, @createdAt)
  `).run(movement);
}

function getStockMovements() {
  return (db.prepare("SELECT * FROM stock_movements ORDER BY created_at DESC").all() as StockMovementRow[]).map(mapStockMovement);
}

function addAuditEvent(actor: string, action: string, entityType: AdminAuditEvent["entityType"], entityId: string, details: Record<string, unknown>) {
  const event: AdminAuditEvent = { id: randomUUID(), actor, action, entityType, entityId, details, createdAt: new Date().toISOString() };
  db.prepare(`
    INSERT INTO audit_events (id, actor, action, entity_type, entity_id, details_json, created_at)
    VALUES (@id, @actor, @action, @entityType, @entityId, @detailsJson, @createdAt)
  `).run({ ...event, detailsJson: JSON.stringify(details) });
}

function getAuditEvents() {
  return (db.prepare("SELECT * FROM audit_events ORDER BY created_at DESC").all() as AuditEventRow[]).map(mapAuditEvent);
}

function validateTelegramRequest(request: IncomingMessage) {
  const initData = String(request.headers["x-telegram-init-data"] ?? "");
  if (!initData) {
    if (requireTelegramAuth) throw new HttpError(401, "Telegram initData is required");
    return null;
  }
  if (!process.env.BOT_TOKEN) {
    if (requireTelegramAuth) throw new HttpError(500, "BOT_TOKEN is required for Telegram auth");
    return parseTelegramUser(initData);
  }
  if (!verifyTelegramInitData(initData, process.env.BOT_TOKEN)) throw new HttpError(401, "Invalid Telegram initData");
  return parseTelegramUser(initData);
}

function verifyTelegramInitData(initData: string, botToken: string) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return false;
  params.delete("hash");
  const dataCheckString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculatedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  return safeEqual(hash, calculatedHash);
}

function parseTelegramUser(initData: string): TelegramUserPayload | null {
  const rawUser = new URLSearchParams(initData).get("user");
  if (!rawUser) return null;
  try {
    return JSON.parse(rawUser) as TelegramUserPayload;
  } catch {
    return null;
  }
}

function requireAdmin(request: IncomingMessage) {
  const token = String(request.headers["x-admin-token"] ?? "");
  const telegramUserId = String(request.headers["x-admin-telegram-id"] ?? "");
  if (adminToken && safeEqual(token, adminToken)) return "admin-token";
  if (telegramUserId && adminTelegramIds.has(telegramUserId)) return `telegram:${telegramUserId}`;
  throw new HttpError(401, "Admin authorization is required");
}

function normalizeCartItems(items: CartItem[] | undefined): CartItem[] {
  const byProduct = new Map<string, number>();
  for (const item of Array.isArray(items) ? items : []) {
    const productId = String(item.productId ?? "").trim();
    const quantity = Number(item.quantity);
    const product = productId ? getProduct(productId) : null;
    const step = product?.unit === "kg" ? 0.5 : 1;
    if (!product || quantity <= 0 || !Number.isInteger(quantity / step)) continue;
    byProduct.set(productId, (byProduct.get(productId) ?? 0) + quantity);
  }
  return [...byProduct.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

function normalizeDeliveryMethod(method: DeliveryMethod | undefined): DeliveryMethod {
  return method === "pickup" || method === "free_delivery" || method === "paid_delivery" ? method : "paid_delivery";
}

function normalizeText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizeNonNegativeInteger(value: unknown, field: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new HttpError(400, `${field} must be a non-negative integer`);
  return parsed;
}

function normalizeSlug(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeProductUnit(value: unknown): Product["unit"] {
  const unit = String(value ?? "");
  if (["kg", "100g", "g", "l", "ml", "piece", "box"].includes(unit)) return unit as Product["unit"];
  throw new HttpError(400, "unit must be kg, 100g, g, l, ml, piece or box");
}

function isOrderStatus(status: string): status is OrderStatus {
  return ["new", "confirmed", "cooking", "ready", "delivering", "completed", "cancelled", "pending_payment", "paid_new", "in_progress", "delivered", "picked_up"].includes(status);
}

function isPaymentStatus(status: string): status is PaymentStatus {
  return ["pending", "paid", "cancelled", "failed", "refunded", "manual_check"].includes(status);
}

function createOrderNumber() {
  return `RK-${String(Date.now()).slice(-8)}`;
}

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1024 * 1024) throw new HttpError(413, "Request body is too large");
    chunks.push(buffer);
  }
  if (!chunks.length) return {} as T;
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function setCorsHeaders(response: ServerResponse) {
  response.setHeader("Access-Control-Allow-Origin", process.env.API_CORS_ORIGIN ?? "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type,X-Telegram-Init-Data,X-Admin-Token,X-Admin-Telegram-Id");
}

function readMoneyEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

type CategoryRow = { id: string; title: string; sort_order: number; is_visible: number };
type ProductRow = {
  id: string; category_id: string; title: string; description: string; price: number; unit: Product["unit"];
  unit_label: string; image_url: string; stock: number; is_visible: number; sort_order: number;
};
type UserRow = {
  telegram_user_id: string; name: string; first_name: string | null; last_name: string | null; username: string | null;
  phone: string | null; last_address: string | null; created_at: string; updated_at: string; last_seen_at: string;
};
type OrderRow = {
  id: string; order_number: string; telegram_user_id: string; customer_name: string; phone: string; address: string | null;
  telegram_username?: string | null; telegram_display_name?: string | null;
  delivery_method: DeliveryMethod; delivery_price: number; items_total: number; total: number; payment_status: PaymentStatus;
  status: OrderStatus; comment: string | null; idempotency_key: string | null; items_json: string; status_history_json: string;
  created_at: string; updated_at: string;
};
type StockMovementRow = {
  id: string; product_id: string; delta: number; previous_stock: number; next_stock: number; reason: StockMovement["reason"];
  order_id: string | null; changed_by: string; created_at: string;
};
type AuditEventRow = { id: string; actor: string; action: string; entity_type: AdminAuditEvent["entityType"]; entity_id: string; details_json: string; created_at: string };

function mapCategory(row: CategoryRow): Category {
  return { id: row.id, title: row.title, sortOrder: row.sort_order, isVisible: Boolean(row.is_visible) };
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id, categoryId: row.category_id, title: row.title, description: row.description, price: row.price,
    unit: row.unit, unitLabel: row.unit_label, imageUrl: row.image_url, stock: row.stock,
    isVisible: Boolean(row.is_visible), sortOrder: row.sort_order
  };
}

function mapUser(row: UserRow): CustomerProfile {
  return {
    telegramUserId: row.telegram_user_id, name: row.name, firstName: row.first_name, lastName: row.last_name,
    username: row.username, phone: row.phone, lastAddress: row.last_address,
    createdAt: row.created_at, updatedAt: row.updated_at, lastSeenAt: row.last_seen_at
  };
}

function mapOrder(row: OrderRow): Order {
  return {
    id: row.id, orderNumber: row.order_number, telegramUserId: row.telegram_user_id, customerName: row.customer_name,
    telegramUsername: row.telegram_username ?? null, telegramDisplayName: row.telegram_display_name ?? null,
    phone: row.phone, address: row.address, deliveryMethod: row.delivery_method, deliveryPrice: row.delivery_price,
    itemsTotal: row.items_total, total: row.total, paymentStatus: row.payment_status, status: row.status,
    comment: row.comment, idempotencyKey: row.idempotency_key, items: JSON.parse(row.items_json) as OrderItem[],
    statusHistory: JSON.parse(row.status_history_json) as Order["statusHistory"], createdAt: row.created_at, updatedAt: row.updated_at
  };
}

function mapStockMovement(row: StockMovementRow): StockMovement {
  return {
    id: row.id, productId: row.product_id, delta: row.delta, previousStock: row.previous_stock, nextStock: row.next_stock,
    reason: row.reason, orderId: row.order_id, changedBy: row.changed_by, createdAt: row.created_at
  };
}

function mapAuditEvent(row: AuditEventRow): AdminAuditEvent {
  return {
    id: row.id, actor: row.actor, action: row.action, entityType: row.entity_type,
    entityId: row.entity_id, details: JSON.parse(row.details_json) as Record<string, unknown>, createdAt: row.created_at
  };
}

class HttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
  }
}

function loadLocalEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    process.env[key] ??= value;
  }
}
