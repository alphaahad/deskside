"use client";
import { Bot, CheckCircle2, CircleSlash, FileCheck2, Inbox, PauseCircle, ShieldAlert, Undo2, ScrollText, Flag } from "lucide-react";
import type { FeedEvent } from "@/lib/service";
import { time } from "@/lib/format";

const ICON: Record<string, { Icon: typeof Bot; cls: string }> = {
  posted: { Icon: FileCheck2, cls: "text-ok" },
  held: { Icon: PauseCircle, cls: "text-warn" },
  approved: { Icon: CheckCircle2, cls: "text-ok" },
  rejected: { Icon: CircleSlash, cls: "text-bad" },
  undone: { Icon: Undo2, cls: "text-accent" },
  refused: { Icon: ShieldAlert, cls: "text-bad" },
  escalated: { Icon: Flag, cls: "text-warn" },
  rule_created: { Icon: ScrollText, cls: "text-accent" },
  mail: { Icon: Inbox, cls: "text-accent" },
};

const SOURCE: Record<string, string> = { agent: "agent", chat: "via chat", button: "via button", mcp: "via Claude (MCP)", rule: "by rule" };

export function Feed({ events, onUndo, onOpen }: { events: FeedEvent[]; onUndo: (id: number) => void; onOpen: (invoiceId: string) => void }) {
  const list = [...events].reverse();
  return (
    <ol className="flex flex-col" aria-label="Activity feed" data-testid="feed">
      {list.length === 0 && <li className="px-4 py-6 text-sm text-muted">Nothing yet. Meera is starting up.</li>}
      {list.map((e) => {
        const { Icon, cls } = ICON[e.type] ?? { Icon: Bot, cls: "text-muted" };
        const undone = e.undone_by != null;
        const read = (e.data as { read?: { source: string; ms: number | null } } | null)?.read;
        return (
          <li key={e.id} className="animate-enter flex gap-2.5 border-b border-line px-4 py-2.5 last:border-0" data-type={e.type}>
            <Icon className={`mt-0.5 size-4 shrink-0 ${cls}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className={`text-[13px] leading-snug ${undone ? "text-muted line-through decoration-muted/50" : "text-ink"}`}>{e.summary}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
                <span>{time(e.ts)}</span>
                <span>{e.actor}</span>
                <span className={`rounded px-1 ${e.source === "chat" ? "bg-accent-soft text-accent" : e.source === "mcp" ? "bg-accent-soft text-accent" : e.source === "rule" ? "bg-warn-soft text-warn" : "bg-canvas"}`}>{SOURCE[e.source] ?? e.source}</span>
                {read && <span>read: {read.source}{read.ms ? ` ${(read.ms / 1000).toFixed(1)}s` : ""}</span>}
                {undone && <span className="font-medium text-accent">undone</span>}
                {e.invoice_id && (
                  <button type="button" onClick={() => onOpen(e.invoice_id!)} className="underline decoration-line-2 underline-offset-2 hover:text-ink">open</button>
                )}
              </p>
            </div>
            {e.undoable && !undone && (
              <button type="button" onClick={() => onUndo(e.id)} aria-label={`Undo: ${e.summary}`}
                className="pressable inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-line bg-surface px-2 text-xs font-medium text-ink-2 hover:text-ink">
                <Undo2 className="size-3.5" aria-hidden /> Undo
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}
