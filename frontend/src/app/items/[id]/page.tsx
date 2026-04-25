"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { fetchPublicItem, PricingType, Condition } from "@/lib/items";
import type { PublicItemDetail } from "@/lib/items";
import { ImageGallery } from "@/components/image-gallery";
import { formatPrice, AuctionCountdown, pricingTypeKey } from "@/components/item-card-shared";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Package,
  Truck,
  Tag,
  Clock,
  TrendingUp,
  DollarSign,
  MessageCircle,
  User,
  ArrowLeft,
} from "lucide-react";

// === Condition label ===

function conditionLabel(condition: number, t: (key: string) => string): string {
  switch (condition) {
    case Condition.New: return t("condNew");
    case Condition.Used: return t("condUsed");
    case Condition.Worn: return t("condWorn");
    default: return t("condUsed");
  }
}

// === Pricing section (detail view) ===

function DetailPricing({
  item,
  t,
}: {
  item: PublicItemDetail;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
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
            <div className="mt-1">
              <AuctionCountdown end={item.auctionEnd} t={(key: string) => {
                if (key === "ended") return t("auctionEnded");
                if (key === "endsIn") return t("endsIn");
                return key;
              }} />
            </div>
          )}
        </div>
      );

    default:
      return null;
  }
}

// === Action button ===

function ActionButton({ item, t }: { item: PublicItemDetail; t: (key: string) => string }) {
  const handleClick = () => {
    // Placeholder — will be implemented in Phase 5 (Offers)
    alert(t("comingSoon"));
  };

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
    <Button onClick={handleClick} size="lg" className="mt-4 w-full">
      <Icon className="mr-2 size-4" />
      {label}
    </Button>
  );
}

// === Loading skeleton ===

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-[900px] px-4 py-6 md:px-6 md:py-8">
      <Skeleton className="mb-6 h-6 w-24" />
      <div className="grid gap-8 md:grid-cols-[1fr,360px]">
        <Skeleton className="aspect-[4/3] w-full rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  );
}

// === Main Page ===

export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations("itemDetail");
  const id = params.id as string;

  const [item, setItem] = useState<PublicItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;

    fetchPublicItem(id)
      .then(setItem)
      .catch((err) => {
        const code = err instanceof Error ? err.message : "";
        if (code === "LOGIN_REQUIRED") {
          setError("login_required");
        } else {
          setError("not_found");
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <DetailSkeleton />;

  // Error states
  if (error === "login_required") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <User className="size-16 text-muted-foreground/50" />
        <h2 className="text-xl font-semibold">{t("loginRequired")}</h2>
        <Button onClick={() => router.push("/login")}>{t("loginButton")}</Button>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <Package className="size-16 text-muted-foreground/50" />
        <h2 className="text-xl font-semibold">{t("notFound")}</h2>
        <p className="max-w-xs text-sm text-muted-foreground">{t("notFoundDescription")}</p>
        <Button variant="outline" onClick={() => router.push("/")}>{t("goHome")}</Button>
      </div>
    );
  }

  const typeKey = pricingTypeKey(item.pricingType);
  const typeColorMap: Record<string, string> = {
    fixed: "bg-blue-500",
    offers: "bg-purple-500",
    bidding: "bg-orange-500",
    auction: "bg-orange-500",
  };

  return (
    <div className="mx-auto max-w-[900px] px-4 py-6 md:px-6 md:py-8">
      {/* Back link */}
      <button
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("goHome")}
      </button>

      {/* Main layout */}
      <div className="grid gap-8 md:grid-cols-[1fr,340px]">
        {/* Left: Images */}
        <div>
          <ImageGallery images={item.images} alt={item.title} />
        </div>

        {/* Right: Info */}
        <div className="flex flex-col gap-4">
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
          <h1 className="text-2xl font-bold leading-tight">{item.title}</h1>

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

          {/* Seller card */}
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("seller")}
            </p>
            <div className="flex items-center gap-3">
              {item.seller.avatarUrl ? (
                <img
                  src={item.seller.avatarUrl}
                  alt=""
                  className="size-10 rounded-full object-cover"
                />
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
                  {t("memberSince", {
                    date: new Date(item.seller.memberSince).toLocaleDateString()
                  })}
                </p>
              </div>
            </div>
            {item.seller.bio && (
              <p className="mt-3 text-sm text-muted-foreground">{item.seller.bio}</p>
            )}
          </div>
        </div>
      </div>

      {/* Description (full width below) */}
      {item.description && (
        <div className="mt-8 rounded-lg border border-border bg-card p-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {t("description")}
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {item.description}
          </p>
        </div>
      )}
    </div>
  );
}
