"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { MessageCircle } from "lucide-react";
import { getConversations, type InboxResponse } from "@/lib/messages";
import { ConversationListItem } from "@/components/conversation-list-item";
import { useAuth } from "@/lib/auth-context";

export default function MessagesPage() {
  const t = useTranslations("messages");
  const { isLoggedIn, isLoading } = useAuth();
  const [data, setData] = useState<InboxResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoading || !isLoggedIn) return;
    setLoading(true);
    getConversations()
      .then(setData)
      .catch(() => setError("error"))
      .finally(() => setLoading(false));
  }, [isLoggedIn, isLoading]);

  if (isLoading) return null;

  if (!isLoggedIn) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center">
        <p className="text-muted-foreground">{t("loginRequired")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold mb-4">{t("title")}</h1>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-3">
              <div className="size-10 rounded-full bg-muted animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                <div className="h-2.5 w-40 bg-muted rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive text-center py-8">{error}</p>
      )}

      {!loading && !error && data && data.conversations.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <MessageCircle className="size-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">{t("noConversations")}</p>
          <p className="text-sm text-muted-foreground/70 mt-1">{t("noConversationsHint")}</p>
        </div>
      )}

      {!loading && !error && data && data.conversations.length > 0 && (
        <div className="space-y-1">
          {data.conversations.map((conv) => (
            <ConversationListItem key={conv.id} conversation={conv} />
          ))}
        </div>
      )}
    </div>
  );
}
