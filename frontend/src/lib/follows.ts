import { authFetch, getToken } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5100";

export interface FollowUserDto {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  location: string | null;
  followedSince: string;
}

export interface FollowListResponse {
  users: FollowUserDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export async function followUser(displayName: string): Promise<void> {
  const res = await authFetch(
    `${API_URL}/api/v1/users/${encodeURIComponent(displayName)}/follow`,
    { method: "POST" }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "follow_failed");
  }
}

export async function unfollowUser(displayName: string): Promise<void> {
  const res = await authFetch(
    `${API_URL}/api/v1/users/${encodeURIComponent(displayName)}/follow`,
    { method: "DELETE" }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "unfollow_failed");
  }
}

export async function getFollowers(
  displayName: string,
  page = 1,
  pageSize = 20
): Promise<FollowListResponse> {
  const token = getToken();
  const headers: HeadersInit = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(
    `${API_URL}/api/v1/users/${encodeURIComponent(displayName)}/followers?page=${page}&pageSize=${pageSize}`,
    { headers }
  );
  if (!res.ok) throw new Error("followers_fetch_failed");
  return res.json();
}

export async function getFollowing(
  displayName: string,
  page = 1,
  pageSize = 20
): Promise<FollowListResponse> {
  const token = getToken();
  const headers: HeadersInit = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(
    `${API_URL}/api/v1/users/${encodeURIComponent(displayName)}/following?page=${page}&pageSize=${pageSize}`,
    { headers }
  );
  if (!res.ok) throw new Error("following_fetch_failed");
  return res.json();
}
