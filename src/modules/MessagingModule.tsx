import React, { useMemo, useState } from 'react';
import { AlertCircle, Mail, Send, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  createDocWithTimestamps,
  logAuditEvent,
  makeId,
  updateDocWithTimestamp,
} from '../services/firestoreService';

const TEMPLATES = [
  {
    name: 'VIP Eid & Festive Coffret Concierge',
    channel: 'WhatsApp Business' as const,
    subject: '',
    body: 'Salaam {{first_name}}, 7Sense Perfumes reserves early access to the Symphony Royal Gift Coffret. Reply YES to arrange private chauffeur delivery in your city. Reply STOP to opt out.',
  },
  {
    name: 'Eternal Citrus — Sunlit Launch Newsletter',
    channel: 'Email' as const,
    subject: 'Introducing Eternal Citrus · Symphony of Scent',
    body: 'Dear {{first_name}}, crafted with Calabrian bergamot and Tunisian neroli, Eternal Citrus brings 10-hour radiance to warm evenings. Manage preferences or unsubscribe at the footer link.',
  },
];

export function MessagingModule() {
  const { user, role, customers, messagingCampaigns, integrationSettings, setActiveModule } = useApp();

  const [channel, setChannel] = useState<'WhatsApp Business' | 'Email'>('WhatsApp Business');
  const [name, setName] = useState('');
  const [segment, setSegment] = useState('VIP');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState(TEMPLATES[0].body);
  const [scheduledAt, setScheduledAt] = useState(new Date().toISOString().slice(0, 16));
  const [saving, setSaving] = useState(false);

  const whatsappReady = Boolean(
    integrationSettings.find((i) => i.id === 'whatsapp' && i.configured && i.mode === 'live')
  );
  const emailReady = Boolean(
    integrationSettings.find((i) => i.id === 'email' && i.configured && i.mode === 'live')
  );

  const providerConfigured = channel === 'WhatsApp Business' ? whatsappReady : emailReady;

  const eligibleSubscribers = useMemo(() => {
    return customers.filter((c) => {
      const hasConsent = channel === 'WhatsApp Business' ? c.consentWhatsapp : c.consentEmail;
      if (!hasConsent) return false;
      if (segment === 'All Opt-In') return true;
      return c.segment === segment;
    });
  }, [customers, channel, segment]);

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim() || !body.trim()) return;
    setSaving(true);
    try {
      const id = makeId('msg');
      const status = providerConfigured ? 'Scheduled' : 'Requires Provider Credentials';
      await createDocWithTimestamps('messagingCampaigns', id, {
        name: name.trim(),
        channel,
        templateName: 'Custom Approved Template',
        segment,
        subject: channel === 'Email' ? subject : '',
        body,
        scheduledAt,
        status,
        recipientCount: eligibleSubscribers.length,
        deliveredCount: 0,
        openedCount: 0,
        clickedCount: 0,
        unsubscribedCount: 0,
        providerConfigured,
        ownerUid: user.uid,
        isDemo: false,
      });

      await logAuditEvent({
        actorRole: role,
        action: 'CREATE_MESSAGING_CAMPAIGN',
        module: 'WhatsApp & Email',
        targetId: id,
        details: `Created ${channel} campaign "${name}" (status: ${status})`,
      });
      setName('');
    } finally {
      setSaving(false);
    }
  };

  const handleUnsubscribe = async (customerId: string, targetChannel: 'email' | 'whatsapp') => {
    await updateDocWithTimestamp(
      'customers',
      customerId,
      targetChannel === 'email' ? { consentEmail: false } : { consentWhatsapp: false }
    );
    await logAuditEvent({
      actorRole: role,
      action: 'CUSTOMER_OPT_OUT',
      module: 'WhatsApp & Email',
      targetId: customerId,
      details: `Unsubscribed customer from ${targetChannel}`,
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <p className="text-xs tracking-wider uppercase text-[#A8833E] dark:text-[#C5A059] font-medium">
            Official APIs &amp; Explicit Opt-In Compliance
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold mt-1">
            WhatsApp Business &amp; Email Marketing
          </h1>
        </div>
        <button
          onClick={() => setActiveModule('admin')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs font-semibold hover:border-[#C5A059]"
        >
          <ShieldCheck className="w-4 h-4 text-[#C5A059]" />
          Configure API Credentials
        </button>
      </div>

      {/* Honest Provider Status Banner */}
      {!providerConfigured && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 flex items-start gap-3 text-sm">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-amber-700 dark:text-amber-300">
              {channel} Live Provider Not Connected
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1">
              Campaigns can be drafted, segmented, and saved with status <strong>Requires Provider Credentials</strong>, but live dispatch is blocked until an official {channel === 'WhatsApp Business' ? 'Meta WhatsApp Cloud API Token & Phone ID' : 'Verified Sender Domain & Email API Secret'} is configured and tested. Delivery is never simulated.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Composer */}
        <form
          onSubmit={handleSaveCampaign}
          className="lg:col-span-6 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] p-6 space-y-4 text-sm"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Campaign Composer</h2>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as 'WhatsApp Business' | 'Email')}
              className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141418] text-xs font-semibold"
            >
              <option value="WhatsApp Business">WhatsApp Business</option>
              <option value="Email">Authorized Email API</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.name}
                type="button"
                onClick={() => {
                  setChannel(tpl.channel);
                  setSubject(tpl.subject);
                  setBody(tpl.body);
                }}
                className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs hover:border-[#C5A059]"
              >
                Use Template: {tpl.name}
              </button>
            ))}
          </div>

          <input
            required
            placeholder="Campaign Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Opt-In Segment</label>
              <select
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141418]"
              >
                <option value="VIP">VIP ({customers.filter((c) => c.segment === 'VIP').length})</option>
                <option value="Repeat">Repeat</option>
                <option value="New">New</option>
                <option value="At Risk">At Risk</option>
                <option value="All Opt-In">All Opt-In</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Schedule Time</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent"
              />
            </div>
          </div>

          {channel === 'Email' && (
            <input
              placeholder="Email Subject Line"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent"
            />
          )}

          <div>
            <label className="block text-xs text-neutral-500 mb-1">
              Message Body (Include Opt-Out / Unsubscribe Notice)
            </label>
            <textarea
              required
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent"
            />
          </div>

          <div className="text-xs text-neutral-500">
            Eligible Consented Recipients in Segment: <strong className="font-mono">{eligibleSubscribers.length}</strong>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-lg bg-[#C5A059] text-neutral-950 font-semibold hover:bg-[#D4B475]"
          >
            <Send className="w-4 h-4" />
            {providerConfigured ? 'Schedule Approved Dispatch' : 'Save Draft (Credentials Required to Send)'}
          </button>
        </form>

        {/* Opt-In Subscribers & Saved Dispatches */}
        <div className="lg:col-span-6 space-y-6">
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] p-6">
            <h3 className="font-display text-xl font-semibold mb-3">
              Opt-In Subscribers ({eligibleSubscribers.length})
            </h3>
            {eligibleSubscribers.length === 0 ? (
              <p className="text-sm text-neutral-500">No opted-in contacts match this channel &amp; segment.</p>
            ) : (
              <div className="space-y-2.5 max-h-60 overflow-y-auto">
                {eligibleSubscribers.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between py-2 border-b border-neutral-100 dark:border-neutral-800/60 last:border-0 text-xs"
                  >
                    <div>
                      <div className="font-medium text-sm">{c.fullName}</div>
                      <div className="text-neutral-500">
                        {channel === 'WhatsApp Business' ? c.phone : c.email} · {c.country}
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        handleUnsubscribe(c.id, channel === 'WhatsApp Business' ? 'whatsapp' : 'email')
                      }
                      className="text-red-500 hover:underline"
                    >
                      Unsubscribe
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] p-6">
            <h3 className="font-display text-xl font-semibold mb-3">
              Saved Messaging Campaigns ({messagingCampaigns.length})
            </h3>
            {messagingCampaigns.length === 0 ? (
              <div className="text-sm text-neutral-500 flex items-center gap-2 py-4">
                <Mail className="w-4 h-4" />
                No messaging campaigns drafted yet.
              </div>
            ) : (
              <div className="space-y-3">
                {messagingCampaigns.map((m) => (
                  <div
                    key={m.id}
                    className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-sm">{m.name}</span>
                      <span className="text-[#A8833E] dark:text-[#C5A059]">{m.status}</span>
                    </div>
                    <div className="text-neutral-500">
                      {m.channel} · Segment: {m.segment} · Recipients: {m.recipientCount || 0}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
