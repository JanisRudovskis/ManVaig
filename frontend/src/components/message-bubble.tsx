"use client";

import { cn } from "@/lib/utils";
import { Check, CheckCheck } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import type { MessageResponse } from "@/lib/messages";

// Simple link detection: finds URLs and /items/[id] patterns
function renderTextWithLinks(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+|\/items\/[a-f0-9-]+)/gi;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      urlRegex.lastIndex = 0; // reset regex state
      const href = part.startsWith("/") ? part : part;
      return (
        <a key={i} href={href} className="underline text-blue-500 hover:text-blue-600 dark:text-blue-400" target={part.startsWith("http") ? "_blank" : undefined} rel={part.startsWith("http") ? "noopener noreferrer" : undefined}>
          {part}
        </a>
      );
    }
    return part;
  });
}

interface MessageBubbleProps {
  message: MessageResponse;
  showAvatar?: boolean;
}

export function MessageBubble({ message, showAvatar = true }: MessageBubbleProps) {
  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={cn("flex gap-2 mb-2", message.isOwnMessage ? "flex-row-reverse" : "flex-row")}>
      {showAvatar && !message.isOwnMessage ? (
        <UserAvatar
          displayName={message.senderDisplayName}
          avatarUrl={message.senderAvatarUrl}
          size="xs"
          className="mt-1 shrink-0"
        />
      ) : (
        <div className="size-6 shrink-0" />
      )}
      <div className={cn(
        "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
        message.isOwnMessage
          ? "bg-blue-600 text-white rounded-br-md"
          : "bg-muted rounded-bl-md"
      )}>
        <p className="whitespace-pre-wrap break-words">{renderTextWithLinks(message.text)}</p>
        <div className={cn(
          "flex items-center gap-1 mt-0.5",
          message.isOwnMessage ? "justify-end" : ""
        )}>
          <span className={cn(
            "text-[11px]",
            message.isOwnMessage ? "text-white/50" : "text-muted-foreground"
          )}>
            {time}
          </span>
          {message.isOwnMessage && (
            message.isRead
              ? <CheckCheck className="size-3 text-white/70" />
              : <Check className="size-3 text-white/35" />
          )}
        </div>
      </div>
    </div>
  );
}
