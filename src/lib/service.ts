// Everything that changes state goes through here, whatever the surface (chat, button, MCP).
// Each change: authorize → write → log an event with actor, role and source.
import "server-only";
import { q, q1, json } from "./db";
import type { Check, Extraction, InvoiceStatus, LlmSource, MatchResult, Person, Source, UserRule } from "./types";
import { invoices as seedInvoices, seedInvoice, vendorOf, EMPLOYEE, personOf } from "./data/seed";
import { masterData } from "./data/truth";
import { baseline } from "./data/baseline";
import { extractInvoice } from "./llm";
import { failures, holdLabel, match } from "./match";
import { authorize } from "./authz";
import { describeRule } from "./policy";
import { summarise, type Decision } from "./metrics";
import { inr0 } from "./format";
import type { Workspace } from "./workspace";

// ---------------------------------------------------------------- reads

export type InvoiceRow = {
  id: string;
  wave: number;
  status: InvoiceStatus | "processing";
  extraction: Extraction | null;
  extraction_source: LlmSource | null;
  extraction_ms: number | null;
  match: MatchResult | null;
  hold_label: string | null;
  held_at: string | null;
  decided_at: string | null;
  decided_by: string | null;
  decision_source: Source | null;
  escalated_to: string | null;
  processed_at: string | null;
};

export type FeedEvent = {
  id: number;
  ts: string;
  actor: string;
  actor_role: string;
  source: Source;
  type: string;
  invoice_id: string | null;
  summary: string;
  data: Record<string, unknown> | null;
  undoable: boolean;
  undone_by: number | null;
  undoes: number | null;
};

export const invoiceRows = (ws: string) =>
  q<InvoiceRow>("select * from invoices where workspace_id = $1 order by id", [ws]);

export const invoiceRow = (ws: string, id: string) =>
  q1<InvoiceRow>("select * from invoices where workspace_id = $1 and id = $2", [ws, id]);

export async function rules(ws: string): Promise<UserRule[]> {
  const rows = await q<{ id: string; kind: "quantity" | "price"; threshold_pct: number; created_by: string; source: Source; created_at: string; active: boolean }>(
    "select * from rules where workspace_id = $1 order by created_at", [ws]);
  return rows.map((r) => ({ id: r.id, kind: r.kind, thresholdPct: Number(r.threshold_pct), createdBy: r.created_by, source: r.source, createdAt: r.created_at, active: r.active }));
}

export const feed = (ws: string, after = 0) =>
  q<FeedEvent>("select * from events where workspace_id = $1 and id > $2 order by id limit 300", [ws, after]).then((rows) =>
    rows.map((r) => ({ ...r, id: Number(r.id), undone_by: r.undone_by == null ? null : Number(r.undone_by), undoes: r.undoes == null ? null : Number(r.undoes) })),
  );

export type Explanation = {
  invoiceId: string;
  vendor: string;
  number: string;
  total: number;
  status: InvoiceRow["status"];
  label: string | null;
  reasons: Check[]; // failing checks (held) or warnings (passed)
  passed: Check[];
  heldAt: string | null;
  decidedBy: string | null;
  escalatedTo: string | null;
  read: { source: LlmSource | null; ms: number | null };
};

export async function explain(ws: string, invoiceId: string): Promise<Explanation | null> {
  const row = await invoiceRow(ws, invoiceId);
  const seed = seedInvoice(invoiceId);
  if (!row || !seed) return null;
  const m = row.match;
  return {
    invoiceId,
    vendor: vendorOf(seed.vendorId).name,
    number: row.extraction?.invoice_number ?? seed.number,
    total: row.extraction?.total ?? seed.total,
    status: row.status,
    label: row.hold_label,
    reasons: m ? (m.ok ? m.checks.filter((c) => c.status === "warn") : failures(m)) : [],
    passed: m ? m.checks.filter((c) => c.status === "pass") : [],
    heldAt: row.held_at,
    decidedBy: row.decided_by,
    escalatedTo: row.escalated_to,
    read: { source: row.extraction_source, ms: row.extraction_ms },
  };
}

export async function heldList(ws: string) {
  const rows = await q<InvoiceRow>("select * from invoices where workspace_id = $1 and status = 'held' order by held_at, id", [ws]);
  return rows.map((r) => {
    const seed = seedInvoice(r.id)!;
    return { invoiceId: r.id, vendor: vendorOf(seed.vendorId).name, total: r.extraction?.total ?? seed.total, label: r.hold_label ?? "", heldAt: r.held_at!, escalatedTo: r.escalated_to };
  });
}
export type HeldItem = Awaited<ReturnType<typeof heldList>>[number];

