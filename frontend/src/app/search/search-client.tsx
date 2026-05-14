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
import { ArrowRight, Search, Users, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchPublicItems } from "@/lib/items";
import type { PublicItemCard as PublicItemCardType } from "@/lib/items";
import { fetchPublicStalls } from "@/lib/stalls";
import type { PublicStallResponse } from "@/lib/stalls";
import { fetchPublicUsers } from "@/lib/users";
import type { PublicUserCard as PublicUserCardData } from "@/lib/users";
import { PublicItemCard } from "@/components/public-item-card";
import { ItemCardSkeleton } from "@/components/item-card-shared";
import {
  PublicStallCard,
  PublicStallCardSkeleton,
} from "@/components/public-stall-card";
import {
  PublicUserCard,
  PublicUserCardSkeleton,
} from "@/components/public-user-card";
import { ItemDetailModal } from "@/components/item-detail-modal";
import { ItemFilterSheet } from "@/components/item-filter-sheet";
import { OffersPopup } from "@/components/offers-popup";
import {
  filtersFromParams,
  filtersToParams,
  hasActiveFilters as checkHasActiveFilters,
  activeFilterCount as getActiveFilterCount,
  DEFAULT_FILTERS,
  type ItemFilters,
} from "@/lib/search-filters";

const PAGE_SIZE = 20;
const MIN_QUERY_LENGTH = 2;
const HISTORY_KEY = "manvaig_search_history";
const HISTORY_MAX = 6;

type Tab = "items" | "stalls" | "people";

const HINT_KEYS = ["bicycle", "watch", "drill", "ring"] as const;

function getSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch { return []; }
}

function saveSearchQuery(query: string) {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return;
  try {
    const history = getSearchHistory().filter(
      (h) => h.toLowerCase() !== trimmed.toLowerCase()
    );
    history.unshift(trimmed);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, HISTORY_MAX)));
  } catch { /* localStorage unavailable */ }
}

function parseTab(value: string | null): Tab {
  if (value === "stalls") return "stalls";
  if (value === "people") return "people";
  return "items";
}

