export const inr = (n: number, decimals = 2) =>
  "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export const inr0 = (n: number) => inr(n, 0);

export const pct = (n: number, digits = 1) => `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;

/** "3 min", "2.1 days" — for the metric card. */
export function duration(ms: number) {
  const s = ms / 1000;
  if (s < 60) return `${Math.round(s)}s`;
  const m = s / 60;
  if (m < 60) return `${m < 10 ? m.toFixed(1) : Math.round(m)} min`;
  const h = m / 60;
  if (h < 24) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} days`;
}

export const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
