"use client";

import Image from "next/image";
import Link from "next/link";

const STEPS = [
  { label: "Case setup", href: "/" },
  { label: "Evidence", href: "/#evidence" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Export", href: "/dashboard#export" },
];

export function TopNav({ step }: { step: number }) {
  return (
    <header className="sticky top-0 z-20 border-b border-hairline bg-canvas">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/icon.png"
            alt="FraudLens AI logo"
            width={32}
            height={32}
            className="h-8 w-8 rounded-md object-contain"
          />
          <div>
            <p className="text-sm font-semibold tracking-tight text-ink">FraudLens AI</p>
            <p className="mono text-[11px] text-inksubtle">Cyber Fraud Intelligence</p>
          </div>
        </Link>
        <nav className="hidden items-center gap-2 md:flex">
          {STEPS.map((s, i) => (
            <Link
              key={s.label}
              href={s.href}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                step === i + 1
                  ? "bg-surface2 text-ink"
                  : "text-inksubtle hover:text-inkmuted"
              }`}
            >
              {i + 1}. {s.label}
            </Link>
          ))}
        </nav>
        <span className="rounded-full bg-surface2 px-2 py-1 text-[11px] text-inkmuted">
          Chain-of-custody secured
        </span>
      </div>
    </header>
  );
}

export function NoticeBar() {
  return null;
}
