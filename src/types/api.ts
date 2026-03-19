/**
 * Типы для API ответов
 */

// Shop
export interface ShopResponse {
  id: string;
  name: string;
  address: string | null;
  currency: string;
  timezone: string;
  country: string | null;
  city: string | null;
  region: string | null;
}

// Inventory
export interface Flavor {
  id: string;
  name: string;
  productFormatId: string;
  strength: string | null;
  color: string | null;
  barcode: string | null;
  quantity?: number;
}

export interface ProductFormat {
  id: string;
  name: string;
  brandId: string;
  size: string | null;
  type: string | null;
  unitPrice?: number;
}

export interface Brand {
  id: string;
  name: string;
  categoryId: string;
  sortOrder: number;
  emojiPrefix?: string;
}

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  emoji?: string;
}

export interface InventoryItem {
  category: Category;
  brand: Brand;
  format: ProductFormat;
  flavor: Flavor;
  quantity: number;
  reservedQuantity: number;
  costPrice: number;
  barcode: string | null;
}

export interface InventoryResponse {
  items: InventoryItem[];
  flavors: Flavor[];
  productFormats: ProductFormat[];
  brands: Brand[];
  categories: Category[];
}

// Sales
export interface SaleItem {
  id: string;
  flavorId: string;
  flavorNameSnapshot: string;
  productNameSnapshot: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface Sale {
  id: string;
  shopId: string;
  sellerId: string;
  datetime: string;
  saleDate: string;
  paymentType: string;
  totalAmount: number;
  totalCost: number | null;
  discountValue: number;
  discountType: string;
  finalAmount: number;
  comment: string | null;
  customerName: string | null;
  isReservation: boolean;
  reservationExpiry: string | null;
  reservationCustomerName: string | null;
  status: string;
  items: SaleItem[];
}

export interface SalesResponse extends Array<Sale> {}

// Reserves
export interface ReservationItem {
  id: string;
  flavorId: string;
  productNameSnapshot: string;
  flavorNameSnapshot: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface Reservation {
  id: string;
  reservationCustomerName: string | null;
  reservationExpiry: string | null;
  datetime: string;
  totalAmount: number;
  finalAmount: number;
  items: ReservationItem[];
}

export interface ReservesResponse extends Array<Reservation> {}

// Debts
export interface DebtOperation {
  id: string;
  amount: number;
  datetime: string;
  comment: string;
}

export interface Debt {
  id: string;
  customerName: string;
  totalDebt: number;
  operations: DebtOperation[];
}

export interface DebtsResponse extends Array<Debt> {}

// Reports
export interface DayReport {
  date: string;
  salesCount: number;
  revenue: number;
  cost: number;
  profit: number;
  cashAmount: number;
  cardAmount: number;
  debtAmount: number;
  discountTotal: number;
  lastSaleTime: string;
  lastSaleDescription: string;
  reservationsCount: number;
  reservationsAmount: number;
  sales: Sale[];
}

export interface ReportsResponse {
  dayReports: DayReport[];
}

// User
export interface UserResponse {
  id: string;
  telegramId: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  role: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  isActive: boolean;
}

// Sale creation payload
export interface CreateSaleItem {
  flavorId: string;
  productNameSnapshot: string;
  flavorNameSnapshot: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface CreateSalePayload {
  paymentType: 'cash' | 'card' | 'split' | 'debt';
  cashAmount?: number;
  cardAmount?: number;
  cardId?: string | null;
  discountValue: number;
  discountType: 'absolute' | 'percent';
  comment: string | null;
  customerName: string | null;
  isReservation: boolean;
  reservationExpiry?: string | null;
  reservationCustomerName?: string | null;
  saleDate?: string;
  items: CreateSaleItem[];
}
