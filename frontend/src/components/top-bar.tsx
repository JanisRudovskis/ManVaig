"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth-context";
import { useUnreadCount } from "@/hooks/use-unread-count";

export function TopBar() {
  const { isLoggedIn } = useAuth();
  const { count } = useUnreadCount();

  return (
    <div className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border bg-background px-4">
      {/* Left: sidebar trigger on mobile + brand */}
      <div className="flex items-center gap-3">
        <div className="md:hidden">
          <SidebarTrigger />
        </div>
        <span className="text-sm font-semibold md:hidden">ManVaig</span>
      </div>

      {/* Right: messages icon */}
      <div className="flex items-center gap-2">
        {isLoggedIn && (
          <Link
            href="/messages"
            className="relative flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
            aria-label="Messages"
          >
            <MessageCircle className="size-5" strokeWidth={1.5} />
            {count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none px-1">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Link>
        )}
      </div>
    </div>
  );
}
