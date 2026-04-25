"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { fetchMyItems, PricingType, ItemVisibility } from "@/lib/items";
import type { ItemResponse } from "@/lib/items";
import { ItemForm } from "@/components/item-form";
import { BidsModal } from "@/components/bids-modal";
import {
  formatPrice,
  timeAgo,
  isAuctionEnded,
  TypeTag,
  PriceDisplay,
  ItemCardSkeleton,
} from "@/components/item-card-shared";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Plus, Pencil, ImageIcon, HandCoins } from "lucide-react";
import { Button } from "@/components/ui/button";

// === Helpers ===

function visibilityKey(vis: number): string | null {
  switch (vis) {
    case ItemVisibility.Private: return "private";
    case ItemVisibility.RegisteredOnly: return "registered";
    case ItemVisibility.LinkOnly: return "linkOnly";
    default: return null; // Public = no tag
  }
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

// === Item Card ===

function ItemCard({
  item,
  t,
  onEdit,
  onViewBids,
}: {
  item: ItemResponse;
  t: (key: string, values?: Record<string, string | number>) => string;
  onEdit: (item: ItemResponse) => void;
  onViewBids?: (item: ItemResponse) => void;
}) {
  const ended = isAuctionEnded(item.auctionEnd, item.pricingType);
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
        <PriceDisplay
          pricingType={item.pricingType}
          price={item.price}
          minBidPrice={item.minBidPrice}
          bidStep={item.bidStep}
          auctionEnd={item.auctionEnd}
          t={t}
        />
      </div>

      {/* Separator + Footer */}
      <hr className="mx-3 border-border" />
      <div className="flex items-center justify-between px-3 py-2">
        <span className="truncate text-xs text-muted-foreground">
          {t("listed")} {timeAgo(item.createdAt, t)}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {item.pricingType === PricingType.Auction && onViewBids && (
            <button
              onClick={() => onViewBids(item)}
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title={t("type_auction")}
            >
              <HandCoins className="size-4" />
            </button>
          )}
          <button
            onClick={() => onEdit(item)}
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={t("edit")}
          >
            <Pencil className="size-4" />
          </button>
        </div>
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
  const [bidsItem, setBidsItem] = useState<ItemResponse | null>(null);

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

  const handleViewBids = (item: ItemResponse) => {
    setBidsItem(item);
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
            <ItemCard key={item.id} item={item} t={t} onEdit={handleEdit} onViewBids={handleViewBids} />
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

      {/* Bids modal */}
      {bidsItem && (
        <BidsModal item={bidsItem} onClose={() => setBidsItem(null)} />
      )}
    </div>
  );
}
