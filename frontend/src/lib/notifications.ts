import { authFetch } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5100";

export interface NotificationItem {
  id: string;
  type: "NewBid" | "AuctionEnded" | "BidAccepted" | "NewItemFromFollowed" | "BidDenied" | "ItemDeleted" | "BidWon" | "InstantBuyRequested" | "InstantBuyAccepted" | "InstantBuyDeclined" | "AuctionReopened" | "AuctionClosed";
  actorDisplayName: string | null;
  actorAvatarUrl: string | null;
  itemId: string | null;
  itemTitle: string | null;
  itemImageUrl: string | null;
  bidId: string | null;
  bidAmount: number | null;
  denyReason: string | null;
  denyDetail: string | null;
  isRead: boolean;
  groupCount: number;
  createdAt: string;
}

export interface NotificationListResponse {
  notifications: NotificationItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export async function getNotifications(page = 1): Promise<NotificationListResponse> {
  const res = await authFetch(`${API_URL}/api/v1/notifications?page=${page}`);
  if (!res.ok) throw new Error("notifications_fetch_failed");
  return res.json();
}

export async function markAllNotificationsRead(): Promise<void> {
  await authFetch(`${API_URL}/api/v1/notifications/read-all`, { method: "POST" });
}

export async function getNotificationUnreadCount(): Promise<{ count: number }> {
  const res = await authFetch(`${API_URL}/api/v1/notifications/unread-count`);
  if (!res.ok) return { count: 0 };
  return res.json();
}
