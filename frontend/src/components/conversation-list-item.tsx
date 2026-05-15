"use client";

import Link from "next/link";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import type { ConversationListItem as ConversationItem } from "@/lib/messages";

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

interface Props {
  conversation: ConversationItem;
}

export function ConversationListItem({ conversation }: Props) {
  const hasUnread = conversation.unreadCount > 0;

  return (
    <Link
      href={`/messages/${conversation.id}`}
      className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-accent/60 transition-colors"
      aria-label={conversation.otherUserDisplayName}
    >
      <UserAvatar
        displayName={conversation.otherUserDisplayName}
        avatarUrl={conversation.otherUserAvatarUrl}
        size="base"
        className="shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("text-sm truncate", hasUnread && "font-semibold")}>
            {conversation.otherUserDisplayName}
          </span>
          {conversation.lastMessageAt && (
            <span className="text-xs text-muted-foreground shrink-0">
              {formatRelativeTime(conversation.lastMessageAt)}
            </span>
          )}
        </div>
        {conversation.lastMessageText && (
          <p className={cn(
            "text-xs truncate mt-0.5",
            hasUnread ? "text-foreground font-medium" : "text-muted-foreground"
          )}>
            {conversation.lastMessageText}
          </p>
        )}
      </div>
      {hasUnread && (
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
          {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
        </span>
      )}
    </Link>
  );
}
