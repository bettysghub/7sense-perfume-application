import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import type {
  AiContent,
  AuditLog,
  Campaign,
  CurrencyCode,
  Customer,
  Expense,
  IntegrationSetting,
  MessagingCampaign,
  ModuleId,
  Order,
  Product,
  RegionalConfig,
  StaffRole,
  StockMovement,
  UserProfile,
} from '../types';
import { INITIAL_DEMO_PRODUCTS, INITIAL_REGIONAL_CONFIGS } from '../data/seedData';
import { seedDemoWorkspace } from '../services/firestoreService';

export interface CartItem {
  product: Product;
  quantity: number;
  variant?: string;
}

interface AppContextValue {
  user: User | null;
  profile: UserProfile | null;
  authReady: boolean;
  isAdmin: boolean;
  role: StaffRole;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  activeModule: ModuleId;
  setActiveModule: (mod: ModuleId) => void;
  displayCurrency: CurrencyCode;
  setDisplayCurrency: (c: CurrencyCode) => void;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  canAccessModule: (mod: ModuleId) => boolean;
  products: Product[];
  stockMovements: StockMovement[];
  customers: Customer[];
  orders: Order[];
  campaigns: Campaign[];
  aiContent: AiContent[];
  messagingCampaigns: MessagingCampaign[];
  expenses: Expense[];
  regionalConfigs: RegionalConfig[];
  integrationSettings: IntegrationSetting[];
  auditLogs: AuditLog[];
  usersList: UserProfile[];
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number, variant?: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  seeding: boolean;
  triggerSeedDemo: () => Promise<void>;
  hasDemoData: boolean;
}

