// One chat turn: Gemini function-calling when available, the deterministic router otherwise.
// Either way the same tool executors run, so permissions, logging and citations are identical.
import "server-only";
import { q, q1, json } from "../db";
import type { Workspace } from "../workspace";
import type { Person } from "../types";
import type { Card, ChatMessage, ToolCall, ToolName } from "./types";
import { TOOL_DECLARATIONS, runTool, type ToolOutput } from "./tools";
import { asksForRule, asksToApprove, asksToReject, asksToUndo, route } from "./intent";
import { allow, genai, hasKey, isRateLimit, MODEL, redactSecrets, withRetry } from "../llm";
import { EMPLOYEE } from "../data/seed";
import { parseRule } from "../policy";
import { inr0 } from "../format";

const WRITE_GUARD: Partial<Record<ToolName, (t: string) => boolean>> = {
  approve_invoice: asksToApprove,
  reject_invoice: asksToReject,
  undo_last: asksToUndo,
  create_hold_rule: asksForRule,
};

export async function history(ws: string, limit = 60): Promise<ChatMessage[]> {
  const rows = await q<ChatMessage & { id: string }>(
    "select * from (select * from messages where workspace_id = $1 order by id desc limit $2) m order by id", [ws, limit]);
  return rows.map((r) => ({ ...r, id: Number(r.id) }));
}

async function save(ws: string, m: Omit<ChatMessage, "id" | "ts">) {
  const row = await q1<ChatMessage & { id: string }>(
    "insert into messages (workspace_id, author, person, text, cards, mode) values ($1,$2,$3,$4,$5,$6) returning *",
    [ws, m.author, m.person, m.text, m.cards ? json(m.cards) : null, m.mode],
  );
  return { ...row!, id: Number(row!.id) };
}

export async function chatTurn(ws: Workspace, person: Person, text: string) {
  const prior = await history(ws.id, 12);
  const userMsg = await save(ws.id, { author: "user", person: person.name, text, cards: null, mode: null });
  let reply: { text: string; cards: Card[]; mode: "gemini" | "offline" };
  try {
    reply = hasKey() && (await allow(`chat:${ws.id}`, 3600_000, 60)) ? await geminiTurn(ws, person, text, prior) : await offlineTurn(ws, person, text);
  } catch (e) {
    const msg = redactSecrets(String((e as Error)?.message ?? e));
    console.error("Gemini chat failed, using offline mode:", msg.slice(0, 300));
    reply = await offlineTurn(ws, person, text, isRateLimit(msg) ? "Gemini's free tier is rate-limiting, so I'm in offline mode." : undefined);
  }
  const agentMsg = await save(ws.id, { author: "agent", person: null, text: reply.text, cards: reply.cards.length ? reply.cards : null, mode: reply.mode });
  return [userMsg, agentMsg];
}

async function exec(ws: Workspace, person: Person, call: ToolCall, userText: string): Promise<ToolOutput> {
  const guard = WRITE_GUARD[call.name];
  if (guard && !guard(userText)) {
    return { result: { error: `Not done: ${call.name.replace(/_/g, " ")} is a write action and the user didn't explicitly ask for it. Ask them to confirm in their own words.` } };
  }
  if (call.name === "create_hold_rule") {
    // Trust the user's words over the model's reading of them.
    const parsed = parseRule(userText);
    if (parsed) call = { ...call, args: { kind: parsed.kind, threshold_pct: parsed.thresholdPct } };
  }
  const out = await runTool({ ws, person, source: "chat" }, call);
  if (out.focus !== undefined) ws.focus_invoice = out.focus;
  return out;
}

// ---------------------------------------------------------------- Gemini

function systemPrompt(ws: Workspace, person: Person) {
  return `You are ${EMPLOYEE.name}, an AI accounts-payable employee. You read vendor invoices, 3-way match them against purchase orders and goods receipts, post the ones that match, and hold the rest for a human.
You're talking with ${person.name}, ${person.title}${person.limit ? ` (approval limit ${inr0(person.limit)})` : " (no approval limit)"}. Talk like a capable colleague: direct, warm, brief (1-3 sentences). Indian rupee amounts use ₹ and lakh grouping as given by tools.
Invoice currently under discussion: ${ws.focus_invoice ?? "none"}. "it"/"this one" refers to it.
Rules:
- Every fact must come from a tool result in this conversation. Never invent numbers, invoices, vendors or reasons. If you don't know, call a tool or say so.
- Citations (PO, receipt and invoice lines) are rendered automatically as chips under your message; refer to them in words, don't list them.
- Only call approve_invoice / reject_invoice / undo_last / create_hold_rule when the user explicitly asks for that action in this message. Never decide on your own.
- One invoice per decision. If asked to approve several at once, say you do one at a time so each has an owner and an undo, and ask which first.
- If a tool refuses (permission or limit), relay the reason plainly and mention who it was escalated to. Don't apologise at length.
- After an approval or rejection, say what happened and that it can be undone.
- All data here is mock data for a demo.`;
}

