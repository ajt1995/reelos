import EventEmitter from 'node:events';

export const DEFAULT_MODEL = 'gemini-2.5-flash';
export const LIGHTWEIGHT_MODEL = 'gemini-2.5-flash-lite';

/**
 * GeminiService
 * 
 * Provides zero-VM, lightweight integration with Google's Gemini models for ReelOS.
 * - Uses native Node.js fetch with zero external SDK dependencies.
 * - Bounded buffer memory, zero idle footprint.
 * - Exponential backoff with full jitter on HTTP 429/503.
 * - Deterministic offline fallback when unconfigured or disconnected.
 */
export class GeminiService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY || '';
    this.model = options.model || DEFAULT_MODEL;
    this.maxRetries = options.maxRetries || 3;
  }

  isConfigured() {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  setApiKey(key) {
    this.apiKey = String(key || '').trim();
  }

  setModel(modelName) {
    this.model = String(modelName || DEFAULT_MODEL).trim();
  }

  /**
   * Generates text via Gemini API with retry and backoff.
   */
  async generateText(prompt, systemInstruction = '') {
    if (!this.isConfigured()) {
      return null;
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const payload = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      }
    };

    if (systemInstruction) {
      payload.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    let attempt = 0;
    while (attempt < this.maxRetries) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(12000),
        });

        if (res.status === 429 || res.status === 503) {
          attempt++;
          const delay = Math.min(4000, 500 * Math.pow(2, attempt)) + Math.random() * 250;
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Gemini API HTTP ${res.status}: ${errText}`);
        }

        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        return text ? text.trim() : null;
      } catch (err) {
        attempt++;
        if (attempt >= this.maxRetries) {
          console.warn('[GeminiService] Max retries reached or API unreachable:', err.message);
          return null;
        }
        await new Promise((r) => setTimeout(r, 800));
      }
    }
    return null;
  }

  /**
   * Synthesizes an editorial critique for a title or auteur.
   */
  async synthesizeEditorialCritique(title, category = 'auteur') {
    if (!this.isConfigured()) return null;

    const systemPrompt = `You are a world-class Criterion Collection film archivist and cinema critic. Write an authentic, deeply knowledgeable 1-sentence editorial blurb describing the aesthetic tone, cinematic technique, themes, and sound design of the requested title or director. Never use marketing clichés or buzzwords. Keep it under 25 words.`;
    const prompt = `Provide a Criterion-style editorial note for: ${title} (category: ${category}).`;

    try {
      const critique = await this.generateText(prompt, systemPrompt);
      return critique;
    } catch {
      return null;
    }
  }
}

export const geminiService = new GeminiService();
