import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, FileText, Plus, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  convertUsdToLocal,
  exportFinancialPdfReport,
  exportToCsv,
  formatCurrency,
} from '../utils/currency';
import { createDocWithTimestamps, logAuditEvent, makeId } from '../services/firestoreService';
import type { CurrencyCode, Expense } from '../types';

export function FinanceModule() {
  const { user, role, orders, expenses, regionalConfigs, displayCurrency } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [category, setCategory] = useState<Expense['category']>('Marketing');
  const [description, setDescription] = useState('');
  const [country, setCountry] = useState('United Arab Emirates');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [amountLocal, setAmountLocal] = useState(250);
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const fmt = (usd: number) =>
    formatCurrency(convertUsdToLocal(usd, displayCurrency, regionalConfigs), displayCurrency);

  const financials = useMemo(() => {
    const activeOrders = orders.filter((o) => o.status !== 'Cancelled');
    const refundsUsd = activeOrders
      .filter((o) => o.status === 'Refunded')
      .reduce((s, o) => s + (o.totalUsd || 0), 0);
    const grossSalesUsd = activeOrders
      .filter((o) => o.status !== 'Refunded')
      .reduce((s, o) => s + (o.totalUsd || 0), 0);
    const discountsUsd = activeOrders.reduce(
      (s, o) => s + (o.discountLocal || 0) / (o.exchangeRateToUsd || 1),
      0
    );
    const taxesCollectedUsd = activeOrders.reduce(
      (s, o) => s + (o.taxLocal || 0) / (o.exchangeRateToUsd || 1),
      0
    );
    const cogsUsd = activeOrders
      .filter((o) => o.status !== 'Refunded')
      .reduce((s, o) => s + (o.cogsUsd || 0), 0);
    const grossProfitUsd = grossSalesUsd - cogsUsd;
    const grossMarginPct = grossSalesUsd > 0 ? (grossProfitUsd / grossSalesUsd) * 100 : 0;
    const totalExpensesUsd = expenses.reduce((s, e) => s + (e.amountUsd || 0), 0);
    const netProfitUsd = grossProfitUsd - totalExpensesUsd;

    return {
      grossSalesUsd,
      refundsUsd,
      discountsUsd,
      taxesCollectedUsd,
      cogsUsd,
      grossProfitUsd,
      grossMarginPct,
      totalExpensesUsd,
      netProfitUsd,
    };
  }, [orders, expenses]);

  const byChannel = useMemo(() => {
    const map = new Map<string, { channel: string; revenueUsd: number; profitUsd: number }>();
    orders
      .filter((o) => o.status !== 'Cancelled' && o.status !== 'Refunded')
      .forEach((o) => {
        const cur = map.get(o.channel) || { channel: o.channel, revenueUsd: 0, profitUsd: 0 };
        cur.revenueUsd += o.totalUsd;
        cur.profitUsd += o.totalUsd - o.cogsUsd;
        map.set(o.channel, cur);
      });
    return Array.from(map.values());
  }, [orders]);

  const byProduct = useMemo(() => {
    const map = new Map<string, { name: string; revenueUsd: number; profitUsd: number }>();
    orders
      .filter((o) => o.status !== 'Cancelled' && o.status !== 'Refunded')
      .forEach((o) => {
        const rate = o.exchangeRateToUsd || 1;
        o.items.forEach((it) => {
          const cur = map.get(it.name) || { name: it.name, revenueUsd: 0, profitUsd: 0 };
          const revUsd = it.lineTotalLocal / rate;
          const costUsd = it.unitCostUsd * it.quantity;
          cur.revenueUsd += revUsd;
          cur.profitUsd += revUsd - costUsd;
          map.set(it.name, cur);
        });
      });
    return Array.from(map.values()).sort((a, b) => b.profitUsd - a.profitUsd);
  }, [orders]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !description.trim()) return;
    setSaving(true);
    try {
      const rate = regionalConfigs.find((r) => r.currency === currency)?.exchangeRatePerUsd || 1;
      const amountUsd = currency === 'USD' ? amountLocal : amountLocal / rate;
      const id = makeId('exp');
      await createDocWithTimestamps(
        'expenses',
        id,
        {
          category,
          description: description.trim(),
          country,
          currency,
          amountLocal,
          amountUsd: Number(amountUsd.toFixed(2)),
          expenseDate,
          ownerUid: user.uid,
          isDemo: false,
        },
        false
      );
      await logAuditEvent({
        actorRole: role,
        action: 'RECORD_EXPENSE',
        module: 'Financial Analytics',
        targetId: id,
        details: `Recorded ${category} expense: $${amountUsd.toFixed(2)} USD`,
      });
      setDescription('');
      setModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <p className="text-xs tracking-wider uppercase text-[#A8833E] dark:text-[#C5A059] font-medium">
            Calculated P&amp;L, COGS, Taxes &amp; Margin Analysis
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold mt-1">
            Financial Analytics &amp; Ledger
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() =>
              exportToCsv(
                '7sense-financial-ledger.csv',
                expenses.map((e) => ({
                  Date: e.expenseDate,
                  Category: e.category,
                  Country: e.country,
                  Currency: e.currency,
                  AmountLocal: e.amountLocal,
                  AmountUSD: e.amountUsd,
                  Description: e.description,
                }))
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            onClick={() =>
              exportFinancialPdfReport({
                title: '7Sense Financial P&L Report',
                subtitle: `Display Currency: ${displayCurrency} · Calculated from Firestore Orders & Expenses`,
                metrics: [
                  { label: 'Gross Sales Revenue', value: fmt(financials.grossSalesUsd) },
                  { label: 'Cost of Goods Sold', value: fmt(financials.cogsUsd) },
                  {
                    label: 'Gross Profit (Calculated)',
                    value: `${fmt(financials.grossProfitUsd)} (${financials.grossMarginPct.toFixed(1)}%)`,
                  },
                  { label: 'Operating & Marketing Costs', value: fmt(financials.totalExpensesUsd) },
                  { label: 'VAT / Taxes Collected', value: fmt(financials.taxesCollectedUsd) },
                  { label: 'Estimated Net Profit', value: fmt(financials.netProfitUsd) },
                ],
                tableHeaders: ['Product', 'Revenue (USD)', 'Gross Profit (USD)'],
                tableRows: byProduct.map((p) => [
                  p.name,
                  `$${p.revenueUsd.toFixed(2)}`,
                  `$${p.profitUsd.toFixed(2)}`,
                ]),
                footerNote: 'Estimated Net Profit = Gross Sales - COGS - Recorded Expenses.',
              })
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs font-medium"
          >
            <FileText className="w-3.5 h-3.5" />
            Export PDF
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#C5A059] text-neutral-950 text-xs font-semibold hover:bg-[#D4B475]"
          >
            <Plus className="w-4 h-4" />
            Log Expense
          </button>
        </div>
      </div>

      {/* P&L KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Net Sales Revenue (Calculated)', val: fmt(financials.grossSalesUsd), sub: `Discounts ${fmt(financials.discountsUsd)} · Refunds ${fmt(financials.refundsUsd)}` },
          { label: 'Gross Profit & Margin', val: fmt(financials.grossProfitUsd), sub: `${financials.grossMarginPct.toFixed(1)}% margin · COGS ${fmt(financials.cogsUsd)}` },
          { label: 'Recorded Operating & Ad Costs', val: fmt(financials.totalExpensesUsd), sub: `${expenses.length} ledger entries` },
          { label: 'Estimated Net Profit', val: fmt(financials.netProfitUsd), sub: `VAT/Tax Collected: ${fmt(financials.taxesCollectedUsd)}` },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] p-5"
          >
            <div className="text-xs text-neutral-500">{card.label}</div>
            <div className="text-2xl font-mono font-semibold tabular-nums mt-2">{card.val}</div>
            <div className="text-xs text-neutral-500 mt-1.5">{card.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] p-6">
          <h2 className="font-display text-xl font-semibold mb-4">Profit by Product (USD)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byProduct}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="profitUsd" name="Gross Profit ($)" fill="#C5A059" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] p-6">
          <h2 className="font-display text-xl font-semibold mb-4">Profit by Sales Channel (USD)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byChannel}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                <XAxis dataKey="channel" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="revenueUsd" name="Revenue ($)" fill="#6B7280" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profitUsd" name="Gross Profit ($)" fill="#C5A059" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Expenses Ledger */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <h3 className="font-display text-xl font-semibold">Expense Ledger</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 text-xs text-neutral-500 text-left bg-neutral-50 dark:bg-[#16161B]">
                <th className="py-3 px-4 font-medium">Date</th>
                <th className="py-3 px-4 font-medium">Category</th>
                <th className="py-3 px-4 font-medium">Description</th>
                <th className="py-3 px-4 font-medium">Market</th>
                <th className="py-3 px-4 font-medium text-right">Amount (USD)</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((ex) => (
                <tr key={ex.id} className="border-b border-neutral-100 dark:border-neutral-800/60">
                  <td className="py-3 px-4 font-mono text-xs">{ex.expenseDate}</td>
                  <td className="py-3 px-4 font-medium">{ex.category}</td>
                  <td className="py-3 px-4 text-neutral-600 dark:text-neutral-300">
                    {ex.description}
                    {ex.isDemo && (
                      <span className="ml-2 text-[11px] font-mono text-[#A8833E] dark:text-[#C5A059]">
                        · DEMO
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-xs text-neutral-500">{ex.country}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                    ${ex.amountUsd.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleAddExpense}
            className="bg-white dark:bg-[#121216] border border-neutral-200 dark:border-neutral-800 rounded-xl max-w-md w-full p-6 space-y-4 text-sm"
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="font-display text-2xl font-semibold">Record Business Expense</h3>
              <button type="button" onClick={() => setModalOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Expense['category'])}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141418]"
            >
              {['Marketing', 'Logistics', 'Packaging', 'Salaries', 'Rent & Boutique', 'Customs & Duty', 'Other'].map(
                (c) => (
                  <option key={c} value={c}>{c}</option>
                )
              )}
            </select>
            <input
              required
              placeholder="Expense description *"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent"
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141418]"
              >
                {regionalConfigs.map((r) => (
                  <option key={r.countryCode} value={r.countryName}>{r.countryName}</option>
                ))}
              </select>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141418]"
              >
                {['USD', 'AED', 'NGN', 'GHS', 'KES', 'TZS', 'UGX'].map((cur) => (
                  <option key={cur} value={cur}>{cur}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                min={0}
                step="0.01"
                value={amountLocal}
                onChange={(e) => setAmountLocal(Number(e.target.value))}
                className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent font-mono"
              />
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-[#C5A059] text-neutral-950 font-semibold"
              >
                {saving ? 'Saving...' : 'Save Expense'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
