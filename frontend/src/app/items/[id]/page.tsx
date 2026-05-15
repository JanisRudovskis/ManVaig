"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { fetchPublicItem, Condition } from "@/lib/items";
import type { PublicItemDetail } from "@/lib/items";
import { startConversation } from "@/lib/messages";
import { ImageGallery } from "@/components/image-gallery";
import { OffersPopup } from "@/components/offers-popup";
import { formatPrice, EndDateCountdown, isEnded } from "@/components/item-card-shared";
import { useAuth } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Package,
  Truck,
  Tag,
  TrendingUp,
  DollarSign,
  MessageCircle,
  HandCoins,
  Check,
  User,
  ArrowLeft,
  Send,
} from "lucide-react";

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
        <div className="mt-1">
          <EndDateCountdown end={item.endDate} t={(key: string) => {
            if (key === "ended") return t("auctionEnded");
            if (key === "endsIn") return t("endsIn");
            return key;
          }} />
        </div>
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
  // Sold
  if (item.biddingClosed) {
    return (
      <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-400">
        <Check className="size-4" />
        {t("sold")}
      </div>
    );
  }

  // Deal in progress
  if (item.biddingPaused) {
    return (
      <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-blue-500/10 px-4 py-3 text-sm font-medium text-blue-400">
        <HandCoins className="size-4" />
        {t("dealInProgress")}
      </div>
    );
  }

  // Accepts offers — show button to open offers popup
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

  // Fixed price only — no offer system
  if (!item.acceptOffers && item.price) {
    return (
      <Button onClick={onOpenOffers} size="lg" className="mt-4 w-full" disabled>
        <DollarSign className="mr-2 size-4" />
        {t("buyNow")}
      </Button>
    );
  }

  return null;
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
  const tm = useTranslations("messages");
  const tc = useTranslations("categories");
  const { isLoggedIn, openLoginDialog } = useAuth();
  const id = params.id as string;

  const [item, setItem] = useState<PublicItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showOffers, setShowOffers] = useState(false);
  const [messagingLoading, setMessagingLoading] = useState(false);

  const handleMessageSeller = async () => {
    if (!isLoggedIn) { openLoginDialog(); return; }
    if (!item) return;
    setMessagingLoading(true);
    try {
      const conv = await startConversation(item.seller.sellerId);
      router.push(`/messages/${conv.id}`);
    } catch {
      // Fallback: navigate to messages page
      router.push("/messages");
    } finally {
      setMessagingLoading(false);
    }
  };

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
          {/* Condition badge */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {conditionLabel(item.condition, t)}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold leading-tight">{item.title}</h1>

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

            {/* Message Seller button — only for non-owners */}
            {!item.isOwner && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                onClick={handleMessageSeller}
                disabled={messagingLoading}
              >
                <Send className="mr-2 size-4" />
                {tm("messageSeller")}
              </Button>
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

      {/* Offers popup */}
      {showOffers && item && (
        <OffersPopup
          itemId={item.id}
          itemTitle={item.title}
          itemImages={item.images}
          onClose={() => setShowOffers(false)}
        />
      )}
    </div>
  );
}
