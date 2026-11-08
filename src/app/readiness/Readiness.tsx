"use client";
import { useState } from "react";
import { CheckCircle2, UserRound, CircleHelp, Upload } from "lucide-react";
import { samples } from "@/lib/data/samples";
import { vendorOf } from "@/lib/data/seed";
import { inr0 } from "@/lib/format";

type Row = { name: string; outcome: "auto" | "review" | "unread"; why: string; read: { source: string; ms?: number; note?: string } | null; vendor?: string; total?: number };

export function Readiness() {
  const [picked, setPicked] = useState<string[]>(samples.map((s) => s.id));
  const [rows, setRows] = useState<Row[] | null>(null);
  const [auto, setAuto] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(init: RequestInit) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/readiness", { method: "POST", ...init });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setRows(data.rows);
      setAuto(data.autoRate);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">1. Pick sample invoices</h2>
        <ul className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {samples.map((s) => (
            <li key={s.id}>
              <label className="pressable flex cursor-pointer items-center gap-2 rounded-md border border-line px-2.5 py-1.5 text-sm hover:bg-canvas has-[:checked]:border-[#0f766e]/40">
                <input type="checkbox" className="size-4 accent-[#0f766e]" checked={picked.includes(s.id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, s.id] : p.filter((x) => x !== s.id)))} />
                <span className="font-medium">{s.id}</span>
                <a href={`/samples/${s.id}.pdf`} target="_blank" className="truncate text-xs text-muted underline-offset-2 hover:underline">{vendorOf(s.vendorId).name.split(" ")[0]} · PDF</a>
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" disabled={busy || !picked.length} onClick={() => run({ headers: { "content-type": "application/json" }, body: JSON.stringify({ samples: picked }) })}
            className="pressable rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
            {busy ? <span className="presence-pulse">Meera is reading…</span> : `Run ${picked.length} sample${picked.length === 1 ? "" : "s"}`}
          </button>
          <label className="pressable inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-ink-2 hover:text-ink">
            <Upload className="size-4" aria-hidden /> Or upload PDFs (up to 5)
            <input type="file" accept="application/pdf" multiple className="sr-only" disabled={busy}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (!files.length) return;
                const form = new FormData();
                files.slice(0, 5).forEach((f) => form.append("files", f));
                run({ body: form });
                e.target.value = "";
              }} />
          </label>
        </div>
        {error && <p className="mt-2 text-sm text-bad">{error}</p>}
      </section>

      {rows && (
        <section className="animate-enter rounded-xl border border-line bg-surface p-4" data-testid="readiness-results" aria-live="polite">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">2. What Meera would do</h2>
            {auto != null && <p className="text-sm"><span className="text-2xl font-semibold tabular-nums tracking-[-0.02em]">{Math.round(auto * 100)}%</span> <span className="text-muted">would be decided without a person</span></p>}
          </div>
          <ul className="mt-3 divide-y divide-line">
            {rows.map((r, i) => (
              <li key={r.name} className="animate-enter flex gap-3 py-2.5" style={{ animationDelay: `${i * 40}ms` }}>
                {r.outcome === "auto" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" /> : r.outcome === "review" ? <UserRound className="mt-0.5 size-4 shrink-0 text-warn" /> : <CircleHelp className="mt-0.5 size-4 shrink-0 text-muted" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{r.name}</span>
                    {r.vendor && <span className="text-muted"> · {r.vendor}{r.total != null ? ` · ${inr0(r.total)}` : ""}</span>}
                    <span className={`ml-2 rounded px-1.5 py-px text-[11px] font-medium ${r.outcome === "auto" ? "bg-ok-soft text-ok" : r.outcome === "review" ? "bg-warn-soft text-warn" : "bg-canvas text-muted"}`}>
                      {r.outcome === "auto" ? "Would decide" : r.outcome === "review" ? "Would send to review" : "Not read"}
                    </span>
                  </p>
                  <p className="mt-0.5 text-sm text-ink-2">{r.why}</p>
                  {r.read && <p className="mt-0.5 text-[11px] text-muted">Read by Gemini: {r.read.source}{r.read.ms ? `, ${(r.read.ms / 1000).toFixed(1)}s` : ""}{r.read.note ? ` (${r.read.note})` : ""}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
