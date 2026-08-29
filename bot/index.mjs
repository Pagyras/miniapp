import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

loadLocalEnv();

const botMode = process.argv[2] === "admin" || process.env.BOT_MODE === "admin" ? "admin" : "user";
const token = botMode === "admin" ? process.env.ADMIN_BOT_TOKEN : process.env.USER_BOT_TOKEN ?? process.env.BOT_TOKEN;
const miniAppUrl = process.env.MINIAPP_URL ?? "https://pagyras.github.io/miniapp/";
const publicGroupUrl = process.env.PUBLIC_GROUP_URL ?? "https://t.me/rodnayakuhnyaenilina";
const apiUrl = process.env.BOT_API_URL ?? process.env.VITE_API_URL ?? "http://localhost:8787";
const adminToken = process.env.API_ADMIN_TOKEN ?? "";
const adminPassword = process.env.ADMIN_BOT_PASSWORD ?? "2006";
const adminSubscribersPath = resolve(process.cwd(), process.env.ADMIN_SUBSCRIBERS_PATH ?? "data/admin-subscribers.json");
const adminAuthPath = resolve(process.cwd(), process.env.ADMIN_AUTH_PATH ?? "data/admin-authorized.json");
const adminIds = new Set((process.env.API_ADMIN_TELEGRAM_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean));

const startText =
  process.env.BOT_START_TEXT ??
  [
    "Родная кухня Енилина",
    "Домашние сырники, котлеты, пельмени и вареники ручной работы.",
    "",
    "Работаем для Чебоксар и Новочебоксарска.",
    "Большинство позиций можно заказать по 500 г или 1 кг.",
    "Бесплатная доставка по городу при заказе от 3000 ₽.",
    "",
    "Откройте каталог, соберите корзину и отправьте заказ. Администратор свяжется с вами и уточнит детали."
  ].join("\n");
const LINE = "------------------------------";

if (!token) {
  console.error(`${botMode === "admin" ? "ADMIN_BOT_TOKEN" : "USER_BOT_TOKEN"} is required.`);
  process.exit(1);
}

const tgApiBase = `https://api.telegram.org/bot${token}`;
const notifiedOrderIds = new Set();
const pending = new Map();
const activeWindows = new Map();
const adminSubscribers = botMode === "admin" ? loadSet(adminSubscribersPath) : new Set();
const authorizedAdmins = botMode === "admin" ? loadSet(adminAuthPath) : new Set();
let offset = 0;

if (botMode === "admin") {
  await primeKnownOrders();
  startAdminOrderMonitor();
}

console.log(`${botMode} bot started. Mini App URL: ${miniAppUrl}`);
console.log(`Admin API URL: ${apiUrl}`);
await poll();

async function handleUpdate(update) {
  if (update.callback_query) return handleCallback(update.callback_query);

  const message = update.message;
  if (!message?.chat?.id) return;

  const chatId = message.chat.id;
  const userId = String(message.from?.id ?? "");
  const text = message.text?.trim() ?? message.caption?.trim() ?? "";

  if (text === "/id") {
    await send(chatId, `Ваш Telegram ID: ${userId}`);
    return;
  }

  if (botMode === "admin") {
    await handleAdminMessage({ chatId, userId, text, message });
    return;
  }

  if (text === "/start" || text === "/menu" || text === "/order") {
    await send(chatId, startText, miniAppKeyboard());
    return;
  }

  await send(chatId, "Открыть мини-приложение можно по кнопке ниже.", miniAppKeyboard());
}

async function handleAdminMessage({ chatId, userId, text, message }) {
  if (!isAdmin(userId)) {
    if (text === adminPassword) {
      authorizedAdmins.add(userId);
      adminSubscribers.add(String(chatId));
      saveSet(adminAuthPath, authorizedAdmins);
      saveSet(adminSubscribersPath, adminSubscribers);
      await sendAdminMenu(chatId, userId, "Доступ открыт.");
      return;
    }

    await send(chatId, "Введите пароль администратора.");
    return;
  }

  adminSubscribers.add(String(chatId));
  saveSet(adminSubscribersPath, adminSubscribers);

  const task = pending.get(userId);
  if (task && text !== "/cancel") {
    await handlePending({ chatId, userId, text, message, task });
    return;
  }

  if (text === "/cancel") {
    pending.delete(userId);
    await deleteMessageSafe(chatId, message.message_id);
    await sendAdminMenu(chatId, userId, "Действие отменено.");
    return;
  }

  if (text === "/start" || text === "/admin" || text === "/menu" || text === "") return sendAdminMenu(chatId, userId);
  if (text === "/orders") return sendOrders(chatId, userId, "active");
  if (text.startsWith("/products")) return sendProducts(chatId, userId, 0, text.replace("/products", "").trim());

  await sendAdminMenu(chatId, userId, "Выберите действие кнопками ниже.");
}

