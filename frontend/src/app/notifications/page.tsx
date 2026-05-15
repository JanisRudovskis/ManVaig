"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bell } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getNotifications, type NotificationItem } from "@/lib/notifications";
import { UserAvatar } from "@/components/user-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function NotificationsPage() {
  const t = useTranslations("notifications");
  const router = useRouter();
  const { isLoggedIn, isLoading } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const fetchNotifications = useCallback(async (p: number) => {
    if (p > 1) setLoadingMore(true);
    try {
      const data = await getNotifications(p);
      if (p === 1) {
        setNotifications(data.notifications);
      } else {
        setNotifications((prev) => [...prev, ...data.notifications]);
      }
      setTotalCount(data.totalCount);
      setError(false);
    } catch {
      if (p === 1) setError(true);
    }
    finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (isLoading || !isLoggedIn) return;
    fetchNotifications(1);
  }, [isLoggedIn, isLoading, fetchNotifications]);

  const getNotificationText = (n: NotificationItem) => {
    switch (n.type) {
      case "NewBid":
        return t("newBid", { actor: n.actorDisplayName ?? "?", amount: n.bidAmount ?? 0, itemTitle: n.itemTitle ?? "" });
      case "AuctionEnded":
        return t("auctionEnded", { itemTitle: n.itemTitle ?? "" });
      case "BidAccepted":
        return t("bidAccepted", { itemTitle: n.itemTitle ?? "" });
      case "NewItemFromFollowed":
        return n.groupCount > 1
          ? t("newItems", { actor: n.actorDisplayName ?? "?", count: n.groupCount })
          : t("newItem", { actor: n.actorDisplayName ?? "?" });
      default:
        return "";
    }
  };

  const getNotificationLink = (n: NotificationItem): string => {
    switch (n.type) {
      case "NewBid":
      case "AuctionEnded":
      case "BidAccepted":
        return n.itemId ? `/items/${n.itemId}` : "/notifications";
      case "NewItemFromFollowed":
        if (n.groupCount > 1 && n.actorDisplayName)
          return `/user/${encodeURIComponent(n.actorDisplayName)}`;
        return n.itemId ? `/items/${n.itemId}` : "/notifications";
      default:
        return "/notifications";
    }
  };

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t("justNow");
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  if (isLoading || loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-2 p-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center p-8 gap-2">
        <Bell className="size-10 text-muted-foreground" />
        <p className="text-muted-foreground">{t("loginRequired")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center">
        <Bell className="mx-auto size-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">{t("loadError")}</p>
        <button onClick={() => { setLoading(true); setError(false); fetchNotifications(1); }} className="text-sm text-primary mt-2 underline">
          {t("retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="px-4 py-4 text-lg font-semibold">{t("title")}</h1>

      {notifications.length === 0 && (
        <div className="py-12 text-center">
          <Bell className="mx-auto size-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">{t("noNotifications")}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("noNotificationsHint")}</p>
        </div>
      )}

      <div className="divide-y divide-border">
        {notifications.map((n) => (
          <button
            key={n.id}
            onClick={() => router.push(getNotificationLink(n))}
            className={cn(
              "flex w-full items-start gap-3 px-4 py-3 min-h-[44px] text-left transition-colors hover:bg-muted/50",
              !n.isRead && "bg-muted/30"
            )}
          >
            {n.itemImageUrl ? (
              <img
                src={n.itemImageUrl}
                alt=""
                className="mt-0.5 size-10 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <UserAvatar
                displayName={n.actorDisplayName ?? ""}
                avatarUrl={n.actorAvatarUrl}
                size="base"
                className="mt-0.5 shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm leading-snug">{getNotificationText(n)}</p>
              <span className="text-xs text-muted-foreground">{formatTime(n.createdAt)}</span>
            </div>
          </button>
        ))}
      </div>

      {notifications.length < totalCount && (
        <button
          onClick={() => {
            if (loadingMore) return;
            const nextPage = Math.ceil(notifications.length / 20) + 1;
            fetchNotifications(nextPage);
          }}
          disabled={loadingMore}
          className="flex w-full items-center justify-center py-3 text-sm text-primary hover:bg-muted/50 transition-colors disabled:opacity-50"
        >
          {loadingMore ? t("loading") : t("loadMore")}
        </button>
      )}
    </div>
  );
}
