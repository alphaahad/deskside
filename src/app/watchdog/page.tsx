import type { Metadata } from "next";
import { AlertTriangle, PauseCircle } from "lucide-react";

export const metadata: Metadata = { title: "Portal watchdog · Deskside" };

const before = [["Invoice No.", "Date", "Amount (INR)", "Status"], ["KPC-0417", "08 Nov 2026", "42,480.00", "Open"], ["KPC-0402", "02 Nov 2026", "53,808.00", "Paid"]];
const after = [["Date", "Document #", "Status", "Gross value"], ["08 Nov 2026", "KPC-0417", "Open", "₹42,480.00"], ["02 Nov 2026", "KPC-0402", "Paid", "₹53,808.00"]];

export default function WatchdogPage() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Next · concept, static mock</p>
      <h1 className="mt-1 text-2xl font-semibold">Portal watchdog</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-2">
        Some vendors only publish invoices on their own portal, and digital employees fetch them from there. When a portal&apos;s layout changes, the fetch can silently
        read the wrong column. The watchdog notices the change, pauses that source, and tells the finance lead in the same place they already talk to Meera.
      </p>
      <p className="mt-3 rounded-md border border-warn/30 bg-warn-soft px-3 py-2 text-xs text-warn">
        This page is a static example of the alert. Nothing here is connected to a real portal; Kaveri Packaging and its portal are mock data.
      </p>

      <article className="mt-6 rounded-xl border border-bad/25 bg-surface shadow-[0_1px_2px_rgb(17_24_39/0.04)]">
        <header className="flex items-start gap-3 border-b border-line p-4">
          <AlertTriangle className="mt-0.5 size-5 text-bad" aria-hidden />
          <div>
            <p className="font-semibold">Kaveri Packaging&apos;s vendor portal changed its invoice table</p>
            <p className="mt-0.5 text-sm text-ink-2">
              &ldquo;Amount (INR)&rdquo; moved from column 3 to column 4 and was renamed &ldquo;Gross value&rdquo;. &ldquo;Invoice No.&rdquo; is now &ldquo;Document #&rdquo;.
              I&apos;ve paused downloads from this portal so I don&apos;t read a date as an amount.
            </p>
            <p className="mt-1 text-xs text-muted">Meera · detected 08 Nov 2026, 06:12 · 12 scheduled downloads paused · other vendors unaffected</p>
          </div>
        </header>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <Snapshot title="Last known layout (01 Nov)" rows={before} hl={2} />
          <Snapshot title="Today (08 Nov)" rows={after} hl={3} />
        </div>
        <footer className="flex flex-wrap items-center gap-2 border-t border-line p-4">
          <span className="inline-flex items-center gap-1.5 text-sm text-ink-2"><PauseCircle className="size-4 text-warn" aria-hidden /> Proposed mapping: Document # → invoice number, Gross value → total. Re-checked against 2 invoices already in the ERP: both match.</span>
          <div className="ml-auto flex gap-2">
            <button type="button" disabled className="rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-white opacity-60">Accept mapping & resume</button>
            <button type="button" disabled className="rounded-lg border border-line px-3 py-1.5 text-sm opacity-60">Keep paused</button>
          </div>
        </footer>
      </article>

      <section className="mt-6 text-sm text-ink-2">
        <h2 className="font-semibold text-ink">Why it&apos;s next, not now</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>It shares the Ask layer&apos;s pattern: the agent stops, explains with evidence, and a person decides with an undo.</li>
          <li>It needs real portal fetches to be honest, which this prototype deliberately doesn&apos;t have.</li>
          <li>ASSUMPTION: portal changes are a meaningful share of silent failures. I&apos;d check incident history before building it.</li>
        </ul>
      </section>
    </div>
  );
}

function Snapshot({ title, rows, hl }: { title: string; rows: string[][]; hl: number }) {
  return (
    <figure>
      <figcaption className="mb-1.5 text-xs font-medium text-muted">{title}</figcaption>
      <table className="w-full overflow-hidden rounded-md border border-line text-xs">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={i === 0 ? "bg-canvas font-medium" : "border-t border-line"}>
              {r.map((c, j) => <td key={j} className={`px-2 py-1.5 ${j === hl ? "bg-warn-soft" : ""}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
