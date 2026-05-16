"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { fetchPublicItem } from "@/lib/items";
import type { PublicItemDetail } from "@/lib/items";
import { OffersPopup } from "@/components/offers-popup";
import { Loader2 } from "lucide-react";

// === Tab title blink hook ===

function useTabBlink() {
  const originalTitleRef = useRef("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startBlink = useCallback((message: string) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!originalTitleRef.current) originalTitleRef.current = document.title;

    let show = true;
    intervalRef.current = setInterval(() => {
      document.title = show ? message : originalTitleRef.current;
      show = !show;
    }, 1000);
  }, []);

  const stopBlink = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (originalTitleRef.current) document.title = originalTitleRef.current;
  }, []);

  useEffect(() => {
    const handleVisibility = () => { if (!document.hidden) stopBlink(); };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => { document.removeEventListener("visibilitychange", handleVisibility); stopBlink(); };
  }, [stopBlink]);

  return { startBlink, stopBlink };
}

// === Page — embeds the ticker popup inline (full-tab mode) ===

export default function OffersPage() {
  const params = useParams();
  const itemId = params.id as string;
  const t = useTranslations("offers");
  const router = useRouter();

  const [item, setItem] = useState<PublicItemDetail | null>(null);
  const [itemLoading, setItemLoading] = useState(true);

  const { startBlink } = useTabBlink();

  useEffect(() => {
    fetchPublicItem(itemId)
      .then(setItem)
      .catch(() => {})
      .finally(() => setItemLoading(false));
  }, [itemId]);

  useEffect(() => {
    if (item) document.title = `${item.title} — ${t("title")}`;
  }, [item, t]);

  if (itemLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Render the full Ticker popup as an inline embed
  // (The popup handles its own data fetching via useOffersBids)
  return (
    <div className="mx-auto flex h-[calc(100vh-64px)] max-w-[540px] flex-col items-center justify-center">
      <OffersPopup
        itemId={itemId}
        itemTitle={item?.title ?? ""}
        itemImageUrl={(item?.images.find(i => i.isPrimary) ?? item?.images[0])?.url}
        onClose={() => router.push(`/items/${itemId}`)}
      />
    </div>
  );
}
