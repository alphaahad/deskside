// One tiny query function over two drivers:
//  - Neon serverless Postgres when DATABASE_URL is set (production / Vercel)
//  - PGlite (Postgres in WASM, in-process) otherwise, so `npm run dev` needs zero setup.
// Plain SQL, no ORM: six tables, every query readable in review.
import "server-only";

type Row = Record<string, unknown>;
type Driver = { query: (text: string, params?: unknown[]) => Promise<Row[]> };

const SCHEMA = `
create table if not exists workspaces (
  id text primary key,
  created_at timestamptz not null default now(),
  is_internal boolean not null default false,
  person_id text not null default 'priya',
  focus_invoice text,
  mail_delivered_at timestamptz,
  next_rule int not null default 1
);
create table if not exists invoices (
  workspace_id text not null,
  id text not null,
  wave int not null,
  status text not null,              -- queued | posted | held | approved | rejected
  extraction jsonb,
  extraction_source text,            -- live | cached | fallback
  extraction_ms int,
  match jsonb,
  hold_label text,
  held_at timestamptz,
  decided_at timestamptz,
  decided_by text,
  decision_source text,
  escalated_to text,
  processed_at timestamptz,
  primary key (workspace_id, id)
);
create table if not exists events (
  id bigserial primary key,
  workspace_id text not null,
  ts timestamptz not null default now(),
  actor text not null,               -- Meera | Priya | Arjun
  actor_role text not null,          -- agent | clerk | lead
  source text not null,              -- agent | chat | button | mcp | rule
  type text not null,
  invoice_id text,
  summary text not null,
  data jsonb,
  undoable boolean not null default false,
  undone_by bigint,
  undoes bigint
);
create index if not exists events_ws on events (workspace_id, id);
create table if not exists rules (
  workspace_id text not null,
  id text not null,
  kind text not null,
  threshold_pct real not null,
  created_by text not null,
  source text not null,
  created_at timestamptz not null default now(),
  active boolean not null default true,
  primary key (workspace_id, id)
);
create table if not exists messages (
  id bigserial primary key,
  workspace_id text not null,
  ts timestamptz not null default now(),
  author text not null,              -- user | agent
  person text,
  text text not null,
  cards jsonb,
  mode text                          -- gemini | offline
);
create index if not exists messages_ws on messages (workspace_id, id);
create table if not exists llm_cache (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count int not null
)
`;

const g = globalThis as unknown as { __db?: Promise<Driver> };

async function init(): Promise<Driver> {
  let driver: Driver;
  if (process.env.DATABASE_URL) {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(process.env.DATABASE_URL);
    driver = { query: async (text, params = []) => (await sql.query(text, params)) as Row[] };
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const dir = process.env.PGLITE_DIR ?? (process.env.VERCEL ? "memory://" : "./.data/pglite");
    if (!dir.startsWith("memory://")) (await import("node:fs")).mkdirSync(dir, { recursive: true });
    const pg = new PGlite(dir);
    driver = { query: async (text, params = []) => (await pg.query<Row>(text, params)).rows };
  }
  for (const stmt of SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) await driver.query(stmt);
  await loadGeminiSnapshot(driver);
  return driver;
}

// Real Gemini reads captured earlier (scripts/export-llm-cache.mts), so a fresh database serves
// them as "cached" instead of spending free-tier quota. Never overwrites a newer live answer.
async function loadGeminiSnapshot(driver: Driver) {
  const { default: snapshot } = await import("@/lib/data/gemini-cache.json");
  const entries = snapshot as { key: string; value: unknown; created_at: string }[];
  if (!entries.length) return;
  await driver.query(
    `insert into llm_cache (key, value, created_at)
     select e->>'key', e->'value', (e->>'created_at')::timestamptz from jsonb_array_elements($1::jsonb) e
     on conflict (key) do nothing`,
    [JSON.stringify(entries)],
  );
}

export async function q<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  g.__db ??= init();
  const d = await g.__db;
  return (await d.query(text, params)) as T[];
}

export async function q1<T = Row>(text: string, params: unknown[] = []): Promise<T | undefined> {
  return (await q<T>(text, params))[0];
}

export const json = (v: unknown) => JSON.stringify(v);
