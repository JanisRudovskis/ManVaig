// Filter types and URL serialization helpers for the Browse → Items tab.

export type ListingType = "fixed" | "offers" | "timed";
export type SortOption = "newest" | "oldest" | "priceAsc" | "priceDesc";

export interface ItemFilters {
  categoryId: number | null;
  priceMin: number | null;
  priceMax: number | null;
  types: ListingType[];
  conditions: number[];
  sort: SortOption;
}

export const DEFAULT_FILTERS: ItemFilters = {
  categoryId: null,
  priceMin: null,
  priceMax: null,
  types: [],
  conditions: [],
  sort: "newest",
};

const VALID_TYPES = new Set<ListingType>(["fixed", "offers", "timed"]);
const VALID_SORTS = new Set<SortOption>(["newest", "oldest", "priceAsc", "priceDesc"]);

/** Parse filter state from URL search params. Invalid values silently fallback to defaults. */
export function filtersFromParams(params: URLSearchParams): ItemFilters {
  const catRaw = params.get("cat");
  const categoryId = catRaw ? (parseInt(catRaw, 10) || null) : null;

  const minRaw = params.get("priceMin");
  const priceMin = minRaw ? (parseInt(minRaw, 10) >= 0 ? parseInt(minRaw, 10) : null) : null;

  const maxRaw = params.get("priceMax");
  const priceMax = maxRaw ? (parseInt(maxRaw, 10) >= 0 ? parseInt(maxRaw, 10) : null) : null;

  const typesRaw = params.get("type");
  const types: ListingType[] = typesRaw
    ? typesRaw.split(",").filter((t): t is ListingType => VALID_TYPES.has(t as ListingType))
    : [];

  const condRaw = params.get("cond");
  const conditions: number[] = condRaw
    ? condRaw
        .split(",")
        .map((c) => parseInt(c, 10))
        .filter((n) => !isNaN(n) && n >= 0 && n <= 4)
    : [];

  const sortRaw = params.get("sort");
  const sort: SortOption = sortRaw && VALID_SORTS.has(sortRaw as SortOption)
    ? (sortRaw as SortOption)
    : "newest";

  return { categoryId, priceMin, priceMax, types, conditions, sort };
}

/** Serialize filter state into URLSearchParams. Only writes non-default values. */
export function filtersToParams(filters: ItemFilters, params: URLSearchParams): void {
  // Remove any existing filter params first
  params.delete("cat");
  params.delete("priceMin");
  params.delete("priceMax");
  params.delete("type");
  params.delete("cond");
  params.delete("sort");

  if (filters.categoryId != null) params.set("cat", String(filters.categoryId));
  if (filters.priceMin != null) params.set("priceMin", String(filters.priceMin));
  if (filters.priceMax != null) params.set("priceMax", String(filters.priceMax));
  if (filters.types.length > 0) params.set("type", filters.types.join(","));
  if (filters.conditions.length > 0) params.set("cond", filters.conditions.join(","));
  if (filters.sort !== "newest") params.set("sort", filters.sort);
}

/** Count individual active filter values (matches visible chip count for the badge). */
export function activeFilterCount(filters: ItemFilters): number {
  let count = 0;
  if (filters.categoryId != null) count++;
  if (filters.priceMin != null) count++;
  if (filters.priceMax != null) count++;
  count += filters.types.length;
  count += filters.conditions.length;
  if (filters.sort !== "newest") count++;
  return count;
}

/** True if any filter deviates from default — drives queryReady when no text entered. */
export function hasActiveFilters(filters: ItemFilters): boolean {
  return activeFilterCount(filters) > 0;
}
