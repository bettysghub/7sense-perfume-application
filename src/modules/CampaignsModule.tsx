import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Plus, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  createDocWithTimestamps,
  logAuditEvent,
  makeId,
  updateDocWithTimestamp,
} from '../services/firestoreService';
import type { Campaign } from '../types';

export function CampaignsModule() {
  const { user, role, campaigns, products, regionalConfigs } = useApp();
  const [editing, setEditing] = useState<Partial<Campaign> | null>(null);
  const [saving, setSaving] = useState(false);

  const enriched = useMemo(() => {
    return campaigns.map((c) => {
      const spend = c.spendUsd || 0;
      const rev = c.attributedRevenueUsd || 0;
      const conv = c.conversions || 0;
      const clicks = c.clicks || 0;
      const roas = spend > 0 ? rev / spend : 0;
      const cac = conv > 0 ? spend / conv : 0;
      const cvr = clicks > 0 ? (conv / clicks) * 100 : 0;
      return { ...c, roas, cac, cvr };
    });
  }, [campaigns]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editing || !editing.name) return;
    setSaving(true);
    try {
      const payload = {
        name: editing.name.trim(),
        objective: editing.objective || 'Conversions',
        channel: editing.channel || 'Instagram',
        targetCountry: editing.targetCountry || 'United Arab Emirates',
        targetAudience: editing.targetAudience || '',
        productId: editing.productId || products[0]?.id || '',
        productName:
          products.find((p) => p.id === editing.productId)?.name || editing.productName || 'All Collection',
        budgetUsd: Number(editing.budgetUsd || 0),
        spendUsd: Number(editing.spendUsd || 0),
        impressions: Number(editing.impressions || 0),
        clicks: Number(editing.clicks || 0),
        conversions: Number(editing.conversions || 0),
        attributedRevenueUsd: Number(editing.attributedRevenueUsd || 0),
        abVariantA: editing.abVariantA || '',
        abVariantB: editing.abVariantB || '',
        abWinner: editing.abWinner || 'Testing',
        startDate: editing.startDate || new Date().toISOString().slice(0, 10),
        endDate: editing.endDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        status: editing.status || 'Draft',
        ownerUid: editing.ownerUid || user.uid,
        isDemo: false,
      };
      if (editing.id) {
        await updateDocWithTimestamp('campaigns', editing.id, payload);
        await logAuditEvent({
          actorRole: role,
          action: 'UPDATE_CAMPAIGN',
          module: 'Campaigns',
          targetId: editing.id,
          details: `Updated campaign ${payload.name}`,
        });
      } else {
        const id = makeId('camp');
        await createDocWithTimestamps('campaigns', id, payload);
        await logAuditEvent({
          actorRole: role,
          action: 'CREATE_CAMPAIGN',
          module: 'Campaigns',
          targetId: id,
          details: `Created campaign ${payload.name} (${payload.channel})`,
        });
      }
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <p className="text-xs tracking-wider uppercase text-[#A8833E] dark:text-[#C5A059] font-medium">
            Attribution, A/B Testing &amp; Paid Media ROAS
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold mt-1">
            Campaign Management
          </h1>
        </div>
        <button
          onClick={() =>
            setEditing({
              name: '',
              objective: 'Direct Storefront Conversions',
              channel: 'Instagram',
              targetCountry: 'United Arab Emirates',
              budgetUsd: 1000,
              spendUsd: 0,
              impressions: 0,
              clicks: 0,
              conversions: 0,
              attributedRevenueUsd: 0,
              abVariantA: '',
              abVariantB: '',
              abWinner: 'Testing',
              status: 'Draft',
            })
          }
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#C5A059] text-neutral-950 text-sm font-semibold hover:bg-[#D4B475]"
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </button>
      </div>

      {/* Comparison Chart */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] p-6">
        <h2 className="font-display text-xl font-semibold mb-1">
          Campaign Spend vs. Attributed Revenue (USD)
        </h2>
        <p className="text-xs text-neutral-500 mb-4">
          Metrics are computed strictly from imported/logged campaign performance records.
        </p>
        {enriched.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={enriched}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="spendUsd" name="Spend ($)" fill="#6B7280" radius={[4, 4, 0, 0]} />
                <Bar dataKey="attributedRevenueUsd" name="Attributed Revenue ($)" fill="#C5A059" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-neutral-500 py-10 text-center">No campaigns recorded yet.</p>
        )}
      </div>

      {/* Campaigns Table */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 text-xs text-neutral-500 text-left bg-neutral-50 dark:bg-[#16161B]">
                <th className="py-3 px-4 font-medium">Campaign</th>
                <th className="py-3 px-4 font-medium">Market &amp; Channel</th>
                <th className="py-3 px-4 font-medium">A/B Test</th>
                <th className="py-3 px-4 font-medium text-right">Spend / Budget</th>
                <th className="py-3 px-4 font-medium text-right">CVR / CAC</th>
                <th className="py-3 px-4 font-medium text-right">ROAS</th>
                <th className="py-3 px-4 font-medium text-right">Edit</th>
              </tr>
            </thead>
            <tbody>
              {enriched.map((c) => (
                <tr key={c.id} className="border-b border-neutral-100 dark:border-neutral-800/60">
                  <td className="py-3 px-4">
                    <div className="font-medium">
                      {c.name}
                      {c.isDemo && (
                        <span className="ml-2 text-[11px] font-mono text-[#A8833E] dark:text-[#C5A059]">
                          · DEMO
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-500">{c.status} · {c.productName}</div>
                  </td>
                  <td className="py-3 px-4 text-xs">
                    <div>{c.channel}</div>
                    <div className="text-neutral-500">{c.targetCountry}</div>
                  </td>
                  <td className="py-3 px-4 text-xs">
                    <div>A: {c.abVariantA || '—'}</div>
                    <div className="text-neutral-500">B: {c.abVariantB || '—'} · Winner: {c.abWinner || 'Pending'}</div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums">
                    <div>${c.spendUsd.toLocaleString()}</div>
                    <div className="text-xs text-neutral-500">of ${c.budgetUsd.toLocaleString()}</div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums">
                    <div>{c.cvr.toFixed(1)}%</div>
                    <div className="text-xs text-neutral-500">CAC ${c.cac.toFixed(2)}</div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-[#A8833E] dark:text-[#C5A059]">
                    {c.roas.toFixed(2)}x
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setEditing(c)}
                      className="text-xs font-medium text-[#A8833E] dark:text-[#C5A059] hover:underline"
                    >
                      Update
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleSave}
            className="bg-white dark:bg-[#121216] border border-neutral-200 dark:border-neutral-800 rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="font-display text-2xl font-semibold">
                {editing.id ? 'Update Campaign' : 'New Campaign'}
              </h3>
              <button type="button" onClick={() => setEditing(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <input
                required
                placeholder="Campaign Name *"
                value={editing.name || ''}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="sm:col-span-2 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent"
              />
              <select
                value={editing.channel || 'Instagram'}
                onChange={(e) => setEditing({ ...editing, channel: e.target.value as Campaign['channel'] })}
                className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141418]"
              >
                {['Instagram', 'TikTok', 'Facebook', 'Google Ads', 'WhatsApp', 'Email', 'Influencer'].map((ch) => (
                  <option key={ch} value={ch}>{ch}</option>
                ))}
              </select>
              <select
                value={editing.targetCountry || 'United Arab Emirates'}
                onChange={(e) => setEditing({ ...editing, targetCountry: e.target.value })}
                className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141418]"
              >
                {regionalConfigs.map((r) => (
                  <option key={r.countryCode} value={r.countryName}>{r.countryName}</option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                placeholder="Budget (USD)"
                value={editing.budgetUsd ?? 0}
                onChange={(e) => setEditing({ ...editing, budgetUsd: Number(e.target.value) })}
                className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent font-mono"
              />
              <input
                type="number"
                min={0}
                placeholder="Actual Spend (USD)"
                value={editing.spendUsd ?? 0}
                onChange={(e) => setEditing({ ...editing, spendUsd: Number(e.target.value) })}
                className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent font-mono"
              />
              <input
                type="number"
                min={0}
                placeholder="Clicks"
                value={editing.clicks ?? 0}
                onChange={(e) => setEditing({ ...editing, clicks: Number(e.target.value) })}
                className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent font-mono"
              />
              <input
                type="number"
                min={0}
                placeholder="Conversions"
                value={editing.conversions ?? 0}
                onChange={(e) => setEditing({ ...editing, conversions: Number(e.target.value) })}
                className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent font-mono"
              />
              <input
                type="number"
                min={0}
                placeholder="Attributed Revenue (USD)"
                value={editing.attributedRevenueUsd ?? 0}
                onChange={(e) => setEditing({ ...editing, attributedRevenueUsd: Number(e.target.value) })}
                className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent font-mono"
              />
              <select
                value={editing.status || 'Draft'}
                onChange={(e) => setEditing({ ...editing, status: e.target.value as Campaign['status'] })}
                className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141418]"
              >
                {['Draft', 'Scheduled', 'Active', 'Paused', 'Completed'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <input
                placeholder="A/B Variant A"
                value={editing.abVariantA || ''}
                onChange={(e) => setEditing({ ...editing, abVariantA: e.target.value })}
                className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent"
              />
              <input
                placeholder="A/B Variant B"
                value={editing.abVariantB || ''}
                onChange={(e) => setEditing({ ...editing, abVariantB: e.target.value })}
                className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent"
              />
            </div>
            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-[#C5A059] text-neutral-950 text-sm font-semibold"
              >
                {saving ? 'Saving...' : 'Save Campaign'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
