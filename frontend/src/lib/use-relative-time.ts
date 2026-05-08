"use client";

import { useFormatter, useTranslations } from "next-intl";

export function useRelativeTime() {
  const format = useFormatter();
  const t = useTranslations("people");
  return (date: Date | string | null | undefined): string => {
    if (!date) return t("activeNever");
    const d = typeof date === "string" ? new Date(date) : date;
    return t("activeAgo", { time: format.relativeTime(d, new Date()) });
  };
}