async function handleCallback(callback) {
  const userId = String(callback.from?.id ?? "");
  const message = callback.message;
  const chatId = message?.chat?.id;
  const data = String(callback.data ?? "");

  if (botMode === "user") {
    await answer(callback.id);
    if (data === "user_how") return edit(message, userHowText(), userInfoKeyboard());
    if (data === "user_contacts") return edit(message, userContactsText(), userInfoKeyboard());
    if (data === "user_menu") return edit(message, startText, miniAppKeyboard());
    return;
  }

  if (botMode !== "admin" || !isAdmin(userId)) {
    await answer(callback.id, "Введите пароль в админ-боте.");
    return;
  }

  const [type, id, value] = data.split("|");
  await answer(callback.id);

  try {
    if (data === "menu") return editAdminMenu(message, userId);
    if (type === "orders") return editOrders(message, userId, id || "active");
    if (type === "order") return editOrder(message, userId, await findOrder(id));
    if (type === "status") return editOrder(message, userId, await apiPatch(`/admin/orders/${id}/status`, { status: value }, userId));
    if (type === "pay") return editOrder(message, userId, await apiPatch(`/admin/orders/${id}/payment`, { paymentStatus: value }, userId));
    if (type === "products") return editProducts(message, userId, Number(id || 0), "");
    if (type === "product") return editProduct(message, userId, await findProduct(id));
    if (type === "pact") return productAction({ message, chatId, userId, productId: id, action: value });
    if (type === "categories") return editCategories(message, userId);
    if (type === "category") return editCategory(message, userId, await findCategory(id));
    if (type === "cact") return categoryAction({ message, chatId, userId, categoryId: id, action: value });
    if (type === "new_product") {
      pending.set(userId, { type: "new_product" });
      return editWindow(message, userId, newProductTemplate(), cancelKeyboard());
    }
    if (type === "new_category") {
      pending.set(userId, { type: "new_category" });
      return editWindow(message, userId, "Создание категории\n\nОтправьте данные одним сообщением:\n\nid=drinks\ntitle=Напитки\nsortOrder=100\n\n/cancel - отменить", cancelKeyboard());
    }
    if (type === "help") return editWindow(message, userId, helpText(), backKeyboard());
  } catch (error) {
    await send(chatId, error instanceof Error ? error.message : "Ошибка выполнения действия");
  }
}

async function productAction({ message, chatId, userId, productId, action }) {
  const product = await findProduct(productId);
  if (action === "stop" || action === "show") {
    const updated = await apiPatch(`/admin/products/${encodeURIComponent(productId)}`, { isVisible: action === "show" }, userId);
    await editProduct(message, userId, updated, "Готово.");
    return;
  }

  pending.set(userId, { type: `product_${action}`, productId });
  const hints = {
    title: "Введите новое название.",
    description: "Введите новое описание.",
    price: "Введите новую цену числом, например 700.",
    stock: "Введите новый остаток числом, например 12.",
    category: "Введите ID категории. Категории можно посмотреть в меню.",
    unit: "Введите единицу: kg, 100g, g, l, ml, piece или box.",
    unitLabel: "Введите подпись единицы, например 1 кг или 1 шт.",
    sortOrder: "Введите порядок сортировки числом, например 10.",
    photo: "Пришлите ссылку на фото или само фото."
  };
  await editWindow(
    message,
    userId,
    [`Изменение товара`, "", formatProduct(product), "", hints[action] ?? "Введите значение.", "/cancel - отменить"].join("\n"),
    cancelKeyboard()
  );
}

async function categoryAction({ message, chatId, userId, categoryId, action }) {
  if (action === "hide" || action === "show") {
    const category = await apiPatch(`/admin/categories/${encodeURIComponent(categoryId)}`, { isVisible: action === "show" }, userId);
    await editCategory(message, userId, category, "Готово.");
    return;
  }
  pending.set(userId, { type: `category_${action}`, categoryId });
  await editWindow(message, userId, `${action === "title" ? "Введите новое название категории." : "Введите порядок сортировки числом."}\n/cancel - отменить`, cancelKeyboard());
}