async function geminiTurn(ws: Workspace, person: Person, text: string, prior: ChatMessage[]) {
  const ai = await genai();
  const contents: { role: "user" | "model"; parts: unknown[] }[] = prior
    .filter((m) => m.text)
    .map((m) => ({ role: m.author === "user" ? "user" : "model", parts: [{ text: m.author === "user" ? `${m.person}: ${m.text}` : m.text }] }));
  contents.push({ role: "user", parts: [{ text: `${person.name}: ${text}` }] });

  const cards: Card[] = [];
  for (let round = 0; round < 4; round++) {
    const res = await withRetry(() =>
      ai.models.generateContent({
        model: MODEL,
        contents: contents as never,
        config: { systemInstruction: systemPrompt(ws, person), tools: [{ functionDeclarations: TOOL_DECLARATIONS as never }], temperature: 0.2 },
      }),
    );
    const calls = res.functionCalls ?? [];
    if (!calls.length) {
      return { text: (res.text ?? "").trim() || "Done.", cards, mode: "gemini" as const };
    }
    contents.push({ role: "model", parts: (res.candidates?.[0]?.content?.parts ?? []) as unknown[] });
    const responses: unknown[] = [];
    for (const c of calls) {
      const out = await exec(ws, person, { name: c.name as ToolName, args: (c.args ?? {}) as Record<string, unknown> }, text);
      if (out.card) cards.push(out.card);
      responses.push({ functionResponse: { name: c.name, id: c.id, response: out.result } });
    }
    contents.push({ role: "user", parts: responses });
  }
  return { text: "I got tangled up there. Could you ask that again more simply?", cards, mode: "gemini" as const };
}

// ---------------------------------------------------------------- offline

async function offlineTurn(ws: Workspace, person: Person, text: string, prefix?: string) {
  const r = route(text);
  if ("reply" in r) return { text: [prefix, r.reply].filter(Boolean).join(" "), cards: [], mode: "offline" as const };
  const cards: Card[] = [];
  const lines: string[] = prefix ? [prefix] : [];
  for (const call of r.calls) {
    const out = await exec(ws, person, call, text);
    if (out.card) cards.push(out.card);
    lines.push(template(call.name, out.result, person));
  }
  return { text: lines.join(" "), cards, mode: "offline" as const };
}

function template(name: ToolName, r: Record<string, unknown>, person: Person): string {
  if (r.error) return String(r.error);
  if (r.refused) return `I can't do that. ${r.reason}${r.escalated_to ? ` I've flagged it for ${r.escalated_to}.` : ""}`;
  switch (name) {
    case "list_held": {
      const items = r.items as { invoice: string; reason: string }[];
      if (!items.length) return "Nothing is on hold right now.";
      return `${items.length} invoice${items.length > 1 ? "s are" : " is"} on hold, waiting on a decision: ${items.map((i) => `${i.invoice} (${i.reason.toLowerCase()})`).join(", ")}.`;
    }
    case "explain_invoice": {
      const findings = r.findings as { status: string; finding: string; rule: string | null }[];
      if (r.status === "held") {
        const f = findings[0];
        return `I held ${r.invoice} from ${r.vendor} (${r.total}) for a ${String(r.hold_reason).toLowerCase()}. ${f.finding}${f.rule ? ` Rule: ${f.rule}.` : ""}${r.escalated_to ? ` It's flagged for ${r.escalated_to}.` : ""}`;
      }
      if (r.status === "posted") return `${r.invoice} isn't on hold: it matched its PO and receipt and I posted it.${findings[0] ? ` One note: ${findings[0].finding}` : ""}`;
      if (r.status === "approved" || r.status === "rejected") return `${r.invoice} was ${r.status} by ${r.decided_by}.`;
      return `I haven't read ${r.invoice} yet.`;
    }
    case "approve_invoice":
    case "reject_invoice":
    case "undo_last":
      return `Done, ${person.name}. ${r.summary}${name === "undo_last" ? "" : " You can undo this."}`;
    case "create_hold_rule":
      return `Got it. ${r.summary}`;
    case "get_metrics":
      return `Median time from hold to decision: ${r.median_hold_to_decision} (mock baseline: ${r.mock_baseline_median}). ${(r.guardrail as { note: string }).note}`;
  }
}
