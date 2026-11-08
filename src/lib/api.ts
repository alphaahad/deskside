import "server-only";
import { NextResponse } from "next/server";
import { currentWorkspace } from "./workspace";
import { personOf } from "./data/seed";
import { redactSecrets } from "./llm";

export async function context() {
  const ws = await currentWorkspace();
  return { ws, person: personOf(ws.person_id) };
}

/** Wraps a route handler: JSON in, JSON out, errors redacted. */
export function handler<T>(fn: (body: Record<string, unknown>) => Promise<T>) {
  return async (req: Request) => {
    try {
      const body = req.method === "GET" ? Object.fromEntries(new URL(req.url).searchParams) : await req.json().catch(() => ({}));
      return NextResponse.json(await fn(body as Record<string, unknown>));
    } catch (e) {
      const msg = redactSecrets(String((e as Error)?.message ?? e));
      console.error(msg.slice(0, 500));
      return NextResponse.json({ error: msg.slice(0, 200) }, { status: 500 });
    }
  };
}