export async function metrics(ws: string) {
  const rows = await q<{ invoice_id: string; data: { heldAt: string }; ts: string; source: Source; undone_by: number | null }>(
    "select invoice_id, data, ts, source, undone_by from events where workspace_id = $1 and type in ('approved','rejected') order by id", [ws]);
  const decisions: Decision[] = rows.map((r) => ({ invoiceId: r.invoice_id, heldAt: r.data.heldAt, decidedAt: r.ts, source: r.source, reversed: r.undone_by != null }));
  const held = await q1<{ n: string }>("select count(*) n from invoices where workspace_id = $1 and status = 'held'", [ws]);
  return summarise(decisions, baseline, Number(held?.n ?? 0));
}

export async function status(ws: Workspace) {
  const counts = await q<{ status: string; n: string }>("select status, count(*) n from invoices where workspace_id = $1 group by status", [ws.id]);
  const c = Object.fromEntries(counts.map((r) => [r.status, Number(r.n)])) as Record<string, number>;
  const total = Object.values(c).reduce((a, b) => a + b, 0);
  const pending = (c.queued ?? 0) + (c.processing ?? 0);
  return {
    total, done: total - pending, pending,
    held: c.held ?? 0, posted: c.posted ?? 0, approved: c.approved ?? 0, rejected: c.rejected ?? 0,
    mailWaiting: !ws.mail_delivered_at && pending === 0,
    mailDelivered: Boolean(ws.mail_delivered_at),
  };
}

// ---------------------------------------------------------------- the agent

