import React, { useState, useMemo, useEffect } from 'react';
import { 
  TrendingUp, 
  Coins, 
  Users, 
  Plus, 
  Trash2, 
  Database, 
  FileSpreadsheet, 
  Tags,
  BadgeAlert,
  Sparkles,
  RefreshCw,
  Search,
  Settings,
  Filter,
  CheckCircle,
  Package,
  Clock,
  Briefcase,
  Menu
} from 'lucide-react';
import { Product, Sale, DebtPayment, User } from '../types';
import ProductIcon from './ProductIcon';

interface BossViewProps {
  products: Product[];
  sales: Sale[];
  sellers: User[];
  onUpdateSellers: (sellers: User[]) => void;
  onAddProduct: (product: Product) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onUpdateSaleDebt: (saleId: string, paidAmountToAdd: number) => void;
  onSyncSales: () => Promise<void>;
  isSyncing: boolean;
}

export default function BossView({
  products,
  sales,
  sellers,
  onUpdateSellers,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onUpdateSaleDebt,
  onSyncSales,
  isSyncing
}: BossViewProps) {
  // Tabs within Boss panel
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'debts' | 'users'>('dashboard');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Dynamic Product Categories list with persistence
  const [categories, setCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('mauzo_categories');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return ['Chakula (Food)', 'Vinywaji (Beverages)', 'Groceries', 'Vifaa (Household)'];
  });

  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');

  // Suggested icons by category keywords helper
  const getSuggestedIconsForCategory = (categoryName: string) => {
    const cat = categoryName.toLowerCase();
    if (cat.includes('vinywaji') || cat.includes('beverage') || cat.includes('soda') || cat.includes('juice') || cat.includes('drink') || cat.includes('cola') || cat.includes('maji')) {
      return ['cola', 'water', 'tea'];
    }
    if (cat.includes('chakula') || cat.includes('food') || cat.includes('cereal') || cat.includes('grain') || cat.includes('unga') || cat.includes('rice') || cat.includes('sugar') || cat.includes('mchele') || cat.includes('sukari')) {
      return ['maize', 'rice', 'sugar', 'margarine'];
    }
    if (cat.includes('groceries')) {
      return ['rice', 'sugar', 'margarine', 'water', 'soap'];
    }
    if (cat.includes('vifaa') || cat.includes('household') || cat.includes('soap') || cat.includes('sabuni') || cat.includes('usafi')) {
      return ['soap', 'water'];
    }
    return ['maize', 'cola', 'tea', 'margarine', 'soap', 'rice', 'water', 'sugar'];
  };

  // User Management states
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState<'boss' | 'seller'>('seller');
  const [userPin, setUserPin] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [showAddUserSection, setShowAddUserSection] = useState(false);
  const [userError, setUserError] = useState('');
  const [userSuccess, setUserSuccess] = useState('');

  // Product CRUD State
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProdId, setNewProdId] = useState('');
  const [newProdName, setNewProdName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('Chakula (Food)');
  const [newProdPrice, setNewProdPrice] = useState('');
  const [newProdStock, setNewProdStock] = useState('');
  const [newProdImage, setNewProdImage] = useState('maize');

  // Auto-align default product category on mount/update
  useEffect(() => {
    if (categories.length > 0 && !categories.includes(newProdCategory)) {
      setNewProdCategory(categories[0]);
    }
  }, [categories]);

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const cat = newCategoryInput.trim();
    if (!cat) return;
    if (categories.includes(cat)) {
      alert('Kundi hili tayari lipo!');
      return;
    }
    const updated = [...categories, cat];
    setCategories(updated);
    localStorage.setItem('mauzo_categories', JSON.stringify(updated));
    setNewCategoryInput('');
  };

  const handleRemoveCategory = (catToRemove: string) => {
    if (categories.length <= 1) {
      alert('Lazima kuwe na kundi angalau moja dukani!');
      return;
    }
    if (confirm(`Je, una uhakika unataka kufuta kundi "${catToRemove}"?`)) {
      const updated = categories.filter(c => c !== catToRemove);
      setCategories(updated);
      localStorage.setItem('mauzo_categories', JSON.stringify(updated));
    }
  };
  
  // Custom uploaded image states
  const [imageType, setImageType] = useState<'preset' | 'upload'>('preset');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Editing product inline
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState('');
  const [editingStock, setEditingStock] = useState('');

  // Debt Settlement State
  const [settlingSaleId, setSettlingSaleId] = useState<string | null>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [debtSearchQuery, setDebtSearchQuery] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');

  // Financial KPIs
  const kpis = useMemo(() => {
    let grossSales = 0;
    let actualCashReceived = 0;
    let totalDebtOutstanding = 0;

    sales.forEach(sale => {
      grossSales += sale.total;
      if (sale.isDebt) {
        const paid = sale.debtPaidAmount || 0;
        actualCashReceived += paid;
        totalDebtOutstanding += Math.max(0, sale.total - paid);
      } else {
        actualCashReceived += sale.total;
      }
    });

    const averageOrderValue = sales.length > 0 ? Math.round(grossSales / sales.length) : 0;

    return {
      grossSales,
      actualCashReceived,
      totalDebtOutstanding,
      averageOrderValue,
      salesCount: sales.length
    };
  }, [sales]);

  // Debtors data
  const outstandingDebts = useMemo(() => {
    return sales.filter(sale => sale.isDebt && (sale.debtStatus === 'unpaid' || sale.debtStatus === 'partial'))
      .filter(sale => {
        if (!debtSearchQuery) return true;
        const q = debtSearchQuery.toLowerCase();
        return (sale.debtorName || '').toLowerCase().includes(q) || 
               (sale.debtorPhone || '').includes(q);
      });
  }, [sales, debtSearchQuery]);

  // Filtered products list for product table
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const q = productSearchQuery.toLowerCase().trim();
      if (!q) return true;
      return (product.name || '').toLowerCase().includes(q) ||
             (product.id || '').toLowerCase().includes(q) ||
             (product.category || '').toLowerCase().includes(q);
    });
  }, [products, productSearchQuery]);

  // Chart computations: Sales by Product Category (SVG Based Claymorphic Chart)
  const categorySalesData = useMemo(() => {
    const dataMap: Record<string, number> = {};
    sales.forEach(sale => {
      sale.items.forEach(item => {
        // Find product's category
        const prod = products.find(p => p.id === item.productId);
        const cat = prod ? prod.category : 'Nyingine (Other)';
        dataMap[cat] = (dataMap[cat] || 0) + (item.price * item.quantity);
      });
    });

    const keys = Object.keys(dataMap);
    const result = keys.map(key => ({
      name: key,
      value: dataMap[key]
    }));

    // Pad with empty categories if empty to make UI look complete
    if (result.length === 0) {
      result.push({ name: 'Chakula (Food)', value: 0 });
      result.push({ name: 'Vinywaji (Beverages)', value: 0 });
      result.push({ name: 'Groceries', value: 0 });
    }

    return result;
  }, [sales, products]);

  const maxCategorySales = useMemo(() => {
    const vals = categorySalesData.map(d => d.value);
    return Math.max(...vals, 1000); // Avoid dividing by 0
  }, [categorySalesData]);

  // Excel / CSV Export Logic
  const handleExportCSV = () => {
    if (sales.length === 0) {
      alert('Hakuna mauzo ya kusafirisha hivi sasa.');
      return;
    }

    // Prepare CSV header rows
    const headers = [
      'ID ya Mauzo (Sale ID)',
      'Tarehe (Date)',
      'Muuzaji (Cashier)',
      'Bidhaa Zilizouzwa (Items Sold)',
      'Jumla Kuu (Total Amount)',
      'Kiasi Kilicholipwa (Cash Received)',
      'Kiasi cha Deni (Debt Outstanding)',
      'Jina la Mdaiwa (Debtor Name)',
      'Simu ya Mdaiwa (Debtor Phone)',
      'Hali ya Deni (Debt Status)'
    ].join(',');

    const rows = sales.map(sale => {
      // Create readable item descriptions e.g. "Sembe (2) + Cola (1)"
      const itemsString = sale.items
        .map(i => `${i.name} (x${i.quantity})`)
        .join('; ');

      const debtOutstanding = sale.isDebt ? Math.max(0, sale.total - (sale.debtPaidAmount || 0)) : 0;
      
      const columns = [
        sale.id,
        new Date(sale.createdAt).toLocaleString().replace(/,/g, ''),
        sale.sellerName,
        `"${itemsString.replace(/"/g, '""')}"`, // escape quotes for csv conformity
        sale.total,
        sale.amountReceived,
        debtOutstanding,
        sale.debtorName ? `"${sale.debtorName.replace(/"/g, '""')}"` : 'N/A',
        sale.debtorPhone || 'N/A',
        sale.isDebt ? (sale.debtStatus || 'unpaid') : 'Cash'
      ];

      return columns.join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'Mauzo_Sales_Report_' + new Date().toISOString().slice(0,10) + '.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle local file selection and secure upload to Server API (Proxied to ImgBB/Local)
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show temporary preview immediately
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setIsUploadingImage(true);
    try {
      const base64Reader = new FileReader();
      base64Reader.readAsDataURL(file);
      base64Reader.onloadend = async () => {
        const rawBase64 = base64Reader.result as string;
        try {
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              image: rawBase64,
              name: file.name
            })
          });

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Imeshindwa kupakia picha.');
          }

          const result = await res.json();
          if (result.success && result.url) {
            setNewProdImage(result.url);
            if (result.warning) {
              console.warn(result.warning);
            }
          } else {
            throw new Error('Url ya picha haikurejeshwa ipasavyo.');
          }
        } catch (uploadErr: any) {
          console.error('Picha upload error:', uploadErr);
          alert(`Upakiaji wa picha umeshindwa: ${uploadErr.message || uploadErr}`);
        } finally {
          setIsUploadingImage(false);
        }
      };
    } catch (err) {
      console.error(err);
      setIsUploadingImage(false);
    }
  };

  // Add Product Handler
  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim() || !newProdPrice || !newProdStock) {
      alert('Tafadhali jaza sifa zote za bidhaa upya.');
      return;
    }

    const priceNum = parseFloat(newProdPrice);
    const stockNum = parseInt(newProdStock);

    if (isNaN(priceNum) || priceNum < 0) {
      alert('Weka bei sahihi ya bidhaa.');
      return;
    }
    if (isNaN(stockNum) || stockNum < 0) {
      alert('Weka kiasi sahihi cha stoki.');
      return;
    }

    const targetId = newProdId.trim() || `prod-${Date.now().toString().slice(-4)}`;

    // Hakikisha ID ya bidhaa haijarudiwa
    if (products.some(p => p.id.toLowerCase() === targetId.toLowerCase())) {
      alert(`ID ya bidhaa "${targetId}" tayari ipo katika mfumo! Tafadhali weka ID nyingine ya kipekee au iache wazi ili mfumo uchague.`);
      return;
    }

    const created: Product = {
      id: targetId,
      name: newProdName.trim(),
      price: priceNum,
      category: newProdCategory,
      image: newProdImage,
      stock: stockNum,
      createdAt: new Date().toISOString()
    };

    onAddProduct(created);
    setShowAddProductModal(false);
    
    // Clear fields
    setNewProdId('');
    setNewProdName('');
    setNewProdPrice('');
    setNewProdStock('');
    setNewProdImage('maize');
    setImagePreview(null);
    setImageType('preset');
  };

  // Quick edit stock & price inline saver
  const saveProductEdits = (product: Product) => {
    const updatedPrice = editingPrice ? parseFloat(editingPrice) : product.price;
    const updatedStock = editingStock ? parseInt(editingStock) : product.stock;

    if (isNaN(updatedPrice) || updatedPrice < 0) {
      alert('Weka bei halali.');
      return;
    }
    if (isNaN(updatedStock) || updatedStock < 0) {
      alert('Weka stock halali.');
      return;
    }

    onUpdateProduct({
      ...product,
      price: updatedPrice,
      stock: updatedStock
    });

    setEditingProductId(null);
    setEditingPrice('');
    setEditingStock('');
  };

  // Start edit handler
  const startEditingProduct = (product: Product) => {
    setEditingProductId(product.id);
    setEditingPrice(product.price.toString());
    setEditingStock(product.stock.toString());
  };

  // Settle Outstanding Debt Form Handler
  const handleSettleDebtSubmit = (e: React.FormEvent, saleId: string, remainingBalance: number) => {
    e.preventDefault();
    const payAmount = parseFloat(settleAmount);
    if (isNaN(payAmount) || payAmount <= 0) {
      alert('Tafadhali weka kiasi sahihi cha pesa.');
      return;
    }

    if (payAmount > remainingBalance) {
      alert(`Kiasi kimemzidi mdaiwa! Deni lililosalia ni ${remainingBalance.toLocaleString()}/= pekee.`);
      return;
    }

    onUpdateSaleDebt(saleId, payAmount);
    setSettlingSaleId(null);
    setSettleAmount('');
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-US').format(amount) + '/=';
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* Boss control navigation bar - DESKTOP */}
      <div className="hidden lg:flex clay-card p-4 items-center justify-between bg-slate-100">
        <div className="flex items-center gap-1.5">
          <button
            id="tab-dashboard"
            onClick={() => setActiveTab('dashboard')}
            className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
              activeTab === 'dashboard'
                ? 'clay-btn-indigo text-indigo-700 bg-indigo-50 font-bold'
                : 'clay-btn text-slate-600 hover:text-slate-900 bg-white'
            }`}
          >
            Dashboard
          </button>
          <button
            id="tab-products"
            onClick={() => setActiveTab('products')}
            className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
              activeTab === 'products'
                ? 'clay-btn-indigo text-indigo-700 bg-indigo-50 font-bold'
                : 'clay-btn text-slate-600 hover:text-slate-900 bg-white'
            }`}
          >
            Bidhaa (Inventory)
          </button>
          <button
            id="tab-debts"
            onClick={() => setActiveTab('debts')}
            className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
              activeTab === 'debts'
                ? 'clay-btn-indigo text-indigo-700 bg-indigo-50 font-bold'
                : 'clay-btn text-slate-600 hover:text-slate-900 bg-white'
            }`}
          >
            Wadaiwa (Debt Tracker)
            {outstandingDebts.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-600 border border-red-200 rounded-full font-mono animate-pulse">
                {outstandingDebts.length}
              </span>
            )}
          </button>
          <button
            id="tab-users"
            onClick={() => setActiveTab('users')}
            className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'users'
                ? 'clay-btn-indigo text-indigo-700 bg-indigo-50 font-bold'
                : 'clay-btn text-slate-600 hover:text-slate-900 bg-white'
            }`}
          >
            <Users size={14} className="text-slate-500" />
            Watumiaji & Roles
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="btn-sync-sales"
            onClick={onSyncSales}
            disabled={isSyncing}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold font-mono transition-all flex items-center gap-2 ${
              isSyncing 
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-inner' 
                : 'clay-btn bg-white text-slate-700 hover:scale-105 active:scale-95'
            }`}
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
            {isSyncing ? 'Inasawazisha...' : 'Sawazisha (Sync)'}
          </button>

          <button
            id="btn-export-csv"
            onClick={handleExportCSV}
            className="px-4 py-2.5 rounded-2xl text-xs font-bold font-mono clay-btn-indigo hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            <FileSpreadsheet size={14} />
            Ripoti (Excel CSV)
          </button>
        </div>
      </div>

      {/* Boss control navigation bar - MOBILE & TABLET (Sandwich Menu) */}
      <div className="flex lg:hidden flex-col gap-2 sticky top-2 z-[100] transition-all duration-300">
        <div className="clay-card p-4 flex items-center justify-between bg-slate-100/90 backdrop-blur-md shadow-md border border-white/30">
          <div className="flex flex-col">
            <span className="text-[10px] text-indigo-600 font-extrabold uppercase tracking-widest">Usimamizi (Boss Panel)</span>
            <span className="text-base font-black text-slate-800 flex items-center gap-2 capitalize">
              {activeTab === 'dashboard' && 'Dashboard Kuu'}
              {activeTab === 'products' && 'Bidhaa (Inventory)'}
              {activeTab === 'debts' && `Wadaiwa (Debt Tracker)`}
              {activeTab === 'users' && 'Watumiaji & Roles'}
              
              {activeTab === 'debts' && outstandingDebts.length > 0 && (
                <span className="px-2 py-0.5 text-[10px] bg-red-100 text-red-600 border border-red-200 rounded-full font-mono font-bold animate-pulse">
                  {outstandingDebts.length}
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick sync shortcut button next to sandwich to make it even more convenient */}
            <button
              onClick={onSyncSales}
              disabled={isSyncing}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                isSyncing 
                  ? 'bg-slate-200 text-slate-400' 
                  : 'bg-white text-slate-700 shadow-sm border border-slate-200 active:scale-95'
              }`}
              title="Sawazisha"
            >
              <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
            </button>

            {/* Sandwich Toggle Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="w-11 h-11 rounded-xl bg-indigo-600 text-white shadow-lg flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition-all"
              aria-label="Fungua Menu"
            >
              {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Dropdown Menu List with clear beautiful claymorphic design */}
        {isMenuOpen && (
          <div className="absolute top-[72px] right-0 left-0 clay-card p-4 bg-white/95 backdrop-blur-lg shadow-2xl border border-indigo-100 flex flex-col gap-3.5 z-40 animate-in fade-in slide-in-from-top-4 duration-200">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1.5">Menyu ya Kuratibu (Navigation)</span>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setActiveTab('dashboard');
                  setIsMenuOpen(false);
                }}
                className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-all ${
                  activeTab === 'dashboard'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-inner'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <TrendingUp size={16} />
                <span>Dashboard Kuu</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('products');
                  setIsMenuOpen(false);
                }}
                className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-all ${
                  activeTab === 'products'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-inner'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Package size={16} />
                <span>Bidhaa (Inventory)</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('debts');
                  setIsMenuOpen(false);
                }}
                className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-all justify-between ${
                  activeTab === 'debts'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-inner'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Coins size={16} />
                  <span>Wadaiwa (Debt Tracker)</span>
                </div>
                {outstandingDebts.length > 0 && (
                  <span className="px-2 py-0.5 text-xs bg-red-100 text-red-600 border border-red-200 rounded-full font-mono font-black">
                    {outstandingDebts.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setActiveTab('users');
                  setIsMenuOpen(false);
                }}
                className={`flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-all ${
                  activeTab === 'users'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-inner'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Users size={16} />
                <span>Watumiaji & Roles</span>
              </button>
            </div>

            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest border-b border-slate-100 pt-1 pb-1.5">Vitendo vya Haraka (Quick Actions)</span>
            
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  handleExportCSV();
                  setIsMenuOpen(false);
                }}
                className="flex items-center justify-center gap-2.5 p-3 rounded-xl text-xs font-bold font-mono bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100 w-full"
              >
                <FileSpreadsheet size={14} />
                <span>Hamisha Ripoti (Excel CSV)</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DASHBOARD TAB CONTENT */}
      {activeTab === 'dashboard' && (
        <div className="space-y-8">
          
          {/* KPI Display list */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            <div className="clay-card p-6 flex flex-col justify-between hover:scale-[1.01] transition-transform duration-250">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Jumla ya Mauzo</span>
                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center">
                  <TrendingUp size={16} className="text-indigo-600" />
                </div>
              </div>
              <div>
                <h3 className="font-mono text-3xl xl:text-4xl font-black text-slate-800 tracking-tight leading-none mb-1.5">{formatMoney(kpis.grossSales)}</h3>
                <p className="text-[10px] text-slate-400 font-medium font-sans">
                  Imetokana na risiti <span className="font-mono font-bold text-indigo-600">{kpis.salesCount}</span>
                </p>
              </div>
            </div>

            <div className="clay-card p-6 flex flex-col justify-between hover:scale-[1.01] transition-transform duration-250">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Kesh iliyopo (Cash)</span>
                <div className="w-8 h-8 rounded-full bg-emerald-55 flex items-center justify-center">
                  <Coins size={16} className="text-emerald-600" />
                </div>
              </div>
              <div>
                <h3 className="font-mono text-3xl xl:text-4xl font-black text-emerald-600 tracking-tight leading-none mb-1.5">{formatMoney(kpis.actualCashReceived)}</h3>
                <p className="text-[10px] text-slate-400 font-medium font-sans">Zilizopokelewa mkononi</p>
              </div>
            </div>

            <div className="clay-card p-6 flex flex-col justify-between hover:scale-[1.01] transition-transform duration-250">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Madeni Nje (Debts)</span>
                <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center">
                  <BadgeAlert size={16} className="text-rose-500" />
                </div>
              </div>
              <div>
                <h3 className="font-mono text-3xl xl:text-4xl font-black text-rose-600 tracking-tight leading-none mb-1.5">{formatMoney(kpis.totalDebtOutstanding)}</h3>
                <p className="text-[10px] text-slate-400 font-medium font-sans">Bado hazijalipwa na wateja</p>
              </div>
            </div>

            <div className="clay-card p-6 flex flex-col justify-between hover:scale-[1.01] transition-transform duration-250">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Wastani Mauzo (AOV)</span>
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                  <Briefcase size={16} className="text-slate-500" />
                </div>
              </div>
              <div>
                <h3 className="font-mono text-3xl xl:text-4xl font-black text-slate-800 tracking-tight leading-none mb-1.5">{formatMoney(kpis.averageOrderValue)}</h3>
                <p className="text-[10px] text-slate-400 font-medium font-sans">Kila kikapu cha mauzo</p>
              </div>
            </div>

          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Sales Chart using customized beautiful SVG Layouts */}
            <div className="lg:col-span-8 clay-card p-6">
              <h3 className="font-sans font-bold text-slate-800 text-lg mb-6">Mchanganuo wa Mauzo kwa Vikundi</h3>
              
              <div className="space-y-6">
                {categorySalesData.map((data, idx) => {
                  const percentage = (data.value / maxCategorySales) * 100;
                  return (
                    <div id={`chart-row-${idx}`} key={data.name} className="space-y-2">
                      <div className="flex justify-between items-center text-sm font-medium">
                        <span className="text-slate-700 flex items-center gap-2">
                          <Tags size={14} className="text-indigo-500" />
                          {data.name}
                        </span>
                        <span className="font-mono text-indigo-700 font-bold">{formatMoney(data.value)}</span>
                      </div>
                      
                      {/* Claymorphic 3D Bar representation */}
                      <div className="relative h-7 w-full bg-slate-200/60 rounded-full shadow-inner overflow-hidden border border-slate-300/30">
                        <div 
                          className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600 transition-all duration-1000 ease-out flex items-center pl-3.5"
                          style={{ width: `${Math.max(8, percentage)}%` }}
                        >
                          {percentage > 15 && (
                            <span className="text-[10px] font-bold text-white uppercase drop-shadow-sm font-mono whitespace-nowrap">
                              {Math.round(percentage)}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 pt-4 border-t border-slate-100 flex items-center gap-2.5 text-xs text-slate-400 font-mono">
                <Sparkles size={14} className="text-amber-500" />
                <span>Chati hii ya udongo hujihesabu papo hapo kulingana na mauzo yanayofanywa na wauzaji wako.</span>
              </div>
            </div>

            {/* Recent Transaction Log / Feed */}
            <div className="lg:col-span-4 clay-card p-6 flex flex-col justify-between">
              <div>
                <h3 className="font-sans font-bold text-slate-800 text-lg mb-5 flex items-center gap-2">
                  <Clock size={18} className="text-indigo-600" />
                  <span>Historia ya Mauzo</span>
                </h3>

                <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1 no-scrollbar">
                  {sales.map((sale) => (
                    <div id={`feed-sale-${sale.id}`} key={sale.id} className="p-3 bg-slate-50/60 rounded-xl border border-slate-100 shadow-sm text-xs">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-mono font-bold text-slate-700">{sale.id}</span>
                        <span className="text-[10px] text-slate-400">{new Date(sale.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <div className="text-slate-550 flex justify-between items-center">
                        <span className="truncate pr-2">
                          {sale.items.map(i => `${i.name} (x${i.quantity})`).join(', ')}
                        </span>
                        <span className="font-mono font-bold text-indigo-700 whitespace-nowrap">
                          {formatMoney(sale.total)}
                        </span>
                      </div>
                      <div className="mt-1.5 pt-1.5 border-t border-dashed border-slate-200 flex justify-between items-center text-[10px] font-mono">
                        <span className="text-slate-400">Muuzaji: {sale.sellerName}</span>
                        {sale.isDebt ? (
                          <span className="text-red-500 font-bold uppercase">Madeni</span>
                        ) : (
                          <span className="text-emerald-600 font-bold uppercase">Kesh</span>
                        )}
                      </div>
                    </div>
                  ))}

                  {sales.length === 0 && (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      Hakuna mauzo yaliyofanyika leo bado.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6">
                <button 
                  onClick={handleExportCSV}
                  className="w-full py-3 rounded-2xl text-xs font-bold font-mono clay-btn-indigo block text-center"
                >
                  Hamisha Mauzo yote (Export Excel)
                </button>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* PRODUCTS / INVENTORY MANAGER TAB */}
      {activeTab === 'products' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="font-sans font-bold text-slate-800 text-lg">Hifadhi ya Bidhaa ({products.length})</h3>
              <p className="text-xs text-slate-500">Dhibiti na usimamie orodha ya bidhaa zote zilizopo dukani.</p>
            </div>
            
            <button
              id="btn-add-product-modal"
              onClick={() => setShowAddProductModal(true)}
              className="clay-btn-indigo px-5 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 hover:scale-105 active:scale-95"
            >
              <Plus size={16} />
              Ongeza Bidhaa Mpya
            </button>
          </div>

          {/* Tafuta Bidhaa Bar */}
          <div className="flex flex-wrap gap-2.5 items-center bg-slate-200/40 p-2 border border-slate-300/40 rounded-3xl">
            <div className="relative flex-1 min-w-[240px]">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <Search size={15} />
              </span>
              <input
                id="search-product-input"
                type="text"
                placeholder="Tafuta bidhaa kwa Jina, ID, au Kundi lake..."
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                className="clay-input pl-10 pr-3.5 py-2.5 w-full text-xs font-sans placeholder:text-slate-400"
              />
            </div>
            {productSearchQuery && (
              <button
                onClick={() => setProductSearchQuery('')}
                className="px-3.5 py-2 hover:bg-slate-200 rounded-2xl text-xs font-semibold text-slate-600 border border-slate-300/20 active:scale-95 transition-all text-center"
              >
                Futa vichujio
              </button>
            )}

            {/* Toggle category manager */}
            <button
              type="button"
              onClick={() => setShowCategoryManager(prev => !prev)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                showCategoryManager 
                  ? 'bg-indigo-600 text-white shadow-inner scale-105' 
                  : 'clay-btn bg-white text-slate-600 hover:text-slate-800'
              }`}
            >
              <Tags size={14} />
              <span>{showCategoryManager ? 'Funga Vikundi' : 'Usimamizi wa Vikundi'}</span>
            </button>
          </div>

          {/* DYNAMIC CATEGORIES CONFIGURATOR PANEL */}
          {showCategoryManager && (
            <div className="clay-card p-5 bg-gradient-to-r from-slate-50 to-indigo-50/20 border border-indigo-100 flex flex-col gap-4 animate-slideDown">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <div>
                  <h4 className="font-sans font-bold text-sm text-slate-800 flex items-center gap-2">
                    <Tags size={16} className="text-indigo-600" />
                    <span>Usimamizi wa Vikundi vya Bidhaa (Categories)</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    Unaweza kuongeza vikundi vipya au kufuta vile visivyohitajika kwa uandishi rahisi wa stoki yako.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start pt-2">
                {/* Current Categories List */}
                <div className="md:col-span-2 flex flex-col gap-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Vikundi vya sasa hivi ({categories.length}):</span>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => (
                      <div 
                        key={cat} 
                        className="pl-3.5 pr-2 py-1.5 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-2 text-xs font-semibold text-slate-700 hover:border-slate-300 transition-all hover:scale-[1.02]"
                      >
                        <span>{cat}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveCategory(cat)}
                          className="w-5 h-5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-600 flex items-center justify-center transition-colors"
                          title={`Futa kundi ${cat}`}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add New Category Form */}
                <form onSubmit={handleAddCategory} className="flex flex-col gap-2.5 p-4 rounded-2xl bg-white border border-slate-200/60">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Ongeza Kundi jipya:</span>
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Mf. Vipodozi, Vinywaji, n.k."
                      value={newCategoryInput}
                      onChange={(e) => setNewCategoryInput(e.target.value)}
                      className="clay-input px-3 py-2 w-full text-xs font-sans placeholder:text-slate-400 bg-slate-50/50"
                    />
                    <button
                      type="submit"
                      className="py-2 px-3 rounded-xl text-xs font-bold font-sans clay-btn-indigo flex items-center justify-center gap-1.5 w-full hover:scale-105 active:scale-95 transition-all"
                    >
                      <Plus size={13} />
                      <span>Ongeza Kundi</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="clay-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-200/50 border-b border-slate-300/30 text-slate-500 text-xs uppercase font-mono tracking-wider">
                    <th className="py-4 px-6">ID / Bidhaa</th>
                    <th className="py-4 px-6">Kundi (Category)</th>
                    <th className="py-4 px-6">Bei (Price)</th>
                    <th className="py-4 px-6">Stoki iliyobaki (In Stock)</th>
                    <th className="py-4 px-6 text-right">Kitendo (Actions)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/50">
                  {filteredProducts.map(product => {
                    const isEditing = editingProductId === product.id;
                    const isOutOfStock = product.stock === 0;

                    return (
                      <tr id={`prod-row-${product.id}`} key={product.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6 flex items-center gap-4">
                          <ProductIcon type={product.image} className="w-5.5 h-5.5 text-slate-700" />
                          <div>
                            <h4 className="font-semibold text-slate-800">{product.name}</h4>
                            <span className="text-[10px] font-mono text-slate-400">ID: {product.id}</span>
                          </div>
                        </td>

                        <td className="py-4 px-6 text-slate-600 font-medium">{product.category}</td>

                        <td className="py-4 px-6">
                          {isEditing ? (
                            <div className="relative w-28">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">TSh</span>
                              <input
                                id={`edit-price-${product.id}`}
                                type="number"
                                value={editingPrice}
                                onChange={(e) => setEditingPrice(e.target.value)}
                                className="clay-input pl-8 pr-2 py-1.5 w-full font-mono text-xs"
                              />
                            </div>
                          ) : (
                            <span className="font-mono font-bold text-slate-800">{formatMoney(product.price)}</span>
                          )}
                        </td>

                        <td className="py-4 px-6">
                          {isEditing ? (
                            <input
                              id={`edit-stock-${product.id}`}
                              type="number"
                              value={editingStock}
                              onChange={(e) => setEditingStock(e.target.value)}
                              className="clay-input p-1.5 w-20 font-mono text-xs text-center"
                            />
                          ) : (
                            <span className={`font-mono font-semibold px-2.5 py-1 text-xs rounded-full ${
                              isOutOfStock 
                                ? 'bg-rose-100 text-rose-700 border border-rose-200' 
                                : product.stock <= 10 
                                ? 'bg-amber-100 text-amber-700 border border-amber-200' 
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              {product.stock} Mapisi
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-6 text-right">
                          {isEditing ? (
                            <div className="flex gap-2 justify-end">
                              <button
                                id={`save-inline-${product.id}`}
                                onClick={() => saveProductEdits(product)}
                                className="px-3.5 py-1.5 rounded-xl text-xs font-bold clay-btn-emerald"
                              >
                                Hifadhi (Save)
                              </button>
                              <button
                                id={`cancel-inline-${product.id}`}
                                onClick={() => setEditingProductId(null)}
                                className="px-3.5 py-1.5 rounded-xl text-xs font-bold clay-btn"
                              >
                                Hairisha
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-2 justify-end">
                              <button
                                id={`edit-btn-${product.id}`}
                                onClick={() => startEditingProduct(product)}
                                className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl hover:shadow-inner transition-all hover:scale-105"
                              >
                                Badili (Edit/Stock)
                              </button>
                              <button
                                id={`del-btn-${product.id}`}
                                onClick={() => {
                                  if (confirm(`Una uhakika unataka kufuta bidhaa: ${product.name}?`)) {
                                    onDeleteProduct(product.id);
                                  }
                                }}
                                className="p-1.5 text-rose-500 hover:text-rose-700 bg-rose-50 border border-rose-200 rounded-xl transition-all"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* DEBTMANGER / WADAIWA TAB CONTENT */}
      {activeTab === 'debts' && (
        <div className="space-y-6">
          <div className="clay-card p-6 flex flex-col md:flex-row gap-4 justify-between items-center bg-white">
            <div className="relative w-full md:w-96">
              <span className="absolute inset-y-0 left-4 flex items-center text-slate-400">
                <Search size={18} />
              </span>
              <input
                id="debt-search"
                type="text"
                placeholder="Tafuta jina la mdaiwa au namba simu..."
                value={debtSearchQuery}
                onChange={(e) => setDebtSearchQuery(e.target.value)}
                className="clay-input pl-11 pr-4 py-3 w-full"
              />
            </div>

            <div className="flex items-center gap-2.5 text-xs font-mono px-4 py-2 bg-red-50 text-red-600 rounded-2xl border border-red-100">
              <BadgeAlert size={14} className="text-red-500 animate-pulse" />
              <span>Deni lote la nje linalosubiriwa: <strong className="text-red-700">{formatMoney(kpis.totalDebtOutstanding)}</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {outstandingDebts.map(sale => {
              const debtTotal = sale.total;
              const paidPortion = sale.debtPaidAmount || 0;
              const remainingBalance = Math.max(0, debtTotal - paidPortion);
              const isSettlingThis = settlingSaleId === sale.id;

              return (
                <div id={`debt-card-${sale.id}`} key={sale.id} className="clay-card p-5 bg-white border border-slate-100 hover:border-red-100 transition-all">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-sans font-bold text-slate-800 text-base">{sale.debtorName || 'Mteja Asiyejulikana'}</h4>
                      <p className="text-[11px] text-slate-400 font-mono">Simu: {sale.debtorPhone || 'N/A'}</p>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                      ID: {sale.id}
                    </span>
                  </div>

                  <div className="border-t border-b border-slate-100 py-3.5 my-3 text-xs space-y-2">
                    <div className="flex justify-between text-slate-500">
                      <span>Bidhaa walizochukua</span>
                      <span className="text-right font-medium max-w-[150px] truncate">
                        {sale.items.map(i => `${i.name} (x${i.quantity})`).join(', ')}
                      </span>
                    </div>
                    <div className="flex justify-between font-mono">
                      <span>Jumla ya Gharama</span>
                      <span className="font-semibold text-slate-700">{formatMoney(debtTotal)}</span>
                    </div>
                    <div className="flex justify-between font-mono">
                      <span>Gharama iliyolipwa mwanzo</span>
                      <span className="font-semibold text-emerald-600">{formatMoney(paidPortion)}</span>
                    </div>
                    
                    <div className="h-px border-t border-dashed border-slate-200 my-1"></div>

                    <div className="flex justify-between font-mono text-sm font-bold text-red-600 bg-red-50/50 p-2 rounded-xl">
                      <span>Deni Lililosalia (Balance)</span>
                      <span>{formatMoney(remainingBalance)}</span>
                    </div>
                  </div>

                  {isSettlingThis ? (
                    <form 
                      id={`settle-form-${sale.id}`}
                      onSubmit={(e) => handleSettleDebtSubmit(e, sale.id, remainingBalance)} 
                      className="space-y-3 pt-2 animate-fadeIn"
                    >
                      <div>
                        <label className="text-[11px] text-slate-500 font-bold mb-1 block uppercase">
                          Kiasi Kilichopokelewa sasa (Money Received)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500 font-bold">TSh</span>
                          <input
                            id={`settle-input-field-${sale.id}`}
                            type="number"
                            required
                            max={remainingBalance}
                            placeholder={remainingBalance.toString()}
                            value={settleAmount}
                            onChange={(e) => setSettleAmount(e.target.value)}
                            className="clay-input pl-11 pr-3 py-2 w-full text-xs font-mono font-bold"
                          />
                        </div>
                      </div>

                      {/* Remaining Debt dynamic output */}
                      <div className="text-xs p-2.5 bg-slate-100 rounded-xl flex justify-between items-center font-mono font-bold border border-slate-200">
                        <span className="text-slate-500">Deni Lililosalia (Remaining as Debt):</span>
                        <span className="text-rose-600">
                          {formatMoney(Math.max(0, remainingBalance - (parseFloat(settleAmount) || 0)))}
                        </span>
                      </div>

                      <div className="flex gap-2 text-xs font-bold">
                        <button
                          id={`submit-settle-${sale.id}`}
                          type="submit"
                          className="flex-1 py-2 rounded-xl clay-btn-emerald"
                        >
                          Hifadhi Malipo (Save Check)
                        </button>
                        <button
                          id={`cancel-settle-${sale.id}`}
                          type="button"
                          onClick={() => {
                            setSettlingSaleId(null);
                            setSettleAmount('');
                          }}
                          className="px-3 py-2 rounded-xl clay-btn"
                        >
                          Ghairi
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      id={`btn-start-settle-${sale.id}`}
                      onClick={() => setSettlingSaleId(sale.id)}
                      className="mt-2 w-full py-2.5 rounded-xl font-bold font-sans text-xs clay-btn-rose/10 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition-all hover:scale-[1.01]"
                    >
                      Sajili Malipo (Collect portion / Full payment)
                    </button>
                  )}
                </div>
              );
            })}

            {outstandingDebts.length === 0 && (
              <div className="col-span-full clay-card p-12 text-center text-slate-400">
                Hakuna madeni yoyote yanayolingana na utafutaji wako hapa! Safi sana.
              </div>
            )}
          </div>
        </div>
      )}

      {/* USER MANAGEMENT & ROLES TAB */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="clay-card p-6 bg-white flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h3 className="font-sans font-bold text-slate-800 text-lg">Menejimenti ya Watumiaji na Majukumu (Roles)</h3>
              <p className="text-xs text-slate-500 font-sans mt-0.5">
                Sajili wasaidizi wa duka (cashiers), weka PIN za siri, na ugatue majukumu ya kiutendaji. Data hizi zinasawazishwa salama kwenye Turso DB yako ya wingu.
              </p>
            </div>
            
            <button
              onClick={() => {
                setShowAddUserSection(!showAddUserSection);
                setEditingUserId(null);
                setUserName('');
                setUserPin('');
                setUserError('');
              }}
              className="clay-btn-indigo px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2"
            >
              <Plus size={16} />
              {showAddUserSection ? 'Sawa' : 'Ongeza Mtumiaji Mpya'}
            </button>
          </div>

          {/* User Feedback Status */}
          {userError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-800 rounded-2xl flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
              <strong>Mazingira magumu:</strong> {userError}
            </div>
          )}
          {userSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 rounded-2xl flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              {userSuccess}
            </div>
          )}

          {/* Form to Add New User */}
          {showAddUserSection && (
            <div className="clay-card p-6 bg-slate-50 border border-indigo-100/40 space-y-4 animate-scaleUp">
              <h4 className="font-sans font-bold text-slate-800 text-sm flex items-center gap-2">
                <Briefcase size={16} className="text-indigo-600" />
                Sajili Mfanyakazi / Jukumu Mpya
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-slate-500 font-semibold mb-1 block">Jina la Mtumiaji</label>
                  <input
                    type="text"
                    required
                    placeholder="Mf. Juma Kassim, Mama Ntilie"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="clay-input px-3 py-2.5 w-full text-xs"
                  />
                </div>
                
                <div>
                  <label className="text-xs text-slate-500 font-semibold mb-1 block">Jukumu (Role)</label>
                  <select
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value as 'boss' | 'seller')}
                    className="clay-input px-3 py-2.5 w-full text-[11px]"
                  >
                    <option value="seller">Muuzaji wa Kawaida (Seller - POS View only)</option>
                    <option value="boss">Boss Mkuu (Full Dashboard Access + Reports)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-500 font-semibold mb-1 block">Weka PIN ya Siri (Namba 4 pekee)</label>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="Mf. 3432"
                    value={userPin}
                    onChange={(e) => setUserPin(e.target.value.replace(/\D/g, ''))}
                    className="clay-input px-3 py-2.5 w-full text-xs font-mono font-bold text-center tracking-widest"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    if (!userName.trim()) {
                      setUserError('Tafadhali jaza jina la mtumiaji.');
                      return;
                    }
                    if (!/^\d{4}$/.test(userPin)) {
                      setUserError('PIN lazima iwe namba 4 za siri (mf. 1234).');
                      return;
                    }
                    const isPinTaken = sellers.some(u => u.pin === userPin);
                    if (isPinTaken) {
                      setUserError('PIN hii tayari inatumiwa na akaunti nyingine! Chagua PIN tofauti.');
                      return;
                    }

                    const newUser: User = {
                      id: 'user-' + Date.now().toString().slice(-6),
                      name: userName.trim(),
                      role: userRole,
                      pin: userPin
                    };

                    onUpdateSellers([...sellers, newUser]);
                    setUserName('');
                    setUserPin('');
                    setUserRole('seller');
                    setShowAddUserSection(false);
                    setUserSuccess('Mtumiaji mpya ameongezwa kikamilifu!');
                    setTimeout(() => setUserSuccess(''), 3000);
                  }}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs clay-btn-indigo"
                >
                  Ongeza Mtumiaji (Add User)
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddUserSection(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs clay-btn"
                >
                  Ghairi (Cancel)
                </button>
              </div>
            </div>
          )}

          {/* Edit User Form Accordion */}
          {editingUserId && (
            <div className="clay-card p-6 bg-amber-50/50 border border-amber-200/50 space-y-4 animate-scaleUp">
              <h4 className="font-sans font-bold text-slate-800 text-sm flex items-center gap-2">
                <Settings size={16} className="text-amber-600" />
                Hariri Mtumiaji: {sellers.find(u => u.id === editingUserId)?.name}
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-slate-500 font-semibold mb-1 block">Jina jipya</label>
                  <input
                    type="text"
                    required
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="clay-input px-3 py-2.5 w-full text-xs"
                  />
                </div>
                
                <div>
                  <label className="text-xs text-slate-500 font-semibold mb-1 block">Jukumu (Role)</label>
                  <select
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value as 'boss' | 'seller')}
                    className="clay-input px-3 py-2.5 w-full text-[11px]"
                  >
                    <option value="seller">Muuzaji wa Kawaida (Seller - POS View only)</option>
                    <option value="boss">Boss Mkuu (Full Dashboard Access + Reports)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-500 font-semibold mb-1 block">Tengeneza PIN Mpya (Namba 4)</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={userPin}
                    onChange={(e) => setUserPin(e.target.value.replace(/\D/g, ''))}
                    className="clay-input px-3 py-2.5 w-full text-xs font-mono font-bold text-center tracking-widest"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    if (!userName.trim()) {
                      setUserError('Tafadhali weka jina lililo sahihi.');
                      return;
                    }
                    if (!/^\d{4}$/.test(userPin)) {
                      setUserError('PIN lazima iwe namba 4 za siri (mf. 1234).');
                      return;
                    }
                    const isPinTaken = sellers.some(u => u.pin === userPin && u.id !== editingUserId);
                    if (isPinTaken) {
                      setUserError('PIN hii tayari inatumiwa na mtumiaji mwingine!');
                      return;
                    }

                    const updated = sellers.map(u => {
                      if (u.id === editingUserId) {
                        return { ...u, name: userName.trim(), pin: userPin, role: userRole };
                      }
                      return u;
                    });

                    onUpdateSellers(updated);
                    setEditingUserId(null);
                    setUserName('');
                    setUserPin('');
                    setUserSuccess('Taarifa zimesasishwa kikamilifu!');
                    setTimeout(() => setUserSuccess(''), 3000);
                  }}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs clay-btn-indigo"
                >
                  Okoa Mabadiliko (Save Changes)
                </button>
                <button
                  type="button"
                  onClick={() => setEditingUserId(null)}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs clay-btn"
                >
                  Ghairi (Cancel)
                </button>
              </div>
            </div>
          )}

          {/* Users Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sellers.map((user) => {
              const isBoss = user.role === 'boss';
              const isSelf = user.id === 'boss';

              return (
                <div 
                  id={`user-card-${user.id}`} 
                  key={user.id} 
                  className={`clay-card p-5 bg-white border transition-all ${
                    isBoss 
                      ? 'border-amber-150 hover:border-amber-300' 
                      : 'border-slate-100/55 hover:border-indigo-150'
                  }`}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-base shadow ${
                      isBoss 
                        ? 'bg-gradient-to-tr from-amber-400 to-yellow-300 text-amber-900 border border-amber-200' 
                        : 'bg-gradient-to-tr from-indigo-500 to-indigo-400 text-white border border-indigo-200'
                    }`}>
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    
                    <div className="flex-1">
                      <h4 className="font-sans font-extrabold text-slate-800 text-base">{user.name}</h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded-full ${
                          isBoss 
                            ? 'bg-amber-100 text-amber-850 border border-amber-200/50' 
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-100/50'
                        }`}>
                          {isBoss ? 'Boss' : 'Cashier (Muuzaji)'}
                        </span>
                        
                        <span className="text-[10px] text-slate-400 font-mono">
                          ID: {user.id.substring(0, 8)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center justify-between text-xs font-mono font-bold mb-4">
                    <span className="text-slate-500">PIN ya Siri (Mizania):</span>
                    <span className="text-indigo-600 text-sm tracking-widest bg-white border border-slate-150 px-2.5 py-1 rounded-xl">
                      {user.pin || (user.id === 'user-seller-1' ? '1111' : user.id === 'user-seller-2' ? '2222' : '9999')}
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-2 text-xs font-bold pt-2 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setEditingUserId(user.id);
                        setUserName(user.name);
                        setUserPin(user.pin || (user.id === 'user-seller-1' ? '1111' : user.id === 'user-seller-2' ? '2222' : '9999'));
                        setUserRole(user.role);
                        setShowAddUserSection(false);
                        setUserError('');
                      }}
                      className="px-3.5 py-1.5 text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-100 rounded-xl transition-all"
                    >
                      Hariri (Edit PIN)
                    </button>
                    
                    {!isSelf && (
                      <button
                        onClick={() => {
                          if (confirm(`Una uhakika unataka kumfuta mfanyakazi huyu: ${user.name}? Hataweza tena kufanya mauzo.`)) {
                            onUpdateSellers(sellers.filter(u => u.id !== user.id));
                            setUserSuccess('Mtumiaji amefutwa kikamilifu!');
                            setTimeout(() => setUserSuccess(''), 3000);
                          }
                        }}
                        className="p-1.5 text-rose-500 hover:text-rose-750 bg-rose-50 border border-rose-100 rounded-xl transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CHOOSE MODAL FOR CREATING PRODUCT */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="clay-card max-w-md w-full bg-slate-50 p-4 sm:p-6 flex flex-col gap-3 sm:gap-4 animate-scaleUp my-auto max-h-[95vh] overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-sans font-bold text-slate-800 text-lg">Ongeza Bidhaa Mpya</h3>
              <button 
                id="close-add-modal"
                onClick={() => setShowAddProductModal(false)}
                className="p-1 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-500 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 font-semibold mb-1 block font-sans">ID ya Bidhaa (Product ID / Barcode)</label>
                <div className="flex gap-2">
                  <input
                    id="new-product-id"
                    type="text"
                    placeholder="Barcode au andika ID maalum (ikiwa wazi inapata ya mfumo)"
                    value={newProdId}
                    onChange={(e) => setNewProdId(e.target.value)}
                    className="clay-input px-3.5 py-2.5 flex-1 text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setNewProdId(`prod-${Date.now().toString().slice(-4)}`)}
                    className="px-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 rounded-xl font-bold text-xs text-indigo-700 hover:scale-105 active:scale-95 transition-all flex items-center justify-center whitespace-nowrap"
                  >
                    Auto ID
                  </button>
                </div>
                <p className="text-[9px] text-slate-400 mt-1">
                  Msimamizi anaweza kufuta na kuongeza barcodes au namba ya bidhaa (ID) moja kwa moja hapa kwa uingiaji rahisi.
                </p>
              </div>

              <div>
                <label className="text-xs text-slate-500 font-semibold mb-1 block">Jina la Bidhaa (Product Name)</label>
                <input
                  id="new-product-name"
                  type="text"
                  required
                  placeholder="Mf. Sabuni, Sukari, Soda, n.k."
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  className="clay-input px-3.5 py-2.5 w-full text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 font-semibold mb-1 block">Kundi lake (Category)</label>
                  <select
                    id="new-product-cat"
                    value={newProdCategory}
                    onChange={(e) => setNewProdCategory(e.target.value)}
                    className="clay-input px-3.5 py-2.5 w-full text-xs"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-500 font-semibold mb-1 block font-sans">Picha Alama (Image Source)</label>
                  <div className="flex bg-slate-200/50 p-1 rounded-xl gap-1 mb-2">
                    <button
                      type="button"
                      onClick={() => setImageType('preset')}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                        imageType === 'preset'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-800'
                      }`}
                    >
                      Alama (Icon)
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageType('upload')}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                        imageType === 'upload'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-800'
                      }`}
                    >
                      Pakia File
                    </button>
                  </div>

                  {imageType === 'preset' ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2 p-2 bg-slate-200/30 rounded-2xl border border-slate-300/20 max-h-[110px] overflow-y-auto">
                        {['maize', 'cola', 'tea', 'margarine', 'soap', 'rice', 'water', 'sugar'].map(iconKey => {
                          const suggested = getSuggestedIconsForCategory(newProdCategory || '');
                          const isSuggested = suggested.includes(iconKey);
                          const isSelected = newProdImage === iconKey;
                          return (
                            <button
                              key={iconKey}
                              type="button"
                              onClick={() => setNewProdImage(iconKey)}
                              className={`relative p-0.5 rounded-xl transition-all duration-150 hover:scale-110 flex-shrink-0 ${
                                isSelected 
                                  ? 'ring-4 ring-indigo-500 scale-105 shadow-md z-10' 
                                  : isSuggested 
                                    ? 'opacity-100 bg-indigo-50 border border-indigo-200/40' 
                                    : 'opacity-50 hover:opacity-100'
                              }`}
                              title={
                                iconKey === 'maize' ? 'Unga/Nafaka' :
                                iconKey === 'cola' ? 'Soda/Vinywaji' :
                                iconKey === 'tea' ? 'Kahawa/Chai' :
                                iconKey === 'margarine' ? 'Mafuta/Margarine' :
                                iconKey === 'soap' ? 'Sabuni/Usafi' :
                                iconKey === 'rice' ? 'Mchele/Nafaka' :
                                iconKey === 'water' ? 'Maji ya chupa' :
                                iconKey === 'sugar' ? 'Sukari' : iconKey
                              }
                            >
                              <div className="w-8 h-8">
                                <ProductIcon type={iconKey} size={14} fullSize />
                              </div>
                              {isSuggested && !isSelected && (
                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-indigo-600 rounded-full border border-white" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[9px] text-slate-400 font-medium">Alama zenye kitone cha bluu zinapendekezwa kulingana na Kundi lililochaguliwa.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <label className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-300 rounded-xl p-2 bg-white hover:bg-slate-50 cursor-pointer transition-all">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="hidden"
                          />
                          <span className="text-[10px] font-bold text-indigo-600 font-sans">
                            {isUploadingImage ? 'Inapakia...' : 'Fungua Picha'}
                          </span>
                        </label>
                        
                        {imagePreview && (
                          <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-200 shadow-sm flex-shrink-0">
                            <img src={imagePreview} alt="hakiki" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>
                      {isUploadingImage && (
                        <p className="text-[9px] text-indigo-600 animate-pulse font-mono font-bold">Inapakia picha...</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 font-semibold mb-1 block">Bei ya Mauzo (Sell Price)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">TSh</span>
                    <input
                      id="new-product-price"
                      type="number"
                      required
                      min="0"
                      placeholder="1500"
                      value={newProdPrice}
                      onChange={(e) => setNewProdPrice(e.target.value)}
                      className="clay-input pl-9 pr-3 py-2.5 w-full text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-500 font-semibold mb-1 block">Kiasi cha Stoki (Stock)</label>
                  <input
                    id="new-product-stock"
                    type="number"
                    required
                    min="0"
                    placeholder="30"
                    value={newProdStock}
                    onChange={(e) => setNewProdStock(e.target.value)}
                    className="clay-input px-3.5 py-2.5 w-full text-xs font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex gap-2 justify-end">
                <button
                  id="btn-save-new-prod"
                  type="submit"
                  className="px-5 py-2.5 rounded-xl font-bold text-xs clay-btn-indigo"
                >
                  Ongeza sasa (Add)
                </button>
                <button
                  id="btn-cancel-new-prod"
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs clay-btn"
                >
                  Ghairi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

// X button SVG helper inline placeholder
function X({ size, className }: { size: number; className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
