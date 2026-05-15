"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Calendar,
  MessageCircle,
  Send,
  Store,
  Package,
  Handshake,
  Circle,
  Loader2,
  Mail,
  Phone,
  Lock,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { UserAvatar } from "@/components/user-avatar";
import { BadgeDisplay } from "@/components/badge-display";
import { FollowButton } from "@/components/follow-button";
import { PublicItemCard } from "@/components/public-item-card";
import { getPublicProfile, getUserListings } from "@/lib/auth";
import type { UserProfile } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import type { PublicItemCard as PublicItemCardType } from "@/lib/items";
import { getLastSeenStatus, formatMemberDate } from "@/lib/profile-utils";

interface ProfilePopupProps {
  displayName: string;
  onClose: () => void;
}

export function ProfilePopup({ displayName, onClose }: ProfilePopupProps) {
  const t = useTranslations("profile");
  const locale = useLocale();
  const router = useRouter();
  const { isLoggedIn, user: authUser } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [listings, setListings] = useState<PublicItemCardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);

    Promise.all([
      getPublicProfile(displayName),
      getUserListings(displayName, 4),
    ])
      .then(([profileData, listingsData]) => {
        setProfile(profileData);
        setListings(listingsData);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [displayName]);

  const memberDate = profile ? formatMemberDate(profile.memberSince, locale) : "";
  const lastSeen = profile ? getLastSeenStatus(profile.lastSeenAt, t) : null;
  const hasAnyContact = profile
    ? !!(profile.publicEmail || profile.publicPhone || profile.publicWhatsAppUrl || profile.publicTelegramUrl)
    : false;

  const handleItemClick = useCallback((item: PublicItemCardType) => {
    onClose();
    router.push(`/items/${item.id}`);
  }, [onClose, router]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={
          // bottom-sheet on mobile, centered modal on desktop
          "flex max-h-[85vh] w-full flex-col gap-0 overflow-hidden bg-card p-0 " +
          "top-auto bottom-0 left-0 max-w-full -translate-x-0 -translate-y-0 rounded-b-none rounded-t-2xl " +
          "sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[70vh] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
        }
        showCloseButton={true}
      >
        <DialogTitle className="sr-only">{t("profileTitle")}</DialogTitle>

        {/* Visible header label */}
        <div className="flex items-center border-b border-border px-4 py-3">
          <span className="text-sm font-semibold text-muted-foreground">
            {t("profileTitle")}
          </span>
        </div>

        {/* Content — scrollable */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <p className="text-sm font-medium">{t("profileNotFound")}</p>
              <p className="text-xs text-muted-foreground">{t("profilePrivateMessage")}</p>
            </div>
          )}

          {/* Private profile — limited view (only for anonymous visitors) */}
          {profile && !loading && !profile.isProfilePublic && !isLoggedIn && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <UserAvatar
                displayName={profile.displayName}
                avatarUrl={profile.avatarUrl}
                size="lg"
              />
              <h2 className="text-lg font-bold">{profile.displayName}</h2>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Lock className="size-4" />
                <span className="text-sm">{t("profilePrivate")}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("profilePrivateLoginHint")}
              </p>
            </div>
          )}

          {profile && !loading && (profile.isProfilePublic || isLoggedIn) && (
            <div className="space-y-4">
              {/* Avatar + Name + Info */}
              <div className="flex gap-4">
                <UserAvatar
                  displayName={profile.displayName}
                  avatarUrl={profile.avatarUrl}
                  size="lg"
                />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div>
                    <h2 className="text-lg font-bold truncate">{profile.displayName}</h2>
                    <BadgeDisplay badges={profile.displayedBadges} />
                  </div>

                  {profile.location && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="size-3.5 flex-shrink-0" />
                      <span className="truncate">{profile.location}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Calendar className="size-3.5 flex-shrink-0" />
                    <span>{t("memberSince")} {memberDate}</span>
                  </div>

                  {lastSeen && lastSeen.text && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Circle
                        className={`size-3 flex-shrink-0 fill-current ${
                          lastSeen.isOnline ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/50"
                        }`}
                      />
                      <span className={lastSeen.isOnline ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}>
                        {lastSeen.text}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats bar */}
              {(profile.stallCount > 0 || profile.activeListingCount > 0 || profile.completedDealCount > 0) && (
                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs">
                    <Store className="size-3 text-muted-foreground" />
                    <span className="font-medium">{profile.stallCount}</span>
                    <span className="text-muted-foreground">{t("statsStalls", { count: profile.stallCount })}</span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs">
                    <Package className="size-3 text-muted-foreground" />
                    <span className="font-medium">{profile.activeListingCount}</span>
                    <span className="text-muted-foreground">{t("statsItems", { count: profile.activeListingCount })}</span>
                  </div>
                  {profile.completedDealCount > 0 && (
                    <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs">
                      <Handshake className="size-3 text-emerald-600 dark:text-emerald-400" />
                      <span className="font-medium text-emerald-700 dark:text-emerald-300">{profile.completedDealCount}</span>
                      <span className="text-emerald-700/80 dark:text-emerald-300/80">{t("statsDeals", { count: profile.completedDealCount })}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Follow button — non-owner only */}
              {isLoggedIn && authUser && profile.userId !== authUser.userId && (
                <FollowButton
                  displayName={profile.displayName}
                  isFollowing={profile.isFollowedByMe ?? false}
                  size="sm"
                  onFollowChange={(following) => {
                    setProfile((prev) =>
                      prev
                        ? {
                            ...prev,
                            isFollowedByMe: following,
                            followerCount: prev.followerCount + (following ? 1 : -1),
                          }
                        : prev
                    );
                  }}
                />
              )}

              {/* Bio */}
              {profile.bio && (
                <p className="text-sm text-muted-foreground">{profile.bio}</p>
              )}

              {/* Contact channels — clickable links */}
              {hasAnyContact && (
                <div className="flex flex-wrap gap-2">
                  {profile.publicEmail && (
                    <a
                      href={`mailto:${profile.publicEmail}`}
                      className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs transition-colors hover:bg-muted/80"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Mail className="size-3.5 text-muted-foreground" />
                      <span className="truncate max-w-[160px]">{profile.publicEmail}</span>
                    </a>
                  )}
                  {profile.publicPhone && (
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`tel:${profile.publicPhone}`}
                        className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs transition-colors hover:bg-muted/80"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Phone className="size-3.5 text-muted-foreground" />
                        <span>{profile.publicPhone}</span>
                      </a>
                      {profile.publicWhatsAppUrl && (
                        <a
                          href={profile.publicWhatsAppUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1.5 text-xs text-green-700 dark:text-green-300 transition-colors hover:bg-green-500/20"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MessageCircle className="size-3.5" />
                          WhatsApp
                        </a>
                      )}
                    </div>
                  )}
                  {profile.publicTelegramUrl && (
                    <a
                      href={profile.publicTelegramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1.5 text-xs text-blue-700 dark:text-blue-300 transition-colors hover:bg-blue-500/20"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Send className="size-3.5" />
                      Telegram
                    </a>
                  )}
                </div>
              )}

              {/* Active listings */}
              {listings.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                    {t("activeListings")}
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {listings.map((item) => (
                      <PublicItemCard
                        key={item.id}
                        item={item}
                        onClick={handleItemClick}
                      />
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
