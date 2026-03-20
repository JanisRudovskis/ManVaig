"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { getMyProfile } from "@/lib/auth";
import type { UserProfile } from "@/lib/auth";
import { ProfileCard } from "@/components/profile-card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProfilePage() {
  const t = useTranslations("profile");
  const { isLoggedIn, isLoading: authLoading, user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!isLoggedIn) {
      router.push("/login");
      return;
    }

    getMyProfile()
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isLoggedIn, authLoading, router]);

  if (authLoading || (!isLoggedIn && loading)) {
    return (
      <div className="flex justify-center p-8">
        <div className="w-full max-w-2xl space-y-4">
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex justify-center p-8">
        <p className="text-muted-foreground">{t("errorLoadFailed")}</p>
      </div>
    );
  }

  return (
    <div className="flex justify-center p-4 sm:p-8">
      <ProfileCard
        profile={profile}
        isOwner={true}
        onProfileUpdated={setProfile}
      />
    </div>
  );
}
