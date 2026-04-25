"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { X, Loader2, HandCoins } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchBids, assignNextWinner } from "@/lib/items";
import type { ItemResponse, BidListResponse } from "@/lib/items";

interface BidsModalProps {
  item: ItemResponse;
  onClose: () => void;
}

export function BidsModal({ item, onClose }: BidsModalProps) {
  const t = useTranslations("itemForm");
  const locale = useLocale();
  const [bidData, setBidData] = useState<BidListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchBids(item.id)
      .then(setBidData)
      .catch(() => setError(t("apiError_bids_fetch_failed")))
      .finally(() => setLoading(false));
  }, [item.id, t]);

  const handleAssignNext = async () => {
    try {
      await assignNextWinner(item.id);
      const updated = await fetchBids(item.id);
      setBidData(updated);
    } catch {
      setError(t("apiError_assign_next_failed"));
    }
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-4 z-51 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl md:inset-auto md:left-1/2 md:top-1/2 md:max-h-[70vh] md:w-[480px] md:-translate-x-1/2 md:-translate-y-1/2">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <HandCoins className="size-5 text-orange-500" />
            <div>
              <h2 className="text-base font-semibold">{t("bidsTitle")}</h2>
              <p className="text-xs text-muted-foreground line-clamp-1">{item.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Summary bar */}
        {bidData && (
          <div className="flex items-center gap-4 border-b border-border bg-muted/30 px-6 py-3">
            <div className="flex-1">
              <span className="text-xs text-muted-foreground">{t("bidsTitle")}</span>
              <p className="text-lg font-bold">{bidData.totalBids}</p>
            </div>
            {bidData.highestBid != null && (
              <div className="text-right">
                <span className="text-xs text-muted-foreground">
                  {bidData.auctionEnded ? t("winner") : "Top"}
                </span>
                <p className="text-lg font-bold text-emerald-400">
                  €{bidData.highestBid.toFixed(2)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t("loadingBids")}
            </div>
          ) : error ? (
            <p className="py-12 text-center text-sm text-destructive">{error}</p>
          ) : !bidData || bidData.bids.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <HandCoins className="size-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t("noBids")}</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {bidData.bids.map((bid, index) => (
                <div
                  key={bid.id}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
                    bid.isWinner && bidData.auctionEnded
                      ? "border-l-4 border-emerald-500 bg-emerald-500/10"
                      : index === 0 && !bidData.auctionEnded
                        ? "bg-muted/60"
                        : "bg-muted/30"
                  )}
                >
                  {/* Rank */}
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                    {index + 1}
                  </span>

                  {/* Bidder info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {bid.bidderName ?? bid.bidderLabel}
                      </span>
                      {bid.isWinner && bidData.auctionEnded && (
                        <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[0.65rem] font-semibold text-emerald-400">
                          {t("winner")}
                        </span>
                      )}
                      {bid.status === "Expired" && (
                        <span className="shrink-0 rounded-full bg-red-500/20 px-2 py-0.5 text-[0.65rem] font-semibold text-red-400">
                          {t("expired")}
                        </span>
                      )}
                    </div>
                    {bid.bidderContact && bidData.auctionEnded && bid.isWinner && (
                      <p className="text-xs text-muted-foreground truncate">{bid.bidderContact}</p>
                    )}
                  </div>

                  {/* Amount + time */}
                  <div className="shrink-0 text-right">
                    <span className="font-semibold text-emerald-400">€{bid.amount.toFixed(2)}</span>
                    <p className="text-[0.65rem] text-muted-foreground">
                      {new Date(bid.createdAt).toLocaleDateString(locale, {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}

              {/* Assign next winner button */}
              {bidData.auctionEnded &&
                bidData.winnerExpiresAt &&
                new Date(bidData.winnerExpiresAt) < new Date() && (
                  <button
                    type="button"
                    onClick={handleAssignNext}
                    className="mt-3 w-full rounded-md bg-orange-500/15 px-3 py-2.5 text-sm font-medium text-orange-400 transition-colors hover:bg-orange-500/25"
                  >
                    {t("assignNextWinner")}
                  </button>
                )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
