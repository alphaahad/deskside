import { context, handler } from "@/lib/api";
import { deliverMail } from "@/lib/service";

export const dynamic = "force-dynamic";

export const POST = handler(async () => {
  const { ws } = await context();
  return deliverMail(ws);
});
