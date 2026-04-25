"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { fetchPublicItems } from "@/lib/items";
import type { PublicItemCard as PublicItemCardType } from "@/lib/items";
import { CategoryChips } from "@/components/category-chips";
import { PublicItemCard } from "@/components/public-item-card";
import { ItemCardSkeleton } from "@/components/item-card-shared";
import { Package, Loader2 } from "lucide-react";

const PAGE_SIZE = 20;

export default function HomeFeedPage() {
  const t = useTranslations("feed");

  const [items, setItems] = useState<PublicItemCardType[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);

  // Generation counter to prevent stale responses
  const genRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Fetch items for a given page
  const loadPage = useCallback(
    async (pageNum: number, cat: number | null, gen: number, append: boolean) => {
      try {
        const data = await fetchPublicItems(pageNum, PAGE_SIZE, cat);

        // Ignore stale responses
        if (gen !== genRef.current) return;

        if (append) {
          setItems((prev) => [...prev, ...data.items]);
        } else {
          setItems(data.items);
        }

        setHasMore(data.items.length + (append ? items.length : 0) < data.totalCount);
        setError("");
      } catch {
        if (gen === genRef.current) {
          setError(t("errorLoadFailed"));
        }
      } finally {
        if (gen === genRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [t]
  );

  // Initial load + category change
  useEffect(() => {
    const gen = ++genRef.current;
    setItems([]);
    setPage(1);
    setHasMore(true);
    setLoading(true);
    setError("");
    loadPage(1, categoryId, gen, false);
  }, [categoryId, loadPage]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (!sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          const nextPage = page + 1;
          setPage(nextPage);
          setLoadingMore(true);
          const gen = genRef.current;
          loadPage(nextPage, categoryId, gen, true);
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, page, categoryId, loadPage]);

  const handleCategoryChange = (id: number | null) => {
    setCategoryId(id);
  };

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 md:px-6 md:py-8">
      {/* Category chips */}
      <CategoryChips selected={categoryId} onChange={handleCategoryChange} />

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ItemCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && items.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <Package className="size-16 text-muted-foreground/50" />
          <h2 className="text-xl font-semibold">
            {categoryId ? t("noItemsInCategory") : t("noItems")}
          </h2>
          <p className="max-w-xs text-sm text-muted-foreground">
            {t("noItemsDescription")}
          </p>
        </div>
      )}

      {/* Items grid */}
      {!loading && items.length > 0 && (
        <>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
            {items.map((item) => (
              <PublicItemCard key={item.id} item={item} />
            ))}
          </div>

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="mt-4 flex items-center justify-center py-4">
            {loadingMore && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {t("loadingMore")}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
