export function getLastSeenStatus(
  lastSeenAt: string | null,
  t: (key: string, values?: Record<string, string | number>) => string
): { text: string; isOnline: boolean } {
  if (!lastSeenAt) return { text: "", isOnline: false };

  const now = Date.now();
  const seen = new Date(lastSeenAt).getTime();
  const diffMs = now - seen;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 5) return { text: t("online"), isOnline: true };
  if (diffMin < 60) return { text: t("seenMinutesAgo", { count: diffMin }), isOnline: false };
  if (diffHours < 24) return { text: t("seenHoursAgo", { count: diffHours }), isOnline: false };
  if (diffDays < 30) return { text: t("seenDaysAgo", { count: diffDays }), isOnline: false };
  return { text: t("seenLongAgo"), isOnline: false };
}

export function formatMemberDate(memberSince: string, locale: string): string {
  const d = new Date(memberSince);
  const localeTag = locale === "lv" ? "lv-LV" : "en-US";
  const month = d.toLocaleDateString(localeTag, { month: "long" });
  const year = d.getFullYear();
  return locale === "lv"
    ? `${month} ${year}`
    : `${month.charAt(0).toUpperCase()}${month.slice(1)} ${year}`;
}
