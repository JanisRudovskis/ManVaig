const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5100";

export interface PublicUserCard {
  displayName: string;
  avatarUrl: string | null;
  memberSince: string;
  lastSeenAt: string | null;
  hasWhatsApp: boolean;
  hasTelegram: boolean;
  hasPhone: boolean;
  hasEmail: boolean;
}

export interface PublicUserListResponse {
  users: PublicUserCard[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface FetchPublicUsersOptions {
  page?: number;
  pageSize?: number;
  q?: string;
  signal?: AbortSignal;
}

export async function fetchPublicUsers(
  options: FetchPublicUsersOptions = {}
): Promise<PublicUserListResponse> {
  const { page = 1, pageSize = 20, q, signal } = options;
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  const trimmedQ = q?.trim();
  if (trimmedQ) params.set("q", trimmedQ);

  const res = await fetch(`${API_URL}/api/v1/public/users?${params}`, { signal });
  if (!res.ok) throw new Error("users_browse_fetch_failed");
  return res.json();
}
