import React, { useState } from 'react';
import {
  BarChart3,
  Bot,
  Briefcase,
  Globe,
  Layers,
  LayoutDashboard,
  LogIn,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  Moon,
  Package,
  Shield,
  ShoppingBag,
  Sparkles,
  Sun,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { CurrencyCode, ModuleId } from '../types';

interface NavItem {
  id: ModuleId;
  label: string;
  section: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Executive Dashboard', section: 'Intelligence', icon: LayoutDashboard },
  { id: 'ai-bi', label: 'AI Business Analyst', section: 'Intelligence', icon: Bot },
  { id: 'finance', label: 'Financial Analytics', section: 'Intelligence', icon: BarChart3 },
  { id: 'storefront', label: 'Online Storefront', section: 'Commerce', icon: ShoppingBag },
  { id: 'orders', label: 'Orders & Fulfillment', section: 'Commerce', icon: Layers },
  { id: 'products', label: 'Products & Inventory', section: 'Commerce', icon: Package },
  { id: 'crm', label: 'Customer CRM', section: 'Growth', icon: Users },
  { id: 'ai-marketing', label: 'AI Marketing Studio', section: 'Growth', icon: Sparkles },
  { id: 'ai-sales', label: 'AI Sales Concierge', section: 'Growth', icon: Briefcase },
  { id: 'campaigns', label: 'Campaign Manager', section: 'Growth', icon: Megaphone },
  { id: 'messaging', label: 'WhatsApp & Email', section: 'Growth', icon: Mail },
  { id: 'regional', label: 'Regional Expansion', section: 'Operations', icon: Globe },
  { id: 'admin', label: 'Administration', section: 'Operations', icon: Shield },
];

export function ResilientImage({
  src,
  alt,
  className = '',
}: {
  src?: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-[#18181D] dark:to-[#101014] text-neutral-500 dark:text-[#C5A059] p-4 text-center ${className}`}
      >
        <TrendingUp className="w-6 h-6 mb-2 opacity-60" />
        <span className="font-display text-sm font-medium tracking-wide">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export function ModuleShell({ children }: { children: React.ReactNode }) {
  const {
    user,
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
    cart,
    hasDemoData,
    seeding,
    triggerSeedDemo,
    isAdmin,
  } = useApp();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  const visibleItems = NAV_ITEMS.filter((item) => canAccessModule(item.id));
  const sections = Array.from(new Set(visibleItems.map((i) => i.section)));
  const currentMeta = NAV_ITEMS.find((i) => i.id === activeModule) || NAV_ITEMS[0];
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const handleSignIn = async () => {
    setAuthBusy(true);
    try {
      await signInWithGoogle();
    } finally {
      setAuthBusy(false);
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white dark:bg-[#0E0E11] border-r border-neutral-200 dark:border-neutral-800/80">
      <div className="px-6 py-6 border-b border-neutral-200 dark:border-neutral-800/80">
        <button
          onClick={() => {
            setActiveModule(canAccessModule('dashboard') ? 'dashboard' : 'storefront');
            setMobileOpen(false);
          }}
          className="text-left block w-full"
        >
          <div className="font-display text-2xl font-semibold tracking-wide text-neutral-950 dark:text-[#F5F2EB]">
            7SENSE
          </div>
          <div className="text-[11px] tracking-[0.18em] uppercase text-[#A8833E] dark:text-[#C5A059] mt-0.5">
            Symphony of Scent
          </div>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
        {sections.map((section) => (
          <div key={section}>
            <div className="px-3 mb-2 text-[11px] font-medium tracking-wider uppercase text-neutral-400 dark:text-neutral-500">
              {section}
            </div>
            <div className="space-y-1">
              {visibleItems
                .filter((i) => i.section === section)
                .map((item) => {
                  const Icon = item.icon;
                  const active = activeModule === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveModule(item.id);
                        setMobileOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-[#C5A059]/15 text-[#8A6728] dark:text-[#D4B475]'
                          : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900 hover:text-neutral-950 dark:hover:text-[#F5F2EB]'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-neutral-200 dark:border-neutral-800/80 space-y-3">
        {user ? (
          <div className="space-y-2">
            <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
              {user.displayName || user.email}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#A8833E] dark:text-[#C5A059] font-medium capitalize">
                Role: {role}
              </span>
              <button
                onClick={logout}
                className="inline-flex items-center gap-1.5 text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleSignIn}
            disabled={authBusy}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#C5A059] text-neutral-950 text-sm font-semibold hover:bg-[#D4B475] transition-colors disabled:opacity-60"
          >
            <LogIn className="w-4 h-4" />
            {authBusy ? 'Signing in...' : 'Sign in with Google'}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#FAF8F4] dark:bg-[#0A0A0C] text-neutral-900 dark:text-[#F5F2EB]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] h-full z-10">{sidebarContent}</div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Clean 3-Zone Header */}
        <header className="sticky top-0 z-30 h-16 px-4 sm:px-8 flex items-center justify-between gap-4 bg-[#FAF8F4]/95 dark:bg-[#0A0A0C]/95 backdrop-blur border-b border-neutral-200 dark:border-neutral-800/80">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300"
              aria-label="Toggle navigation"
            >
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-neutral-400 dark:text-neutral-500 hidden sm:inline whitespace-nowrap">
                7Sense Perfumes
              </span>
              <span className="text-neutral-300 dark:text-neutral-700 hidden sm:inline">/</span>
              <span className="font-semibold text-neutral-950 dark:text-[#F5F2EB] truncate">
                {currentMeta.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <select
              aria-label="Display Currency"
              value={displayCurrency}
              onChange={(e) => setDisplayCurrency(e.target.value as CurrencyCode)}
              className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-white dark:bg-[#141418] border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200"
            >
              <option value="USD">USD ($)</option>
              <option value="AED">AED</option>
              <option value="NGN">NGN (₦)</option>
              <option value="GHS">GHS (GH₵)</option>
              <option value="KES">KES (KSh)</option>
              <option value="TZS">TZS (TSh)</option>
              <option value="UGX">UGX (USh)</option>
            </select>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141418] text-neutral-700 dark:text-neutral-300 hover:border-[#C5A059] transition-colors"
              aria-label="Toggle theme"
              title={theme === 'dark' ? 'Switch to Ivory Light Mode' : 'Switch to Obsidian Dark Mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setActiveModule('storefront')}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-neutral-950 dark:bg-[#C5A059] text-white dark:text-neutral-950 text-xs font-semibold hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Storefront{cartCount > 0 ? ` (${cartCount})` : ''}</span>
            </button>
          </div>
        </header>

        {/* Demo Data Notice Banner (only when workspace needs seeding or demo records exist) */}
        {(hasDemoData || (isAdmin && !seeding && cartCount === -1)) && (
          <div className="px-4 sm:px-8 py-2.5 bg-[#F3EFE6] dark:bg-[#15130E] border-b border-neutral-200 dark:border-neutral-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="text-neutral-700 dark:text-neutral-300">
              <strong className="text-[#8A6728] dark:text-[#C5A059]">DEMO DATA ACTIVE:</strong>{' '}
              Sample luxury perfume catalog, orders, and CRM records are labeled as Demo Data until replaced by your live records.
            </div>
            {isAdmin && (
              <button
                onClick={triggerSeedDemo}
                disabled={seeding}
                className="text-[#8A6728] dark:text-[#D4B475] font-semibold hover:underline whitespace-nowrap"
              >
                {seeding ? 'Syncing Firestore...' : 'Refresh Demo Workspace in Firestore'}
              </button>
            )}
          </div>
        )}

        <main className="flex-1 p-4 sm:p-8 max-w-[1440px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
