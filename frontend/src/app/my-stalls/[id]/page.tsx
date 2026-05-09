"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { fetchMyItems, reorderItems, ItemVisibility } from "@/lib/items";
import type { ItemResponse } from "@/lib/items";
import {
  fetchStall,
  updateStall,
  uploadStallThumbnail,
  deleteStallThumbnail,
  uploadStallHeader,
  deleteStallHeader,
  uploadStallBackground,
  deleteStallBackground,
  type StallResponse,
} from "@/lib/stalls";
import { ItemForm } from "@/components/item-form";
import { OffersPopup } from "@/components/offers-popup";
import { ImageLightbox } from "@/components/image-lightbox";
import { ImageCropDialog } from "@/components/image-crop-dialog";
import { StallFormDialog } from "@/components/stall-form-dialog";
import {
  timeAgo,
  isEnded,
  EndDatePill,
  PriceDisplay,
  ItemCardSkeleton,
} from "@/components/item-card-shared";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Package,
  Plus,
  Pencil,
  ImageIcon,
  HandCoins,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trash2,
  Upload,
  ArrowLeftRight,
  AlertCircle,
  Clock,
  Gavel,
  Palette,
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

function VisibilityLabel({ visibility, t }: { visibility: number; t: (key: string) => string }) {
  const key = visibilityKey(visibility);
  if (!key) return null;
  const colorMap: Record<string, string> = {
    private: "text-red-400",
    registered: "text-red-400",
    linkOnly: "text-red-400",
  };
  return (
    <span className={`text-xs font-semibold ${colorMap[key]}`}>
      {t(`vis_${key}`)}
    </span>
  );
}

/** Check if an item has ended (timed offer that expired) */
function isItemEnded(item: ItemResponse): boolean {
  return item.acceptOffers && isEnded(item.endDate);
}

function isEndingSoon(item: ItemResponse): boolean {
  if (!item.endDate) return false;
  const end = new Date(item.endDate).getTime();
  const now = Date.now();
  return end > now && end - now < 24 * 60 * 60 * 1000;
}

// === Activity Badges ===

