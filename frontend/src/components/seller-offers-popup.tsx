"use client";

import { useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X, Loader2, ChevronDown, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/user-avatar";
import { formatPrice, isEnded } from "@/components/item-card-shared";
import { denyBidder } from "@/lib/items";
import type { BidListResponse, UniqueBidder } from "@/lib/items";
import { useOffersBids, INITIAL_LIMIT } from "@/hooks/use-offers-bids";

// ─── Shared helpers (re-used from offers-popup) ──────────────────────

/** Human-readable "2 min ago" / "just now" / "3h ago" */
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60_000) return "just now";
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/** "ends in 4h 12m" */
function formatEndsIn(endDate: string): string {
  const diff = new Date(endDate).getTime() - Date.now();
  if (diff <= 0) return "";
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  if (d >= 1) return `${d}d ${h}h`;
  if (h >= 1) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

// ─── Crown icon ──────────────────────────────────────────────────────

function CrownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M3 19 L5.5 4 L9 13 L12 8 L15 13 L18.5 4 L21 19 Z" />
    </svg>
  );
}

// ─── Types ───────────────────────────────────────────────────────────

type UrgencyState = "final-10m" | "final-minute" | "live" | "ended" | "sold";

// ─── Summary line ────────────────────────────────────────────────────

function SellerSummaryLine({
  data,
  t,
}: {
  data: BidListResponse;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const activeBidders = data.uniqueBidders?.filter((b) => !b.isDenied) ?? [];
  const uniqueCount = activeBidders.length;
  const topAmount = data.highestBid;

  let timeClause: string | null = null;
  if (data.isSold) timeClause = t("sold");
  else if (data.endDate && isEnded(data.endDate)) timeClause = t("biddingEnded");
  else if (data.endDate)
    timeClause = t("endsInPhrase", { value: formatEndsIn(data.endDate) });

  if (uniqueCount === 0) {
    return (
      <div className="flex flex-none items-center justify-center border-b border-ticker-line px-5 pb-4 pt-[18px]">
        <span className="text-[13px] text-ticker-dim">
          {t("noActiveOffers")}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-none items-baseline gap-[10px] border-b border-ticker-line px-5 pb-4 pt-[18px]">
      <span className="font-[family-name:var(--font-ticker)] text-[30px] font-bold leading-none tracking-[-0.015em] tabular-nums text-ticker-emer">
        {formatPrice(topAmount!)}
      </span>
      <span className="text-ticker-dim">·</span>
      <span className="text-[12.5px] text-ticker-mid">
        {t("topOfBidders", { count: uniqueCount })}
        {timeClause ? ` · ${timeClause}` : ""}
      </span>
    </div>
  );
}

// ─── Bidder card ─────────────────────────────────────────────────────

function BidderCard({
  bidder,
  onDeny,
  t,
}: {
  bidder: UniqueBidder;
  onDeny: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const isDenied = bidder.isDenied;
  const [detailExpanded, setDetailExpanded] = useState(false);

  return (
    <div
      className={cn(
        "grid items-center gap-3.5 rounded-xl bg-ticker-bg-2 p-[12px_12px_12px_14px]",
        isDenied
          ? "grid-cols-[auto_1fr_auto] opacity-50"
          : "grid-cols-[auto_1fr_auto_auto]",
        bidder.isTop &&
          !isDenied &&
          "border border-ticker-emer/[0.22] bg-[oklch(0.78_0.18_165/0.08)]"
      )}
    >
      {/* Avatar */}
      <UserAvatar
        displayName={bidder.bidderName}
        avatarUrl={bidder.bidderAvatarUrl}
        size="base"
      />

      {/* Meta */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "truncate text-[14.5px] font-medium",
              isDenied ? "text-ticker-dim" : "text-ticker-text"
            )}
          >
            {bidder.bidderName}
          </span>
          {isDenied && (
            <span className="shrink-0 rounded-full bg-ticker-red/15 px-1.5 py-[2px] font-[family-name:var(--font-ticker)] text-[9.5px] font-bold uppercase tracking-[0.14em] text-ticker-red">
              {t("deny")}
            </span>
          )}
          {!isDenied && bidder.isTop && (
            <span
              className="inline-flex size-[22px] shrink-0 items-center justify-center rounded-md bg-ticker-emer/15 text-ticker-emer"
              aria-label={t("topBidder")}
              title={t("topBidder")}
            >
              <CrownIcon className="size-4" />
            </span>
          )}
          {!isDenied && bidder.bidCount >= 2 && (
            <span className="shrink-0 rounded-full bg-ticker-amber/15 px-1.5 py-[2px] font-[family-name:var(--font-ticker)] text-[9.5px] font-bold tracking-[0.1em] text-ticker-amber">
              {t("hotPill", { count: bidder.bidCount })}
            </span>
          )}
        </div>
        <div className="text-[12px] text-ticker-dim">
          {isDenied && bidder.denyReason ? (
            <>
              {t(
                `denyReason_${bidder.denyReason}` as Parameters<typeof t>[0]
              )}
              {bidder.denyDetail && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDetailExpanded((v) => !v);
                  }}
                  className="ml-1 inline text-[11px] text-ticker-mid underline decoration-ticker-dim/40 underline-offset-2 hover:text-ticker-text"
                >
                  {detailExpanded ? t("seeLess") : t("seeMore")}
                </button>
              )}
            </>
          ) : (
            `${t("offersCount", { count: bidder.bidCount })} · ${t("lastBidAgo", { when: timeAgo(bidder.lastBidAt) })}`
          )}
        </div>
      </div>

      {/* Amount */}
      <span
        className={cn(
          "font-[family-name:var(--font-ticker)] text-[20px] font-bold tracking-[-0.01em] tabular-nums",
          isDenied
            ? "text-ticker-dim line-through"
            : bidder.isTop
              ? "text-ticker-emer"
              : "text-ticker-text"
        )}
      >
        {formatPrice(bidder.bestAmount)}
      </span>

      {/* Deny button — hidden for already-denied bidders */}
      {!isDenied && (
        <button
          onClick={onDeny}
          className="flex size-9 items-center justify-center rounded-[10px] text-[oklch(0.52_0.04_30)] transition-colors hover:bg-ticker-red/10 hover:text-ticker-red"
          title={t("denyOffer")}
        >
          <XCircle className="size-[18px]" />
        </button>
      )}

      {/* Expanded deny detail — spans full width */}
      {detailExpanded && bidder.denyDetail && (
        <div
          className={cn(
            "col-span-full mt-1 break-all rounded-lg bg-ticker-bg-3 px-3 py-2 text-[12px] italic text-ticker-mid",
            isDenied && "opacity-75"
          )}
        >
          &ldquo;{bidder.denyDetail}&rdquo;
        </div>
      )}
    </div>
  );
}

