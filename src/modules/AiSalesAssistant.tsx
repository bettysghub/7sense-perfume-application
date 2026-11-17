import React, { useState } from 'react';
import { Briefcase, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface AssistantResult {
  recommendations: {
    productName: string;
    sku: string;
    reason: string;
    occasionMatch: string;
    upsellPairing: string;
  }[];
  comparisonSummary: string;
  salesScript: string;
  followUpSuggestion: string;
  leadQualification: string;
}

export function AiSalesAssistant() {
  const { products, addToCart, setActiveModule } = useApp();

  const [mode, setMode] = useState<'concierge' | 'quiz'>('concierge');
  const [prompt, setPrompt] = useState(
    'Executive male client in Lagos looking for a commanding evening oud scent for a gala, budget $250, open to matching car fragrance.'
  );
  const [scentFamily, setScentFamily] = useState('Woody, Saffron & Oud');
  const [occasion, setOccasion] = useState('Evening Gala & VIP Events');
  const [climate, setClimate] = useState('Warm Humid / Tropical');
  const [budgetUsd, setBudgetUsd] = useState('150 - 300 USD');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AssistantResult | null>(null);

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/sales-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          prompt:
            mode === 'quiz'
              ? `Recommend ideal 7Sense products for a customer preferring ${scentFamily}, occasion: ${occasion}, climate: ${climate}, budget: ${budgetUsd}.`
              : prompt,
          preferences: { scentFamily, occasion, climate, budgetUsd },
          productsCatalog: products.map((p) => ({
            sku: p.sku,
            name: p.name,
            category: p.category,
            gender: p.gender,
            priceUsd: p.priceUsd,
            fragranceNotes: p.fragranceNotes,
            totalStock: p.totalStock,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Assistant request failed.');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assistant error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <p className="text-xs tracking-wider uppercase text-[#A8833E] dark:text-[#C5A059] font-medium">
            Consultative Perfumery &amp; Upsell Intelligence
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold mt-1">
            AI Sales Concierge &amp; Fragrance Quiz
          </h1>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-[#141418]">
          <button
            onClick={() => setMode('concierge')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold ${
              mode === 'concierge'
                ? 'bg-white dark:bg-[#222228] text-neutral-950 dark:text-[#F5F2EB] shadow-sm'
                : 'text-neutral-500'
            }`}
          >
            Staff Sales Concierge
          </button>
          <button
            onClick={() => setMode('quiz')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold ${
              mode === 'quiz'
                ? 'bg-white dark:bg-[#222228] text-neutral-950 dark:text-[#F5F2EB] shadow-sm'
                : 'text-neutral-500'
            }`}
          >
            Customer Fragrance Quiz
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <form
          onSubmit={handleRun}
          className="lg:col-span-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] p-6 space-y-4 text-sm h-fit"
        >
          {mode === 'concierge' ? (
            <div>
              <label className="block text-xs text-neutral-500 mb-1.5">
                Describe Customer Need, Budget &amp; Context
              </label>
              <textarea
                rows={5}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Scent Mood</label>
                <select
                  value={scentFamily}
                  onChange={(e) => setScentFamily(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141418]"
                >
                  <option>Bright Citrus &amp; White Floral</option>
                  <option>Dry Atlas Cedar &amp; Vetiver</option>
                  <option>Woody, Saffron &amp; Oud</option>
                  <option>Warm Home Amber &amp; Spice</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Occasion</label>
                <select
                  value={occasion}
                  onChange={(e) => setOccasion(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141418]"
                >
                  <option>Daily Signature &amp; Office</option>
                  <option>Evening Gala &amp; VIP Events</option>
                  <option>Luxury Corporate / Wedding Gift</option>
                  <option>Home Sanctuary &amp; Driving</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Climate</label>
                <select
                  value={climate}
                  onChange={(e) => setClimate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141418]"
                >
                  <option>Desert Warmth (UAE / Gulf)</option>
                  <option>Warm Humid / Tropical (West &amp; East Africa)</option>
                  <option>Air-Conditioned Executive Spaces</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Budget Range</label>
                <select
                  value={budgetUsd}
                  onChange={(e) => setBudgetUsd(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141418]"
                >
                  <option>Under $100 USD</option>
                  <option>150 - 300 USD</option>
                  <option>$300+ VIP Coffret &amp; Bundles</option>
                </select>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-500">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-lg bg-[#C5A059] text-neutral-950 font-semibold hover:bg-[#D4B475]"
          >
            <Sparkles className="w-4 h-4" />
            {loading
              ? 'Consulting Perfumer AI...'
              : mode === 'quiz'
                ? 'Reveal My Signature Scent'
                : 'Generate Recommendations & Script'}
          </button>
        </form>

        <div className="lg:col-span-7 space-y-5">
          {result ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {result.recommendations.map((rec, i) => {
                  const matched = products.find(
                    (p) => p.sku === rec.sku || p.name.toLowerCase() === rec.productName.toLowerCase()
                  );
                  return (
                    <div
                      key={i}
                      className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] p-5 flex flex-col justify-between space-y-3"
                    >
                      <div>
                        <div className="text-xs font-mono text-[#A8833E] dark:text-[#C5A059]">
                          {rec.sku} · {rec.occasionMatch}
                        </div>
                        <h3 className="font-display text-2xl font-semibold mt-1">{rec.productName}</h3>
                        <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-2">{rec.reason}</p>
                        <div className="mt-3 text-xs pt-3 border-t border-neutral-100 dark:border-neutral-800">
                          <span className="font-semibold">Upsell Pairing:</span> {rec.upsellPairing}
                        </div>
                      </div>
                      {matched && (
                        <button
                          onClick={() => {
                            addToCart(matched, 1);
                            setActiveModule('storefront');
                          }}
                          className="w-full py-2 rounded-lg bg-neutral-950 dark:bg-[#C5A059] text-white dark:text-neutral-950 text-xs font-semibold"
                        >
                          Add {matched.name} to Bag
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] p-6 space-y-4 text-sm">
                <div>
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-neutral-500">
                    Olfactory Comparison
                  </h4>
                  <p className="mt-1 text-neutral-700 dark:text-neutral-300">{result.comparisonSummary}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-neutral-500">
                    Concierge Sales Script
                  </h4>
                  <p className="mt-1 p-3 rounded-lg bg-neutral-50 dark:bg-[#18181D] text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap">
                    {result.salesScript}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="font-semibold">Lead Qualification: </span>
                    {result.leadQualification}
                  </div>
                  <div>
                    <span className="font-semibold">Next Follow-Up: </span>
                    {result.followUpSuggestion}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] p-10 text-center space-y-2">
              <Briefcase className="w-6 h-6 mx-auto text-[#C5A059]" />
              <p className="text-sm text-neutral-500">
                Enter client fragrance preferences or run the interactive scent quiz to receive tailored 7Sense pairings and concierge scripts.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
