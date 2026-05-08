"use client";

import Link from "next/link";
import { Mail, MessageCircle, Phone, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { useRelativeTime } from "@/lib/use-relative-time";
import type { PublicUserCard as PublicUserCardData } from "@/lib/users";

interface PublicUserCardProps {
  user: PublicUserCardData;
}

export function PublicUserCard({ user }: PublicUserCardProps) {
  const t = useTranslations("people");
  const formatRelativeTime = useRelativeTime();

  const memberSinceYear = new Date(user.memberSince).getFullYear();
  const hasAnyContact =
    user.hasWhatsApp || user.hasTelegram || user.hasPhone || user.hasEmail;

  return (
    <Link
      href={`/user/${encodeURIComponent(user.displayName)}`}
      className="group flex w-full items-start gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-border/60 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <UserAvatar
        displayName={user.displayName}
        avatarUrl={user.avatarUrl}
        size="md"
        className="shrink-0"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-base font-semibold leading-tight">
          {user.displayName}
        </span>

        <span className="truncate text-xs text-muted-foreground">
          {t("memberSinceShort", { year: memberSinceYear })}
        </span>

        <span className="truncate text-xs text-muted-foreground">
          {formatRelativeTime(user.lastSeenAt)}
        </span>

        {hasAnyContact && (
          <div className="mt-1 flex items-center gap-2">
            {user.hasWhatsApp && (
              <MessageCircle
                className="size-4 text-muted-foreground"
                aria-label={t("contactWhatsApp")}
              />
            )}
            {user.hasTelegram && (
              <Send
                className="size-4 text-muted-foreground"
                aria-label={t("contactTelegram")}
              />
            )}
            {user.hasPhone && (
              <Phone
                className="size-4 text-muted-foreground"
                aria-label={t("contactPhone")}
              />
            )}
            {user.hasEmail && (
              <Mail
                className="size-4 text-muted-foreground"
                aria-label={t("contactEmail")}
              />
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

export function PublicUserCardSkeleton() {
  return (
    <div className="flex w-full items-start gap-3 rounded-xl border border-border bg-card p-3">
      <Skeleton className="size-16 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-28" />
        <div className="mt-1 flex items-center gap-2">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="size-4 rounded" />
        </div>
      </div>
    </div>
  );
}
