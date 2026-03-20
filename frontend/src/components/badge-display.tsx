"use client";

import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";
import type { Badge as BadgeType } from "@/lib/auth";

interface BadgeDisplayProps {
  badges: BadgeType[];
}

export function BadgeDisplay({ badges }: BadgeDisplayProps) {
  if (badges.length === 0) return null;

  return (
    <div className="flex gap-1.5 flex-wrap">
      {badges.map((badge) => (
        <Badge key={badge.id} variant="secondary" className="gap-1">
          <Trophy className="size-3" />
          {badge.name}
        </Badge>
      ))}
    </div>
  );
}
