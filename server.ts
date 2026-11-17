import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '2mb' }));

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in server environment secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: '7Sense Perfumes Intelligence API',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Module 4: AI Marketing Studio
app.post('/api/ai/marketing-studio', async (req, res) => {
  try {
    const {
      productName,
      fragranceNotes,
      targetCountry,
      targetAudience,
      objective,
      platform,
      tone,
      language,
      budgetTier,
    } = req.body ?? {};

    if (!productName || !platform || !targetCountry) {
      return res.status(400).json({ error: 'productName, platform, and targetCountry are required.' });
    }

    const ai = getGeminiClient();
    const prompt = `
Create luxury fragrance marketing assets for 7Sense Perfumes (slogan: "Symphony of Scent").
Product: ${productName}
Fragrance Notes: ${JSON.stringify(fragranceNotes || {})}
Target Country/Market: ${targetCountry}
Target Audience: ${targetAudience || 'Affluent luxury fragrance connoisseurs'}
Campaign Objective: ${objective || 'Conversions & Brand Prestige'}
Platform/Format: ${platform}
Tone: ${tone || 'Opulent, poetic, modern luxury'}
Language: ${language || 'English'}
Budget Tier: ${budgetTier || 'Growth'}

Generate 3 distinct high-converting variations tailored specifically to cultural nuances in ${targetCountry}, plus curated hashtags, a compelling CTA, a visual creative brief for photography/video, and a recommended posting schedule.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'You are the Chief Brand Strategist and Luxury Copywriter for 7Sense Perfumes, operating across UAE and African luxury markets. Write refined, culturally resonant, persuasive copy without clichés. Return valid JSON matching the schema.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Concise campaign asset title' },
            variations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3 distinct copy variations tailored to the selected platform',
            },
            hashtags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Up to 10 relevant luxury and regional hashtags',
            },
            cta: { type: Type.STRING, description: 'Clear luxury call-to-action' },
            creativeBrief: {
              type: Type.STRING,
              description: 'Art direction, lighting, wardrobe, and sensory storytelling guidance',
            },
            postingSchedule: {
              type: Type.STRING,
              description: 'Optimal local day/time and cadence recommendation for the target country',
            },
          },
          required: ['title', 'variations', 'hashtags', 'cta', 'creativeBrief', 'postingSchedule'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    return res.json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate marketing campaign.';
    console.error('Marketing Studio AI Error:', message);
    return res.status(500).json({ error: message });
  }
});

// Module 5: AI Sales Assistant & Fragrance Concierge
app.post('/api/ai/sales-assistant', async (req, res) => {
  try {
    const { mode, prompt, preferences, productsCatalog, customerContext } = req.body ?? {};
    const ai = getGeminiClient();

    const userPrompt = `
Mode: ${mode || 'concierge'}
Customer/Staff Query: ${prompt || 'Recommend the ideal 7Sense fragrance based on preferences.'}
Fragrance Preferences: ${JSON.stringify(preferences || {})}
Customer Context: ${JSON.stringify(customerContext || {})}
Available 7Sense Perfumes Catalog:
${JSON.stringify(productsCatalog || [], null, 2)}

Provide tailored product recommendations strictly from the provided catalog, including cross-sell/upsell pairings (candles, diffusers, car fragrances, or gift sets), a concise comparison if multiple scents fit, lead qualification assessment, and a polished concierge sales script + follow-up suggestion.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: userPrompt,
      config: {
        systemInstruction:
          'You are the Master Perfumer & Senior Luxury Sales Concierge for 7Sense Perfumes. Only recommend products present in the catalog provided. Be consultative, persuasive, and attentive to climate/region (e.g., UAE heat, Nigerian evening events, East African gifting). Return valid JSON.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  productName: { type: Type.STRING },
                  sku: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  occasionMatch: { type: Type.STRING },
                  upsellPairing: { type: Type.STRING },
                },
              },
            },
            comparisonSummary: { type: Type.STRING },
            salesScript: { type: Type.STRING },
            followUpSuggestion: { type: Type.STRING },
            leadQualification: { type: Type.STRING },
          },
          required: [
            'recommendations',
            'comparisonSummary',
            'salesScript',
            'followUpSuggestion',
            'leadQualification',
          ],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    return res.json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to run AI Sales Assistant.';
    console.error('Sales Assistant AI Error:', message);
    return res.status(500).json({ error: message });
  }
});

