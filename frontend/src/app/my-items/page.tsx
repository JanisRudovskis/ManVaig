"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { fetchMyItems, PricingType, ItemVisibility } from "@/lib/items";
import type { ItemResponse } from "@/lib/items";
import { ItemForm } from "@/components/item-form";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Plus, Pencil, Clock, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

// === Helpers ===

function pricingTypeKey(type: number): string {
  switch (type) {
    case PricingType.Fixed: return "fixed";
    case PricingType.FixedOffers: return "offers";
    case PricingType.Bidding: return "bidding";
    case PricingType.Auction: return "auction";
    default: return "fixed";
  }
}

function visibilityKey(vis: number): string | null {
  switch (vis) {
    case ItemVisibility.Private: return "private";
    case ItemVisibility.RegisteredOnly: return "registered";
    case ItemVisibility.LinkOnly: return "linkOnly";
    default: return null; // Public = no tag
  }
}

function formatPrice(price: number | null): string {
  if (price == null) return "";
  return `\u20AC${price.toFixed(2)}`;
}

function timeAgo(dateStr: string, t: (key: string, values?: Record<string, string | number>) => string): string {
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

function isAuctionEnded(item: ItemResponse): boolean {
  if (item.pricingType !== PricingType.Auction || !item.auctionEnd) return false;
  return new Date(item.auctionEnd).getTime() < Date.now();
}

// === Type Tag ===

function TypeTag({ type, t }: { type: number; t: (key: string) => string }) {
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

// === Visibility Tag ===

function VisibilityTag({ visibility, t }: { visibility: number; t: (key: string) => string }) {
  const key = visibilityKey(visibility);
  if (!key) return null;

  const colorMap: Record<string, string> = {
    private: "bg-zinc-500",
    registered: "bg-yellow-500 text-black",
    linkOnly: "bg-teal-500",
  };

  return (
    <span
      className={`absolute top-0 right-0 z-10 rounded-tr-[calc(var(--radius)*1.4)] rounded-bl-[calc(var(--radius)*0.6)] px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-white ${colorMap[key]}`}
    >
      {t(`vis_${key}`)}
    </span>
  );
}

// === Price Display ===

function PriceDisplay({ item, t }: { item: ItemResponse; t: (key: string) => string }) {
  const priceClass = "text-lg font-bold text-emerald-400";
  const detailClass = "text-xs text-muted-foreground";

  switch (item.pricingType) {
    case PricingType.Fixed:
      return <span className={priceClass}>{formatPrice(item.price)}</span>;

    case PricingType.FixedOffers:
      return (
        <div className="flex flex-col gap-0.5">
          <span className={priceClass}>{formatPrice(item.price)}</span>
          <span className={detailClass}>{t("acceptsOffers")}</span>
        </div>
      );

    case PricingType.Bidding:
      return (
        <div className="flex flex-col gap-0.5">
          {item.minBidPrice ? (
            <span className={detailClass}>{t("minBid")}: {formatPrice(item.minBidPrice)}</span>
          ) : null}
          <span className={priceClass}>{t("openBidding")}</span>
        </div>
      );

    case PricingType.Auction:
      return (
        <div className="flex flex-col gap-0.5">
          {item.minBidPrice ? (
            <span className={detailClass}>
              {t("startPrice")}: {formatPrice(item.minBidPrice)}
              {item.bidStep ? ` · ${t("step")}: ${formatPrice(item.bidStep)}` : ""}
            </span>
          ) : null}
          <span className={priceClass}>{t("auction")}</span>
          {item.auctionEnd && (
            <AuctionCountdown end={item.auctionEnd} t={t} />
          )}
        </div>
      );

    default:
      return null;
  }
}

// === Auction Countdown ===

function AuctionCountdown({ end, t }: { end: string; t: (key: string) => string }) {
  const endTime = new Date(end).getTime();
  const now = Date.now();
  const diff = endTime - now;

  if (diff <= 0) {
    return <span className="text-xs font-medium text-destructive">{t("ended")}</span>;
  }

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);

  // Urgent if less than 1 hour
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

// === Item Card ===

function ItemCard({
  item,
  t,
  onEdit,
}: {
  item: ItemResponse;
  t: (key: string, values?: Record<string, string | number>) => string;
  onEdit: (item: ItemResponse) => void;
}) {
  const ended = isAuctionEnded(item);
  const primaryImage = item.images.find((img) => img.isPrimary) ?? item.images[0];

  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-border/80 ${ended ? "opacity-60 hover:opacity-80" : ""}`}
    >
      {/* Type tag */}
      <TypeTag type={item.pricingType} t={t} />

      {/* Visibility tag */}
      <VisibilityTag visibility={item.visibility} t={t} />

      {/* Image */}
      <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted">
        {primaryImage ? (
          <img
            src={primaryImage.url}
            alt={item.title}
            className="size-full object-cover"
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
        <PriceDisplay item={item} t={t} />
      </div>

      {/* Separator + Footer */}
      <hr className="mx-3 border-border" />
      <div className="flex items-center justify-between px-3 py-2">
        <span className="truncate text-xs text-muted-foreground">
          {t("listed")} {timeAgo(item.createdAt, t)}
        </span>
        <button
          onClick={() => onEdit(item)}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title={t("edit")}
        >
          <Pencil className="size-4" />
        </button>
      </div>
    </div>
  );
}

// === Empty State ===

function EmptyState({ t, onAdd }: { t: (key: string) => string; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <Package className="size-16 text-muted-foreground/50" />
      <h2 className="text-xl font-semibold">{t("emptyTitle")}</h2>
      <p className="max-w-xs text-sm text-muted-foreground">
        {t("emptyDescription")}
      </p>
      <Button onClick={onAdd}>
        <Plus className="size-4" />
        {t("addFirstItem")}
      </Button>
    </div>
  );
}

// === Loading Skeleton ===

function ItemCardSkeleton() {
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

// === Main Page ===

export default function MyItemsPage() {
  const t = useTranslations("items");
  const { isLoggedIn, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<ItemResponse[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [maxItems, setMaxItems] = useState(10);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [editingItem, setEditingItem] = useState<ItemResponse | null>(null);

  const loadItems = () => {
    fetchMyItems()
      .then((data) => {
        setItems(data.items);
        setTotalCount(data.totalCount);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (authLoading) return;

    if (!isLoggedIn) {
      router.push("/login");
      return;
    }

    loadItems();
  }, [authLoading, isLoggedIn, router]);

  const handleAdd = () => {
    setFormMode("add");
    setEditingItem(null);
    setFormOpen(true);
  };

  const handleEdit = (item: ItemResponse) => {
    setFormMode("edit");
    setEditingItem(item);
    setFormOpen(true);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditingItem(null);
  };

  const handleFormSaved = () => {
    setFormOpen(false);
    setEditingItem(null);
    loadItems();
  };

  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-[1100px] px-4 py-6 md:px-6 md:py-8">
        <div className="mb-6 flex items-center gap-3">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <div className="flex-1" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <ItemCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 md:px-6 md:py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          {totalCount} / {maxItems} {t("itemsCount")}
        </span>
        <div className="flex-1" />
        <Button onClick={handleAdd}>
          <Plus className="size-4" />
          {t("addItem")}
        </Button>
      </div>

      {/* Items grid or empty state */}
      {items.length === 0 ? (
        <EmptyState t={t} onAdd={handleAdd} />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} t={t} onEdit={handleEdit} />
          ))}
        </div>
      )}

      {/* Add/Edit form modal */}
      {formOpen && (
        <ItemForm
          mode={formMode}
          item={editingItem}
          onClose={handleFormClose}
          onSaved={handleFormSaved}
          onDeleted={handleFormSaved}
        />
      )}
    </div>
  );
}
