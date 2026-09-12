"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { PaymentProvider } from "./PaymentSheet";

const NAV_ITEMS: Array<{ path: string; tab: string; icon: ReactNode }> = [
  {
    path: "/",
    tab: "home",
    icon: (
      <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 11l9-8 9 8" />
        <path d="M5 10v10h14V10" />
      </svg>
    ),
  },
  {
    path: "/dashboard",
    tab: "dashboard",
    icon: (
      <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    ),
  },
  {
    path: "/studio",
    tab: "studio",
    icon: (
      <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
      </svg>
    ),
  },
  {
    path: "/audit",
    tab: "audit",
    icon: (
      <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    path: "/orders",
    tab: "orders",
    icon: (
      <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 17l6-6 4 4 8-8" />
        <path d="M15 7h6v6" />
      </svg>
    ),
  },
];

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const active = NAV_ITEMS.find((n) => pathname.startsWith(n.path))?.tab ?? "home";

  return (
    <PaymentProvider>
      <div className="app">
        <div className="header">
          <Link href="/" className="brand" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="brand-mark">
              <svg viewBox="0 0 24 24" fill="none" stroke="#00151A" stroke-width="2.5">
                <path d="M4 17L10 11L14 15L20 7" />
                <path d="M14 7h6v6" />
              </svg>
            </div>
            <div className="brand-name">
              STRATA<span>402</span>
            </div>
          </Link>
          <div className="header-actions">
            <button className="icon-btn" title="Live feed notifications">
              <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round">
                <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.7 21a2 2 0 01-3.4 0" />
              </svg>
              <div className="dot-live"></div>
            </button>
            <div className="avatar">SA</div>
          </div>
        </div>

        <div className="content">{children}</div>

        <nav className="bottom-nav">
          {NAV_ITEMS.map((item) => {
            const isActive = item.tab === active;
            return (
              <Link
                key={item.tab}
                href={item.path}
                className={`nav-item ${isActive ? "active" : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                {item.icon}
                <span>{item.tab.charAt(0).toUpperCase() + item.tab.slice(1)}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </PaymentProvider>
  );
}