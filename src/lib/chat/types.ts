import type { Explanation, HeldItem } from "../service";
import type { MetricsSummary } from "../metrics";

/** Structured blocks rendered under a chat message. Built from tool results, never from model text. */
export type Card =
  | { type: "held"; items: HeldItem[] }
  | { type: "explain"; ex: Explanation }
  | { type: "action"; eventId: number; summary: string; invoiceId?: string; undoable: boolean }
  | { type: "refusal"; reason: string; escalatedTo?: string }
  | { type: "metrics"; m: MetricsSummary };

export type ChatMessage = {
  id: number;
  ts: string;
  author: "user" | "agent";
  person: string | null;
  text: string;
  cards: Card[] | null;
  mode: "gemini" | "offline" | null;
};

export type ToolName = "list_held" | "explain_invoice" | "approve_invoice" | "reject_invoice" | "undo_last" | "create_hold_rule" | "get_metrics";
export type ToolCall = { name: ToolName; args: Record<string, unknown> };
