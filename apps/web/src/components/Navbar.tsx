"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Marketplace" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/studio", label: "AI Studio" },
  { href: "/audit", label: "HCS Auditor" },
  { href: "/orders", label: "AutoSwap" },
];

export function Navbar() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40">
      <div className="glass !rounded-none border-x-0 border-t-0">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[#00F2FE] to-[#4FACFE] font-bold text-[#06121c]">
              S
            </span>
            <span className="text-sm font-bold tracking-wide">
              Strata<span className="text-[#00F2FE]">402</span>
            </span>
            <span className="mono chips chip-live text-[0.6rem]">hedera:testnet</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-1.5 text-sm transition ${
                    active
                      ? "bg-[#00F2FE]/10 text-[#00F2FE]"
                      : "text-[#8a93a3] hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <Link href="/dashboard" className="btn btn-cyan !px-4 !py-1.5 !text-xs">
            Launch AI Studio
          </Link>
        </div>
      </div>
    </header>
  );
}