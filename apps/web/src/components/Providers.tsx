"use client";

import { useEffect, type ReactNode } from "react";
import { PaymentProvider } from "./PaymentSheet";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const stack = String(event.reason?.stack || event.reason || "");
      if (stack.includes("chrome-extension://") || stack.includes("M_ID")) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    const handleError = (event: ErrorEvent) => {
      const filename = String(event.filename || "");
      const stack = String(event.error?.stack || "");
      if (
        filename.includes("chrome-extension://") ||
        stack.includes("chrome-extension://") ||
        stack.includes("M_ID")
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleError, true);
    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("error", handleError, true);
    };
  }, []);

  return <PaymentProvider>{children}</PaymentProvider>;
}
