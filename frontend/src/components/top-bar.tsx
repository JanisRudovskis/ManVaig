"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth-context";
import { useRealtime } from "@/hooks/use-realtime";
import { NotificationDropdown } from "@/components/notification-dropdown";

export function TopBar() {
  const t = useTranslations("messages");
  const { isLoggedIn } = useAuth();
  const { messageCount, notificationCount, setNotificationCount } = useRealtime();

  return (
    <div className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-background px-4">
      {/* Left: sidebar trigger on mobile + brand */}
      <div className="flex items-center gap-3">
        <div className="md:hidden">
          <SidebarTrigger />
        </div>
        <span className="text-sm font-semibold md:hidden">ManVaig</span>
      </div>

      {/* Right: messages + notifications */}
      <div className="flex items-center gap-2">
        {isLoggedIn && (
          <>
            <Link
              href="/messages"
              className="relative flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
              aria-label={t("title")}
            >
              <MessageCircle className="size-5" strokeWidth={1.5} />
              {messageCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none px-1">
                  {messageCount > 99 ? "99+" : messageCount}
                </span>
              )}
            </Link>
            <NotificationDropdown
              count={notificationCount}
              onRead={() => setNotificationCount(0)}
            />
          </>
        )}
      </div>
    </div>
  );
}
