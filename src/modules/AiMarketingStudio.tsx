import React, { useState } from 'react';
import { Calendar, Check, Sparkles, XCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  createDocWithTimestamps,
  logAuditEvent,
  makeId,
  updateDocWithTimestamp,
} from '../services/firestoreService';
import type { AiContent } from '../types';

export function AiMarketingStudio() {
  const { user, role, products, regionalConfigs, aiContent } = useApp();

  const [productId, setProductId] = useState(products[0]?.id || '');
  const [targetCountry, setTargetCountry] = useState('United Arab Emirates');
  const [platform, setPlatform] = useState('Instagram Caption & Carousel');
  const [objective, setObjective] = useState('Luxury Conversions & Gifting');
  const [targetAudience, setTargetAudience] = useState('Affluent professionals & collectors aged 25-48');
  const [tone, setTone] = useState('Opulent, Modern, Sensory');
  const [language, setLanguage] = useState('English');
  const [budgetTier, setBudgetTier] = useState('High-Touch Growth ($1,000 - $3,000)');
  const [scheduledDate, setScheduledDate] = useState(
    new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)
  );

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<{
    title: string;
    variations: string[];
    hashtags: string[];
    cta: string;
    creativeBrief: string;
    postingSchedule: string;
  } | null>(null);

  const selectedProduct = products.find((p) => p.id === productId) || products[0];

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/marketing-studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: selectedProduct.name,
          fragranceNotes: selectedProduct.fragranceNotes,
          targetCountry,
          targetAudience,
          objective,
          platform,
          tone,
          language,
          budgetTier,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate marketing content.');
      }
      setGenerated(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation error.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveToCalendar = async () => {
    if (!user || !generated || !selectedProduct) return;
    const id = makeId('aic');
    await createDocWithTimestamps('aiContent', id, {
      productName: selectedProduct.name,
      platform,
      targetCountry,
      targetAudience,
      objective,
      tone,
      language,
      title: generated.title,
      variations: generated.variations.slice(0, 5),
      hashtags: (generated.hashtags || []).slice(0, 15),
      cta: generated.cta,
      creativeBrief: generated.creativeBrief,
      postingSchedule: generated.postingSchedule,
      scheduledDate,
      approvalStatus: 'Pending Review',
      ownerUid: user.uid,
    });
    await logAuditEvent({
      actorRole: role,
      action: 'SAVE_AI_CONTENT',
      module: 'AI Marketing Studio',
      targetId: id,
      details: `Saved AI campaign "${generated.title}" for approval (never auto-published).`,
    });
    setGenerated(null);
  };

  const handleApproval = async (item: AiContent, next: AiContent['approvalStatus']) => {
    await updateDocWithTimestamp('aiContent', item.id, { approvalStatus: next });
    await logAuditEvent({
      actorRole: role,
      action: `AI_CONTENT_${next.toUpperCase().replace(/\s+/g, '_')}`,
      module: 'AI Marketing Studio',
      targetId: item.id,
      details: `Content "${item.title}" marked ${next}`,
    });
  };

  return (
    <div className="space-y-8">
      <div className="pb-6 border-b border-neutral-200 dark:border-neutral-800">
        <p className="text-xs tracking-wider uppercase text-[#A8833E] dark:text-[#C5A059] font-medium">
          Gemini 4 Hydrogen · Human-Approved Publishing Only
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold mt-1">
          AI Marketing Studio &amp; Content Calendar
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Generator Controls */}
        <form
          onSubmit={handleGenerate}
          className="lg:col-span-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] p-6 space-y-4 text-sm h-fit"
        >
          <h2 className="font-display text-xl font-semibold">Campaign Brief</h2>

          <div>
            <label className="block text-xs text-neutral-500 mb-1">Product</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141418]"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.category})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Target Market</label>
              <select
                value={targetCountry}
                onChange={(e) => setTargetCountry(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141418]"
              >
                {regionalConfigs.map((r) => (
                  <option key={r.countryCode} value={r.countryName}>{r.countryName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Platform / Format</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141418]"
              >
                {[
                  'Instagram Caption & Carousel',
                  'TikTok Video Script',
                  'Facebook Ad Copy',
                  'Google Search Ads',
                  'WhatsApp VIP Broadcast Draft',
                  'Email Newsletter',
                  'SEO Product Description',
                  'Influencer Outreach Brief',
                  'Luxury Storytelling Editorial',
                ].map((pl) => (
                  <option key={pl} value={pl}>{pl}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Tone</label>
              <input
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141418]"
              >
                {['English', 'Arabic', 'French', 'Swahili', 'Pidgin-Infused Luxury'].map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-neutral-500 mb-1">Campaign Objective</label>
            <input
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent"
            />
          </div>

          <div>
            <label className="block text-xs text-neutral-500 mb-1">Target Audience</label>
            <input
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Budget Tier</label>
              <input
                value={budgetTier}
                onChange={(e) => setBudgetTier(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Target Calendar Date</label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-500">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={generating}
            className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-lg bg-[#C5A059] text-neutral-950 font-semibold hover:bg-[#D4B475] transition-colors disabled:opacity-60"
          >
            <Sparkles className="w-4 h-4" />
            {generating ? 'Composing Variations...' : 'Generate Marketing Variations'}
          </button>
        </form>

        {/* Generated Preview + Calendar */}
        <div className="lg:col-span-7 space-y-6">
          {generated ? (
            <div className="rounded-xl border border-[#C5A059]/40 bg-white dark:bg-[#121216] p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-200 dark:border-neutral-800">
                <div>
                  <div className="text-xs text-[#A8833E] dark:text-[#C5A059] font-medium">
                    Draft Generated · Requires Explicit Approval
                  </div>
                  <h3 className="font-display text-2xl font-semibold">{generated.title}</h3>
                </div>
                <button
                  onClick={handleSaveToCalendar}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-neutral-950 dark:bg-[#C5A059] text-white dark:text-neutral-950 text-xs font-semibold"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Save to Approval Queue
                </button>
              </div>

              <div className="space-y-3">
                {generated.variations.map((v, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-lg bg-neutral-50 dark:bg-[#18181D] border border-neutral-200 dark:border-neutral-800 text-sm whitespace-pre-wrap"
                  >
                    <div className="text-xs font-semibold text-[#A8833E] dark:text-[#C5A059] mb-1">
                      Variation {i + 1}
                    </div>
                    {v}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800">
                  <div className="font-semibold mb-1">Creative Visual Brief</div>
                  <p className="text-neutral-600 dark:text-neutral-400">{generated.creativeBrief}</p>
                </div>
                <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-2">
                  <div>
                    <span className="font-semibold">Call to Action: </span>
                    {generated.cta}
                  </div>
                  <div>
                    <span className="font-semibold">Posting Schedule: </span>
                    {generated.postingSchedule}
                  </div>
                  <div>
                    <span className="font-semibold">Hashtags: </span>
                    {(generated.hashtags || []).join(' ')}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] p-8 text-center text-sm text-neutral-500">
              Configure your product, market, and platform on the left to generate tailored 7Sense luxury copy via Gemini.
            </div>
          )}

          {/* Approval Workflow & Content Calendar */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] p-6 space-y-4">
            <h3 className="font-display text-xl font-semibold">
              Content Calendar &amp; Approval Queue ({aiContent.length})
            </h3>
            {aiContent.length === 0 ? (
              <p className="text-sm text-neutral-500">
                Saved marketing drafts will appear here for team review and explicit approval before scheduling.
              </p>
            ) : (
              <div className="space-y-3">
                {aiContent.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-neutral-500">
                        {item.scheduledDate || 'Unscheduled'} · {item.platform} · {item.targetCountry} ·{' '}
                        <span className="font-semibold text-neutral-900 dark:text-[#F5F2EB]">
                          {item.approvalStatus}
                        </span>
                      </div>
                      <div className="font-medium text-sm mt-0.5 truncate">{item.title}</div>
                      <div className="text-xs text-neutral-500 mt-1 line-clamp-1">
                        {item.variations?.[0]}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.approvalStatus !== 'Approved' && (
                        <button
                          onClick={() => handleApproval(item, 'Approved')}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-medium"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Approve
                        </button>
                      )}
                      {item.approvalStatus !== 'Rejected' && (
                        <button
                          onClick={() => handleApproval(item, 'Rejected')}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-800 text-xs"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      )}
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
