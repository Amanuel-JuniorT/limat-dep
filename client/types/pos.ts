export type Role = 'ADMIN' | 'STOCK' | 'SELLER';
export type PriceType = 'SELLING' | 'COST';
export type DestinationType = 'SHOP' | 'EVENT_WINDOW';

export interface User {
  id: number;
  name: string;
  phone: string;
  email?: string;
  role: Role;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface ItemPrice {
  id: number;
  itemId: number;
  price: string | number;
  priceType: PriceType;
  effectiveFrom: string;
}

export interface Item {
  id: number;
  name: string;
  sku: string | null;
  description: string | null;
  isActive: boolean;
  sellingPrice: number;
  costPrice: number;
  warehouseStock: number;
  destinationStock?: number;
}

export interface StockDestination {
  id: number;
  name: string;
  type: DestinationType;
  isActive: boolean;
  notes?: string;
  spinPrice?: number;
}

export interface AllocationItem {
  id: number;
  itemId: number;
  quantity: number;
  item?: Item;
}

export interface Allocation {
  id: number;
  destinationId: number;
  destination?: StockDestination;
  isReturn: boolean;
  date: string;
  notes?: string;
  user?: User;
  items: AllocationItem[];
}

export interface SalesReportItem {
  id: number;
  itemId: number;
  quantity: number;
  unitPrice: number | string;
  subtotal: number | string;
  paymentMethod?: 'CASH' | 'TELEBIRR' | 'CBE';
  tipAmount?: number | string;
  notes?: string;
  item?: Item;
}

export interface SalesReport {
  id: number;
  destinationId: number;
  destination?: StockDestination;
  saleDate: string;
  subtotal: string | number;
  tipAmount?: string | number;
  totalAmount: string | number;
  paymentMethod: 'CASH' | 'TELEBIRR' | 'CBE' | 'CUSTOM';
  paymentDetails?: any;
  notes?: string;
  user?: User;
  items: SalesReportItem[];
}

export interface SpinReportItem {
  id: number;
  type: 'SPIN' | 'SALE';
  itemId?: number | null;
  spinCount?: number;
  quantity: number;
  unitPrice?: number | string;
  subtotal?: number | string;
  paymentMethod?: 'CASH' | 'TELEBIRR' | 'CBE';
  tipAmount?: number | string;
  notes?: string;
  item?: Item;
}

export interface SpinReport {
  id: number;
  destinationId: number;
  destination?: StockDestination;
  reportDate: string;
  spinCount: number;
  revenuePerSpin: number | string;
  subtotal: number | string;
  tipAmount?: number | string;
  totalAmount: number | string;
  paymentMethod: 'CASH' | 'TELEBIRR' | 'CBE' | 'CUSTOM';
  paymentDetails?: any;
  notes?: string;
  user?: User;
  items: SpinReportItem[];
}

export interface Wastage {
  id: number;
  itemId: number;
  item?: Item;
  quantity: number;
  date: string;
  destinationId?: number | null;
  destination?: StockDestination;
  reason?: string;
  user?: User;
}

export interface ClosedDate {
  id: number;
  date: string;
  destinationId: number;
  destination?: StockDestination;
  reason?: string;
  user?: User;
}
