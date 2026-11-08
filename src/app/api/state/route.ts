import { context, handler } from "@/lib/api";
import { feed, heldList, metrics, rules, status } from "@/lib/service";

export const dynamic = "force-dynamic";

// One poll for everything on screen except the chat transcript.
export const GET = handler(async () => {
  const { ws, person } = await context();
  const [s, events, held, r, m] = await Promise.all([status(ws), feed(ws.id), heldList(ws.id), rules(ws.id), metrics(ws.id)]);
  return { workspace: ws.id, person, focus: ws.focus_invoice, status: s, events, held, rules: r, metrics: m };
});
