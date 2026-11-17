import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download, FileText, RefreshCw, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  convertUsdToLocal,
  exportFinancialPdfReport,
  exportToCsv,
  formatCurrency,
} from '../utils/currency';
import { clearDemoRecords, logAuditEvent } from '../services/firestoreService';

export function ExecutiveDashboard() {
  const {
    user,
    isAdmin,
    role,
    products,
    orders,
    customers,
    campaigns,
    expenses,
    regionalConfigs,
    displayCurrency,
    triggerSeedDemo,
    seeding,
    setActiveModule,
    signInWithGoogle,
  } = useApp();

  const [countryFilter, setCountryFilter] = useState<string>('All');
  const [dateRange, setDateRange] = useState<'all' | '30d' | '7d'>('all');
  const [monthlyTargetUsd, setMonthlyTargetUsd] = useState<number>(5000);
  const [clearing, setClearing] = useState(false);

  const countries = useMemo(() => {
    const set = new Set<string>(regionalConfigs.map((r) => r.countryName));
    orders.forEach((o) => set.add(o.country));
    return ['All', ...Array.from(set)];
  }, [regionalConfigs, orders]);

  const filteredOrders = useMemo(() => {
    const now = Date.now();
    const cutoff =
      dateRange === '7d'
        ? now - 7 * 86400000
        : dateRange === '30d'
          ? now - 30 * 86400000
          : 0;
    return orders.filter((o) => {
      if (o.status === 'Cancelled') return false;
      if (countryFilter !== 'All' && o.country !== countryFilter) return false;
      if (cutoff > 0 && o.createdAt && typeof (o.createdAt as { toMillis?: () => number }).toMillis === 'function') {
        return (o.createdAt as { toMillis: () => number }).toMillis() >= cutoff;
      }
      return true;
    });
  }, [orders, countryFilter, dateRange]);

  const metrics = useMemo(() => {
    const paidOrders = filteredOrders.filter((o) => o.status !== 'Refunded');
    const revenueUsd = paidOrders.reduce((s, o) => s + (o.totalUsd || 0), 0);
    const cogsUsd = paidOrders.reduce((s, o) => s + (o.cogsUsd || 0), 0);
    const grossProfitUsd = revenueUsd - cogsUsd;

    const filteredExpenses = expenses.filter(
      (e) => countryFilter === 'All' || e.country === countryFilter
    );
    const totalExpensesUsd = filteredExpenses.reduce((s, e) => s + (e.amountUsd || 0), 0);
    const netProfitUsd = grossProfitUsd - totalExpensesUsd;

    const orderCount = paidOrders.length;
    const aovUsd = orderCount > 0 ? revenueUsd / orderCount : 0;

    const filteredCampaigns = campaigns.filter(
      (c) => countryFilter === 'All' || c.targetCountry === countryFilter
    );
    const marketingSpendUsd = filteredCampaigns.reduce((s, c) => s + (c.spendUsd || 0), 0);
    const totalClicks = filteredCampaigns.reduce((s, c) => s + (c.clicks || 0), 0);
    const totalConversions = filteredCampaigns.reduce((s, c) => s + (c.conversions || 0), 0);
    const attributedRevUsd = filteredCampaigns.reduce(
      (s, c) => s + (c.attributedRevenueUsd || 0),
      0
    );

    const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
    const roas = marketingSpendUsd > 0 ? attributedRevUsd / marketingSpendUsd : 0;

    const filteredCustomers = customers.filter(
      (c) => countryFilter === 'All' || c.country === countryFilter
    );
    const returningCount = filteredCustomers.filter((c) => c.ordersCount > 1).length;
    const returningRate =
      filteredCustomers.length > 0 ? (returningCount / filteredCustomers.length) * 100 : 0;

    return {
      revenueUsd,
      cogsUsd,
      grossProfitUsd,
      netProfitUsd,
      orderCount,
      aovUsd,
      conversionRate,
      returningRate,
      marketingSpendUsd,
      roas,
    };
  }, [filteredOrders, expenses, campaigns, customers, countryFilter]);

  const fmt = (usd: number) =>
    formatCurrency(convertUsdToLocal(usd, displayCurrency, regionalConfigs), displayCurrency);

  const countryBreakdown = useMemo(() => {
    const map = new Map<string, { country: string; revenueUsd: number; orders: number; profitUsd: number }>();
    filteredOrders.forEach((o) => {
      const prev = map.get(o.country) || { country: o.country, revenueUsd: 0, orders: 0, profitUsd: 0 };
      prev.revenueUsd += o.totalUsd || 0;
      prev.orders += 1;
      prev.profitUsd += (o.totalUsd || 0) - (o.cogsUsd || 0);
      map.set(o.country, prev);
    });
    return Array.from(map.values()).sort((a, b) => b.revenueUsd - a.revenueUsd);
  }, [filteredOrders]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; sku: string; units: number; revenueUsd: number }>();
    filteredOrders.forEach((o) => {
      const rate = o.exchangeRateToUsd || 1;
      o.items.forEach((item) => {
        const prev = map.get(item.productId) || {
          name: item.name,
          sku: item.sku,
          units: 0,
          revenueUsd: 0,
        };
        prev.units += item.quantity;
        prev.revenueUsd += item.lineTotalLocal / rate;
        map.set(item.productId, prev);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.revenueUsd - a.revenueUsd);
  }, [filteredOrders]);

  const lowStockProducts = useMemo(
    () => products.filter((p) => p.totalStock <= p.reorderPoint),
    [products]
  );

  const trendSeries = useMemo(() => {
    if (filteredOrders.length === 0) return [];
    return filteredOrders.map((o, idx) => ({
      label: o.orderNumber || `Order ${idx + 1}`,
      revenueUsd: Number((o.totalUsd || 0).toFixed(2)),
      grossProfitUsd: Number(((o.totalUsd || 0) - (o.cogsUsd || 0)).toFixed(2)),
    }));
  }, [filteredOrders]);

  const targetProgress = Math.min(100, Math.round((metrics.revenueUsd / Math.max(1, monthlyTargetUsd)) * 100));

  const handleClearDemo = async () => {
    setClearing(true);
    try {
      const count = await clearDemoRecords();
      await logAuditEvent({
        actorRole: role,
        action: 'CLEAR_DEMO_DATA',
        module: 'Executive Dashboard',
        details: `Removed ${count} demo records from Firestore.`,
      });
    } finally {
      setClearing(false);
    }
  };

  if (!user) {
    return (
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] p-10 text-center space-y-4">
        <h1 className="font-display text-3xl font-semibold">
          7Sense Perfumes Executive Intelligence
        </h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-xl mx-auto">
          Sign in with your authorized Google account to load live Firestore orders, CRM profiles, regional performance, and AI analytics—or explore the public Online Storefront and Fragrance Quiz immediately.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            onClick={signInWithGoogle}
            className="px-5 py-2.5 rounded-lg bg-[#C5A059] text-neutral-950 text-sm font-semibold hover:bg-[#D4B475] transition-colors"
          >
            Sign in with Google
          </button>
          <button
            onClick={() => setActiveModule('storefront')}
            className="px-5 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 text-sm font-medium hover:border-[#C5A059] transition-colors"
          >
            Browse Luxury Storefront
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <p className="text-xs tracking-wider uppercase text-[#A8833E] dark:text-[#C5A059] font-medium">
            Executive Command · Live Database Metrics
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold mt-1 text-balance">
            7Sense Sales &amp; Marketing Intelligence
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="px-3 py-2 rounded-lg text-xs font-medium bg-white dark:bg-[#141418] border border-neutral-200 dark:border-neutral-800"
          >
            {countries.map((c) => (
              <option key={c} value={c}>
                {c === 'All' ? 'All Markets' : c}
              </option>
            ))}
          </select>

          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as 'all' | '30d' | '7d')}
            className="px-3 py-2 rounded-lg text-xs font-medium bg-white dark:bg-[#141418] border border-neutral-200 dark:border-neutral-800"
          >
            <option value="all">All Recorded Dates</option>
            <option value="30d">Last 30 Days</option>
            <option value="7d">Last 7 Days</option>
          </select>

          <button
            onClick={() =>
              exportToCsv(
                '7sense-executive-orders.csv',
                filteredOrders.map((o) => ({
                  OrderNumber: o.orderNumber,
                  Country: o.country,
                  Channel: o.channel,
                  Currency: o.currency,
                  TotalLocal: o.totalLocal,
                  TotalUSD: o.totalUsd,
                  GrossProfitUSD: (o.totalUsd - o.cogsUsd).toFixed(2),
                  Status: o.status,
                  IsDemo: o.isDemo,
                }))
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141418] text-xs font-medium hover:border-[#C5A059] transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>

          <button
            onClick={() =>
              exportFinancialPdfReport({
                title: 'Executive Performance Summary',
                subtitle: `Market Filter: ${countryFilter} · Display Currency: ${displayCurrency}`,
                metrics: [
                  { label: 'Total Revenue', value: fmt(metrics.revenueUsd) },
                  { label: 'Gross Profit', value: fmt(metrics.grossProfitUsd) },
                  { label: 'Net Profit (Est.)', value: fmt(metrics.netProfitUsd) },
                  { label: 'Orders', value: String(metrics.orderCount) },
                  { label: 'Average Order Value', value: fmt(metrics.aovUsd) },
                  { label: 'Blended ROAS', value: `${metrics.roas.toFixed(2)}x` },
                ],
                tableHeaders: ['Country', 'Orders', 'Revenue (USD)', 'Gross Profit (USD)'],
                tableRows: countryBreakdown.map((c) => [
                  c.country,
                  String(c.orders),
                  `$${c.revenueUsd.toFixed(2)}`,
                  `$${c.profitUsd.toFixed(2)}`,
                ]),
                footerNote: 'Generated from live Cloud Firestore records.',
              })
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141418] text-xs font-medium hover:border-[#C5A059] transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Empty Database Bootstrap Prompt */}
      {orders.length === 0 && customers.length === 0 && isAdmin && (
        <div className="rounded-xl border border-[#C5A059]/40 bg-[#C5A059]/10 p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold">Initialize Your Firestore Workspace</h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-1">
              Your live Cloud Firestore database is connected and currently empty. Seed clearly labeled DEMO DATA (Eternal Citrus, Wildwood, Smoky Red, UAE &amp; African markets) or begin adding live records directly.
            </p>
          </div>
          <button
            onClick={triggerSeedDemo}
            disabled={seeding}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#C5A059] text-neutral-950 text-sm font-semibold hover:bg-[#D4B475] transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${seeding ? 'animate-spin' : ''}`} />
            {seeding ? 'Seeding Workspace...' : 'Seed 7Sense Demo Workspace'}
          </button>
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Revenue', val: fmt(metrics.revenueUsd), sub: `${metrics.orderCount} active orders` },
          { label: 'Gross Profit', val: fmt(metrics.grossProfitUsd), sub: `COGS ${fmt(metrics.cogsUsd)}` },
          { label: 'Net Profit', val: fmt(metrics.netProfitUsd), sub: 'After recorded expenses' },
          { label: 'Avg. Order Value', val: fmt(metrics.aovUsd), sub: `Conv. rate ${metrics.conversionRate.toFixed(1)}%` },
          { label: 'Marketing ROAS', val: `${metrics.roas.toFixed(2)}x`, sub: `Spend ${fmt(metrics.marketingSpendUsd)} · ${metrics.returningRate.toFixed(0)}% repeat` },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] p-5"
          >
            <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              {kpi.label}
            </div>
            <div className="text-2xl font-mono font-semibold tabular-nums mt-2 text-neutral-950 dark:text-[#F5F2EB]">
              {kpi.val}
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5 tabular-nums">
              {kpi.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Monthly Target Strip */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] p-5 flex flex-wrap items-center justify-between gap-6">
        <div className="min-w-[240px] flex-1">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium">Monthly Revenue Target Progress</span>
            <span className="font-mono tabular-nums text-[#A8833E] dark:text-[#C5A059] font-semibold">
              {targetProgress}% ({fmt(metrics.revenueUsd)} / {fmt(monthlyTargetUsd)})
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
            <div
              className="h-full bg-[#C5A059] transition-all duration-300"
              style={{ width: `${targetProgress}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <label className="text-neutral-500">Target (USD):</label>
          <input
            type="number"
            min={500}
            step={500}
            value={monthlyTargetUsd}
            onChange={(e) => setMonthlyTargetUsd(Number(e.target.value) || 5000)}
            className="w-28 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent font-mono tabular-nums"
          />
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] p-6">
          <h2 className="font-display text-xl font-semibold mb-1">Order Revenue &amp; Gross Profit Trend</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-5">
            Calculated directly from persisted Firestore orders (USD baseline)
          </p>
          {trendSeries.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendSeries}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="revenueUsd"
                    name="Revenue (USD)"
                    stroke="#C5A059"
                    fill="#C5A059"
                    fillOpacity={0.22}
                  />
                  <Area
                    type="monotone"
                    dataKey="grossProfitUsd"
                    name="Gross Profit (USD)"
                    stroke="#6B7280"
                    fill="#6B7280"
                    fillOpacity={0.12}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-neutral-500">
              No recorded orders match the selected filters yet.
            </div>
          )}
        </div>

        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] p-6">
          <h2 className="font-display text-xl font-semibold mb-1">Country Revenue Performance</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-5">
            UAE &amp; African regional sales distribution (USD)
          </p>
          {countryBreakdown.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={countryBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                  <XAxis dataKey="country" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="revenueUsd" name="Revenue (USD)" fill="#C5A059" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-neutral-500">
              No country sales data available yet.
            </div>
          )}
        </div>
      </div>

      {/* Bottom Tables: Top Products & Low Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-semibold">Top Performing Fragrances</h2>
            <button
              onClick={() => setActiveModule('products')}
              className="text-xs font-medium text-[#A8833E] dark:text-[#C5A059] hover:underline"
            >
              View Catalog
            </button>
          </div>
          {topProducts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-800 text-xs text-neutral-500 text-left">
                    <th className="py-2 font-medium">Product</th>
                    <th className="py-2 font-medium text-right">Units</th>
                    <th className="py-2 font-medium text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((p) => (
                    <tr
                      key={p.sku}
                      className="border-b border-neutral-100 dark:border-neutral-800/60 last:border-0"
                    >
                      <td className="py-2.5">
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs font-mono text-neutral-500">{p.sku}</div>
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums">{p.units}</td>
                      <td className="py-2.5 text-right font-mono tabular-nums font-medium">
                        {fmt(p.revenueUsd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-neutral-500 py-6">Place or seed orders to rank top products.</p>
          )}
        </div>

        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-semibold">Low-Stock Inventory Alerts</h2>
            {isAdmin && (
              <button
                onClick={handleClearDemo}
                disabled={clearing}
                className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {clearing ? 'Clearing...' : 'Clear Demo Data'}
              </button>
            )}
          </div>
          {lowStockProducts.length > 0 ? (
            <div className="space-y-3">
              {lowStockProducts.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-2.5 border-b border-neutral-100 dark:border-neutral-800/60 last:border-0"
                >
                  <div>
                    <div className="text-sm font-medium">{item.name}</div>
                    <div className="text-xs text-neutral-500">
                      SKU {item.sku} · Reorder threshold {item.reorderPoint} units
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono tabular-nums font-semibold text-amber-600 dark:text-amber-400">
                      {item.totalStock} left
                    </div>
                    <button
                      onClick={() => setActiveModule('products')}
                      className="text-xs text-[#A8833E] dark:text-[#C5A059] hover:underline"
                    >
                      Restock
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-500 py-6">
              All active SKUs are currently above their reorder threshold.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
