import { context, handler } from "@/lib/api";
import { decide } from "@/lib/service";

export const dynamic = "force-dynamic";

// The button path: same decide() as chat, logged with source "button" so the two can be compared.
export const POST = handler(async (body) => {
  const { ws, person } = await context();
  const decision = body.decision === "reject" ? "reject" : "approve";
  return decide(ws.id, person, String(body.invoice), decision, "button");
});
