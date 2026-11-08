"use client";
import { useCallback, useState } from "react";
import { Inbox, RotateCcw, X, Check, Ban, Trash2, Plug } from "lucide-react";
import type { Citation } from "@/lib/types";
import { people } from "@/lib/data/seed";
import { inr0 } from "@/lib/format";
import { useDesk } from "./useDesk";
import { Chat } from "./Chat";
import { Feed } from "./Feed";
import { MetricCard } from "./MetricCard";
import { DocDrawer } from "./DocDrawer";
import { Avatar } from "./Avatar";

export function Desk() {
  const d = useDesk();
  const [doc, setDoc] = useState<{ invoiceId: string; cite?: Citation } | null>(null);
  const open = useCallback((invoiceId: string, cite?: Citation) => setDoc({ invoiceId, cite }), []);
  const close = useCallback(() => setDoc(null), []);
  const s = d.state;

  if (!s) return <p className="p-8 text-sm text-muted">Loading the desk…</p>;
  const working = s.status.pending > 0;

  return (
    <div className="mx-auto flex h-full max-w-[1600px] flex-col gap-4 px-5 py-4">
      {/* Employee strip */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <Avatar size={40} />
          <div>
            <p className="font-semibold leading-tight">Meera <span className="font-normal text-muted">· AP digital employee</span></p>
            <p className="text-sm text-muted" data-testid="status">
              {working ? (
                <span><span className="presence-pulse mr-1.5 inline-block size-2 rounded-full bg-accent align-middle" />Reading invoice {s.status.done + 1} of {s.status.total}</span>
              ) : (
                <span>Read all {s.status.total} invoices</span>
              )}
              {" · "}{s.status.posted} posted · <span className={s.status.held ? "font-medium text-warn" : ""}>{s.status.held} on hold</span>
              {(s.status.approved + s.status.rejected) > 0 && ` · ${s.status.approved + s.status.rejected} decided by you`}
            </p>
          </div>
        </div>
        {s.status.mailWaiting && (
          <button type="button" onClick={d.deliverMail} className="pressable inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent">
            <Inbox className="size-4" aria-hidden /> New mail (3)
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted">Signed in as</span>
          <div role="radiogroup" aria-label="Signed in as" className="flex rounded-lg border border-line bg-surface p-0.5">
            {people.map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={s.person.id === p.id} onClick={() => d.switchPerson(p.id)}
                className={`pressable rounded-md px-2.5 py-1 text-sm ${s.person.id === p.id ? "bg-ink text-white" : "text-ink-2 hover:text-ink"}`}>
                {p.name} <span className={s.person.id === p.id ? "text-white/70" : "text-muted"}>· {p.title}{p.limit ? ` ≤ ${inr0(p.limit)}` : ""}</span>
              </button>
            ))}
          </div>
          <McpButton workspace={s.workspace} personId={s.person.id} />
          <button type="button" onClick={d.reset} className="pressable inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted hover:text-ink" title="Start a fresh demo workspace">
            <RotateCcw className="size-3.5" aria-hidden /> Reset demo
          </button>
        </div>
      </div>

      {d.notice && (
        <div role="status" className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${d.notice.tone === "bad" ? "border-bad/25 bg-bad-soft text-bad" : "border-ok/25 bg-ok-soft text-ok"}`}>
          <p className="flex-1">{d.notice.text}</p>
          <button type="button" onClick={() => d.setNotice(null)} aria-label="Dismiss"><X className="size-4" /></button>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_440px] gap-4">
        <Chat messages={d.messages} person={s.person} events={s.events} sending={d.sending} working={working}
          onSend={d.send} onUndo={d.undo} open={open} />

        <div className="scroll-quiet flex min-h-0 flex-col gap-4 overflow-y-auto pr-0.5">
          <MetricCard m={s.metrics} />

          <section aria-label="Waiting on you" className="rounded-xl border border-line bg-surface">
            <header className="flex items-center justify-between px-4 pb-1.5 pt-3">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted">Waiting on you · {s.held.length}</h2>
              <span className="text-[11px] text-muted">buttons are logged as “via button”</span>
            </header>
            {s.held.length === 0 && <p className="px-4 pb-3 text-sm text-muted">{working ? "Nothing yet." : "All clear."}</p>}
            <ul data-testid="held">
              {s.held.map((h) => (
                <li key={h.invoiceId} className="flex items-center gap-2 border-t border-line px-4 py-2">
                  <button type="button" onClick={() => d.send(`Why is ${h.invoiceId} on hold?`)} className="min-w-0 flex-1 text-left">
                    <p className="text-sm"><span className="font-medium">{h.invoiceId}</span> <span className="text-muted">· {inr0(h.total)}</span></p>
                    <p className="truncate text-xs text-muted">{h.label}{h.escalatedTo ? ` · flagged for ${h.escalatedTo}` : ""}</p>
                  </button>
                  <button type="button" onClick={() => d.decide(h.invoiceId, "approve")} aria-label={`Approve ${h.invoiceId}`} title="Approve"
                    className="pressable grid size-7 place-items-center rounded-md border border-line text-ok hover:bg-ok-soft"><Check className="size-4" /></button>
                  <button type="button" onClick={() => d.decide(h.invoiceId, "reject")} aria-label={`Reject ${h.invoiceId}`} title="Reject"
                    className="pressable grid size-7 place-items-center rounded-md border border-line text-bad hover:bg-bad-soft"><Ban className="size-4" /></button>
                </li>
              ))}
            </ul>
          </section>

          {s.rules.some((r) => r.active) && (
            <section aria-label="Rules Meera follows" className="rounded-xl border border-line bg-surface px-4 py-3">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted">Rules you taught Meera</h2>
              <ul className="mt-1.5 space-y-1.5" data-testid="rules">
                {s.rules.filter((r) => r.active).map((r) => {
                  const ev = s.events.find((e) => e.type === "rule_created" && (e.data as { ruleId?: string })?.ruleId === r.id);
                  return (
                    <li key={r.id} className="flex items-center gap-2 text-sm">
                      <span className="rounded bg-accent-soft px-1.5 text-xs font-medium text-accent">{r.id}</span>
                      <span className="flex-1">Hold {r.kind} variance over {r.thresholdPct}% <span className="text-xs text-muted">· {r.createdBy}, {r.source === "chat" ? "in chat" : r.source}</span></span>
                      {ev && <button type="button" onClick={() => d.undo(ev.id)} aria-label={`Remove rule ${r.id}`} className="text-muted hover:text-bad"><Trash2 className="size-3.5" /></button>}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section aria-label="Activity" className="flex min-h-[280px] flex-col rounded-xl border border-line bg-surface">
            <header className="flex items-center justify-between px-4 pb-1.5 pt-3">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted">Activity · every action, with its source</h2>
              <span className="presence-pulse size-1.5 rounded-full bg-ok" title="Live" />
            </header>
            <Feed events={s.events} onUndo={d.undo} onOpen={open} />
          </section>
        </div>
      </div>

      <DocDrawer target={doc} onClose={close} />
    </div>
  );
}

/** The same tools, from Claude: an MCP endpoint scoped to this demo workspace and person. */
function McpButton({ workspace, personId }: { workspace: string; personId: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/api/mcp?ws=${workspace}&as=${personId}`;
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="pressable inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted hover:text-ink">
        <Plug className="size-3.5" aria-hidden /> Use from Claude
      </button>
      {open && (
        <div className="animate-enter absolute right-0 top-9 z-30 w-[420px] rounded-xl border border-line bg-surface p-4 text-sm shadow-xl">
          <p className="font-medium">Ask Meera from Claude (MCP)</p>
          <p className="mt-1 text-xs text-muted">Add this as a custom connector in Claude. Same tools, same permissions and the same activity feed, logged as “via Claude (MCP)”. Demo auth: the link itself is the key; it acts as the person signed in now.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md bg-canvas px-2 py-1.5 font-mono text-xs">{url}</code>
            <button type="button" onClick={() => { navigator.clipboard.writeText(url); setCopied(true); }}
              className="pressable rounded-md border border-line px-2 py-1 text-xs">{copied ? "Copied" : "Copy"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
