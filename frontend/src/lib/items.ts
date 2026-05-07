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
  allowGuestOffers: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  bidCount: number;
  highestBid: number | null;
  biddingPaused: boolean;
  biddingClosed: boolean;
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
  createdAt: string;
  images: ItemImage[];
  tags: string[];
  seller: PublicSellerSummary;
  bidCount: number;
  highestBid: number | null;
  biddingPaused: boolean;
  biddingClosed: boolean;
}

export interface PublicItemDetail extends PublicItemCard {
  description: string | null;
  allowGuestOffers: boolean;
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
  bidderName: string | null;
  bidderAvatarUrl: string | null;
  bidderInitial: string | null;
  isAnonymous: boolean;
  bidderLabel: string;
  bidderContact: string | null;
  sellerContact: string | null;
  amount: number;
  status: string; // Active, Accepted, Completed, Denied, Failed
  isOwnBid: boolean;
  createdAt: string;
  acceptedAt: string | null;
}

export interface BidListResponse {
  bids: BidResponse[];
  totalBids: number;
  totalAllBids: number;
  highestActiveBid: number | null;
  minNextBid: number | null;
  acceptOffers: boolean;
  price: number | null;
  minOfferPrice: number | null;
  offerStep: number | null;
  endDate: string | null;
  isOwner: boolean;
  biddingPaused: boolean;
  biddingClosed: boolean;
  failedDealCount: number;
  uniqueBidders: number;
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
  amount: number,
  isAnonymous: boolean
): Promise<{ id: string; amount: number; antiSnipe: boolean; updated: boolean }> {
  const res = await authFetch(`${API_URL}/api/v1/items/${itemId}/bids`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, isAnonymous }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "bid_place_failed");
  }
  return res.json();
}

export async function acceptBid(itemId: string, bidId: string): Promise<void> {
  const res = await authFetch(`${API_URL}/api/v1/items/${itemId}/bids/${bidId}/accept`, {
    method: "POST",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "bid_accept_failed");
  }
}

export async function completeBid(itemId: string, bidId: string): Promise<void> {
  const res = await authFetch(`${API_URL}/api/v1/items/${itemId}/bids/${bidId}/complete`, {
    method: "POST",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "bid_complete_failed");
  }
}

export async function failBid(itemId: string, bidId: string): Promise<void> {
  const res = await authFetch(`${API_URL}/api/v1/items/${itemId}/bids/${bidId}/fail`, {
    method: "POST",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "bid_fail_failed");
  }
}

export async function denyBid(itemId: string, bidId: string): Promise<void> {
  const res = await authFetch(`${API_URL}/api/v1/items/${itemId}/bids/${bidId}/deny`, {
    method: "POST",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "bid_deny_failed");
  }
}

// === Public Browse API (no auth required) ===

export async function fetchPublicItems(
  page = 1,
  pageSize = 20,
  categoryId?: number | null,
  signal?: AbortSignal
): Promise<PublicItemListResponse> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (categoryId) params.set("categoryId", String(categoryId));

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