async function handlePending({ chatId, userId, text, message, task }) {
  await deleteMessageSafe(chatId, message.message_id);
  if (task.type.startsWith("product_")) {
    const field = task.type.replace("product_", "");
    let patch;
    if (field === "price" || field === "stock" || field === "sortOrder") {
      const value = Number(text.replace(/\s/g, ""));
      if (!Number.isInteger(value) || value < 0) return sendWindow(chatId, userId, "Нужно целое число 0 или больше.\n/cancel - отменить", cancelKeyboard());
      patch = { [field]: value };
    } else if (field === "photo") {
      let imageUrl = text;
      const photo = message.photo?.at(-1);
      if (photo) {
        const file = await tg("getFile", { file_id: photo.file_id });
        imageUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
      }
      if (!/^https?:\/\//.test(imageUrl)) return sendWindow(chatId, userId, "Пришлите фото или ссылку http(s).\n/cancel - отменить", cancelKeyboard());
      patch = { imageUrl };
    } else if (field === "category") {
      patch = { categoryId: text };
    } else {
      patch = { [field]: text };
    }
    pending.delete(userId);
    return sendProduct(chatId, userId, await apiPatch(`/admin/products/${encodeURIComponent(task.productId)}`, patch, userId), "Товар обновлен.");
  }

  if (task.type === "new_product") {
    pending.delete(userId);
    return sendProduct(chatId, userId, await apiPost("/admin/products", parseKeyValues(text), userId), "Товар создан.");
  }

  if (task.type === "new_category") {
    pending.delete(userId);
    return sendCategory(chatId, userId, await apiPost("/admin/categories", parseKeyValues(text), userId), "Категория создана.");
  }

  if (task.type.startsWith("category_")) {
    const field = task.type.replace("category_", "");
    let value = text;
    if (field === "sortOrder") {
      value = Number(text.replace(/\s/g, ""));
      if (!Number.isInteger(value) || value < 0) return sendWindow(chatId, userId, "Нужно целое число 0 или больше.\n/cancel - отменить", cancelKeyboard());
    }
    pending.delete(userId);
    return sendCategory(chatId, userId, await apiPatch(`/admin/categories/${encodeURIComponent(task.categoryId)}`, { [field]: value }, userId), "Категория обновлена.");
  }
}

async function sendAdminMenu(chatId, userId, prefix = "") {
  const [orders, products] = await Promise.all([apiGet("/admin/orders"), apiGet("/admin/products")]);
  await sendWindow(chatId, userId, adminMenuText({ orders, products, prefix }), adminMenuKeyboard());
}

async function editAdminMenu(message, userId) {
  const [orders, products] = await Promise.all([apiGet("/admin/orders"), apiGet("/admin/products")]);
  await editWindow(message, userId, adminMenuText({ orders, products }), adminMenuKeyboard());
}

function adminMenuText({ orders, products, prefix = "" }) {
  const active = orders.filter((o) => !["completed", "cancelled"].includes(o.status)).length;
  const fresh = orders.filter((o) => o.status === "new").length;
  const stopped = products.filter((p) => !p.isVisible).length;
  const low = products.filter((p) => p.stock <= 3).length;
  return [
    prefix,
    "РОДНАЯ КУХНЯ",
    "Админ-панель",
    LINE,
    "",
    "ЗАКАЗЫ",
    `  Новые       ${fresh}`,
    `  В работе    ${active}`,
    "",
    "",
    "КАТАЛОГ",
    `  Стоп-лист        ${stopped}`,
    `  Мало остатков    ${low}`,
    "",
    LINE,
    "Выберите действие кнопками ниже."
  ].filter(Boolean).join("\n");
}

async function sendOrders(chatId, userId, filter) {
  const view = await ordersView(filter);
  await sendWindow(chatId, userId, view.text, view.keyboard);
}

async function editOrders(message, userId, filter) {
  const view = await ordersView(filter);
  await editWindow(message, userId, view.text, view.keyboard);
}

async function ordersView(filter) {
  const orders = await apiGet("/admin/orders");
  const filtered = orders.filter((o) => filter === "new" ? o.status === "new" : filter === "done" ? ["completed", "cancelled"].includes(o.status) : !["completed", "cancelled"].includes(o.status)).slice(0, 12);
  return {
    text: [
      "ЗАКАЗЫ",
      filter === "new" ? "Новые заказы" : filter === "done" ? "Архив заказов" : "Активные заказы",
      LINE,
      "",
      filtered.length ? "Откройте заказ для обработки." : "В этом разделе пусто."
    ].join("\n"),
    keyboard: { inline_keyboard: [orderFilterButtons(), ...filtered.map((o) => [{ text: `${o.orderNumber} · ${o.total} ₽ · ${statusLabel(o.status)}`, callback_data: `order|${o.id}` }]), [{ text: "Назад в меню", callback_data: "menu" }]] }
  };
}

async function sendProducts(chatId, userId, page = 0, query = "") {
  const view = await productsView(page, query);
  await sendWindow(chatId, userId, view.text, view.keyboard);
}

async function editProducts(message, userId, page = 0, query = "") {
  const view = await productsView(page, query);
  await editWindow(message, userId, view.text, view.keyboard);
}

async function productsView(page = 0, query = "") {
  const products = await apiGet("/admin/products");
  const q = query.toLowerCase();
  const filtered = products.filter((p) => !q || p.title.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
  const size = 8;
  const maxPage = Math.max(0, Math.ceil(filtered.length / size) - 1);
  const safePage = Math.max(0, Math.min(Number(page) || 0, maxPage));
  const rows = filtered.slice(safePage * size, safePage * size + size);
  return {
    text: [
      "КАТАЛОГ",
      LINE,
      "",
      `  Товаров найдено    ${filtered.length}`,
      "",
      "Откройте карточку для редактирования."
    ].join("\n"),
    keyboard: { inline_keyboard: [...rows.map((p) => [{ text: `${p.isVisible ? "✓" : "Стоп"} ${p.title} · ${p.price} ₽ · ост. ${p.stock}`, callback_data: `product|${p.id}` }]), [{ text: "Назад", callback_data: `products|${Math.max(0, safePage - 1)}` }, { text: `${safePage + 1}/${Math.max(1, maxPage + 1)}`, callback_data: "noop" }, { text: "Далее", callback_data: `products|${Math.min(maxPage, safePage + 1)}` }], [{ text: "Новый товар", callback_data: "new_product" }], [{ text: "Назад в меню", callback_data: "menu" }]] }
  };
}

async function editCategories(message, userId) {
  const categories = await apiGet("/admin/categories");
  await editWindow(message, userId, ["КАТЕГОРИИ", LINE, "", `  Разделов каталога    ${categories.length}`, "", "Откройте раздел для настройки."].join("\n"), { inline_keyboard: [...categories.map((c) => [{ text: `${c.isVisible ? "Открыта" : "Скрыта"} · ${c.title}`, callback_data: `category|${c.id}` }]), [{ text: "Новая категория", callback_data: "new_category" }], [{ text: "Назад в меню", callback_data: "menu" }]] });
}

async function sendOrder(chatId, order, prefix = "") {
  await send(chatId, [prefix, formatOrder(order)].filter(Boolean).join("\n\n"), orderKeyboard(order));
}
async function editOrder(message, userId, order) {
  await editWindow(message, userId, formatOrder(order), orderKeyboard(order));
}
async function sendProduct(chatId, userId, product, prefix = "") {
  await sendWindow(chatId, userId, [prefix, formatProduct(product)].filter(Boolean).join("\n\n"), productKeyboard(product));
}
async function editProduct(message, userId, product, prefix = "") {
  await editWindow(message, userId, [prefix, formatProduct(product)].filter(Boolean).join("\n\n"), productKeyboard(product));
}
async function sendCategory(chatId, userId, category, prefix = "") {
  await sendWindow(chatId, userId, [prefix, formatCategory(category)].filter(Boolean).join("\n\n"), categoryKeyboard(category));
}
async function editCategory(message, userId, category, prefix = "") {
  await editWindow(message, userId, [prefix, formatCategory(category)].filter(Boolean).join("\n\n"), categoryKeyboard(category));
}

function formatOrder(order) {
  const items = order.items.map((i) => `  ${i.title} x${i.quantity} = ${i.lineTotal} ₽`).join("\n");
  const telegramContact = order.telegramUsername ? `@${order.telegramUsername}` : `ID ${order.telegramUserId}`;
  return [
    `ЗАКАЗ ${order.orderNumber}`,
    LINE,
    "",
    "СОСТОЯНИЕ",
    `  Заказ     ${statusLabel(order.status)}`,
    `  Оплата    ${paymentLabel(order.paymentStatus)}`,
    "",
    "СОСТАВ",
    items,
    "",
    "СУММА",
    `  К оплате    ${order.total} ₽`,
    `  Товары      ${order.itemsTotal} ₽`,
    `  Доставка    ${order.deliveryMethod === "paid_delivery" ? "оплачивает клиент отдельно" : "0 ₽"}`,
    "",
    "КЛИЕНТ",
    `  Имя         ${order.customerName}`,
    `  Telegram    ${telegramContact}`,
    order.telegramDisplayName && order.telegramDisplayName !== order.customerName ? `  Профиль     ${order.telegramDisplayName}` : "",
    `  Телефон     ${order.phone}`,
    `  Получение   ${order.deliveryMethod === "pickup" ? "Самовывоз" : order.address}`,
    order.comment ? `  Комментарий ${order.comment}` : "",
    "",
    LINE,
    "Кнопки ниже меняют статус заказа и помогают связаться с клиентом."
  ].filter(Boolean).join("\n");
}
function formatProduct(p) {
  return [
    p.title.toUpperCase(),
    LINE,
    "",
    "ОСНОВНОЕ",
    `  Цена       ${p.price} ₽`,
    `  Остаток    ${p.stock}`,
    `  Статус     ${p.isVisible ? "в продаже" : "стоп"}`,
    "",
    "КАТАЛОГ",
    `  Категория     ${p.categoryId}`,
    `  Единица       ${p.unitLabel}`,
    `  Сортировка    ${p.sortOrder}`,
    "",
    "ОПИСАНИЕ",
    p.description,
    "",
    `ID: ${p.id}`,
    "",
    LINE,
    "Выберите параметр для изменения."
  ].join("\n");
}
function formatCategory(c) {
  return [
    c.title.toUpperCase(),
    LINE,
    "",
    `  Статус        ${c.isVisible ? "видна" : "скрыта"}`,
    `  Сортировка    ${c.sortOrder}`,
    `ID: ${c.id}`,
    "",
    LINE,
    "Выберите действие."
  ].join("\n");
}

function miniAppKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "Открыть каталог", web_app: { url: miniAppUrl } }],
      [
        { text: "Как заказать", callback_data: "user_how" },
        { text: "Контакты", callback_data: "user_contacts" }
      ],
      [{ text: "Группа Родной кухни", url: publicGroupUrl }]
    ]
  };
}

function userInfoKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "Открыть каталог", web_app: { url: miniAppUrl } }],
      [
        { text: "Главное меню", callback_data: "user_menu" },
        { text: "Группа", url: publicGroupUrl }
      ]
    ]
  };
}

function userHowText() {
  return [
    "Как оформить заказ",
    "",
    "1. Нажмите Открыть каталог.",
    "2. Выберите товары и нужный вес.",
    "3. Укажите имя, телефон, адрес или самовывоз.",
    "4. Отправьте заказ через мини-приложение.",
    "",
    "Бесплатная доставка по городу при заказе от 3000 ₽.",
    "При меньшей сумме доставка курьером за счет заказчика или самовывоз: Спиридона Михайлова, 1.",
    "",
    "После оформления администратор свяжется с вами, чтобы подтвердить заказ и уточнить детали."
  ].join("\n");
}

function userContactsText() {
  return [
    "Основная связь и новости:",
    publicGroupUrl,
    "",
    "География: Чебоксары и Новочебоксарск.",
    "Если есть вопрос по заказу, напишите в группу или дождитесь сообщения администратора после оформления."
  ].join("\n");
}
function adminMenuKeyboard() { return { inline_keyboard: [[{ text: "Заказы в работе", callback_data: "orders|active" }, { text: "Новые заказы", callback_data: "orders|new" }], [{ text: "Каталог", callback_data: "products|0" }, { text: "Категории", callback_data: "categories" }], [{ text: "Добавить товар", callback_data: "new_product" }, { text: "Справка", callback_data: "help" }]] }; }
function orderKeyboard(o) {
  const contactUrl = o.telegramUsername ? `https://t.me/${o.telegramUsername}` : `tg://user?id=${o.telegramUserId}`;
  return {
    inline_keyboard: [
      [{ text: "Написать клиенту", url: contactUrl }],
      [{ text: "Принять", callback_data: `status|${o.id}|confirmed` }],
      [{ text: "Завершить", callback_data: `status|${o.id}|completed` }, { text: "Отменить", callback_data: `status|${o.id}|cancelled` }],
      [{ text: "Проверить оплату", callback_data: `pay|${o.id}|manual_check` }],
      [{ text: "К заказам", callback_data: "orders|active" }]
    ]
  };
}
function productKeyboard(p) { return { inline_keyboard: [[{ text: "Название", callback_data: `pact|${p.id}|title` }, { text: "Описание", callback_data: `pact|${p.id}|description` }], [{ text: "Цена", callback_data: `pact|${p.id}|price` }, { text: "Остаток", callback_data: `pact|${p.id}|stock` }], [{ text: "Категория", callback_data: `pact|${p.id}|category` }, { text: "Порядок", callback_data: `pact|${p.id}|sortOrder` }], [{ text: "Единица", callback_data: `pact|${p.id}|unit` }, { text: "Подпись", callback_data: `pact|${p.id}|unitLabel` }], [{ text: p.isVisible ? "Поставить в стоп" : "Вернуть в продажу", callback_data: `pact|${p.id}|${p.isVisible ? "stop" : "show"}` }], [{ text: "Фото", callback_data: `pact|${p.id}|photo` }, { text: "К каталогу", callback_data: "products|0" }]] }; }
function categoryKeyboard(c) { return { inline_keyboard: [[{ text: "Название", callback_data: `cact|${c.id}|title` }, { text: "Сортировка", callback_data: `cact|${c.id}|sortOrder` }], [{ text: c.isVisible ? "Скрыть" : "Показать", callback_data: `cact|${c.id}|${c.isVisible ? "hide" : "show"}` }], [{ text: "К категориям", callback_data: "categories" }]] }; }
function backKeyboard() { return { inline_keyboard: [[{ text: "Назад в меню", callback_data: "menu" }]] }; }
function cancelKeyboard() { return { inline_keyboard: [[{ text: "Отменить", callback_data: "menu" }]] }; }
function orderFilterButtons() { return [{ text: "Активные", callback_data: "orders|active" }, { text: "Новые", callback_data: "orders|new" }, { text: "Архив", callback_data: "orders|done" }]; }