function ActivityBadges({ item, ts }: { item: ItemResponse; ts: (key: string, values?: Record<string, string | number>) => string }) {
  const ended = isEnded(item.endDate);
  const endingSoon = isEndingSoon(item);
  const hasBids = item.bidCount > 0;

  if (!ended && !endingSoon && !hasBids && !item.biddingPaused && !item.biddingClosed) return null;

  return (
    <div className="absolute bottom-2 left-2 z-10 flex flex-wrap gap-1">
      {item.biddingClosed && (
        <span className="flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[0.6rem] font-bold uppercase text-white backdrop-blur-sm">
          {ts("sold")}
        </span>
      )}
      {item.biddingPaused && !item.biddingClosed && (
        <span className="flex items-center gap-1 rounded-full bg-blue-500/90 px-2 py-0.5 text-[0.6rem] font-bold uppercase text-white backdrop-blur-sm">
          {ts("dealInProgress")}
        </span>
      )}
      {ended && !item.biddingPaused && !item.biddingClosed && (
        <span className="flex items-center gap-1 rounded-full bg-red-500/90 px-2 py-0.5 text-[0.6rem] font-bold uppercase text-white backdrop-blur-sm">
          <AlertCircle className="size-3" />
          {ts("auctionEnded")}
        </span>
      )}
      {!ended && endingSoon && !item.biddingPaused && !item.biddingClosed && (
        <span className="flex items-center gap-1 rounded-full bg-yellow-500/90 px-2 py-0.5 text-[0.6rem] font-bold uppercase text-black backdrop-blur-sm">
          <Clock className="size-3" />
          {ts("endingSoon")}
        </span>
      )}
      {hasBids && !ended && !item.biddingPaused && !item.biddingClosed && (
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
  item, t, ts, onEdit, onViewBids, onImageClick, reorderMode, index, total, onMoveLeft, onMoveRight,
}: {
  item: ItemResponse;
  t: (key: string, values?: Record<string, string | number>) => string;
  ts: (key: string, values?: Record<string, string | number>) => string;
  onEdit: (item: ItemResponse) => void;
  onViewBids?: (item: ItemResponse) => void;
  onImageClick?: (item: ItemResponse) => void;
  reorderMode?: boolean;
  index?: number;
  total?: number;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
}) {
  const ended = isEnded(item.endDate);
  const primaryImage = item.images.find((img) => img.isPrimary) ?? item.images[0];
  const isFirst = (index ?? 0) === 0;
  const isLast = (index ?? 0) === (total ?? 1) - 1;

  return (
    <div className={`relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-border/80 ${ended ? "opacity-60 hover:opacity-80" : ""}`}>
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
        {item.endDate && !isEnded(item.endDate) && <EndDatePill end={item.endDate} t={t} />}
        <ActivityBadges item={item} ts={ts} />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <span className="line-clamp-2 text-sm font-semibold leading-tight">{item.title}</span>
        <PriceDisplay price={item.price} acceptOffers={item.acceptOffers} minOfferPrice={item.minOfferPrice} offerStep={item.offerStep} endDate={item.endDate} t={t} bidCount={item.bidCount} highestBid={item.highestBid} hideEndedStatus />
      </div>
      {reorderMode ? (
        <div className="flex items-center justify-between bg-black/50 px-2 py-1.5">
          <button
            type="button"
            onClick={onMoveLeft}
            disabled={isFirst}
            className={`flex size-8 items-center justify-center rounded text-white transition-colors ${isFirst ? "opacity-30 pointer-events-none" : "hover:bg-white/20 active:bg-white/30"}`}
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-xs font-medium text-white/70">{(index ?? 0) + 1} / {total}</span>
          <button
            type="button"
            onClick={onMoveRight}
            disabled={isLast}
            className={`flex size-8 items-center justify-center rounded text-white transition-colors ${isLast ? "opacity-30 pointer-events-none" : "hover:bg-white/20 active:bg-white/30"}`}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      ) : (
        <>
          <hr className="mx-3 border-border" />
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex min-w-0 items-center gap-2 truncate">
              <span className="truncate text-xs text-muted-foreground">{t("listed")} {timeAgo(item.createdAt, t)}</span>
              <VisibilityLabel visibility={item.visibility} t={t} />
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {item.acceptOffers && onViewBids && (
                <button onClick={() => onViewBids(item)} className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title={t("viewBids")}>
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

// === Appearance Panel ===

interface ImageControlConfig {
  label: string;
  hint: string;
  url: string | null;
  uploadCta: string;
  removeCta: string;
  noImage: string;
  cropAspect?: number;
  cropTitle?: string;
  onUpload: (file: File) => Promise<string | null>;
  onDelete: () => Promise<void>;
}

function AppearanceImageControl({ config }: { config: ImageControlConfig }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (config.cropAspect) {
      const reader = new FileReader();
      reader.onload = () => setCropSrc(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      void doUpload(file);
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const doUpload = async (file: File) => {
    setBusy(true);
    setError("");
    try {
      await config.onUpload(file);
    } catch {
      setError("error");
    } finally {
      setBusy(false);
    }
  };

  const handleCropped = async (blob: Blob) => {
    setCropSrc(null);
    const file = new File([blob], "image.webp", { type: "image/webp" });
    await doUpload(file);
  };

  const handleDelete = async () => {
    setBusy(true);
    setError("");
    try {
      await config.onDelete();
    } catch {
      setError("error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background/40 p-3">
      <div>
        <p className="text-sm font-medium">{config.label}</p>
        <p className="text-xs text-muted-foreground">{config.hint}</p>
      </div>
      <div className="relative aspect-[5/2] w-full overflow-hidden rounded-md bg-muted/50">
        {config.url ? (
          <img src={config.url} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            {config.noImage}
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <Loader2 className="size-5 animate-spin" />
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFile}
        className="hidden"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          <Upload className="size-3.5 mr-1" />
          {config.uploadCta}
        </Button>
        {config.url && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleDelete}
            disabled={busy}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="size-3.5 mr-1" />
            {config.removeCta}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {cropSrc && config.cropAspect && (
        <ImageCropDialog
          open
          imageSrc={cropSrc}
          aspectRatio={config.cropAspect}
          title={config.cropTitle}
          onCrop={handleCropped}
          onClose={() => setCropSrc(null)}
        />
      )}
    </div>
  );
}

function AppearanceAccentControl({
  value,
  onSave,
  ta,
  ts,
}: {
  value: string | null;
  onSave: (color: string | null) => Promise<void>;
  ta: (key: string) => string;
  ts: (key: string) => string;
}) {
  const initial = value ?? "#3b82f6";
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setDraft(value ?? "#3b82f6");
  }, [value]);

  const dirty = (value ?? "") !== draft && draft.length > 0;

  const commit = async (color: string | null) => {
    setBusy(true);
    try {
      await onSave(color);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background/40 p-3 sm:col-span-3">
      <div className="flex items-center gap-2">
        <Palette className="size-4 text-muted-foreground" />
        <p className="text-sm font-medium">{ts("accentColor")}</p>
      </div>
      <p className="text-xs text-muted-foreground">{ta("accentHint")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="color"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label={ts("accentColor")}
          className="size-9 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
        />
        <span className="font-mono text-xs text-muted-foreground">{draft.toUpperCase()}</span>
        <div className="flex-1" />
        {dirty && (
          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={() => commit(draft)}
            disabled={busy}
          >
            {busy && <Loader2 className="size-3.5 mr-1 animate-spin" />}
            {ts("save")}
          </Button>
        )}
        {value && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => commit(null)}
            disabled={busy}
          >
            {ts("clearColor")}
          </Button>
        )}
      </div>
    </div>
  );
}

// === Main Page ===

export default function StallItemsPage() {
  const t = useTranslations("items");
  const ts = useTranslations("stalls");
  const ta = useTranslations("stalls.appearance");
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

  // Stall edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);


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

  // Reorder handling (arrow-based swap)
  const moveItem = async (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= items.length) return;

    const reordered = [...items];
    [reordered[fromIndex], reordered[toIndex]] = [reordered[toIndex], reordered[fromIndex]];
    setItems(reordered);

    // Save to backend
    setReorderSaving(true);
    try {
      await reorderItems(stallId, reordered.map((i) => i.id));
    } catch {
      loadData();
    } finally {
      setReorderSaving(false);
    }
  };

  // Filter logic (client-side)
  const filteredItems = activeFilter === "attention"
    ? items.filter(isItemEnded)
    : items;

  const endedCount = items.filter(isItemEnded).length;

  // Appearance handlers — keep upload/delete logic local; persist by mutating stall state
  const handleThumbnailUpload = async (file: File) => {
    const result = await uploadStallThumbnail(stallId, file);
    setStall((prev) => prev ? { ...prev, thumbnailUrl: result.thumbnailUrl } : prev);
    return result.thumbnailUrl;
  };
  const handleThumbnailDelete = async () => {
    await deleteStallThumbnail(stallId);
    setStall((prev) => prev ? { ...prev, thumbnailUrl: null } : prev);
  };
  const handleHeaderUpload = async (file: File) => {
    const result = await uploadStallHeader(stallId, file);
    setStall((prev) => prev ? { ...prev, headerImageUrl: result.headerImageUrl } : prev);
    return result.headerImageUrl;
  };
  const handleHeaderDelete = async () => {
    await deleteStallHeader(stallId);
    setStall((prev) => prev ? { ...prev, headerImageUrl: null } : prev);
  };
  const handleBackgroundUpload = async (file: File) => {
    const result = await uploadStallBackground(stallId, file);
    setStall((prev) => prev ? { ...prev, backgroundImageUrl: result.backgroundImageUrl } : prev);
    return result.backgroundImageUrl;
  };
  const handleBackgroundDelete = async () => {
    await deleteStallBackground(stallId);
    setStall((prev) => prev ? { ...prev, backgroundImageUrl: null } : prev);
  };
  const handleAccentSave = async (color: string | null) => {
    const updated = await updateStall(stallId, { accentColor: color ?? "" });
    setStall(updated);
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
    <div className="relative min-h-screen">
      {/* Background image — fills entire page content area */}
      {stall?.backgroundImageUrl && (
        <div
          className="absolute inset-0 rounded-xl overflow-hidden"
          style={{ backgroundImage: `url(${stall.backgroundImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }}
        >
          <div className="absolute inset-0 bg-background/85" />
        </div>
      )}

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
          <div className="flex items-center gap-3 mb-2">
            {stall.thumbnailUrl && (
              <img
                src={stall.thumbnailUrl}
                alt=""
                className="size-12 rounded-lg object-cover shrink-0 ring-1 ring-border"
              />
            )}
            <h1 className="text-2xl font-bold flex-1 min-w-0">{stall.name}</h1>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditDialogOpen(true)}
              className="shrink-0"
            >
              <Pencil className="size-4 mr-1" />
              {ts("editStall")}
            </Button>
          </div>
          <StallDescription description={stall.description} ts={ts} />
          <div className="mt-2">
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {ts("itemCountInStall", { count: totalCount })}
            </span>
          </div>
        </div>
      )}

      {/* Appearance panel */}
      {stall && (
        <section
          aria-labelledby="appearance-heading"
          className="mb-6 rounded-xl border border-border/70 bg-card/50 p-4 backdrop-blur-sm"
        >
          <h2
            id="appearance-heading"
            className="mb-3 text-sm font-semibold"
          >
            {ta("title")}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <AppearanceImageControl
              config={{
                label: ts("thumbnail"),
                hint: ta("thumbnailHint"),
                url: stall.thumbnailUrl,
                uploadCta: ta("uploadCta"),
                removeCta: ta("removeCta"),
                noImage: ta("noImage"),
                cropAspect: 5 / 2,
                cropTitle: ts("cropImage"),
                onUpload: handleThumbnailUpload,
                onDelete: handleThumbnailDelete,
              }}
            />
            <AppearanceImageControl
              config={{
                label: ts("headerImage"),
                hint: ta("headerHint"),
                url: stall.headerImageUrl,
                uploadCta: ta("uploadCta"),
                removeCta: ta("removeCta"),
                noImage: ta("noImage"),
                onUpload: handleHeaderUpload,
                onDelete: handleHeaderDelete,
              }}
            />
            <AppearanceImageControl
              config={{
                label: ts("backgroundImage"),
                hint: ta("backgroundHint"),
                url: stall.backgroundImageUrl,
                uploadCta: ta("uploadCta"),
                removeCta: ta("removeCta"),
                noImage: ta("noImage"),
                onUpload: handleBackgroundUpload,
                onDelete: handleBackgroundDelete,
              }}
            />
            <AppearanceAccentControl
              value={stall.accentColor}
              onSave={handleAccentSave}
              ta={ta}
              ts={ts}
            />
          </div>
        </section>
      )}

      {/* Filter pills + reorder */}
      {items.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className={`flex items-center gap-1.5 ${reorderMode ? "opacity-50 pointer-events-none" : ""}`}>
            <button
              onClick={() => setActiveFilter("all")}
              disabled={reorderMode}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                activeFilter === "all"
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {ts("filterAll")} ({items.length})
            </button>
            {endedCount > 0 && (
              <button
                onClick={() => { setActiveFilter("attention"); setReorderMode(false); }}
                disabled={reorderMode}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  activeFilter === "attention"
                    ? "bg-red-500 text-white"
                    : "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                }`}
              >
                <Clock className="mr-1 inline size-3" />
                {ts("filterEnded")} ({endedCount})
              </button>
            )}
          </div>

          <div className="flex-1" />

          {/* Add item button */}
          <Button onClick={handleAdd} size="sm" className="h-8 text-xs">
            <Plus className="size-3.5 mr-1" />
            {t("addItem")}
          </Button>

          {/* Reorder button — only when "All" filter is active */}
          {activeFilter === "all" && (
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
                <ArrowLeftRight className="size-3.5 mr-1" />
              )}
              {reorderMode ? ts("reorderDone") : ts("reorderItems")}
            </Button>
          )}
        </div>
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
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {filteredItems.map((item, index) => (
            <ItemCard
              key={item.id}
              item={item}
              t={t}
              ts={ts}
              onEdit={handleEdit}
              onViewBids={(item) => setBidsItem(item)}
              onImageClick={(item) => setLightboxItem(item)}
              reorderMode={true}
              index={index}
              total={filteredItems.length}
              onMoveLeft={() => moveItem(index, index - 1)}
              onMoveRight={() => moveItem(index, index + 1)}
            />
          ))}
        </div>
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

      {/* Offers popup */}
      {bidsItem && (
        <OffersPopup
          itemId={bidsItem.id}
          itemTitle={bidsItem.title}
          itemImages={bidsItem.images}
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

      {/* Stall edit dialog */}
      {stall && (
        <StallFormDialog
          mode="edit"
          stall={stall}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSaved={(updated) => {
            setEditDialogOpen(false);
            setStall(updated);
          }}
          onDeleted={() => router.push("/my-stalls?view=all")}
        />
      )}
    </div>
    </div>
  );
}
