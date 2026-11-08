"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Inbox, RotateCcw, X, Check, Ban, Trash2, Plug, Sparkles } from "lucide-react";
import { guide as tourGuide, highlight, type TourAction } from "@/lib/tour";
import { DemoPath, GuideBubble } from "./Tour";
import type { Citation } from "@/lib/types";
import { people } from "@/lib/data/seed";
import { inr0 } from "@/lib/format";
import { useDesk } from "./useDesk";
import { Chat } from "./Chat";
import { Feed } from "./Feed";
import { MetricCard } from "./MetricCard";
import { DocDrawer } from "./DocDrawer";
import { Avatar } from "./Avatar";

type DocTarget = { invoiceId: string; cite?: Citation };

export function Desk() {
  const d = useDesk();
  const [doc, setDoc] = useState<DocTarget | null>(null);
  const [docOpen, setDocOpen] = useState(false);
  const [pending, setPending] = useState<Record<string, "approve" | "reject">>({});
  // Walkthrough visibility is a per-viewer convenience; if storage is unavailable it just stays on.
  const [tourHidden, setTourHidden] = useState(() => {
    try { return typeof window !== "undefined" && window.localStorage.getItem("nod_tour_hidden") === "1"; } catch { return false; }
  });
  const setTour = (hidden: boolean) => {
    setTourHidden(hidden);
    try { window.localStorage.setItem("nod_tour_hidden", hidden ? "1" : "0"); } catch { /* fine: in-memory only */ }
  };

  // Mount the sheet off-screen, then open it on the next frame so the slide-in actually transitions.
  const openDoc = useCallback((invoiceId: string, cite?: Citation) => {
    setDoc({ invoiceId, cite });
    requestAnimationFrame(() => requestAnimationFrame(() => setDocOpen(true)));
  }, []);
  const closeDoc = useCallback(() => setDocOpen(false), []);
  const exitedDoc = useCallback(() => setDoc(null), []);

  // Buttons respond on press: the row dims and both buttons lock until the decision lands.
  const decide = async (invoiceId: string, decision: "approve" | "reject") => {
    setPending((p) => ({ ...p, [invoiceId]: decision }));
    try { await d.decide(invoiceId, decision); } finally {
      setPending((p) => { const n = { ...p }; delete n[invoiceId]; return n; });
    }
  };

  const s = d.state;
  if (!s) return <p className="presence-pulse p-8 text-sm text-muted">Opening the desk…</p>;
  const working = s.status.pending > 0;
  const decided = s.status.approved + s.status.rejected;

  const tour = tourGuide({ ...s, messages: d.messages ?? [] });
  const target = tourHidden ? null : highlight(tour.guide);
  const glow = (id: string) => (target === id ? "tour-glow" : "");
  const onTourAction = (a: TourAction) => {
    if (a.kind === "send") d.send(a.text);
    else if (a.kind === "person") d.switchPerson(a.id);
    else if (a.kind === "mail") d.deliverMail();
    else d.reset();
  };
  const guideKey = tour.guide.state === "step" ? `${tour.guide.step.id}:${tour.guide.text}` : tour.guide.state;

  return (
    <div className="mx-auto flex h-full max-w-[1600px] flex-col gap-4 px-5 py-4">
      {/* Who you're working with, and what she's doing right now */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-3">
          <span className="relative">
            <Avatar size={40} />
            <span className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-canvas ${working ? "presence-pulse bg-accent" : s.status.held ? "bg-warn" : "bg-ok"}`} aria-hidden />
          </span>
          <div>
            <p className="font-semibold leading-tight">Meera <span className="font-normal text-muted">· AP digital employee</span></p>
            <p className="text-sm text-muted" data-testid="status" aria-live="polite">
              {working ? <>Reading invoice {s.status.done + 1} of {s.status.total}</> : <>Read all {s.status.total} invoices</>}
              {" · "}{s.status.posted} posted · <span className={s.status.held ? "font-medium text-warn" : ""}>{s.status.held} on hold</span>
              {decided > 0 && ` · ${decided} decided by you`}
            </p>
          </div>
        </div>
        {s.status.mailWaiting && (
          <button type="button" onClick={d.deliverMail} data-tour="mail"
            className={`${glow("mail")} pressable animate-enter inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent hover:border-accent/50`}>
            <Inbox className="size-4" aria-hidden /> New mail (3)
          </button>
        )}
        {tourHidden && (
          <button type="button" onClick={() => setTour(false)} className="pressable inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-accent hover:bg-accent-soft">
            <Sparkles className="size-3.5" aria-hidden /> Show the demo path
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted" id="signed-in-as">Signed in as</span>
          <div role="radiogroup" aria-labelledby="signed-in-as" className="flex rounded-lg border border-line bg-surface p-0.5">
            {people.map((p) => {
              const on = s.person.id === p.id;
              return (
                <button key={p.id} type="button" role="radio" aria-checked={on} onClick={() => !on && d.switchPerson(p.id)} data-tour={`person-${p.id}`}
                  className={`${glow(`person-${p.id}`)} pressable rounded-md px-2.5 py-1 text-sm ${on ? "bg-ink text-white shadow-sm" : "text-ink-2 hover:bg-canvas hover:text-ink"}`}>
                  {p.name} <span className={on ? "text-white/70" : "text-muted"}>· {p.title}{p.limit ? ` ≤ ${inr0(p.limit)}` : ""}</span>
                </button>
              );
            })}
          </div>
          <McpButton workspace={s.workspace} personId={s.person.id} />
          <button type="button" onClick={d.reset} className="pressable inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted hover:bg-surface hover:text-ink">
            <RotateCcw className="size-3.5" aria-hidden /> Reset demo
          </button>
        </div>
      </div>

      {d.notice && (
        <div role={d.notice.tone === "bad" ? "alert" : "status"} className={`animate-enter flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${d.notice.tone === "bad" ? "border-bad/25 bg-bad-soft text-bad" : "border-ok/25 bg-ok-soft text-ok"}`}>
          <p className="flex-1">{d.notice.text}</p>
          <button type="button" onClick={() => d.setNotice(null)} aria-label="Dismiss" className="pressable rounded p-0.5 hover:bg-black/5"><X className="size-4" /></button>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_440px] gap-4">
        <Chat messages={d.messages} person={s.person} events={s.events} sending={d.sending} working={working}
          onSend={d.send} onUndo={d.undo} open={openDoc}
          guide={tourHidden ? null : <GuideBubble guide={tour.guide} onAction={onTourAction} />}
          guideKey={tourHidden ? "hidden" : guideKey} tourChip={target} />

        <div className="scroll-quiet flex min-h-0 flex-col gap-4 overflow-y-auto pr-0.5">
          {!tourHidden && <DemoPath done={tour.done} current={tour.current?.id ?? null} onHide={() => setTour(true)} />}
          <MetricCard m={s.metrics} />

          <section aria-labelledby="waiting-h" className="rounded-xl border border-line bg-surface">
            <header className="flex items-baseline justify-between px-4 pb-1.5 pt-3">
              <h2 id="waiting-h" className="text-xs font-medium uppercase tracking-wide text-muted">Waiting on you · {s.held.length}</h2>
              <span className="text-[11px] text-muted">or decide in chat</span>
            </header>
            {s.held.length === 0 && <p className="px-4 pb-3 text-sm text-muted">{working ? "Nothing yet. Meera will bring you anything she holds." : "All clear."}</p>}
            <ul data-testid="held">
              {s.held.map((h) => {
                const busy = pending[h.invoiceId];
                return (
                  <li key={h.invoiceId} className={`animate-enter flex items-center gap-2 border-t border-line px-4 py-2 transition-opacity ${busy ? "opacity-55" : ""}`} aria-busy={Boolean(busy)}>
                    <button type="button" onClick={() => d.send(`Why is ${h.invoiceId} on hold?`)} className="group min-w-0 flex-1 rounded text-left" title={`Ask Meera why ${h.invoiceId} is on hold`}>
                      <p className="text-sm"><span className="font-medium group-hover:text-accent">{h.invoiceId}</span> <span className="text-muted">· {inr0(h.total)}</span></p>
                      <p className="truncate text-xs text-muted">{busy ? (busy === "approve" ? "Approving…" : "Rejecting…") : <>{h.label}{h.escalatedTo ? ` · flagged for ${h.escalatedTo}` : ""}</>}</p>
                    </button>
                    <button type="button" disabled={Boolean(busy)} onClick={() => decide(h.invoiceId, "approve")} aria-label={`Approve ${h.invoiceId}`} title="Approve"
                      className="pressable grid size-8 place-items-center rounded-md border border-line text-ok hover:border-ok/40 hover:bg-ok-soft active:bg-ok-soft"><Check className="size-4" /></button>
                    <button type="button" disabled={Boolean(busy)} onClick={() => decide(h.invoiceId, "reject")} aria-label={`Reject ${h.invoiceId}`} title="Reject"
                      className="pressable grid size-8 place-items-center rounded-md border border-line text-bad hover:border-bad/40 hover:bg-bad-soft active:bg-bad-soft"><Ban className="size-4" /></button>
                  </li>
                );
              })}
            </ul>
          </section>

          {s.rules.some((r) => r.active) && (
            <section aria-labelledby="rules-h" className="animate-enter rounded-xl border border-line bg-surface px-4 py-3">
              <h2 id="rules-h" className="text-xs font-medium uppercase tracking-wide text-muted">Rules you taught Meera</h2>
              <ul className="mt-1.5 space-y-1.5" data-testid="rules">
                {s.rules.filter((r) => r.active).map((r) => {
                  const ev = s.events.find((e) => e.type === "rule_created" && (e.data as { ruleId?: string })?.ruleId === r.id);
                  return (
                    <li key={r.id} className="flex items-center gap-2 text-sm">
                      <span className="rounded bg-accent-soft px-1.5 text-xs font-medium text-accent">{r.id}</span>
                      <span className="flex-1">Hold {r.kind} variance over {r.thresholdPct}% <span className="text-xs text-muted">· {r.createdBy}, {r.source === "chat" ? "in chat" : r.source}</span></span>
                      {ev && <button type="button" onClick={() => d.undo(ev.id)} aria-label={`Remove rule ${r.id}`} title="Remove rule (undoable in the feed)" className="pressable rounded p-1 text-muted hover:bg-bad-soft hover:text-bad"><Trash2 className="size-3.5" /></button>}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section aria-labelledby="activity-h" className="flex min-h-[280px] flex-col rounded-xl border border-line bg-surface">
            <header className="flex items-center justify-between px-4 pb-1.5 pt-3">
              <h2 id="activity-h" className="text-xs font-medium uppercase tracking-wide text-muted">Activity · every action, with its source</h2>
              <span className="flex items-center gap-1.5 text-[11px] text-muted"><span className="presence-pulse size-1.5 rounded-full bg-ok" aria-hidden />Live</span>
            </header>
            <Feed events={s.events} onUndo={d.undo} onOpen={openDoc} />
          </section>
        </div>
      </div>

      <DocDrawer target={doc} open={docOpen} onClose={closeDoc} onExited={exitedDoc} />
    </div>
  );
}

/** The same tools, from Claude: an MCP endpoint scoped to this demo workspace and person. */
function McpButton({ workspace, personId }: { workspace: string; personId: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/api/mcp?ws=${workspace}&as=${personId}`;

  // Dismiss like a native popover: Escape (focus back to the trigger) or a press anywhere outside.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("pointerdown", onDown); };
  }, [open]);

  return (
    <div className="relative" ref={root}>
      <button ref={trigger} type="button" onClick={() => { setOpen((o) => !o); setCopied(false); }} aria-expanded={open} aria-haspopup="dialog"
        className={`pressable inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs hover:bg-surface hover:text-ink ${open ? "bg-surface text-ink" : "text-muted"}`}>
        <Plug className="size-3.5" aria-hidden /> Use from Claude
      </button>
      {open && (
        <div role="dialog" aria-label="Use Meera from Claude" style={{ transformOrigin: "top right" }}
          className="animate-pop absolute right-0 top-10 z-30 w-[420px] rounded-xl border border-line bg-surface p-4 text-sm shadow-[0_12px_32px_-8px_rgb(17_24_39/0.25)]">
          <p className="font-medium">Ask Meera from Claude (MCP)</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">Add this as a custom connector in Claude. Same tools, same permissions and the same activity feed, logged as “via Claude (MCP)”. Demo auth: the link itself is the key, and it acts as the person signed in now.</p>
          <div className="mt-2.5 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md bg-canvas px-2 py-1.5 font-mono text-xs">{url}</code>
            <button type="button" onClick={() => { navigator.clipboard.writeText(url); setCopied(true); }}
              className={`pressable rounded-md border px-2.5 py-1 text-xs font-medium ${copied ? "border-ok/30 bg-ok-soft text-ok" : "border-line hover:bg-canvas"}`} aria-live="polite">
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
