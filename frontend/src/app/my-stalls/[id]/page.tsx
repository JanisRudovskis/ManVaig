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
  UploadCloud,
  ArrowLeftRight,
  AlertCircle,
  Clock,
  Gavel,
  Palette,
  Check,
  Undo2,
  X,
} from "lucide-react";
import { ImageCropDialog } from "@/components/image-crop-dialog";

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

  if (!ended && !endingSoon && !hasBids && !item.isSold) return null;

  return (
    <div className="absolute bottom-2 left-2 z-10 flex flex-wrap gap-1">
      {item.isSold && (
        <span className="flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[0.6rem] font-bold uppercase text-white backdrop-blur-sm">
          {ts("sold")}
        </span>
      )}
      {ended && !item.isSold && (
        <span className="flex items-center gap-1 rounded-full bg-red-500/90 px-2 py-0.5 text-[0.6rem] font-bold uppercase text-white backdrop-blur-sm">
          <AlertCircle className="size-3" />
          {ts("auctionEnded")}
        </span>
      )}
      {!ended && endingSoon && !item.isSold && (
        <span className="flex items-center gap-1 rounded-full bg-yellow-500/90 px-2 py-0.5 text-[0.6rem] font-bold uppercase text-black backdrop-blur-sm">
          <Clock className="size-3" />
          {ts("endingSoon")}
        </span>
      )}
      {hasBids && !ended && !item.isSold && (
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

  // Background edit state
  const [bgCropSrc, setBgCropSrc] = useState<string | null>(null);
  const [bgCropFile, setBgCropFile] = useState<File | null>(null);
  const [bgUploading, setBgUploading] = useState(false);
  const [bgError, setBgError] = useState<string | null>(null);
  const [bgUndoPrev, setBgUndoPrev] = useState<string | null | undefined>(undefined); // undefined = no toast
  const [draggingFile, setDraggingFile] = useState(false);
  const [bgPopoverOpen, setBgPopoverOpen] = useState(false);
  const [bgRemoveConfirm, setBgRemoveConfirm] = useState(false);
  const bgFileRef = useRef<HTMLInputElement>(null);

  const tb = useTranslations("stalls.bg");

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

  // Background inline edit helpers
  const validateBgFile = (file: File): boolean => {
    if (!file.type.startsWith("image/")) {
      setBgError(tb("notAnImage"));
      return false;
    }
    if (file.size > 5 * 1024 * 1024) {
      setBgError(tb("fileTooLarge"));
      return false;
    }
    return true;
  };

  const openBgCropper = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setBgCropSrc(reader.result as string);
      setBgCropFile(file);
      setBgPopoverOpen(false);
    };
    reader.readAsDataURL(file);
  };

  const handleBgFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (bgFileRef.current) bgFileRef.current.value = "";
    if (!file) return;
    setBgError(null);
    if (!validateBgFile(file)) return;
    openBgCropper(file);
  };

  const handleBgDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggingFile(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    setBgError(null);
    if (!validateBgFile(file)) return;
    openBgCropper(file);
  };

  const handleBgCropped = async (blob: Blob) => {
    setBgCropSrc(null);
    setBgCropFile(null);
    setBgUploading(true);
    setBgError(null);
    const previousUrl = stall?.backgroundImageUrl ?? null;
    try {
      const file = new File([blob], "background.webp", { type: "image/webp" });
      const result = await uploadStallBackground(stallId, file);
      setStall((prev) => prev ? { ...prev, backgroundImageUrl: result.backgroundImageUrl } : prev);
      setBgUndoPrev(previousUrl);
      // Auto-dismiss undo toast after 5s
      setTimeout(() => setBgUndoPrev(undefined), 5000);
    } catch {
      setBgError(tb("uploadFailed"));
    } finally {
      setBgUploading(false);
    }
  };

  const handleBgRemove = async () => {
    setBgRemoveConfirm(false);
    setBgPopoverOpen(false);
    setBgUploading(true);
    const previousUrl = stall?.backgroundImageUrl ?? null;
    try {
      await deleteStallBackground(stallId);
      setStall((prev) => prev ? { ...prev, backgroundImageUrl: null } : prev);
      setBgUndoPrev(previousUrl);
      setTimeout(() => setBgUndoPrev(undefined), 5000);
    } catch {
      setBgError(tb("uploadFailed"));
    } finally {
      setBgUploading(false);
    }
  };

  const handleBgUndo = async () => {
    if (bgUndoPrev === undefined) return;
    setBgUndoPrev(undefined);
    if (bgUndoPrev) {
      // Restore previous background — re-upload from URL
      try {
        const resp = await fetch(bgUndoPrev);
        const blob = await resp.blob();
        const file = new File([blob], "background-undo.webp", { type: blob.type });
        const result = await uploadStallBackground(stallId, file);
        setStall((prev) => prev ? { ...prev, backgroundImageUrl: result.backgroundImageUrl } : prev);
      } catch {
        // Silently fail undo
      }
    } else {
      // Previous was null — delete the current
      try {
        await deleteStallBackground(stallId);
        setStall((prev) => prev ? { ...prev, backgroundImageUrl: null } : prev);
      } catch {
        // Silently fail
      }
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
    <div
      className="group relative min-h-screen"
      onDragOver={(e) => { e.preventDefault(); setDraggingFile(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) setDraggingFile(false); }}
      onDrop={handleBgDrop}
    >
      {/* Background image layer */}
      <div className="absolute inset-0 overflow-hidden">
        {stall?.backgroundImageUrl ? (
          <>
            <img
              src={stall.backgroundImageUrl}
              alt=""
              className="absolute inset-0 size-full object-cover"
            />
            <div className="absolute inset-0 bg-background/85" />
          </>
        ) : (
          <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,_var(--ticker-bg-2)_0_12px,_var(--ticker-bg)_12px_24px)] opacity-30" />
        )}
      </div>

      {/* Drag-and-drop overlay */}
      {draggingFile && (
        <div className="absolute inset-2 z-30 rounded-xl border-2 border-dashed border-ticker-emer bg-[radial-gradient(circle_at_center,oklch(0.78_0.18_165/0.20)_0%,transparent_70%)] flex items-center justify-center pointer-events-none">
          <div className="inline-flex items-center gap-3.5 bg-black/65 backdrop-blur-md text-white px-5 py-4 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.4),0_0_0_1px_var(--ticker-emer)]">
            <UploadCloud className="size-6 text-ticker-emer" />
            <div>
              <div className="text-sm font-semibold">{tb("dropToSetBackground")}</div>
              <div className="font-mono text-[10.5px] text-white/60 mt-0.5">{tb("dropHint")}</div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input for background */}
      <input
        ref={bgFileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleBgFileChange}
        className="hidden"
      />

      {/* Background uploading overlay */}
      {bgUploading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="inline-flex items-center gap-3 bg-card rounded-xl px-5 py-4 shadow-xl border border-border">
            <Loader2 className="size-5 animate-spin text-ticker-emer" />
            <span className="text-sm font-medium">{ts("saving")}</span>
          </div>
        </div>
      )}

      {/* Background popover (Replace / Remove) */}
      {bgPopoverOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setBgPopoverOpen(false); setBgRemoveConfirm(false); }} />
          <div className="relative z-10 w-full max-w-xs rounded-2xl border border-border bg-card p-4 shadow-2xl mx-4">
            {bgRemoveConfirm ? (
              <>
                <p className="text-sm font-semibold mb-1">{tb("removeConfirmTitle")}</p>
                <p className="text-xs text-muted-foreground mb-4">{tb("removeConfirmBody")}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setBgRemoveConfirm(false)}>
                    {ts("cancel")}
                  </Button>
                  <Button variant="destructive" size="sm" className="flex-1" onClick={handleBgRemove}>
                    <Trash2 className="size-3.5 mr-1" />
                    {tb("removeBackground")}
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* Preview */}
                {stall?.backgroundImageUrl && (
                  <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-border mb-3">
                    <img src={stall.backgroundImageUrl} alt="" className="absolute inset-0 size-full object-cover" />
                  </div>
                )}
                {/* Actions */}
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => { setBgPopoverOpen(false); bgFileRef.current?.click(); }}>
                    <Upload className="size-3.5 mr-1" />
                    {tb("replace")}
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-1 text-destructive hover:text-destructive" onClick={() => setBgRemoveConfirm(true)}>
                    <Trash2 className="size-3.5 mr-1" />
                    {tb("removeBackground")}
                  </Button>
                </div>
                <p className="mt-2 text-center text-[10px] text-muted-foreground">JPG, PNG, WebP · up to 5 MB</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Background crop dialog */}
      {bgCropSrc && (
        <ImageCropDialog
          open
          imageSrc={bgCropSrc}
          aspectRatio={16 / 10}
          title={ts("cropImage")}
          onCrop={handleBgCropped}
          onClose={() => { setBgCropSrc(null); setBgCropFile(null); }}
        />
      )}

      {/* Background error toast */}
      {bgError && (
        <div className="fixed bottom-6 left-6 right-6 md:left-auto md:right-6 md:w-[360px] z-40 flex items-center gap-3 bg-card border border-destructive/30 rounded-xl px-4 py-3 shadow-xl">
          <AlertCircle className="size-5 text-destructive shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-destructive">{bgError}</p>
          </div>
          <button onClick={() => { setBgError(null); bgFileRef.current?.click(); }} className="text-xs font-medium text-primary hover:underline shrink-0">
            {tb("tryAnotherFile")}
          </button>
          <button onClick={() => setBgError(null)} className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Background success + undo toast */}
      {bgUndoPrev !== undefined && (
        <div className="fixed bottom-6 left-6 right-6 md:left-auto md:right-6 md:w-[360px] z-40 flex items-center gap-3 bg-card border border-ticker-emer/30 rounded-xl px-4 py-3 shadow-xl">
          <span className="flex size-8 items-center justify-center rounded-full bg-ticker-emer/15 shrink-0">
            <Check className="size-4 text-ticker-emer" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{tb("backgroundUpdated")}</p>
            <p className="text-xs text-muted-foreground">{tb("liveForVisitors")}</p>
          </div>
          <button
            onClick={handleBgUndo}
            className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted/80 shrink-0"
          >
            <Undo2 className="size-3" />
            {tb("undo")}
          </button>
        </div>
      )}

      <div className="relative z-10 mx-auto max-w-[1100px] px-4 py-4 md:px-6 md:py-6">

      {/* Background edit pill */}
      {stall && (
        <button
          type="button"
          onClick={() => {
            if (stall.backgroundImageUrl) {
              setBgPopoverOpen(true);
            } else {
              bgFileRef.current?.click();
            }
          }}
          className={`absolute top-3 right-4 md:right-6 z-20 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium text-white bg-black/70 backdrop-blur-md shadow-lg transition-opacity duration-200 hover:bg-black/85 ${
            stall.backgroundImageUrl
              ? "opacity-0 group-hover:opacity-100 focus:opacity-100"
              : "opacity-100"
          }`}
        >
          <ImageIcon className="size-3.5 text-ticker-emer" />
          <span>
            {stall.backgroundImageUrl ? tb("changeBackground") : tb("addBackground")}
          </span>
        </button>
      )}

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
            {/* Background image now managed via inline edit pill */}
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
          itemImageUrl={(bidsItem.images.find(i => i.isPrimary) ?? bidsItem.images[0])?.url}
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
