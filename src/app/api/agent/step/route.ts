import { context, handler } from "@/lib/api";
import { processNext } from "@/lib/service";

export const dynamic = "force-dynamic";

// The agent works one invoice per call so the activity feed shows it working, not a 20-row dump.
export const POST = handler(async () => {
  const { ws } = await context();
  return processNext(ws.id);
});
