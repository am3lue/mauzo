import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShoppingBag, 
  TrendingUp, 
  ChevronRight, 
  Users, 
  LogOut, 
  Coins, 
  HelpCircle,
  Database,
  Cloud,
  CloudLightning,
  RefreshCw,
  Sparkles,
  Layers,
  Activity,
  Smile,
  ShieldCheck,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Product, Sale, User } from './types';
import { DEFAULT_PRODUCTS, DEFAULT_SALES } from './initialData';
import SellerView from './components/SellerView';
import BossView from './components/BossView';
import LoginScreen from './components/LoginScreen';

export default function App() {
  // List of sellers and bosses with their PINs, syncs automatically with Turso database!
  const [sellers, setSellers] = useState<User[]>(() => {
    const saved = localStorage.getItem('mauzo_sellers');
    return saved ? JSON.parse(saved) : [
      { id: 'user-seller-1', name: 'Amisi Mapesa', role: 'seller', pin: '1111' },
      { id: 'user-seller-2', name: 'Farida Omari', role: 'seller', pin: '2222' },
      { id: 'boss', name: 'Boss Mkuu', role: 'boss', pin: '9999' }
    ];
  });

  const onlySellers = useMemo(() => sellers.filter(u => u.role === 'seller'), [sellers]);

  // Sync status state
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncSuccessAlert, setShowSyncSuccessAlert] = useState(false);
  const [showCloudPanel, setShowCloudPanel] = useState(false);
  const [activeSyncError, setActiveSyncError] = useState<string | null>(null);
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(() => {
    return localStorage.getItem('mauzo_last_synced_time');
  });

  // Unique Cloud Sync Code (allows syncing different devices together)
  const [workspaceCode, setWorkspaceCode] = useState<string>(() => {
    const saved = localStorage.getItem('mauzo_workspace_code');
    if (saved) return saved.toUpperCase();
    const randCode = 'MZO-' + Math.floor(1000 + Math.random() * 9000);
    localStorage.setItem('mauzo_workspace_code', randCode);
    return randCode;
  });

  // Unique Client ID for synchronizing lock controls across devices
  const [clientId] = useState<string>(() => {
    let id = localStorage.getItem('mauzo_sync_client_id');
    if (!id) {
      id = 'MZO-CLI-' + Math.floor(10000 + Math.random() * 90000) + '-' + Date.now().toString().slice(-4);
      localStorage.setItem('mauzo_sync_client_id', id);
    }
    return id;
  });

  // States with LocalStorage Persistence
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('mauzo_products');
    return saved ? JSON.parse(saved) : DEFAULT_PRODUCTS;
  });

  const [sales, setSales] = useState<Sale[]>(() => {
    const saved = localStorage.getItem('mauzo_sales');
    return saved ? JSON.parse(saved) : DEFAULT_SALES;
  });

  const [currentRole, setCurrentRole] = useState<'seller' | 'boss'>(() => {
    const saved = localStorage.getItem('mauzo_role');
    return (saved === 'boss' || saved === 'seller') ? saved : 'seller';
  });

  const [currentSellerIndex, setCurrentSellerIndex] = useState<number>(0);

  // Authentication states for Cashier and Boss sides
  const [authenticatedSellerId, setAuthenticatedSellerId] = useState<string | null>(() => {
    return localStorage.getItem('mauzo_auth_seller_id');
  });

  const [isBossAuthenticated, setIsBossAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('mauzo_auth_boss') === 'true';
  });

  const [sessionId, setSessionId] = useState<string | null>(() => {
    return localStorage.getItem('mauzo_session_id');
  });

  // Sync session ID to localStorage
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem('mauzo_session_id', sessionId);
    } else {
      localStorage.removeItem('mauzo_session_id');
    }
  }, [sessionId]);

  // Periodically verify session status directly with server database
  useEffect(() => {
    if (!sessionId) return;

    let isMounted = true;
    const verifySession = async () => {
      try {
        const res = await fetch(`/api/auth/session/${sessionId}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            if (!data.isValid) {
              console.warn("Session is invalid or expired. Logging out...", data.message);
              setAuthenticatedSellerId(null);
              setIsBossAuthenticated(false);
              setSessionId(null);
            }
          }
        }
      } catch (err) {
        console.error("Error verifying database session status:", err);
      }
    };

    verifySession();

    // Check session status periodically every 30 seconds for real-time multi-device synchronization
    const interval = setInterval(verifySession, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [sessionId]);

  // Save changes to localStorage on any state modification
  useEffect(() => {
    localStorage.setItem('mauzo_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('mauzo_sales', JSON.stringify(sales));
  }, [sales]);

  useEffect(() => {
    localStorage.setItem('mauzo_role', currentRole);
  }, [currentRole]);

  useEffect(() => {
    if (authenticatedSellerId) {
      localStorage.setItem('mauzo_auth_seller_id', authenticatedSellerId);
    } else {
      localStorage.removeItem('mauzo_auth_seller_id');
    }
  }, [authenticatedSellerId]);

  useEffect(() => {
    localStorage.setItem('mauzo_auth_boss', String(isBossAuthenticated));
  }, [isBossAuthenticated]);

  useEffect(() => {
    localStorage.setItem('mauzo_sellers', JSON.stringify(sellers));
  }, [sellers]);

  const activeSeller = onlySellers[currentSellerIndex] || onlySellers[0] || { id: 'user-seller-1', name: 'Amisi Mapesa', role: 'seller', pin: '1111' };

  const handleRoleChange = (role: 'seller' | 'boss') => {
    // Clear active auth status for safety to require a fresh secure sign-in 
    if (role === 'boss') {
      setIsBossAuthenticated(false);
    } else {
      setAuthenticatedSellerId(null);
    }
    setCurrentRole(role);
  };

  const handleSellerLoginSuccess = async (userId: string) => {
    setAuthenticatedSellerId(userId);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeCode: workspaceCode,
          userId,
          deviceName: navigator.userAgent
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.session) {
          setSessionId(data.session.sessionId);
        }
      }
    } catch (err) {
      console.error('Failed to create login session in database:', err);
    }
  };

  const handleBossLoginSuccess = async () => {
    setIsBossAuthenticated(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeCode: workspaceCode,
          userId: 'boss',
          deviceName: navigator.userAgent
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.session) {
          setSessionId(data.session.sessionId);
        }
      }
    } catch (err) {
      console.error('Failed to create login session in database:', err);
    }
  };

  const handleLogout = async () => {
    if (sessionId) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        });
      } catch (err) {
        console.error('Failed to logout session in database:', err);
      }
    }
    setAuthenticatedSellerId(null);
    setIsBossAuthenticated(false);
    setSessionId(null);
  };

  // Calculations
  const unsyncedCount = sales.filter(s => !s.synced).length;

  // Background Auto-sync trigger for all state modifications
  const triggerAutoSync = () => {
    setTimeout(() => {
      handleSyncDatabases().catch(err => console.error("Auto-sync error in background:", err));
    }, 400); // 400ms debounce delay to allow React state updates to render and settle
  };

  // Global Handlers
  const handleAddSale = (newSale: Sale) => {
    const saleWithTime = { ...newSale, updatedAt: new Date().toISOString() };
    setSales(prev => [saleWithTime, ...prev]);
    triggerAutoSync();
  };

  const handleUpdateStocks = (itemsToDeduct: { productId: string; quantity: number }[]) => {
    setProducts(prev => {
      return prev.map(p => {
        const item = itemsToDeduct.find(i => i.productId === p.id);
        if (item) {
          return {
            ...p,
            stock: Math.max(0, p.stock - item.quantity),
            updatedAt: new Date().toISOString()
          };
        }
        return p;
      });
    });
    triggerAutoSync();
  };

  const handleAddProduct = (newProduct: Product) => {
    const fresh = { ...newProduct, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setProducts(prev => [fresh, ...prev]);
    triggerAutoSync();
  };

  const handleUpdateProduct = (updatedProduct: Product) => {
    const updated = { ...updatedProduct, updatedAt: new Date().toISOString() };
    setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
    triggerAutoSync();
  };

  const handleDeleteProduct = (productId: string) => {
    setProducts(prev => prev.filter(p => p.id !== productId));
    triggerAutoSync();
  };

  const handleUpdateSaleDebt = (saleId: string, paidAmountToAdd: number) => {
    setSales(prev => {
      return prev.map(sale => {
        if (sale.id === saleId && sale.isDebt) {
          const currentPaid = sale.debtPaidAmount || 0;
          const newPaid = currentPaid + paidAmountToAdd;
          const unpaidRemainder = Math.max(0, sale.total - newPaid);
          
          return {
            ...sale,
            debtPaidAmount: newPaid,
            amountReceived: newPaid,
            debtStatus: unpaidRemainder === 0 ? 'paid' : 'partial',
            updatedAt: new Date().toISOString()
          };
        }
        return sale;
      });
    });
    triggerAutoSync();
  };

  const handleUpdateSellers = (updatedSellers: User[]) => {
    setSellers(updatedSellers);
    triggerAutoSync();
  };

  // Real Cloud Database Sync Engine (REST KeyValue cloud storage)
  const handleSyncDatabases = async () => {
    setIsSyncing(true);
    setActiveSyncError(null);
    
    let lockAcquired = false;
    let formattedCode = '';

    try {
      formattedCode = workspaceCode.replace(/[^a-zA-Z0-9-]/g, '').trim().toUpperCase();
      if (!formattedCode) {
        throw new Error("Weka Code halali ya duka.");
      }

      // 1. Acquire Distributed Sync Lock from the backend
      const lockRes = await fetch(`/api/sync/${formattedCode}/lock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clientId })
      });

      if (!lockRes.ok) {
        throw new Error("Mfumo wa kuzuia conflicts haupatikani. Jaribu tena.");
      }

      const lockData = await lockRes.json();
      if (!lockData.success) {
        throw new Error(lockData.message || "Duka lipo busy kwa sasa. Kifaa kingine kinafanya mabadiliko.");
      }

      lockAcquired = true;
      
      const salesUrl = `/api/sync/${formattedCode}/sales`;
      const productsUrl = `/api/sync/${formattedCode}/products`;
      const usersUrl = `/api/sync/${formattedCode}/users`;
      
      // 2. Fetch Cloud Sales (Handle empty bucket gracefully)
      let cloudSales: Sale[] = [];
      try {
        const res = await fetch(salesUrl);
        if (res.ok) {
          const text = await res.text();
          if (text && text.trim()) {
            cloudSales = JSON.parse(text);
          }
        }
      } catch (e) {
        console.warn("Cloud sales bucket initialized as empty or first setup", e);
      }
      
      // 3. Fetch Cloud Products (Handle empty bucket gracefully)
      let cloudProducts: Product[] = [];
      try {
        const res = await fetch(productsUrl);
        if (res.ok) {
          const text = await res.text();
          if (text && text.trim()) {
            cloudProducts = JSON.parse(text);
          }
        }
      } catch (e) {
        console.warn("Cloud products bucket initialized as empty or first setup", e);
      }

      // 3.5. Fetch Cloud Users (Handle empty bucket gracefully)
      let cloudUsers: User[] = [];
      try {
        const res = await fetch(usersUrl);
        if (res.ok) {
          const text = await res.text();
          if (text && text.trim()) {
            cloudUsers = JSON.parse(text);
          }
        }
      } catch (e) {
        console.warn("Cloud users bucket initialized as empty or first setup", e);
      }

      // 4. Merging Sales, Products, and Users
      let finalSalesList: Sale[] = [];
      let finalProductsList: Product[] = [];
      let finalUsersList: User[] = [];

      const isCloudPopulated = cloudProducts.length > 0 || cloudSales.length > 0 || cloudUsers.length > 0;
      if (!lastSyncedTime && isCloudPopulated) {
        // If the client has never synced before and there is existing database data in the cloud,
        // we directly adopt the cloud database records to override local dynamic startup timestamps.
        finalSalesList = cloudSales.map(s => ({ ...s, synced: true }));
        finalProductsList = cloudProducts;
        finalUsersList = cloudUsers.length > 0 ? cloudUsers : sellers;
      } else {
        // Normal synchronization merge using timestamps
        const mergedSalesMap = new Map<string, Sale>();
        cloudSales.forEach(s => mergedSalesMap.set(s.id, s));
        sales.forEach(ls => {
          const cs = mergedSalesMap.get(ls.id);
          if (!cs) {
            mergedSalesMap.set(ls.id, ls);
          } else {
            const lsTime = ls.updatedAt ? Date.parse(ls.updatedAt) : Date.parse(ls.createdAt);
            const csTime = cs.updatedAt ? Date.parse(cs.updatedAt) : Date.parse(cs.createdAt);
            if (lsTime > csTime) {
              mergedSalesMap.set(ls.id, ls);
            }
          }
        });
        finalSalesList = Array.from(mergedSalesMap.values()).map(s => ({ ...s, synced: true }));

        const mergedProductsMap = new Map<string, Product>();
        cloudProducts.forEach(p => mergedProductsMap.set(p.id, p));
        products.forEach(lp => {
          const cp = mergedProductsMap.get(lp.id);
          if (!cp) {
            mergedProductsMap.set(lp.id, lp);
          } else {
            const lpTime = lp.updatedAt ? Date.parse(lp.updatedAt) : (lp.createdAt ? Date.parse(lp.createdAt) : 0);
            const cpTime = cp.updatedAt ? Date.parse(cp.updatedAt) : (cp.createdAt ? Date.parse(cp.createdAt) : 0);
            if (lpTime > cpTime) {
              mergedProductsMap.set(lp.id, lp);
            }
          }
        });
        finalProductsList = Array.from(mergedProductsMap.values());

        const mergedUsersMap = new Map<string, User>();
        cloudUsers.forEach(u => mergedUsersMap.set(u.id, u));
        sellers.forEach(lu => {
          // Local state has latest credentials designated by our active Boss dashboard edits
          mergedUsersMap.set(lu.id, lu);
        });
        finalUsersList = Array.from(mergedUsersMap.values());
      }

      // 6. Upload Merged Data to Cloud
      const salesUploadRes = await fetch(salesUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalSalesList)
      });
      
      if (!salesUploadRes.ok) {
        throw new Error("Imeshindwa kupakia data za mauzo kwenye wingu.");
      }
      
      const productsUploadRes = await fetch(productsUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalProductsList)
      });
      
      if (!productsUploadRes.ok) {
        throw new Error("Imeshindwa kupakia data za stoki kwenye wingu.");
      }

      const usersUploadRes = await fetch(usersUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalUsersList)
      });
      
      if (!usersUploadRes.ok) {
        throw new Error("Imeshindwa kupakia data za watumiaji kwenye wingu.");
      }

      // 7. Update local states
      setSales(finalSalesList);
      setProducts(finalProductsList);
      setSellers(finalUsersList);
      
      const nowStr = new Date().toLocaleString();
      setLastSyncedTime(nowStr);
      localStorage.setItem('mauzo_last_synced_time', nowStr);
      
      setShowSyncSuccessAlert(true);
      setTimeout(() => {
        setShowSyncSuccessAlert(false);
      }, 5000);
      
    } catch (error: any) {
      console.error("Sync Error: ", error);
      setActiveSyncError(error?.message || "Mawasiliano na wingu yalikatika. Jaribu tena.");
    } finally {
      // 8. Safely unlock session to free slot for other devices
      if (lockAcquired && formattedCode) {
        try {
          await fetch(`/api/sync/${formattedCode}/unlock`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ clientId })
          });
        } catch (unlockErr) {
          console.error("Taarifa ya unlock haikutumwa:", unlockErr);
        }
      }
      setIsSyncing(false);
    }
  };

  // Auto-sync trigger on initial mount & whenever workspaceCode changes to keep database updated
  useEffect(() => {
    if (workspaceCode) {
      const delaySync = setTimeout(() => {
        handleSyncDatabases();
      }, 500); // 500ms delay to ensure DOM is ready and state is bound
      return () => clearTimeout(delaySync);
    }
  }, [workspaceCode]);

  return (
    <div className="min-h-screen bg-[#e0e5ec] relative overflow-hidden py-4 sm:py-8 px-2 sm:px-4 flex flex-col font-sans select-none selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* Playful Floating Ambient Orbs for Claymorph Depth */}
      <div className="absolute top-12 left-10 w-96 h-96 bg-indigo-200/40 rounded-full filter blur-[100px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-20 right-10 w-[450px] h-[450px] bg-sky-200/45 rounded-full filter blur-[120px] pointer-events-none"></div>
      <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-rose-200/30 rounded-full filter blur-[90px] pointer-events-none"></div>

      {/* Main Container */}
      <div className="max-w-7xl w-full mx-auto flex-1 flex flex-col relative z-10 clay-card overflow-hidden p-0 bg-[#f1f3f6] border border-white/60 shadow-xl rounded-[2.5rem]">
        
        {/* APP CONCAVE RAILHEADER */}
        <header className="p-4 sm:p-5 flex flex-row items-center justify-between gap-3 sm:gap-5 border-b border-slate-200 bg-slate-100/50">
          
          {/* Logo & Brand Details */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-xl hover:scale-105 active:scale-95 transition-all flex-shrink-0">
              <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="font-sans font-black text-lg sm:text-2xl text-slate-800 tracking-tight">Mauzo</h1>
                <span className="text-[9px] sm:text-[10px] font-mono bg-indigo-100 text-indigo-700 px-1.5 sm:px-2 py-0.5 rounded-full font-bold flex-shrink-0">SMART POS</span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium font-sans truncate leading-normal">
                Mauzo Offline-First Retail Cashier & Debt Management
              </p>
            </div>
          </div>

          {/* Controller Switch & Extra Metrics */}
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0 ml-auto justify-end">
            
            {/* Seller Switch Account */}
            {currentRole === 'seller' && authenticatedSellerId !== activeSeller.id && (
              <div className="flex items-center gap-1.5 p-1 bg-slate-200 rounded-2xl shadow-inner border border-slate-300/40">
                {onlySellers.map((sel, idx) => {
                  const isAuthedObj = authenticatedSellerId === sel.id;
                  return (
                    <button
                      id={`btn-seller-select-${idx}`}
                      key={sel.id}
                      onClick={() => {
                        setCurrentSellerIndex(idx);
                        // Force a fresh login prompt and clear active database session when switching active seller accounts
                        handleLogout();
                      }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
                        currentSellerIndex === idx
                          ? 'bg-white shadow-sm text-indigo-700 font-bold'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <span>{sel.name.split(' ')[0]}</span>
                      {isAuthedObj && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}



            {/* Logout/Lock session button if currently authenticated */}
            {((currentRole === 'seller' && authenticatedSellerId === activeSeller.id) || 
              (currentRole === 'boss' && isBossAuthenticated)) && (
              <button
                id="btn-navbar-logout"
                onClick={handleLogout}
                className="py-2.5 px-3.5 sm:px-4 rounded-full text-xs font-bold clay-btn bg-white text-rose-600 border border-slate-300/40 hover:bg-rose-50 flex items-center gap-1.5 sm:gap-2 transition-all active:scale-95 shadow-md flex-shrink-0"
                title="Funga Kipindi / Logout"
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">Funga Kipindi</span>
              </button>
            )}

          </div>

        </header>

        {/* WORKSPACE VIEW ROUTING */}
        <main className="flex-1 flex flex-col p-4 sm:p-6 overflow-x-hidden">
          {currentRole === 'seller' ? (
            authenticatedSellerId === activeSeller.id ? (
              <SellerView 
                products={products}
                sales={sales}
                currentSeller={activeSeller}
                onAddSale={handleAddSale}
                onUpdateStocks={handleUpdateStocks}
              />
            ) : (
              <LoginScreen
                role="seller"
                activeSeller={activeSeller}
                sellers={sellers}
                onLoginSuccess={handleSellerLoginSuccess}
                onChangeRole={(newRole) => setCurrentRole(newRole)}
                currentSellerIndex={currentSellerIndex}
                onSelectSeller={setCurrentSellerIndex}
              />
            )
          ) : (
            isBossAuthenticated ? (
              <BossView 
                products={products}
                sales={sales}
                sellers={sellers}
                onUpdateSellers={handleUpdateSellers}
                onAddProduct={handleAddProduct}
                onUpdateProduct={handleUpdateProduct}
                onDeleteProduct={handleDeleteProduct}
                onUpdateSaleDebt={handleUpdateSaleDebt}
                onSyncSales={handleSyncDatabases}
                isSyncing={isSyncing}
              />
            ) : (
              <LoginScreen
                role="boss"
                activeSeller={activeSeller}
                sellers={sellers}
                onLoginSuccess={handleBossLoginSuccess}
                onChangeRole={(newRole) => setCurrentRole(newRole)}
                currentSellerIndex={currentSellerIndex}
                onSelectSeller={setCurrentSellerIndex}
              />
            )
          )}
        </main>

        {/* PERSURE INFORMATIONAL NOTIFICATION */}
        <footer className="mt-8 text-center border-t border-slate-300/40 pt-4 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 font-mono gap-4">
          <div className="flex items-center gap-2">
            <Activity size={12} className="text-indigo-500 animate-pulse" />
            <span>Mauzo Offline-First Engine (Active): <strong>Room Local Sandbox</strong></span>
          </div>
          <div>
            <span>© 2026 Mauzo App. Swahili Small Shop Duka Optimizer.</span>
          </div>
        </footer>

      </div>
    </div>
  );
}
