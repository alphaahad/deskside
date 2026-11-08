import { context, handler } from "@/lib/api";
import { undo } from "@/lib/service";

export const dynamic = "force-dynamic";

export const POST = handler(async (body) => {
  const { ws, person } = await context();
  return undo(ws.id, person, "button", Number(body.eventId));
});
