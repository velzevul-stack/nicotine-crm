/**
 * API types for Premium Dark compatibility
 */

export interface PremiumDebt {
  id: string;
  client: string;
  amount: number;
  updatedAt: string;
}

export interface PremiumReservation {
  id: string;
  client: string;
  amount: number;
  expiresAt: string | null;
}

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
  reservationsCount: number;
  reservationsAmount: number;
  lastSaleTime: string;
  lastSaleDescription: string;
  sales: Sale[];
}

export interface Sale {
  id: string;
  datetime: string;
  finalAmount: number;
  paymentType: 'cash' | 'card' | 'debt';
  discountValue?: number;
  customerName?: string;
  items?: SaleItem[];
}

export interface SaleItem {
  flavorNameSnapshot: string;
  quantity: number;
  unitPrice: number;
  productNameSnapshot?: string;
}

export interface NestedCategory {
  id: string;
  name: string;
  emoji: string;
  formats: NestedFormat[];
}

export interface NestedFormat {
  id: string;
  brandEmoji: string;
  name: string;
  strengthLabel?: string;
  unitPrice: number;
  totalQty: number;
  totalReserved: number;
  flavors: NestedFlavor[];
}

export interface NestedFlavor {
  id: string;
  name: string;
  stock: number;
  reserved: number;
  cost: number;
  price: number;
  barcode?: string;
}

export interface Shop {
  id: string;
  name: string;
  address: string | null;
  currency: string;
}
