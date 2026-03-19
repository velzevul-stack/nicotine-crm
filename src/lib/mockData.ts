// Mock data for the seller app

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  emoji: string;
}

export interface Brand {
  id: string;
  categoryId: string;
  name: string;
  emojiPrefix: string;
}

export interface ProductFormat {
  id: string;
  brandId: string;
  name: string;
  strengthLabel: string;
  unitPrice: number;
  isLiquid: boolean;
}

export interface Flavor {
  id: string;
  productFormatId: string;
  name: string;
  quantity: number;
}

export interface Sale {
  id: string;
  datetime: string;
  sellerName: string;
  paymentType: 'cash' | 'card' | 'debt';
  totalAmount: number;
  discountValue: number;
  finalAmount: number;
  customerName?: string;
  comment?: string;
  status: 'active' | 'edited' | 'deleted';
  items: SaleItem[];
}

export interface SaleItem {
  id: string;
  flavorName: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface Debt {
  id: string;
  customerName: string;
  totalDebt: number;
  lastUpdated: string;
  operations: DebtOperation[];
}

export interface DebtOperation {
  id: string;
  amount: number;
  datetime: string;
  comment: string;
  type: 'charge' | 'payment';
}

export interface DayReport {
  date: string;
  salesCount: number;
  revenue: number;
  cashAmount: number;
  cardAmount: number;
  debtAmount: number;
  discountTotal: number;
  lastSaleTime: string;
  lastSaleDescription: string;
}

export const categories: Category[] = [
  { id: 'cat-1', name: 'Жидкости', sortOrder: 1, emoji: '💨' },
  { id: 'cat-2', name: 'Устройства', sortOrder: 2, emoji: '🔋' },
  { id: 'cat-3', name: 'Расходники', sortOrder: 3, emoji: '🔧' },
];

export const brands: Brand[] = [
  { id: 'br-1', categoryId: 'cat-1', name: 'PODONKI', emojiPrefix: '🤪' },
  { id: 'br-2', categoryId: 'cat-1', name: 'CATSWILL', emojiPrefix: '🐱' },
  { id: 'br-3', categoryId: 'cat-1', name: 'MALAYSIAN', emojiPrefix: '😱' },
  { id: 'br-4', categoryId: 'cat-2', name: 'XROS', emojiPrefix: '⚡' },
  { id: 'br-5', categoryId: 'cat-3', name: 'VAPORESSO', emojiPrefix: '🔥' },
];

export const productFormats: ProductFormat[] = [
  { id: 'pf-1', brandId: 'br-1', name: 'PODONKI SOUR', strengthLabel: '50 mg', unitPrice: 15, isLiquid: true },
  { id: 'pf-2', brandId: 'br-1', name: 'PODONKI SWEET', strengthLabel: '30 mg', unitPrice: 15, isLiquid: true },
  { id: 'pf-3', brandId: 'br-2', name: 'CATSWILL EXTRA', strengthLabel: '50 mg', unitPrice: 18, isLiquid: true },
  { id: 'pf-4', brandId: 'br-3', name: 'MALAYSIAN ICE', strengthLabel: '20 mg', unitPrice: 12, isLiquid: true },
  { id: 'pf-5', brandId: 'br-4', name: 'XROS 5 MINI', strengthLabel: '', unitPrice: 45, isLiquid: false },
  { id: 'pf-6', brandId: 'br-5', name: 'GTX COIL 0.4', strengthLabel: '', unitPrice: 8, isLiquid: false },
];

export const flavors: Flavor[] = [
  { id: 'fl-1', productFormatId: 'pf-1', name: 'ЛИМОНАД КИВИ КАКТУС', quantity: 5 },
  { id: 'fl-2', productFormatId: 'pf-1', name: 'МАНДАРИН СЛАДКОЕ ЯБЛОКО', quantity: 3 },
  { id: 'fl-3', productFormatId: 'pf-1', name: 'КЛУБНИКА БАНАН', quantity: 0 },
  { id: 'fl-4', productFormatId: 'pf-1', name: 'АНАНАС МАНГО', quantity: 7 },
  { id: 'fl-5', productFormatId: 'pf-2', name: 'ВИНОГРАД МЯТА', quantity: 2 },
  { id: 'fl-6', productFormatId: 'pf-2', name: 'ПЕРСИК ЛАЙМ', quantity: 4 },
  { id: 'fl-7', productFormatId: 'pf-3', name: 'ДЫНЯ АРБУЗ', quantity: 6 },
  { id: 'fl-8', productFormatId: 'pf-3', name: 'КОКОС ВАНИЛЬ', quantity: 1 },
  { id: 'fl-9', productFormatId: 'pf-3', name: 'МАЛИНА МОХИТО', quantity: 0 },
  { id: 'fl-10', productFormatId: 'pf-4', name: 'ХОЛОДНЫЙ МАНГО', quantity: 8 },
  { id: 'fl-11', productFormatId: 'pf-4', name: 'ЛЕДЯНОЙ АРБУЗ', quantity: 3 },
  { id: 'fl-12', productFormatId: 'pf-5', name: 'Чёрный', quantity: 2 },
  { id: 'fl-13', productFormatId: 'pf-5', name: 'Серебро', quantity: 1 },
  { id: 'fl-14', productFormatId: 'pf-6', name: 'Стандарт', quantity: 12 },
];

export const sales: Sale[] = [
  {
    id: 's-1', datetime: '2026-03-03T14:30:00', sellerName: 'Алексей',
    paymentType: 'cash', totalAmount: 33, discountValue: 3, finalAmount: 30,
    status: 'active', comment: 'Постоянный клиент',
    items: [
      { id: 'si-1', flavorName: 'ЛИМОНАД КИВИ КАКТУС', productName: 'PODONKI SOUR 50mg', unitPrice: 15, quantity: 1, lineTotal: 15 },
      { id: 'si-2', flavorName: 'ДЫНЯ АРБУЗ', productName: 'CATSWILL EXTRA 50mg', unitPrice: 18, quantity: 1, lineTotal: 18 },
    ]
  },
  {
    id: 's-2', datetime: '2026-03-03T12:15:00', sellerName: 'Алексей',
    paymentType: 'card', totalAmount: 45, discountValue: 0, finalAmount: 45,
    status: 'active',
    items: [
      { id: 'si-3', flavorName: 'Чёрный', productName: 'XROS 5 MINI', unitPrice: 45, quantity: 1, lineTotal: 45 },
    ]
  },
  {
    id: 's-3', datetime: '2026-03-03T10:45:00', sellerName: 'Алексей',
    paymentType: 'debt', totalAmount: 30, discountValue: 0, finalAmount: 30,
    customerName: 'Дмитрий К.', status: 'active',
    items: [
      { id: 'si-4', flavorName: 'МАНДАРИН СЛАДКОЕ ЯБЛОКО', productName: 'PODONKI SOUR 50mg', unitPrice: 15, quantity: 2, lineTotal: 30 },
    ]
  },
  {
    id: 's-4', datetime: '2026-03-02T16:20:00', sellerName: 'Алексей',
    paymentType: 'cash', totalAmount: 54, discountValue: 0, finalAmount: 54,
    status: 'active',
    items: [
      { id: 'si-5', flavorName: 'КОКОС ВАНИЛЬ', productName: 'CATSWILL EXTRA 50mg', unitPrice: 18, quantity: 3, lineTotal: 54 },
    ]
  },
  {
    id: 's-5', datetime: '2026-03-02T11:00:00', sellerName: 'Алексей',
    paymentType: 'cash', totalAmount: 15, discountValue: 0, finalAmount: 15,
    status: 'active',
    items: [
      { id: 'si-6', flavorName: 'ХОЛОДНЫЙ МАНГО', productName: 'MALAYSIAN ICE 20mg', unitPrice: 12, quantity: 1, lineTotal: 12 },
      { id: 'si-7', flavorName: 'Стандарт', productName: 'GTX COIL 0.4', unitPrice: 8, quantity: 1, lineTotal: 8 },
    ]
  },
  {
    id: 's-6', datetime: '2026-03-01T15:30:00', sellerName: 'Алексей',
    paymentType: 'card', totalAmount: 36, discountValue: 6, finalAmount: 30,
    status: 'active',
    items: [
      { id: 'si-8', flavorName: 'ЛЕДЯНОЙ АРБУЗ', productName: 'MALAYSIAN ICE 20mg', unitPrice: 12, quantity: 3, lineTotal: 36 },
    ]
  },
];

export const debts: Debt[] = [
  {
    id: 'd-1', customerName: 'Дмитрий К.', totalDebt: 60, lastUpdated: '2026-03-03',
    operations: [
      { id: 'do-1', amount: 30, datetime: '2026-03-03T10:45:00', comment: 'Продажа 2×PODONKI SOUR', type: 'charge' },
      { id: 'do-2', amount: 30, datetime: '2026-03-01T09:00:00', comment: 'Продажа 2×CATSWILL', type: 'charge' },
    ]
  },
  {
    id: 'd-2', customerName: 'Марина С.', totalDebt: 18, lastUpdated: '2026-03-02',
    operations: [
      { id: 'do-3', amount: 36, datetime: '2026-02-28T14:00:00', comment: 'Продажа 2×CATSWILL EXTRA', type: 'charge' },
      { id: 'do-4', amount: -18, datetime: '2026-03-02T10:00:00', comment: 'Частичное погашение', type: 'payment' },
    ]
  },
  {
    id: 'd-3', customerName: 'Павел В.', totalDebt: 45, lastUpdated: '2026-02-28',
    operations: [
      { id: 'do-5', amount: 45, datetime: '2026-02-28T16:30:00', comment: 'Продажа XROS 5 MINI', type: 'charge' },
    ]
  },
];

export const dayReports: DayReport[] = [
  { date: '2026-03-03', salesCount: 3, revenue: 105, cashAmount: 30, cardAmount: 45, debtAmount: 30, discountTotal: 3, lastSaleTime: '14:30', lastSaleDescription: '2×жидкости' },
  { date: '2026-03-02', salesCount: 2, revenue: 69, cashAmount: 69, cardAmount: 0, debtAmount: 0, discountTotal: 0, lastSaleTime: '16:20', lastSaleDescription: '3×CATSWILL EXTRA' },
  { date: '2026-03-01', salesCount: 1, revenue: 30, cashAmount: 0, cardAmount: 30, debtAmount: 0, discountTotal: 6, lastSaleTime: '15:30', lastSaleDescription: '3×MALAYSIAN ICE' },
  { date: '2026-02-28', salesCount: 4, revenue: 156, cashAmount: 78, cardAmount: 33, debtAmount: 45, discountTotal: 0, lastSaleTime: '18:45', lastSaleDescription: '1×XROS 5 MINI' },
  { date: '2026-02-27', salesCount: 6, revenue: 198, cashAmount: 108, cardAmount: 90, debtAmount: 0, discountTotal: 12, lastSaleTime: '19:10', lastSaleDescription: '2×жидкости' },
];
