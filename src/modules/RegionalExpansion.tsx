import React, { useState } from 'react';
import { Globe, Save, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { logAuditEvent, updateDocWithTimestamp } from '../services/firestoreService';
import type { RegionalConfig } from '../types';

export function RegionalExpansion() {
  const { isAdmin, role, regionalConfigs, orders } = useApp();
  const [editing, setEditing] = useState<RegionalConfig | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !isAdmin) return;
    setSaving(true);
    try {
      await updateDocWithTimestamp('regionalConfigs', editing.id, {
        exchangeRatePerUsd: Number(editing.exchangeRatePerUsd),
        rateSource: editing.rateSource || 'Manual Treasury Update',
        rateUpdatedAt: new Date().toISOString(),
        vatPercent: Number(editing.vatPercent),
        shippingFlatUsd: Number(editing.shippingFlatUsd),
        freeShippingThresholdUsd: Number(editing.freeShippingThresholdUsd || 150),
        storefrontActive: Boolean(editing.storefrontActive),
        audienceNotes: editing.audienceNotes || '',
      });
      await logAuditEvent({
        actorRole: role,
        action: 'UPDATE_REGIONAL_CONFIG',
        module: 'Regional Expansion',
        targetId: editing.id,
        details: `Updated ${editing.countryName} (${editing.currency}) FX=${editing.exchangeRatePerUsd}, VAT=${editing.vatPercent}%`,
      });
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="pb-6 border-b border-neutral-200 dark:border-neutral-800">
        <p className="text-xs tracking-wider uppercase text-[#A8833E] dark:text-[#C5A059] font-medium">
          UAE, West Africa, East Africa &amp; International Storefronts
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold mt-1">
          Regional Expansion &amp; Exchange Rates
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {regionalConfigs.map((reg) => {
          const regionOrders = orders.filter((o) => o.country === reg.countryName);
          const regionRevUsd = regionOrders.reduce((s, o) => s + (o.totalUsd || 0), 0);

          return (
            <div
              key={reg.countryCode}
              className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] p-6 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-neutral-500">
                  <span>{reg.region} Hub · {reg.countryCode}</span>
                  <span className={reg.storefrontActive ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-neutral-400'}>
                    {reg.storefrontActive ? 'Storefront Active' : 'Paused'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#C5A059]" />
                  <h2 className="font-display text-2xl font-semibold">{reg.countryName}</h2>
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  {reg.audienceNotes}
                </p>
              </div>

              <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Exchange Rate</span>
                  <span className="font-mono tabular-nums font-semibold">
                    1 USD = {reg.exchangeRatePerUsd.toLocaleString()} {reg.currency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Rate Source</span>
                  <span className="truncate max-w-[170px]" title={reg.rateSource}>
                    {reg.rateSource || 'Configurable'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Rate Updated</span>
                  <span className="font-mono">
                    {reg.rateUpdatedAt ? reg.rateUpdatedAt.slice(0, 10) : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">VAT / Shipping</span>
                  <span className="font-mono tabular-nums">
                    {reg.vatPercent}% VAT · ${reg.shippingFlatUsd} flat (Free &gt;${reg.freeShippingThresholdUsd || 150})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Recorded Orders</span>
                  <span className="font-mono tabular-nums font-semibold">
                    {regionOrders.length} (${regionRevUsd.toFixed(0)})
                  </span>
                </div>
              </div>

              {isAdmin && (
                <button
                  onClick={() => setEditing(reg)}
                  className="w-full py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs font-semibold hover:border-[#C5A059] transition-colors"
                >
                  Configure FX, Tax &amp; Storefront
                </button>
              )}
            </div>
          );
        })}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleSave}
            className="bg-white dark:bg-[#121216] border border-neutral-200 dark:border-neutral-800 rounded-xl max-w-md w-full p-6 space-y-4 text-sm"
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="font-display text-2xl font-semibold">
                {editing.countryName} ({editing.currency})
              </h3>
              <button type="button" onClick={() => setEditing(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-neutral-500 mb-1">
                  Exchange Rate (1 USD to {editing.currency})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0.01}
                  value={editing.exchangeRatePerUsd}
                  onChange={(e) =>
                    setEditing({ ...editing, exchangeRatePerUsd: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">FX Rate Source</label>
                <input
                  value={editing.rateSource || ''}
                  onChange={(e) => setEditing({ ...editing, rateSource: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-neutral-500 mb-1">VAT / Tax (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    value={editing.vatPercent}
                    onChange={(e) => setEditing({ ...editing, vatPercent: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-500 mb-1">Flat Shipping (USD)</label>
                  <input
                    type="number"
                    min={0}
                    value={editing.shippingFlatUsd}
                    onChange={(e) =>
                      setEditing({ ...editing, shippingFlatUsd: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent font-mono"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs pt-1">
                <input
                  type="checkbox"
                  checked={editing.storefrontActive}
                  onChange={(e) => setEditing({ ...editing, storefrontActive: e.target.checked })}
                />
                Regional Storefront Active
              </label>
              <textarea
                rows={2}
                value={editing.audienceNotes || ''}
                onChange={(e) => setEditing({ ...editing, audienceNotes: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[#C5A059] text-neutral-950 font-semibold"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Market'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
