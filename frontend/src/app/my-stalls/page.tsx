"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import {
  fetchMyStalls,
  createStall,
  uploadStallThumbnail,
  deleteStallThumbnail,
  type StallResponse,
  type StallListResponse,
} from "@/lib/stalls";
import { Card, CardContent } from "@/components/ui/card";
import { ImageCropDialog } from "@/components/image-crop-dialog";
import { ItemGallery } from "@/components/item-gallery";
import { ItemDetailModal } from "@/components/item-detail-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Store,
  Plus,
  Upload,
  Trash2,
  Loader2,
  Package,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

export default function MyStallsPage() {
  const t = useTranslations("stalls");
  const router = useRouter();
  const searchParams = useSearchParams();
  const skipRedirect = searchParams.get("view") === "all";
  const { isLoggedIn, isLoading: authLoading } = useAuth();

  const [data, setData] = useState<StallListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create stall form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    loadStalls();
  }, [authLoading, isLoggedIn, router]);

  async function loadStalls() {
    setLoading(true);
    setError("");
    try {
      const result = await fetchMyStalls();

      // Auto-redirect: if user has exactly 1 stall, go directly to it
      // (unless they explicitly navigated here via back link with ?view=all)
      if (result.stalls.length === 1 && !skipRedirect) {
        router.replace(`/my-stalls/${result.stalls[0].id}`);
        return;
      }

      setData(result);
    } catch {
      setError(t("errorLoadFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    const name = newName.trim();
    if (name.length < 3) {
      setCreateError(t("errorNameLength"));
      return;
    }

    setCreating(true);
    setCreateError("");
    try {
      await createStall({ name });
      setNewName("");
      setShowCreate(false);
      await loadStalls();
    } catch (err: unknown) {
      const e = err as Error;
      setCreateError(e.message === "NAME_LENGTH" ? t("errorNameLength") : t("errorCreateFailed"));
    } finally {
      setCreating(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={loadStalls}>
          <RefreshCw className="size-4 mr-1" />
          {t("retry")}
        </Button>
      </div>
    );
  }

  const stalls = data?.stalls ?? [];
  const totalItems = data?.totalItemCount ?? 0;
  const maxItems = data?.maxItems ?? 10;

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 md:px-6 md:py-8">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          {t("totalItems", { count: totalItems, max: maxItems })}
        </span>
        <div className="flex-1" />
        <Button onClick={() => setShowCreate(true)} size="sm">
          <Plus className="size-4 mr-1" />
          {t("createStall")}
        </Button>
      </div>

      {/* Create stall inline form */}
      {showCreate && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">{t("name")}</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t("namePlaceholder")}
                  className="mt-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !creating) handleCreate();
                    if (e.key === "Escape") setShowCreate(false);
                  }}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={handleCreate} disabled={creating} size="sm">
                  {creating && <Loader2 className="size-4 mr-1 animate-spin" />}
                  {t("create")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setShowCreate(false); setCreateError(""); }}
                >
                  {t("cancel")}
                </Button>
              </div>
            </div>
            {createError && (
              <p className="text-destructive text-sm mt-2">{createError}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {stalls.length === 0 && !showCreate && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-muted mb-4">
            <Store className="size-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold mb-2">{t("emptyTitle")}</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            {t("emptyDescription")}
          </p>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="size-4 mr-1" />
            {t("createFirst")}
          </Button>
        </div>
      )}

      {/* Stall list */}
      {stalls.length > 0 && (
        <div className="flex flex-col gap-4">
          {stalls.map((stall) => (
            <StallCard
              key={stall.id}
              stall={stall}
              onClick={() => router.push(`/my-stalls/${stall.id}`)}
              onThumbnailUpdated={(stallId, url) => {
                setData((prev) =>
                  prev
                    ? {
                        ...prev,
                        stalls: prev.stalls.map((s) =>
                          s.id === stallId ? { ...s, thumbnailUrl: url } : s
                        ),
                      }
                    : prev
                );
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StallCard({
  stall,
  onClick,
  onThumbnailUpdated,
}: {
  stall: StallResponse;
  onClick: () => void;
  onThumbnailUpdated: (stallId: string, url: string) => void;
}) {
  const t = useTranslations("stalls");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryInitialUrl, setGalleryInitialUrl] = useState<string | null>(null);
  const [viewItemId, setViewItemId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const busy = uploading || deleting;
  const displayUrl = previewUrl ?? stall.thumbnailUrl;

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleCroppedUpload(blob: Blob) {
    // Optimistic preview — show cropped image immediately
    const localUrl = URL.createObjectURL(blob);
    setPreviewUrl(localUrl);
    setCropSrc(null);
    setUploading(true);
    try {
      const file = new File([blob], "thumbnail.webp", { type: "image/webp" });
      const result = await uploadStallThumbnail(stall.id, file);
      onThumbnailUpdated(stall.id, result.thumbnailUrl);
    } catch {
      // Revert preview on failure
      setPreviewUrl(null);
    } finally {
      setUploading(false);
      setPreviewUrl(null);
      URL.revokeObjectURL(localUrl);
    }
  }

  function handleUploadClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (busy) return;
    fileRef.current?.click();
  }

  async function handleDeleteThumbnail(e: React.MouseEvent) {
    e.stopPropagation();
    if (busy) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteStallThumbnail(stall.id);
      onThumbnailUpdated(stall.id, "");
    } catch {
      setDeleteError(t("thumbnailDeleteFailed"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Card
        className="group relative cursor-pointer overflow-hidden transition-all hover:border-primary/30 hover:shadow-md"
        onClick={onClick}
      >
        {/* Stall background image — subtle texture behind content */}
        {stall.backgroundImageUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${stall.backgroundImageUrl})` }}
          >
            <div className="absolute inset-0 bg-background/90" />
          </div>
        )}

        {/* Full-width thumbnail image — wide aspect ratio for max item visibility */}
        <div
          className="group/thumb relative z-[1] aspect-[5/2] overflow-hidden bg-muted flex items-center justify-center"
          style={
            stall.accentColor && !displayUrl
              ? { background: `linear-gradient(135deg, ${stall.accentColor}40, ${stall.accentColor}10)` }
              : undefined
          }
        >
          {displayUrl ? (
            <img
              src={displayUrl}
              alt={stall.name}
              className={`size-full object-cover transition-all duration-300 ${
                busy ? "scale-[1.02] blur-[2px] brightness-75" : "group-hover:scale-105"
              }`}
            />
          ) : (
            <div className={`flex flex-col items-center gap-2 text-muted-foreground/40 ${deleting ? "animate-pulse" : ""}`}>
              <Store className="size-12" />
              <span className="text-xs">{t("addThumbnailHint")}</span>
            </div>
          )}

          {/* Loading overlay */}
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-center gap-2 rounded-full bg-background/80 backdrop-blur-sm px-4 py-2 shadow-lg">
                <Loader2 className="size-4 animate-spin" />
                <span className="text-sm font-medium">
                  {uploading ? t("uploading") : t("removing")}
                </span>
              </div>
            </div>
          )}

          {/* Upload trigger */}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileSelect}
            onClick={(e) => e.stopPropagation()}
            className="hidden"
          />
          {!busy && (
            <div className="absolute top-2 left-2 flex items-center gap-1.5 md:opacity-0 md:group-hover/thumb:opacity-100 transition-opacity">
              <div
                onClick={handleUploadClick}
                className="flex items-center gap-1.5 rounded-lg bg-background/70 backdrop-blur-sm px-2.5 py-1.5 text-xs hover:bg-background/90 transition-colors cursor-pointer"
              >
                <Upload className="size-3.5" />
                <span>{t("changeThumbnail")}</span>
              </div>
              {stall.thumbnailUrl && (
                <div
                  onClick={handleDeleteThumbnail}
                  title={t("deleteThumbnail")}
                  className="flex items-center gap-1.5 rounded-lg bg-background/70 backdrop-blur-sm px-2.5 py-1.5 text-xs hover:bg-destructive/90 hover:text-white transition-colors cursor-pointer"
                >
                  <Trash2 className="size-3.5" />
                  <span>{t("deleteThumbnail")}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Content bar below image */}
        <CardContent className="relative z-[1] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0">
                <h3 className="font-semibold truncate text-lg">{stall.name}</h3>
                {stall.description && (
                  <p className="text-sm text-muted-foreground truncate">
                    {stall.description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Package className="size-3.5" />
                {t("itemCount", { count: stall.itemCount })}
              </span>
              <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>

          {/* Item preview thumbnails */}
          {stall.previewImageUrls.length > 0 && (
            <div className="flex items-center gap-2 mt-2.5">
              {stall.previewImageUrls.map((url, i) => (
                <button
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    setGalleryInitialUrl(url);
                    setGalleryOpen(true);
                  }}
                  className="size-10 rounded-md overflow-hidden bg-muted shrink-0 ring-1 ring-border hover:ring-2 hover:ring-primary/50 transition-all"
                >
                  <img
                    src={url}
                    alt=""
                    className="size-full object-cover"
                    draggable={false}
                  />
                </button>
              ))}
              {stall.itemCount > stall.previewImageUrls.length && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setGalleryInitialUrl(null);
                    setGalleryOpen(true);
                  }}
                  className="h-10 min-w-10 px-2 rounded-md bg-muted ring-1 ring-border flex items-center justify-center text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors shrink-0"
                >
                  {t("moreItems", { count: stall.itemCount - stall.previewImageUrls.length })}
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Crop dialog */}
      {cropSrc && (
        <ImageCropDialog
          open
          imageSrc={cropSrc}
          aspectRatio={5 / 2}
          title={t("cropImage")}
          onCrop={handleCroppedUpload}
          onClose={() => setCropSrc(null)}
        />
      )}

      {/* Delete error toast */}
      {deleteError && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-destructive px-4 py-2 text-sm text-white shadow-lg animate-in fade-in slide-in-from-bottom-2"
          onClick={() => setDeleteError("")}
        >
          {deleteError}
        </div>
      )}

      {/* Item gallery lightbox */}
      <ItemGallery
        open={galleryOpen}
        stallId={stall.id}
        initialImageUrl={galleryInitialUrl}
        onClose={() => setGalleryOpen(false)}
        onViewItem={(itemId) => setViewItemId(itemId)}
        paused={!!viewItemId}
      />

      {/* Item detail popup — rendered outside gallery to avoid event conflicts */}
      {viewItemId && (
        <ItemDetailModal
          itemId={viewItemId}
          onClose={() => setViewItemId(null)}
        />
      )}
    </>
  );
}
