"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { fetchPublicItem, PricingType, Condition } from "@/lib/items";
import type { PublicItemDetail } from "@/lib/items";
import { ImageGallery } from "@/components/image-gallery";
import { formatPrice, AuctionCountdown, pricingTypeKey } from "@/components/item-card-shared";
import { Button } from "@/components/ui/button";
import {
  X,
  MapPin,
  Package,
  Truck,
  Tag,
  TrendingUp,
  DollarSign,
  MessageCircle,
  Loader2,
} from "lucide-react";

interface ItemDetailModalProps {
  itemId: string;
  onClose: () => void;
}

// === Condition label ===

function conditionLabel(condition: number, t: (key: string) => string): string {
  switch (condition) {
    case Condition.New: return t("condNew");
    case Condition.Used: return t("condUsed");
    case Condition.Worn: return t("condWorn");
    default: return t("condUsed");
  }
}

// === Pricing section ===

function DetailPricing({ item, t }: { item: PublicItemDetail; t: (key: string, values?: Record<string, string | number>) => string }) {
  const priceClass = "text-2xl font-bold text-emerald-400";
  const labelClass = "text-sm text-muted-foreground";

  switch (item.pricingType) {
    case PricingType.Fixed:
      return (
        <div className="flex flex-col gap-1">
          <span className={priceClass}>{formatPrice(item.price)}</span>
          <span className={labelClass}>{t("fixedPrice")}</span>
        </div>
      );
    case PricingType.FixedOffers:
      return (
        <div className="flex flex-col gap-1">
          <span className={priceClass}>{formatPrice(item.price)}</span>
          <span className={labelClass}>{t("acceptsOffers")}</span>
        </div>
      );
    case PricingType.Bidding:
      return (
        <div className="flex flex-col gap-1">
          {item.highestBid != null ? (
            <>
              <span className={priceClass}>{formatPrice(item.highestBid)}</span>
              <span className={labelClass}>{t("highestBid")} · {t("bids", { count: item.bidCount })}</span>
            </>
          ) : (
            <>
              <span className={priceClass}>{t("openBidding")}</span>
              {item.minBidPrice != null && (
                <span className={labelClass}>{t("startingPrice")}: {formatPrice(item.minBidPrice)}</span>
              )}
            </>
          )}
        </div>
      );
    case PricingType.Auction:
      return (
        <div className="flex flex-col gap-2">
          {item.highestBid != null ? (
            <>
              <span className={priceClass}>{formatPrice(item.highestBid)}</span>
              <span className={labelClass}>{t("highestBid")} · {t("bids", { count: item.bidCount })}</span>
            </>
          ) : (
            <>
              <span className={priceClass}>{formatPrice(item.minBidPrice)}</span>
              <span className={labelClass}>{t("startingPrice")}</span>
            </>
          )}
          {item.bidStep != null && (
            <span className={labelClass}>{t("bidStep")}: {formatPrice(item.bidStep)}</span>
          )}
          {item.auctionEnd && (
            <AuctionCountdown end={item.auctionEnd} t={(key: string) => {
              if (key === "ended") return t("auctionEnded");
              if (key === "endsIn") return t("endsIn");
              return key;
            }} />
          )}
        </div>
      );
    default:
      return null;
  }
}

// === Action button ===

function ActionButton({ item, t }: { item: PublicItemDetail; t: (key: string) => string }) {
  const isAuctionEnded = item.pricingType === PricingType.Auction
    && item.auctionEnd
    && new Date(item.auctionEnd).getTime() < Date.now();

  if (isAuctionEnded) return null;

  let label: string;
  let Icon = DollarSign;

  switch (item.pricingType) {
    case PricingType.Fixed:
      label = t("buyNow");
      Icon = DollarSign;
      break;
    case PricingType.FixedOffers:
      label = t("makeOffer");
      Icon = MessageCircle;
      break;
    case PricingType.Bidding:
    case PricingType.Auction:
      label = t("placeBid");
      Icon = TrendingUp;
      break;
    default:
      label = t("makeOffer");
  }

  return (
    <Button onClick={() => alert(t("comingSoon"))} size="lg" className="mt-4 w-full">
      <Icon className="mr-2 size-4" />
      {label}
    </Button>
  );
}

// === Modal ===

export function ItemDetailModal({ itemId, onClose }: ItemDetailModalProps) {
  const t = useTranslations("itemDetail");
  const [item, setItem] = useState<PublicItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchPublicItem(itemId)
      .then(setItem)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [itemId]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const typeKey = item ? pricingTypeKey(item.pricingType) : "fixed";
  const typeColorMap: Record<string, string> = {
    fixed: "bg-blue-500",
    offers: "bg-purple-500",
    bidding: "bg-orange-500",
    auction: "bg-orange-500",
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-2 z-51 flex flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl md:inset-auto md:left-1/2 md:top-1/2 md:max-h-[90vh] md:w-[700px] md:-translate-x-1/2 md:-translate-y-1/2">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="truncate text-sm font-semibold">
            {loading ? "..." : item?.title ?? t("notFound")}
          </h2>
          <button
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Error */}
          {!loading && (error || !item) && (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <Package className="size-12 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{t("notFoundDescription")}</p>
            </div>
          )}

          {/* Content */}
          {!loading && item && (
            <div className="p-4 md:p-6">
              {/* Image gallery */}
              <ImageGallery images={item.images} alt={item.title} />

              {/* Info */}
              <div className="mt-6 space-y-4">
                {/* Type + Condition badges */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase text-white ${typeColorMap[typeKey]}`}>
                    {t(typeKey === "fixed" ? "fixedPrice" : typeKey === "offers" ? "acceptsOffers" : typeKey === "bidding" ? "openBidding" : "auction")}
                  </span>
                  <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                    {conditionLabel(item.condition, t)}
                  </span>
                </div>

                {/* Title */}
                <h1 className="text-xl font-bold leading-tight">{item.title}</h1>

                {/* Category */}
                <span className="text-sm text-muted-foreground">
                  {t("category")}: {item.categoryName}
                </span>

                {/* Pricing */}
                <div className="rounded-lg border border-border bg-card p-4">
                  <DetailPricing item={item} t={t} />
                  <ActionButton item={item} t={t} />
                </div>

                {/* Location + Shipping */}
                {(item.location || item.canShip) && (
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    {item.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-4" />
                        {item.location}
                      </span>
                    )}
                    {item.canShip ? (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Truck className="size-4" />
                        {t("canShip")}
                      </span>
                    ) : item.location ? (
                      <span className="flex items-center gap-1">
                        <Package className="size-4" />
                        {t("localPickupOnly")}
                      </span>
                    ) : null}
                  </div>
                )}

                {/* Tags */}
                {item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                      >
                        <Tag className="size-3" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Description */}
                {item.description && (
                  <div className="rounded-lg border border-border bg-card p-4">
                    <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("description")}
                    </h2>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                )}

                {/* Seller card */}
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("seller")}
                  </p>
                  <div className="flex items-center gap-3">
                    {item.seller.avatarUrl ? (
                      <img src={item.seller.avatarUrl} alt="" className="size-10 rounded-full object-cover" />
                    ) : (
                      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
                        {item.seller.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{item.seller.displayName}</p>
                      {item.seller.location && (
                        <p className="text-xs text-muted-foreground">
                          <MapPin className="mr-0.5 inline size-3" />
                          {item.seller.location}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {t("memberSince", { date: new Date(item.seller.memberSince).toLocaleDateString() })}
                      </p>
                    </div>
                  </div>
                  {item.seller.bio && (
                    <p className="mt-3 text-sm text-muted-foreground">{item.seller.bio}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
