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
  | "new"
  | "confirmed"
  | "cooking"
  | "ready"
  | "delivering"
  | "completed"
  | "cancelled"
  | "pending_payment"
  | "paid_new"
  | "in_progress"
  | "delivered"
  | "picked_up";

export type PaymentStatus = "pending" | "paid" | "cancelled" | "failed" | "refunded" | "manual_check";

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
  telegramUsername?: string | null;
  telegramDisplayName?: string | null;
  customerName: string;
  phone: string;
  address: string | null;
  deliveryMethod: DeliveryMethod;
  deliveryPrice: number;
  itemsTotal: number;
  total: number;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  comment: string | null;
  idempotencyKey: string | null;
  items: OrderItem[];
  statusHistory: OrderStatusHistoryItem[];
  createdAt: string;
  updatedAt: string;
};

export type OrderStatusHistoryItem = {
  status: OrderStatus;
  changedBy: string;
  changedAt: string;
  comment: string | null;
};

export type CustomerProfile = {
  telegramUserId: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  phone: string | null;
  lastAddress: string | null;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
};

export type StockMovementReason = "order_created" | "order_cancelled" | "admin_adjustment";

export type StockMovement = {
  id: string;
  productId: string;
  delta: number;
  previousStock: number;
  nextStock: number;
  reason: StockMovementReason;
  orderId: string | null;
  changedBy: string;
  createdAt: string;
};

export type AdminAuditEvent = {
  id: string;
  actor: string;
  action: string;
  entityType: "order" | "product" | "category" | "user";
  entityId: string;
  details: Record<string, unknown>;
  createdAt: string;
};

export const FREE_DELIVERY_THRESHOLD = 3000;
export const PICKUP_ADDRESS = "Спиридона Михайлова, 1";
