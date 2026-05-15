"use client";

import { Clock, MessageCircle, ImageIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// === Helpers ===

export function formatPrice(price: number | null): string {
  if (price == null) return "";
  return `€${price.toFixed(2)}`;
}

export function timeAgo(
  dateStr: string,
  t: (key: string, values?: Record<string, string | number>) => string
): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return t("minutesAgo", { count: Math.max(1, diffMins) });
  if (diffHours < 24) return t("hoursAgo", { count: diffHours });
  return t("daysAgo", { count: diffDays });
}

export function isEnded(endDate: string | null): boolean {
  if (!endDate) return false;
  return new Date(endDate).getTime() < Date.now();
}

// === End Date Countdown ===

export function EndDateCountdown({ end, t }: { end: string; t: (key: string) => string }) {
  const endTime = new Date(end).getTime();
  const now = Date.now();
  const diff = endTime - now;

  if (diff <= 0) {
    return <span className="text-xs font-medium text-destructive">{t("ended")}</span>;
  }

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);

  const isUrgent = diff < 3600000;
  const colorClass = isUrgent ? "text-destructive" : "text-muted-foreground";

  let text = "";
  if (days > 0) text = `${days}d ${hours}h`;
  else if (hours > 0) text = `${hours}h ${minutes}m`;
  else text = `${minutes}m`;

  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${colorClass}`}>
      <Clock className="size-3.5 shrink-0" />
      {t("endsIn")} {text}
    </span>
  );
}

// === End Date Pill (overlay on image for timed items) ===

export function EndDatePill({ end, t }: { end: string; t: (key: string) => string }) {
  const endTime = new Date(end).getTime();
  const now = Date.now();
  const diff = endTime - now;

  if (diff <= 0) {
    return (
      <span className="absolute top-2 right-2 z-10 flex items-center gap-1.5 rounded-lg bg-destructive/90 px-3 py-1.5 text-xs font-semibold text-white shadow-md">
        <Clock className="size-3.5" />
        {t("ended")}
      </span>
    );
  }

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);

  const isUrgent1h = diff < 3600000;
  const isUrgent24h = diff < 86400000;
  const bgClass = isUrgent1h
    ? "bg-destructive/90"
    : isUrgent24h
      ? "bg-orange-500/90"
      : "bg-black/60";

  let text = "";
  if (days > 0) text = `${days}d ${hours}h`;
  else if (hours > 0) text = `${hours}h ${minutes}m`;
  else text = `${minutes}m`;

  return (
    <span className={`absolute top-2 right-2 z-10 flex items-center gap-1.5 rounded-lg ${bgClass} px-3 py-1.5 text-xs font-semibold text-white shadow-md`}>
      <Clock className="size-3.5" />
      {text}
    </span>
  );
}

// === Price Display (field-based, no PricingType switch) ===

interface PriceDisplayProps {
  price: number | null;
  acceptOffers: boolean;
  minOfferPrice: number | null;
  offerStep: number | null;
  endDate: string | null;
  t: (key: string, values?: Record<string, string | number>) => string;
  bidCount?: number;
  highestBid?: number | null;
  isSold?: boolean;
  /** Hide the "ended" text when an activity badge already shows it */
  hideEndedStatus?: boolean;
}

export function PriceDisplay({
  price, acceptOffers, minOfferPrice, offerStep, endDate,
  t, bidCount, highestBid, isSold, hideEndedStatus,
}: PriceDisplayProps) {
  const priceClass = "text-lg font-bold text-emerald-400";
  const detailClass = "text-xs text-muted-foreground";

  const hasActiveBids = highestBid != null && highestBid > 0;

  return (
    <div className="flex flex-col gap-0.5">
      {/* Sold indicator */}
      {isSold && (
        <span className="text-xs font-medium text-emerald-400">{t("sold")}</span>
      )}

      {/* Main price line */}
      {hasActiveBids ? (
        <>
          <div className="flex items-center gap-1.5">
            <span className={priceClass}>{formatPrice(highestBid)}</span>
          </div>
          {bidCount != null && bidCount > 0 && (
            <span className={detailClass}>{t("bids", { count: bidCount })}</span>
          )}
        </>
      ) : price != null ? (
        <div className="flex items-center gap-1.5">
          <span className={priceClass}>{formatPrice(price)}</span>
        </div>
      ) : acceptOffers ? (
        <div className="flex items-center gap-1.5">
          <span className={priceClass}>{t("offerOnly")}</span>
        </div>
      ) : null}

      {/* Detail line: offer info */}
      {acceptOffers && !hasActiveBids && price != null && !isSold && (
        <span className={detailClass}>{t("acceptsOffers")}</span>
      )}

      {/* Min offer / offer step info */}
      {acceptOffers && !hasActiveBids && minOfferPrice != null && !isSold && (
        <span className={detailClass}>
          {t("minOffer")}: {formatPrice(minOfferPrice)}
          {offerStep ? ` · ${t("offerStep")}: ${formatPrice(offerStep)}` : ""}
        </span>
      )}

    </div>
  );
}

// === Item Card Skeleton ===

export function ItemCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Skeleton className="aspect-[4/3] w-full" />
      <div className="flex flex-col gap-2 p-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-5 w-1/3" />
      </div>
      <hr className="mx-3 border-border" />
      <div className="flex items-center justify-between px-3 py-2">
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="size-8 rounded-md" />
      </div>
    </div>
  );
}
