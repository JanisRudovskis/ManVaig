"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { fetchMyItems, reorderItems, PricingType, ItemVisibility } from "@/lib/items";
import type { ItemResponse } from "@/lib/items";
import {
  fetchStall,
  updateStall,
  deleteStall,
  uploadStallBackground,
  deleteStallBackground,
  type StallResponse,
} from "@/lib/stalls";
import { ItemForm } from "@/components/item-form";
import { BidsModal } from "@/components/bids-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ImageLightbox } from "@/components/image-lightbox";
import {
  timeAgo,
  isAuctionEnded,
  TypeTag,
  PriceDisplay,
  ItemCardSkeleton,
} from "@/components/item-card-shared";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Package,
  Plus,
  Pencil,
  ImageIcon,
  HandCoins,
  ChevronLeft,
  Loader2,
  X,
  Trash2,
  Upload,
  GripVertical,
  AlertCircle,
  Clock,
  Gavel,
} from "lucide-react";

// === Helpers ===

function visibilityKey(vis: number): string | null {
  switch (vis) {
    case ItemVisibility.Private: return "private";
    case ItemVisibility.RegisteredOnly: return "registered";
    case ItemVisibility.LinkOnly: return "linkOnly";
    default: return null;
  }
}

function VisibilityTag({ visibility, t }: { visibility: number; t: (key: string) => string }) {
  const key = visibilityKey(visibility);
  if (!key) return null;
  const colorMap: Record<string, string> = {
    private: "bg-zinc-500",
    registered: "bg-yellow-500 text-black",
    linkOnly: "bg-teal-500",
  };
  return (
    <span className={`absolute top-0 right-0 z-10 rounded-tr-[calc(var(--radius)*1.4)] rounded-bl-[calc(var(--radius)*0.6)] px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-white ${colorMap[key]}`}>
      {t(`vis_${key}`)}
    </span>
  );
}

/** Check if an item "needs attention" — ended auction, has bids, or ending soon */
function needsAttention(item: ItemResponse): boolean {
  const ended = isAuctionEnded(item.auctionEnd, item.pricingType);
  if (ended) return true;
  if (item.bidCount > 0) return true;
  if (isEndingSoon(item)) return true;
  return false;
}

function isEndingSoon(item: ItemResponse): boolean {
  if (item.pricingType !== PricingType.Auction || !item.auctionEnd) return false;
  const end = new Date(item.auctionEnd).getTime();
  const now = Date.now();
  return end > now && end - now < 24 * 60 * 60 * 1000;
}

// === Activity Badges ===

function ActivityBadges({ item, ts }: { item: ItemResponse; ts: (key: string, values?: Record<string, string | number>) => string }) {
  const ended = isAuctionEnded(item.auctionEnd, item.pricingType);
  const endingSoon = isEndingSoon(item);
  const hasBids = item.bidCount > 0;

  if (!ended && !endingSoon && !hasBids) return null;

  return (
    <div className="absolute bottom-2 left-2 z-10 flex flex-wrap gap-1">
      {ended && (
        <span className="flex items-center gap-1 rounded-full bg-red-500/90 px-2 py-0.5 text-[0.6rem] font-bold uppercase text-white backdrop-blur-sm">
          <AlertCircle className="size-3" />
          {ts("auctionEnded")}
        </span>
      )}
      {!ended && endingSoon && (
        <span className="flex items-center gap-1 rounded-full bg-yellow-500/90 px-2 py-0.5 text-[0.6rem] font-bold uppercase text-black backdrop-blur-sm">
          <Clock className="size-3" />
          {ts("endingSoon")}
        </span>
      )}
      {hasBids && !ended && (
        <span className="flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-[0.6rem] font-bold uppercase text-white backdrop-blur-sm">
          <Gavel className="size-3" />
          {ts("bidsCount", { count: item.bidCount })}
        </span>
      )}
    </div>
  );
}

// === Stall Description (collapsible) ===

