"use client";

import { useState, useCallback } from "react";

const COOKIE_NAME = "manvaig_tips_dismissed";
const MAX_AGE = 60 * 60 * 24 * 365; // 365 days
const ALL_TABS = ["details", "pricing", "terms"] as const;
type TipTab = (typeof ALL_TABS)[number];

function readDismissed(): Set<TipTab> {
  if (typeof document === "undefined") return new Set();
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`)
  );
  if (!match) return new Set();
  return new Set(
    match[1]
      .split(",")
      .filter((v): v is TipTab => ALL_TABS.includes(v as TipTab))
  );
}

function writeDismissed(dismissed: Set<TipTab>) {
  if (dismissed.size === 0) {
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;
  } else {
    document.cookie = `${COOKIE_NAME}=${[...dismissed].join(",")}; path=/; max-age=${MAX_AGE}`;
  }
}

export function useTipsDismissed() {
  const [dismissed, setDismissed] = useState<Set<TipTab>>(() =>
    readDismissed()
  );

  const dismissTab = useCallback((tab: TipTab) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(tab);
      writeDismissed(next);
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    writeDismissed(new Set());
    setDismissed(new Set());
  }, []);

  const isTabDismissed = useCallback(
    (tab: TipTab) => dismissed.has(tab),
    [dismissed]
  );

  const anyDismissed = dismissed.size > 0;

  return { isTabDismissed, dismissTab, resetAll, anyDismissed };
}
