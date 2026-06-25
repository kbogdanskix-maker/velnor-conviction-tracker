"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Flow", href: "/cash-flow" },
  { label: "Budget", href: "/budget" },
  { label: "Expenses", href: "/expenses" },
  { label: "Income", href: "/income" },
  { label: "Subscriptions", href: "/subscriptions" },
] as const;

export default function CashFlowTabs() {
  const pathname = usePathname();

  return (
    <div className="flex items-center border-b border-vela-border overflow-x-auto -mb-2">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`
              px-4 py-2.5 font-mono text-[11px] uppercase tracking-widest whitespace-nowrap transition-colors relative shrink-0
              ${active
                ? "text-vela-teal after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-vela-teal"
                : "text-zinc-500 hover:text-zinc-200"
              }
            `}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
