import {
  FREE_DELIVERY_THRESHOLD as DEFAULT_FREE_DELIVERY_THRESHOLD,
  PAID_DELIVERY_PRICE as DEFAULT_PAID_DELIVERY_PRICE,
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
  BadgeRussianRuble,
  ChevronRight,
  Clock3,
  Home,
  Minus,
  Plus,
  Search,
  ShoppingBasket,
  Store,
  UserRound
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Screen = "home" | "catalog" | "cart" | "profile";

type CheckoutForm = {
  customerName: string;
  phone: string;
  address: string;
  deliveryMethod: DeliveryMethod;
};

const apiUrl = import.meta.env.VITE_API_URL ?? "";
const demoMode = import.meta.env.VITE_DEMO_MODE !== "false";
const fallbackTelegramUserId = import.meta.env.VITE_FALLBACK_TELEGRAM_USER_ID ?? "demo-telegram-user";
const freeDeliveryThreshold = readMoneyEnv(import.meta.env.VITE_FREE_DELIVERY_THRESHOLD, DEFAULT_FREE_DELIVERY_THRESHOLD);
const paidDeliveryPrice = readMoneyEnv(import.meta.env.VITE_PAID_DELIVERY_PRICE, DEFAULT_PAID_DELIVERY_PRICE);
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
  const [categories, setCategories] = useState<Category[]>(categoriesSeed);
  const [products, setProducts] = useState<Product[]>(productsSeed);
  const [selectedCategory, setSelectedCategory] = useState("breakfast");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [checkout, setCheckout] = useState<CheckoutForm>({
    customerName: "Гость",
    phone: "",
    address: "",
    deliveryMethod: "paid_delivery"
  });
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    const user = tg?.initDataUnsafe?.user;
    const userId = user?.id;

    if (userId) {
      setTelegramUserId(String(userId));
    }

    const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() || user?.username || "Гость";
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telegramUserId,
        name: telegramName
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
  }, [telegramUserId, telegramName]);

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
  const deliveryPrice = checkout.deliveryMethod === "pickup" || itemsTotal >= freeDeliveryThreshold ? 0 : paidDeliveryPrice;
  const total = itemsTotal + deliveryPrice;
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const filteredProducts = products.filter((product) => {
    const matchesCategory = product.categoryId === selectedCategory;
    const matchesQuery = product.title.toLowerCase().includes(query.toLowerCase().trim());
    return matchesCategory && matchesQuery;
  });

  const addToCart = (product: Product) => {
    if (product.stock < 1) {
      return;
    }

    setCart((current) => {
      const existing = current.find((item) => item.productId === product.id);
      if (!existing) {
        return [...current, { productId: product.id, quantity: 1 }];
      }

      return current.map((item) =>
        item.productId === product.id ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) } : item
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
          const nextQuantity = Math.max(0, Math.min(item.quantity + delta, product?.stock ?? 0));
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
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              telegramUserId,
              customerName: checkout.customerName,
              phone: checkout.phone,
              address: checkout.deliveryMethod === "pickup" ? undefined : checkout.address,
              deliveryMethod: checkout.deliveryMethod,
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
        items: cartProducts,
        deliveryPrice,
        itemsTotal,
        total
      });

      if (!order.items || !Array.isArray(order.items)) {
        throw new Error("Некорректный ответ оплаты");
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
            query={query}
            selectedProduct={selectedProduct}
            cartQuantities={cartQuantities}
            onQuery={setQuery}
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

        {screen === "profile" && <ProfileScreen orders={orders} checkout={checkout} telegramUserId={telegramUserId} />}
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
  items,
  deliveryPrice,
  itemsTotal,
  total
}: {
  telegramUserId: string;
  checkout: CheckoutForm;
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
    address: checkout.deliveryMethod === "pickup" ? null : checkout.address,
    deliveryMethod: checkout.deliveryMethod,
    deliveryPrice,
    itemsTotal,
    total,
    paymentStatus: "paid",
    status: "paid_new",
    items: items.map(({ product, quantity }) => ({
      productId: product.id,
      title: product.title,
      price: product.price,
      quantity,
      lineTotal: product.price * quantity
    })),
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
  const popular = products.filter((product) => product.stock > 0).slice(0, 4);

  return (
    <div className="screen stack">
      <section className="hero">
        <div>
          <p className="eyebrow">Все свое, готовим как для дома</p>
          <h1>Родная кухня</h1>
          <p>
            Большой выбор домашней еды в запас: сырники, пельмени, котлеты, супы, готовые ужины, сладости и боксы на
            неделю. Соберите корзину, оплатите онлайн, а мы напишем и договоримся по доставке.
          </p>
        </div>
        <button className="primary-button" onClick={() => onOpenCatalog(categories[0]?.id ?? "breakfast")}>
          <ShoppingBasket size={18} />
          Выбрать еду
        </button>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Что положить в морозилку</h2>
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
    </div>
  );
}

