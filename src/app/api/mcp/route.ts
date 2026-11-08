// A minimal MCP server (Streamable HTTP, stateless JSON responses) exposing the same tools as chat,
// so a finance lead can ask Meera from Claude. Same executors, same authorize(), same event log,
// logged with source "mcp". Demo auth: the workspace id and person are in the URL; a real deployment
// would use OAuth and the org's SSO identity instead.
import { NextResponse } from "next/server";
import { ensureWorkspace } from "@/lib/workspace";
import { people, personOf } from "@/lib/data/seed";
import { TOOL_DECLARATIONS, runTool } from "@/lib/chat/tools";
import type { ToolName } from "@/lib/chat/types";
import { redactSecrets } from "@/lib/llm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Rpc = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

const ok = (id: Rpc["id"], result: unknown) => ({ jsonrpc: "2.0", id, result });
const err = (id: Rpc["id"], code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });

export async function GET() {
  return new NextResponse("Nod MCP endpoint: POST JSON-RPC here. Mock data only.", { status: 405, headers: { allow: "POST" } });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const wsId = url.searchParams.get("ws");
  const as = url.searchParams.get("as");
  if (!wsId || !/^ws_[a-z0-9]{16}$/.test(wsId)) return NextResponse.json(err(null, -32001, "Add ?ws=<workspace id> from the Nod 'Use from Claude' panel."), { status: 400 });
  if (as && !people.some((p) => p.id === as)) return NextResponse.json(err(null, -32001, "Unknown person in ?as="), { status: 400 });

  let body: Rpc | Rpc[];
  try { body = await req.json(); } catch { return NextResponse.json(err(null, -32700, "Parse error"), { status: 400 }); }
  const batch = Array.isArray(body) ? body : [body];
  const out = [];
  for (const m of batch) {
    const res = await handle(m, wsId, as);
    if (res) out.push(res);
  }
  if (!out.length) return new NextResponse(null, { status: 202 });
  return NextResponse.json(Array.isArray(body) ? out : out[0]);
}

async function handle(m: Rpc, wsId: string, as: string | null) {
  const isNotification = m.id === undefined || m.id === null;
  switch (m.method) {
    case "initialize":
      return ok(m.id, {
        protocolVersion: (m.params?.protocolVersion as string) ?? "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "nod", title: "Nod: Meera, AP employee (mock data)", version: "0.1.0" },
        instructions: "Tools to ask Meera, an AI accounts-payable employee, about held invoices and to approve, reject or undo. All data is mock data. Only approve or reject when the user explicitly asks.",
      });
    case "ping":
      return ok(m.id, {});
    case "tools/list":
      return ok(m.id, {
        tools: TOOL_DECLARATIONS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.parameters,
          annotations: { readOnlyHint: ["list_held", "explain_invoice", "get_metrics"].includes(t.name), destructiveHint: false },
        })),
      });
    case "tools/call": {
      const name = m.params?.name as ToolName;
      if (!TOOL_DECLARATIONS.some((t) => t.name === name)) return err(m.id, -32602, `Unknown tool: ${name}`);
      try {
        const ws = await ensureWorkspace(wsId);
        const person = personOf(as ?? ws.person_id);
        const outp = await runTool({ ws, person, source: "mcp" }, { name, args: (m.params?.arguments as Record<string, unknown>) ?? {} });
        const isError = Boolean(outp.result.error || outp.result.refused);
        return ok(m.id, {
          content: [{ type: "text", text: JSON.stringify({ acting_as: `${person.name} (${person.title})`, ...outp.result, card: outp.card ?? null }, null, 1) }],
          isError,
        });
      } catch (e) {
        return err(m.id, -32603, redactSecrets(String((e as Error)?.message ?? e)).slice(0, 200));
      }
    }
    default:
      if (isNotification) return null; // notifications/initialized etc.
      return err(m.id, -32601, `Method not found: ${m.method}`);
  }
}
