import { authFetch } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5100";

// === Types ===

export interface StallResponse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  headerImageUrl: string | null;
  backgroundImageUrl: string | null;
  accentColor: string | null;
  sortOrder: number;
  isDefault: boolean;
  itemCount: number;
  previewImageUrls: string[];
  featuredItemIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StallListResponse {
  stalls: StallResponse[];
  totalItemCount: number;
  maxItems: number;
}

export interface CreateStallData {
  name: string;
  description?: string;
  accentColor?: string;
}

export interface UpdateStallData {
  name?: string;
  slug?: string;
  description?: string;
  accentColor?: string;
}

export interface PublicStallResponse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  headerImageUrl: string | null;
  backgroundImageUrl: string | null;
  accentColor: string | null;
  itemCount: number;
  previewImageUrls: string[];
  owner: {
    displayName: string;
    avatarUrl: string | null;
    location: string | null;
  };
}

// === API functions ===

export async function fetchMyStalls(): Promise<StallListResponse> {
  const res = await authFetch(`${API_URL}/api/v1/stalls`);
  if (!res.ok) throw new Error("stalls_fetch_failed");
  return res.json();
}

export async function fetchStall(id: string): Promise<StallResponse> {
  const res = await authFetch(`${API_URL}/api/v1/stalls/${id}`);
  if (!res.ok) throw new Error("stall_fetch_failed");
  return res.json();
}

export async function createStall(data: CreateStallData): Promise<StallResponse> {
  const res = await authFetch(`${API_URL}/api/v1/stalls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "stall_create_failed");
  }
  return res.json();
}

export async function updateStall(id: string, data: UpdateStallData): Promise<StallResponse> {
  const res = await authFetch(`${API_URL}/api/v1/stalls/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "stall_update_failed");
  }
  return res.json();
}

export async function deleteStall(id: string): Promise<void> {
  const res = await authFetch(`${API_URL}/api/v1/stalls/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "stall_delete_failed");
  }
}

export async function uploadStallThumbnail(
  stallId: string,
  file: File
): Promise<{ thumbnailUrl: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await authFetch(`${API_URL}/api/v1/stalls/${stallId}/thumbnail`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "thumbnail_upload_failed");
  }
  return res.json();
}

export async function deleteStallThumbnail(stallId: string): Promise<void> {
  const res = await authFetch(`${API_URL}/api/v1/stalls/${stallId}/thumbnail`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("thumbnail_delete_failed");
}

export async function uploadStallHeader(
  stallId: string,
  file: File
): Promise<{ headerImageUrl: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await authFetch(`${API_URL}/api/v1/stalls/${stallId}/header`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "header_upload_failed");
  }
  return res.json();
}

export async function deleteStallHeader(stallId: string): Promise<void> {
  const res = await authFetch(`${API_URL}/api/v1/stalls/${stallId}/header`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("header_delete_failed");
}

export async function uploadStallBackground(
  stallId: string,
  file: File
): Promise<{ backgroundImageUrl: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await authFetch(`${API_URL}/api/v1/stalls/${stallId}/background`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "background_upload_failed");
  }
  return res.json();
}

export async function deleteStallBackground(stallId: string): Promise<void> {
  const res = await authFetch(`${API_URL}/api/v1/stalls/${stallId}/background`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("background_delete_failed");
}

export async function reorderStalls(stallIds: string[]): Promise<void> {
  const res = await authFetch(`${API_URL}/api/v1/stalls/reorder`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stallIds }),
  });
  if (!res.ok) throw new Error("stall_reorder_failed");
}

export async function toggleFeaturedItem(
  stallId: string,
  itemId: string
): Promise<{ featured: boolean }> {
  const res = await authFetch(
    `${API_URL}/api/v1/stalls/${stallId}/featured/${itemId}`,
    { method: "POST" }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "toggle_featured_failed");
  }
  return res.json();
}
