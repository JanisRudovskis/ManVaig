"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import {
  fetchMyStalls,
  createStall,
  uploadStallThumbnail,
  type StallResponse,
  type StallListResponse,
} from "@/lib/stalls";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Store,
  Plus,
  Pencil,
  Upload,
  Loader2 as Loader2Icon,
  Loader2,
  Package,
  ImageIcon,
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
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  const stalls = data?.stalls ?? [];
  const totalItems = data?.totalItemCount ?? 0;
  const maxItems = data?.maxItems ?? 10;

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 md:px-6 md:py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            {t("totalItems", { count: totalItems, max: maxItems })}
          </span>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm">
          <Plus className="size-4 mr-1" />
          {t("createStall")}
        </Button>
      </div>

      {/* Create stall inline form */}
      {showCreate && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
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

      {/* Stall grid */}
      {stalls.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
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

  async function handleThumbUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadStallThumbnail(stall.id, file);
      onThumbnailUpdated(stall.id, result.thumbnailUrl);
    } catch {
      // silent fail
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleUploadClick(e: React.MouseEvent) {
    e.stopPropagation(); // Don't navigate to stall
    fileRef.current?.click();
  }

  return (
    <Card
      className="cursor-pointer overflow-hidden transition-all hover:border-primary/30 hover:shadow-md"
      onClick={onClick}
    >
      {/* Thumbnail image area with upload overlay */}
      <div
        className="group/thumb aspect-[4/3] relative flex items-center justify-center bg-muted"
        style={
          stall.accentColor && !stall.thumbnailUrl
            ? { background: `linear-gradient(135deg, ${stall.accentColor}40, ${stall.accentColor}10)` }
            : undefined
        }
      >
        {stall.thumbnailUrl ? (
          <img
            src={stall.thumbnailUrl}
            alt={stall.name}
            className="size-full object-contain"
          />
        ) : !stall.accentColor ? (
          <Store className="size-10 text-muted-foreground/30" />
        ) : null}

        {/* Upload overlay */}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(e) => { e.stopPropagation(); handleThumbUpload(e); }}
          onClick={(e) => e.stopPropagation()}
          className="hidden"
        />
        <div
          onClick={handleUploadClick}
          className="absolute top-2 left-2 md:opacity-0 md:group-hover/thumb:opacity-100 transition-opacity"
        >
          <div className="flex items-center gap-1.5 rounded-lg bg-background/70 backdrop-blur-sm px-2.5 py-1.5 text-xs hover:bg-background/90 transition-colors cursor-pointer">
            {uploading ? <Loader2Icon className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            <span>{t("changeThumbnail")}</span>
          </div>
        </div>

        {/* Item count badge */}
        <span className="absolute bottom-2 right-2 rounded-full bg-background/80 backdrop-blur-sm px-2.5 py-0.5 text-xs font-medium">
          <Package className="size-3 inline mr-1" />
          {t("itemCount", { count: stall.itemCount })}
        </span>
      </div>

      <CardContent className="p-4">
        {/* Name + edit */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold truncate">{stall.name}</h3>
            {stall.description && (
              <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                {stall.description}
              </p>
            )}
          </div>
          <Pencil className="size-4 shrink-0 text-muted-foreground mt-1" />
        </div>

        {/* Preview thumbnails */}
        {stall.previewImageUrls.length > 0 && (
          <div className="flex gap-1.5 mt-3">
            {stall.previewImageUrls.slice(0, 4).map((url, i) => (
              <div
                key={i}
                className="size-10 rounded-md bg-muted overflow-hidden"
              >
                <img
                  src={url}
                  alt=""
                  className="size-full object-cover"
                />
              </div>
            ))}
            {stall.itemCount > stall.previewImageUrls.length && (
              <div className="size-10 rounded-md bg-muted flex items-center justify-center">
                <span className="text-xs text-muted-foreground">
                  +{stall.itemCount - stall.previewImageUrls.length}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Empty stall indicator */}
        {stall.itemCount === 0 && (
          <div className="flex items-center gap-2 mt-3 text-muted-foreground">
            <ImageIcon className="size-4" />
            <span className="text-xs">{t("noItemsYet")}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
