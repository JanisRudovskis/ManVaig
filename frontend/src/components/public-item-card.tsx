"use client";

import Link from "next/link";
import { ImageIcon, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { TypeTag, PriceDisplay, timeAgo } from "@/components/item-card-shared";
import type { PublicItemCard as PublicItemCardType } from "@/lib/items";

interface PublicItemCardProps {
  item: PublicItemCardType;
}

export function PublicItemCard({ item }: PublicItemCardProps) {
  const t = useTranslations("items");
  const tf = useTranslations("feed");
  const primaryImage = item.images.find((img) => img.isPrimary) ?? item.images[0];

  return (
    <Link
      href={`/items/${item.id}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-border/60"
    >
      {/* Type tag */}
      <TypeTag type={item.pricingType} t={t} />

      {/* Image */}
      <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted">
        {primaryImage ? (
          <img
            src={primaryImage.url}
            alt={item.title}
            className="size-full object-cover transition-transform group-hover:scale-[1.02]"
          />
        ) : (
          <ImageIcon className="size-12 text-muted-foreground" />
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <span className="line-clamp-2 text-sm font-semibold leading-tight">
          {item.title}
        </span>
        <PriceDisplay
          pricingType={item.pricingType}
          price={item.price}
          minBidPrice={item.minBidPrice}
          bidStep={item.bidStep}
          auctionEnd={item.auctionEnd}
          t={t}
          bidCount={item.bidCount}
          highestBid={item.highestBid}
        />
      </div>

      {/* Separator + Footer */}
      <hr className="mx-3 border-border" />
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Seller */}
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {item.seller.avatarUrl ? (
            <img
              src={item.seller.avatarUrl}
              alt=""
              className="size-5 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[0.5rem] font-bold text-muted-foreground">
              {item.seller.displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="truncate text-xs text-muted-foreground">
            {item.seller.displayName}
          </span>
        </div>

        {/* Location */}
        {item.location && (
          <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
            <MapPin className="size-3" />
            <span className="max-w-[80px] truncate">{item.location}</span>
          </span>
        )}

        {/* Time */}
        <span className="shrink-0 text-xs text-muted-foreground">
          {timeAgo(item.createdAt, t)}
        </span>
      </div>
    </Link>
  );
}
