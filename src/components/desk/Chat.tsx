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
  "Undo that",
  "Approve 4477",
  "Always hold quantity variance over 5%",
  "How are we doing?",
];

export function Chat({ messages, person, events, sending, onSend, onUndo, open, working, guide, guideKey, tourChip }: {
  messages: ChatMessage[] | null; person: Person; events: FeedEvent[]; sending: boolean; working: boolean;
  onSend: (t: string) => void; onUndo: (id: number) => void; open: OpenDoc;
  guide?: React.ReactNode; guideKey?: string; tourChip?: string | null;
}) {
  const [draft, setDraft] = useState("");
  const [unseen, setUnseen] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const stick = useRef(true); // was the reader at the bottom before this update?
  const count = messages?.length ?? 0;
  const lastIsMine = messages?.[count - 1]?.author === "user";

  // Follow new messages only if the reader is already at the bottom (or just sent one).
  // If they scrolled up to read, leave them there and offer a way back.
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    if (stick.current || lastIsMine) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    else requestAnimationFrame(() => setUnseen(true));
  }, [count, sending, lastIsMine, guideKey]);

  // "/" jumps to the composer from anywhere on the desk.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onScroll = () => {
    const el = list.current!;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    if (stick.current && unseen) setUnseen(false);
  };
  const toBottom = () => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
    setUnseen(false);
  };

  const submit = (t: string) => {
    if (!t.trim() || sending) return;
    onSend(t);
    setDraft("");
  };

  return (
    <section aria-label="Chat with Meera" className="relative flex min-h-0 flex-col rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgb(17_24_39/0.04)]">
      {/* A soft scroll edge where messages meet the composer, instead of a hard rule. */}
      <div ref={list} onScroll={onScroll} role="log" aria-live="polite" aria-label="Conversation"
        className="scroll-quiet min-h-0 flex-1 space-y-4 overflow-y-auto p-5 [mask-image:linear-gradient(to_bottom,transparent,#000_14px,#000_calc(100%-24px),transparent)]" data-testid="chat-log">
        <AgentBubble>
          <p>
            Hi {person.name}. You&apos;re {person.role === "lead" ? "the finance lead" : "an AP clerk"} at Acme Fulfilment, a mock company. I&apos;m Meera, your AI accounts-payable employee.
            I read every vendor invoice, match it against its purchase order and goods receipt, and post the ones that match.
            Anything that doesn&apos;t, I hold and tell you why. {working ? "I'm reading today's invoices now." : "I've read today's invoices."} You decide on the holds, right here in chat.
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
            <AgentBubble key={m.id} mode={m.mode} testId="agent-msg">
              {m.text && <p className="whitespace-pre-line">{m.text}</p>}
              {m.cards && <Cards cards={m.cards} events={events} open={open} onUndo={onUndo} onAsk={submit} />}
            </AgentBubble>
          ),
        )}
        {!sending && guide}
        {sending && (
          <AgentBubble>
            <p className="thinking flex h-5 items-center gap-1" aria-label="Meera is checking"><span className="size-1.5 rounded-full bg-muted" /><span className="size-1.5 rounded-full bg-muted" /><span className="size-1.5 rounded-full bg-muted" /></p>
          </AgentBubble>
        )}
      </div>
      {unseen && (
        <button type="button" onClick={toBottom}
          className="pressable animate-pop absolute bottom-[132px] left-1/2 z-10 -translate-x-1/2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-2 shadow-md hover:text-ink">
          New message ↓
        </button>
      )}
      <div className="p-3 pt-1">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => submit(s)} disabled={sending} data-tour={s === tourChip ? "now" : undefined}
              className={`pressable rounded-full border px-2.5 py-1 text-xs disabled:opacity-50 ${s === tourChip ? "tour-glow border-accent/50 bg-accent-soft font-medium text-accent" : "border-line bg-canvas text-ink-2 hover:border-line-2 hover:text-ink"}`}>
              {s}
            </button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); submit(draft); }} className="flex items-center gap-2 rounded-xl border border-line-2 bg-surface px-3 py-1.5 transition-[border-color,box-shadow] focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/10">
          <label htmlFor="chat-input" className="sr-only">Message Meera</label>
          <input ref={input} id="chat-input" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={500} autoComplete="off"
            placeholder={`Ask Meera anything, ${person.name}…`} className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-muted" />
          {!draft && <kbd className="hidden rounded border border-line px-1.5 font-mono text-[10px] text-muted sm:inline" aria-hidden>/</kbd>}
          <button type="submit" disabled={!draft.trim() || sending} aria-label="Send"
            className="pressable grid size-8 place-items-center rounded-lg bg-ink text-white disabled:bg-line-2">
            <ArrowUp className="size-4" />
          </button>
        </form>
      </div>
    </section>
  );
}

function AgentBubble({ children, mode, testId }: { children: React.ReactNode; mode?: ChatMessage["mode"]; testId?: string }) {
  return (
    <div className="animate-enter flex gap-2.5" data-testid={testId}>
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
