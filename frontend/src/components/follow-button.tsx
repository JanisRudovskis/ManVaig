"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { UserPlus, UserCheck, UserMinus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { followUser, unfollowUser } from "@/lib/follows";

interface FollowButtonProps {
  displayName: string;
  isFollowing: boolean;
  onFollowChange?: (isFollowing: boolean) => void;
  size?: "sm" | "default";
}

export function FollowButton({
  displayName,
  isFollowing: initialIsFollowing,
  onFollowChange,
  size = "default",
}: FollowButtonProps) {
  const t = useTranslations("follow");
  const { isLoggedIn, openLoginDialog } = useAuth();
  const isMobile = useIsMobile();
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [error, setError] = useState(false);

  // Sync state when prop changes (e.g., profile data reloaded)
  useEffect(() => {
    setIsFollowing(initialIsFollowing);
  }, [initialIsFollowing]);

  // Clear error after 3 seconds
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(false), 3000);
    return () => clearTimeout(timer);
  }, [error]);

  const handleClick = async () => {
    if (!isLoggedIn) {
      openLoginDialog();
      return;
    }

    setLoading(true);
    setError(false);
    try {
      if (isFollowing) {
        await unfollowUser(displayName);
        setIsFollowing(false);
        onFollowChange?.(false);
      } else {
        await followUser(displayName);
        setIsFollowing(true);
        onFollowChange?.(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Button
        variant={isFollowing ? "outline" : "default"}
        size={size}
        disabled
        className="min-w-[100px]"
      >
        <Loader2 className="size-4 animate-spin" />
      </Button>
    );
  }

  if (isFollowing) {
    // Mobile: tap toggles directly (no hover state)
    // Desktop: hover reveals "Unfollow" with destructive styling
    const showUnfollow = isMobile || hovered;

    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          variant="outline"
          size={size}
          onClick={handleClick}
          onMouseEnter={() => !isMobile && setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className={`min-w-[100px] transition-colors ${
            showUnfollow
              ? "border-destructive text-destructive hover:bg-destructive/10"
              : ""
          }`}
        >
          {showUnfollow ? (
            <>
              <UserMinus className="size-4 mr-1.5" />
              {t("unfollow")}
            </>
          ) : (
            <>
              <UserCheck className="size-4 mr-1.5" />
              {t("following")}
            </>
          )}
        </Button>
        {error && (
          <span className="text-xs text-destructive">{t("followError")}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size={size}
        onClick={handleClick}
        className="min-w-[100px]"
      >
        <UserPlus className="size-4 mr-1.5" />
        {t("follow")}
      </Button>
      {error && (
        <span className="text-xs text-destructive">{t("followError")}</span>
      )}
    </div>
  );
}
