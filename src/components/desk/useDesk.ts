"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FeedEvent, HeldItem } from "@/lib/service";
import type { MetricsSummary } from "@/lib/metrics";
import type { Person, UserRule } from "@/lib/types";
import type { ChatMessage } from "@/lib/chat/types";

export type DeskState = {
  workspace: string;
  person: Person;
  focus: string | null;
  status: { total: number; done: number; pending: number; held: number; posted: number; approved: number; rejected: number; mailWaiting: boolean; mailDelivered: boolean };
  events: FeedEvent[];
  held: HeldItem[];
  rules: UserRule[];
  metrics: MetricsSummary;
};

const STEP_GAP_MS = 650; // pace: the feed shows the agent working, one invoice at a time
const POLL_MS = 1500;

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, body === undefined ? { cache: "no-store" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export type Notice = { tone: "bad" | "ok"; text: string } | null;

export function useDesk() {
  const [state, setState] = useState<DeskState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const working = useRef(false);

  const refresh = useCallback(async () => {
    const s = await api<DeskState>("/api/state");
    setState(s);
    return s;
  }, []);

  // The agent's work loop: one invoice per request, paced so a person can follow it.
  const work = useCallback(async () => {
    if (working.current) return;
    working.current = true;
    try {
      for (;;) {
        const r = await api<{ processed: string | null }>("/api/agent/step", {});
        const s = await refresh();
        if (!r.processed || s.status.pending === 0) break;
        await new Promise((res) => setTimeout(res, STEP_GAP_MS));
      }
    } catch (e) {
      setNotice({ tone: "bad", text: (e as Error).message });
    } finally {
      working.current = false;
    }
  }, [refresh]);

  useEffect(() => {
    let alive = true;
    api<{ messages: ChatMessage[] }>("/api/chat").then((r) => alive && setMessages(r.messages));
    api<DeskState>("/api/state").then((s) => {
      if (!alive) return;
      setState(s);
      if (s.status.pending > 0) work();
    });
    // Poll; if there's work and nobody in this tab is doing it (e.g. after a reload), pick it up.
    const t = setInterval(() => { refresh().then((s) => { if (s.status.pending > 0) work(); }).catch(() => {}); }, POLL_MS);
    return () => { alive = false; clearInterval(t); };
  }, [refresh, work]);

  const send = useCallback(async (text: string) => {
    const clean = text.trim();
    if (!clean || sending) return;
    setSending(true);
    const temp: ChatMessage = { id: -Date.now(), ts: new Date().toISOString(), author: "user", person: state?.person.name ?? null, text: clean, cards: null, mode: null };
    setMessages((m) => [...(m ?? []), temp]);
    try {
      const r = await api<{ messages: ChatMessage[] }>("/api/chat", { text: clean });
      setMessages((m) => [...(m ?? []).filter((x) => x.id !== temp.id), ...r.messages]);
    } catch (e) {
      setMessages((m) => (m ?? []).filter((x) => x.id !== temp.id));
      setNotice({ tone: "bad", text: (e as Error).message });
    } finally {
      setSending(false);
      refresh();
    }
  }, [sending, state?.person.name, refresh]);

  type Outcome = { ok: boolean; reason?: string; summary?: string; escalatedTo?: string };
  const report = useCallback((o: Outcome) => setNotice(o.ok ? { tone: "ok", text: o.summary ?? "Done." } : { tone: "bad", text: `${o.reason}${o.escalatedTo ? ` Flagged for ${o.escalatedTo}.` : ""}` }), []);

  const decide = useCallback(async (invoice: string, decision: "approve" | "reject") => {
    report(await api<Outcome>("/api/decide", { invoice, decision }));
    refresh();
  }, [refresh, report]);

  const undo = useCallback(async (eventId: number) => {
    report(await api<Outcome>("/api/undo", { eventId }));
    refresh();
  }, [refresh, report]);

  const switchPerson = useCallback(async (id: string) => {
    await api("/api/person", { id });
    setNotice(null);
    refresh();
  }, [refresh]);

  const deliverMail = useCallback(async () => {
    await api("/api/mail", {});
    await refresh();
    work();
  }, [refresh, work]);

  const reset = useCallback(async () => {
    await api("/api/reset", {});
    window.location.reload();
  }, []);

  return { state, messages, sending, notice, setNotice, send, decide, undo, switchPerson, deliverMail, reset };
}