function newProductTemplate() {
  return [
    "СОЗДАНИЕ ТОВАРА",
    LINE,
    "",
    "Скопируйте шаблон, заполните значения и отправьте одним сообщением.",
    "",
    "id=new-product",
    "title=Новый товар",
    "categoryId=breakfast",
    "price=500",
    "stock=10",
    "unit=piece",
    "unitLabel=1 шт.",
    "sortOrder=1000",
    "isVisible=false",
    "description=Описание товара",
    "imageUrl=https://...",
    "",
    "/cancel - отменить"
  ].join("\n");
}
function helpText() {
  return [
    "СПРАВКА",
    LINE,
    "",
    "Заказы",
    "  Открывайте карточку заказа и меняйте статус кнопками. При отмене остатки возвращаются автоматически.",
    "",
    "Товары",
    "  Можно менять название, описание, цену, остаток, категорию, единицу, подпись, сортировку, фото и стоп-лист.",
    "",
    "Категории",
    "  Можно создавать разделы, менять название, сортировку и видимость.",
    "",
    "Уведомления",
    "  Новые заказы приходят всем, кто ввел пароль и открыл админ-бот.",
    "",
    "/cancel - отменить текущий ввод"
  ].join("\n");
}

async function findOrder(id) { const x = (await apiGet("/admin/orders")).find((o) => o.id === id); if (!x) throw new Error("Заказ не найден."); return x; }
async function findProduct(id) { const x = (await apiGet("/admin/products")).find((p) => p.id === id); if (!x) throw new Error("Товар не найден."); return x; }
async function findCategory(id) { const x = (await apiGet("/admin/categories")).find((c) => c.id === id); if (!x) throw new Error("Категория не найдена."); return x; }