function CatalogScreen(props: {
  categories: Category[];
  products: Product[];
  selectedCategory: string;
  query: string;
  selectedProduct: Product | null;
  cartQuantities: Map<string, number>;
  onQuery: (query: string) => void;
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
      <Header title="Каталог" subtitle="Домашние заготовки, готовые блюда и наборы для семьи, детей и офиса" />
      <label className="search-field">
        <Search size={18} />
        <input value={props.query} onChange={(event) => props.onQuery(event.target.value)} placeholder="Что ищем?" />
      </label>
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
  const isAvailable = product.stock > 0;

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

  return (
    <div className="screen stack">
      <Header title="Ваш заказ" subtitle="Проверьте выбранную еду, укажите контакты и оплатите онлайн" />

      {props.items.length === 0 ? (
        <EmptyState title="Пока ничего не выбрано" text="Добавьте сырники, пельмени, котлеты или готовые блюда из каталога." />
      ) : (
        <div className="cart-list">
          {props.items.map(({ product, quantity }) => (
            <div className="cart-item" key={product.id}>
              <img src={product.imageUrl} alt="" />
              <div>
                <strong>{product.title}</strong>
                <span>{product.unitLabel}</span>
                <b>{currency.format(product.price * quantity)}</b>
              </div>
              <div className="stepper">
                <button onClick={() => props.onQuantity(product.id, -1)} aria-label="Уменьшить">
                  <Minus size={16} />
                </button>
                <span>{quantity}</span>
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
            active={props.checkout.deliveryMethod === "paid_delivery"}
            title="Доставка"
            text={props.itemsTotal >= freeDeliveryThreshold ? "0 ₽" : `${paidDeliveryPrice} ₽`}
            onClick={() => setForm({ deliveryMethod: props.itemsTotal >= freeDeliveryThreshold ? "free_delivery" : "paid_delivery" })}
          />
          <DeliveryButton active={props.checkout.deliveryMethod === "pickup"} title="Самовывоз" text="0 ₽" onClick={() => setForm({ deliveryMethod: "pickup" })} />
        </div>

        {leftToFreeDelivery > 0 && props.checkout.deliveryMethod !== "pickup" ? (
          <p className="delivery-note">
            До бесплатной доставки осталось {currency.format(leftToFreeDelivery)}. Пока доставка считается как{" "}
            {currency.format(paidDeliveryPrice)}.
          </p>
        ) : (
          props.checkout.deliveryMethod !== "pickup" && (
            <p className="delivery-note">Доставка за наш счет. После оплаты администратор напишет и уточнит удобное время.</p>
          )
        )}

        {props.checkout.deliveryMethod === "pickup" ? (
          <p className="delivery-note">Самовывоз: {pickupAddress}. После оплаты напишем и согласуем, когда удобно подойти.</p>
        ) : (
          <input className="input" value={props.checkout.address} onChange={(event) => setForm({ address: event.target.value })} placeholder="Адрес доставки" />
        )}

        <input className="input" value={props.checkout.customerName} onChange={(event) => setForm({ customerName: event.target.value })} placeholder="Имя" />
        <input className="input" value={props.checkout.phone} onChange={(event) => setForm({ phone: event.target.value })} placeholder="Телефон для связи" />
      </section>

      <section className="summary">
        <SummaryLine label="Еда" value={currency.format(props.itemsTotal)} />
        <SummaryLine label={deliveryLabel[props.checkout.deliveryMethod]} value={currency.format(props.deliveryPrice)} />
        <SummaryLine label="К оплате" value={currency.format(props.total)} strong />
        <button className="primary-button" disabled={!canPay || props.isPaying} onClick={props.onPay}>
          <BadgeRussianRuble size={18} />
          {props.isPaying ? "Оплачиваем" : "Оплатить заказ"}
        </button>
      </section>
    </div>
  );
}

function ProfileScreen({
  orders,
  checkout,
  telegramUserId
}: {
  orders: Order[];
  checkout: CheckoutForm;
  telegramUserId: string;
}) {
  const lastAddress = checkout.address || orders.find((order) => order.address)?.address || "";

  return (
    <div className="screen stack">
      <Header title="Мои заказы" subtitle="Профиль привязан к Telegram ID. Телефон сохраняем только для связи по заказу." />
      <section className="profile-band">
        <UserRound size={22} />
        <div>
          <strong>ID: {telegramUserId}</strong>
          <span>{checkout.phone || "Телефон появится после оформления заказа"}</span>
        </div>
      </section>
      <section className="section">
        <div className="section-head">
          <h2>Последний адрес</h2>
        </div>
        <p className="muted">{lastAddress || "Адрес сохраним после первого заказа с доставкой."}</p>
      </section>
      <section className="section">
        <div className="section-head">
          <h2>История</h2>
        </div>
        {orders.length === 0 ? (
          <EmptyState title="Заказов пока нет" text="Когда оплатите первый заказ, он появится здесь." />
        ) : (
          <div className="orders-list">
            {orders.map((order) => (
              <article className="order-row" key={order.id}>
                <div>
                  <strong>Заказ {order.orderNumber}</strong>
                  <span>{order.items.map((item) => item.title).join(", ")}</span>
                </div>
                <b>{currency.format(order.total)}</b>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
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
                    disabled={product.stock < 1}
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
  return <span className={`status-badge ${stock > 0 ? "is-ok" : "is-empty"}`}>{stock > 0 ? `В наличии: ${stock}` : "Нет в наличии"}</span>;
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
      <span>{quantity}</span>
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
      <span>{quantity}</span>
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

function readMoneyEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
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