async function log(ws: string, e: { actor: string; actor_role: string; source: Source; type: string; invoice_id?: string | null; summary: string; data?: unknown; undoable?: boolean; undoes?: number }) {
  const row = await q1<{ id: string }>(
    `insert into events (workspace_id, actor, actor_role, source, type, invoice_id, summary, data, undoable, undoes)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
    [ws, e.actor, e.actor_role, e.source, e.type, e.invoice_id ?? null, e.summary, e.data == null ? null : json(e.data), e.undoable ?? false, e.undoes ?? null],
  );
  return Number(row!.id);
}

const agentLog = (ws: string, e: Omit<Parameters<typeof log>[1], "actor" | "actor_role" | "source"> & { source?: Source }) =>
  log(ws, { actor: EMPLOYEE.name, actor_role: "agent", source: e.source ?? "agent", ...e });

/** Process the next queued invoice: read the PDF, 3-way match, post or hold. One per call so the UI can pace it. */
export async function processNext(ws: string) {
  // Claim the next queued invoice, or reclaim one whose reader died mid-way (closed tab, redeploy).
  const claimable = `(status = 'queued' or (status = 'processing' and processed_at < now() - interval '45 seconds'))`;
  const claimed = await q1<{ id: string }>(
    `update invoices set status = 'processing', processed_at = now()
     where workspace_id = $1 and ${claimable}
       and id = (select id from invoices where workspace_id = $1 and ${claimable} order by id limit 1)
     returning id`,
    [ws],
  );
  if (!claimed) return { processed: null };
  const seed = seedInvoice(claimed.id)!;
  try {
    const read = await extractInvoice(ws, seed);
    const settled = (await q<{ id: string; extraction: Extraction }>(
      "select id, extraction from invoices where workspace_id = $1 and status in ('posted','approved') and extraction is not null", [ws],
    )).map((r) => ({ invoiceId: r.id, vendorId: seedInvoice(r.id)!.vendorId, number: r.extraction.invoice_number, total: r.extraction.total }));
    const activeRules = await rules(ws);
    const m = match({ invoiceId: seed.id, extraction: read.value, ...masterData(), settled, rules: activeRules });
    const vendor = vendorOf(seed.vendorId).name;
    const readNote = { source: read.source, ms: read.ms ?? null, note: read.note ?? null };

    if (m.ok) {
      await q(
        `update invoices set status = 'posted', extraction = $3, extraction_source = $4, extraction_ms = $5, match = $6, processed_at = now()
         where workspace_id = $1 and id = $2`,
        [ws, seed.id, json(read.value), read.source, read.ms ?? null, json(m)],
      );
      const warn = m.checks.find((c) => c.status === "warn");
      await agentLog(ws, {
        type: "posted", invoice_id: seed.id,
        summary: `Posted ${seed.id} (${vendor}, ${inr0(read.value.total)}): 3-way matched${warn ? `, with a note: ${warn.summary}` : "."}`,
        data: { read: readNote, warn: warn ?? null },
      });
    } else {
      const label = holdLabel(m);
      const first = failures(m)[0];
      await q(
        `update invoices set status = 'held', extraction = $3, extraction_source = $4, extraction_ms = $5, match = $6, hold_label = $7, held_at = now(), processed_at = now()
         where workspace_id = $1 and id = $2`,
        [ws, seed.id, json(read.value), read.source, read.ms ?? null, json(m), label],
      );
      await agentLog(ws, {
        type: "held", invoice_id: seed.id, source: first.rule?.startsWith("R-") ? "rule" : "agent",
        summary: `Held ${seed.id} (${vendor}, ${inr0(read.value.total)}): ${label}. ${first.summary}${first.rule?.startsWith("R-") ? ` Rule ${first.rule}.` : ""}`,
        data: { read: readNote, label, reasons: failures(m) },
      });
    }
  } catch (e) {
    await q("update invoices set status = 'queued' where workspace_id = $1 and id = $2", [ws, seed.id]);
    throw e;
  }
  return { processed: seed.id };
}

export async function deliverMail(ws: Workspace) {
  const updated = await q1<{ id: string }>("update workspaces set mail_delivered_at = now() where id = $1 and mail_delivered_at is null returning id", [ws.id]);
  if (!updated) return { delivered: 0 };
  const wave2 = seedInvoices.filter((i) => i.wave === 2);
  await q(
    `insert into invoices (workspace_id, id, wave, status) select $1, x, 2, 'queued' from unnest($2::text[]) x on conflict do nothing`,
    [ws.id, wave2.map((i) => i.id)],
  );
  await agentLog(ws.id, { type: "mail", summary: `${wave2.length} new invoices arrived by email (${wave2.map((i) => i.id).join(", ")}). Reading them now.` });
  return { delivered: wave2.length };
}

// ---------------------------------------------------------------- human decisions

export type Outcome =
  | { ok: true; eventId: number; summary: string; invoiceId?: string }
  | { ok: false; reason: string; kind: "refused" | "invalid"; escalatedTo?: string; invoiceId?: string };

export async function decide(ws: string, who: Person, invoiceId: string, decision: "approve" | "reject", source: Source, note?: string): Promise<Outcome> {
  const row = await invoiceRow(ws, invoiceId);
  const seed = seedInvoice(invoiceId);
  if (!row || !seed) return { ok: false, kind: "invalid", reason: `I can't find ${invoiceId} in this inbox.` };
  if (row.status !== "held") {
    const what = row.status === "posted" ? "isn't on hold: it matched and I posted it" : row.status === "queued" || row.status === "processing" ? "hasn't been processed yet" : `was already ${row.status} by ${row.decided_by}`;
    return { ok: false, kind: "invalid", reason: `${invoiceId} ${what}.`, invoiceId };
  }
  const amount = row.extraction?.total ?? seed.total;
  const verdict = authorize(who, { kind: "decide", decision, invoiceId, amount });
  if (!verdict.allowed) {
    await log(ws, { actor: who.name, actor_role: who.role, source, type: "refused", invoice_id: invoiceId, summary: `Refused: ${who.name} (${who.title}) tried to ${decision} ${invoiceId} (${inr0(amount)}). Over the ${inr0(who.limit ?? 0)} limit.`, data: { reason: verdict.reason } });
    let escalatedTo: string | undefined;
    if (verdict.escalateTo) {
      escalatedTo = verdict.escalateTo.name;
      if (row.escalated_to !== escalatedTo) {
        await q("update invoices set escalated_to = $3 where workspace_id = $1 and id = $2", [ws, invoiceId, escalatedTo]);
        await agentLog(ws, { type: "escalated", invoice_id: invoiceId, summary: `Flagged ${invoiceId} for ${escalatedTo} (${verdict.escalateTo.title}): ${who.name} asked to ${decision} it, above their limit.` });
      }
    }
    return { ok: false, kind: "refused", reason: verdict.reason, escalatedTo, invoiceId };
  }
  const newStatus = decision === "approve" ? "approved" : "rejected";
  await q(
    "update invoices set status = $3, decided_at = now(), decided_by = $4, decision_source = $5 where workspace_id = $1 and id = $2",
    [ws, invoiceId, newStatus, who.name, source],
  );
  const billId = `VB-9${invoiceId.slice(-3)}`;
  const vendor = vendorOf(seed.vendorId).name;
  const summary = decision === "approve"
    ? `${who.name} approved ${invoiceId} (${vendor}, ${inr0(amount)}) despite: ${row.hold_label}. Posted as ${billId}.`
    : `${who.name} rejected ${invoiceId} (${vendor}, ${inr0(amount)}): ${row.hold_label}.${note ? ` Note: ${note.replace(/[.s]*$/, ".")}` : ""} Vendor query drafted, not sent.`;
  const eventId = await log(ws, {
    actor: who.name, actor_role: who.role, source, type: newStatus, invoice_id: invoiceId, summary, undoable: true,
    data: { heldAt: row.held_at, amount, note: note ?? null, billId: decision === "approve" ? billId : null },
  });
  return { ok: true, eventId, summary, invoiceId };
}

export async function undo(ws: string, who: Person, source: Source, eventId?: number): Promise<Outcome> {
  const target = eventId
    ? await q1<FeedEvent>("select * from events where workspace_id = $1 and id = $2", [ws, eventId])
    : await q1<FeedEvent>(
        "select * from events where workspace_id = $1 and undoable and undone_by is null and actor = $2 order by id desc limit 1", [ws, who.name]);
  if (!target) return { ok: false, kind: "invalid", reason: `There's nothing of yours to undo, ${who.name}.` };
  if (!target.undoable || target.undone_by) return { ok: false, kind: "invalid", reason: "That action was already undone or can't be undone." };
  const verdict = authorize(who, { kind: "undo", actorOfOriginal: target.actor, originalSummary: `${target.invoice_id ?? "That"}` });
  if (!verdict.allowed) {
    await log(ws, { actor: who.name, actor_role: who.role, source, type: "refused", invoice_id: target.invoice_id, summary: `Refused: ${who.name} tried to undo ${target.actor}'s decision on ${target.invoice_id}.`, data: { reason: verdict.reason } });
    return { ok: false, kind: "refused", reason: verdict.reason, invoiceId: target.invoice_id ?? undefined };
  }
  if (target.type === "approved" || target.type === "rejected") {
    await q(
      "update invoices set status = 'held', decided_at = null, decided_by = null, decision_source = null where workspace_id = $1 and id = $2",
      [ws, target.invoice_id],
    );
  } else if (target.type === "rule_created") {
    await q("update rules set active = false where workspace_id = $1 and id = $2", [ws, (target.data as { ruleId: string }).ruleId]);
  }
  const what = target.type === "rule_created" ? `rule ${(target.data as { ruleId: string }).ruleId}` : `${target.type === "approved" ? "approval" : "rejection"} of ${target.invoice_id}`;
  const summary = `${who.name} undid the ${what}.${target.type === "rule_created" ? " It no longer applies." : ` ${target.invoice_id} is back on hold.`}`;
  const id = await log(ws, { actor: who.name, actor_role: who.role, source, type: "undone", invoice_id: target.invoice_id, summary, undoes: target.id });
  await q("update events set undone_by = $3 where workspace_id = $1 and id = $2", [ws, target.id, id]);
  return { ok: true, eventId: id, summary, invoiceId: target.invoice_id ?? undefined };
}

export async function createRule(ws: Workspace, who: Person, kind: "quantity" | "price", thresholdPct: number, source: Source): Promise<Outcome> {
  const verdict = authorize(who, { kind: "rule" });
  if (!verdict.allowed) {
    await log(ws.id, { actor: who.name, actor_role: who.role, source, type: "refused", summary: `Refused: ${who.name} (${who.title}) tried to set a rule: hold ${kind} variance over ${thresholdPct}%.`, data: { reason: verdict.reason } });
    return { ok: false, kind: "refused", reason: verdict.reason, escalatedTo: verdict.escalateTo?.name };
  }
  const n = await q1<{ next_rule: number }>("update workspaces set next_rule = next_rule + 1 where id = $1 returning next_rule - 1 as next_rule", [ws.id]);
  const id = `R-${n!.next_rule}`;
  await q("insert into rules (workspace_id, id, kind, threshold_pct, created_by, source) values ($1,$2,$3,$4,$5,$6)", [ws.id, id, kind, thresholdPct, who.name, source]);
  const text = describeRule({ id, kind, thresholdPct, createdBy: who.name, source });
  const summary = `${who.name} taught a rule. ${text}. Applies to invoices I read from now on.`;
  const eventId = await log(ws.id, { actor: who.name, actor_role: who.role, source, type: "rule_created", summary, undoable: true, data: { ruleId: id, kind, thresholdPct } });
  return { ok: true, eventId, summary };
}

export async function setPerson(ws: string, personId: string) {
  const p = personOf(personId);
  await q("update workspaces set person_id = $2 where id = $1", [ws, p.id]);
  return p;
}

export const setFocus = (ws: string, invoiceId: string | null) => q("update workspaces set focus_invoice = $2 where id = $1", [ws, invoiceId]);
