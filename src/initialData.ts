import { Product, Sale } from './types';

export const DEFAULT_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    name: 'Unga wa Sembe (2kg)',
    price: 3500,
    category: 'Chakula (Food)',
    image: 'maize',
    stock: 45,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'prod-2',
    name: 'Azam Cola (500ml)',
    price: 1000,
    category: 'Vinywaji (Beverages)',
    image: 'cola',
    stock: 120,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'prod-3',
    name: 'Safari Tea (250g)',
    price: 2200,
    category: 'Chakula (Food)',
    image: 'tea',
    stock: 35,
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'prod-4',
    name: 'Blue Band (250g)',
    price: 2800,
    category: 'Groceries',
    image: 'margarine',
    stock: 28,
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'prod-5',
    name: 'Sabuni ya Jamaa (Bati)',
    price: 1500,
    category: 'Vifaa (Household)',
    image: 'soap',
    stock: 50,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'prod-6',
    name: 'Mchele wa Pendo (1kg)',
    price: 3200,
    category: 'Chakula (Food)',
    image: 'rice',
    stock: 80,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'prod-7',
    name: 'Maji ya Kilimanjaro (1.5L)',
    price: 1200,
    category: 'Vinywaji (Beverages)',
    image: 'water',
    stock: 90,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'prod-8',
    name: 'Sukari ya Kakira (1kg)',
    price: 3800,
    category: 'Groceries',
    image: 'sugar',
    stock: 15,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  }
];

export const DEFAULT_SALES: Sale[] = [
  {
    id: 'sale-1001',
    items: [
      { productId: 'prod-1', name: 'Unga wa Sembe (2kg)', price: 3500, quantity: 2 },
      { productId: 'prod-2', name: 'Azam Cola (500ml)', price: 1000, quantity: 3 }
    ],
    total: 10000,
    amountReceived: 10000,
    changeGiven: 0,
    sellerId: 'user-seller-1',
    sellerName: 'Amisi Mapesa',
    createdAt: new Date(Date.now() - 3 * 12 * 60 * 60 * 1000).toISOString(),
    isDebt: false,
    synced: true
  },
  {
    id: 'sale-1002',
    items: [
      { productId: 'prod-6', name: 'Mchele wa Pendo (1kg)', price: 3200, quantity: 5 },
      { productId: 'prod-8', name: 'Sukari ya Kakira (1kg)', price: 3800, quantity: 1 }
    ],
    total: 19800,
    amountReceived: 20000,
    changeGiven: 200,
    sellerId: 'user-seller-1',
    sellerName: 'Amisi Mapesa',
    createdAt: new Date(Date.now() - 2 * 10 * 60 * 60 * 1000).toISOString(),
    isDebt: false,
    synced: true
  },
  {
    id: 'sale-1003',
    items: [
      { productId: 'prod-3', name: 'Safari Tea (250g)', price: 2200, quantity: 2 },
      { productId: 'prod-4', name: 'Blue Band (250g)', price: 2800, quantity: 1 }
    ],
    total: 7200,
    amountReceived: 5000,
    changeGiven: 0,
    sellerId: 'user-seller-1',
    sellerName: 'Amisi Mapesa',
    createdAt: new Date(Date.now() - 1 * 18 * 60 * 60 * 1000).toISOString(),
    isDebt: true,
    debtorName: 'Mwamba Juma',
    debtorPhone: '255 712 345 678',
    debtStatus: 'partial',
    debtPaidAmount: 5000,
    synced: true
  },
  {
    id: 'sale-1004',
    items: [
      { productId: 'prod-5', name: 'Sabuni ya Jamaa (Bati)', price: 1500, quantity: 4 }
    ],
    total: 6000,
    amountReceived: 0,
    changeGiven: 0,
    sellerId: 'user-seller-2',
    sellerName: 'Farida Omari',
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    isDebt: true,
    debtorName: 'Mama Neema',
    debtorPhone: '255 655 987 654',
    debtStatus: 'unpaid',
    debtPaidAmount: 0,
    synced: false
  },
  {
    id: 'sale-1005',
    items: [
      { productId: 'prod-7', name: 'Maji ya Kilimanjaro (1.5L)', price: 1200, quantity: 12 },
      { productId: 'prod-2', name: 'Azam Cola (500ml)', price: 1000, quantity: 6 }
    ],
    total: 20400,
    amountReceived: 21000,
    changeGiven: 600,
    sellerId: 'user-seller-1',
    sellerName: 'Amisi Mapesa',
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    isDebt: false,
    synced: false
  }
];
