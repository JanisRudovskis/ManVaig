import { getToken } from "./auth";

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
  title: string;
  description: string | null;
  categoryId: number;
  categoryName: string;
  condition: number; // 0=New, 1=Used, 2=Worn
  pricingType: number; // 0=Fixed, 1=FixedOffers, 2=Bidding, 3=Auction
  price: number | null;
  minBidPrice: number | null;
  bidStep: number | null;
  auctionEnd: string | null;
  visibility: number; // 0=Public, 1=RegisteredOnly, 2=LinkOnly, 3=Private
  location: string | null;
  canShip: boolean;
  allowGuestOffers: boolean;
  createdAt: string;
  updatedAt: string;
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
  title: string;
  description?: string;
  categoryId: number;
  condition?: number;
  pricingType?: number;
  price?: number | null;
  minBidPrice?: number | null;
  bidStep?: number | null;
  auctionEnd?: string | null;
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
  pricingType?: number;
  price?: number | null;
  minBidPrice?: number | null;
  bidStep?: number | null;
  auctionEnd?: string | null;
  visibility?: number;
  location?: string;
  canShip?: boolean;
  allowGuestOffers?: boolean;
  tags?: string[];
  clearPricingFields?: boolean;
}

// === Enums (matching backend) ===

export const PricingType = {
  Fixed: 0,
  FixedOffers: 1,
  Bidding: 2,
  Auction: 3,
} as const;

export const Condition = {
  New: 0,
  Used: 1,
  Worn: 2,
} as const;

export const ItemVisibility = {
  Public: 0,
  RegisteredOnly: 1,
  LinkOnly: 2,
  Private: 3,
} as const;

// === API Functions ===

export async function fetchMyItems(
  page = 1,
  pageSize = 20
): Promise<ItemListResponse> {
  const token = getToken();
  const res = await fetch(
    `${API_URL}/api/v1/items?page=${page}&pageSize=${pageSize}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) throw new Error("items_fetch_failed");
  return res.json();
}

export async function fetchItem(id: string): Promise<ItemResponse> {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/v1/items/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error("item_fetch_failed");
  return res.json();
}

export async function createItem(data: CreateItemData): Promise<ItemResponse> {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/v1/items`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
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
  const token = getToken();
  const res = await fetch(`${API_URL}/api/v1/items/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "item_update_failed");
  }
  return res.json();
}

export async function deleteItem(id: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/v1/items/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
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
  const token = getToken();
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  const res = await fetch(`${API_URL}/api/v1/items/${itemId}/images`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
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
  const token = getToken();
  const res = await fetch(`${API_URL}/api/v1/items/${itemId}/images/reorder`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
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
  const token = getToken();
  const res = await fetch(
    `${API_URL}/api/v1/items/${itemId}/images/${imageId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "image_delete_failed");
  }
}

// === Bids ===

export interface BidResponse {
  id: string;
  bidderLabel: string;
  bidderName: string | null;
  bidderContact: string | null;
  amount: number;
  status: string;
  isWinner: boolean;
  createdAt: string;
}

export interface BidListResponse {
  bids: BidResponse[];
  totalBids: number;
  highestBid: number | null;
  auctionEnded: boolean;
  winnerExpiresAt: string | null;
}

export async function fetchBids(itemId: string): Promise<BidListResponse> {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/v1/items/${itemId}/bids`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "bids_fetch_failed");
  }
  return res.json();
}

export async function assignNextWinner(itemId: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_URL}/api/v1/items/${itemId}/bids/assign-next`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "assign_next_failed");
  }
}
