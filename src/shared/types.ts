export type Category = {
  id: string;
  title: string;
  sortOrder: number;
  isVisible: boolean;
};

export type ProductUnit = "kg" | "100g" | "g" | "l" | "ml" | "piece" | "box";

export type Product = {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  price: number;
  unit: ProductUnit;
  unitLabel: string;
  imageUrl: string;
  stock: number;
  isVisible: boolean;
  sortOrder: number;
};

export type CartItem = {
  productId: string;
  quantity: number;
};

export type DeliveryMethod = "free_delivery" | "paid_delivery" | "pickup";

export type OrderStatus =
  | "pending_payment"
  | "paid_new"
  | "in_progress"
  | "delivered"
  | "picked_up"
  | "completed"
  | "cancelled";

export type PaymentStatus = "pending" | "paid" | "cancelled" | "failed";

export type OrderItem = {
  productId: string;
  title: string;
  price: number;
  quantity: number;
  lineTotal: number;
};

export type Order = {
  id: string;
  orderNumber: string;
  telegramUserId: string;
  customerName: string;
  phone: string;
  address: string | null;
  deliveryMethod: DeliveryMethod;
  deliveryPrice: number;
  itemsTotal: number;
  total: number;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
};

export type CustomerProfile = {
  telegramUserId: string;
  name: string;
  phone: string | null;
  lastAddress: string | null;
};

export const FREE_DELIVERY_THRESHOLD = 3000;
export const PAID_DELIVERY_PRICE = 300;
export const PICKUP_ADDRESS = "Спиридона Михайлова, 1";