async function primeKnownOrders() { try { for (const o of await apiGet("/admin/orders")) notifiedOrderIds.add(o.id); } catch (e) { console.error(e instanceof Error ? e.message : e); } }
function startAdminOrderMonitor() {
  if (!adminToken) return;
  setInterval(async () => {
    try {
      const fresh = (await apiGet("/admin/orders")).filter((o) => o.status === "new" && !notifiedOrderIds.has(o.id)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      for (const order of fresh) {
        notifiedOrderIds.add(order.id);
        for (const chatId of adminSubscribers) await sendOrder(chatId, order, "Новый заказ");
      }
    } catch (e) { console.error(e instanceof Error ? e.message : e); }
  }, 10000);
}

async function apiGet(path) { return readApiResponse(await fetch(`${apiUrl}${path}`, { headers: adminHeaders() })); }
async function apiPatch(path, payload, userId) { return readApiResponse(await fetch(`${apiUrl}${path}`, { method: "PATCH", headers: adminHeaders(userId), body: JSON.stringify(payload) })); }
async function apiPost(path, payload, userId) { return readApiResponse(await fetch(`${apiUrl}${path}`, { method: "POST", headers: adminHeaders(userId), body: JSON.stringify(payload) })); }
function adminHeaders(userId) { return { "Content-Type": "application/json", "X-Admin-Token": adminToken, ...(userId ? { "X-Admin-Telegram-Id": userId } : {}) }; }
async function readApiResponse(response) { const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error ?? `API error: ${response.status}`); return data; }

