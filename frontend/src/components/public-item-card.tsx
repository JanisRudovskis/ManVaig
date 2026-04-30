"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ImageIcon, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { TypeTag, PriceDisplay, timeAgo } from "@/components/item-card-shared";
import type { PublicItemCard as PublicItemCardType } from "@/lib/items";
import type { ItemImage } from "@/lib/items";

const HOVER_INTERVAL = 1500; // ms between slides on desktop hover

interface PublicItemCardProps {
  item: PublicItemCardType;
  onClick?: (item: PublicItemCardType) => void;
}

// === Card Image Carousel ===

function CardImageCarousel({
  images,
  alt,
}: {
  images: ItemImage[];
  alt: string;
}) {
  const sorted = [...images].sort((a, b) => a.sortOrder - b.sortOrder);
  const total = sorted.length;
  const [activeIndex, setActiveIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef<number | null>(null);

  // Reset to first image when not interacting
  const resetToFirst = useCallback(() => {
    setActiveIndex(0);
  }, []);

  // Desktop: auto-cycle on hover
  const handleMouseEnter = useCallback(() => {
    if (total <= 1) return;
    intervalRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % total);
    }, HOVER_INTERVAL);
  }, [total]);

  const handleMouseLeave = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    resetToFirst();
  }, [resetToFirst]);

  // Mobile: swipe
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null || total <= 1) return;
      const diff = e.changedTouches[0].clientX - touchStartX.current;
      const threshold = 40;

      if (diff < -threshold) {
        // Swipe left → next
        setActiveIndex((prev) => Math.min(prev + 1, total - 1));
      } else if (diff > threshold) {
        // Swipe right → prev
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      }
      touchStartX.current = null;
    },
    [total]
  );

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (total === 0) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted">
        <ImageIcon className="size-12 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      className="relative aspect-[4/3] w-full overflow-hidden bg-muted"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Image */}
      <img
        src={sorted[activeIndex].url}
        alt={alt}
        className="size-full object-cover"
      />

      {/* Dot indicators */}
      {total > 1 && (
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
          {sorted.map((_, i) => (
            <span
              key={i}
              className={`size-1.5 rounded-full transition-all ${
                i === activeIndex
                  ? "bg-white scale-110"
                  : "bg-white/50"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// === Public Item Card ===

export function PublicItemCard({ item, onClick }: PublicItemCardProps) {
  const t = useTranslations("items");

  return (
    <button
      onClick={() => onClick?.(item)}
      className="group relative flex w-full flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-colors hover:border-border/60"
    >
      {/* Type tag */}
      <TypeTag type={item.pricingType} t={t} />

      {/* Image carousel */}
      <CardImageCarousel images={item.images} alt={item.title} />

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
    </button>
  );
}
