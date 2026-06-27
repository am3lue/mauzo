import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  AlertCircle,
  Trash2
} from 'lucide-react';
import { Product, Sale, User } from './types';
import { DEFAULT_PRODUCTS, DEFAULT_SALES } from './initialData';
import SellerView from './components/SellerView';
import BossView from './components/BossView';
import LoginScreen from './components/LoginScreen';

// Fetch with timeout helper to prevent hanging requests
async function fetchWithTimeout(url: string, options: RequestInit & { timeout?: number } = {}): Promise<Response> {
  const { timeout = 10000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

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

  // Loading state for initial Turso data fetch (shows splash while loading)
  const [isTursoLoading, setIsTursoLoading] = useState(() => localStorage.getItem('mauzo_products') === null);

  // Unique Cloud Sync Code (allows syncing different devices together)
  const [workspaceCode, setWorkspaceCode] = useState<string>(() => {
    const saved = localStorage.getItem('mauzo_workspace_code');
    if (saved) return saved.toUpperCase();
    const randCode = 'MZO-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    localStorage.setItem('mauzo_workspace_code', randCode);
    return randCode;
  });

  // Unique Client ID for synchronizing lock controls across devices
  const [clientId] = useState<string>(() => {
    let id = localStorage.getItem('mauzo_sync_client_id');
    if (!id) {
      id = 'MZO-CLI-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now();
      localStorage.setItem('mauzo_sync_client_id', id);
    }
    return id;
  });

  // States with LocalStorage Persistence (used as offline fallback cache)
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

  const productsRef = useRef(products);
  productsRef.current = products;
  const salesRef = useRef(sales);
  salesRef.current = sales;
  const sellersRef = useRef(sellers);
  sellersRef.current = sellers;

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
    // Clear active session and auth to require fresh login
    setAuthenticatedSellerId(null);
    setIsBossAuthenticated(false);
    setSessionId(null);
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

  const handleResetData = async () => {
    if (!window.confirm("Je, una uhakika unataka kufuta data zote zilizopo na kuanza upya na duka tupu? Kitendo hiki hakirudishwi.")) return;

    // Clear local cache first
    localStorage.removeItem('mauzo_products');
    localStorage.removeItem('mauzo_sales');
    localStorage.removeItem('mauzo_last_synced_time');
    setProducts([]);
    setSales([]);

    // Also push empty data to Turso so the reset persists across reloads
    try {
      const code = workspaceCode.replace(/[^a-zA-Z0-9-]/g, '').trim().toUpperCase();
      if (code) {
        await Promise.all([
          fetchWithTimeout(`/api/sync/${code}/sales`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: '[]', timeout: 10000
          }),
          fetchWithTimeout(`/api/sync/${code}/products`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: '[]', timeout: 10000
          }),
        ]);
      }
    } catch {
      // Turso unreachable — reset will apply on next successful sync
    }

    alert("Duka lako sasa lipo tupu kabisa! Unaweza kuanza kuandika Bidhaa mpya na kufanya Mauzo mapya sasa.");
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
    setSellers(updatedSellers.map(u => ({
      ...u,
      updatedAt: u.updatedAt || new Date().toISOString()
    })));
    triggerAutoSync();
  };

  // Lock heartbeat - periodically renews the lease so slow syncs don't lose their lock
  const startLockHeartbeat = (code: string, beatClientId: string) => {
    return setInterval(async () => {
      try {
        await fetchWithTimeout(`/api/sync/${code}/lock`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: beatClientId }),
          timeout: 8000
        });
      } catch {
        // Heartbeat failure is non-fatal; the sync continues with the remaining lease window
      }
    }, 12000);
  };

  // Real Cloud Database Sync Engine (REST KeyValue cloud storage)
  // Uses refs to always read the latest state, avoiding stale closure bugs
  const handleSyncDatabases = useCallback(async () => {
    setIsSyncing(true);
    setActiveSyncError(null);

    // Snapshot the latest state from refs at sync time, not closure capture time
    const currentSales = salesRef.current;
    const currentProducts = productsRef.current;
    const currentSellers = sellersRef.current;
    
    let lockAcquired = false;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let formattedCode = '';

    try {
      formattedCode = workspaceCode.replace(/[^a-zA-Z0-9-]/g, '').trim().toUpperCase();
      if (!formattedCode) {
        throw new Error("Weka Code halali ya duka.");
      }

      // 1. Acquire Distributed Sync Lock from the backend
      const lockRes = await fetchWithTimeout(`/api/sync/${formattedCode}/lock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clientId }),
        timeout: 10000
      });

      if (!lockRes.ok) {
        throw new Error("Mfumo wa kuzuia conflicts haupatikani. Jaribu tena.");
      }

      const lockData = await lockRes.json();
      if (!lockData.success) {
        throw new Error(lockData.message || "Duka lipo busy kwa sasa. Kifaa kingine kinafanya mabadiliko.");
      }

      lockAcquired = true;
      // Start heartbeat to keep the lease alive during potentially long operations
      heartbeatTimer = startLockHeartbeat(formattedCode, clientId);
      
      const salesUrl = `/api/sync/${formattedCode}/sales`;
      const productsUrl = `/api/sync/${formattedCode}/products`;
      const usersUrl = `/api/sync/${formattedCode}/users`;
      
      // 2. Fetch Cloud Sales (Handle empty bucket gracefully)
      let cloudSales: Sale[] = [];
      try {
        const res = await fetchWithTimeout(salesUrl, { timeout: 8000 });
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
        const res = await fetchWithTimeout(productsUrl, { timeout: 8000 });
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
        const res = await fetchWithTimeout(usersUrl, { timeout: 8000 });
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

      // Normal synchronization merge using timestamps
      const mergedSalesMap = new Map<string, Sale>();
      cloudSales.forEach(s => mergedSalesMap.set(s.id, s));
      currentSales.forEach(ls => {
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
      currentProducts.forEach(lp => {
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
      currentSellers.forEach(lu => {
        const cu = mergedUsersMap.get(lu.id);
        if (!cu) {
          mergedUsersMap.set(lu.id, lu);
        } else {
          const luTime = lu.updatedAt ? Date.parse(lu.updatedAt) : 0;
          const cuTime = cu.updatedAt ? Date.parse(cu.updatedAt) : 0;
          if (luTime >= cuTime) {
            mergedUsersMap.set(lu.id, lu);
          }
        }
      });
      finalUsersList = Array.from(mergedUsersMap.values());

      // 6. Upload Merged Data to Cloud
      const salesUploadRes = await fetchWithTimeout(salesUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalSalesList),
        timeout: 15000
      });
      
      if (!salesUploadRes.ok) {
        throw new Error("Imeshindwa kupakia data za mauzo kwenye wingu.");
      }
      
      const productsUploadRes = await fetchWithTimeout(productsUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalProductsList),
        timeout: 15000
      });
      
      if (!productsUploadRes.ok) {
        throw new Error("Imeshindwa kupakia data za stoki kwenye wingu.");
      }

      const usersUploadRes = await fetchWithTimeout(usersUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalUsersList),
        timeout: 15000
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
      // Clear heartbeat before releasing lock
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      // 8. Safely unlock session to free slot for other devices
      if (lockAcquired && formattedCode) {
        try {
          await fetchWithTimeout(`/api/sync/${formattedCode}/unlock`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ clientId }),
            timeout: 5000
          });
        } catch (unlockErr) {
          console.error("Taarifa ya unlock haikutumwa:", unlockErr);
        }
      }
      setIsSyncing(false);
    }
  }, [workspaceCode, clientId]);

  // Ref to skip the first workspaceCode sync effect (initial Turso load handles it)
  const initialTursoLoadRef = useRef(false);

  // Turso-first initial load: fetch from Turso API on mount, fall back to localStorage cache
  useEffect(() => {
    let cancelled = false;
    const loadFromTurso = async () => {
      try {
        const code = workspaceCode.replace(/[^a-zA-Z0-9-]/g, '').trim().toUpperCase();
        if (!code) return;

        const [salesRes, productsRes, usersRes] = await Promise.all([
          fetchWithTimeout(`/api/sync/${code}/sales`, { timeout: 8000 }),
          fetchWithTimeout(`/api/sync/${code}/products`, { timeout: 8000 }),
          fetchWithTimeout(`/api/sync/${code}/users`, { timeout: 8000 }),
        ]);

        if (cancelled) return;

        if (salesRes.ok && productsRes.ok && usersRes.ok) {
          const [cloudSales, cloudProducts, cloudUsers] = await Promise.all([
            salesRes.json().catch(() => []),
            productsRes.json().catch(() => []),
            usersRes.json().catch(() => []),
          ]);

          if (cancelled) return;

          // Turso is authoritative — override local state with cloud data
          if (Array.isArray(cloudSales) && cloudSales.length > 0) {
            setSales(cloudSales.map((s: Sale) => ({ ...s, synced: true })));
          }
          if (Array.isArray(cloudProducts) && cloudProducts.length > 0) {
            setProducts(cloudProducts);
          }
          if (Array.isArray(cloudUsers) && cloudUsers.length > 0) {
            setSellers(cloudUsers);
          }

          const nowStr = new Date().toLocaleString();
          setLastSyncedTime(nowStr);
          localStorage.setItem('mauzo_last_synced_time', nowStr);
        }
        // If Turso fetch fails, localStorage data (set in state initializers) is kept as fallback
      } catch {
        // Turso unavailable — localStorage fallback already in state
      } finally {
        if (!cancelled) {
          initialTursoLoadRef.current = true;
          setIsTursoLoading(false);
        }
      }
    };

    loadFromTurso();

    return () => { cancelled = true; };
  }, []); // runs once on mount

  // Auto-sync when workspaceCode changes (skips first run — handled by initial load above)
  useEffect(() => {
    if (initialTursoLoadRef.current && workspaceCode) {
      const delaySync = setTimeout(() => {
        handleSyncDatabases();
      }, 300);
      return () => clearTimeout(delaySync);
    }
  }, [workspaceCode]);

  // Passive pull every 45s: fetch cloud data and merge into local state
  // so changes made on other devices appear automatically.
  const POLL_INTERVAL_MS = 45000;
  useEffect(() => {
    if (!workspaceCode) return;
    let cancelled = false;
    const isSyncingRef = { current: false };

    const pollFromTurso = async () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      try {
        const code = workspaceCode.replace(/[^a-zA-Z0-9-]/g, '').trim().toUpperCase();
        if (!code) return;

        const [salesRes, productsRes, usersRes] = await Promise.all([
          fetchWithTimeout(`/api/sync/${code}/sales`, { timeout: 8000 }),
          fetchWithTimeout(`/api/sync/${code}/products`, { timeout: 8000 }),
          fetchWithTimeout(`/api/sync/${code}/users`, { timeout: 8000 }),
        ]);

        if (cancelled || !salesRes.ok || !productsRes.ok || !usersRes.ok) return;

        const [cloudSales, cloudProducts, cloudUsers] = await Promise.all([
          salesRes.json().catch(() => []),
          productsRes.json().catch(() => []),
          usersRes.json().catch(() => []),
        ]);

        if (cancelled) return;

        const mergeByTimestamp = <T extends { id: string; updatedAt?: string; createdAt?: string }>(
          local: T[],
          cloud: T[],
        ): T[] => {
          const map = new Map<string, T>();
          cloud.forEach(item => map.set(item.id, item));
          local.forEach(item => {
            const existing = map.get(item.id);
            if (!existing) {
              map.set(item.id, item);
            } else {
              const localTime = item.updatedAt ? Date.parse(item.updatedAt) : (item.createdAt ? Date.parse(item.createdAt) : 0);
              const cloudTime = existing.updatedAt ? Date.parse(existing.updatedAt) : (existing.createdAt ? Date.parse(existing.createdAt) : 0);
              if (localTime > cloudTime) {
                map.set(item.id, item);
              }
            }
          });
          return Array.from(map.values());
        };

        if (Array.isArray(cloudSales)) {
          setSales(prev => mergeByTimestamp(prev, cloudSales).map(s => ({ ...s, synced: true })));
        }
        if (Array.isArray(cloudProducts)) {
          setProducts(prev => mergeByTimestamp(prev, cloudProducts));
        }
        if (Array.isArray(cloudUsers)) {
          setSellers(prev => mergeByTimestamp(prev, cloudUsers));
        }
      } catch {
        // Turso unreachable — will retry next interval
      } finally {
        isSyncingRef.current = false;
      }
    };

    const interval = setInterval(pollFromTurso, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [workspaceCode]);

  return (
    <div className="min-h-screen bg-[#e0e5ec] relative overflow-hidden py-4 sm:py-8 px-2 sm:px-4 flex flex-col font-sans select-none selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* Turso Loading Splash Screen — shown until initial Turso fetch completes */}
      {isTursoLoading && (
        <div className="fixed inset-0 z-[9999] bg-[#e0e5ec] flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-xl">
            <ShoppingBag className="w-8 h-8 stroke-[2]" />
          </div>
          <h1 className="font-sans font-black text-2xl text-slate-800 tracking-tight">Mauzo</h1>
          <p className="text-sm text-slate-500 font-medium">Inapakia data kutoka kwenye Turso database...</p>
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mt-2" />
          {!localStorage.getItem('mauzo_products') && (
            <p className="text-xs text-slate-400 mt-4">Ni mara yako ya kwanza. Tunatayarisha duka lako...</p>
          )}
        </div>
      )}

      {/* Playful Floating Ambient Orbs for Claymorph Depth */}
      <div className="absolute top-12 left-10 w-96 h-96 bg-indigo-200/40 rounded-full filter blur-[100px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-20 right-10 w-[450px] h-[450px] bg-sky-200/45 rounded-full filter blur-[120px] pointer-events-none"></div>
      <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-rose-200/30 rounded-full filter blur-[90px] pointer-events-none"></div>

      {/* Main Container */}
      <div className={`max-w-7xl w-full mx-auto flex-1 flex flex-col relative z-10 clay-card overflow-hidden p-0 bg-[#f1f3f6] border border-white/60 shadow-xl rounded-[2.5rem] ${isTursoLoading ? 'opacity-0' : 'opacity-100 transition-opacity duration-500'}`}>
        
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
                onSyncSales={handleSyncDatabases}
                isSyncing={isSyncing}
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
        <footer className="mt-8 text-center border-t border-slate-300/40 pt-4 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 font-mono gap-4 p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Activity size={12} className="text-indigo-500 animate-pulse" />
              <span>Mauzo Primary Storage: <strong>Turso Database</strong> (localStorage fallback)</span>
            </div>
            <button
              onClick={handleResetData}
              className="flex items-center gap-1.5 px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200/50 rounded-xl transition-all font-bold cursor-pointer"
              title="Bonyeza hapa kufuta data zote zilizopo na kuanza upya"
            >
              <Trash2 size={11} />
              <span>Safisha Data (Reset Data)</span>
            </button>
          </div>
          <div>
            <span>© 2026 Mauzo App. Swahili Small Shop Duka Optimizer.</span>
          </div>
        </footer>

      </div>
    </div>
  );
}