function isAdmin(userId) { return adminIds.has(String(userId)) || authorizedAdmins.has(String(userId)); }
function parseKeyValues(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const index = line.indexOf("=");
    if (index < 1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (["price", "stock", "sortOrder"].includes(key)) value = Number(value);
    if (["isVisible"].includes(key)) value = value === "true" || value === "1" || value.toLowerCase() === "yes";
    out[key] = value;
  }
  return out;
}
function statusLabel(s) { return ({ new: "новый", confirmed: "подтвержден", cooking: "готовится", ready: "готов", delivering: "доставка", completed: "завершен", cancelled: "отменен" }[s] ?? s); }
function paymentLabel(s) { return ({ pending: "ожидает оплаты", paid: "оплачен", cancelled: "отменена", failed: "ошибка", refunded: "возврат", manual_check: "проверить вручную" }[s] ?? s); }

async function send(chatId, text, reply_markup) { return tg("sendMessage", { chat_id: chatId, text, ...(reply_markup ? { reply_markup } : {}) }); }
async function edit(message, text, reply_markup) { return tg("editMessageText", { chat_id: message.chat.id, message_id: message.message_id, text, ...(reply_markup ? { reply_markup } : {}) }); }
async function answer(id, text) { return tg("answerCallbackQuery", { callback_query_id: id, ...(text ? { text } : {}) }); }

async function sendWindow(chatId, userId, text, reply_markup) {
  await deleteActiveWindow(userId);
  const message = await send(chatId, text, reply_markup);
  activeWindows.set(String(userId), { chatId: message.chat.id, messageId: message.message_id });
  return message;
}

async function editWindow(message, userId, text, reply_markup) {
  activeWindows.set(String(userId), { chatId: message.chat.id, messageId: message.message_id });
  return edit(message, text, reply_markup);
}

async function deleteActiveWindow(userId) {
  const active = activeWindows.get(String(userId));
  if (!active) return;
  await deleteMessageSafe(active.chatId, active.messageId);
  activeWindows.delete(String(userId));
}

async function deleteMessageSafe(chatId, messageId) {
  if (!chatId || !messageId) return;
  try {
    await tg("deleteMessage", { chat_id: chatId, message_id: messageId });
  } catch {
    // Telegram may reject deletion for old messages; keep UX moving.
  }
}

async function tg(method, payload) {
  const response = await fetch(`${tgApiBase}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await response.json();
  if (!data.ok) throw new Error(`${method} failed: ${data.description ?? "unknown Telegram API error"}`);
  return data.result;
}
async function poll() {
  while (true) {
    try {
      const updates = await tg("getUpdates", { offset, timeout: 30, allowed_updates: ["message", "callback_query"] });
      for (const update of updates) { offset = update.update_id + 1; await handleUpdate(update); }
    } catch (e) {
      console.error(e instanceof Error ? e.message : e);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

function loadSet(path) { try { const data = JSON.parse(readFileSync(path, "utf8")); return new Set(Array.isArray(data) ? data.map(String) : []); } catch { return new Set(); } }
function saveSet(path, set) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify([...set], null, 2), "utf8"); }
function loadLocalEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const i = trimmed.indexOf("=");
    process.env[trimmed.slice(0, i).trim()] ??= trimmed.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
}
