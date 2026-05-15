"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2, Users, UserCheck, Pencil, Store, Package, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { FollowButton } from "@/components/follow-button";
import { useAuth } from "@/lib/auth-context";
import { getMyProfile } from "@/lib/auth";
import type { UserProfile } from "@/lib/auth";
import { getFollowers, getFollowing } from "@/lib/follows";
import type { FollowUserDto } from "@/lib/follows";

type Tab = "followers" | "following";

export default function MyPage() {
  const t = useTranslations("myPage");
  const tf = useTranslations("follow");
  const router = useRouter();
  const { isLoggedIn, isLoading: authLoading, user: authUser, openLoginDialog } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("followers");
  const [followers, setFollowers] = useState<FollowUserDto[]>([]);
  const [following, setFollowing] = useState<FollowUserDto[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [listLoading, setListLoading] = useState(false);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      openLoginDialog();
    }
  }, [authLoading, isLoggedIn, openLoginDialog]);

  // Load profile
  useEffect(() => {
    if (!isLoggedIn || !authUser) return;

    setLoading(true);
    getMyProfile()
      .then((data) => {
        setProfile(data);
        setFollowerCount(data.followerCount);
        setFollowingCount(data.followingCount);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isLoggedIn, authUser]);

  // Load follower/following list when tab changes
  const loadList = useCallback(async (tab: Tab) => {
    if (!authUser) return;
    setListLoading(true);
    try {
      if (tab === "followers") {
        const res = await getFollowers(authUser.displayName);
        setFollowers(res.users);
      } else {
        const res = await getFollowing(authUser.displayName);
        setFollowing(res.users);
      }
    } catch {
      // silently fail
    } finally {
      setListLoading(false);
    }
  }, [authUser]);

  useEffect(() => {
    if (isLoggedIn && authUser) {
      loadList(activeTab);
    }
  }, [activeTab, isLoggedIn, authUser, loadList]);

  if (authLoading || loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-3 text-center">
        <Users className="size-10 text-muted-foreground" />
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("loginRequired")}</p>
        <Button onClick={openLoginDialog} className="mt-2">
          {t("logIn")}
        </Button>
      </div>
    );
  }

  if (!profile) return null;

  const tabClass = (tab: Tab) =>
    `flex-1 py-2.5 text-sm font-medium text-center transition-colors rounded-lg ${
      activeTab === tab
        ? "bg-foreground text-background"
        : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
    }`;

  return (
    <div className="flex justify-center p-4 sm:p-8">
      <div className="w-full max-w-2xl space-y-4">
        {/* Profile summary */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-4">
              <UserAvatar
                displayName={profile.displayName}
                avatarUrl={profile.avatarUrl}
                size="lg"
              />
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold truncate">{profile.displayName}</h1>
                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                  <span>
                    <strong className="text-foreground">{followerCount}</strong>{" "}
                    {tf("followers")}
                  </span>
                  <span>
                    <strong className="text-foreground">{followingCount}</strong>{" "}
                    {tf("followingTab")}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick links */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => router.push("/profile")}
            className="flex flex-col items-center gap-1.5 rounded-xl border bg-card p-3 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
          >
            <Pencil className="size-5" />
            <span>{t("editProfile")}</span>
          </button>
          <button
            onClick={() => router.push("/my-stalls")}
            className="flex flex-col items-center gap-1.5 rounded-xl border bg-card p-3 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
          >
            <Store className="size-5" />
            <span>{t("myStalls")}</span>
          </button>
          <button
            onClick={() => router.push("/my-items")}
            className="flex flex-col items-center gap-1.5 rounded-xl border bg-card p-3 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
          >
            <Package className="size-5" />
            <span>{t("myItems")}</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          <button
            className={tabClass("followers")}
            onClick={() => setActiveTab("followers")}
          >
            <Users className="inline size-4 mr-1.5 align-text-bottom" />
            {tf("followers")} ({followerCount})
          </button>
          <button
            className={tabClass("following")}
            onClick={() => setActiveTab("following")}
          >
            <UserCheck className="inline size-4 mr-1.5 align-text-bottom" />
            {tf("followingTab")} ({followingCount})
          </button>
        </div>

        {/* List */}
        {listLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2">
            {activeTab === "followers" && followers.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {tf("noFollowers")}
              </div>
            )}
            {activeTab === "following" && following.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {tf("noFollowing")}
              </div>
            )}
            {(activeTab === "followers" ? followers : following).map((user) => (
              <button
                key={user.userId}
                onClick={() => router.push(`/user/${encodeURIComponent(user.displayName)}`)}
                className="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-accent/50"
              >
                <UserAvatar
                  displayName={user.displayName}
                  avatarUrl={user.avatarUrl}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.displayName}</p>
                  {user.location && (
                    <p className="text-xs text-muted-foreground truncate">{user.location}</p>
                  )}
                </div>
                <ChevronRight className="size-4 text-muted-foreground flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
