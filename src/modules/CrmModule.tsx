import React, { useMemo, useState } from 'react';
import { Download, Plus, Search, Upload, UserPlus, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { exportToCsv } from '../utils/currency';
import {
  createDocWithTimestamps,
  logAuditEvent,
  makeId,
  updateDocWithTimestamp,
} from '../services/firestoreService';
import type { Customer } from '../types';

export function CrmModule() {
  const { user, role, customers, regionalConfigs } = useApp();
  const [search, setSearch] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('All');
  const [stageFilter, setStageFilter] = useState('All');
  const [editing, setEditing] = useState<Partial<Customer> | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      if (segmentFilter !== 'All' && c.segment !== segmentFilter) return false;
      if (stageFilter !== 'All' && c.pipelineStage !== stageFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          c.fullName.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.country.toLowerCase().includes(q) ||
          (c.preferredScentFamily || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [customers, segmentFilter, stageFilter, search]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editing || !editing.fullName || !editing.email) return;
    setSaving(true);
    try {
      const payload = {
        ownerUid: editing.ownerUid || user.uid,
        fullName: editing.fullName.trim(),
        email: editing.email.trim(),
        phone: editing.phone || '',
        country: editing.country || 'United Arab Emirates',
        city: editing.city || '',
        preferredScentFamily: editing.preferredScentFamily || 'Citrus & Woods',
        birthday: editing.birthday || '',
        consentEmail: Boolean(editing.consentEmail),
        consentWhatsapp: Boolean(editing.consentWhatsapp),
        loyaltyPoints: Number(editing.loyaltyPoints || 0),
        segment: editing.segment || 'Lead',
        pipelineStage: editing.pipelineStage || 'Lead',
        totalSpentUsd: Number(editing.totalSpentUsd || 0),
        ordersCount: Number(editing.ordersCount || 0),
        ltvUsd: Number(editing.ltvUsd || editing.totalSpentUsd || 0),
        notes: editing.notes || '',
        nextFollowUpDate: editing.nextFollowUpDate || '',
        isDemo: false,
      };

      if (editing.id) {
        await updateDocWithTimestamp('customers', editing.id, payload);
        await logAuditEvent({
          actorRole: role,
          action: 'UPDATE_CUSTOMER',
          module: 'CRM',
          targetId: editing.id,
          details: `Updated CRM profile for ${payload.fullName}`,
        });
      } else {
        const id = makeId('cust');
        await createDocWithTimestamps('customers', id, payload);
        await logAuditEvent({
          actorRole: role,
          action: 'CREATE_CUSTOMER',
          module: 'CRM',
          targetId: id,
          details: `Added CRM customer ${payload.fullName} (${payload.country})`,
        });
      }
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return;
    const headers = lines[0].split(',').map((h) => h.replace(/"/g, '').trim().toLowerCase());
    for (const line of lines.slice(1, 50)) {
      const cols = line.split(',').map((c) => c.replace(/^"|"$/g, '').trim());
      const getVal = (key: string) => {
        const idx = headers.findIndex((h) => h.includes(key));
        return idx >= 0 ? cols[idx] : '';
      };
      const fullName = getVal('name') || 'Imported Lead';
      const email = getVal('email');
      if (!email) continue;
      const id = makeId('cust');
      await createDocWithTimestamps('customers', id, {
        ownerUid: user.uid,
        fullName,
        email,
        phone: getVal('phone') || '',
        country: getVal('country') || 'United Arab Emirates',
        city: getVal('city') || '',
        preferredScentFamily: getVal('scent') || 'Signature Blend',
        consentEmail: true,
        consentWhatsapp: Boolean(getVal('phone')),
        loyaltyPoints: 0,
        segment: 'Lead',
        pipelineStage: 'Lead',
        totalSpentUsd: 0,
        ordersCount: 0,
        ltvUsd: 0,
        notes: 'Imported via CRM CSV uploader',
        isDemo: false,
      });
    }
    await logAuditEvent({
      actorRole: role,
      action: 'IMPORT_CRM_CSV',
      module: 'CRM',
      details: `Imported customer contacts from ${file.name}`,
    });
    e.target.value = '';
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <p className="text-xs tracking-wider uppercase text-[#A8833E] dark:text-[#C5A059] font-medium">
            Clienteling, Loyalty &amp; Pipeline
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold mt-1">
            Customer Relationship Management
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141418] text-xs font-medium cursor-pointer hover:border-[#C5A059]">
            <Upload className="w-3.5 h-3.5" />
            Import CSV
            <input type="file" accept=".csv" onChange={handleCsvImport} className="hidden" />
          </label>
          <button
            onClick={() =>
              exportToCsv(
                '7sense-crm-customers.csv',
                filtered.map((c) => ({
                  Name: c.fullName,
                  Email: c.email,
                  Phone: c.phone || '',
                  Country: c.country,
                  Segment: c.segment,
                  Stage: c.pipelineStage,
                  LTV_USD: c.ltvUsd,
                  LoyaltyPoints: c.loyaltyPoints,
                  EmailOptIn: c.consentEmail,
                  WhatsAppOptIn: c.consentWhatsapp,
                }))
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141418] text-xs font-medium hover:border-[#C5A059]"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            onClick={() =>
              setEditing({
                fullName: '',
                email: '',
                phone: '',
                country: 'United Arab Emirates',
                city: '',
                preferredScentFamily: 'Eternal Citrus',
                consentEmail: true,
                consentWhatsapp: true,
                loyaltyPoints: 0,
                segment: 'Lead',
                pipelineStage: 'Lead',
                totalSpentUsd: 0,
                ordersCount: 0,
                ltvUsd: 0,
                notes: '',
                nextFollowUpDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
              })
            }
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#C5A059] text-neutral-950 text-xs font-semibold hover:bg-[#D4B475]"
          >
            <UserPlus className="w-4 h-4" />
            Add Client / Lead
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search name, email, country, scent..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm bg-white dark:bg-[#141418] border border-neutral-200 dark:border-neutral-800"
          />
        </div>
        <select
          value={segmentFilter}
          onChange={(e) => setSegmentFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm bg-white dark:bg-[#141418] border border-neutral-200 dark:border-neutral-800"
        >
          {['All', 'VIP', 'Repeat', 'New', 'Lead', 'At Risk'].map((s) => (
            <option key={s} value={s}>Segment: {s}</option>
          ))}
        </select>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm bg-white dark:bg-[#141418] border border-neutral-200 dark:border-neutral-800"
        >
          {['All', 'Lead', 'Qualified', 'Proposal', 'Customer', 'Repeat Advocate'].map((st) => (
            <option key={st} value={st}>Pipeline: {st}</option>
          ))}
        </select>
      </div>

      {/* Customer Table */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 text-xs text-neutral-500 text-left bg-neutral-50 dark:bg-[#16161B]">
                <th className="py-3 px-4 font-medium">Client</th>
                <th className="py-3 px-4 font-medium">Market &amp; Scent Profile</th>
                <th className="py-3 px-4 font-medium">Segment &amp; Pipeline</th>
                <th className="py-3 px-4 font-medium">Consent</th>
                <th className="py-3 px-4 font-medium text-right">LTV / Loyalty</th>
                <th className="py-3 px-4 font-medium">Next Follow-Up</th>
                <th className="py-3 px-4 font-medium text-right">Edit</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-neutral-100 dark:border-neutral-800/60">
                  <td className="py-3 px-4">
                    <div className="font-medium">
                      {c.fullName}
                      {c.isDemo && (
                        <span className="ml-2 text-[11px] font-mono text-[#A8833E] dark:text-[#C5A059]">
                          · DEMO
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-500">{c.email} · {c.phone || 'No phone'}</div>
                  </td>
                  <td className="py-3 px-4 text-xs">
                    <div>{c.city ? `${c.city}, ` : ''}{c.country}</div>
                    <div className="text-neutral-500">{c.preferredScentFamily || 'Unassigned'}</div>
                  </td>
                  <td className="py-3 px-4 text-xs">
                    <div className="font-semibold">{c.segment}</div>
                    <div className="text-neutral-500">{c.pipelineStage}</div>
                  </td>
                  <td className="py-3 px-4 text-xs text-neutral-500">
                    {c.consentEmail ? 'Email Yes' : 'Email No'} · {c.consentWhatsapp ? 'WA Yes' : 'WA No'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums">
                    <div className="font-semibold">${c.ltvUsd.toLocaleString()}</div>
                    <div className="text-xs text-neutral-500">{c.loyaltyPoints} pts · {c.ordersCount} orders</div>
                  </td>
                  <td className="py-3 px-4 text-xs font-mono text-neutral-500">
                    {c.nextFollowUpDate || '—'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setEditing(c)}
                      className="text-xs font-medium text-[#A8833E] dark:text-[#C5A059] hover:underline"
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-neutral-500">
                    No customer records match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit CRM Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleSave}
            className="bg-white dark:bg-[#121216] border border-neutral-200 dark:border-neutral-800 rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="font-display text-2xl font-semibold">
                {editing.id ? editing.fullName : 'New CRM Contact'}
              </h3>
              <button type="button" onClick={() => setEditing(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <input
                required
                placeholder="Full Name *"
                value={editing.fullName || ''}
                onChange={(e) => setEditing({ ...editing, fullName: e.target.value })}
                className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent"
              />
              <input
                required
                type="email"
                placeholder="Email *"
                value={editing.email || ''}
                onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent"
              />
              <input
                placeholder="WhatsApp / Phone"
                value={editing.phone || ''}
                onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent"
              />
              <select
                value={editing.country || 'United Arab Emirates'}
                onChange={(e) => setEditing({ ...editing, country: e.target.value })}
                className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141418]"
              >
                {regionalConfigs.map((r) => (
                  <option key={r.countryCode} value={r.countryName}>{r.countryName}</option>
                ))}
              </select>
              <select
                value={editing.segment || 'Lead'}
                onChange={(e) => setEditing({ ...editing, segment: e.target.value as Customer['segment'] })}
                className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141418]"
              >
                {['VIP', 'Repeat', 'New', 'Lead', 'At Risk'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                value={editing.pipelineStage || 'Lead'}
                onChange={(e) =>
                  setEditing({ ...editing, pipelineStage: e.target.value as Customer['pipelineStage'] })
                }
                className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141418]"
              >
                {['Lead', 'Qualified', 'Proposal', 'Customer', 'Repeat Advocate'].map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <input
                placeholder="Preferred Scent Family"
                value={editing.preferredScentFamily || ''}
                onChange={(e) => setEditing({ ...editing, preferredScentFamily: e.target.value })}
                className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent"
              />
              <input
                type="date"
                value={editing.nextFollowUpDate || ''}
                onChange={(e) => setEditing({ ...editing, nextFollowUpDate: e.target.value })}
                className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent"
              />
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={Boolean(editing.consentEmail)}
                  onChange={(e) => setEditing({ ...editing, consentEmail: e.target.checked })}
                />
                Email Marketing Opt-In
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={Boolean(editing.consentWhatsapp)}
                  onChange={(e) => setEditing({ ...editing, consentWhatsapp: e.target.checked })}
                />
                WhatsApp Concierge Opt-In
              </label>
              <textarea
                rows={3}
                placeholder="Concierge notes & gifting preferences..."
                value={editing.notes || ''}
                onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                className="sm:col-span-2 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent"
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
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[#C5A059] text-neutral-950 text-sm font-semibold"
              >
                <Plus className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Contact'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
