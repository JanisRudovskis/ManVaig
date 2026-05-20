import { authFetch } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5100";

// === Types ===

export interface ItemImage {
  id: string;
  url: string;
  sortOrder: number;
  isPrimary: boolean;
}

export interface ItemResponse {
  id: string;
  userId: string;
  stallId: string;
  stallName: string;
  title: string;
  description: string | null;
  categoryId: number;
  categoryName: string;
  condition: number; // 0=New, 1=Used, 2=Worn
  // Composable pricing fields
  price: number | null;
  acceptOffers: boolean;
  minOfferPrice: number | null;
  offerStep: number | null;
  endDate: string | null;
  visibility: number; // 0=Public, 1=RegisteredOnly, 2=LinkOnly, 3=Private
  location: string | null;
  canShip: boolean;
  isSold: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  bidCount: number;
  highestBid: number | null;
  images: ItemImage[];
  tags: string[];
}

export interface ItemListResponse {
  items: ItemResponse[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface CategoryDto {
  id: number;
  name: string;
  sortOrder: number;
}

export interface TagDto {
  id: number;
  name: string;
}

export interface CreateItemData {
  stallId?: string;
  title: string;
  description?: string;
  categoryId: number;
  condition?: number;
  // Composable pricing fields
  price?: number | null;
  acceptOffers?: boolean;
  minOfferPrice?: number | null;
  offerStep?: number | null;
  endDate?: string | null;
  visibility?: number;
  location?: string;
  canShip?: boolean;
  allowGuestOffers?: boolean;
  tags?: string[];
}

export interface UpdateItemData {
  title?: string;
  description?: string;
  categoryId?: number;
  condition?: number;
  // Composable pricing fields
  price?: number | null;
  acceptOffers?: boolean;
  minOfferPrice?: number | null;
  offerStep?: number | null;
  endDate?: string | null;
  visibility?: number;
  location?: string;
  canShip?: boolean;
  allowGuestOffers?: boolean;
  tags?: string[];
  clearPricingFields?: boolean;
  stallId?: string;
}

// === Enums (matching backend) ===

export const Condition = {
  New: 0,
  LikeNew: 1,
  Good: 2,
  Fair: 3,
  Poor: 4,
} as const;

export const ItemVisibility = {
  Public: 0,
  RegisteredOnly: 1,
  LinkOnly: 2,
  Private: 3,
} as const;

// === Pricing helpers ===

/** Item accepts offers from buyers */
export function hasOffers(item: { acceptOffers: boolean }): boolean {
  return item.acceptOffers;
}

/** Item has a timed end date */
export function isTimed(item: { endDate: string | null }): boolean {
  return item.endDate != null;
}

/** Item has ended (end date in the past) */
export function isEnded(item: { endDate: string | null }): boolean {
  if (!item.endDate) return false;
  return new Date(item.endDate).getTime() < Date.now();
}

/** Item is fixed-price only (no offers) */
export function isFixedOnly(item: { acceptOffers: boolean; price: number | null }): boolean {
  return !item.acceptOffers && item.price != null;
}

// === API Functions ===

export type ItemSortOption = "newest" | "oldest" | "priceAsc" | "priceDesc" | "custom";

export async function fetchMyItems(
  page = 1,
  pageSize = 20,
  stallId?: string,
  sort: ItemSortOption = "newest"
): Promise<ItemListResponse> {
  let url = `${API_URL}/api/v1/items?page=${page}&pageSize=${pageSize}&sort=${sort}`;
  if (stallId) url += `&stallId=${stallId}`;

  const res = await authFetch(url);

  if (!res.ok) throw new Error("items_fetch_failed");
  return res.json();
}

export async function fetchItem(id: string): Promise<ItemResponse> {
  const res = await authFetch(`${API_URL}/api/v1/items/${id}`);

  if (!res.ok) throw new Error("item_fetch_failed");
  return res.json();
}

export async function createItem(data: CreateItemData): Promise<ItemResponse> {
  const res = await authFetch(`${API_URL}/api/v1/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "item_create_failed");
  }
  return res.json();
}

export async function updateItem(
  id: string,
  data: UpdateItemData
): Promise<ItemResponse> {
  const res = await authFetch(`${API_URL}/api/v1/items/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "item_update_failed");
  }
  return res.json();
}

export async function deleteItem(id: string): Promise<void> {
  const res = await authFetch(`${API_URL}/api/v1/items/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) throw new Error("item_delete_failed");
}

export async function fetchCategories(): Promise<CategoryDto[]> {
  const res = await fetch(`${API_URL}/api/v1/categories`);
  if (!res.ok) throw new Error("categories_fetch_failed");
  return res.json();
}

export async function searchTags(query: string): Promise<TagDto[]> {
  const res = await fetch(
    `${API_URL}/api/v1/tags?q=${encodeURIComponent(query)}`
  );
  if (!res.ok) return [];
  return res.json();
}

// === Image API Functions ===

export async function uploadItemImages(
  itemId: string,
  files: File[]
): Promise<ItemImage[]> {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  const res = await authFetch(`${API_URL}/api/v1/items/${itemId}/images`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "image_upload_failed");
  }
  return res.json();
}

export async function reorderItemImages(
  itemId: string,
  imageIds: string[]
): Promise<ItemImage[]> {
  const res = await authFetch(`${API_URL}/api/v1/items/${itemId}/images/reorder`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageIds }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "image_reorder_failed");
  }
  return res.json();
}

export async function deleteItemImage(
  itemId: string,
  imageId: string
): Promise<void> {
  const res = await authFetch(
    `${API_URL}/api/v1/items/${itemId}/images/${imageId}`,
    { method: "DELETE" }
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "image_delete_failed");
  }
}

export async function reorderItems(
  stallId: string,
  itemIds: string[]
): Promise<void> {
  const res = await authFetch(`${API_URL}/api/v1/items/reorder`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stallId, itemIds }),
  });

  if (!res.ok) throw new Error("items_reorder_failed");
}

// === Public types (for browse feed + detail page) ===

export interface PublicSellerSummary {
  displayName: string;
  avatarUrl: string | null;
  location: string | null;
  memberSince: string;
}

export interface PublicSellerDetail extends PublicSellerSummary {
  sellerId: string;
  bio: string | null;
}

export interface PublicItemCard {
  id: string;
  title: string;
  categoryId: number;
  categoryName: string;
  condition: number;
  // Composable pricing fields
  price: number | null;
  acceptOffers: boolean;
  minOfferPrice: number | null;
  offerStep: number | null;
  endDate: string | null;
  location: string | null;
  canShip: boolean;
  isSold: boolean;
  createdAt: string;
  images: ItemImage[];
  tags: string[];
  seller: PublicSellerSummary;
  bidCount: number;
  highestBid: number | null;
}

export interface PublicItemDetail extends PublicItemCard {
  description: string | null;
  isOwner: boolean;
  seller: PublicSellerDetail;
}

export interface PublicItemListResponse {
  items: PublicItemCard[];
  totalCount: number;
  page: number;
  pageSize: number;
}

// === Bids / Offers ===

export interface BidResponse {
  id: string;
  bidderName: string;
  bidderAvatarUrl: string | null;
  bidderId: string;
  amount: number;
  isOwnBid: boolean;
  status: "Active" | "Denied" | "InstantBuy";
  denyReason: string | null;
  denyDetail: string | null;
  createdAt: string;
}

export interface UniqueBidder {
  bidderId: string;
  bidderName: string;
  bidderAvatarUrl: string | null;
  bestAmount: number;
  bidCount: number;
  lastBidAt: string;
  isTop: boolean;
  isDenied: boolean;
  denyReason: string | null;
  denyDetail: string | null;
}

export interface BidListResponse {
  bids: BidResponse[];
  totalBids: number;
  highestBid: number | null;
  minNextBid: number | null;
  acceptOffers: boolean;
  price: number | null;
  minOfferPrice: number | null;
  offerStep: number | null;
  endDate: string | null;
  isOwner: boolean;
  isSold: boolean;
  isSubscribed: boolean | null;
  watcherCount: number;
  instantBuyPrice: number | null;
  soldTo: {
    buyerId: string;
    buyerDisplayName: string;
    buyerAvatarUrl: string | null;
    amount: number;
    isInstantBuy: boolean;
  } | null;
  canReopen: boolean;
  pendingInstantBuy: {
    buyerId: string;
    buyerDisplayName: string;
    buyerAvatarUrl: string | null;
    amount: number;
    createdAt: string;
    isOwnInstantBuy: boolean;
  } | null;
  uniqueBidders?: UniqueBidder[];
}

export async function fetchPublicBids(itemId: string, limit = 5): Promise<BidListResponse> {
  const res = await authFetch(`${API_URL}/api/v1/items/${itemId}/bids?limit=${limit}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "bids_fetch_failed");
  }
  return res.json();
}

