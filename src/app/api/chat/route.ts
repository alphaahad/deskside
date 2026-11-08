import { context, handler } from "@/lib/api";
import { chatTurn, history } from "@/lib/chat/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = handler(async () => {
  const { ws } = await context();
  return { messages: await history(ws.id) };
});

export const POST = handler(async (body) => {
  const text = String(body.text ?? "").trim().slice(0, 500);
  if (!text) return { messages: [] };
  const { ws, person } = await context();
  return { messages: await chatTurn(ws, person, text) };
});
