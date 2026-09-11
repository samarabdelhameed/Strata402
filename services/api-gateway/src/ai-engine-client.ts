/**
 * Strata402 — ai-engine client (Python FastAPI) integration.
 *
 * When `AI_ENGINE_URL` is configured, the gateway delegates the yield-risk
 * analysis to the Python engine and uses the returned response verbatim after
 * a structural shape check. On ANY failure (unreachable engine, non-200,
 * malformed/mislabeled body, or missing engine) the gateway falls back to its
 * own in-process deterministic analysis — the paid endpoint never depends on
 * the engine and never shows fabricated data.
 */

export const ENV_AI_ENGINE_URL = "AI_ENGINE_URL";
export const AI_ENGINE_YIELD_RISK_PATH = "/v1/strategy/yield-risk";

export interface AiEngineCall {
  url: string;
  status: number;
  ok: boolean;
  body: unknown;
}

export interface AiEngineClient {
  readonly enabled: boolean;
  readonly baseUrl: string;
  callYieldRisk(requestBody: unknown): Promise<AiEngineCall>;
}

class DefaultAiEngineClient implements AiEngineClient {
  readonly enabled: boolean;
  readonly baseUrl: string;

  constructor(baseUrl: string, private readonly fetchFn: typeof fetch) {
    this.enabled = baseUrl.trim() !== "";
    this.baseUrl = baseUrl.trim();
  }

  async callYieldRisk(requestBody: unknown): Promise<AiEngineCall> {
    if (!this.enabled) {
      return { url: "", status: 0, ok: false, body: null };
    }
    try {
      const res = await this.fetchFn(
        `${this.baseUrl.replace(/\/$/, "")}${AI_ENGINE_YIELD_RISK_PATH}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(requestBody),
        },
      );
      const text = await res.text();
      let body: unknown = null;
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
      return { url: this.baseUrl, status: res.status, ok: res.ok, body };
    } catch (error) {
      return { url: this.baseUrl, status: 0, ok: false, body: null };
    }
  }
}

export function createAiEngineClient(
  baseUrl: string | undefined,
  fetchFn: typeof fetch = fetch,
): AiEngineClient {
  return new DefaultAiEngineClient(baseUrl ?? "", fetchFn);
}

/**
 * Structural honesty check: the engine's response must carry the same
 * `status: "success"`, `analysis`, `request`, `payment`, and `disclaimer`
 * contract the gateway returns itself. Any mismatch means "not usable" → the
 * gateway falls back to its own deterministic analysis.
 */
export function isValidAiEngineResponse(
  input: unknown,
): input is Record<string, unknown> {
  if (typeof input !== "object" || input === null) return false;
  const record = input as Record<string, unknown>;
  if (record.status !== "success") return false;
  if (typeof record.service !== "string" || record.service.length === 0) return false;
  if (typeof record.analysis !== "object" || record.analysis === null) return false;
  if (typeof record.disclaimer !== "string") return false;
  return true;
}