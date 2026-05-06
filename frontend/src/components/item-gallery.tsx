"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { fetchMyItems, type ItemResponse } from "@/lib/items";
import { X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

interface ItemGalleryProps {
  open: boolean;
  stallId: string;
  /** URL of the preview thumbnail that was clicked — used to scroll to the matching item */
  initialImageUrl?: string | null;
  onClose: () => void;
  /** Called when user taps an item to view its details */
  onViewItem?: (itemId: string) => void;
  /** Pause keyboard/swipe when another modal is on top */
  paused?: boolean;
}

/** Simple TTL cache to avoid re-fetching on repeated opens */
const itemsCache = new Map<
  string,
  { items: ItemResponse[]; timestamp: number }
>();
const CACHE_TTL = 30_000; // 30 seconds

function getCachedItems(stallId: string): ItemResponse[] | null {
  const entry = itemsCache.get(stallId);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    itemsCache.delete(stallId);
    return null;
  }
  return entry.items;
}

export function ItemGallery({
  open,
  stallId,
  initialImageUrl,
  onClose,
  onViewItem,
  paused = false,
}: ItemGalleryProps) {
  const t = useTranslations("stalls");
  const [items, setItems] = useState<ItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  // Swipe state
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const dragRef = useRef(0); // Accurate delta for touchEnd

  // Fade-in on open
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [open]);

  // Fetch items (with cache)
  useEffect(() => {
    if (!open) return;
    setCurrentIndex(0);

    function applyInitialIndex(list: ItemResponse[]) {
      if (initialImageUrl) {
        const matchIndex = list.findIndex((item) =>
          item.images.some((img) => img.url === initialImageUrl)
        );
        if (matchIndex >= 0) setCurrentIndex(matchIndex);
      }
    }

    const cached = getCachedItems(stallId);
    if (cached) {
      setItems(cached);
      setLoading(false);
      applyInitialIndex(cached);
      return;
    }

    setLoading(true);
    fetchMyItems(1, 50, stallId)
      .then((res) => {
        setItems(res.items);
        itemsCache.set(stallId, {
          items: res.items,
          timestamp: Date.now(),
        });
        applyInitialIndex(res.items);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [open, stallId, initialImageUrl]);

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= items.length) return;
      setCurrentIndex(index);
    },
    [items.length]
  );

  // Keyboard navigation — disabled when detail modal is open
  useEffect(() => {
    if (!open || paused) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goTo(currentIndex - 1);
      if (e.key === "ArrowRight") goTo(currentIndex + 1);
      if (e.key === "Enter" && onViewItem && items[currentIndex]) {
        onViewItem(items[currentIndex].id);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, paused, currentIndex, onClose, goTo, onViewItem, items]);

  // Lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  // Touch handlers with visual drag feedback
  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setIsDragging(true);
    setDragOffset(0);
    dragRef.current = 0;
  }

  function handleTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    // Ignore mostly-vertical gestures
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dx) < 15) return;
    dragRef.current = dx;
    setDragOffset(dx);
  }

  function handleTouchEnd() {
    const dx = dragRef.current;
    setIsDragging(false);
    setDragOffset(0);
    dragRef.current = 0;
    if (Math.abs(dx) > 50) {
      if (dx > 0) goTo(currentIndex - 1);
      else goTo(currentIndex + 1);
    }
  }

  if (!open) return null;

  const currentItem = items[currentIndex];
  const price = currentItem ? formatPrice(currentItem) : "";

  // Lazy rendering: only mount current ± 1 slides
  const renderSet = new Set<number>();
  for (
    let i = Math.max(0, currentIndex - 1);
    i <= Math.min(items.length - 1, currentIndex + 1);
    i++
  ) {
    renderSet.add(i);
  }

  return (
    <div
      className={`fixed inset-0 z-50 bg-black/95 flex flex-col select-none transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      onClick={onClose}
    >
      {/* Top bar — counter + close */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-sm font-medium text-white/80">
          {!loading &&
            items.length > 0 &&
            t("galleryCounter", {
              current: currentIndex + 1,
              total: items.length,
            })}
        </span>
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/80 hover:text-white"
        >
          <X className="size-5" />
          <span className="sr-only">{t("galleryClose")}</span>
        </button>
      </div>

      {/* Main content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-8 animate-spin text-white/50" />
            <span className="text-sm text-white/50">
              {t("galleryLoading")}
            </span>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-white/50">{t("noItemsYet")}</p>
        </div>
      ) : (
        <>
          {/* Image carousel */}
          <div
            className="flex-1 min-h-0 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div
              className={`flex h-full ease-out ${
                isDragging ? "" : "transition-transform duration-300"
              }`}
              style={{
                transform: `translateX(calc(${-currentIndex * 100}% + ${dragOffset}px))`,
              }}
            >
              {items.map((item, i) => {
                const shouldRender = renderSet.has(i);
                const img =
                  item.images.find((im) => im.isPrimary) ?? item.images[0];
                return (
                  <div
                    key={item.id}
                    className="shrink-0 w-full h-full flex items-center justify-center p-4"
                  >
                    {shouldRender && img ? (
                      <img
                        src={img.url}
                        alt={item.title}
                        className="max-h-full max-w-full object-contain rounded-lg"
                        draggable={false}
                      />
                    ) : shouldRender ? (
                      <div className="size-32 bg-white/10 rounded-lg flex items-center justify-center text-white/30 text-sm">
                        {t("noItemsYet")}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {/* Desktop arrow navigation */}
            {items.length > 1 && (
              <>
                <button
                  onClick={() => goTo(currentIndex - 1)}
                  disabled={currentIndex === 0}
                  className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 size-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-20 disabled:pointer-events-none"
                >
                  <ChevronLeft className="size-5" />
                  <span className="sr-only">{t("galleryPrev")}</span>
                </button>
                <button
                  onClick={() => goTo(currentIndex + 1)}
                  disabled={currentIndex === items.length - 1}
                  className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 size-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-20 disabled:pointer-events-none"
                >
                  <ChevronRight className="size-5" />
                  <span className="sr-only">{t("galleryNext")}</span>
                </button>
              </>
            )}
          </div>

          {/* Item info bar at bottom */}
          <div
            className="px-4 py-3 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {currentItem && (
              <button
                className="mx-auto block text-center group/info"
                onClick={() => onViewItem?.(currentItem.id)}
              >
                <p className="font-medium text-white truncate group-hover/info:underline">
                  {currentItem.title}
                </p>
                {price && (
                  <p className="text-sm text-white/60 mt-0.5">{price}</p>
                )}
              </button>
            )}

            {/* Dot indicators for mobile (≤10 items) */}
            {items.length > 1 && items.length <= 10 && (
              <div className="flex justify-center gap-1.5 mt-2 md:hidden">
                {items.map((_, i) => (
                  <div
                    key={i}
                    className={`size-1.5 rounded-full transition-colors ${
                      i === currentIndex ? "bg-white" : "bg-white/30"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Format item price for display in the gallery */
function formatPrice(item: ItemResponse): string {
  if (item.price != null) return `€${item.price.toFixed(2)}`;
  if (item.minBidPrice != null) return `€${item.minBidPrice.toFixed(2)}`;
  return "";
}
