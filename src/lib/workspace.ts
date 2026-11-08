import "server-only";
import { cookies } from "next/headers";
import { q, q1 } from "./db";
import { invoices } from "./data/seed";

export const COOKIE = "dsk_ws";

export type Workspace = {
  id: string;
  created_at: string;
  is_internal: boolean;
  person_id: string;
  focus_invoice: string | null;
  mail_delivered_at: string | null;
  next_rule: number;
};

export const newWorkspaceId = () => "ws_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);

export async function cookieWorkspaceId() {
  const c = await cookies();
  const id = c.get(COOKIE)?.value;
  if (!id) throw new Error("No workspace cookie");
  return { id, internal: c.get("dsk_internal")?.value === "1" };
}

/** Creates the workspace (and its wave-1 inbox) on first touch. Idempotent. */
export async function ensureWorkspace(id: string, internal = false): Promise<Workspace> {
  const created = await q<{ id: string }>(
    "insert into workspaces (id, is_internal) values ($1, $2) on conflict (id) do nothing returning id",
    [id, internal],
  );
  if (created.length) {
    const wave1 = invoices.filter((i) => i.wave === 1);
    await q(
      `insert into invoices (workspace_id, id, wave, status)
       select $1, x, 1, 'queued' from unnest($2::text[]) x on conflict do nothing`,
      [id, wave1.map((i) => i.id)],
    );
  }
  return (await q1<Workspace>("select * from workspaces where id = $1", [id]))!;
}

export async function currentWorkspace() {
  const { id, internal } = await cookieWorkspaceId();
  return ensureWorkspace(id, internal);
}

export async function rotateWorkspace() {
  const c = await cookies();
  const id = newWorkspaceId();
  c.set(COOKIE, id, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30, path: "/" });
  return id;
}
