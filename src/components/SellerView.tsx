import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  User, 
  Phone, 
  CheckCircle,
  HelpCircle,
  TrendingDown,
  Percent,
  X,
  CreditCard,
  CloudLightning,
  Coins
} from 'lucide-react';
import { Product, Sale, CartItem, SaleItem, User as SellerUser } from '../types';
import ProductIcon from './ProductIcon';

// Helper to scale font size based on text length for Jumla indicator
const getAdaptiveFontSizeClass = (text: string) => {
  const len = text.length;
  if (len <= 10) return 'text-2xl sm:text-3xl';
  if (len <= 14) return 'text-xl sm:text-2xl';
  return 'text-lg sm:text-xl';
};

// Helper to scale font size based on text length for Giant Calculator Output
const getGiantAdaptiveFontSizeClass = (text: string) => {
  const len = text.length;
  if (len <= 10) return 'text-4xl sm:text-5xl md:text-6xl font-black leading-none';
  if (len <= 14) return 'text-3xl sm:text-4xl md:text-5xl font-black leading-none';
  if (len <= 18) return 'text-2xl sm:text-3xl md:text-4xl font-extrabold leading-none';
  return 'text-xl sm:text-2xl md:text-3xl font-bold leading-none';
};

// Helper to scale font size based on text length for cash received input field
const getInputAdaptiveFontSizeClass = (text: string) => {
  const len = text.length;
  if (len <= 10) return 'text-lg sm:text-xl';
  if (len <= 14) return 'text-base sm:text-lg';
  return 'text-xs sm:text-sm';
};

interface SellerViewProps {
  products: Product[];
  sales: Sale[];
  currentSeller: SellerUser;
  onAddSale: (sale: Sale) => void;
  onUpdateStocks: (items: { productId: string; quantity: number }[]) => void;
}

