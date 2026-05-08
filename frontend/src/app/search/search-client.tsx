"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchPublicItems } from "@/lib/items";
import type { PublicItemCard as PublicItemCardType } from "@/lib/items";
import { fetchPublicStalls } from "@/lib/stalls";
import type { PublicStallResponse } from "@/lib/stalls";
import { PublicItemCard } from "@/components/public-item-card";
import { ItemCardSkeleton } from "@/components/item-card-shared";
import {
  PublicStallCard,
  PublicStallCardSkeleton,
} from "@/components/public-stall-card";
import { ItemDetailModal } from "@/components/item-detail-modal";
import { OffersPopup } from "@/components/offers-popup";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

type Tab = "items" | "stalls";

const HINT_KEYS = ["bicycle", "watch", "drill", "ring"] as const;

function parseTab(value: string | null): Tab {
  return value === "stalls" ? "stalls" : "items";
}

export function SearchClient() {
  const t = useTranslations("search");
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTab = parseTab(searchParams.get("tab"));
  const initialQ = searchParams.get("q") ?? "";

  const [tab, setTab] = useState<Tab>(initialTab);
  const [input, setInput] = useState(initialQ);
  const debouncedInput = useDebouncedValue(input, DEBOUNCE_MS);
  const [activeQuery, setActiveQuery] = useState(initialQ);
  const [retryCounter, setRetryCounter] = useState(0);

  const [items, setItems] = useState<PublicItemCardType[]>([]);
  const [stalls, setStalls] = useState<PublicStallResponse[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [offerItem, setOfferItem] = useState<PublicItemCardType | null>(null);

  const genRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const trimmedQuery = activeQuery.trim();
  const queryReady = trimmedQuery.length >= MIN_QUERY_LENGTH;

  const writeUrl = useCallback(
    (nextTab: Tab, nextQ: string) => {
      const params = new URLSearchParams();
      if (nextTab === "stalls") params.set("tab", "stalls");
      const trimmed = nextQ.trim();
      if (trimmed.length >= MIN_QUERY_LENGTH) params.set("q", trimmed);
      const qs = params.toString();
      router.replace(qs ? `/search?${qs}` : "/search", { scroll: false });
    },
    [router]
  );

  // Sync debounced input → active query (drives fetches)
  useEffect(() => {
    setActiveQuery(debouncedInput);
  }, [debouncedInput]);

  // Mirror tab + debounced input to URL
  useEffect(() => {
    writeUrl(tab, debouncedInput);
  }, [tab, debouncedInput, writeUrl]);

  // Reset list whenever tab or active query changes
  useEffect(() => {
    setItems([]);
    setStalls([]);
    setTotalCount(0);
    setPage(1);
    setError("");
  }, [tab, activeQuery]);

  // Fetch first page on tab/query/retry change
  useEffect(() => {
    if (!queryReady) {
      setLoading(false);
      setLoadingMore(false);
      abortRef.current?.abort();
      return;
    }

    const gen = ++genRef.current;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError("");

    (async () => {
      try {
        if (tab === "items") {
          const data = await fetchPublicItems({
            page: 1,
            pageSize: PAGE_SIZE,
            q: trimmedQuery,
            signal: ctrl.signal,
          });
          if (gen !== genRef.current) return;
          setItems(data.items);
          setTotalCount(data.totalCount);
        } else {
          const data = await fetchPublicStalls({
            page: 1,
            pageSize: PAGE_SIZE,
            q: trimmedQuery,
            signal: ctrl.signal,
          });
          if (gen !== genRef.current) return;
          setStalls(data.stalls);
          setTotalCount(data.totalCount);
        }
      } catch (e) {
        if ((e as { name?: string })?.name === "AbortError") return;
        if (gen !== genRef.current) return;
        setError(t("errorLoadFailed"));
      } finally {
        if (gen === genRef.current) setLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [tab, trimmedQuery, queryReady, retryCounter, t]);

  const handleLoadMore = useCallback(async () => {
    if (!queryReady || loadingMore) return;
    const nextPage = page + 1;
    const gen = ++genRef.current;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoadingMore(true);
    try {
      if (tab === "items") {
        const data = await fetchPublicItems({
          page: nextPage,
          pageSize: PAGE_SIZE,
          q: trimmedQuery,
          signal: ctrl.signal,
        });
        if (gen !== genRef.current) return;
        setItems((prev) => [...prev, ...data.items]);
        setTotalCount(data.totalCount);
      } else {
        const data = await fetchPublicStalls({
          page: nextPage,
          pageSize: PAGE_SIZE,
          q: trimmedQuery,
          signal: ctrl.signal,
        });
        if (gen !== genRef.current) return;
        setStalls((prev) => [...prev, ...data.stalls]);
        setTotalCount(data.totalCount);
      }
      setPage(nextPage);
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") return;
      if (gen !== genRef.current) return;
      setError(t("errorLoadFailed"));
    } finally {
      if (gen === genRef.current) setLoadingMore(false);
    }
  }, [queryReady, loadingMore, page, tab, trimmedQuery, t]);

  const fireImmediate = useCallback(
    (value: string) => {
      setInput(value);
      setActiveQuery(value);
      writeUrl(tab, value);
    },
    [tab, writeUrl]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (input.trim().length >= MIN_QUERY_LENGTH) {
          fireImmediate(input);
        }
      }
    },
    [input, fireImmediate]
  );

  const handleClear = useCallback(() => {
    fireImmediate("");
  }, [fireImmediate]);

  const handleTabChange = useCallback((next: Tab) => {
    setTab(next);
  }, []);

  const handleHintClick = useCallback(
    (label: string) => {
      fireImmediate(label);
    },
    [fireImmediate]
  );

  const handleRetry = useCallback(() => {
    setError("");
    setRetryCounter((c) => c + 1);
  }, []);

  const renderedCount = tab === "items" ? items.length : stalls.length;
  const hasMore = renderedCount < totalCount;
  const showInitialEmpty = !queryReady;
  const showResults = queryReady && !loading && !error && renderedCount > 0;
  const showNoResults =
    queryReady && !loading && !error && renderedCount === 0;

  const placeholder =
    tab === "items" ? t("placeholderItems") : t("placeholderStalls");

  const hints = useMemo(
    () => HINT_KEYS.map((k) => ({ key: k, label: t(`hints.${k}`) })),
    [t]
  );

  const segmentedBase =
    "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all min-h-[44px] sm:min-h-0";
  const segmentedActive = "bg-card text-foreground shadow-sm";
  const segmentedInactive = "text-muted-foreground hover:text-foreground";

  return (
    <div className="mx-auto max-w-[600px] px-4 py-6 md:px-6 md:py-8">
      <h1 className="sr-only">{t("title")}</h1>

      {/* Tab toggle */}
      <div
        className="mb-3 flex w-full gap-0 rounded-md bg-muted p-0.5"
        role="tablist"
        aria-label={t("title")}
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "items"}
          onClick={() => handleTabChange("items")}
          className={`${segmentedBase} ${
            tab === "items" ? segmentedActive : segmentedInactive
          }`}
        >
          {t("tabs.items")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "stalls"}
          onClick={() => handleTabChange("stalls")}
          className={`${segmentedBase} ${
            tab === "stalls" ? segmentedActive : segmentedInactive
          }`}
        >
          {t("tabs.stalls")}
        </button>
      </div>

      {/* Search input */}
      <div className="relative mb-6">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={placeholder}
          autoComplete="off"
          spellCheck={false}
          className="h-11 pl-9 pr-11"
        />
        {input.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            aria-label={t("clearSearch")}
            className="absolute right-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Live region — announce loading + result counts */}
      <div role="status" aria-live="polite" className="sr-only">
        {loading
          ? t("loading")
          : error
            ? error
            : queryReady && totalCount > 0
              ? String(totalCount)
              : ""}
      </div>

      {/* Initial empty state */}
      {showInitialEmpty && !error && (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <Search
            className="size-12 text-muted-foreground/50"
            aria-hidden="true"
          />
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">{t("emptyInitial")}</h2>
            <p className="max-w-xs text-sm text-muted-foreground">
              {t("emptyInitialDescription")}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {hints.map((hint) => (
              <Button
                key={hint.key}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleHintClick(hint.label)}
                className="min-h-[36px]"
              >
                {hint.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Loading skeletons */}
      {queryReady && loading && (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 6 }).map((_, i) =>
            tab === "items" ? (
              <ItemCardSkeleton key={i} />
            ) : (
              <PublicStallCardSkeleton key={i} />
            )
          )}
        </div>
      )}

      {/* Error state */}
      {queryReady && !loading && error && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button type="button" variant="outline" size="sm" onClick={handleRetry}>
            {t("retry")}
          </Button>
        </div>
      )}

      {/* No results */}
      {showNoResults && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Search
            className="size-12 text-muted-foreground/50"
            aria-hidden="true"
          />
          <h2 className="text-lg font-semibold">
            {tab === "items"
              ? t("noResultsItems", { q: trimmedQuery })
              : t("noResultsStalls", { q: trimmedQuery })}
          </h2>
          <p className="max-w-xs text-sm text-muted-foreground">
            {t("noResultsDescription")}
          </p>
        </div>
      )}

      {/* Results */}
      {showResults && (
        <>
          <div className="flex flex-col gap-4">
            {tab === "items"
              ? items.map((item) => (
                  <PublicItemCard
                    key={item.id}
                    item={item}
                    onClick={(i) => setSelectedItemId(i.id)}
                    onOffer={(i) => setOfferItem(i)}
                  />
                ))
              : stalls.map((stall) => (
                  <PublicStallCard key={stall.id} stall={stall} />
                ))}
          </div>

          {hasMore && (
            <div className="mt-6 flex items-center justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="min-h-[44px]"
              >
                {loadingMore ? (
                  <>
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                    {t("loadingMore")}
                  </>
                ) : (
                  t("loadMore")
                )}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Item detail modal (items tab only) */}
      {selectedItemId && (
        <ItemDetailModal
          itemId={selectedItemId}
          onClose={() => setSelectedItemId(null)}
        />
      )}

      {/* Offers popup */}
      {offerItem && (
        <OffersPopup
          itemId={offerItem.id}
          itemTitle={offerItem.title}
          itemImages={offerItem.images}
          onClose={() => setOfferItem(null)}
        />
      )}
    </div>
  );
}
