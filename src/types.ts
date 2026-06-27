export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  image: string; // Predefined SVG type or relative illustration category
  stock: number;
  createdAt: string;
  updatedAt?: string; // Last edit ISO Timestamp
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface SaleItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  total: number;
  amountReceived: number;
  changeGiven: number;
  sellerId: string;
  sellerName: string;
  createdAt: string; // ISO String
  updatedAt?: string; // Last updated timestamp (e.g. for partial payments)
  isDebt: boolean;
  debtorName?: string;
  debtorPhone?: string;
  debtStatus?: 'unpaid' | 'paid' | 'partial';
  debtPaidAmount?: number;
  synced: boolean; // Sync status flag
}

export interface User {
  id: string;
  name: string;
  role: 'boss' | 'seller';
  pin?: string;
  updatedAt?: string;
}

export interface DebtPayment {
  id: string;
  saleId: string;
  debtorName: string;
  amountPaid: number;
  paymentDate: string;
}
