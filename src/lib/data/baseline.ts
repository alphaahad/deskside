// MOCK BASELINE: 40 invented held items decided through the "old flow" (someone notices the hold
// in the agent's own console days later). It exists only so the metric card has a before/after.
// Deterministic: a fixed-seed generator, not real history.

export type BaselineItem = { id: string; heldAt: string; decidedAt: string; reversed: boolean; reason: string };

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const REASONS = ["Price mismatch", "Missing goods receipt", "Duplicate invoice", "Quantity variance"];

export const baseline: BaselineItem[] = (() => {
  const rand = rng(4471);
  const start = Date.parse("2026-09-01T09:00:00Z");
  return Array.from({ length: 40 }, (_, i) => {
    const heldAt = start + i * 26 * 3600_000 + Math.floor(rand() * 8) * 3600_000;
    // Log-normal-ish wait centred near 2 days: most a day or three, a long tail past a week.
    const u = rand() + rand() + rand(); // ~bell around 1.5
    const hours = Math.round(48 * Math.exp((u - 1.5) * 1.6));
    return {
      id: `HIST-${String(i + 1).padStart(3, "0")}`,
      heldAt: new Date(heldAt).toISOString(),
      decidedAt: new Date(heldAt + Math.max(2, hours) * 3600_000).toISOString(),
      reversed: i === 7 || i === 29, // 2 of 40 = 5%
      reason: REASONS[i % 4],
    };
  });
})();