export function SearchClient() {
  const t = useTranslations("search");
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTab = parseTab(searchParams.get("tab"));
  const initialQ = searchParams.get("q") ?? "";

  const [tab, setTab] = useState<Tab>(initialTab);
  const [input, setInput] = useState(initialQ);
  const [activeQuery, setActiveQuery] = useState(initialQ);
  const [retryCounter, setRetryCounter] = useState(0);

  const [items, setItems] = useState<PublicItemCardType[]>([]);
  const [stalls, setStalls] = useState<PublicStallResponse[]>([]);
  const [users, setUsers] = useState<PublicUserCardData[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState<ItemFilters>(() =>
    filtersFromParams(searchParams)
  );
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [offerItem, setOfferItem] = useState<PublicItemCardType | null>(null);

  const genRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const trimmedQuery = activeQuery.trim();
  const filtersActive = tab === "items" && checkHasActiveFilters(filters);
  const queryReady =
    trimmedQuery.length >= MIN_QUERY_LENGTH || filtersActive;
  const filterCount = getActiveFilterCount(filters);

  const writeUrl = useCallback(
    (nextTab: Tab, nextQ: string, nextFilters: ItemFilters) => {
      const params = new URLSearchParams();
      if (nextTab !== "items") params.set("tab", nextTab);
      const trimmed = nextQ.trim();
      if (trimmed.length >= MIN_QUERY_LENGTH) params.set("q", trimmed);
      if (nextTab === "items") filtersToParams(nextFilters, params);
      const qs = params.toString();
      router.replace(qs ? `/search?${qs}` : "/search", { scroll: false });
    },
    [router]
  );

  // Mirror tab + active query + filters to URL
  useEffect(() => {
    writeUrl(tab, activeQuery, filters);
  }, [tab, activeQuery, filters, writeUrl]);

  // Reset list whenever tab, active query, or filters change
  useEffect(() => {
    setItems([]);
    setStalls([]);
    setUsers([]);
    setTotalCount(0);
    setPage(1);
    setError("");
  }, [tab, activeQuery, filters]);

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
            q: trimmedQuery || undefined,
            categoryId: filters.categoryId,
            priceMin: filters.priceMin,
            priceMax: filters.priceMax,
            types: filters.types.length > 0 ? filters.types : undefined,
            conditions: filters.conditions.length > 0 ? filters.conditions : undefined,
            sort: filters.sort,
            signal: ctrl.signal,
          });
          if (gen !== genRef.current) return;
          setItems(data.items);
          setTotalCount(data.totalCount);
        } else if (tab === "stalls") {
          const data = await fetchPublicStalls({
            page: 1,
            pageSize: PAGE_SIZE,
            q: trimmedQuery,
            signal: ctrl.signal,
          });
          if (gen !== genRef.current) return;
          setStalls(data.stalls);
          setTotalCount(data.totalCount);
        } else {
          const data = await fetchPublicUsers({
            page: 1,
            pageSize: PAGE_SIZE,
            q: trimmedQuery,
            signal: ctrl.signal,
          });
          if (gen !== genRef.current) return;
          setUsers(data.users);
          setTotalCount(data.totalCount);
        }
        // Save successful text queries to search history
        if (trimmedQuery.length >= MIN_QUERY_LENGTH) {
          saveSearchQuery(trimmedQuery);
          setSearchHistory(getSearchHistory());
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
  }, [tab, trimmedQuery, queryReady, retryCounter, filters, t]);

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
          q: trimmedQuery || undefined,
          categoryId: filters.categoryId,
          priceMin: filters.priceMin,
          priceMax: filters.priceMax,
          types: filters.types.length > 0 ? filters.types : undefined,
          conditions: filters.conditions.length > 0 ? filters.conditions : undefined,
          sort: filters.sort,
          signal: ctrl.signal,
        });
        if (gen !== genRef.current) return;
        setItems((prev) => [...prev, ...data.items]);
        setTotalCount(data.totalCount);
      } else if (tab === "stalls") {
        const data = await fetchPublicStalls({
          page: nextPage,
          pageSize: PAGE_SIZE,
          q: trimmedQuery,
          signal: ctrl.signal,
        });
        if (gen !== genRef.current) return;
        setStalls((prev) => [...prev, ...data.stalls]);
        setTotalCount(data.totalCount);
      } else {
        const data = await fetchPublicUsers({
          page: nextPage,
          pageSize: PAGE_SIZE,
          q: trimmedQuery,
          signal: ctrl.signal,
        });
        if (gen !== genRef.current) return;
        setUsers((prev) => [...prev, ...data.users]);
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
  }, [queryReady, loadingMore, page, tab, trimmedQuery, filters, t]);

  const fireImmediate = useCallback(
    (value: string) => {
      setInput(value);
      setActiveQuery(value);
      writeUrl(tab, value, filters);
    },
    [tab, filters, writeUrl]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        fireImmediate(input);
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

  const renderedCount =
    tab === "items" ? items.length : tab === "stalls" ? stalls.length : users.length;
  const hasMore = renderedCount < totalCount;
  const showInitialEmpty = !queryReady;
  const showResults = queryReady && !loading && !error && renderedCount > 0;
  const showNoResults =
    queryReady && !loading && !error && renderedCount === 0;

  const placeholder =
    tab === "items"
      ? t("placeholderItems")
      : tab === "stalls"
        ? t("placeholderStalls")
        : t("placeholderPeople");

  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // Load history on mount (client-only)
  useEffect(() => {
    setSearchHistory(getSearchHistory());
  }, []);

  const defaultHints = useMemo(
    () => HINT_KEYS.map((k) => t(`hints.${k}`)),
    [t]
  );

  const hints = searchHistory.length > 0 ? searchHistory : defaultHints;

  const segmentedBase =
    "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all min-h-[44px] sm:min-h-0";
  const segmentedActive = "bg-card text-foreground shadow-sm";
  const segmentedInactive = "text-muted-foreground hover:text-foreground";

  return (
    <div className="mx-auto max-w-[600px] md:max-w-2xl px-4 py-6 md:px-6 md:py-8">
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
        <button
          type="button"
          role="tab"
          aria-selected={tab === "people"}
          onClick={() => handleTabChange("people")}
          className={`${segmentedBase} ${
            tab === "people" ? segmentedActive : segmentedInactive
          }`}
        >
          {t("tabs.people")}
        </button>
      </div>

      {/* Search input */}
      <div className={tab === "items" && filterCount > 0 ? "relative mb-3" : "relative mb-6"}>
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
          className={`h-11 pl-9 ${input.length > 0 ? "pr-[5.5rem]" : "pr-4"}`}
        />
        {input.length > 0 && (
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
            <button
              type="button"
              onClick={handleClear}
              aria-label={t("clearSearch")}
              className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => fireImmediate(input)}
              aria-label={t("submitSearch")}
              className="flex size-9 items-center justify-center rounded-md bg-foreground text-background hover:bg-foreground/80 transition-colors"
            >
              <ArrowRight className="size-4" />
            </button>
          </div>
        )}
      </div>

      {/* Filter trigger + active chips (items tab only) */}
      {tab === "items" && (
        <div className="mb-6 flex flex-col gap-2">
          <ItemFilterSheet
            filters={filters}
            onChange={setFilters}
            open={filterSheetOpen}
            onOpenChange={setFilterSheetOpen}
            triggerLabel={t("filters.triggerLabel")}
            badgeCount={filterCount}
          />

          {/* Active filter chips */}
          {filterCount > 0 && (
            <FilterChips filters={filters} onChange={setFilters} />
          )}
        </div>
      )}

      {/* Live region — announce loading + result counts */}
      <div role="status" aria-live="polite" className="sr-only">
        {loading
          ? t("loading")
          : error
            ? error
            : queryReady && totalCount > 0
              ? t(
                  tab === "items"
                    ? "liveCountItems"
                    : tab === "stalls"
                      ? "liveCountStalls"
                      : "liveCountPeople",
                  { count: totalCount }
                )
              : ""}
      </div>

      {/* Initial empty state */}
      {showInitialEmpty && !error && (
        <div className="flex flex-col items-center justify-center gap-4 py-10 md:py-12 text-center">
          {tab === "people" ? (
            <Users className="size-12 text-muted-foreground/50" aria-hidden="true" />
          ) : (
            <Search className="size-12 text-muted-foreground/50" aria-hidden="true" />
          )}
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">
              {tab === "people" ? t("emptyInitialPeople") : t("emptyInitial")}
            </h2>
            <p className="max-w-xs text-sm text-muted-foreground">
              {tab === "people"
                ? t("emptyInitialDescriptionPeople")
                : t("emptyInitialDescription")}
            </p>
          </div>
          {tab !== "people" && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {hints.map((hint) => (
                <Button
                  key={hint}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleHintClick(hint)}
                  className="min-h-[36px]"
                >
                  {hint}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Loading skeletons */}
      {queryReady && loading && (
        <div className={`flex flex-col ${tab === "people" ? "gap-3" : "gap-4"}`}>
          {Array.from({ length: 6 }).map((_, i) =>
            tab === "items" ? (
              <ItemCardSkeleton key={i} />
            ) : tab === "stalls" ? (
              <PublicStallCardSkeleton key={i} />
            ) : (
              <PublicUserCardSkeleton key={i} />
            )
          )}
        </div>
      )}

      {/* Error state */}
      {queryReady && !loading && error && (
        <div className="flex flex-col items-center justify-center gap-3 py-10 md:py-12 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button type="button" variant="outline" size="sm" onClick={handleRetry}>
            {t("retry")}
          </Button>
        </div>
      )}

      {/* No results */}
      {showNoResults && (
        <div className="flex flex-col items-center justify-center gap-3 py-10 md:py-12 text-center">
          {tab === "people" ? (
            <Users className="size-12 text-muted-foreground/50" aria-hidden="true" />
          ) : (
            <Search className="size-12 text-muted-foreground/50" aria-hidden="true" />
          )}
          <h2 className="text-lg font-semibold">
            {tab === "items"
              ? t("noResultsItems", { q: trimmedQuery })
              : tab === "stalls"
                ? t("noResultsStalls", { q: trimmedQuery })
                : t("noResultsPeople", { q: trimmedQuery })}
          </h2>
          <p className="max-w-xs text-sm text-muted-foreground">
            {t("noResultsDescription")}
          </p>
        </div>
      )}

      {/* Results */}
      {showResults && (
        <>
          <div className={`flex flex-col ${tab === "people" ? "gap-3" : "gap-4"}`}>
            {tab === "items"
              ? items.map((item) => (
                  <PublicItemCard
                    key={item.id}
                    item={item}
                    onClick={(i) => setSelectedItemId(i.id)}
                    onOffer={(i) => setOfferItem(i)}
                  />
                ))
              : tab === "stalls"
                ? stalls.map((stall) => (
                    <PublicStallCard key={stall.id} stall={stall} />
                  ))
                : users.map((user) => (
                    <PublicUserCard key={user.displayName} user={user} />
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

/* ── Active filter chips ── */

const chipClass =
  "flex items-center gap-1 rounded-full border border-border bg-muted/50 pl-2.5 pr-1 py-1 text-xs transition-colors hover:bg-accent/50";

function FilterChips({
  filters,
  onChange,
}: {
  filters: ItemFilters;
  onChange: (f: ItemFilters) => void;
}) {
  const tc = useTranslations("categories");
  const tf = useTranslations("search.filters");

  const chips: { label: string; onRemove: () => void }[] = [];

  if (filters.categoryId != null) {
    chips.push({
      label: tc(String(filters.categoryId)),
      onRemove: () => onChange({ ...filters, categoryId: null }),
    });
  }

  if (filters.priceMin != null) {
    chips.push({
      label: tf("chipPriceMin", { value: filters.priceMin }),
      onRemove: () => onChange({ ...filters, priceMin: null }),
    });
  }

  if (filters.priceMax != null) {
    chips.push({
      label: tf("chipPriceMax", { value: filters.priceMax }),
      onRemove: () => onChange({ ...filters, priceMax: null }),
    });
  }

  for (const type of filters.types) {
    const key = type === "fixed" ? "typeFixed" : type === "offers" ? "typeOffers" : "typeTimed";
    chips.push({
      label: tf(key),
      onRemove: () =>
        onChange({ ...filters, types: filters.types.filter((t) => t !== type) }),
    });
  }

  const condKeys = ["condNew", "condLikeNew", "condGood", "condFair", "condPoor"] as const;
  for (const cond of filters.conditions) {
    chips.push({
      label: tf(condKeys[cond]),
      onRemove: () =>
        onChange({
          ...filters,
          conditions: filters.conditions.filter((c) => c !== cond),
        }),
    });
  }

  if (filters.sort !== "newest") {
    const sortKey =
      filters.sort === "oldest" ? "sortOldest" :
      filters.sort === "priceAsc" ? "sortPriceAsc" : "sortPriceDesc";
    chips.push({
      label: tf(sortKey),
      onRemove: () => onChange({ ...filters, sort: "newest" }),
    });
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <span key={chip.label} className={chipClass}>
          {chip.label}
          <button
            type="button"
            onClick={chip.onRemove}
            className="ml-0.5 flex size-6 items-center justify-center rounded-full hover:bg-accent"
            aria-label={`Remove ${chip.label}`}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
