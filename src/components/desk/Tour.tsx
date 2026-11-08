"use client";
import { Check, ArrowRight, Sparkles } from "lucide-react";
import { STEPS, type Guide, type TourAction, type TourStepId } from "@/lib/tour";
import { Avatar } from "./Avatar";

const actionLabel = (a: TourAction) =>
  a.kind === "send" ? `Ask: “${a.text}”` : a.kind === "person" ? a.label : a.kind === "mail" ? "Bring in new mail" : "Reset demo";

/** Meera's guide line at the end of the chat: what that step showed, and what to try next. Never stored. */
export function GuideBubble({ guide, onAction }: { guide: Guide; onAction: (a: TourAction) => void }) {
  return (
    <div className="animate-enter flex gap-2.5" data-testid="guide">
      <Avatar size={28} />
      <div className="min-w-0 max-w-[88%] flex-1">
        <p className="mb-1 flex items-center gap-1 text-[11px] text-muted">
          Meera <span className="inline-flex items-center gap-0.5 rounded bg-accent-soft px-1 text-accent"><Sparkles className="size-3" aria-hidden />guide</span>
        </p>
        <div className="rounded-xl border border-accent/20 bg-accent-soft/60 px-3.5 py-2.5 text-sm leading-relaxed text-ink">
          {guide.state === "waiting" && <p className="presence-pulse text-ink-2">{guide.text}</p>}
          {guide.state !== "waiting" && guide.takeaway && <p className="text-ink-2">{guide.takeaway}</p>}
          {guide.state === "step" && (
            <>
              <p className={guide.takeaway ? "mt-1.5 font-medium" : "font-medium"}>
                <span className="mr-1.5 text-xs font-semibold text-accent">Step {guide.index + 1} of {STEPS.length}</span>
                {guide.text}
              </p>
              <button type="button" onClick={() => onAction(guide.action)} data-testid="guide-action"
                className="pressable mt-2 inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-white hover:bg-ink/90">
                {actionLabel(guide.action)} <ArrowRight className="size-3.5" aria-hidden />
              </button>
            </>
          )}
          {guide.state === "done" && <p className="mt-1.5 font-medium">{guide.text}</p>}
        </div>
      </div>
    </div>
  );
}

/** The checklist: where you are in the demo path, ticked from real state. */
export function DemoPath({ done, current, onHide }: { done: Set<TourStepId>; current: TourStepId | null; onHide: () => void }) {
  const count = STEPS.filter((s) => done.has(s.id)).length;
  return (
    <section aria-labelledby="demo-path-h" className="animate-enter rounded-xl border border-accent/20 bg-surface px-4 py-3" data-testid="demo-path">
      <header className="flex items-baseline justify-between">
        <h2 id="demo-path-h" className="text-xs font-medium uppercase tracking-wide text-muted">
          Demo path · <span className="text-accent" data-testid="demo-path-count">{count} of {STEPS.length}</span>
        </h2>
        <button type="button" onClick={onHide} className="pressable rounded px-1 text-[11px] text-muted hover:text-ink">Hide</button>
      </header>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-line" aria-hidden>
        <div className="h-full rounded-full bg-accent transition-[width] duration-500 [transition-timing-function:var(--ease-spring)]" style={{ width: `${(count / STEPS.length) * 100}%` }} />
      </div>
      <ol className="mt-2.5 space-y-1">
        {STEPS.map((s) => {
          const isDone = done.has(s.id);
          const isNow = s.id === current;
          return (
            <li key={s.id} className={`flex items-center gap-2 text-[13px] ${isDone ? "text-muted" : isNow ? "font-medium text-ink" : "text-ink-2"}`} aria-current={isNow ? "step" : undefined}>
              <span className={`grid size-4 shrink-0 place-items-center rounded-full border ${isDone ? "border-ok bg-ok text-white" : isNow ? "border-accent" : "border-line-2"}`}>
                {isDone && <Check key="tick" className="animate-settle size-2.5" strokeWidth={3.5} aria-hidden />}
                {isNow && <span className="size-1.5 rounded-full bg-accent" />}
              </span>
              <span className={isDone ? "line-through decoration-muted/40" : ""}>{s.label}</span>
            </li>
          );
        })}
      </ol>
      {!current && <p className="mt-2 text-xs text-ok">Done. Everything here is live, so keep exploring.</p>}
    </section>
  );
}
