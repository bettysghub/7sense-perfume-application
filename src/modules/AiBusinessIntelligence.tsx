import React, { useMemo, useState } from 'react';
import { Bot, Send } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface BiResponse {
  directAnswer: string;
  actualDataCitations: string[];
  forecastsAndEstimates: string[];
  strategicRecommendations: {
    action: string;
    expectedImpact: string;
    priority: string;
    ownerRole: string;
  }[];
}

const PRESET_QUESTIONS = [
  'Which perfume generated the most profit this month?',
  'Which country has the highest conversion rate?',
  'Which customers are likely to buy again?',
  'Which marketing campaign has the best return?',
  'Which products need restocking?',
  'How can we increase sales by 30%?',
];

export function AiBusinessIntelligence() {
  const { products, orders, customers, campaigns, expenses } = useApp();
  const [question, setQuestion] = useState(PRESET_QUESTIONS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<BiResponse | null>(null);

  const metricsSnapshot = useMemo(() => {
    const productStats = products.map((p) => ({
      name: p.name,
      sku: p.sku,
      totalStock: p.totalStock,
      reorderPoint: p.reorderPoint,
      needsRestock: p.totalStock <= p.reorderPoint,
      priceUsd: p.priceUsd,
      costUsd: p.costUsd,
      isDemo: p.isDemo,
    }));

    const orderSummary = orders.map((o) => ({
      orderNumber: o.orderNumber,
      country: o.country,
      channel: o.channel,
      totalUsd: o.totalUsd,
      cogsUsd: o.cogsUsd,
      grossProfitUsd: Number((o.totalUsd - o.cogsUsd).toFixed(2)),
      status: o.status,
      items: o.items.map((i) => ({ name: i.name, qty: i.quantity, unitCostUsd: i.unitCostUsd })),
      isDemo: o.isDemo,
    }));

    const campaignStats = campaigns.map((c) => ({
      name: c.name,
      channel: c.channel,
      country: c.targetCountry,
      spendUsd: c.spendUsd,
      clicks: c.clicks,
      conversions: c.conversions,
      attributedRevenueUsd: c.attributedRevenueUsd,
      roas: c.spendUsd > 0 ? Number(((c.attributedRevenueUsd || 0) / c.spendUsd).toFixed(2)) : 0,
      conversionRatePct: c.clicks ? Number((((c.conversions || 0) / c.clicks) * 100).toFixed(2)) : 0,
    }));

    const customerStats = customers.map((c) => ({
      fullName: c.fullName,
      country: c.country,
      segment: c.segment,
      ordersCount: c.ordersCount,
      ltvUsd: c.ltvUsd,
      consentWhatsapp: c.consentWhatsapp,
      consentEmail: c.consentEmail,
    }));

    const totalExpensesUsd = expenses.reduce((s, e) => s + (e.amountUsd || 0), 0);

    return {
      generatedAt: new Date().toISOString(),
      totalExpensesUsd,
      products: productStats,
      orders: orderSummary,
      campaigns: campaignStats,
      customers: customerStats,
    };
  }, [products, orders, customers, campaigns, expenses]);

  const runAnalysis = async (q: string) => {
    setQuestion(q);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/business-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, metricsSnapshot }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'BI analysis failed.');
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analyst error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    void runAnalysis(question);
  };

  return (
    <div className="space-y-8">
      <div className="pb-6 border-b border-neutral-200 dark:border-neutral-800">
        <p className="text-xs tracking-wider uppercase text-[#A8833E] dark:text-[#C5A059] font-medium">
          Evidence-Based Executive Analyst · Actuals vs. Forecasts Separated
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold mt-1">
          AI Business Intelligence
        </h1>
      </div>

      {/* Quick Executive Prompts */}
      <div className="flex flex-wrap gap-2">
        {PRESET_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => runAnalysis(q)}
            disabled={loading}
            className="px-3.5 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] text-xs font-medium hover:border-[#C5A059] transition-colors text-left"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Custom Question Bar */}
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask any strategic, financial, CRM, or inventory question..."
          className="flex-1 px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#C5A059] text-neutral-950 text-sm font-semibold hover:bg-[#D4B475] disabled:opacity-60"
        >
          <Send className="w-4 h-4" />
          {loading ? 'Analyzing...' : 'Analyze'}
        </button>
      </form>

      {error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-sm text-red-500">
          {error}
        </div>
      )}

      {analysis ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-[#C5A059]/40 bg-white dark:bg-[#121216] p-6 space-y-3">
            <div className="text-xs uppercase tracking-wider text-[#A8833E] dark:text-[#C5A059] font-semibold">
              Executive Synthesis
            </div>
            <p className="text-base leading-relaxed text-neutral-800 dark:text-neutral-200">
              {analysis.directAnswer}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] p-6 space-y-3">
              <h3 className="font-display text-xl font-semibold">
                Actual Recorded Database Citations
              </h3>
              <ul className="space-y-2 text-sm text-neutral-600 dark:text-neutral-300 list-disc pl-5">
                {analysis.actualDataCitations.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] p-6 space-y-3">
              <h3 className="font-display text-xl font-semibold">
                Forecasts &amp; Projected Estimates
              </h3>
              <ul className="space-y-2 text-sm text-neutral-600 dark:text-neutral-300 list-disc pl-5">
                {analysis.forecastsAndEstimates.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] p-6 space-y-4">
            <h3 className="font-display text-xl font-semibold">Strategic Action Plan</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analysis.strategicRecommendations.map((rec, i) => (
                <div
                  key={i}
                  className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-1.5"
                >
                  <div className="text-xs font-mono text-[#A8833E] dark:text-[#C5A059]">
                    Priority: {rec.priority} · Owner: {rec.ownerRole}
                  </div>
                  <div className="font-medium text-sm">{rec.action}</div>
                  <div className="text-xs text-neutral-500">Expected Impact: {rec.expectedImpact}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121216] p-12 text-center space-y-2">
          <Bot className="w-7 h-7 mx-auto text-[#C5A059]" />
          <p className="text-sm text-neutral-500">
            Select a prompt above or enter an executive question to inspect live Firestore margins, conversion rates, restock urgency, and growth levers.
          </p>
        </div>
      )}
    </div>
  );
}
