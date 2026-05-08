"use client";

import Link from "next/link";
import { MapPin, Package, ImageIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import type { PublicStallResponse } from "@/lib/stalls";

interface PublicStallCardProps {
  stall: PublicStallResponse;
}

export function PublicStallCard({ stall }: PublicStallCardProps) {
  const t = useTranslations("stalls");
  const previews = stall.previewImageUrls.slice(0, 4);

  return (
    <Link
      href={`/user/${encodeURIComponent(stall.owner.displayName)}`}
      className="group relative flex w-full flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-colors hover:border-border/60"
    >
      {/* Header strip — image, accent gradient, or empty placeholder */}
      <div
        className="relative aspect-[5/2] w-full overflow-hidden bg-muted"
        style={
          !stall.headerImageUrl && stall.accentColor
            ? {
                background: `linear-gradient(135deg, ${stall.accentColor}40, ${stall.accentColor}10)`,
              }
            : undefined
        }
      >
        {stall.headerImageUrl ? (
          <img
            src={stall.headerImageUrl}
            alt=""
            className="size-full object-cover"
          />
        ) : !stall.accentColor ? (
          <div className="flex size-full items-center justify-center text-muted-foreground/40">
            <ImageIcon className="size-12" />
          </div>
        ) : null}

        {/* Item count badge — bg-black/60 scrim guarantees contrast over user-supplied accent or any image */}
        <span className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-lg bg-black/60 px-2.5 py-1 text-xs font-semibold text-white shadow-md">
          <Package className="size-3" />
          {t("itemCount", { count: stall.itemCount })}
        </span>
      </div>

      {/* Stall identity row */}
      <div className="flex items-center gap-2 px-3 pt-3">
        {stall.thumbnailUrl ? (
          <img
            src={stall.thumbnailUrl}
            alt=""
            className="size-10 shrink-0 rounded-full object-cover ring-2 ring-card"
          />
        ) : (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground ring-2 ring-card">
            {stall.name.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="line-clamp-2 flex-1 text-sm font-semibold leading-tight">
          {stall.name}
        </span>
      </div>

      {/* Owner row */}
      <div className="mt-2 flex items-center gap-2 px-3">
        <UserAvatar
          displayName={stall.owner.displayName}
          avatarUrl={stall.owner.avatarUrl}
          size="xs"
        />
        <span className="truncate text-xs text-muted-foreground">
          {stall.owner.displayName}
        </span>
        {stall.owner.location && (
          <span className="ml-auto flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
            <MapPin className="size-3" />
            <span className="max-w-[80px] truncate">{stall.owner.location}</span>
          </span>
        )}
      </div>

      {/* Preview thumbnails — 3 on mobile, 4 on sm+ */}
      {previews.length > 0 ? (
        <div className="mt-2 flex items-center gap-1.5 px-3 pb-3">
          {previews.slice(0, 3).map((url, i) => (
            <div
              key={i}
              className="size-12 overflow-hidden rounded-md bg-muted ring-1 ring-border sm:size-14"
            >
              <img src={url} alt="" className="size-full object-cover" />
            </div>
          ))}
          {previews.length >= 4 && (
            <div className="hidden size-14 overflow-hidden rounded-md bg-muted ring-1 ring-border sm:block">
              <img src={previews[3]} alt="" className="size-full object-cover" />
            </div>
          )}
        </div>
      ) : (
        <div className="pb-3" />
      )}
    </Link>
  );
}

export function PublicStallCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Skeleton className="aspect-[5/2] w-full" />
      <div className="flex items-center gap-2 px-3 pt-3">
        <Skeleton className="size-10 shrink-0 rounded-full" />
        <Skeleton className="h-4 flex-1" />
      </div>
      <div className="mt-2 flex items-center gap-2 px-3">
        <Skeleton className="size-6 shrink-0 rounded-full" />
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="mt-2 flex items-center gap-1.5 px-3 pb-3">
        <Skeleton className="size-12 rounded-md sm:size-14" />
        <Skeleton className="size-12 rounded-md sm:size-14" />
        <Skeleton className="size-12 rounded-md sm:size-14" />
      </div>
    </div>
  );
}
