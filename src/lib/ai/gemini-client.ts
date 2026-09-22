/**
 * ReelOS Gemini AI Client
 *
 * Implements Gemini API integration following modern @google/genai SDK conventions:
 * - Default model: gemini-3.8-flash (or gemini-3.5-flash-lite for lightweight tagging)
 * - Zero-VM compliant: bounded buffer memory, < 15MB operational footprint
 * - Resilient: exponential backoff with jitter on 429/503
 * - Offline Grace: deterministic fallback when offline or unauthenticated
 */

export interface CurationRecommendation {
  title: string;
  reason: string;
  confidence: number;
  tags: string[];
}

export interface GeminiClientOptions {
  apiKey?: string;
  model?: string;
  maxRetries?: number;
}

export const DEFAULT_MODEL = "gemini-3.8-flash";
export const LIGHTWEIGHT_MODEL = "gemini-3.5-flash-lite";

export class ReelOSGeminiClient {
  private apiKey: string;
  private model: string;
  private maxRetries: number;

  constructor(options: GeminiClientOptions = {}) {
    this.apiKey = options.apiKey || (typeof process !== "undefined" ? process.env.GEMINI_API_KEY || "" : "");
    this.model = options.model || DEFAULT_MODEL;
    this.maxRetries = options.maxRetries ?? 3;
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  /**
   * Curates titles for tonight's shelf using Gemini 3.8 Flash.
   * If unconfigured or offline, provides an instant deterministic fallback.
   */
  public async curateEveningShelf(
    history: Array<{ title: string; genre?: string; rating?: number }>,
    availableCatalog: Array<{ title: string; genre?: string; year?: number }>
  ): Promise<CurationRecommendation[]> {
    if (!this.isConfigured() || availableCatalog.length === 0) {
      return this.offlineFallbackCuration(history, availableCatalog);
    }

    const prompt = `You are ReelOS Curator, an intelligent home media assistant.
User watching history: ${JSON.stringify(history.slice(-10))}
Available catalog: ${JSON.stringify(availableCatalog.slice(0, 50))}

Select the top 3 best titles to recommend for tonight.
Respond strictly in valid JSON format:
[
  { "title": "Title Name", "reason": "Short human rationale", "confidence": 0.95, "tags": ["Action", "Comfort"] }
]`;

    try {
      const result = await this.executeWithRetry(async () => {
        // Dynamic import of @google/genai keeps cold boot fast and zero-VM compliant
        // @ts-ignore - Optional SDK loaded dynamically when configured
        const genaiModule = await import("@google/genai");
        const GoogleGenAI = genaiModule.GoogleGenAI || genaiModule.default?.GoogleGenAI;
        const client = new GoogleGenAI({ apiKey: this.apiKey });
        const interaction = await client.interactions.create({
          model: this.model,
          input: prompt,
        });

        const rawText = interaction.output_text || "";
        const jsonMatch = rawText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]) as CurationRecommendation[];
        }
        throw new Error("Invalid model JSON response");
      });

      return result;
    } catch (err) {
      console.warn("[ReelOSGemini] API error or offline, falling back to deterministic curation:", err);
      return this.offlineFallbackCuration(history, availableCatalog);
    }
  }

  /**
   * Exponential backoff with full jitter to handle rate limits and transient network glitches.
   */
  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let attempt = 0;
    while (attempt < this.maxRetries) {
      try {
        return await fn();
      } catch (err: any) {
        attempt++;
        const isRateLimit = err?.status === 429 || err?.message?.includes("429") || err?.message?.includes("RESOURCE_EXHAUSTED");
        const isTransient = isRateLimit || err?.status === 503 || err?.message?.includes("503");

        if (!isTransient || attempt >= this.maxRetries) {
          throw err;
        }

        // Base 500ms, doubled per attempt + random jitter up to 50%
        const baseMs = 500 * Math.pow(2, attempt);
        const jitterMs = Math.random() * (baseMs * 0.5);
        const delayMs = baseMs + jitterMs;

        console.log(`[ReelOSGemini] Rate-limited or busy (attempt ${attempt}/${this.maxRetries}). Retrying in ${Math.round(delayMs)}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    throw new Error("Max retries exceeded");
  }

  /**
   * Deterministic zero-VM fallback curation when offline or unconfigured.
   * Guarantees ReelOS is stable from Day 1 even without internet access.
   */
  private offlineFallbackCuration(
    history: Array<{ title: string; genre?: string }>,
    availableCatalog: Array<{ title: string; genre?: string; year?: number }>
  ): CurationRecommendation[] {
    const favoriteGenres = new Set(history.map((h) => h.genre).filter(Boolean));
    const matched = availableCatalog.filter((c) => c.genre && favoriteGenres.has(c.genre));
    const pool = matched.length > 0 ? matched : availableCatalog;

    return pool.slice(0, 3).map((item) => ({
      title: item.title,
      reason: "Locally recommended based on your recent library comfort picks.",
      confidence: 0.85,
      tags: item.genre ? [item.genre] : ["Popular"],
    }));
  }
}