export default function SellerView({ 
  products, 
  sales, 
  currentSeller, 
  onAddSale, 
  onUpdateStocks 
}: SellerViewProps) {
  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);

  // Mobile active sub-tab state
  const [mobileActiveTab, setMobileActiveTab] = useState<'products' | 'cart'>('products');

  // Floating UI Scroll Tracking for Mobile/Tablet Search and Cart Navigation
  const [showFloatingControls, setShowFloatingControls] = useState(false);
  const [floatingSearchActive, setFloatingSearchActive] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 150) {
        setShowFloatingControls(true);
      } else {
        setShowFloatingControls(false);
        setFloatingSearchActive(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Checkout State
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'calculator'>('cart');
  const [amountReceivedInput, setAmountReceivedInput] = useState<string>('');
  const [isDebt, setIsDebt] = useState<boolean>(false);
  const [debtorName, setDebtorName] = useState<string>('');
  const [debtorPhone, setDebtorPhone] = useState<string>('');

  // Receipt Modal State
  const [showReceipt, setShowReceipt] = useState<boolean>(false);
  const [lastCompletedSale, setLastCompletedSale] = useState<Sale | null>(null);

  // Dynamically extract categories from current product list
  const categories = useMemo(() => {
    const list = new Set(products.map(p => p.category));
    return Array.from(list);
  }, [products]);

  // Filter products based on search and category
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            product.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !selectedCategory || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  // Cart Operations
  const addToCart = (product: Product) => {
    if (product.stock === 0) return;

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      const currentQtyInCart = existing ? existing.quantity : 0;
      
      // Prevent exceeding stock
      if (currentQtyInCart >= product.stock) return prev;

      if (existing) {
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prev, { product, quantity: 1 }];
      }
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          // Check stock limit
          if (newQty > item.product.stock) return item;
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const handleQuantityInputChange = (productId: string, value: string) => {
    const cleanVal = value.replace(/[^0-9]/g, '');
    if (cleanVal === '') {
      setCart(prev => prev.map(item => 
        item.product.id === productId ? { ...item, quantity: 0 } : item
      ));
      return;
    }
    const num = parseInt(cleanVal, 10);
    const item = cart.find(i => i.product.id === productId);
    if (!item) return;

    const allowedQty = Math.min(num, item.product.stock);
    setCart(prev => prev.map(i => 
      i.product.id === productId ? { ...i, quantity: allowedQty } : i
    ));
  };

  const handleQuantityInputBlur = (productId: string) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        if (item.quantity <= 0) {
          return { ...item, quantity: 1 };
        }
      }
      return item;
    }));
  };

  const clearCart = () => {
    setCart([]);
    setCheckoutStep('cart');
    setAmountReceivedInput('');
    setIsDebt(false);
    setDebtorName('');
    setDebtorPhone('');
  };

  // Calculations
  const cartSubtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
  }, [cart]);

  const cartTotal = cartSubtotal; // Simplicity for retail cash transaction

  const amountReceivedNum = parseFloat(amountReceivedInput) || 0;
  
  const changeDue = useMemo(() => {
    if (isDebt) {
      return 0; // Debt doesn't give positive change back usually, instead is recorded as partial or unpaid
    }
    return Math.max(0, amountReceivedNum - cartTotal);
  }, [amountReceivedNum, cartTotal, isDebt]);

  const debtBalanceRemaining = useMemo(() => {
    if (!isDebt) return 0;
    return Math.max(0, cartTotal - amountReceivedNum);
  }, [amountReceivedNum, cartTotal, isDebt]);

  // Calculator Keypad inputs
  const handleKeyPress = (val: string) => {
    if (val === 'C') {
      setAmountReceivedInput('');
    } else if (val === '00') {
      setAmountReceivedInput(prev => prev ? prev + '00' : '');
    } else {
      setAmountReceivedInput(prev => prev + val);
    }
  };

  const applyCashPreset = (amount: number) => {
    setAmountReceivedInput(amount.toString());
  };

  const applyAdditionalCash = (amount: number) => {
    const current = parseFloat(amountReceivedInput) || 0;
    setAmountReceivedInput((current + amount).toString());
  };

  // Submit sale handler
  const handleConfirmCheckout = () => {
    if (cart.length === 0) return;

    // Debt validation
    if (isDebt && !debtorName.trim()) {
      alert('Tafadhali weka Jina la Mteja (Customer Name) kwa ajili ya deni.');
      return;
    }

    const saleItems: SaleItem[] = cart.map(item => ({
      productId: item.product.id,
      name: item.product.name,
      price: item.product.price,
      quantity: item.quantity
    }));

    const amountReceived = isDebt ? Math.min(amountReceivedNum, cartTotal) : amountReceivedNum;

    const newSale: Sale = {
      id: `sale-${Date.now().toString().slice(-4)}`,
      items: saleItems,
      total: cartTotal,
      amountReceived: amountReceived,
      changeGiven: changeDue,
      sellerId: currentSeller.id,
      sellerName: currentSeller.name,
      createdAt: new Date().toISOString(),
      isDebt: isDebt,
      debtorName: isDebt ? debtorName.trim() : undefined,
      debtorPhone: isDebt ? debtorPhone.trim() : undefined,
      debtStatus: isDebt ? (amountReceived === 0 ? 'unpaid' : 'partial') : undefined,
      debtPaidAmount: isDebt ? amountReceived : undefined,
      synced: false // Saved offline first
    };

    // Callback to App level
    onAddSale(newSale);
    // Deduct stock levels in local state
    onUpdateStocks(cart.map(i => ({ productId: i.product.id, quantity: i.quantity })));

    setLastCompletedSale(newSale);
    setShowReceipt(true);
    clearCart();
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-US').format(amount) + '/=';
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Mobile view sub-tabs switcher */}
      <div className="sticky top-1.5 z-30 flex lg:hidden items-center justify-between p-1.5 bg-[#e0e5ec]/90 backdrop-blur-md rounded-2xl shadow-md border border-white/40 mb-2 transition-all">
        <button
          onClick={() => setMobileActiveTab('products')}
          className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
            mobileActiveTab === 'products'
              ? 'bg-white text-indigo-700 shadow-sm font-black'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <span>Bidhaa ({filteredProducts.length})</span>
        </button>
        <button
          onClick={() => setMobileActiveTab('cart')}
          className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 relative ${
            mobileActiveTab === 'cart'
              ? 'bg-white text-indigo-700 shadow-sm font-black'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <span>Kikapu cha Mauzo</span>
          {cart.length > 0 ? (
            <span className="bg-rose-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-sm">
              {cart.reduce((sum, item) => sum + item.quantity, 0)}
            </span>
          ) : (
            <span className="text-slate-400 font-normal">(0)</span>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Search, Categories, & Products Area */}
        <div className={`lg:col-span-8 flex flex-col gap-6 ${mobileActiveTab === 'products' ? 'flex' : 'hidden lg:flex'}`}>
        
        {/* Search header container styled clean and simple */}
        <div className="clay-card p-6 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <span className="absolute inset-y-0 left-4 flex items-center text-slate-400">
              <Search size={18} />
            </span>
            <input
              id="product-search"
              type="text"
              placeholder="Tafuta Bidhaa au kundi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="clay-input pl-11 pr-4 py-3 w-full"
            />
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 bg-slate-200/50 px-4 py-2 rounded-2xl">
            <Coins size={14} className="text-amber-500" />
            <span>Keshia: <strong className="text-slate-800">{currentSeller.name}</strong></span>
          </div>
        </div>

        {/* Categories Scroller */}
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          <button
            id="cat-all"
            onClick={() => setSelectedCategory(null)}
            className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
              selectedCategory === null 
                ? 'clay-btn-indigo text-indigo-700 bg-indigo-50 border border-indigo-200' 
                : 'clay-btn text-slate-600 bg-slate-100 hover:bg-slate-50'
            }`}
          >
            Zote (All)
          </button>
          {categories.map((cat, index) => (
            <button
              id={`cat-${index}`}
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-5 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                selectedCategory === cat 
                  ? 'clay-btn-indigo text-indigo-700 bg-indigo-50 border border-indigo-200' 
                  : 'clay-btn text-slate-600 bg-slate-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredProducts.map(product => {
            const isOutOfStock = product.stock <= 0;
            const cartItem = cart.find(item => item.product.id === product.id);
            const qtyInCart = cartItem ? cartItem.quantity : 0;
            const remainingStock = product.stock - qtyInCart;

            return (
              <div 
                id={`prod-card-${product.id}`}
                key={product.id}
                onClick={() => remainingStock > 0 && addToCart(product)}
                className={`clay-card p-4.5 flex flex-col justify-between transition-all cursor-pointer select-none group border border-transparent ${
                  isOutOfStock 
                    ? 'opacity-60 cursor-not-allowed bg-slate-100/80' 
                    : 'hover:border-indigo-200 active:scale-95'
                }`}
              >
                <div>
                  {/* Visual Image Container with good spacing */}
                  <div className="w-full h-36 bg-gradient-to-b from-slate-50 to-slate-100 rounded-2xl flex items-center justify-center overflow-hidden mb-4 relative border border-slate-200/40 shadow-inner group-hover:scale-[1.01] transition-transform duration-200">
                    <span className={`absolute top-2.5 right-2.5 z-10 text-[10px] font-mono font-bold px-2.5 py-1 rounded-full shadow-sm backdrop-blur-md border ${
                      remainingStock > 10 
                        ? 'bg-white/90 text-slate-700 border-slate-200' 
                        : remainingStock > 0 
                        ? 'bg-amber-50/90 text-amber-700 border-amber-200/30' 
                        : 'bg-rose-50/90 text-rose-700 border-rose-200/30'
                    }`}>
                      {remainingStock > 0 ? `${remainingStock} Stock` : 'Mwisho (Out)'}
                    </span>

                    <div className="w-20 h-20 flex items-center justify-center transform group-hover:scale-105 transition-transform duration-300">
                      <ProductIcon type={product.image} className="w-10 h-10" size={40} fullSize />
                    </div>
                  </div>

                  {/* Words (Category and Name) details */}
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-600/85 bg-indigo-50/60 px-2 py-0.5 rounded-md mb-1.5 inline-block">
                    {product.category}
                  </span>
                  
                  <h3 className="font-sans font-bold text-slate-800 text-sm sm:text-base mb-3 leading-snug group-hover:text-indigo-600 transition-colors">
                    {product.name}
                  </h3>
                </div>

                {/* Price and Add Button Container */}
                <div className="flex items-center justify-between mt-1 pt-2.5 border-t border-slate-100">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Bei / Price</span>
                    <span className="font-mono text-base sm:text-lg font-black text-slate-800">
                      {formatMoney(product.price)}
                    </span>
                  </div>

                  <button
                    id={`add-btn-${product.id}`}
                    disabled={remainingStock <= 0}
                    className={`p-2.5 rounded-2xl flex items-center justify-center transition-all ${
                      remainingStock > 0 
                        ? 'clay-btn-indigo text-indigo-600 hover:scale-105 shadow-sm' 
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-inner'
                    }`}
                  >
                    {qtyInCart > 0 ? (
                      <span className="text-xs font-black bg-indigo-600 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-md">
                        {qtyInCart}
                      </span>
                    ) : (
                      <Plus size={16} />
                    )}
                  </button>
                </div>
              </div>
            );
          })}

          {filteredProducts.length === 0 && (
            <div className="col-span-full clay-card p-12 text-center flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
              <ShoppingCart size={40} className="mb-3 text-slate-300 stroke-[1.5]" />
              <p className="font-medium text-slate-500">Mbona hakuna bidhaa hapa?</p>
              <p className="text-xs text-slate-400 max-w-xs mt-1">
                Tafuta jina lingine au ongeza bidhaa mpya kwenye paneli ya Boss.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Cart & Checkout Panel Column */}
      <div className={`lg:col-span-4 sticky top-6 flex flex-col gap-6 ${mobileActiveTab === 'cart' ? 'flex' : 'hidden lg:flex'}`}>
        
        {checkoutStep === 'cart' ? (
          /* CART PREVIEW PANEL */
          <div className="clay-card p-6 flex flex-col max-h-[750px]">
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-200">
              <h2 className="font-sans font-bold text-slate-800 text-lg flex items-center gap-2">
                <ShoppingCart className="text-indigo-600" size={20} />
                <span>Kikapu cha Mauzo</span>
              </h2>
              {cart.length > 0 && (
                <button 
                  id="clear-cart-btn"
                  onClick={clearCart}
                  className="p-2 text-slate-400 hover:text-rose-600 bg-slate-100 rounded-full hover:shadow-inner transition-all"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-4 max-h-[380px] pb-36 no-scrollbar">
              {cart.map(item => (
                <div 
                  id={`cart-item-${item.product.id}`}
                  key={item.product.id} 
                  className="flex items-center justify-between p-3.5 bg-slate-50/60 rounded-2xl border border-slate-100 shadow-sm"
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <h4 className="text-sm font-medium text-slate-800 truncate">{item.product.name}</h4>
                    <p className="text-xs font-mono text-slate-400">{formatMoney(item.product.price)} × {item.quantity}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      id={`cart-minus-${item.product.id}`}
                      onClick={() => updateQuantity(item.product.id, -1)}
                      className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-300 shadow-inner transition-all hover:scale-105 active:scale-95 flex-shrink-0"
                    >
                      <Minus size={13} />
                    </button>
                    
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={item.quantity === 0 ? '' : item.quantity}
                      onChange={(e) => handleQuantityInputChange(item.product.id, e.target.value)}
                      onBlur={() => handleQuantityInputBlur(item.product.id)}
                      className="font-mono text-sm font-bold text-slate-800 w-11 h-8 text-center bg-slate-100 rounded-lg shadow-inner border border-slate-300/20 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all"
                    />

                    <button
                      id={`cart-plus-${item.product.id}`}
                      onClick={() => updateQuantity(item.product.id, 1)}
                      className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-300 shadow-inner transition-all hover:scale-105 active:scale-95 flex-shrink-0"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              ))}

              {cart.length === 0 && (
                <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-3 text-slate-300">
                    <ShoppingCart size={24} />
                  </div>
                  <p className="text-sm font-medium text-slate-500">Kikapu kipo wazi</p>
                  <p className="text-xs text-slate-400 mt-1">Bonyeza bidhaa kushoto kuiongeza.</p>
                </div>
              )}
            </div>

            {/* Sum details */}
            <div className="mt-4 pt-4 border-t border-slate-200 bg-slate-55/60 space-y-3">
              <div className="flex justify-between text-sm text-slate-500 font-medium">
                <span>Jumla Ndogo (Subtotal)</span>
                <span className="font-mono">{formatMoney(cartSubtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-500 font-medium">
                <span>Kodi (VAT 0%)</span>
                <span className="font-mono">0/=</span>
              </div>
              
              <div className="flex justify-between items-center pt-2.5 border-t border-dashed border-slate-200">
                <span className="font-bold text-slate-800">Jumla Kuu (Total)</span>
                <span className="font-mono text-xl font-bold text-indigo-600">{formatMoney(cartTotal)}</span>
              </div>

              <button
                id="checkout-btn"
                disabled={cart.length === 0}
                onClick={() => setCheckoutStep('calculator')}
                className={`w-full py-4 rounded-3xl font-bold flex items-center justify-center gap-2 transition-all ${
                  cart.length > 0
                    ? 'clay-btn-indigo text-indigo-700 text-base shadow-md cursor-pointer hover:scale-[1.01]'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-inner'
                }`}
              >
                <CreditCard size={18} />
                Inayofuata (Checkout)
              </button>
            </div>
          </div>
        ) : (
          /* CALCULATOR POS / BILLING PANEL */
          <div className="clay-card p-6 flex flex-col">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <button 
                  id="back-to-cart"
                  onClick={() => setCheckoutStep('cart')}
                  className="p-1 px-3 text-slate-500 bg-slate-200 hover:bg-slate-300 text-xs font-bold rounded-xl transition-all"
                >
                  ← Kikapu
                </button>
                <h3 className="font-sans font-bold text-slate-800">Checkout POS</h3>
              </div>
              <span className="text-xs font-mono font-medium px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-full">
                {cart.length} bidhaa
              </span>
            </div>

            {/* Total Indicator */}
            <div className="clay-concave p-4 rounded-2xl mb-4 text-center min-h-[84px] flex flex-col justify-center">
              <span className="text-xs text-slate-500 font-semibold block mb-0.5 uppercase tracking-wider">Jumla ya Malipo</span>
              <span className={`font-mono font-black text-slate-800 transition-all duration-150 ${getAdaptiveFontSizeClass(formatMoney(cartTotal))}`}>
                {formatMoney(cartTotal)}
              </span>
            </div>

            {/* DEBT TRACKER SECTION */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                  <input
                    id="is-debt-checkbox"
                    type="checkbox"
                    checked={isDebt}
                    onChange={(e) => {
                      setIsDebt(e.target.checked);
                      if (!e.target.checked) {
                        setDebtorName('');
                        setDebtorPhone('');
                      }
                    }}
                    className="w-4.5 h-4.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                  />
                  <span>Ni Deni? (Is this a Debt?)</span>
                </label>
                <span className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full ${
                  isDebt ? 'bg-red-100 text-red-600 border border-red-200 animate-pulse' : 'bg-slate-200 text-slate-500'
                }`}>
                  {isDebt ? 'Deni / Loan' : 'Kesh / Cash'}
                </span>
              </div>

              {isDebt && (
                <div className="space-y-2 animate-fadeIn">
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                      <User size={14} />
                    </span>
                    <input
                      id="debtor-name-input"
                      type="text"
                      placeholder="Jina la Mteja (Required)"
                      required
                      value={debtorName}
                      onChange={(e) => setDebtorName(e.target.value)}
                      className="clay-input pl-9 pr-3 py-2 w-full text-xs"
                    />
                  </div>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                      <Phone size={14} />
                    </span>
                    <input
                      id="debtor-phone-input"
                      type="text"
                      placeholder="Simu ya Mteja (Optional)"
                      value={debtorPhone}
                      onChange={(e) => setDebtorPhone(e.target.value)}
                      className="clay-input pl-9 pr-3 py-2 w-full text-xs"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Giant Calculator Output */}
            <div className="clay-concave p-5 rounded-3xl mb-4 flex flex-col gap-1 items-center justify-center min-h-[140px]">
              {isDebt ? (
                <>
                  <span className="text-xs text-rose-500 font-bold tracking-wider block uppercase">Deni Lililosalia (Remaining as Debt)</span>
                  <span className={`font-mono text-rose-600 my-3 text-center transition-all duration-150 break-all ${getGiantAdaptiveFontSizeClass(formatMoney(debtBalanceRemaining))}`}>
                    {formatMoney(debtBalanceRemaining)}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium text-center">
                    Weka jumla ya kiasi kilichopokelewa hivi sasa ili kukokotoa deni lililosalia.
                  </span>
                </>
              ) : (
                <>
                  <span className="text-xs text-emerald-600 font-bold tracking-wider block uppercase">Chenji ya Kurudisha (Change Return)</span>
                  <span className={`font-mono text-emerald-600 my-3 text-center transition-all duration-150 break-all ${getGiantAdaptiveFontSizeClass(formatMoney(changeDue))}`}>
                    {formatMoney(changeDue)}
                  </span>
                  {amountReceivedNum < cartTotal && amountReceivedNum > 0 && (
                    <span className="text-xs text-rose-500 font-bold animate-pulse">
                      Kiasi kidogo kuliko bei! Punguza bei au weka deni.
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Amount Received Input */}
            <div className="mb-4">
              <label className="text-xs text-slate-500 font-semibold mb-1 block">
                {isDebt ? 'Kiasi Kilichopokelewa sasa (Money Received)' : 'Kiasi Kilichopokelewa (Cash Received)'}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-4 flex items-center text-slate-500 font-mono text-sm font-semibold">TSh</span>
                <input
                  id="amount-received-display"
                  type="text"
                  readOnly
                  placeholder="0"
                  value={amountReceivedInput ? parseFloat(amountReceivedInput).toLocaleString() : ''}
                  className={`clay-input pl-12 pr-10 py-3 w-full text-right font-mono font-bold text-slate-800 transition-all duration-150 ${getInputAdaptiveFontSizeClass(amountReceivedInput ? parseFloat(amountReceivedInput).toLocaleString() : '0')}`}
                />
                {amountReceivedInput && (
                  <button 
                    onClick={() => setAmountReceivedInput('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold font-mono"
                  >
                    CLR
                  </button>
                )}
              </div>
            </div>

            {/* Quick Cash Presets */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[1000, 2000, 5000, 10000].map(cash => (
                <button
                  id={`cash-preset-${cash}`}
                  key={cash}
                  onClick={() => applyCashPreset(cash)}
                  className="clay-btn py-1.5 px-1 text-[11px] font-mono font-bold text-slate-700 bg-slate-200"
                >
                  {cash >= 1000 ? `${cash/1000}k` : cash}
                </button>
              ))}
            </div>

            {/* Hard Calculator Keypad */}
            <div className="grid grid-cols-4 gap-2.5 mb-5 select-none">
              {['7', '8', '9', '+1k'].map(k => (
                <button
                  id={`keypad-${k}`}
                  key={k}
                  onClick={() => k.startsWith('+') ? applyAdditionalCash(1000) : handleKeyPress(k)}
                  className="clay-btn py-3.5 text-center font-mono font-bold text-slate-700 text-base"
                >
                  {k}
                </button>
              ))}
              {['4', '5', '6', '+5k'].map(k => (
                <button
                  id={`keypad-${k}`}
                  key={k}
                  onClick={() => k.startsWith('+') ? applyAdditionalCash(5000) : handleKeyPress(k)}
                  className="clay-btn py-3.5 text-center font-mono font-bold text-slate-700 text-base"
                >
                  {k}
                </button>
              ))}
              {['1', '2', '3', '+10k'].map(k => (
                <button
                  id={`keypad-${k}`}
                  key={k}
                  onClick={() => k.startsWith('+') ? applyAdditionalCash(10000) : handleKeyPress(k)}
                  className="clay-btn py-3.5 text-center font-mono font-bold text-slate-700 text-base"
                >
                  {k}
                </button>
              ))}
              {['0', '00', 'C', '+20k'].map(k => (
                <button
                  id={`keypad-${k}`}
                  key={k}
                  onClick={() => k.startsWith('+') ? applyAdditionalCash(20000) : handleKeyPress(k)}
                  className={`clay-btn py-3.5 text-center font-mono font-bold text-base ${
                    k === 'C' ? 'text-rose-600 bg-rose-50' : 'text-slate-700'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>

            {/* Complete Sale Execution */}
            <button
              id="confirm-checkout-btn"
              onClick={handleConfirmCheckout}
              disabled={!isDebt && amountReceivedNum < cartTotal}
              className={`w-full py-4 rounded-3xl font-bold flex items-center justify-center gap-2 transition-all ${
                (!isDebt && amountReceivedNum < cartTotal) 
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-inner' 
                  : 'clay-btn-emerald text-emerald-800 text-base cursor-pointer shadow-md hover:scale-[1.01]'
              }`}
            >
              <CheckCircle size={18} />
              Kamilisha Mauzo ({isDebt ? 'Deni' : 'Cash'})
            </button>
          </div>
        )}
      </div>

      {/* THERMAL STYLE RECEIPT MODAL */}
      {showReceipt && lastCompletedSale && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div className="clay-card max-w-sm w-full bg-slate-50 p-6 flex flex-col gap-4 animate-scaleUp overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center border-b border-dashed border-slate-300 pb-3">
              <span className="font-mono text-xs text-rose-500 font-bold uppercase tracking-wider">Risiti ya Mauzo</span>
              <button 
                id="close-receipt-btn"
                onClick={() => setShowReceipt(false)}
                className="p-1 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-500 transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Receipt logo */}
            <div className="text-center font-mono py-2">
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest">MAUZO DUKA</h2>
              <p className="text-[10px] text-slate-400">Mashine ya Malipo / POS Terminal</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Tarehe: {new Date(lastCompletedSale.createdAt).toLocaleString()}</p>
              <p className="text-[10px] text-slate-400">Muuzaji: {lastCompletedSale.sellerName}</p>
            </div>

            {/* Receipt Items */}
            <div className="border-t border-b border-dashed border-slate-300 py-3 font-mono text-xs text-slate-700 space-y-2">
              <div className="flex justify-between font-bold text-slate-900 text-[11px]">
                <span>Bidhaa (Item)</span>
                <span>Jumla (Total)</span>
              </div>
              {lastCompletedSale.items.map((item, index) => (
                <div key={index} className="flex justify-between items-start text-[11px]">
                  <span>
                    <div>{item.name}</div>
                    <div className="text-[9px] text-slate-400">
                      {formatMoney(item.price)} × {item.quantity}
                    </div>
                  </span>
                  <span>{formatMoney(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            {/* Total Block */}
            <div className="font-mono text-xs text-slate-700 space-y-1.5 pt-1">
              <div className="flex justify-between text-slate-500">
                <span>Jumla ya Bidhaa</span>
                <span>{lastCompletedSale.items.reduce((sum, item) => sum + item.quantity, 0)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 text-sm">
                <span>JUMLA KUU</span>
                <span>{formatMoney(lastCompletedSale.total)}</span>
              </div>
              
              <div className="h-0.5 border-t border-dashed border-slate-300 my-2"></div>

              <div className="flex justify-between text-slate-600">
                <span>Kimelipwa (Received)</span>
                <span>{formatMoney(lastCompletedSale.amountReceived)}</span>
              </div>

              {lastCompletedSale.isDebt ? (
                <>
                  <div className="flex justify-between text-red-600 font-bold">
                    <span>Mteja wa Deni</span>
                    <span>{lastCompletedSale.debtorName}</span>
                  </div>
                  {lastCompletedSale.debtorPhone && (
                    <div className="flex justify-between text-slate-500 text-[10px]">
                      <span>Mawasiliano</span>
                      <span>{lastCompletedSale.debtorPhone}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-red-700">
                    <span>Deni Lililosalia</span>
                    <span>{formatMoney(lastCompletedSale.total - lastCompletedSale.amountReceived)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-slate-600">
                  <span>Chenji (Change Given)</span>
                  <span className="font-bold text-emerald-600">{formatMoney(lastCompletedSale.changeGiven)}</span>
                </div>
              )}
            </div>

            <div className="text-center font-mono text-[9px] text-slate-400 pt-3 border-t border-dashed border-slate-300">
              <p className="font-medium text-slate-500 text-xs text-center mb-1">Ahsante kwa kufanya biashara na sisi!</p>
              <p>Hifadhi ya mauzo yakamilishwa nje ya mtandao (Offline Saved).</p>
              <p>Programu ya Mauzo Smart POS v2.0</p>
            </div>

            <button
              id="receipt-done-btn"
              onClick={() => setShowReceipt(false)}
              className="mt-2 w-full py-3 rounded-2xl font-bold clay-btn-indigo text-indigo-700"
            >
              Ufuta (Ok, Done)
            </button>
          </div>
        </div>
      )}

      {/* Floating Top-Right Search Lens for Mobile/Tablet */}
      {showFloatingControls && (
        <div className="fixed top-3.5 right-3.5 z-50 flex items-center gap-2 lg:hidden">
          {floatingSearchActive ? (
            <div className="flex items-center gap-2 bg-[#e0e5ec]/95 backdrop-blur-lg px-3 py-1.5 rounded-2xl shadow-lg border border-white/60 animate-in slide-in-from-right duration-200">
              <input
                type="text"
                placeholder="Tafuta bidhaa hapa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-xs font-sans w-32 sm:w-44 text-slate-800"
                autoFocus
              />
              <button 
                onClick={() => { 
                  setFloatingSearchActive(false); 
                  setSearchQuery(''); 
                }}
                className="p-1 hover:bg-slate-300/40 rounded-lg transition-all"
              >
                <X size={14} className="text-slate-500 hover:text-slate-800" />
              </button>
            </div>
          ) : null}
          <button
            onClick={() => {
              setFloatingSearchActive(!floatingSearchActive);
              setMobileActiveTab('products');
            }}
            className={`w-11 h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg active:scale-95 transition-all flex items-center justify-center ${
              floatingSearchActive ? 'bg-indigo-700 ring-2 ring-indigo-300' : ''
            }`}
          >
            <Search size={18} />
          </button>
        </div>
      )}

      {/* Floating Bottom-Right Cart FAB for Phone and Tablet */}
      {mobileActiveTab === 'products' && (
        <button
          onClick={() => setMobileActiveTab('cart')}
          className="fixed bottom-6 right-6 z-40 lg:hidden flex items-center justify-center w-14 h-14 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all border border-emerald-400/20"
          id="floating-cart-fab"
        >
          <div className="relative">
            <ShoppingCart size={24} />
            {cart.length > 0 && (
              <span className="absolute -top-3.5 -right-3.5 bg-rose-500 text-white text-[11px] font-black min-w-[20px] h-5 rounded-full px-1.5 flex items-center justify-center shadow-md animate-bounce">
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            )}
          </div>
        </button>
      )}
    </div>
  </div>
  );
}
