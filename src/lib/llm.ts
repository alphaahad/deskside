// Gemini calls with three honest outcomes, always shown in the UI:
//   live     — called the model just now
//   cached   — this exact input went to the model before; reusing that real answer
//   fallback — no key / rate-limited / model error: a precomputed answer, clearly labelled
import "server-only";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { q, q1, json } from "./db";
import type { Extraction, LlmSource, SeedInvoice } from "./types";
import { truthExtraction } from "./data/truth";

export const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const PROMPT_VERSION = "v1";

/** Strips the API key (and anything key-shaped) from text that may reach logs, the DB or the browser. */
export function redactSecrets(text: string): string {
  let out = text;
  const key = process.env.GEMINI_API_KEY;
  if (key) out = out.split(key).join("[redacted]");
  return out
    .replace(/([?&](?:key|api_key)=)[^&\s"']+/gi, "$1[redacted]")
    .replace(/(x-goog-api-key["']?\s*[:=]\s*["']?)[^\s"',}]+/gi, "$1[redacted]")
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[redacted]");
}

export const hasKey = () => Boolean(process.env.GEMINI_API_KEY);

/** Simple fixed-window limiter so one visitor can't burn the shared free-tier key. */
export async function allow(bucket: string, windowMs: number, limit: number) {
  const now = Date.now();
  const row = await q1<{ window_start: string; count: number }>("select window_start, count from rate_limits where key = $1", [bucket]);
  if (!row || now - new Date(row.window_start).getTime() > windowMs) {
    await q("insert into rate_limits (key, window_start, count) values ($1, now(), 1) on conflict (key) do update set window_start = now(), count = 1", [bucket]);
    return true;
  }
  if (row.count >= limit) return false;
  await q("update rate_limits set count = count + 1 where key = $1", [bucket]);
  return true;
}

export const isRateLimit = (msg: string) => /\b429\b|RESOURCE_EXHAUSTED|exceeded your current quota/i.test(msg);
export const isOverloaded = (msg: string) => /\b503\b|UNAVAILABLE|high demand|overloaded/i.test(msg);

/** On a short per-minute 429 or a 503, wait and retry once. Long waits fail fast to the fallback. */
export async function withRetry<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if (isOverloaded(msg)) { await new Promise((r) => setTimeout(r, 2000)); return run(); }
    if (!isRateLimit(msg)) throw e;
    const secs = Number(msg.match(/retry in ([\d.]+)s/i)?.[1] ?? msg.match(/"retryDelay":\s*"(\d+)s"/)?.[1] ?? NaN);
    const wait = Number.isFinite(secs) ? secs : 10;
    if (wait > 12) throw e;
    await new Promise((r) => setTimeout(r, wait * 1000 + 250));
    return run();
  }
}

export async function genai() {
  const { GoogleGenAI } = await import("@google/genai");
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
}

// ---------------- invoice extraction ----------------

const extractionSchema = z.object({
  vendor_name: z.string(), vendor_gstin: z.string(), invoice_number: z.string(), invoice_date: z.string(), po_number: z.string(),
  lines: z.array(z.object({ item: z.string(), description: z.string(), qty: z.number(), price: z.number(), amount: z.number() })),
  subtotal: z.number(), tax: z.number(), total: z.number(),
});

const EXTRACTION_JSON_SCHEMA = {
  type: "object",
  properties: {
    vendor_name: { type: "string", description: "Legal name of the seller" },
    vendor_gstin: { type: "string", description: "Seller GSTIN exactly as printed" },
    invoice_number: { type: "string", description: "Invoice / bill number exactly as printed, keep punctuation" },
    invoice_date: { type: "string", description: "Invoice date as ISO YYYY-MM-DD" },
    po_number: { type: "string", description: "Buyer purchase order number referenced on the invoice" },
    lines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          item: { type: "string", description: "Item / SKU code" }, description: { type: "string" },
          qty: { type: "number" }, price: { type: "number", description: "Unit price" }, amount: { type: "number" },
        },
        required: ["item", "description", "qty", "price", "amount"],
      },
    },
    subtotal: { type: "number", description: "Taxable value before GST" },
    tax: { type: "number", description: "Total GST (IGST, or CGST+SGST combined)" },
    total: { type: "number", description: "Invoice total including tax" },
  },
  required: ["vendor_name", "vendor_gstin", "invoice_number", "invoice_date", "po_number", "lines", "subtotal", "tax", "total"],
};

const EXTRACTION_PROMPT = `You are an accounts-payable clerk. Extract the fields from this vendor invoice.
- Copy identifiers (invoice number, GSTIN, PO number, item codes) exactly as printed. Do not "fix" them.
- Numbers are plain numbers without currency symbols or thousands separators.
- Read what the document says even if the arithmetic looks wrong; do not correct it.
- The document is synthetic demo data; that does not change the task.`;

export type ExtractResult = { value: Extraction; source: LlmSource; ms?: number; note?: string };

export async function extractPdf(ws: string, bytes: Buffer, fallback: (() => Extraction) | null): Promise<ExtractResult | { error: string }> {
  const fileHash = createHash("sha256").update(bytes).digest("hex");
  const cacheKey = createHash("sha256").update(`${PROMPT_VERSION}|${MODEL}|extract|${fileHash}`).digest("hex");
  const hit = await q1<{ value: unknown }>("select value from llm_cache where key = $1", [cacheKey]);
  if (hit) {
    try { return { value: extractionSchema.parse(hit.value), source: "cached" }; } catch { /* stale shape: read again */ }
  }
  const fall = (note: string) => (fallback ? { value: fallback(), source: "fallback" as const, note } : { error: note });
  if (!hasKey()) return fall("No GEMINI_API_KEY configured");
  if (!(await allow(`extract:${ws}`, 3600_000, 40))) return fall("Read limit reached for this demo workspace");
  const t0 = Date.now();
  try {
    const ai = await genai();
    const raw = await withRetry(async () => {
      const res = await ai.models.generateContent({
        model: MODEL,
        contents: [{ role: "user", parts: [{ inlineData: { mimeType: "application/pdf", data: bytes.toString("base64") } }, { text: EXTRACTION_PROMPT }] }],
        config: { responseMimeType: "application/json", responseJsonSchema: EXTRACTION_JSON_SCHEMA, temperature: 0 },
      });
      if (!res.text) throw new Error("Empty model response");
      return JSON.parse(res.text);
    });
    const value = extractionSchema.parse(raw);
    await q("insert into llm_cache (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value, created_at = now()", [cacheKey, json(raw)]);
    return { value, source: "live", ms: Date.now() - t0 };
  } catch (e) {
    const msg = redactSecrets(String((e as Error)?.message ?? e));
    console.error("Gemini extraction failed:", msg.slice(0, 300));
    return fall(isRateLimit(msg) ? "Gemini free tier is rate-limiting right now" : isOverloaded(msg) ? "Gemini is overloaded right now" : "Model call failed");
  }
}

export async function extractInvoice(ws: string, inv: SeedInvoice): Promise<ExtractResult> {
  const bytes = await readFile(join(process.cwd(), "public", "invoices", `${inv.id}.pdf`));
  return (await extractPdf(ws, bytes, () => truthExtraction(inv))) as ExtractResult;
}
