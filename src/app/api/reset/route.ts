import { handler } from "@/lib/api";
import { ensureWorkspace, rotateWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export const POST = handler(async () => {
  const id = await rotateWorkspace();
  await ensureWorkspace(id);
  return { workspace: id };
});
