"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getPublicProfile, getUserListings } from "@/lib/auth";
import type { UserProfile } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import type { PublicItemCard as PublicItemCardType } from "@/lib/items";
import { ProfileCard } from "@/components/profile-card";
import { PublicItemCard } from "@/components/public-item-card";
import { UserAvatar } from "@/components/user-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, ArrowRight, Lock } from "lucide-react";

export default function PublicProfilePage() {
  const t = useTranslations("profile");
  const router = useRouter();
  const params = useParams();
  const { isLoggedIn } = useAuth();
  const displayName = params.displayName as string;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [listings, setListings] = useState<PublicItemCardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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
