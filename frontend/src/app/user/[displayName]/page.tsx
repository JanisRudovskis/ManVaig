"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getPublicProfile, getUserListings } from "@/lib/auth";
import type { UserProfile } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { startConversation } from "@/lib/messages";
import type { PublicItemCard as PublicItemCardType } from "@/lib/items";
import { ProfileCard } from "@/components/profile-card";
import { FollowButton } from "@/components/follow-button";
import { PublicItemCard } from "@/components/public-item-card";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, ArrowRight, Lock, Send } from "lucide-react";

export default function PublicProfilePage() {
  const t = useTranslations("profile");
  const tm = useTranslations("messages");
  const router = useRouter();
  const params = useParams();
  const { isLoggedIn, user: authUser, openLoginDialog } = useAuth();
  const displayName = params.displayName as string;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [listings, setListings] = useState<PublicItemCardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [messagingLoading, setMessagingLoading] = useState(false);

  const handleMessage = async () => {
    if (!isLoggedIn) { openLoginDialog(); return; }
    if (!profile) return;
    setMessagingLoading(true);
    try {
      const conv = await startConversation(profile.userId);
      router.push(`/messages/${conv.id}`);
    } catch {
      router.push("/messages");
    } finally {
      setMessagingLoading(false);
    }
  };

  useEffect(() => {
    if (!displayName) return;
    const decoded = decodeURIComponent(displayName);

    Promise.all([
      getPublicProfile(decoded),
      getUserListings(decoded, 6),
    ])
      .then(([profileData, listingsData]) => {
        setProfile(profileData);
        setListings(listingsData);
      })
      .catch((err) => {
        if (err.message === "profile_not_found") setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [displayName]);

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="w-full max-w-2xl space-y-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="flex flex-col items-center justify-center p-8 gap-2">
        <h2 className="text-xl font-semibold">{t("profileNotFound")}</h2>
        <p className="text-muted-foreground">{t("profilePrivateMessage")}</p>
      </div>
    );
  }

  // Private profile — limited view (avatar + name only) for anonymous visitors
  if (!profile.isProfilePublic && !isLoggedIn) {
    return (
      <div className="flex justify-center p-4 sm:p-8">
        <div className="w-full max-w-2xl">
          <div className="rounded-xl border bg-card p-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <UserAvatar
                displayName={profile.displayName}
                avatarUrl={profile.avatarUrl}
                size="lg"
              />
              <h2 className="text-xl font-bold">{profile.displayName}</h2>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Lock className="size-4" />
                <span className="text-sm">{t("profilePrivate")}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("profilePrivateLoginHint")}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center p-4 sm:p-8">
      <div className="w-full max-w-2xl space-y-6">
        <ProfileCard profile={profile} isOwner={false} />

        {/* Follow row — only for non-owner logged-in users */}
        {isLoggedIn && authUser && profile.userId !== authUser.userId && (
          <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>
                <strong className="text-foreground">{profile.followerCount}</strong>{" "}
                {t("followers")}
              </span>
              <span>
                <strong className="text-foreground">{profile.followingCount}</strong>{" "}
                {t("followingLabel")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleMessage}
                disabled={messagingLoading}
              >
                <Send className="mr-1.5 size-3.5" />
                {tm("messageBidder")}
              </Button>
              <FollowButton
                displayName={profile.displayName}
                isFollowing={profile.isFollowedByMe ?? false}
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
            </div>
          </div>
        )}

        {/* Follower/following counts for owner or anonymous */}
        {(!isLoggedIn || (authUser && profile.userId === authUser.userId)) && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              <strong className="text-foreground">{profile.followerCount}</strong>{" "}
              {t("followers")}
            </span>
            <span>
              <strong className="text-foreground">{profile.followingCount}</strong>{" "}
              {t("followingLabel")}
            </span>
          </div>
        )}

        {/* Active Listings */}
        {listings.length > 0 && (
          <div>
            <h3 className="flex items-center gap-2 mb-3 text-base font-semibold">
              <Package className="size-4 text-muted-foreground" />
              {t("activeListings")}
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {listings.map((item) => (
                <PublicItemCard
                  key={item.id}
                  item={item}
                  onClick={(i) => router.push(`/items/${i.id}`)}
                />
              ))}
            </div>
            {profile.activeListingCount > listings.length && (
              <button
                onClick={() => {
                  // TODO: dedicated /user/[displayName]/items page does not exist yet
                  router.push(`/user/${encodeURIComponent(profile.displayName)}/items`);
                }}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
              >
                {t("viewAllListings", { count: profile.activeListingCount })}
                <ArrowRight className="size-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