// ─── Deny reason modal ───────────────────────────────────────────────

const DENY_REASONS = ["fake_or_accidental", "dont_trust", "other"] as const;
type DenyReason = (typeof DENY_REASONS)[number];

function DenyReasonModal({
  target,
  itemId,
  onConfirm,
  onCancel,
  t,
}: {
  target: UniqueBidder;
  itemId: string;
  onConfirm: () => void;
  onCancel: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const [reason, setReason] = useState<DenyReason>("fake_or_accidental");
  const [detail, setDetail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDeny = async () => {
    setLoading(true);
    setError("");
    try {
      await denyBidder(
        itemId,
        target.bidderId,
        reason,
        reason === "other" ? detail.trim() : undefined
      );
      onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "deny_failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-[52] bg-black/40 backdrop-blur-[1px]" />
        <DialogPrimitive.Popup className="dark fixed inset-x-4 bottom-4 z-[53] mx-auto max-w-[420px] overflow-hidden rounded-2xl border border-ticker-line bg-ticker-bg text-ticker-text shadow-2xl outline-none md:inset-auto md:left-1/2 md:top-1/2 md:w-[420px] md:-translate-x-1/2 md:-translate-y-1/2">
          {/* Header */}
          <div className="flex items-start justify-between px-5 pb-3 pt-5">
            <div>
              <div className="font-[family-name:var(--font-ticker)] text-[10px] font-semibold uppercase tracking-[0.22em] text-ticker-red">
                {t("denyOffer").toUpperCase()}
              </div>
              <DialogPrimitive.Title className="text-lg font-semibold">
                {t("denyConfirmTitle")}
              </DialogPrimitive.Title>
            </div>
            <DialogPrimitive.Close className="flex size-9 items-center justify-center rounded-[10px] text-ticker-mid transition-colors hover:bg-ticker-bg-2 hover:text-ticker-text">
              <X className="size-5" />
            </DialogPrimitive.Close>
          </div>

          {/* Target row */}
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-ticker-line bg-ticker-bg-3 px-5 py-3.5">
            <UserAvatar
              displayName={target.bidderName}
              avatarUrl={target.bidderAvatarUrl}
              size="sm"
            />
            <div className="min-w-0">
              <div className="text-sm font-medium text-ticker-text">
                {target.bidderName}
              </div>
              <div className="text-xs text-ticker-dim">
                {t("offersCount", { count: target.bidCount })} ·{" "}
                {t("lastBidAgo", { when: timeAgo(target.lastBidAt) })}
              </div>
            </div>
            <span className="font-[family-name:var(--font-ticker)] text-[18px] font-bold tabular-nums">
              {formatPrice(target.bestAmount)}
            </span>
          </div>

          {/* Reason picker */}
          <div className="space-y-1 px-3 py-3">
            {DENY_REASONS.map((key) => {
              const selected = reason === key;
              return (
                <button
                  key={key}
                  onClick={() => setReason(key)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-[10px] px-3 py-3 text-left transition-colors",
                    selected
                      ? "bg-ticker-red/[0.08] text-ticker-text"
                      : "text-ticker-mid hover:bg-ticker-bg-3 hover:text-ticker-text"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px]",
                      selected
                        ? "border-ticker-red bg-ticker-red"
                        : "border-[oklch(0.42_0.04_30)]"
                    )}
                  >
                    {selected && (
                      <span className="block size-[7px] rounded-full bg-ticker-bg" />
                    )}
                  </span>
                  <span className="text-sm">{t(`denyReason_${key}`)}</span>
                </button>
              );
            })}

            {/* Other textarea — required when "other" is selected */}
            {reason === "other" && (
              <textarea
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder={t("denyOtherPlaceholder")}
                maxLength={500}
                className="mx-3 mb-2 min-h-[80px] w-[calc(100%-24px)] resize-none rounded-[10px] border border-ticker-line bg-ticker-bg-3 p-3 text-sm text-ticker-text outline-none placeholder:text-ticker-dim focus:border-ticker-red/40"
              />
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="px-5 pb-2 text-xs text-ticker-red">{error}</p>
          )}

          {/* Footer */}
          <div className="flex gap-2 px-5 pb-5">
            <button
              onClick={onCancel}
              className="flex h-12 flex-1 items-center justify-center rounded-xl border border-ticker-line text-sm font-medium text-ticker-mid transition-colors hover:bg-ticker-bg-3 hover:text-ticker-text"
            >
              {t("cancel")}
            </button>
            <button
              onClick={handleDeny}
              disabled={loading || (reason === "other" && !detail.trim())}
              className="flex h-12 flex-[1.4] items-center justify-center rounded-xl bg-ticker-red text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                t("denyConfirmButton")
              )}
            </button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ─── Seller view (exported) ──────────────────────────────────────────

export function SellerView({
  data,
  itemId,
  now,
  urgency,
  bids,
  onUserClick,
  t,
}: {
  data: BidListResponse;
  itemId: string;
  now: number;
  urgency: UrgencyState;
  bids: ReturnType<typeof useOffersBids>;
  onUserClick: (displayName: string) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const [denyTarget, setDenyTarget] = useState<UniqueBidder | null>(null);
  const uniqueBidders = data.uniqueBidders ?? [];
  const auctionEnded = urgency === "sold" || urgency === "ended";

  const visibleBidders = bids.expanded
    ? uniqueBidders
    : uniqueBidders.slice(0, INITIAL_LIMIT);
  const hasMoreBidders =
    !bids.expanded && uniqueBidders.length > INITIAL_LIMIT;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {/* Summary line */}
      <SellerSummaryLine data={data} t={t} />

      {/* Empty state */}
      {uniqueBidders.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-12">
          <span className="text-[13px] text-ticker-dim">
            {t("noBidsYet")}
          </span>
        </div>
      ) : (
        <>
          {/* Bidder cards */}
          <div className="space-y-2 px-3 py-3">
            {visibleBidders.map((bidder) => (
              <BidderCard
                key={`${bidder.bidderId}-${bidder.isDenied ? "denied" : "active"}`}
                bidder={bidder}
                onDeny={() => setDenyTarget(bidder)}
                t={t}
              />
            ))}
          </div>

          {/* Show more bidders */}
          {hasMoreBidders && (
            <button
              onClick={bids.loadMore}
              className="flex w-full items-center justify-center gap-1.5 py-3 text-[12.5px] text-ticker-mid transition-colors hover:text-ticker-text"
            >
              {t("showMoreBidders", {
                count: uniqueBidders.length - INITIAL_LIMIT,
              })}
              <ChevronDown className="size-3" />
            </button>
          )}
        </>
      )}

      {/* Deny modal */}
      {denyTarget && !auctionEnded && (
        <DenyReasonModal
          target={denyTarget}
          itemId={itemId}
          onConfirm={() => {
            setDenyTarget(null);
            bids.loadBids(bids.currentLimit);
          }}
          onCancel={() => setDenyTarget(null)}
          t={t}
        />
      )}
    </div>
  );
}
