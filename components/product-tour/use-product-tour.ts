"use client";

import { useCallback, useEffect, useState } from "react";

// Same per-account, versioned pattern as Tipper. This hash only keeps account
// identifiers out of preference keys; it is not a security primitive.
export function tourStorageKey(id: string, account: string) {
  let hash = 0x811c9dc5;
  for (const char of account)
    hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
  return `sorosafe:product-tour:${id}:${hash.toString(36)}`;
}

export function useProductTour({
  id,
  account,
  enabled,
  autoStart = false,
}: {
  id: string;
  account?: string;
  enabled: boolean;
  autoStart?: boolean;
}) {
  const key = tourStorageKey(id, account || "visitor");
  const [activeKey, setActiveKey] = useState<string>();
  const [seen, setSeen] = useState<string[]>([]);
  const version = "1";

  useEffect(() => {
    if (!enabled || !autoStart || !account || seen.includes(key)) return;
    try {
      if (Number(localStorage.getItem(key)) >= Number(version)) return;
    } catch {
      // The guide remains optional when storage is blocked.
      return;
    }
    const timer = window.setTimeout(() => setActiveKey(key), 650);
    return () => window.clearTimeout(timer);
  }, [account, autoStart, enabled, key, seen]);

  const close = useCallback(() => {
    try {
      localStorage.setItem(key, version);
    } catch {
      /* This visit still remembers dismissal. */
    }
    setSeen((previous) =>
      previous.includes(key) ? previous : [...previous, key],
    );
    setActiveKey(undefined);
  }, [key]);
  return {
    open: enabled && activeKey === key,
    start: () => setActiveKey(key),
    close,
  };
}
