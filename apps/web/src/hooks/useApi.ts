"use client";

import { useEffect, useState } from "react";

export interface ApiResult<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
}

export function useApi<T>(path: string, intervalMs = 0): ApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      try {
        const res = await fetch(path, { signal: controller.signal, cache: "no-store" });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(typeof json?.error === "string" ? json.error : `HTTP ${res.status}`);
          setData(null);
        } else {
          setData(json as T);
          setError(null);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const timer = intervalMs > 0 ? setInterval(load, intervalMs) : undefined;
    return () => {
      cancelled = true;
      controller.abort();
      if (timer) clearInterval(timer);
    };
  }, [path, nonce, intervalMs]);

  return { data, error, loading, refresh: () => setNonce((n) => n + 1) };
}