"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { fetchMyItems, PricingType, ItemVisibility } from "@/lib/items";
import type { ItemResponse } from "@/lib/items";
import {
  fetchStall,
  updateStall,
  deleteStall,
  uploadStallThumbnail,
  deleteStallThumbnail,
  uploadStallBackground,
  deleteStallBackground,
  type StallResponse,
} from "@/lib/stalls";
import { ItemForm } from "@/components/item-form";
import { BidsModal } from "@/components/bids-modal";
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
} from "lucide-react";

// === Helpers (same as my-items) ===

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

function ItemCard({
  item, t, onEdit, onViewBids,
}: {
  item: ItemResponse;
  t: (key: string, values?: Record<string, string | number>) => string;
  onEdit: (item: ItemResponse) => void;
  onViewBids?: (item: ItemResponse) => void;
}) {
  const ended = isAuctionEnded(item.auctionEnd, item.pricingType);
  const primaryImage = item.images.find((img) => img.isPrimary) ?? item.images[0];
  return (
    <div className={`relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-border/80 ${ended ? "opacity-60 hover:opacity-80" : ""}`}>
      <TypeTag type={item.pricingType} t={t} />
      <VisibilityTag visibility={item.visibility} t={t} />
      <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted">
        {primaryImage ? (
          <img src={primaryImage.url} alt={item.title} className="size-full object-cover" />
        ) : (
          <ImageIcon className="size-12 text-muted-foreground" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <span className="line-clamp-2 text-sm font-semibold leading-tight">{item.title}</span>
        <PriceDisplay pricingType={item.pricingType} price={item.price} minBidPrice={item.minBidPrice} bidStep={item.bidStep} auctionEnd={item.auctionEnd} t={t} />
      </div>
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
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [editingItem, setEditingItem] = useState<ItemResponse | null>(null);
  const [bidsItem, setBidsItem] = useState<ItemResponse | null>(null);

  // Stall edit state
  const [editingStall, setEditingStall] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAccentColor, setEditAccentColor] = useState("");
  const [savingStall, setSavingStall] = useState(false);
  const [stallError, setStallError] = useState("");
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [stallData, itemsData] = await Promise.all([
        fetchStall(stallId),
        fetchMyItems(1, 100, stallId),
      ]);
      setStall(stallData);
      setItems(itemsData.items);
      setTotalCount(itemsData.totalCount);
    } catch {
      // error handling
    } finally {
      setLoading(false);
    }
  }

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
    setFormMode("add");
    setEditingItem(null);
    setFormOpen(true);
  };

  const handleEdit = (item: ItemResponse) => {
    setFormMode("edit");
    setEditingItem(item);
    setFormOpen(true);
  };

  const handleFormSaved = () => {
    setFormOpen(false);
    setEditingItem(null);
    loadData();
  };

  const startEditingStall = () => {
    if (!stall) return;
    setEditName(stall.name);
    setEditDescription(stall.description ?? "");
    setEditAccentColor(stall.accentColor ?? "");
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
        accentColor: editAccentColor || "",
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
    if (!confirm(ts("deleteConfirm", { count: stall.itemCount }))) return;
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
    }
  };

  const handleThumbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingThumb(true);
    setStallError("");
    try {
      const result = await uploadStallThumbnail(stallId, file);
      setStall((prev) => prev ? { ...prev, thumbnailUrl: result.thumbnailUrl } : prev);
    } catch {
      setStallError(ts("errorImageUpload"));
    } finally {
      setUploadingThumb(false);
      if (thumbInputRef.current) thumbInputRef.current.value = "";
    }
  };

  const handleThumbDelete = async () => {
    setUploadingThumb(true);
    try {
      await deleteStallThumbnail(stallId);
      setStall((prev) => prev ? { ...prev, thumbnailUrl: null } : prev);
    } catch {
      setStallError(ts("errorImageUpload"));
    } finally {
      setUploadingThumb(false);
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
      {/* Breadcrumb */}
      <Link
        href="/my-stalls?view=all"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
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
              <h1 className="text-2xl font-bold mb-1">{stall.name}</h1>
              {stall.description && (
                <p className="text-muted-foreground text-sm mb-2">
                  {stall.description}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                  {ts("itemCountInStall", { count: totalCount })}
                </span>
                <div className="flex-1" />
                <Button onClick={handleAdd} size="sm">
                  <Plus className="size-4 mr-1" />
                  {t("addItem")}
                </Button>
                <Button variant="outline" size="sm" onClick={startEditingStall}>
                  <Pencil className="size-4 mr-1" />
                  {ts("editStall")}
                </Button>
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
              <div>
                <Label className="text-sm">{ts("accentColor")}</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    value={editAccentColor || "#7c6af7"}
                    onChange={(e) => setEditAccentColor(e.target.value)}
                    className="size-8 rounded cursor-pointer border border-border"
                  />
                  {editAccentColor && (
                    <button
                      onClick={() => setEditAccentColor("")}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      {ts("clearColor")}
                    </button>
                  )}
                </div>
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
                  onClick={handleDeleteStall}
                >
                  <Trash2 className="size-4 mr-1" />
                  {ts("deleteStall")}
                </Button>
              </div>
            </div>
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
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              t={t}
              onEdit={handleEdit}
              onViewBids={(item) => setBidsItem(item)}
            />
          ))}
        </div>
      )}
      </div>

      {/* Item form modal */}
      {formOpen && (
        <ItemForm
          mode={formMode}
          item={editingItem ?? undefined}
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
    </div>
    </div>
  );
}