const ROLE_MODULES: Record<StaffRole, ModuleId[]> = {
  ceo: [
    'dashboard',
    'storefront',
    'products',
    'orders',
    'crm',
    'ai-marketing',
    'ai-sales',
    'campaigns',
    'messaging',
    'finance',
    'ai-bi',
    'regional',
    'admin',
  ],
  manager: [
    'dashboard',
    'storefront',
    'products',
    'orders',
    'crm',
    'ai-marketing',
    'ai-sales',
    'campaigns',
    'messaging',
    'finance',
    'ai-bi',
    'regional',
  ],
  marketing: ['dashboard', 'storefront', 'ai-marketing', 'campaigns', 'messaging', 'crm', 'ai-bi'],
  sales: ['dashboard', 'storefront', 'orders', 'crm', 'ai-sales', 'products'],
  warehouse: ['dashboard', 'products', 'orders', 'regional'],
  accountant: ['dashboard', 'finance', 'orders', 'expenses' as ModuleId, 'regional', 'ai-bi'].filter(
    (m): m is ModuleId => m !== ('expenses' as ModuleId)
  ),
  customer: ['storefront', 'ai-sales', 'orders'],
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('7sense-theme') as 'dark' | 'light') || 'dark';
    }
    return 'dark';
  });
  const [activeModule, setActiveModule] = useState<ModuleId>('dashboard');
  const [displayCurrency, setDisplayCurrency] = useState<CurrencyCode>('USD');

  const [products, setProducts] = useState<Product[]>(
    INITIAL_DEMO_PRODUCTS.map((p) => ({ ...p, ownerUid: 'demo' }))
  );
  const [regionalConfigs, setRegionalConfigs] = useState<RegionalConfig[]>(
    INITIAL_REGIONAL_CONFIGS.map((r) => ({ ...r, ownerUid: 'demo' }))
  );
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [aiContent, setAiContent] = useState<AiContent[]>([]);
  const [messagingCampaigns, setMessagingCampaigns] = useState<MessagingCampaign[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [integrationSettings, setIntegrationSettings] = useState<IntegrationSetting[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('7sense-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  const isAdmin = useMemo(() => {
    if (!user) return false;
    return (
      (user.email === BOOTSTRAPPED_ADMIN_EMAIL && user.emailVerified) ||
      profile?.role === 'ceo'
    );
  }, [user, profile]);

  const role: StaffRole = useMemo(() => {
    if (!user) return 'customer';
    if (user.email === BOOTSTRAPPED_ADMIN_EMAIL && user.emailVerified) return 'ceo';
    return profile?.role || 'customer';
  }, [user, profile]);

  const canAccessModule = (mod: ModuleId): boolean => {
    if (!user) return mod === 'storefront' || mod === 'ai-sales';
    return ROLE_MODULES[role]?.includes(mod) ?? false;
  };

  // Auth listener & profile hydration
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        try {
          const snap = await getDoc(userRef);
          const isRootAdmin =
            firebaseUser.email === BOOTSTRAPPED_ADMIN_EMAIL && firebaseUser.emailVerified;
          if (snap.exists()) {
            const data = snap.data() as UserProfile;
            setProfile({ ...data, id: snap.id });
            if (!isRootAdmin && data.role === 'customer') {
              setActiveModule('storefront');
            }
          } else {
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || 'user@7senseperfumes.com',
              displayName: firebaseUser.displayName || '7Sense Member',
              role: isRootAdmin ? 'ceo' : 'customer',
              department: isRootAdmin ? 'Executive Leadership' : 'Storefront Client',
              active: true,
            };
            await setDoc(userRef, {
              ...newProfile,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            setProfile({ ...newProfile, id: firebaseUser.uid });
            if (!isRootAdmin) {
              setActiveModule('storefront');
            }
          }
        } catch (err) {
          console.warn('Profile sync notice:', err);
        }
      } else {
        setProfile(null);
        setActiveModule('storefront');
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Public catalog & regional config listeners
  useEffect(() => {
    const unsubProducts = onSnapshot(
      collection(db, 'products'),
      (snap) => {
        if (!snap.empty) {
          setProducts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Product, 'id'>) })));
        } else {
          setProducts(INITIAL_DEMO_PRODUCTS.map((p) => ({ ...p, ownerUid: 'demo' })));
        }
      },
      (err) => {
        console.warn('Products listener fallback:', err.message);
      }
    );

    const unsubRegions = onSnapshot(
      collection(db, 'regionalConfigs'),
      (snap) => {
        if (!snap.empty) {
          setRegionalConfigs(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RegionalConfig, 'id'>) }))
          );
        } else {
          setRegionalConfigs(INITIAL_REGIONAL_CONFIGS.map((r) => ({ ...r, ownerUid: 'demo' })));
        }
      },
      (err) => {
        console.warn('Regional config listener fallback:', err.message);
      }
    );

    return () => {
      unsubProducts();
      unsubRegions();
    };
  }, []);

  // Authenticated workspace listeners (only after authReady && user)
  useEffect(() => {
    if (!authReady || !user) {
      setStockMovements([]);
      setCustomers([]);
      setOrders([]);
      setCampaigns([]);
      setAiContent([]);
      setMessagingCampaigns([]);
      setExpenses([]);
      setIntegrationSettings([]);
      setAuditLogs([]);
      setUsersList([]);
      return;
    }

    const isRootAdmin = user.email === BOOTSTRAPPED_ADMIN_EMAIL && user.emailVerified;
    const scopedQuery = (colName: string) =>
      isRootAdmin
        ? collection(db, colName)
        : query(collection(db, colName), where('ownerUid', '==', user.uid));

    const unsubs: (() => void)[] = [];

    unsubs.push(
      onSnapshot(
        scopedQuery('orders'),
        (snap) => setOrders(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Order, 'id'>) }))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'orders')
      )
    );

    unsubs.push(
      onSnapshot(
        scopedQuery('customers'),
        (snap) =>
          setCustomers(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Customer, 'id'>) }))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'customers')
      )
    );

    unsubs.push(
      onSnapshot(
        scopedQuery('stockMovements'),
        (snap) =>
          setStockMovements(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StockMovement, 'id'>) }))
          ),
        (err) => handleFirestoreError(err, OperationType.LIST, 'stockMovements')
      )
    );

    unsubs.push(
      onSnapshot(
        scopedQuery('campaigns'),
        (snap) =>
          setCampaigns(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Campaign, 'id'>) }))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'campaigns')
      )
    );

    unsubs.push(
      onSnapshot(
        scopedQuery('aiContent'),
        (snap) =>
          setAiContent(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AiContent, 'id'>) }))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'aiContent')
      )
    );

    unsubs.push(
      onSnapshot(
        scopedQuery('messagingCampaigns'),
        (snap) =>
          setMessagingCampaigns(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MessagingCampaign, 'id'>) }))
          ),
        (err) => handleFirestoreError(err, OperationType.LIST, 'messagingCampaigns')
      )
    );

    unsubs.push(
      onSnapshot(
        scopedQuery('expenses'),
        (snap) =>
          setExpenses(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Expense, 'id'>) }))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'expenses')
      )
    );

    unsubs.push(
      onSnapshot(
        scopedQuery('auditLogs'),
        (snap) =>
          setAuditLogs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLog, 'id'>) }))),
        (err) => handleFirestoreError(err, OperationType.LIST, 'auditLogs')
      )
    );

    if (isRootAdmin) {
      unsubs.push(
        onSnapshot(
          collection(db, 'integrationSettings'),
          (snap) =>
            setIntegrationSettings(
              snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<IntegrationSetting, 'id'>) }))
            ),
          (err) => handleFirestoreError(err, OperationType.LIST, 'integrationSettings')
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'users'),
          (snap) =>
            setUsersList(
              snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<UserProfile, 'id'>) }))
            ),
          (err) => handleFirestoreError(err, OperationType.LIST, 'users')
        )
      );
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authReady, user]);

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const triggerSeedDemo = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      await seedDemoWorkspace(user.uid);
    } finally {
      setSeeding(false);
    }
  };

  const addToCart = (product: Product, quantity = 1, variant?: string) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.product.id === product.id && i.variant === variant);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + quantity };
        return next;
      }
      return [...prev, { product, quantity, variant }];
    });
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    setCart((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.product.id !== productId)
        : prev.map((i) => (i.product.id === productId ? { ...i, quantity } : i))
    );
  };

  const clearCart = () => setCart([]);

  const hasDemoData = useMemo(
    () =>
      products.some((p) => p.isDemo) ||
      orders.some((o) => o.isDemo) ||
      customers.some((c) => c.isDemo),
    [products, orders, customers]
  );

  return (
    <AppContext.Provider
      value={{
        user,
        profile,
        authReady,
        isAdmin,
        role,
        theme,
        toggleTheme,
        activeModule,
        setActiveModule,
        displayCurrency,
        setDisplayCurrency,
        signInWithGoogle,
        logout,
        canAccessModule,
        products,
        stockMovements,
        customers,
        orders,
        campaigns,
        aiContent,
        messagingCampaigns,
        expenses,
        regionalConfigs,
        integrationSettings,
        auditLogs,
        usersList,
        cart,
        addToCart,
        updateCartQuantity,
        clearCart,
        seeding,
        triggerSeedDemo,
        hasDemoData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
