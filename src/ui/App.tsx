import {
  FREE_DELIVERY_THRESHOLD as DEFAULT_FREE_DELIVERY_THRESHOLD,
  PICKUP_ADDRESS as DEFAULT_PICKUP_ADDRESS,
  categoriesSeed,
  productsSeed,
  type CartItem,
  type Category,
  type DeliveryMethod,
  type Order,
  type Product
} from "../shared";
import {
  ArrowLeft,
  Baby,
  BadgeRussianRuble,
  ChevronRight,
  Clock3,
  Home,
  Minus,
  PackageCheck,
  Plus,
  ShoppingBasket,
  Store,
  Truck,
  UserRound
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Screen = "home" | "catalog" | "cart" | "profile";

type CheckoutForm = {
  customerName: string;
  phone: string;
  address: string;
  comment: string;
  deliveryMethod: DeliveryMethod;
};

const apiUrl = import.meta.env.VITE_API_URL ?? "";
const demoMode = import.meta.env.VITE_DEMO_MODE !== "false";
const fallbackTelegramUserId = import.meta.env.VITE_FALLBACK_TELEGRAM_USER_ID ?? "demo-telegram-user";
const freeDeliveryThreshold = readMoneyEnv(import.meta.env.VITE_FREE_DELIVERY_THRESHOLD, DEFAULT_FREE_DELIVERY_THRESHOLD);
const pickupAddress = import.meta.env.VITE_PICKUP_ADDRESS ?? DEFAULT_PICKUP_ADDRESS;

const currency = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0
});

const deliveryLabel: Record<DeliveryMethod, string> = {
  free_delivery: "Доставка за наш счет",
  paid_delivery: "Доставка",
  pickup: "Самовывоз"
};