const DESCRIPTION_CLAMP_LINES = 2;
const DESCRIPTION_CHAR_THRESHOLD = 120; // descriptions shorter than this never need "show more"

function StallDescription({ description, ts }: { description: string | null; ts: (key: string) => string }) {
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Check if text is actually clamped (scrollHeight > clientHeight)
    setClamped(el.scrollHeight > el.clientHeight + 1);
  }, [description]);

  if (!description) return null;

  const isLong = description.length > DESCRIPTION_CHAR_THRESHOLD;

  return (
    <div>
      <p
        ref={ref}
        className={`text-muted-foreground text-sm whitespace-pre-line ${!expanded && isLong ? "line-clamp-2" : ""}`}
      >
        {description}
      </p>
      {clamped && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="text-xs text-primary hover:underline mt-0.5"
        >
          {ts("showMore")}
        </button>
      )}
      {expanded && isLong && (
        <button
          onClick={() => setExpanded(false)}
          className="text-xs text-primary hover:underline mt-0.5"
        >
          {ts("showLess")}
        </button>
      )}
    </div>
  );
}

// === Item Card ===

function ItemCard({
  item, t, ts, onEdit, onViewBids, onImageClick, reorderMode,
}: {
  item: ItemResponse;
  t: (key: string, values?: Record<string, string | number>) => string;
  ts: (key: string, values?: Record<string, string | number>) => string;
  onEdit: (item: ItemResponse) => void;
  onViewBids?: (item: ItemResponse) => void;
  onImageClick?: (item: ItemResponse) => void;
  reorderMode?: boolean;
}) {
  const ended = isAuctionEnded(item.auctionEnd, item.pricingType);
  const primaryImage = item.images.find((img) => img.isPrimary) ?? item.images[0];
  return (
    <div className={`relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-border/80 ${ended ? "opacity-60 hover:opacity-80" : ""}`}>
      {reorderMode && (
        <div className="absolute top-2 left-2 z-20 flex size-8 items-center justify-center rounded-lg bg-background/80 backdrop-blur-sm text-muted-foreground cursor-grab active:cursor-grabbing">
          <GripVertical className="size-4" />
        </div>
      )}
      <TypeTag type={item.pricingType} t={t} />
      <VisibilityTag visibility={item.visibility} t={t} />
      <div
        className={`relative aspect-[4/3] w-full overflow-hidden bg-muted ${!reorderMode && primaryImage ? "cursor-zoom-in" : ""}`}
        onClick={() => { if (!reorderMode && primaryImage && onImageClick) onImageClick(item); }}
      >
        {primaryImage ? (
          <img src={primaryImage.url} alt={item.title} className="absolute inset-0 size-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageIcon className="size-12 text-muted-foreground" />
          </div>
        )}
        <ActivityBadges item={item} ts={ts} />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <span className="line-clamp-2 text-sm font-semibold leading-tight">{item.title}</span>
        <PriceDisplay pricingType={item.pricingType} price={item.price} minBidPrice={item.minBidPrice} bidStep={item.bidStep} auctionEnd={item.auctionEnd} t={t} bidCount={item.bidCount} highestBid={item.highestBid} hideEndedStatus />
      </div>
      {!reorderMode && (
        <>
          <hr className="mx-3 border-border" />
          <div className="flex items-center justify-between px-3 py-2">
            <span className="truncate text-xs text-muted-foreground">{t("listed")} {timeAgo(item.createdAt, t)}</span>
            <div className="flex shrink-0 items-center gap-1">
              {item.pricingType === PricingType.Auction && onViewBids && (
                <button onClick={() => onViewBids(item)} className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title={t("type_auction")}>
                  <HandCoins className="size-4" />
                </button>
              )}
              <button onClick={() => onEdit(item)} className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title={t("edit")}>
                <Pencil className="size-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// === Sortable wrapper for drag-and-drop ===

function SortableItemCard(props: {
  item: ItemResponse;
  t: (key: string, values?: Record<string, string | number>) => string;
  ts: (key: string, values?: Record<string, string | number>) => string;
  onEdit: (item: ItemResponse) => void;
  onViewBids?: (item: ItemResponse) => void;
  onImageClick?: (item: ItemResponse) => void;
  reorderMode: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...(props.reorderMode ? listeners : {})}>
      <ItemCard {...props} />
    </div>
  );
}

// === Main Page ===

export default function StallItemsPage() {
  const t = useTranslations("items");
  const ts = useTranslations("stalls");
  const { isLoggedIn, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const stallId = params.id as string;

  const [stall, setStall] = useState<StallResponse | null>(null);
  const [items, setItems] = useState<ItemResponse[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemResponse | null>(null);
  const [bidsItem, setBidsItem] = useState<ItemResponse | null>(null);
  const [lightboxItem, setLightboxItem] = useState<ItemResponse | null>(null);

  // Filter + reorder state
  const [activeFilter, setActiveFilter] = useState<"all" | "attention">("all");
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderSaving, setReorderSaving] = useState(false);

  // Stall edit state
  const [editingStall, setEditingStall] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingStall, setSavingStall] = useState(false);
  const [stallError, setStallError] = useState("");
  const [uploadingBg, setUploadingBg] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingStall, setDeletingStall] = useState(false);
  const bgInputRef = useRef<HTMLInputElement>(null);

  // DnD sensors
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 5 },
  });
  const sensors = useSensors(pointerSensor, touchSensor);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [stallData, itemsData] = await Promise.all([
        fetchStall(stallId),
        fetchMyItems(1, 100, stallId, "custom"),
      ]);
      setStall(stallData);
      setItems(itemsData.items);
      setTotalCount(itemsData.totalCount);
    } catch {
      // error handling
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stallId]);

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isLoggedIn, stallId]);

  const handleAdd = () => {
    router.push(`/my-stalls/${stallId}/items/new`);
  };

  const handleEdit = (item: ItemResponse) => {
    setEditingItem(item);
    setFormOpen(true);
  };

  const handleFormSaved = () => {
    setFormOpen(false);
    setEditingItem(null);
    loadData();
  };

  // Reorder handling
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // Optimistic reorder
    const reordered = [...items];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    setItems(reordered);

    // Save to backend
    setReorderSaving(true);
    try {
      await reorderItems(stallId, reordered.map((i) => i.id));
    } catch {
      // Revert on error
      loadData();
    } finally {
      setReorderSaving(false);
    }
  };

  // Filter logic (client-side)
  const filteredItems = activeFilter === "attention"
    ? items.filter(needsAttention)
    : items;

  const attentionCount = items.filter(needsAttention).length;

  const startEditingStall = () => {
    if (!stall) return;
    setEditName(stall.name);
    setEditDescription(stall.description ?? "");
    setEditingStall(true);
    setStallError("");
  };

  const handleSaveStall = async () => {
    const name = editName.trim();
    if (name.length < 3 || name.length > 50) {
      setStallError(ts("errorNameLength"));
      return;
    }
    setSavingStall(true);
    setStallError("");
    try {
      const updated = await updateStall(stallId, {
        name,
        description: editDescription.trim(),
      });
      setStall(updated);
      setEditingStall(false);
    } catch {
      setStallError(ts("errorCreateFailed"));
    } finally {
      setSavingStall(false);
    }
  };

  const handleDeleteStall = async () => {
    if (!stall) return;
    setDeletingStall(true);
    try {
      await deleteStall(stallId);
      router.push("/my-stalls?view=all");
    } catch (err: unknown) {
      const e = err as Error;
      if (e.message === "LAST_STALL") {
        setStallError(ts("errorLastStall"));
      } else {
        setStallError(ts("errorCreateFailed"));
      }
      setShowDeleteConfirm(false);
    } finally {
      setDeletingStall(false);
    }
  };


  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBg(true);
    setStallError("");
    try {
      const result = await uploadStallBackground(stallId, file);
      setStall((prev) => prev ? { ...prev, backgroundImageUrl: result.backgroundImageUrl } : prev);
    } catch {
      setStallError(ts("errorImageUpload"));
    } finally {
      setUploadingBg(false);
      if (bgInputRef.current) bgInputRef.current.value = "";
    }
  };

  const handleBgDelete = async () => {
    setUploadingBg(true);
    try {
      await deleteStallBackground(stallId);
      setStall((prev) => prev ? { ...prev, backgroundImageUrl: null } : prev);
    } catch {
      setStallError(ts("errorImageUpload"));
    } finally {
      setUploadingBg(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-[1100px] px-4 py-6 md:px-6 md:py-8">
        <Skeleton className="h-6 w-32 mb-4" />
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <ItemCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="group/bg relative min-h-screen">
      {/* Background image — fills entire page content area */}
      {stall?.backgroundImageUrl && (
        <div
          className="absolute inset-0 rounded-xl overflow-hidden"
          style={{ backgroundImage: `url(${stall.backgroundImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }}
        >
          <div className="absolute inset-0 bg-background/85" />
        </div>
      )}

      {/* Background upload controls — bottom right */}
      <input
        ref={bgInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleBgUpload}
        className="hidden"
      />
      <div className="absolute bottom-4 right-4 z-20 flex gap-1 md:opacity-0 md:group-hover/bg:opacity-100 transition-opacity">
        <button
          onClick={() => bgInputRef.current?.click()}
          disabled={uploadingBg}
          className="rounded-lg bg-background/70 backdrop-blur-sm p-2 hover:bg-background/90 transition-colors text-xs flex items-center gap-1"
          title={ts("backgroundImage")}
        >
          {uploadingBg ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
          <span className="hidden sm:inline">{ts("backgroundImage")}</span>
        </button>
        {stall?.backgroundImageUrl && (
          <button
            onClick={handleBgDelete}
            disabled={uploadingBg}
            className="rounded-lg bg-background/70 backdrop-blur-sm p-2 text-destructive hover:bg-background/90 transition-colors"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>

      <div className="relative z-10 mx-auto max-w-[1100px] px-4 py-4 md:px-6 md:py-6">
      {/* Back button */}
      <Link
        href="/my-stalls?view=all"
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 -ml-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors mb-2"
      >
        <ChevronLeft className="size-4" />
        {ts("title")}
      </Link>

      {/* Stall header */}
      {stall && (
        <div className="mb-4">
          {!editingStall ? (
            /* View mode */
            <div>
              {/* Title row: thumbnail + name + edit stall */}
              <div className="flex items-center gap-3 mb-2">
                {stall.thumbnailUrl && (
                  <img
                    src={stall.thumbnailUrl}
                    alt=""
                    className="size-12 rounded-lg object-cover shrink-0 ring-1 ring-border"
                  />
                )}
                <h1 className="text-2xl font-bold flex-1 min-w-0">{stall.name}</h1>
                <Button variant="outline" size="sm" onClick={startEditingStall} className="shrink-0">
                  <Pencil className="size-4 mr-1" />
                  {ts("editStall")}
                </Button>
              </div>
              {/* Description — collapsible */}
              <StallDescription description={stall.description} ts={ts} />
              {/* Item count */}
              <div className="mt-2">
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                  {ts("itemCountInStall", { count: totalCount })}
                </span>
              </div>
            </div>
          ) : (
            /* Edit mode */
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{ts("editStall")}</h2>
                <button
                  onClick={() => setEditingStall(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-5" />
                </button>
              </div>
              <div>
                <Label className="text-sm">{ts("name")}</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={ts("namePlaceholder")}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm">{ts("description")}</Label>
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder={ts("descriptionPlaceholder")}
                  className="mt-1 min-h-16"
                  maxLength={500}
                />
              </div>

              {stallError && (
                <p className="text-sm text-destructive">{stallError}</p>
              )}
              <div className="flex items-center gap-2 pt-1">
                <Button onClick={handleSaveStall} disabled={savingStall} size="sm">
                  {savingStall && <Loader2 className="size-4 mr-1 animate-spin" />}
                  {ts("save")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingStall(false)}
                >
                  {ts("cancel")}
                </Button>
                <div className="flex-1" />
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="size-4 mr-1" />
                  {ts("deleteStall")}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter pills + reorder */}
      {items.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveFilter("all")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                activeFilter === "all"
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {ts("filterAll")} ({items.length})
            </button>
            {attentionCount > 0 && (
              <button
                onClick={() => { setActiveFilter("attention"); setReorderMode(false); }}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  activeFilter === "attention"
                    ? "bg-red-500 text-white"
                    : "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                }`}
              >
                <AlertCircle className="mr-1 inline size-3" />
                {ts("filterAttention")} ({attentionCount})
              </button>
            )}
          </div>

          <div className="flex-1" />

          {/* Add item button */}
          <Button onClick={handleAdd} size="sm" className="h-8 text-xs">
            <Plus className="size-3.5 mr-1" />
            {t("addItem")}
          </Button>

          {/* Reorder button */}
          <Button
            variant={reorderMode ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setReorderMode(!reorderMode)}
            disabled={reorderSaving}
          >
            {reorderSaving ? (
              <Loader2 className="size-3.5 mr-1 animate-spin" />
            ) : (
              <GripVertical className="size-3.5 mr-1" />
            )}
            {reorderMode ? ts("reorderDone") : ts("reorderItems")}
          </Button>
        </div>
      )}

      {/* Reorder hint */}
      {reorderMode && (
        <p className="mb-3 text-xs text-muted-foreground italic">
          {ts("reorderHint")}
        </p>
      )}

      {/* Items grid */}
      <div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <Package className="size-16 text-muted-foreground/50" />
          <h2 className="text-xl font-semibold">{t("emptyTitle")}</h2>
          <p className="max-w-xs text-sm text-muted-foreground">
            {t("emptyDescription")}
          </p>
          <Button onClick={handleAdd}>
            <Plus className="size-4" />
            {t("addFirstItem")}
          </Button>
        </div>
      ) : reorderMode ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={filteredItems.map((i) => i.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
              {filteredItems.map((item) => (
                <SortableItemCard
                  key={item.id}
                  item={item}
                  t={t}
                  ts={ts}
                  onEdit={handleEdit}
                  onViewBids={(item) => setBidsItem(item)}
                  onImageClick={(item) => setLightboxItem(item)}
                  reorderMode={true}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {filteredItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              t={t}
              ts={ts}
              onEdit={handleEdit}
              onViewBids={(item) => setBidsItem(item)}
              onImageClick={(item) => setLightboxItem(item)}
            />
          ))}
        </div>
      )}
      </div>

      {/* Empty filter state */}
      {items.length > 0 && filteredItems.length === 0 && activeFilter === "attention" && (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <AlertCircle className="size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {ts("noAttentionItems")}
          </p>
        </div>
      )}

      {/* Item form modal (edit only) */}
      {formOpen && editingItem && (
        <ItemForm
          mode="edit"
          item={editingItem}
          stallId={stallId}
          onClose={() => { setFormOpen(false); setEditingItem(null); }}
          onSaved={handleFormSaved}
        />
      )}

      {/* Bids modal */}
      {bidsItem && (
        <BidsModal
          item={bidsItem}
          onClose={() => setBidsItem(null)}
        />
      )}

      {/* Image lightbox */}
      {lightboxItem && lightboxItem.images.length > 0 && (
        <ImageLightbox
          images={lightboxItem.images}
          alt={lightboxItem.title}
          onClose={() => setLightboxItem(null)}
        />
      )}

      {/* Delete stall confirmation */}
      {stall && (
        <ConfirmDialog
          open={showDeleteConfirm}
          title={ts("deleteStall")}
          description={ts("deleteConfirm", { count: stall.itemCount })}
          confirmLabel={ts("confirmDelete")}
          cancelLabel={ts("cancel")}
          variant="destructive"
          loading={deletingStall}
          onConfirm={handleDeleteStall}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
    </div>
  );
}