export async function placeBid(
  itemId: string,
  amount: number
): Promise<{ id: string; amount: number; antiSnipe: boolean; updated: boolean }> {
  const res = await authFetch(`${API_URL}/api/v1/items/${itemId}/bids`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "bid_place_failed");
  }
  return res.json();
}

export async function subscribeToItem(itemId: string): Promise<{ subscribed: boolean }> {
  const res = await authFetch(`${API_URL}/api/v1/items/${itemId}/subscribe`, {
    method: "POST",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "subscribe_failed");
  }
  return res.json();
}

export async function unsubscribeFromItem(itemId: string): Promise<{ subscribed: boolean }> {
  const res = await authFetch(`${API_URL}/api/v1/items/${itemId}/subscribe`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "unsubscribe_failed");
  }
  return res.json();
}

export async function denyBidder(
  itemId: string,
  bidderId: string,
  reason: "fake_or_accidental" | "dont_trust" | "other",
  detail?: string,
): Promise<{ denied: number }> {
  const res = await authFetch(`${API_URL}/api/v1/items/${itemId}/bidders/${bidderId}/deny`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason, detail }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "deny_failed");
  }
  return res.json();
}

// === Instant Buy API ===

export async function placeInstantBuy(itemId: string): Promise<{ id: string; amount: number }> {
  const res = await authFetch(`${API_URL}/api/v1/items/${itemId}/instant-buy`, {
    method: "POST",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "instant_buy_failed");
  }
  return res.json();
}