// Module 10: AI Business Intelligence Analyst
app.post('/api/ai/business-intelligence', async (req, res) => {
  try {
    const { question, metricsSnapshot } = req.body ?? {};
    if (!question) {
      return res.status(400).json({ error: 'question is required.' });
    }

    const ai = getGeminiClient();
    const prompt = `
Executive Question: "${question}"

Real Database Snapshot (Actual Recorded Figures from Firestore):
${JSON.stringify(metricsSnapshot || {}, null, 2)}

Instructions:
1. Answer the executive question directly using ONLY the provided actual metrics snapshot for factual claims.
2. Explicitly separate "Actual Recorded Data Citations" from "Forecasts & Projected Estimates".
3. Never invent past sales figures that are not in the snapshot. If data is marked isDemo or sparse, acknowledge it transparently.
4. Provide 3-4 concrete, high-ROI strategic recommendations tailored to 7Sense Perfumes (UAE & African expansion, inventory, ROAS, repeat LTV).
`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'You are the Chief Strategy & Business Intelligence Analyst for 7Sense Perfumes. You are rigorous, quantitative, and transparent: you never fabricate historical performance numbers and always distinguish observed database metrics from forward-looking projections.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            directAnswer: { type: Type.STRING },
            actualDataCitations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Facts strictly observed in the provided database snapshot',
            },
            forecastsAndEstimates: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Forward-looking projections and scenario estimates clearly labeled as forecasts',
            },
            strategicRecommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  action: { type: Type.STRING },
                  expectedImpact: { type: Type.STRING },
                  priority: { type: Type.STRING },
                  ownerRole: { type: Type.STRING },
                },
              },
            },
          },
          required: [
            'directAnswer',
            'actualDataCitations',
            'forecastsAndEstimates',
            'strategicRecommendations',
          ],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    return res.json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to analyze business intelligence.';
    console.error('BI Analyst AI Error:', message);
    return res.status(500).json({ error: message });
  }
});

// Integration Credential Readiness Check (Honest verification, no simulated delivery)
app.post('/api/integrations/check', (req, res) => {
  const { providerId, accountIdentifier, endpointOrSender, mode } = req.body ?? {};
  const envChecks: Record<string, boolean> = {
    whatsapp: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
    email: Boolean(process.env.RESEND_API_KEY || process.env.SMTP_HOST),
    stripe: Boolean(process.env.STRIPE_SECRET_KEY),
    paystack: Boolean(process.env.PAYSTACK_SECRET_KEY),
    flutterwave: Boolean(process.env.FLUTTERWAVE_SECRET_KEY),
  };

  const hasServerSecret = envChecks[String(providerId || '').toLowerCase()] ?? false;
  const hasMetadata = Boolean(accountIdentifier && endpointOrSender);

  if (mode === 'live' && !hasServerSecret) {
    return res.json({
      verified: false,
      status: 'Missing server-side secret environment variable for live mode. Configure secret in Settings > Secrets.',
      hasServerSecret: false,
    });
  }

  return res.json({
    verified: hasMetadata && (mode === 'sandbox' || hasServerSecret),
    hasServerSecret,
    status: hasServerSecret
      ? 'Server credentials detected and adapter metadata validated.'
      : hasMetadata
        ? 'Adapter metadata saved in sandbox/pending state. Live dispatch requires server environment secret.'
        : 'Incomplete configuration: provide account identifier and endpoint/sender.',
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`7Sense Perfumes server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
