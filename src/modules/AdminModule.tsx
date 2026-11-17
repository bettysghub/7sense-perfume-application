import React, { useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { CheckCircle2, KeyRound, Shield, Users } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { db } from '../firebase';
import { logAuditEvent, updateDocWithTimestamp } from '../services/firestoreService';
import type { IntegrationSetting, StaffRole } from '../types';

const ROLES: { role: StaffRole; scope: string }[] = [
  { role: 'ceo', scope: 'Full Executive Access, RBAC, Financials, Integrations & Security' },
  { role: 'manager', scope: 'Operations, Orders, Inventory, CRM, Campaigns & BI' },
  { role: 'marketing', scope: 'AI Marketing Studio, Campaigns, WhatsApp/Email & CRM' },
  { role: 'sales', scope: 'Storefront, Orders, CRM Pipeline & AI Sales Concierge' },
  { role: 'warehouse', scope: 'Products, Multi-Warehouse Stock Movements & Order Fulfillment' },
  { role: 'accountant', scope: 'Financial Analytics, Expenses, Tax/FX & BI Reports' },
  { role: 'customer', scope: 'Storefront Browsing, Fragrance Quiz & Own Orders' },
];

export function AdminModule() {
  const { user, isAdmin, role, usersList, integrationSettings, auditLogs } = useApp();
  const [testingId, setTestingId] = useState<string | null>(null);
  const [draftAdapters, setDraftAdapters] = useState<
    Record<string, { accountIdentifier: string; endpointOrSender: string; mode: IntegrationSetting['mode'] }>
  >({});

  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] p-8 text-center space-y-2">
        <Shield className="w-6 h-6 mx-auto text-[#C5A059]" />
        <h2 className="font-display text-2xl font-semibold">Executive Access Required</h2>
        <p className="text-sm text-neutral-500">
          Role permissions, integration settings, and audit logs are restricted to verified CEO / Admin accounts.
        </p>
      </div>
    );
  }

  const handleRoleChange = async (targetUid: string, nextRole: StaffRole) => {
    await updateDocWithTimestamp('users', targetUid, { role: nextRole });
    if (nextRole !== 'customer') {
      await setDoc(doc(db, 'staffRoles', targetUid), {
        role: nextRole,
        updatedAt: serverTimestamp(),
      });
    }
    await logAuditEvent({
      actorRole: role,
      action: 'UPDATE_USER_ROLE',
      module: 'Administration',
      targetId: targetUid,
      details: `Assigned RBAC role "${nextRole}" to user ${targetUid}`,
    });
  };

  const handleSaveAdapter = async (item: IntegrationSetting) => {
    if (!user) return;
    setTestingId(item.id);
    try {
      const draft = draftAdapters[item.id] || {
        accountIdentifier: item.accountIdentifier || '',
        endpointOrSender: item.endpointOrSender || '',
        mode: item.mode || 'unconfigured',
      };

      const checkRes = await fetch('/api/integrations/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: item.id,
          accountIdentifier: draft.accountIdentifier,
          endpointOrSender: draft.endpointOrSender,
          mode: draft.mode,
        }),
      });
      const checkData = await checkRes.json();

      await updateDocWithTimestamp('integrationSettings', item.id, {
        accountIdentifier: draft.accountIdentifier,
        endpointOrSender: draft.endpointOrSender,
        mode: draft.mode,
        configured: Boolean(checkData.verified),
        lastTestedAt: new Date().toISOString(),
        testStatus: checkData.status || 'Checked',
      });

      await logAuditEvent({
        actorRole: role,
        action: 'VERIFY_INTEGRATION',
        module: 'Administration',
        targetId: item.id,
        details: `${item.providerName}: ${checkData.status}`,
      });
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="pb-6 border-b border-neutral-200 dark:border-neutral-800">
        <p className="text-xs tracking-wider uppercase text-[#A8833E] dark:text-[#C5A059] font-medium">
          RBAC Governance, API Adapters &amp; Immutable Audit Trail
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold mt-1">
          System Administration &amp; Security
        </h1>
      </div>

      {/* Role Permissions Matrix + Users */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#C5A059]" />
            <h2 className="font-display text-xl font-semibold">RBAC Permission Matrix</h2>
          </div>
          <div className="space-y-2.5 text-xs">
            {ROLES.map((r) => (
              <div
                key={r.role}
                className="p-3 rounded-lg border border-neutral-100 dark:border-neutral-800/80"
              >
                <div className="font-semibold uppercase tracking-wider text-[#A8833E] dark:text-[#C5A059]">
                  {r.role}
                </div>
                <div className="text-neutral-600 dark:text-neutral-400 mt-0.5">{r.scope}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] p-6 space-y-4">
          <h2 className="font-display text-xl font-semibold">User Access Management ({usersList.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 text-xs text-neutral-500 text-left">
                  <th className="py-2 font-medium">User</th>
                  <th className="py-2 font-medium">Department</th>
                  <th className="py-2 font-medium text-right">Assigned Role</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map((u) => (
                  <tr key={u.uid} className="border-b border-neutral-100 dark:border-neutral-800/60">
                    <td className="py-2.5">
                      <div className="font-medium">{u.displayName}</div>
                      <div className="text-xs text-neutral-500">{u.email}</div>
                    </td>
                    <td className="py-2.5 text-xs text-neutral-500">{u.department || 'General'}</td>
                    <td className="py-2.5 text-right">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.uid, e.target.value as StaffRole)}
                        className="px-2.5 py-1 rounded-md text-xs border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141418]"
                      >
                        {ROLES.map((r) => (
                          <option key={r.role} value={r.role}>{r.role}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Secure Integration Adapters */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] p-6 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-[#C5A059]" />
          <h2 className="font-display text-xl font-semibold">
            External Gateway &amp; Messaging Adapters
          </h2>
        </div>
        <p className="text-xs text-neutral-500">
          Store only non-secret merchant identifiers here. Secret API tokens (WHATSAPP_ACCESS_TOKEN, RESEND_API_KEY, STRIPE_SECRET_KEY, PAYSTACK_SECRET_KEY, FLUTTERWAVE_SECRET_KEY) must be configured in your server environment Secrets panel. Raw card data is never collected or stored.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {integrationSettings.map((item) => {
            const draft = draftAdapters[item.id] || {
              accountIdentifier: item.accountIdentifier || '',
              endpointOrSender: item.endpointOrSender || '',
              mode: item.mode,
            };
            return (
              <div
                key={item.id}
                className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-3 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm">{item.providerName}</div>
                  <span
                    className={`inline-flex items-center gap-1 font-medium ${
                      item.configured ? 'text-emerald-500' : 'text-amber-500'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {item.configured ? 'Verified' : 'Not Connected'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    placeholder="Account / Phone ID"
                    value={draft.accountIdentifier}
                    onChange={(e) =>
                      setDraftAdapters({
                        ...draftAdapters,
                        [item.id]: { ...draft, accountIdentifier: e.target.value },
                      })
                    }
                    className="px-2.5 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-800 bg-transparent"
                  />
                  <input
                    placeholder="Sender / Webhook URL"
                    value={draft.endpointOrSender}
                    onChange={(e) =>
                      setDraftAdapters({
                        ...draftAdapters,
                        [item.id]: { ...draft, endpointOrSender: e.target.value },
                      })
                    }
                    className="px-2.5 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-800 bg-transparent"
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <select
                    value={draft.mode}
                    onChange={(e) =>
                      setDraftAdapters({
                        ...draftAdapters,
                        [item.id]: { ...draft, mode: e.target.value as IntegrationSetting['mode'] },
                      })
                    }
                    className="px-2.5 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141418]"
                  >
                    <option value="unconfigured">Unconfigured</option>
                    <option value="sandbox">Sandbox Mode</option>
                    <option value="live">Live Mode</option>
                  </select>
                  <button
                    onClick={() => handleSaveAdapter(item)}
                    disabled={testingId === item.id}
                    className="px-3.5 py-1.5 rounded-md bg-[#C5A059] text-neutral-950 font-semibold"
                  >
                    {testingId === item.id ? 'Verifying...' : 'Save & Test'}
                  </button>
                </div>

                <div className="text-[11px] text-neutral-500">{item.testStatus}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Audit Logs */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] p-6 space-y-4">
        <h2 className="font-display text-xl font-semibold">Audit Trail ({auditLogs.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 text-left">
                <th className="py-2 font-medium">Actor</th>
                <th className="py-2 font-medium">Module</th>
                <th className="py-2 font-medium">Action</th>
                <th className="py-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.slice(0, 20).map((log) => (
                <tr key={log.id} className="border-b border-neutral-100 dark:border-neutral-800/60">
                  <td className="py-2 font-mono">{log.actorEmail} ({log.actorRole})</td>
                  <td className="py-2">{log.module}</td>
                  <td className="py-2 font-mono text-[#A8833E] dark:text-[#C5A059]">{log.action}</td>
                  <td className="py-2 text-neutral-600 dark:text-neutral-300">{log.details}</td>
                </tr>
              ))}
              {auditLogs.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-neutral-500">
                    Audit events will appear here as actions are performed.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
