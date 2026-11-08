// Deployment readiness: run sample invoices through the same read + 3-way match the inbox uses,
// without posting anything, and report which would be decided automatically and which would go to a human.
import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { context } from "@/lib/api";
import { samples } from "@/lib/data/samples";
import { masterData, truthExtraction } from "@/lib/data/truth";
import { extractPdf } from "@/lib/llm";
import { failures, holdLabel, match } from "@/lib/match";
import { rules } from "@/lib/service";
import type { Extraction, LlmSource } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FILES = 5;
const MAX_BYTES = 2 * 1024 * 1024;

type Row = {
  name: string;
  outcome: "auto" | "review" | "unread";
  why: string;
  read: { source: LlmSource; ms?: number; note?: string } | null;
  vendor?: string;
  total?: number;
};

export async function POST(req: Request) {
  const { ws } = await context();
  const activeRules = await rules(ws.id);
  const inputs: { name: string; bytes: Buffer; fallback: (() => Extraction) | null }[] = [];

  if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File).slice(0, MAX_FILES);
    for (const f of files) {
      if (f.type !== "application/pdf" || f.size > MAX_BYTES) {
        return NextResponse.json({ error: `${f.name}: PDFs up to 2 MB only.` }, { status: 400 });
      }
      inputs.push({ name: f.name, bytes: Buffer.from(await f.arrayBuffer()), fallback: null });
    }
  } else {
    const body = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body.samples) ? body.samples : samples.map((s) => s.id);
    for (const s of samples.filter((x) => ids.includes(x.id))) {
      inputs.push({ name: `${s.id}.pdf`, bytes: await readFile(join(process.cwd(), "public", "samples", `${s.id}.pdf`)), fallback: () => truthExtraction(s) });
    }
  }

  const rows: Row[] = [];
  for (const input of inputs) {
    const read = await extractPdf(ws.id, input.bytes, input.fallback);
    if ("error" in read) {
      rows.push({ name: input.name, outcome: "unread", why: `Couldn't read it right now (${read.error}). Nothing was guessed.`, read: null });
      continue;
    }
    const m = match({ invoiceId: input.name.replace(/\.pdf$/i, ""), extraction: read.value, ...masterData(), settled: [], rules: activeRules });
    rows.push({
      name: input.name,
      outcome: m.ok ? "auto" : "review",
      why: m.ok ? (m.checks.find((c) => c.status === "warn")?.summary ?? "3-way matched.") : `${holdLabel(m)}: ${failures(m)[0].summary}`,
      read: { source: read.source, ms: read.ms, note: read.note },
      vendor: read.value.vendor_name,
      total: read.value.total,
    });
  }
  const readable = rows.filter((r) => r.outcome !== "unread");
  return NextResponse.json({
    rows,
    autoRate: readable.length ? readable.filter((r) => r.outcome === "auto").length / readable.length : null,
  });
}
