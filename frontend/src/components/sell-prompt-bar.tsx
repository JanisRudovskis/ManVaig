"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { Camera, Tag } from "lucide-react";

export function SellPromptBar() {
  const t = useTranslations("feed");
  const { isLoggedIn, user } = useAuth();
  const router = useRouter();

  const handleClick = () => {
    if (isLoggedIn) {
      router.push("/my-items?action=add");
    } else {
      router.push("/login");
    }
  };

  const initials = user?.displayName
    ? user.displayName.charAt(0).toUpperCase()
    : "?";

  return (
    <div className="mb-4 rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
          {initials}
        </div>

        {/* Prompt button */}
        <button
          onClick={handleClick}
          className="flex-1 rounded-full border border-border bg-muted/50 px-4 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted"
        >
          {t("sellPrompt")}
        </button>
      </div>

      {/* Quick action buttons */}
      <div className="mt-3 flex border-t border-border pt-3">
        <button
          onClick={handleClick}
          className="flex flex-1 items-center justify-center gap-2 rounded-md py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
        >
          <Camera className="size-4 text-emerald-400" />
          {t("sellPhoto")}
        </button>
        <button
          onClick={handleClick}
          className="flex flex-1 items-center justify-center gap-2 rounded-md py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
        >
          <Tag className="size-4 text-blue-400" />
          {t("sellItem")}
        </button>
      </div>
    </div>
  );
}