export function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [telegramUserId, setTelegramUserId] = useState(fallbackTelegramUserId);
  const [telegramName, setTelegramName] = useState("Гость");
  const [telegramInitData, setTelegramInitData] = useState("");
  const [telegramUser, setTelegramUser] = useState<{
    firstName: string | null;
    lastName: string | null;
    username: string | null;
  }>({ firstName: null, lastName: null, username: null });
  const [categories, setCategories] = useState<Category[]>(categoriesSeed);
  const [products, setProducts] = useState<Product[]>(productsSeed);
  const [selectedCategory, setSelectedCategory] = useState("breakfast");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [checkout, setCheckout] = useState<CheckoutForm>({
    customerName: "Гость",
    phone: "",
    address: "",
    comment: "",
    deliveryMethod: "paid_delivery"
  });
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    const user = tg?.initDataUnsafe?.user;
    const userId = user?.id;
    setTelegramInitData(tg?.initData ?? "");

    if (userId) {
      setTelegramUserId(String(userId));
    }

    const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() || user?.username || "Гость";
    setTelegramUser({
      firstName: user?.first_name ?? null,
      lastName: user?.last_name ?? null,
      username: user?.username ?? null
    });
    setTelegramName(name);
    setCheckout((current) => ({
      ...current,
      customerName: current.customerName === "Гость" ? name : current.customerName
    }));

    tg?.ready();
    tg?.expand();
  }, []);

  useEffect(() => {
    if (!apiUrl) {
      return;
    }

    Promise.all([
      fetch(`${apiUrl}/categories`).then((response) => response.json()),
      fetch(`${apiUrl}/products`).then((response) => response.json())
    ])
      .then(([nextCategories, nextProducts]) => {
        setCategories(Array.isArray(nextCategories) ? nextCategories : categoriesSeed);
        setProducts(Array.isArray(nextProducts) ? nextProducts : productsSeed);
      })
      .catch(() => {
        setCategories(categoriesSeed);
        setProducts(productsSeed);
      });
  }, []);

  useEffect(() => {
    if (!apiUrl) {
      return;
    }

    fetch(`${apiUrl}/users`, {
      method: "POST",
      headers: createApiHeaders(telegramInitData),
      body: JSON.stringify({
        telegramUserId,
        name: telegramName,
        firstName: telegramUser.firstName,
        lastName: telegramUser.lastName,
        username: telegramUser.username
      })
    }).catch(() => undefined);

    fetch(`${apiUrl}/orders?telegramUserId=${encodeURIComponent(telegramUserId)}`)
      .then((response) => response.json())
      .then((nextOrders) => {
        if (!Array.isArray(nextOrders)) {
          return;
        }

        setOrders(nextOrders);

        const lastOrder = nextOrders[0] as Order | undefined;
        if (lastOrder) {
          setCheckout((current) => ({
            ...current,
            customerName: current.customerName === "Гость" ? lastOrder.customerName : current.customerName,
            phone: current.phone || lastOrder.phone,
            address: current.address || lastOrder.address || ""
          }));
        }
      })
      .catch(() => undefined);
  }, [telegramUserId, telegramName, telegramInitData, telegramUser.firstName, telegramUser.lastName, telegramUser.username]);

  const cartProducts = useMemo(() => {
    return cart
      .map((item) => {
        const product = products.find((candidate) => candidate.id === item.productId);
        return product ? { product, quantity: item.quantity } : null;
      })
      .filter(Boolean) as Array<{ product: Product; quantity: number }>;
  }, [cart, products]);

  const cartQuantities = useMemo(() => {
    return new Map(cart.map((item) => [item.productId, item.quantity]));
  }, [cart]);

  const itemsTotal = cartProducts.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const actualDeliveryMethod: DeliveryMethod =
    checkout.deliveryMethod === "pickup" ? "pickup" : itemsTotal >= freeDeliveryThreshold ? "free_delivery" : "paid_delivery";
  const deliveryPrice = 0;
  const total = itemsTotal;
  const cartCount = cart.length;
  const filteredProducts = products.filter((product) => {
    const matchesCategory = product.categoryId === selectedCategory;
    return matchesCategory;
  });

  const addToCart = (product: Product) => {
    const step = quantityStep(product);
    if (product.stock < step) {
      return;
    }

    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id);
      if (!existing) {
        return [...current, { productId: product.id, quantity: step }];
      }

      return current.map((item) =>
        item.productId === product.id
          ? { ...item, quantity: normalizeQuantity(Math.min(item.quantity + step, product.stock)) }
          : item
      );
    });
  };

  const changeQuantity = (productId: string, delta: number) => {
    setCart((current) =>
      current
        .map((item) => {
          if (item.productId !== productId) {
            return item;
          }

          const product = products.find((candidate) => candidate.id === productId);
          const step = product ? quantityStep(product) : 1;
          const nextQuantity = normalizeQuantity(
            Math.max(0, Math.min(item.quantity + Math.sign(delta) * step, product?.stock ?? 0))
          );
          return { ...item, quantity: nextQuantity };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const pay = async () => {
    if (!cartProducts.length || !checkout.phone.trim()) {
      return;
    }

    setIsPaying(true);
    try {
      let order: Order | null = null;

      if (apiUrl) {
        try {
          const response = await fetch(`${apiUrl}/orders`, {
            method: "POST",
            headers: createApiHeaders(telegramInitData),
            body: JSON.stringify({
              telegramUserId,
              customerName: checkout.customerName,
              phone: checkout.phone,
              address: actualDeliveryMethod === "pickup" ? undefined : checkout.address,
              comment: checkout.comment,
              deliveryMethod: actualDeliveryMethod,
              idempotencyKey: crypto.randomUUID(),
              items: cart
            })
          });

          if (!response.ok) {
            throw new Error("Не удалось оформить заказ");
          }

          order = (await response.json()) as Order;
        } catch (error) {
          if (!demoMode) {
            throw error;
          }
        }
      }

      order ??= createDemoOrder({
        telegramUserId,
        checkout,
        deliveryMethod: actualDeliveryMethod,
        items: cartProducts,
        deliveryPrice,
        itemsTotal,
        total
      });

      if (!order.items || !Array.isArray(order.items)) {
        throw new Error("Некорректный ответ сервера");
      }

      setOrders((current) => [order, ...current]);
      setProducts((current) =>
        current.map((product) => {
          const orderedItem = order.items.find((item) => item.productId === product.id);
          return orderedItem ? { ...product, stock: product.stock - orderedItem.quantity } : product;
        })
      );
      setCart([]);
      setScreen("profile");
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div className="app-shell">
      <main className="app-main">
        {screen === "home" && (
          <HomeScreen
            categories={categories}
            products={products}
            cartQuantities={cartQuantities}
            onOpenCatalog={(categoryId) => {
              setSelectedCategory(categoryId);
              setScreen("catalog");
            }}
            onAddToCart={addToCart}
            onQuantity={changeQuantity}
          />
        )}

        {screen === "catalog" && (
          <CatalogScreen
            categories={categories}
            products={filteredProducts}
            selectedCategory={selectedCategory}
            selectedProduct={selectedProduct}
            cartQuantities={cartQuantities}
            onSelectCategory={setSelectedCategory}
            onSelectProduct={setSelectedProduct}
            onBackProduct={() => setSelectedProduct(null)}
            onAddToCart={addToCart}
            onQuantity={changeQuantity}
          />
        )}

        {screen === "cart" && (
          <CartScreen
            items={cartProducts}
            checkout={checkout}
            itemsTotal={itemsTotal}
            deliveryPrice={deliveryPrice}
            total={total}
            isPaying={isPaying}
            onCheckoutChange={setCheckout}
            onQuantity={changeQuantity}
            onPay={pay}
          />
        )}

        {screen === "profile" && <ProfileScreen orders={orders} checkout={checkout} telegramName={telegramName} username={telegramUser.username} />}
      </main>

      <nav className="bottom-nav">
        <NavButton icon={<Home size={19} />} label="Главная" active={screen === "home"} onClick={() => setScreen("home")} />
        <NavButton icon={<Store size={19} />} label="Каталог" active={screen === "catalog"} onClick={() => setScreen("catalog")} />
        <NavButton
          icon={<ShoppingBasket size={19} />}
          label={`Корзина${cartCount ? ` · ${cartCount}` : ""}`}
          active={screen === "cart"}
          onClick={() => setScreen("cart")}
        />
        <NavButton icon={<UserRound size={19} />} label="Профиль" active={screen === "profile"} onClick={() => setScreen("profile")} />
      </nav>
    </div>
  );
}

function createDemoOrder({
  telegramUserId,
  checkout,
  deliveryMethod,
  items,
  deliveryPrice,
  itemsTotal,
  total
}: {
  telegramUserId: string;
  checkout: CheckoutForm;
  deliveryMethod: DeliveryMethod;
  items: Array<{ product: Product; quantity: number }>;
  deliveryPrice: number;
  itemsTotal: number;
  total: number;
}): Order {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    orderNumber: `DEMO-${String(Date.now()).slice(-6)}`,
    telegramUserId,
    customerName: checkout.customerName,
    phone: checkout.phone,
    address: deliveryMethod === "pickup" ? null : checkout.address,
    deliveryMethod,
    deliveryPrice,
    itemsTotal,
    total,
    paymentStatus: "pending",
    status: "new",
    comment: checkout.comment || null,
    idempotencyKey: null,
    items: items.map(({ product, quantity }) => ({
      productId: product.id,
      title: product.title,
      price: product.price,
      quantity,
      lineTotal: product.price * quantity
    })),
    statusHistory: [
      {
        status: "new",
        changedBy: "demo",
        changedAt: now,
        comment: null
      }
    ],
    createdAt: now,
    updatedAt: now
  };
}

function HomeScreen({
  categories,
  products,
  cartQuantities,
  onOpenCatalog,
  onAddToCart,
  onQuantity
}: {
  categories: Category[];
  products: Product[];
  cartQuantities: Map<string, number>;
  onOpenCatalog: (categoryId: string) => void;
  onAddToCart: (product: Product) => void;
  onQuantity: (productId: string, delta: number) => void;
}) {
  const popular = categories
    .map((category) => products.find((product) => product.categoryId === category.id && product.stock > 0))
    .filter((product): product is Product => Boolean(product))
    .slice(0, 4);

  return (
    <div className="screen stack">
      <section className="hero">
        <div>
          <p className="eyebrow">Домашняя еда в запас</p>
          <h1>Родная кухня</h1>
          <p>
            Сырники, котлеты, пельмени и вареники ручной работы. Соберите корзину, отправьте заказ, а мы напишем и
            договоримся по оплате и доставке.
          </p>
        </div>
        <button className="primary-button" onClick={() => onOpenCatalog(categories[0]?.id ?? "breakfast")}>
          <ShoppingBasket size={18} />
          Выбрать еду
        </button>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Наше меню</h2>
        </div>
        <div className="category-grid">
          {categories.map((category) => (
            <button className="category-tile" key={category.id} onClick={() => onOpenCatalog(category.id)}>
              <span>{category.title}</span>
              <ChevronRight size={17} />
            </button>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Часто берут</h2>
        </div>
        <ProductList
          products={popular}
          cartQuantities={cartQuantities}
          onSelect={() => undefined}
          onAddToCart={onAddToCart}
          onQuantity={onQuantity}
          compact
        />
      </section>

      <InfoSection icon={<Baby size={22} />} title="Готовим и для детей">
        <p>Заказываете для ребенка? Просто скажите нам об этом.</p>
        <strong>Любую позицию из меню мы можем приготовить без лука и чеснока, с минимумом соли и сахара.</strong>
        <p>Выбирайте то, что любит ваш ребенок: отдельно ограничивать выбор детским меню не нужно.</p>
      </InfoSection>

      <InfoSection icon={<PackageCheck size={22} />} title="Соберите запас на неделю">
        <p>Большинство позиций можно заказать по 500 г или 1 кг.</p>
        <p>
          Не знаете, что выбрать? Напишите, на сколько человек хотите собрать запас, и мы поможем собрать морозилку
          на неделю.
        </p>
      </InfoSection>

      <InfoSection icon={<Truck size={22} />} title="Доставка и заказ">
        <strong>Бесплатная доставка по городу при заказе от {currency.format(freeDeliveryThreshold)}.</strong>
        <p>
          При заказе до {currency.format(freeDeliveryThreshold)} доставка курьером за счет заказчика или самовывоз: <strong>{pickupAddress}</strong>.
        </p>
        <p>Для заказа просто напишите нам в чат. Мы обработаем заявку и подтвердим заказ.</p>
      </InfoSection>
    </div>
  );
}

function CatalogScreen(props: {
  categories: Category[];
  products: Product[];
  selectedCategory: string;
  selectedProduct: Product | null;
  cartQuantities: Map<string, number>;
  onSelectCategory: (category: string) => void;
  onSelectProduct: (product: Product) => void;
  onBackProduct: () => void;
  onAddToCart: (product: Product) => void;
  onQuantity: (productId: string, delta: number) => void;
}) {
  if (props.selectedProduct) {
    return (
      <ProductDetails
        product={props.selectedProduct}
        selectedQuantity={props.cartQuantities.get(props.selectedProduct.id) ?? 0}
        onBack={props.onBackProduct}
        onAddToCart={props.onAddToCart}
        onQuantity={props.onQuantity}
      />
    );
  }

  return (
    <div className="screen stack">
      <Header title="Каталог" subtitle="Домашние сырники, котлеты, пельмени, вареники и заготовки для быстрого ужина" />
      <div className="chips-row">
        {props.categories.map((category) => (
          <button
            className={`chip ${props.selectedCategory === category.id ? "is-active" : ""}`}
            key={category.id}
            onClick={() => props.onSelectCategory(category.id)}
          >
            {category.title}
          </button>
        ))}
      </div>
      <ProductList
        products={props.products}
        cartQuantities={props.cartQuantities}
        onSelect={props.onSelectProduct}
        onAddToCart={props.onAddToCart}
        onQuantity={props.onQuantity}
      />
    </div>
  );
}

function ProductDetails({
  product,
  selectedQuantity,
  onBack,
  onAddToCart,
  onQuantity
}: {
  product: Product;
  selectedQuantity: number;
  onBack: () => void;
  onAddToCart: (product: Product) => void;
  onQuantity: (productId: string, delta: number) => void;
}) {
  const isAvailable = product.stock >= quantityStep(product);

  return (
    <div className="screen stack product-detail">
      <button className="ghost-button" onClick={onBack}>
        <ArrowLeft size={18} />
        Назад
      </button>
      <img className="detail-image" src={product.imageUrl} alt="" />
      <div className="detail-block">
        <StatusBadge stock={product.stock} />
        <h1>{product.title}</h1>
        <p>{product.description}</p>
        <div className="price-row">
          <strong>{currency.format(product.price)}</strong>
          <span>{product.unitLabel}</span>
        </div>
      </div>
      {selectedQuantity > 0 ? (
        <ProductStepper
          quantity={selectedQuantity}
          onMinus={() => onQuantity(product.id, -1)}
          onPlus={() => onQuantity(product.id, 1)}
        />
      ) : (
        <button className="primary-button" disabled={!isAvailable} onClick={() => onAddToCart(product)}>
          <ShoppingBasket size={18} />
          {isAvailable ? "Добавить в корзину" : "Нет в наличии"}
        </button>
      )}
    </div>
  );
}

function CartScreen(props: {
  items: Array<{ product: Product; quantity: number }>;
  checkout: CheckoutForm;
  itemsTotal: number;
  deliveryPrice: number;
  total: number;
  isPaying: boolean;
  onCheckoutChange: (form: CheckoutForm) => void;
  onQuantity: (productId: string, delta: number) => void;
  onPay: () => void;
}) {
  const leftToFreeDelivery = Math.max(0, freeDeliveryThreshold - props.itemsTotal);
  const canPay =
    props.items.length > 0 &&
    props.checkout.phone.trim().length > 5 &&
    (props.checkout.deliveryMethod === "pickup" || props.checkout.address.trim().length > 3);

  const setForm = (patch: Partial<CheckoutForm>) => props.onCheckoutChange({ ...props.checkout, ...patch });
  const actualDeliveryMethod: DeliveryMethod =
    props.checkout.deliveryMethod === "pickup"
      ? "pickup"
      : props.itemsTotal >= freeDeliveryThreshold
        ? "free_delivery"
        : "paid_delivery";

  return (
    <div className="screen stack">
      <Header title="Ваш заказ" subtitle="Проверьте выбранную еду, укажите контакты и отправьте заказ" />

      {props.items.length === 0 ? (
        <EmptyState title="Пока ничего не выбрано" text="Добавьте сырники, котлеты, пельмени или вареники из каталога." />
      ) : (
        <div className="cart-list">
          {props.items.map(({ product, quantity }) => (
            <div className="cart-item" key={product.id}>
              <img src={product.imageUrl} alt="" />
              <div>
                <strong>{product.title}</strong>
                <span>{formatCartQuantity(product, quantity)}</span>
                <b>{currency.format(product.price * quantity)}</b>
              </div>
              <div className="stepper">
                <button onClick={() => props.onQuantity(product.id, -1)} aria-label="Уменьшить">
                  <Minus size={16} />
                </button>
                <span>{formatQuantityNumber(quantity)}</span>
                <button onClick={() => props.onQuantity(product.id, 1)} aria-label="Увеличить">
                  <Plus size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <section className="checkout-panel">
        <h2>Как получить</h2>
        <div className="delivery-grid">
          <DeliveryButton
            active={props.checkout.deliveryMethod !== "pickup"}
            title="Доставка"
            text={props.itemsTotal >= freeDeliveryThreshold ? "Бесплатно" : "Оплата отдельно"}
            onClick={() => setForm({ deliveryMethod: props.itemsTotal >= freeDeliveryThreshold ? "free_delivery" : "paid_delivery" })}
          />
          <DeliveryButton active={props.checkout.deliveryMethod === "pickup"} title="Самовывоз" text="0 ₽" onClick={() => setForm({ deliveryMethod: "pickup" })} />
        </div>

        {leftToFreeDelivery > 0 && props.checkout.deliveryMethod !== "pickup" ? (
          <p className="delivery-note">
            До бесплатной доставки осталось {currency.format(leftToFreeDelivery)}. При меньшей сумме доставка
            оплачивается заказчиком отдельно и не входит в сумму заказа.
          </p>
        ) : (
          props.checkout.deliveryMethod !== "pickup" && (
            <p className="delivery-note">Доставка за наш счет. После оформления администратор напишет и уточнит удобное время.</p>
          )
        )}

        {props.checkout.deliveryMethod === "pickup" ? (
          <p className="delivery-note">Самовывоз: {pickupAddress}. После оформления напишем и согласуем, когда удобно подойти.</p>
        ) : (
          <input className="input" value={props.checkout.address} onChange={(event) => setForm({ address: event.target.value })} placeholder="Адрес доставки" />
        )}

        <input className="input" value={props.checkout.customerName} onChange={(event) => setForm({ customerName: event.target.value })} placeholder="Имя" />
        <input className="input" value={props.checkout.phone} onChange={(event) => setForm({ phone: event.target.value })} placeholder="Телефон для связи" />
        <input className="input" value={props.checkout.comment} onChange={(event) => setForm({ comment: event.target.value })} placeholder="Комментарий к заказу" />
      </section>

      <section className="summary">
        <SummaryLine label="Еда" value={currency.format(props.itemsTotal)} />
        <SummaryLine
          label={deliveryLabel[actualDeliveryMethod]}
          value={actualDeliveryMethod === "paid_delivery" ? "Оплачивается отдельно" : actualDeliveryMethod === "free_delivery" ? "Бесплатно" : "0 ₽"}
        />
        <SummaryLine label="Итого" value={currency.format(props.total)} strong />
        <button className="primary-button" disabled={!canPay || props.isPaying} onClick={props.onPay}>
          <BadgeRussianRuble size={18} />
          {props.isPaying ? "Оформляем" : "Оформить заказ"}
        </button>
      </section>
    </div>
  );
}

function ProfileScreen({
  orders,
  checkout,
  telegramName,
  username
}: {
  orders: Order[];
  checkout: CheckoutForm;
  telegramName: string;
  username: string | null;
}) {
  const lastAddress = checkout.address || orders.find((order) => order.address)?.address || "";
  const profileName = username ? `@${username}` : telegramName || "Гость";

  return (
    <div className="screen stack">
      <Header title="Мои заказы" subtitle="Контакты сохраняем только для связи по заказу." />
      <section className="profile-band">
        <UserRound size={22} />
        <div className="profile-details">
          <div className="profile-line">
            <span>Telegram</span>
            <strong>{profileName}</strong>
          </div>
          <div className="profile-line">
            <span>Телефон</span>
            <strong>{checkout.phone || "после оформления заказа"}</strong>
          </div>
          <div className="profile-line">
            <span>Адрес</span>
            <strong>{lastAddress || "сохраним после заказа"}</strong>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="section-head">
          <h2>История</h2>
        </div>
        {orders.length === 0 ? (
          <EmptyState title="Заказов пока нет" text="Когда оформите первый заказ, он появится здесь." />
        ) : (
          <div className="orders-list">
            {orders.map((order) => (
              <article className="order-row" key={order.id}>
                <div>
                  <strong>Заказ {order.orderNumber}</strong>
                  <span>{order.items.map((item) => item.title).join(", ")}</span>
                </div>
                <div className="order-meta">
                  <span className={`order-status ${profileOrderStatus(order.status).tone}`}>{profileOrderStatus(order.status).label}</span>
                  <b>{currency.format(order.total)}</b>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function profileOrderStatus(status: Order["status"]) {
  if (status === "completed" || status === "delivered" || status === "picked_up") {
    return { label: "ЗАВЕРШЕН", tone: "is-done" };
  }

  if (status === "confirmed" || status === "cooking" || status === "ready" || status === "delivering" || status === "in_progress") {
    return { label: "ГОТОВИТСЯ", tone: "is-progress" };
  }

  if (status === "cancelled") {
    return { label: "ОТМЕНЕН", tone: "is-cancelled" };
  }

  return { label: "СОЗДАН", tone: "is-new" };
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="screen-header">
      <p className="eyebrow">Родная кухня</p>
      <h1>{title}</h1>
      <span>{subtitle}</span>
    </header>
  );
}

function InfoSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="menu-info-section">
      <div className="menu-info-heading">
        {icon}
        <h2>{title}</h2>
      </div>
      <div className="menu-info-copy">{children}</div>
    </section>
  );
}

function ProductList({
  products,
  cartQuantities,
  compact,
  onSelect,
  onAddToCart,
  onQuantity
}: {
  products: Product[];
  cartQuantities: Map<string, number>;
  compact?: boolean;
  onSelect: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onQuantity: (productId: string, delta: number) => void;
}) {
  if (!products.length) {
    return <EmptyState title="Ничего не нашли" text="Попробуйте другую категорию или более короткий запрос." />;
  }

  return (
    <div className={compact ? "product-strip" : "product-grid"}>
      {products.map((product) => {
        const selectedQuantity = cartQuantities.get(product.id) ?? 0;

        return (
          <article className={`product-card ${selectedQuantity > 0 ? "is-selected" : ""}`} key={product.id} onClick={() => onSelect(product)}>
            <div className="product-image-wrap">
              <img src={product.imageUrl} alt="" />
            </div>
            <div className="product-card-body">
              <StatusBadge stock={product.stock} />
              <h3>{product.title}</h3>
              <span>{product.unitLabel}</span>
              <div className="product-card-footer">
                <b>{currency.format(product.price)}</b>
                {selectedQuantity > 0 ? (
                  <MiniStepper
                    quantity={selectedQuantity}
                    onMinus={(event) => {
                      event.stopPropagation();
                      onQuantity(product.id, -1);
                    }}
                    onPlus={(event) => {
                      event.stopPropagation();
                      onQuantity(product.id, 1);
                    }}
                  />
                ) : (
                  <button
                    disabled={product.stock < quantityStep(product)}
                    onClick={(event) => {
                      event.stopPropagation();
                      onAddToCart(product);
                    }}
                    aria-label="Добавить в корзину"
                  >
                    <Plus size={18} />
                  </button>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function StatusBadge({ stock }: { stock: number }) {
  return (
    <span className={`status-badge ${stock > 0 ? "is-ok" : "is-empty"}`}>
      {stock > 0 ? `В наличии: ${formatQuantityNumber(stock)}` : "Нет в наличии"}
    </span>
  );
}

function MiniStepper({
  quantity,
  onMinus,
  onPlus
}: {
  quantity: number;
  onMinus: React.MouseEventHandler<HTMLButtonElement>;
  onPlus: React.MouseEventHandler<HTMLButtonElement>;
}) {
  return (
    <div className="mini-stepper" aria-label="Количество товара">
      <button onClick={onMinus} aria-label="Уменьшить">
        <Minus size={14} />
      </button>
      <span>{formatQuantityNumber(quantity)}</span>
      <button onClick={onPlus} aria-label="Увеличить">
        <Plus size={14} />
      </button>
    </div>
  );
}

function ProductStepper({ quantity, onMinus, onPlus }: { quantity: number; onMinus: () => void; onPlus: () => void }) {
  return (
    <div className="product-stepper" aria-label="Количество товара">
      <button onClick={onMinus} aria-label="Уменьшить">
        <Minus size={18} />
      </button>
      <span>{formatQuantityNumber(quantity)}</span>
      <button onClick={onPlus} aria-label="Увеличить">
        <Plus size={18} />
      </button>
    </div>
  );
}

function DeliveryButton({ active, title, text, onClick }: { active: boolean; title: string; text: string; onClick: () => void }) {
  return (
    <button className={`delivery-button ${active ? "is-active" : ""}`} onClick={onClick}>
      <span>{title}</span>
      <b>{text}</b>
    </button>
  );
}

function SummaryLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`summary-line ${strong ? "is-strong" : ""}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <Clock3 size={22} />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function NavButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button className={`nav-button ${active ? "is-active" : ""}`} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function quantityStep(product: Product) {
  return product.unit === "kg" ? 0.5 : 1;
}

function normalizeQuantity(quantity: number) {
  return Math.round(quantity * 10) / 10;
}

function formatQuantityNumber(quantity: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(quantity);
}

function formatCartQuantity(product: Product, quantity: number) {
  if (product.unit === "kg") {
    return quantity < 1 ? `${quantity * 1000} г` : `${formatQuantityNumber(quantity)} кг`;
  }

  if (product.unit === "100g") {
    return `${quantity * 100} г`;
  }

  return `${formatQuantityNumber(quantity)} × ${product.unitLabel}`;
}

function readMoneyEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function createApiHeaders(telegramInitData: string) {
  return {
    "Content-Type": "application/json",
    ...(telegramInitData ? { "X-Telegram-Init-Data": telegramInitData } : {})
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: {
          user?: {
            id?: number;
            first_name?: string;
            last_name?: string;
            username?: string;
          };
        };
        ready: () => void;
        expand: () => void;
      };
    };
  }
}
