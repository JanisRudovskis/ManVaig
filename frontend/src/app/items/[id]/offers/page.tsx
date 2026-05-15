"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { fetchPublicItem } from "@/lib/items";
import type { PublicItemDetail } from "@/lib/items";
import { formatPrice, isEnded } from "@/components/item-card-shared";
import {
  BidsSummaryBar,
  BidListBody,
  PlaceBidForm,
  ImageGallery,
} from "@/components/offers-popup";
import { startConversation } from "@/lib/messages";
import { useOffersBids } from "@/hooks/use-offers-bids";
import { ArrowLeft, Loader2, Volume2, VolumeOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

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

// === Page ===

export default function OffersPage() {
  const params = useParams();
  const itemId = params.id as string;
  const t = useTranslations("offers");

  const [item, setItem] = useState<PublicItemDetail | null>(null);
  const [itemLoading, setItemLoading] = useState(true);
  const [showGallery, setShowGallery] = useState(false);

  const { startBlink } = useTabBlink();

  useEffect(() => {
    fetchPublicItem(itemId)
      .then(setItem)
      .catch(() => {})
      .finally(() => setItemLoading(false));
  }, [itemId]);

  useEffect(() => {
    if (item) document.title = `${t("title")} — ${item.title}`;
  }, [item, t]);

  const bids = useOffersBids({
    itemId,
    soundDefaultOff: true,
    onNewExternalBid: (topBid) => {
      if (document.hidden) startBlink(`🔔 ${t("newBid")} ${formatPrice(topBid.amount)}`);
    },
  });

  const router = useRouter();

  // Show message buttons: timed items → only after ended, non-timed → always
  const biddingEnded = bids.data?.endDate ? isEnded(bids.data.endDate as string) : true;
  const canMessage = bids.data?.isOwner && biddingEnded;

  const handleMessage = async (bidderId: string) => {
    try {
      const conv = await startConversation(bidderId);
      router.push(`/messages/${conv.id}`);
    } catch {
      bids.setError("error_message_failed");
    }
  };

  if (itemLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-64px)] max-w-[540px] flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-4 py-4 md:px-6">
        <Link href={`/items/${itemId}`} className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-3.5" />
          {item?.title ?? "Back"}
        </Link>
        {showGallery && item && item.images.length > 0 && (
          <ImageGallery images={item.images} onClose={() => setShowGallery(false)} />
        )}
        <div className="flex items-center gap-3">
          {item?.images[0] && (
            <button onClick={() => setShowGallery(true)} className="shrink-0 overflow-hidden rounded-lg transition-opacity hover:opacity-80">
              <img src={item.images[0].url} alt="" className="size-14 object-cover" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold">{t("title")}</h1>
            <p className="text-sm text-muted-foreground truncate">{item?.title}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={bids.toggleSound}
              className={`flex size-10 shrink-0 items-center justify-center rounded-full transition-colors ${bids.soundEnabled ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
              title={bids.soundEnabled ? t("soundEnabled") : t("soundDisabled")}
            >
              {bids.soundEnabled ? <Volume2 className="size-5" /> : <VolumeOff className="size-5" />}
            </button>
            <button onClick={bids.manualRefresh} disabled={bids.manualRefreshing} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground" title="Refresh">
              <RefreshCw className={cn("size-5 transition-transform", bids.manualRefreshing && "animate-spin")} />
            </button>
          </div>
        </div>
      </div>

      {/* Status banner */}
      <div className="shrink-0 space-y-2 border-b border-border px-4 py-3 md:px-6">
        <BidsSummaryBar data={bids.data} lastUpdatedAt={bids.lastUpdatedAt} staleWarningMs={bids.staleWarningMs} staleDangerMs={bids.staleDangerMs} connectionLost={bids.connectionLost} onRefresh={bids.manualRefresh} t={t} />
      </div>

      {/* Bid list (scrollable) */}
      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
        <BidListBody
          data={bids.data}
          loading={bids.loading}
          error={bids.error ? t(`error_${bids.error}`) : ""}
          topBidFlash={bids.topBidFlash}
          newBidIds={bids.newBidIds}
          manualRefreshing={bids.manualRefreshing}
          hasMore={bids.hasMore}
          expanded={bids.expanded}
          t={t}
          onShowAll={() => bids.setExpanded(true)}
          onShowLess={() => bids.setExpanded(false)}
          onMessage={canMessage ? handleMessage : undefined}
        />
      </div>

      {/* Bottom: Place Bid form */}
      <div className="shrink-0 border-t border-border px-4 py-3 md:px-6">
        {bids.data ? (
          <PlaceBidForm data={bids.data} itemId={itemId} t={t} onBidPlaced={() => bids.loadBids(bids.currentLimit)} inputFocusedRef={bids.inputFocusedRef} />
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="h-10 flex-1 animate-pulse rounded-md bg-muted" />
              <div className="h-10 w-28 animate-pulse rounded-md bg-muted" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
