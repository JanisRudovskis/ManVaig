"use client";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const AVATAR_COLORS = [
  "bg-blue-600",
  "bg-emerald-600",
  "bg-violet-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-cyan-600",
  "bg-fuchsia-600",
  "bg-teal-600",
];

function getColorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitial(name: string): string {
  return (name.charAt(0) || "?").toUpperCase();
}

const sizeClasses = {
  sm: "!size-8 text-xs",
  md: "!size-16 text-xl",
  lg: "!size-24 text-3xl",
};

interface UserAvatarProps {
  displayName: string;
  avatarUrl: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  onClick?: () => void;
}

export function UserAvatar({
  displayName,
  avatarUrl,
  size = "md",
  className,
  onClick,
}: UserAvatarProps) {
  const colorClass = getColorForName(displayName);

  return (
    <Avatar
      className={cn(sizeClasses[size], onClick && "cursor-pointer", className)}
      onClick={onClick}
    >
      {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
      <AvatarFallback className={cn(colorClass, "text-white font-semibold")}>
        {getInitial(displayName)}
      </AvatarFallback>
    </Avatar>
  );
}
