import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ResilientImage } from '../components/ModuleLayout';
import { HERO_IMAGE_URL } from '../data/seedData';
import { convertUsdToLocal, formatCurrency } from '../utils/currency';
import {
  createDocWithTimestamps,
  logAuditEvent,
  makeId,
  updateDocWithTimestamp,
} from '../services/firestoreService';
import type { Order, Product } from '../types';

export function StorefrontOrders({ initialTab = 'storefront' }: { initialTab?: 'storefront' | 'orders' }) {
  const {
    user,
    role,
    isAdmin,
    products,
    orders,
    regionalConfigs,
    displayCurrency,
    setDisplayCurrency,
    cart,
    addToCart,
    updateCartQuantity,
    clearCart,
    signInWithGoogle,
  } = useApp();

  const [tab, setTab] = useState<'storefront' | 'orders'>(initialTab);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  const [selectedCountryCode, setSelectedCountryCode] = useState('AE');
  const [discountCode, setDiscountCode] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [paymentGateway, setPaymentGateway] = useState('Network Intl UAE');
  const [submitting, setSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<string | null>(null);

  const activeRegion = useMemo(
    () => regionalConfigs.find((r) => r.countryCode === selectedCountryCode) || regionalConfigs[0],
    [regionalConfigs, selectedCountryCode]
  );

  const checkoutCurrency = activeRegion?.currency || displayCurrency;

  const getProductLocalPrice = (p: Product) =>
    p.regionalPrices?.[checkoutCurrency] ??
    convertUsdToLocal(p.priceUsd, checkoutCurrency, regionalConfigs);

  const filteredCatalog = useMemo(() => {
    return products.filter((p) => {
      if (!p.active) return false;
      if (categoryFilter !== 'All' && p.category !== categoryFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.subtitle || '').toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [products, categoryFilter, search]);

  const cartSummary = useMemo(() => {
    const subtotalLocal = cart.reduce(
      (sum, item) => sum + getProductLocalPrice(item.product) * item.quantity,
      0
    );
    const subtotalUsd = cart.reduce((sum, item) => sum + item.product.priceUsd * item.quantity, 0);
    const cogsUsd = cart.reduce((sum, item) => sum + item.product.costUsd * item.quantity, 0);
    const discountRate = discountCode.trim().toUpperCase() === '7SENSEVIP' ? 0.1 : 0;
    const discountLocal = subtotalLocal * discountRate;
    const afterDiscountLocal = subtotalLocal - discountLocal;
    const vatPct = activeRegion?.vatPercent ?? 5;
    const taxLocal = afterDiscountLocal * (vatPct / 100);
    const freeThreshold = activeRegion?.freeShippingThresholdUsd ?? 150;
    const rate = activeRegion?.exchangeRatePerUsd || 1;
    const shippingLocal =
      subtotalUsd >= freeThreshold || subtotalUsd === 0
        ? 0
        : (activeRegion?.shippingFlatUsd ?? 12) * rate;
    const totalLocal = afterDiscountLocal + taxLocal + shippingLocal;
    const totalUsd = totalLocal / rate;

    return {
      subtotalLocal,
      discountLocal,
      taxLocal,
      shippingLocal,
      totalLocal,
      totalUsd,
      cogsUsd,
      rate,
    };
  }, [cart, activeRegion, discountCode, checkoutCurrency]);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart.length) return;
    if (!user) {
      await signInWithGoogle();
      return;
    }
    setSubmitting(true);
    try {
      const orderId = makeId('ord');
      const orderNumber = `7S-${new Date().toISOString().slice(2, 7).replace('-', '')}-${Math.floor(
        1000 + Math.random() * 9000
      )}`;

      const items = cart.map((i) => {
        const unitPriceLocal = getProductLocalPrice(i.product);
        return {
          productId: i.product.id,
          sku: i.product.sku,
          name: i.product.name,
          quantity: i.quantity,
          unitPriceLocal,
          unitCostUsd: i.product.costUsd,
          lineTotalLocal: unitPriceLocal * i.quantity,
        };
      });

      await createDocWithTimestamps('orders', orderId, {
        orderNumber,
        ownerUid: user.uid,
        customerName: customerName || user.displayName || 'Valued Client',
        customerEmail: customerEmail || user.email || '',
        customerPhone,
        shippingAddress,
        country: activeRegion?.countryName || 'United Arab Emirates',
        currency: checkoutCurrency,
        exchangeRateToUsd: cartSummary.rate,
        items,
        subtotalLocal: Number(cartSummary.subtotalLocal.toFixed(2)),
        discountCode: discountCode.trim().toUpperCase(),
        discountLocal: Number(cartSummary.discountLocal.toFixed(2)),
        taxLocal: Number(cartSummary.taxLocal.toFixed(2)),
        shippingLocal: Number(cartSummary.shippingLocal.toFixed(2)),
        totalLocal: Number(cartSummary.totalLocal.toFixed(2)),
        totalUsd: Number(cartSummary.totalUsd.toFixed(2)),
        cogsUsd: Number(cartSummary.cogsUsd.toFixed(2)),
        channel: 'Online Storefront',
        paymentGateway,
        paymentStatus: 'Authorized',
        status: 'Confirmed',
        trackingNumber: '',
        isDemo: false,
      });

      await logAuditEvent({
        actorRole: role,
        action: 'CREATE_ORDER',
        module: 'Storefront & Orders',
        targetId: orderId,
        details: `Order ${orderNumber} placed for ${activeRegion?.countryName} (${formatCurrency(
          cartSummary.totalLocal,
          checkoutCurrency
        )})`,
      });

      clearCart();
      setCartOpen(false);
      setConfirmedOrder(orderNumber);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusUpdate = async (order: Order, nextStatus: Order['status']) => {
    await updateDocWithTimestamp('orders', order.id, {
      status: nextStatus,
      paymentStatus: nextStatus === 'Refunded' ? 'Refunded' : order.paymentStatus,
    });
    await logAuditEvent({
      actorRole: role,
      action: 'UPDATE_ORDER_STATUS',
      module: 'Orders & Fulfillment',
      targetId: order.id,
      details: `Order ${order.orderNumber} updated to ${nextStatus}`,
    });
  };

  const canManageOrders = Boolean(user && (isAdmin || ['manager', 'sales', 'warehouse'].includes(role)));

  return (
    <div className="space-y-8">
      {/* Sub-view Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-[#141418]">
          <button
            onClick={() => setTab('storefront')}
            className={`px-4 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              tab === 'storefront'
                ? 'bg-white dark:bg-[#222228] text-neutral-950 dark:text-[#F5F2EB] shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400'
            }`}
          >
            Luxury Storefront
          </button>
          <button
            onClick={() => setTab('orders')}
            className={`px-4 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              tab === 'orders'
                ? 'bg-white dark:bg-[#222228] text-neutral-950 dark:text-[#F5F2EB] shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400'
            }`}
          >
            Orders &amp; Fulfillment ({orders.length})
          </button>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedCountryCode}
            onChange={(e) => {
              const code = e.target.value;
              setSelectedCountryCode(code);
              const reg = regionalConfigs.find((r) => r.countryCode === code);
              if (reg) setDisplayCurrency(reg.currency);
            }}
            className="px-3 py-2 rounded-lg text-xs font-medium bg-white dark:bg-[#141418] border border-neutral-200 dark:border-neutral-800"
          >
            {regionalConfigs.map((r) => (
              <option key={r.countryCode} value={r.countryCode}>
                Ship to: {r.countryName} ({r.currency})
              </option>
            ))}
          </select>

          <button
            onClick={() => setCartOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#C5A059] text-neutral-950 text-xs font-semibold hover:bg-[#D4B475] transition-colors whitespace-nowrap"
          >
            <ShoppingBag className="w-4 h-4" />
            Bag ({cart.reduce((s, i) => s + i.quantity, 0)})
          </button>
        </div>
      </div>

      {confirmedOrder && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <div className="text-sm">
              <strong>Order #{confirmedOrder} Confirmed</strong> — Preparing fragrance dispatch from our regional hub. Track progress in Orders &amp; Fulfillment.
            </div>
          </div>
          <button onClick={() => setConfirmedOrder(null)} className="text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {tab === 'storefront' ? (
        <div className="space-y-12">
          {/* Editorial Hero Showcase */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216]">
            <div className="lg:col-span-5 p-8 sm:p-12 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <p className="text-xs tracking-[0.2em] uppercase text-[#A8833E] dark:text-[#C5A059] font-medium">
                  Haute Parfumerie · UAE &amp; Africa
                </p>
                <h1 className="font-display text-4xl sm:text-5xl font-semibold leading-[1.08] text-balance">
                  Symphony of Scent, Crafted to Endure
                </h1>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed max-w-md">
                  Discover Eternal Citrus, Wildwood, and Smoky Red—formulated in high-concentration oils for warm climates, intimate evenings, and unforgettable gifting. Use code <span className="font-mono font-semibold text-neutral-900 dark:text-[#F5F2EB]">7SENSEVIP</span> for 10% privilege.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href="#catalog-grid"
                  className="px-6 py-3 rounded-lg bg-neutral-950 dark:bg-[#C5A059] text-white dark:text-neutral-950 text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Explore Collection
                </a>
                <span className="text-xs text-neutral-500">
                  Complimentary shipping over ${activeRegion?.freeShippingThresholdUsd || 150} USD
                </span>
              </div>
            </div>
            <div className="lg:col-span-7 min-h-[280px] lg:min-h-[420px]">
              <ResilientImage
                src={HERO_IMAGE_URL}
                alt="7Sense Perfumes Signature Collection"
                className="w-full h-full object-cover"
              />
            </div>
          </section>

          {/* Search & Category Filter */}
          <section id="catalog-grid" className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-[#141418]">
                {['All', 'Perfume', 'Gift Set', 'Candle', 'Diffuser', 'Car Fragrance'].map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategoryFilter(c)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                      categoryFilter === c
                        ? 'bg-white dark:bg-[#222228] text-neutral-950 dark:text-[#F5F2EB] shadow-sm'
                        : 'text-neutral-600 dark:text-neutral-400'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search fragrances..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-3 py-2 rounded-lg text-sm bg-white dark:bg-[#141418] border border-neutral-200 dark:border-neutral-800 w-60"
                />
              </div>
            </div>

            {/* 3-Column Product Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCatalog.map((product) => {
                const localPrice = getProductLocalPrice(product);
                return (
                  <div
                    key={product.id}
                    className="group rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] overflow-hidden flex flex-col transition-transform duration-200 hover:-translate-y-0.5"
                  >
                    <button
                      onClick={() => setSelectedProduct(product)}
                      className="aspect-[4/3] w-full overflow-hidden bg-[#F3EFE6] dark:bg-[#18181D] text-left"
                    >
                      <ResilientImage
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    </button>
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div>
                        <div className="text-xs text-neutral-500 uppercase tracking-wider">
                          {product.category} · {product.gender} · {product.sizeMl}ml
                        </div>
                        <button
                          onClick={() => setSelectedProduct(product)}
                          className="font-display text-2xl font-semibold mt-1 text-left hover:text-[#C5A059] transition-colors"
                        >
                          {product.name}
                        </button>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">
                          {product.subtitle || product.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-neutral-100 dark:border-neutral-800/80">
                        <span className="font-mono tabular-nums text-base font-semibold">
                          {formatCurrency(localPrice, checkoutCurrency)}
                        </span>
                        <button
                          onClick={() => {
                            addToCart(product, 1, product.variants?.[0]);
                            setCartOpen(true);
                          }}
                          className="px-4 py-2 rounded-lg bg-neutral-950 dark:bg-[#C5A059] text-white dark:text-neutral-950 text-xs font-semibold hover:opacity-90 transition-opacity"
                        >
                          Add to Bag
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      ) : (
        /* Orders & Fulfillment Table */
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] overflow-hidden">
          {orders.length === 0 ? (
            <div className="p-10 text-center text-sm text-neutral-500">
              {user
                ? 'No orders recorded for your account yet. Place an order from the Luxury Storefront or seed demo data.'
                : 'Sign in with Google to view your order history and fulfillment status.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-800 text-xs text-neutral-500 text-left bg-neutral-50 dark:bg-[#16161B]">
                    <th className="py-3 px-4 font-medium">Order</th>
                    <th className="py-3 px-4 font-medium">Client &amp; Market</th>
                    <th className="py-3 px-4 font-medium">Items</th>
                    <th className="py-3 px-4 font-medium">Gateway &amp; Channel</th>
                    <th className="py-3 px-4 font-medium text-right">Total</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((ord) => (
                    <tr
                      key={ord.id}
                      className="border-b border-neutral-100 dark:border-neutral-800/60"
                    >
                      <td className="py-3 px-4 font-mono text-xs">
                        <div className="font-semibold">{ord.orderNumber}</div>
                        <div className="text-neutral-500">{ord.trackingNumber || 'No tracking yet'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium">
                          {ord.customerName}
                          {ord.isDemo && (
                            <span className="ml-2 text-[11px] font-mono text-[#A8833E] dark:text-[#C5A059]">
                              · DEMO
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-neutral-500">{ord.country}</div>
                      </td>
                      <td className="py-3 px-4 text-xs text-neutral-600 dark:text-neutral-300">
                        {ord.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}
                      </td>
                      <td className="py-3 px-4 text-xs text-neutral-500">
                        <div>{ord.channel}</div>
                        <div>{ord.paymentGateway || 'Adapter'} · {ord.paymentStatus}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <div className="font-semibold">
                          {formatCurrency(ord.totalLocal, ord.currency)}
                        </div>
                        <div className="text-xs text-neutral-500">(${ord.totalUsd.toFixed(2)})</div>
                      </td>
                      <td className="py-3 px-4">
                        {canManageOrders ? (
                          <select
                            value={ord.status}
                            onChange={(e) =>
                              handleStatusUpdate(ord, e.target.value as Order['status'])
                            }
                            className="px-2.5 py-1 rounded-md text-xs border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141418]"
                          >
                            {['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Refunded'].map(
                              (st) => (
                                <option key={st} value={st}>{st}</option>
                              )
                            )}
                          </select>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                            <Truck className="w-3.5 h-3.5 text-[#C5A059]" />
                            {ord.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121216] border border-neutral-200 dark:border-neutral-800 rounded-xl max-w-3xl w-full overflow-hidden grid grid-cols-1 md:grid-cols-2">
            <div className="aspect-[4/3] md:aspect-auto bg-[#F3EFE6] dark:bg-[#18181D]">
              <ResilientImage
                src={selectedProduct.imageUrl}
                alt={selectedProduct.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-6 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs uppercase tracking-wider text-[#A8833E] dark:text-[#C5A059]">
                    {selectedProduct.category} · {selectedProduct.gender}
                  </span>
                  <button onClick={() => setSelectedProduct(null)}>
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <h2 className="font-display text-3xl font-semibold mt-1">{selectedProduct.name}</h2>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2">
                  {selectedProduct.description}
                </p>

                {selectedProduct.fragranceNotes && (
                  <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800 space-y-1.5 text-xs">
                    <div>
                      <span className="font-semibold">Top:</span> {selectedProduct.fragranceNotes.top}
                    </div>
                    <div>
                      <span className="font-semibold">Heart:</span> {selectedProduct.fragranceNotes.heart}
                    </div>
                    <div>
                      <span className="font-semibold">Base:</span> {selectedProduct.fragranceNotes.base}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <div className="font-mono text-xl font-semibold tabular-nums">
                  {formatCurrency(getProductLocalPrice(selectedProduct), checkoutCurrency)}
                </div>
                <button
                  onClick={() => {
                    addToCart(selectedProduct, 1, selectedProduct.variants?.[0]);
                    setSelectedProduct(null);
                    setCartOpen(true);
                  }}
                  className="px-5 py-2.5 rounded-lg bg-[#C5A059] text-neutral-950 text-sm font-semibold hover:bg-[#D4B475]"
                >
                  Add to Bag
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slide-over Cart & Checkout Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
          <div className="w-full max-w-md bg-white dark:bg-[#121216] h-full flex flex-col border-l border-neutral-200 dark:border-neutral-800">
            <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <h3 className="font-display text-2xl font-semibold">Shopping Bag</h3>
              <button onClick={() => setCartOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {cart.length === 0 ? (
                <p className="text-sm text-neutral-500 text-center py-12">Your shopping bag is empty.</p>
              ) : (
                <>
                  <div className="space-y-4">
                    {cart.map((item) => (
                      <div
                        key={item.product.id}
                        className="flex items-center justify-between gap-3 pb-4 border-b border-neutral-100 dark:border-neutral-800/70"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{item.product.name}</div>
                          <div className="text-xs text-neutral-500 font-mono">
                            {formatCurrency(getProductLocalPrice(item.product), checkoutCurrency)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                            className="p-1 rounded border border-neutral-200 dark:border-neutral-800"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center font-mono text-xs">{item.quantity}</span>
                          <button
                            onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                            className="p-1 rounded border border-neutral-200 dark:border-neutral-800"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => updateCartQuantity(item.product.id, 0)}
                            className="p-1 text-red-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleCheckout} className="space-y-3 text-sm">
                    <div className="flex gap-2">
                      <input
                        placeholder="Promo code (e.g. 7SENSEVIP)"
                        value={discountCode}
                        onChange={(e) => setDiscountCode(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent text-xs uppercase font-mono"
                      />
                    </div>
                    <input
                      required
                      placeholder="Full Name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent"
                    />
                    <input
                      required
                      type="email"
                      placeholder="Email Address"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent"
                    />
                    <input
                      required
                      placeholder="WhatsApp / Phone Number"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent"
                    />
                    <input
                      required
                      placeholder={`Delivery Address (${activeRegion?.countryName})`}
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent"
                    />
                    <div>
                      <label className="block text-xs text-neutral-500 mb-1">
                        Payment Gateway Adapter (PCI-Tokenized — No Card Stored)
                      </label>
                      <select
                        value={paymentGateway}
                        onChange={(e) => setPaymentGateway(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141418]"
                      >
                        <option value="Network Intl UAE">Network Intl UAE / Stripe</option>
                        <option value="Paystack">Paystack (NG / GH / KE)</option>
                        <option value="Flutterwave">Flutterwave (Pan-African)</option>
                        <option value="M-Pesa">M-Pesa Express</option>
                        <option value="Manual/Bank Transfer">Concierge Bank Transfer</option>
                      </select>
                    </div>

                    <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Subtotal</span>
                        <span className="font-mono tabular-nums">
                          {formatCurrency(cartSummary.subtotalLocal, checkoutCurrency)}
                        </span>
                      </div>
                      {cartSummary.discountLocal > 0 && (
                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                          <span>VIP Discount (10%)</span>
                          <span className="font-mono tabular-nums">
                            -{formatCurrency(cartSummary.discountLocal, checkoutCurrency)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-neutral-500">
                          Regional VAT ({activeRegion?.vatPercent ?? 5}%)
                        </span>
                        <span className="font-mono tabular-nums">
                          {formatCurrency(cartSummary.taxLocal, checkoutCurrency)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Shipping</span>
                        <span className="font-mono tabular-nums">
                          {cartSummary.shippingLocal === 0
                            ? 'Complimentary'
                            : formatCurrency(cartSummary.shippingLocal, checkoutCurrency)}
                        </span>
                      </div>
                      <div className="flex justify-between text-base font-semibold pt-2 border-t border-neutral-200 dark:border-neutral-800">
                        <span>Total</span>
                        <span className="font-mono tabular-nums">
                          {formatCurrency(cartSummary.totalLocal, checkoutCurrency)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-3 rounded-lg bg-[#C5A059] text-neutral-950 font-semibold hover:bg-[#D4B475] transition-colors"
                    >
                      {submitting
                        ? 'Processing Order...'
                        : user
                          ? 'Place Order & Confirm'
                          : 'Sign in with Google to Checkout'}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
