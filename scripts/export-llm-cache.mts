// Snapshot real Gemini answers from the local PGlite DB into src/lib/data/gemini-cache.json,
// so fresh databases (production, tests) serve them as "cached" instead of spending free-tier quota.
// Stop the dev server first (PGlite is single-process). Run: npm run cache:export
import { PGlite } from "@electric-sql/pglite";
import { writeFileSync } from "node:fs";

const pg = new PGlite(process.env.PGLITE_DIR ?? "./.data/pglite");
const rows = (await pg.query<{ key: string; value: unknown; created_at: string }>("select key, value, created_at from llm_cache order by created_at")).rows;
const json = JSON.stringify(rows.map((r) => ({ key: r.key, value: r.value, created_at: new Date(r.created_at).toISOString() })), null, 1);
if (/AIza[0-9A-Za-z_-]{20,}/.test(json)) throw new Error("Refusing to write: something key-shaped is in the cache.");
writeFileSync("src/lib/data/gemini-cache.json", json + "\n");
console.log(`Exported ${rows.length} cached Gemini answers.`);
await pg.close();
