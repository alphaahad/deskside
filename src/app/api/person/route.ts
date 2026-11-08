import { context, handler } from "@/lib/api";
import { setPerson } from "@/lib/service";

export const dynamic = "force-dynamic";

// Demo stand-in for sign-in: switch between the clerk and the finance lead.
export const POST = handler(async (body) => {
  const { ws } = await context();
  return { person: await setPerson(ws.id, String(body.id)) };
});
