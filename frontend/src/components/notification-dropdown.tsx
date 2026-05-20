"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UserAvatar } from "@/components/user-avatar";
import { getNotifications, markAllNotificationsRead, type NotificationItem } from "@/lib/notifications";
import { cn } from "@/lib/utils";

interface NotificationDropdownProps {
  count: number;
  onRead: () => void;
}

export function NotificationDropdown({ count, onRead }: NotificationDropdownProps) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotifications();
      setNotifications(data.notifications);
      setLoaded(true);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  const handleOpenChange = async (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      await fetchNotifications();
      // Mark all as read only after successful fetch
      if (count > 0) {
        markAllNotificationsRead()
          .then(() => onRead())
          .catch(() => {});
      }
    }
  };

  const getNotificationText = (n: NotificationItem) => {
    switch (n.type) {
      case "NewBid":
        return t("newBid", { actor: n.actorDisplayName ?? "?", amount: n.bidAmount ?? 0, itemTitle: n.itemTitle ?? "" });
      case "AuctionEnded":
        return t("auctionEnded", { itemTitle: n.itemTitle ?? "" });
      case "BidAccepted":
        return t("bidAccepted", { itemTitle: n.itemTitle ?? "" });
      case "BidWon":
        return t("bidWon", { itemTitle: n.itemTitle ?? "" });
      case "BidDenied":
        return t("bidDenied", { amount: n.bidAmount ?? 0, itemTitle: n.itemTitle ?? "" });
      case "ItemDeleted":
        return t("itemDeleted", { itemTitle: n.denyReason ?? n.itemTitle ?? "" });
      case "NewItemFromFollowed":
        return n.groupCount > 1
          ? t("newItems", { actor: n.actorDisplayName ?? "?", count: n.groupCount })
          : t("newItem", { actor: n.actorDisplayName ?? "?" });
      case "InstantBuyRequested":
        return t("instantBuyRequested", { actor: n.actorDisplayName ?? "?", itemTitle: n.itemTitle ?? "" });
      case "InstantBuyAccepted":
        return t("instantBuyAccepted", { itemTitle: n.itemTitle ?? "" });
      case "InstantBuyDeclined":
        return t("instantBuyDeclined", { itemTitle: n.itemTitle ?? "" });
      case "AuctionReopened":
        return t("auctionReopened", { itemTitle: n.itemTitle ?? "" });
      case "AuctionClosed":
        return t("auctionClosed", { itemTitle: n.itemTitle ?? "" });
      case "Outbid":
        return t("outbid", { itemTitle: n.itemTitle ?? "", amount: n.bidAmount ?? 0 });
      default:
        return "";
    }
  };

  const getNotificationLink = (n: NotificationItem): string => {
    switch (n.type) {
      case "NewBid":
      case "AuctionEnded":
      case "BidAccepted":
      case "BidWon":
      case "BidDenied":
      case "InstantBuyRequested":
      case "InstantBuyAccepted":
      case "InstantBuyDeclined":
      case "AuctionReopened":
      case "AuctionClosed":
      case "Outbid":
        return n.itemId ? `/items/${n.itemId}/offers` : "/notifications";
      case "ItemDeleted":
        return "/notifications";
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

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        className="relative flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
        aria-label={t("title")}
      >
        <Bell className="size-5" strokeWidth={1.5} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none px-1">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-16px)] p-0" sideOffset={8}>
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">{t("title")}</h3>
        </div>
        <div className="max-h-[360px] overflow-y-auto">
          {loading && !loaded && (
            <div className="flex items-center justify-center py-8">
              <div className="size-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            </div>
          )}
          {loaded && notifications.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">{t("noNotifications")}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("noNotificationsHint")}</p>
            </div>
          )}
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={(e) => {
                e.preventDefault();
                const link = getNotificationLink(n);
                setOpen(false);
                setTimeout(() => router.push(link), 0);
              }}
              className={cn(
                "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                !n.isRead && "bg-muted/30"
              )}
            >
              {n.itemImageUrl ? (
                <img
                  src={n.itemImageUrl}
                  alt=""
                  className="mt-0.5 size-8 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <UserAvatar
                  displayName={n.actorDisplayName ?? ""}
                  avatarUrl={n.actorAvatarUrl}
                  size="xs"
                  className="mt-0.5 shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-snug">{getNotificationText(n)}</p>
                {n.type === "BidDenied" && n.denyReason && (
                  <span className="mt-0.5 block text-[11px] text-red-400/80">
                    {n.denyDetail
                      ? t("bidDeniedReason", { reason: n.denyDetail })
                      : t("bidDeniedReason", { reason: t(`denyReason_${n.denyReason}` as Parameters<typeof t>[0]) })}
                  </span>
                )}
                <span className="block text-xs text-muted-foreground">{formatTime(n.createdAt)}</span>
              </div>
            </button>
          ))}
        </div>
        <div className="border-t border-border">
          <button
            onClick={() => {
              setOpen(false);
              router.push("/notifications");
            }}
            className="flex w-full items-center justify-center py-2.5 text-sm text-primary hover:bg-muted/50 transition-colors"
          >
            {t("seeAll")}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
