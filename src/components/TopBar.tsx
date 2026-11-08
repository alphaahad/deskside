"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Ask" },
  { href: "/watchdog", label: "Portal watchdog", next: true },
  { href: "/readiness", label: "Deployment readiness", next: true },
];

export function TopBar() {
  const path = usePathname();
  return (
    <header className="material-bar backdrop-blur-xl backdrop-saturate-150 sticky top-0 z-30 shrink-0">
      <div className="mx-auto flex h-13 max-w-[1600px] items-center gap-6 px-5">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-6 place-items-center rounded-md bg-ink text-[11px] font-bold text-white">D</span>
          Deskside
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {NAV.map((n) => {
            const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`pressable flex items-center gap-1.5 rounded-md px-2.5 py-1.5 ${active ? "bg-ink/[0.06] font-medium text-ink" : "text-muted hover:text-ink"}`}
              >
                {n.label}
                {n.next && <span className="rounded bg-line px-1 py-px text-[10px] font-medium uppercase tracking-wide text-muted">Next</span>}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-xs text-muted">
          <span className="rounded-full border border-warn/30 bg-warn-soft px-2 py-0.5 font-medium text-warn">Mock data</span>
          <span className="hidden lg:inline">A prototype by Ahad Nadeem · no real ERP or vendor connection</span>
        </div>
      </div>
    </header>
  );
}