export async function acceptInstantBuy(itemId: string): Promise<void> {
  const res = await authFetch(`${API_URL}/api/v1/items/${itemId}/instant-buy/accept`, {
    method: "POST",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "instant_buy_accept_failed");
  }
}

export async function declineInstantBuy(itemId: string): Promise<void> {
  const res = await authFetch(`${API_URL}/api/v1/items/${itemId}/instant-buy/decline`, {
    method: "POST",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "instant_buy_decline_failed");
  }
}

// === Sold state / manage sale API ===



export async function closeAuction(itemId: string): Promise<{ closed: boolean }> {
  const res = await authFetch(`${API_URL}/api/v1/items/${itemId}/close-auction`, { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "close_failed");
  }
  return res.json();
}

export async function sellToBidder(itemId: string, bidderId: string): Promise<{ sold: boolean }> {
  const res = await authFetch(`${API_URL}/api/v1/items/${itemId}/sell-to/${bidderId}`, { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "sell_failed");
  }
  return res.json();
}

// === Public Browse API (no auth required) ===

export interface FetchPublicItemsOptions {
  page?: number;
  pageSize?: number;
  categoryId?: number | null;
  q?: string;
  priceMin?: number | null;
  priceMax?: number | null;
  types?: string[];
  conditions?: number[];
  sort?: string;
  signal?: AbortSignal;
}

export async function fetchPublicItems(
  options: FetchPublicItemsOptions = {}
): Promise<PublicItemListResponse> {
  const { page = 1, pageSize = 20, categoryId, q, priceMin, priceMax, types, conditions, sort, signal } = options;
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (categoryId) params.set("categoryId", String(categoryId));
  const trimmedQ = q?.trim();
  if (trimmedQ) params.set("q", trimmedQ);
  if (priceMin != null) params.set("priceMin", String(priceMin));
  if (priceMax != null) params.set("priceMax", String(priceMax));
  if (types && types.length > 0) params.set("types", types.join(","));
  if (conditions && conditions.length > 0) params.set("conditions", conditions.join(","));
  if (sort && sort !== "newest") params.set("sort", sort);

  const res = await fetch(`${API_URL}/api/v1/public/items?${params}`, { signal });
  if (!res.ok) throw new Error("browse_fetch_failed");
  return res.json();
}

export async function fetchPublicItem(id: string): Promise<PublicItemDetail> {
  // Use authFetch to optionally send token (needed for RegisteredOnly items)
  const res = await authFetch(`${API_URL}/api/v1/public/items/${id}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "item_fetch_failed");
  }
  return res.json();
}
