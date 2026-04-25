"use client";

import { Clock, ImageIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PricingType } from "@/lib/items";

// === Helpers ===

export function pricingTypeKey(type: number): string {
  switch (type) {
    case PricingType.Fixed: return "fixed";
    case PricingType.FixedOffers: return "offers";
    case PricingType.Bidding: return "bidding";
    case PricingType.Auction: return "auction";
    default: return "fixed";
  }
}

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

export function isAuctionEnded(auctionEnd: string | null, pricingType: number): boolean {
  if (pricingType !== PricingType.Auction || !auctionEnd) return false;
  return new Date(auctionEnd).getTime() < Date.now();
}

// === Type Tag ===

export function TypeTag({ type, t }: { type: number; t: (key: string) => string }) {
  const key = pricingTypeKey(type);
  const colorMap: Record<string, string> = {
    fixed: "bg-blue-500",
    offers: "bg-purple-500",
    bidding: "bg-orange-500",
    auction: "bg-orange-500",
  };

  return (
    <span
      className={`absolute top-0 left-0 z-10 rounded-tl-[calc(var(--radius)*1.4)] rounded-br-[calc(var(--radius)*0.6)] px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-white ${colorMap[key]}`}
    >
      {t(`type_${key}`)}
    </span>
  );
}

// === Price Display ===

interface PriceDisplayProps {
  pricingType: number;
  price: number | null;
  minBidPrice: number | null;
  bidStep: number | null;
  auctionEnd: string | null;
  t: (key: string) => string;
  bidCount?: number;
  highestBid?: number | null;
}

export function PriceDisplay({ pricingType, price, minBidPrice, bidStep, auctionEnd, t, bidCount, highestBid }: PriceDisplayProps) {
  const priceClass = "text-lg font-bold text-emerald-400";
  const detailClass = "text-xs text-muted-foreground";

  switch (pricingType) {
    case PricingType.Fixed:
      return <span className={priceClass}>{formatPrice(price)}</span>;

    case PricingType.FixedOffers:
      return (
        <div className="flex flex-col gap-0.5">
          <span className={priceClass}>{formatPrice(price)}</span>
          <span className={detailClass}>{t("acceptsOffers")}</span>
        </div>
      );

    case PricingType.Bidding:
      return (
        <div className="flex flex-col gap-0.5">
          {minBidPrice ? (
            <span className={detailClass}>{t("minBid")}: {formatPrice(minBidPrice)}</span>
          ) : null}
          <span className={priceClass}>{t("openBidding")}</span>
        </div>
      );

    case PricingType.Auction:
      return (
        <div className="flex flex-col gap-0.5">
          {highestBid != null ? (
            <span className={priceClass}>{formatPrice(highestBid)}</span>
          ) : minBidPrice ? (
            <span className={detailClass}>
              {t("startPrice")}: {formatPrice(minBidPrice)}
              {bidStep ? ` · ${t("step")}: ${formatPrice(bidStep)}` : ""}
            </span>
          ) : null}
          <span className={highestBid != null ? detailClass : priceClass}>{t("auction")}</span>
          {auctionEnd && (
            <AuctionCountdown end={auctionEnd} t={t} />
          )}
        </div>
      );

    default:
      return null;
  }
}

// === Auction Countdown ===

export function AuctionCountdown({ end, t }: { end: string; t: (key: string) => string }) {
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
