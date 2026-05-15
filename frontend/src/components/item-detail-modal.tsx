"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { fetchPublicItem, Condition } from "@/lib/items";
import type { PublicItemDetail } from "@/lib/items";
import { ImageGallery } from "@/components/image-gallery";
import { formatPrice, EndDateCountdown, isEnded } from "@/components/item-card-shared";
import { OffersPopup } from "@/components/offers-popup";
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
  HandCoins,
  Check,
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
    case Condition.LikeNew: return t("condLikeNew");
    case Condition.Good: return t("condGood");
    case Condition.Fair: return t("condFair");
    case Condition.Poor: return t("condPoor");
    default: return t("condGood");
  }
}

// === Pricing section ===

function DetailPricing({ item, t }: { item: PublicItemDetail; t: (key: string, values?: Record<string, string | number>) => string }) {
  const priceClass = "text-2xl font-bold text-emerald-400";
  const labelClass = "text-sm text-muted-foreground";

  return (
    <div className="flex flex-col gap-2">
      {/* Main price */}
      {item.price != null ? (
        <span className={priceClass}>{formatPrice(item.price)}</span>
      ) : item.acceptOffers ? (
        <span className={priceClass}>{t("openBidding")}</span>
      ) : null}

      {/* Accepts offers label */}
      {item.acceptOffers && (
        <span className={labelClass}>{t("acceptsOffers")}</span>
      )}

      {/* Highest bid info */}
      {item.acceptOffers && item.highestBid != null && (
        <span className={labelClass}>
          {t("highestBid")}: {formatPrice(item.highestBid)} · {t("bids", { count: item.bidCount })}
        </span>
      )}

      {/* Min offer */}
      {item.acceptOffers && item.minOfferPrice != null && (
        <span className={labelClass}>{t("minOffer")}: {formatPrice(item.minOfferPrice)}</span>
      )}

      {/* Offer step */}
      {item.acceptOffers && item.offerStep != null && (
        <span className={labelClass}>{t("offerStep")}: {formatPrice(item.offerStep)}</span>
      )}

      {/* End date countdown */}
      {item.endDate && (
        <EndDateCountdown end={item.endDate} t={(key: string) => {
          if (key === "ended") return t("auctionEnded");
          if (key === "endsIn") return t("endsIn");
          return key;
        }} />
      )}
    </div>
  );
}

// === Action button ===

function ActionButton({
  item,
  t,
  onOpenOffers,
}: {
  item: PublicItemDetail;
  t: (key: string) => string;
  onOpenOffers: () => void;
}) {
  if (item.isSold) {
    return (
      <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-400">
        <Check className="size-4" />
        {t("sold")}
      </div>
    );
  }

  if (item.acceptOffers) {
    let label: string;
    let Icon = HandCoins;

    if (item.endDate && !isEnded(item.endDate)) {
      label = t("placeBid");
      Icon = TrendingUp;
    } else if (isEnded(item.endDate)) {
      label = t("auctionEnded");
      Icon = HandCoins;
    } else {
      label = t("makeOffer");
      Icon = MessageCircle;
    }

    return (
      <Button onClick={onOpenOffers} size="lg" className="mt-4 w-full">
        <Icon className="mr-2 size-4" />
        {label}
      </Button>
    );
  }

  if (!item.acceptOffers && item.price) {
    return (
      <Button size="lg" className="mt-4 w-full" disabled>
        <DollarSign className="mr-2 size-4" />
        {t("buyNow")}
      </Button>
    );
  }

  return null;
}

// === Modal ===

export function ItemDetailModal({ itemId, onClose }: ItemDetailModalProps) {
  const t = useTranslations("itemDetail");
  const tc = useTranslations("categories");
  const [item, setItem] = useState<PublicItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showOffers, setShowOffers] = useState(false);

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

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        className="fixed inset-2 z-[60] flex flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl md:inset-auto md:left-1/2 md:top-1/2 md:max-h-[90vh] md:w-[700px] md:-translate-x-1/2 md:-translate-y-1/2"
        onClick={(e) => e.stopPropagation()}
      >
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
                {/* Condition badge */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                    {conditionLabel(item.condition, t)}
                  </span>
                </div>

                {/* Title */}
                <h1 className="text-xl font-bold leading-tight">{item.title}</h1>

                {/* Category */}
                <span className="text-sm text-muted-foreground">
                  {t("category")}: {tc.has(String(item.categoryId)) ? tc(String(item.categoryId)) : item.categoryName}
                </span>

                {/* Pricing */}
                <div className="rounded-lg border border-border bg-card p-4">
                  <DetailPricing item={item} t={t} />
                  <ActionButton item={item} t={t} onOpenOffers={() => setShowOffers(true)} />
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
      {/* Offers popup */}
      {showOffers && item && (
        <OffersPopup
          itemId={item.id}
          itemTitle={item.title}
          itemImages={item.images}
          onClose={() => setShowOffers(false)}
        />
      )}
    </>
  );
}
