"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import type { ChatMessage } from "@/lib/chat/types";
import type { FeedEvent } from "@/lib/service";
import type { Person } from "@/lib/types";
import { Cards, type OpenDoc } from "./Cards";
import { Avatar } from "./Avatar";

const SUGGESTIONS = [
  "What's on hold?",
  "Why is invoice 4471 on hold?",
  "Approve it",
  "Approve 4477",
  "Always hold quantity variance over 5%",
  "How are we doing?",
];

export function Chat({ messages, person, events, sending, onSend, onUndo, open, working }: {
  messages: ChatMessage[] | null; person: Person; events: FeedEvent[]; sending: boolean; working: boolean;
  onSend: (t: string) => void; onUndo: (id: number) => void; open: OpenDoc;
}) {
  const [draft, setDraft] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const count = messages?.length ?? 0;

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [count, sending]);

  const submit = (t: string) => {
    if (!t.trim() || sending) return;
    onSend(t);
    setDraft("");
  };

  return (
    <section aria-label="Chat with Meera" className="flex min-h-0 flex-col rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgb(17_24_39/0.04)]">
      <div ref={list} className="scroll-quiet min-h-0 flex-1 space-y-4 overflow-y-auto p-5" data-testid="chat-log">
        <AgentBubble>
          <p>
            Hi {person.name}. I&apos;m Meera, your AP employee. {working ? "I'm working through today's invoices now." : "I've been through today's invoices."} Anything that doesn&apos;t match its PO and goods receipt, I hold and tell you why. Ask me about any invoice, and decide right here.
          </p>
        </AgentBubble>
        {messages?.map((m) =>
          m.author === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[80%]">
                <p className="mb-1 text-right text-[11px] text-muted">{m.person}</p>
                <p className="animate-enter rounded-2xl rounded-br-md bg-ink px-3.5 py-2 text-sm text-white">{m.text}</p>
              </div>
            </div>
          ) : (
            <AgentBubble key={m.id} mode={m.mode}>
              {m.text && <p className="whitespace-pre-line">{m.text}</p>}
              {m.cards && <Cards cards={m.cards} events={events} open={open} onUndo={onUndo} onAsk={submit} />}
            </AgentBubble>
          ),
        )}
        {sending && (
          <AgentBubble>
            <p className="presence-pulse text-muted">Checking…</p>
          </AgentBubble>
        )}
      </div>
      <div className="border-t border-line p-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => submit(s)} disabled={sending}
              className="pressable rounded-full border border-line bg-canvas px-2.5 py-1 text-xs text-ink-2 hover:border-line-2 hover:text-ink disabled:opacity-50">
              {s}
            </button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); submit(draft); }} className="flex items-center gap-2 rounded-xl border border-line-2 bg-surface px-3 py-1.5 focus-within:border-accent">
          <label htmlFor="chat-input" className="sr-only">Message Meera</label>
          <input id="chat-input" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500} autoComplete="off"
            placeholder={`Ask Meera anything, ${person.name}…`} className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-muted" />
          <button type="submit" disabled={!draft.trim() || sending} aria-label="Send"
            className="pressable grid size-8 place-items-center rounded-lg bg-ink text-white disabled:bg-line-2">
            <ArrowUp className="size-4" />
          </button>
        </form>
      </div>
    </section>
  );
}

function AgentBubble({ children, mode }: { children: React.ReactNode; mode?: ChatMessage["mode"] }) {
  return (
    <div className="animate-enter flex gap-2.5">
      <Avatar size={28} />
      <div className="min-w-0 max-w-[88%] flex-1">
        <p className="mb-1 text-[11px] text-muted">
          Meera{mode === "offline" ? " · offline mode (no model)" : mode === "gemini" ? " · Gemini" : ""}
        </p>
        <div className="text-sm leading-relaxed text-ink">{children}</div>
      </div>
    </div>
  );
}
