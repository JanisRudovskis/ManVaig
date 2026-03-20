"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { getPublicProfile } from "@/lib/auth";
import type { UserProfile } from "@/lib/auth";
import { ProfileCard } from "@/components/profile-card";
import { Skeleton } from "@/components/ui/skeleton";

export default function PublicProfilePage() {
  const t = useTranslations("profile");
  const params = useParams();
  const displayName = params.displayName as string;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!displayName) return;

    getPublicProfile(decodeURIComponent(displayName))
      .then(setProfile)
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

  return (
    <div className="flex justify-center p-4 sm:p-8">
      <ProfileCard profile={profile} isOwner={false} />
    </div>
  );
}
