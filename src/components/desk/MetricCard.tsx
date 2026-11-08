"use client";
import type { MetricsSummary } from "@/lib/metrics";
import { duration } from "@/lib/format";

const pctOf = (r: { rate: number | null; reversed: number; total: number }) =>
  r.rate == null ? "–" : `${Math.round(r.rate * 100)}%`;

export function MetricsBody({ m }: { m: MetricsSummary }) {
  const g = m.guardrail;
  const tone = g.state === "ok" ? "text-ok bg-ok-soft border-ok/25" : g.state === "breached" ? "text-bad bg-bad-soft border-bad/25" : "text-muted bg-canvas border-line";
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Hold → human decision · median</p>
      <div className="mt-1 flex items-baseline gap-3">
        <span className="text-3xl font-semibold tabular-nums" data-testid="metric-median">{m.medianMs == null ? "–" : duration(m.medianMs)}</span>
        <span className="text-sm text-muted">
          {m.decided} decided · {m.stillHeld} waiting
        </span>
      </div>
      <p className="mt-0.5 text-xs text-muted">
        Before (mock baseline, {m.baselineCount} items, old flow): <span className="font-medium text-ink-2">{m.baselineMedianMs == null ? "–" : duration(m.baselineMedianMs)}</span>
      </p>
      <div className="mt-3 border-t border-line pt-2.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Guardrail · reversal rate</p>
          <span className={`rounded-full border px-2 py-px text-[11px] font-medium ${tone}`}>
            {g.state === "ok" ? "OK" : g.state === "breached" ? "Breached" : "Too early"}
          </span>
        </div>
        <dl className="mt-1.5 grid grid-cols-3 gap-2 text-sm">
          <div><dt className="text-xs text-muted">Chat</dt><dd className="tabular-nums">{pctOf(m.reversal.chat)} <span className="text-xs text-muted">({m.reversal.chat.reversed}/{m.reversal.chat.total})</span></dd></div>
          <div><dt className="text-xs text-muted">Buttons</dt><dd className="tabular-nums">{pctOf(m.reversal.button)} <span className="text-xs text-muted">({m.reversal.button.reversed}/{m.reversal.button.total})</span></dd></div>
          <div><dt className="text-xs text-muted">Baseline</dt><dd className="tabular-nums">{pctOf(m.reversal.baseline)}</dd></div>
        </dl>
        <p className="mt-1 text-xs text-muted">{g.note}</p>
      </div>
    </div>
  );
}

export function MetricCard({ m }: { m: MetricsSummary }) {
  return (
    <section aria-label="Metrics" className="rounded-xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgb(17_24_39/0.04)]">
      <MetricsBody m={m} />
    </section>
  );
}
