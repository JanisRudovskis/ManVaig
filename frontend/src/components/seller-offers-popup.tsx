"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X, Loader2, ChevronDown, Check, ShoppingBag, MessageCircle, XCircle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/user-avatar";
import { formatPrice, isEnded } from "@/components/item-card-shared";
import { denyBidder, sellToBidder, closeAuction, acceptInstantBuy, declineInstantBuy } from "@/lib/items";
import type { BidListResponse, UniqueBidder } from "@/lib/items";
import { SoldHero } from "@/components/sold-state/sold-hero";
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

// ─── Section divider ─────────────────────────────────────────────────

export function SectionDivider({
  kind,
  count,
  t,
}: {
  kind: "ib" | "bidders" | "cancelled";
  count?: number;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  if (kind === "ib") {
    return (
      <div className="flex items-center gap-2.5 px-1 pb-1.5 pt-2">
        <span className="flex items-center gap-1.5 flex-none font-[family-name:var(--font-ticker)] text-[10px] font-bold uppercase tracking-[0.24em] text-ticker-amber">
          <Zap className="size-[11px]" strokeWidth={2.4} />
          {t("instantBuyDivider")}
        </span>
        <span className="flex-1 h-px bg-[oklch(0.82_0.16_80/0.20)]" />
      </div>
    );
  }
  if (kind === "cancelled") {
    return (
      <div className="flex items-center gap-2.5 px-1 pb-1.5 pt-2">
        <span className="flex-none font-[family-name:var(--font-ticker)] text-[10px] font-bold uppercase tracking-[0.24em] text-ticker-dim">
          {t("cancelledBids", { count: count ?? 0 })}
        </span>
        <span className="h-px flex-1 bg-ticker-line" />
      </div>
    );
  }
  // bidders
  return (
    <div className="flex items-center gap-2.5 px-1 pb-1.5 pt-2">
      <span className="flex-none font-[family-name:var(--font-ticker)] text-[10px] font-bold uppercase tracking-[0.24em] text-ticker-dim">
        {t("topOfBidders", { count: count ?? 0 })}
      </span>
      <span className="h-px flex-1 bg-ticker-line" />
    </div>
  );
}

// ─── Instant buy card (in-list) ─────────────────────────────────────

function InstantBuyCard({
  buyer,
  isSeller,
  isOpen,
  sellPending,
  loading,
  onToggle,
  startAccept,
  cancelAccept,
  confirmAccept,
  onDecline,
  onUserClick,
  t,
}: {
  buyer: NonNullable<BidListResponse["pendingInstantBuy"]>;
  isSeller: boolean;
  isOpen: boolean;
  sellPending: boolean;
  loading: boolean;
  onToggle: () => void;
  startAccept: () => void;
  cancelAccept: () => void;
  confirmAccept: () => void;
  onDecline: () => void;
  onUserClick: (displayName: string) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <div
      data-open={isOpen}
      className={cn(
        "grid grid-rows-[auto_0fr] rounded-xl border border-ticker-amber/30 bg-[oklch(0.82_0.16_80/0.06)]",
        "transition-[grid-template-rows] duration-[240ms] ease-[cubic-bezier(0.2,0.7,0.2,1)]",
        "overflow-hidden",
        "data-[open=true]:grid-rows-[auto_1fr]",
      )}
    >
      <div
        role={isSeller ? "button" : undefined}
        onClick={isSeller ? onToggle : undefined}
        className={cn(
          "grid items-center gap-3 p-[10px_10px_10px_12px]",
          isSeller
            ? "grid-cols-[auto_minmax(0,1fr)_auto_auto] cursor-pointer"
            : "grid-cols-[auto_minmax(0,1fr)_auto]",
        )}
      >
        <span
          onClick={(e) => { e.stopPropagation(); onUserClick(buyer.buyerDisplayName); }}
          className="cursor-pointer"
        >
          <UserAvatar displayName={buyer.buyerDisplayName} avatarUrl={buyer.buyerAvatarUrl} size="base" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              onClick={(e) => { e.stopPropagation(); onUserClick(buyer.buyerDisplayName); }}
              className="cursor-pointer truncate text-[14px] font-medium text-ticker-text hover:underline"
            >
              {buyer.buyerDisplayName}
            </span>
            <span className="inline-flex flex-none items-center gap-[3px] rounded-[3px] bg-ticker-amber/15 px-1.5 py-[2px] font-[family-name:var(--font-ticker)] text-[9.5px] font-bold uppercase tracking-[0.14em] text-ticker-amber">
              <Zap className="size-[9px]" strokeWidth={2.4} />
              {t("buyNowPill")}
            </span>
            {buyer.isOwnInstantBuy && (
              <span className="flex-none rounded-[3px] bg-ticker-emer/15 px-1.5 py-[2px] font-[family-name:var(--font-ticker)] text-[9.5px] font-bold uppercase tracking-[0.14em] text-ticker-emer">
                {t("you").toLowerCase()}
              </span>
            )}
          </div>
          <div className="mt-[2px] text-[11.5px] font-medium text-ticker-amber">
            {isSeller ? t("awaitingYourResponse") : (buyer.isOwnInstantBuy ? t("yourBuyNowAwaitingSeller") : t("awaitingSellerResponse"))}
          </div>
        </div>
        <span className="font-[family-name:var(--font-ticker)] text-[17px] font-bold tabular-nums leading-none text-ticker-amber">
          {formatPrice(buyer.amount)}
        </span>
        {isSeller && (
          <span
            aria-hidden="true"
            className={cn(
              "flex size-6 items-center justify-center text-ticker-dim transition-transform duration-[240ms]",
              isOpen && "rotate-180",
            )}
          >
            <ChevronDown className="size-[14px]" strokeWidth={2.2} />
          </span>
        )}
      </div>

      {/* Expansion — seller only */}
      {isSeller && (
        <div className="min-h-0 overflow-hidden">
          <div
            className={cn(
              "px-2.5 pb-2.5 pt-1 opacity-0 -translate-y-1 transition-[opacity,transform] duration-200 delay-[60ms]",
              isOpen && "opacity-100 translate-y-0",
            )}
          >
            {sellPending ? (
              <div className="grid grid-cols-[1fr_1.6fr] gap-2">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); cancelAccept(); }}
                  className="h-[42px] rounded-[10px] border border-ticker-line text-ticker-mid font-semibold text-[13.5px] hover:text-ticker-text hover:bg-ticker-bg-3"
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); confirmAccept(); }}
                  disabled={loading}
                  className="h-[42px] rounded-[10px] bg-ticker-emer text-[oklch(0.15_0_0)] font-bold text-[13.5px] inline-flex items-center justify-center gap-1.5 shadow-[0_6px_18px_oklch(0.78_0.18_165/0.28)] disabled:opacity-60"
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="size-[14px]" strokeWidth={2.4} />
                      {t("confirmSaleAmount", { amount: formatPrice(buyer.amount) })}
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-[1.4fr_1fr] gap-2">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); startAccept(); }}
                  className="h-[42px] rounded-[10px] bg-ticker-emer text-[oklch(0.15_0_0)] font-semibold text-[13.5px] inline-flex items-center justify-center gap-1.5 hover:opacity-90"
                >
                  <Check className="size-[14px]" strokeWidth={2.4} />
                  {t("acceptSale")}
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDecline(); }}
                  disabled={loading}
                  className="h-[42px] rounded-[10px] border border-ticker-line text-ticker-mid font-semibold text-[13.5px] inline-flex items-center justify-center gap-1.5 hover:text-ticker-red hover:bg-ticker-red/[0.08] hover:border-ticker-red/35 disabled:opacity-60"
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <XCircle className="size-[14px]" strokeWidth={1.7} />
                      {t("declineSale")}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
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

// ─── Bidder card (expandable) ────────────────────────────────────────

export function BidderCard({
  bidder,
  isOpen,
  sellPending,
  onToggle,
  onDeny,
  onSellTap,
  onSellCancel,
  onSellConfirm,
  onMessage,
  onUserClick,
  expandable,
  showSell,
  isBuyer,
  confirming,
  t,
}: {
  bidder: UniqueBidder;
  isOpen: boolean;
  sellPending: boolean;
  onToggle: () => void;
  onDeny: () => void;
  onSellTap: () => void;
  onSellCancel: () => void;
  onSellConfirm: () => void;
  onMessage: () => void;
  onUserClick: (displayName: string) => void;
  expandable: boolean;
  showSell: boolean;
  isBuyer: boolean;
  confirming: boolean;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const isDenied = bidder.isDenied;
  const [detailExpanded, setDetailExpanded] = useState(false);
  const router = useRouter();

  return (
    <div
      data-open={isOpen}
      className={cn(
        "grid grid-rows-[auto_0fr] rounded-xl bg-ticker-bg-2",
        "transition-[grid-template-rows] duration-[240ms] ease-[cubic-bezier(0.2,0.7,0.2,1)]",
        "data-[open=true]:grid-rows-[auto_1fr]",
        isDenied && "opacity-50",
        isBuyer
          ? "border border-ticker-emer/[0.22] bg-[oklch(0.78_0.18_165/0.08)]"
          : bidder.isTop && !isDenied
            ? "border border-ticker-emer/[0.22] bg-[oklch(0.78_0.18_165/0.08)]"
            : "",
      )}
    >
      {/* Head row */}
      <button
        type="button"
        onClick={expandable && !isDenied ? onToggle : undefined}
        className={cn(
          "grid items-center gap-3 p-3 pl-3.5 text-left",
          expandable && !isDenied
            ? "grid-cols-[auto_minmax(0,1fr)_auto_auto] cursor-pointer"
            : "grid-cols-[auto_minmax(0,1fr)_auto] cursor-default",
        )}
      >
        {/* Avatar */}
        <span
          onClick={(e) => { e.stopPropagation(); onUserClick(bidder.bidderName); }}
          className="cursor-pointer"
        >
          <UserAvatar
            displayName={bidder.bidderName}
            avatarUrl={bidder.bidderAvatarUrl}
            size="base"
          />
        </span>

        {/* Meta */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              onClick={(e) => { e.stopPropagation(); onUserClick(bidder.bidderName); }}
              className={cn(
                "cursor-pointer truncate text-[14.5px] font-medium hover:underline",
                isDenied ? "text-ticker-dim" : "text-ticker-text"
              )}
            >
              {bidder.bidderName}
            </span>
            {isDenied && (
              <span className="shrink-0 rounded-full bg-ticker-red/15 px-1.5 py-[2px] font-[family-name:var(--font-ticker)] text-[9.5px] font-bold uppercase tracking-[0.14em] text-ticker-red">
                {t("deniedPill")}
              </span>
            )}
            {isBuyer && (
              <span className="shrink-0 rounded-[3px] bg-ticker-emer px-1.5 py-[2px] font-[family-name:var(--font-ticker)] text-[9.5px] font-bold uppercase tracking-[0.14em] text-[oklch(0.15_0_0)]">
                {t("buyer").toUpperCase()}
              </span>
            )}
            {!isDenied && !isBuyer && bidder.isTop && (
              <span
                className="inline-flex size-[22px] shrink-0 items-center justify-center rounded-md bg-ticker-emer/15 text-ticker-emer"
                aria-label={t("topBidder")}
                title={t("topBidder")}
              >
                <CrownIcon className="size-4" />
              </span>
            )}
            {!isDenied && !isBuyer && bidder.bidCount >= 2 && (
              <span className="shrink-0 rounded-full bg-ticker-amber/15 px-1.5 py-[2px] font-[family-name:var(--font-ticker)] text-[9.5px] font-bold tracking-[0.1em] text-ticker-amber">
                {t("hotPill", { count: bidder.bidCount })}
              </span>
            )}
          </div>
          <div className="text-[12px] text-ticker-dim">
            {isBuyer ? (
              t("soldForAmount", { amount: formatPrice(bidder.bestAmount) })
            ) : isDenied && bidder.denyReason ? (
              <>
                {t(
                  `denyReason_${bidder.denyReason}` as Parameters<typeof t>[0]
                )}
                {bidder.denyDetail && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setDetailExpanded((v) => !v);
                    }}
                    className="ml-1 inline cursor-pointer text-[11px] text-ticker-mid underline decoration-ticker-dim/40 underline-offset-2 hover:text-ticker-text"
                  >
                    {detailExpanded ? t("seeLess") : t("seeMore")}
                  </span>
                )}
              </>
            ) : (
              `${t("offersCount", { count: bidder.bidCount })} · ${t("lastBidAgo", { when: timeAgo(bidder.lastBidAt) })}`
            )}
          </div>
          {/* Expanded deny detail */}
          {detailExpanded && bidder.denyDetail && (
            <div className="mt-1.5 break-all rounded-lg bg-ticker-bg-3 px-3 py-2 text-[12px] italic text-ticker-mid">
              &ldquo;{bidder.denyDetail}&rdquo;
            </div>
          )}
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

        {/* Chevron — only when expandable */}
        {expandable && !isDenied && (
          <span
            aria-hidden="true"
            className={cn(
              "flex size-7 items-center justify-center text-ticker-dim transition-transform duration-[240ms]",
              isOpen && "rotate-180",
            )}
          >
            <ChevronDown className="size-4" strokeWidth={2.2} />
          </span>
        )}
      </button>

      {/* Expansion — action buttons */}
      {expandable && !isDenied && (
        <div className="min-h-0 overflow-hidden">
          <div
            className={cn(
              "px-2.5 pb-3 pt-1.5 opacity-0 -translate-y-1 transition-[opacity,transform] duration-200 delay-[60ms]",
              isOpen && "opacity-100 translate-y-0",
            )}
          >
            {sellPending ? (
              <div className="grid grid-cols-[1fr_1.6fr] gap-2">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onSellCancel(); }}
                  className="h-11 rounded-[10px] border border-ticker-line text-[14px] font-semibold text-ticker-mid transition-colors hover:bg-ticker-bg-3 hover:text-ticker-text"
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onSellConfirm(); }}
                  disabled={confirming}
                  className="flex h-11 items-center justify-center gap-1.5 rounded-[10px] bg-ticker-emer text-[14px] font-bold text-[oklch(0.15_0_0)] shadow-[0_6px_18px_oklch(0.78_0.18_165/0.28)] transition-colors hover:opacity-90 disabled:opacity-60"
                >
                  {confirming ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="size-[15px]" />
                      {t("confirmSaleAmount", { amount: formatPrice(bidder.bestAmount) })}
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className={cn("grid gap-2", showSell ? "grid-cols-3" : "grid-cols-2")}>
                {showSell && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onSellTap(); }}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-ticker-emer text-[14px] font-semibold text-[oklch(0.15_0_0)] transition-colors hover:opacity-90"
                  >
                    <ShoppingBag className="size-[15px]" strokeWidth={2} />
                    {t("sell")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onMessage(); }}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-ticker-line bg-ticker-bg-3 text-[14px] font-semibold text-ticker-text transition-colors hover:bg-[oklch(0.23_0.008_250)]"
                >
                  <MessageCircle className="size-[15px]" strokeWidth={1.9} />
                  {t("message")}
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDeny(); }}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-ticker-line text-[14px] font-semibold text-ticker-mid transition-colors hover:border-ticker-red/35 hover:bg-ticker-red/[0.08] hover:text-ticker-red"
                >
                  <XCircle className="size-[15px]" strokeWidth={1.7} />
                  {t("deny")}
                </button>
              </div>
            )}
          </div>
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
  onClose,
  t,
}: {
  data: BidListResponse;
  itemId: string;
  now: number;
  urgency: UrgencyState;
  bids: ReturnType<typeof useOffersBids>;
  onUserClick: (displayName: string) => void;
  onClose: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const router = useRouter();
  const [denyTarget, setDenyTarget] = useState<UniqueBidder | null>(null);
  const [openBidderId, setOpenBidderId] = useState<string | null>(null);
  const [sellPendingBidderId, setSellPendingBidderId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [closeWinnerModalOpen, setCloseWinnerModalOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const sellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Instant buy state
  const [ibOpen, setIbOpen] = useState(false);
  const [ibAcceptPending, setIbAcceptPending] = useState(false);
  const [ibLoading, setIbLoading] = useState(false);
  const ibAcceptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tab state: "active" (default) or "all" (active + denied) — shared with buyer view
  const STORAGE_KEY = "offers-popup.showDenied";
  const [tab, setTabState] = useState<"active" | "all">(() => {
    if (typeof window === "undefined") return "active";
    return window.localStorage.getItem(STORAGE_KEY) === "1" ? "all" : "active";
  });
  const setTab = (next: "active" | "all") => {
    setTabState(next);
    try { window.localStorage.setItem(STORAGE_KEY, next === "all" ? "1" : "0"); } catch {}
  };

  const uniqueBidders = data.uniqueBidders ?? [];
  const auctionEnded = urgency === "sold" || urgency === "ended";
  const isSold = data.isSold && data.soldTo != null;
  const soldViaIb = isSold && (data.soldTo?.isInstantBuy === true);

  // Split bidders — denied bids from data.bids (same IB filter as buyer view)
  const ibDenyReasons = new Set(["instant_buy_declined", "sale_reopened", "auction_ended"]);
  const activeBidders = useMemo(() => uniqueBidders.filter(b => !b.isDenied), [uniqueBidders]);
  const nonIbDeniedBids = useMemo(() =>
    (data.bids ?? []).filter(b => b.status === "Denied" && !ibDenyReasons.has(b.denyReason ?? "")),
    [data.bids],
  );
  const hasDenied = nonIbDeniedBids.length > 0;
  // Map individual denied bids to UniqueBidder shape for BidderCard reuse
  const deniedAsBidders: UniqueBidder[] = useMemo(() =>
    nonIbDeniedBids.map(bid => ({
      bidderId: bid.bidderId,
      bidderName: bid.bidderName,
      bidderAvatarUrl: bid.bidderAvatarUrl,
      bestAmount: bid.amount,
      bidCount: 1,
      lastBidAt: bid.createdAt,
      isTop: false,
      isDenied: true,
      denyReason: bid.denyReason,
      denyDetail: bid.denyDetail,
    })),
    [nonIbDeniedBids],
  );
  const visibleBidders = useMemo(() => {
    if (tab !== "all") return activeBidders;
    return [...activeBidders, ...deniedAsBidders].sort((a, b) => new Date(b.lastBidAt).getTime() - new Date(a.lastBidAt).getTime());
  }, [activeBidders, deniedAsBidders, tab]);

  // Cards expandable: no end date, or end date has passed (timed auctions: only after bidding ends)
  const endDatePassed = data.endDate != null && new Date(data.endDate).getTime() <= Date.now();
  const cardsExpandable = !data.endDate || endDatePassed;

  // Auto-reset sell confirm after 3s
  useEffect(() => {
    if (sellTimerRef.current) clearTimeout(sellTimerRef.current);
    if (sellPendingBidderId) {
      sellTimerRef.current = setTimeout(() => setSellPendingBidderId(null), 3000);
    }
    return () => { if (sellTimerRef.current) clearTimeout(sellTimerRef.current); };
  }, [sellPendingBidderId]);

  // Auto-reset IB accept confirm after 3s
  useEffect(() => {
    if (ibAcceptTimerRef.current) clearTimeout(ibAcceptTimerRef.current);
    if (ibAcceptPending) {
      ibAcceptTimerRef.current = setTimeout(() => setIbAcceptPending(false), 3000);
    }
    return () => { if (ibAcceptTimerRef.current) clearTimeout(ibAcceptTimerRef.current); };
  }, [ibAcceptPending]);

  const handleIbConfirmAccept = async () => {
    setIbLoading(true);
    try {
      await acceptInstantBuy(itemId);
      bids.manualRefresh();
    } catch {
      // error surfaced by refresh
    } finally {
      setIbLoading(false);
      setIbAcceptPending(false);
      setIbOpen(false);
    }
  };

  const handleIbDecline = async () => {
    setIbLoading(true);
    try {
      await declineInstantBuy(itemId);
      bids.manualRefresh();
    } catch {
      // error surfaced by refresh
    } finally {
      setIbLoading(false);
      setIbOpen(false);
    }
  };

  const handleConfirmSale = async (bidder: UniqueBidder) => {
    setConfirming(true);
    try {
      await sellToBidder(itemId, bidder.bidderId);
      setSellPendingBidderId(null);
      setOpenBidderId(null);
      bids.manualRefresh();
    } catch {
      // error handled by refresh
    } finally {
      setConfirming(false);
    }
  };

  const handleCloseWithoutWinner = async () => {
    setClosing(true);
    try {
      await closeAuction(itemId);
      setCloseModalOpen(false);
      bids.manualRefresh();
      onClose();
    } catch {
      // error surfaced by refresh
    } finally {
      setClosing(false);
    }
  };

  const slicedBidders = bids.expanded
    ? visibleBidders
    : visibleBidders.slice(0, INITIAL_LIMIT);
  const hasMoreBidders =
    !bids.expanded && visibleBidders.length > INITIAL_LIMIT;

  const ibPending = data.pendingInstantBuy;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Sold hero — replaces summary line when sold */}
      {isSold ? (
        <SoldHero
          amount={data.soldTo!.amount}
          winnerDisplayName={data.soldTo!.buyerDisplayName}
          isInstantBuy={soldViaIb}
          onUserClick={onUserClick}
        />
      ) : (
        <SellerSummaryLine data={data} t={t} />
      )}

      {/* ── Scrollable bid area ── */}
      <div className="min-h-0 flex-1 overflow-y-auto">
      {/* Empty state — only when no bidders AND no pending IB */}
      {uniqueBidders.length === 0 && !ibPending ? (
        <div className="flex flex-1 items-center justify-center py-12">
          <span className="text-[13px] text-ticker-dim">
            {t("noBidsYet")}
          </span>
        </div>
      ) : (
        <>
          {/* Bidder cards — split into buyer + runners-up when sold */}
          {isSold ? (() => {
            const buyerId = data.soldTo?.buyerId ?? null;
            const buyerBidder = uniqueBidders.find((b) => b.bidderId === buyerId);
            const activeBidders = uniqueBidders.filter((b) => b.bidderId !== buyerId && !b.isDenied);
            const denied = uniqueBidders.filter((b) => b.isDenied);

            return (
              <div className="space-y-0 px-3 py-0">
                {/* Buyer section */}
                {buyerBidder && (
                  <>
                    <div className="flex items-center gap-2.5 px-[6px] pb-1.5 pt-3">
                      <span className="flex-none font-[family-name:var(--font-ticker)] text-[10px] font-bold uppercase tracking-[0.24em] text-ticker-dim">
                        {t("buyer").toUpperCase()}
                      </span>
                      <span className="h-px flex-1 bg-ticker-line" />
                    </div>
                    <div className="pb-2">
                      <BidderCard
                        bidder={buyerBidder}
                        isOpen={openBidderId === buyerBidder.bidderId}
                        sellPending={false}
                        confirming={false}
                        expandable={cardsExpandable}
                        showSell={false}
                        isBuyer={true}
                        onToggle={() => setOpenBidderId((prev) => prev === buyerBidder.bidderId ? null : buyerBidder.bidderId)}
                        onDeny={() => setDenyTarget(buyerBidder)}
                        onSellTap={() => {}}
                        onSellCancel={() => {}}
                        onSellConfirm={() => {}}
                        onMessage={() => router.push("/messages")}
                        onUserClick={onUserClick}
                        t={t}
                      />
                    </div>
                  </>
                )}

                {/* Cancelled bids section — when sold via IB, active bids shown dimmed with strike-through */}
                {soldViaIb && activeBidders.length > 0 && (
                  <>
                    <SectionDivider kind="cancelled" count={activeBidders.length} t={t} />
                    <div className="space-y-2 pb-2">
                      {activeBidders.map((bidder) => (
                        <div key={bidder.bidderId} className="opacity-55">
                          <BidderCard
                            bidder={bidder}
                            isOpen={false}
                            sellPending={false}
                            confirming={false}
                            expandable={false}
                            showSell={false}
                            isBuyer={false}
                            onToggle={() => {}}
                            onDeny={() => {}}
                            onSellTap={() => {}}
                            onSellCancel={() => {}}
                            onSellConfirm={() => {}}
                            onMessage={() => {}}
                            onUserClick={onUserClick}
                            t={t}
                          />
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Runners-up section — when sold via regular sell-to-bidder */}
                {!soldViaIb && activeBidders.length > 0 && (
                  <>
                    <div className="flex items-center gap-2.5 px-[6px] pb-1.5 pt-2">
                      <span className="flex-none font-[family-name:var(--font-ticker)] text-[10px] font-bold uppercase tracking-[0.24em] text-ticker-dim">
                        {t("runnersUp", { count: activeBidders.length })}
                      </span>
                      <span className="h-px flex-1 bg-ticker-line" />
                    </div>
                    <div className="space-y-2 pb-2">
                      {activeBidders.map((bidder) => (
                        <div key={bidder.bidderId} className="opacity-55">
                          <BidderCard
                            bidder={bidder}
                            isOpen={false}
                            sellPending={false}
                            confirming={false}
                            expandable={false}
                            showSell={false}
                            isBuyer={false}
                            onToggle={() => {}}
                            onDeny={() => {}}
                            onSellTap={() => {}}
                            onSellCancel={() => {}}
                            onSellConfirm={() => {}}
                            onMessage={() => {}}
                            onUserClick={onUserClick}
                            t={t}
                          />
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Denied section (if any) */}
                {denied.length > 0 && (
                  <div className="space-y-2 pb-2">
                    {denied.map((bidder) => (
                      <BidderCard
                        key={bidder.bidderId}
                        bidder={bidder}
                        isOpen={false}
                        sellPending={false}
                        confirming={false}
                        expandable={false}
                        showSell={false}
                        isBuyer={false}
                        onToggle={() => {}}
                        onDeny={() => {}}
                        onSellTap={() => {}}
                        onSellCancel={() => {}}
                        onSellConfirm={() => {}}
                        onMessage={() => {}}
                        onUserClick={onUserClick}
                        t={t}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })() : (
          <div className="space-y-1.5 px-3.5 pb-2.5 pt-1.5">
            {/* IB section — above bidders */}
            {ibPending && (
              <>
                <SectionDivider kind="ib" t={t} />
                <InstantBuyCard
                  buyer={ibPending}
                  isSeller={true}
                  isOpen={ibOpen}
                  sellPending={ibAcceptPending}
                  loading={ibLoading}
                  onToggle={() => setIbOpen((v) => !v)}
                  startAccept={() => setIbAcceptPending(true)}
                  cancelAccept={() => setIbAcceptPending(false)}
                  confirmAccept={handleIbConfirmAccept}
                  onDecline={handleIbDecline}
                  onUserClick={onUserClick}
                  t={t}
                />
              </>
            )}

            {/* Active / All tabs — only when there are denied bids */}
            {hasDenied && (
              <div className="flex flex-none items-center gap-0 px-0.5 pt-2 pb-0">
                <button
                  type="button"
                  onClick={() => setTab("active")}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                    tab === "active"
                      ? "bg-ticker-bg-2 text-ticker-text"
                      : "text-ticker-mid hover:text-ticker-text",
                  )}
                >
                  {t("activeTab", { count: activeBidders.length })}
                </button>
                <button
                  type="button"
                  onClick={() => setTab("all")}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                    tab === "all"
                      ? "bg-ticker-bg-2 text-ticker-text"
                      : "text-ticker-mid hover:text-ticker-text",
                  )}
                >
                  {t("allTab", { count: activeBidders.length + nonIbDeniedBids.length })}
                </button>
              </div>
            )}

            {/* Bidders divider — only when there are visible bidders */}
            {visibleBidders.length > 0 && (
              <SectionDivider kind="bidders" count={activeBidders.length} t={t} />
            )}

            {slicedBidders.map((bidder) => (
              <div key={`${bidder.bidderId}-${bidder.isDenied ? `denied-${bidder.bestAmount}` : "active"}`}>
                <BidderCard
                  bidder={bidder}
                  isOpen={openBidderId === bidder.bidderId}
                  sellPending={sellPendingBidderId === bidder.bidderId}
                  confirming={confirming && sellPendingBidderId === bidder.bidderId}
                  expandable={cardsExpandable}
                  showSell={true}
                  isBuyer={false}
                  onToggle={() => {
                    setOpenBidderId((prev) => prev === bidder.bidderId ? null : bidder.bidderId);
                    setSellPendingBidderId(null);
                  }}
                  onDeny={() => setDenyTarget(bidder)}
                  onSellTap={() => setSellPendingBidderId(bidder.bidderId)}
                  onSellCancel={() => setSellPendingBidderId(null)}
                  onSellConfirm={() => handleConfirmSale(bidder)}
                  onMessage={() => router.push("/messages")}
                  onUserClick={onUserClick}
                  t={t}
                />
              </div>
            ))}
          </div>
          )}

          {/* Show more bidders */}
          {hasMoreBidders && (
            <button
              onClick={bids.loadMore}
              className="flex w-full items-center justify-center gap-1.5 py-3 text-[12.5px] text-ticker-mid transition-colors hover:text-ticker-text"
            >
              {t("showMoreBidders", {
                count: visibleBidders.length - INITIAL_LIMIT,
              })}
              <ChevronDown className="size-3" />
            </button>
          )}
        </>
      )}

      </div>{/* end scrollable bid area */}

      {/* Footer — close auction (hidden when instant buy pending) */}
      {cardsExpandable && !ibPending && (
        <div className="flex flex-none flex-col gap-2 border-t border-ticker-line bg-ticker-bg px-3.5 pb-4 pt-3">
          {isSold ? (
            <button
              type="button"
              onClick={() => setCloseWinnerModalOpen(true)}
              className="inline-flex h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-ticker-amber text-[14.5px] font-semibold text-[oklch(0.18_0_0)] shadow-[0_8px_24px_oklch(0.82_0.16_80/0.25)] transition-colors hover:opacity-90"
            >
              <Check className="size-[15px]" strokeWidth={2.4} />
              {t("closeAuction")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCloseModalOpen(true)}
              className="inline-flex h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-ticker-red/35 text-[14.5px] font-semibold text-ticker-red transition-colors hover:border-ticker-red/55 hover:bg-ticker-red/[0.08]"
            >
              <XCircle className="size-[15px]" strokeWidth={1.7} />
              {t("closeAuctionNoWinner")}
            </button>
          )}
        </div>
      )}

      {/* Close auction modal */}
      {closeModalOpen && (
        <DialogPrimitive.Root open onOpenChange={(o) => { if (!o) setCloseModalOpen(false); }}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Backdrop className="fixed inset-0 z-[52] bg-black/40 backdrop-blur-[1px]" />
            <DialogPrimitive.Popup className="dark fixed inset-x-4 bottom-4 z-[53] mx-auto max-w-[420px] overflow-hidden rounded-2xl border border-ticker-line bg-ticker-bg text-ticker-text shadow-2xl outline-none md:inset-auto md:left-1/2 md:top-1/2 md:w-[420px] md:-translate-x-1/2 md:-translate-y-1/2">
              <div className="flex items-start justify-between px-5 pb-3 pt-5">
                <div>
                  <div className="font-[family-name:var(--font-ticker)] text-[10px] font-semibold uppercase tracking-[0.22em] text-ticker-red">
                    {t("closeAuctionKicker")}
                  </div>
                  <DialogPrimitive.Title className="text-lg font-semibold">
                    {t("closeAuctionConfirmTitle")}
                  </DialogPrimitive.Title>
                </div>
                <DialogPrimitive.Close className="flex size-9 items-center justify-center rounded-[10px] text-ticker-mid transition-colors hover:bg-ticker-bg-2 hover:text-ticker-text">
                  <X className="size-5" />
                </DialogPrimitive.Close>
              </div>
              <div className="border-b border-ticker-line px-5 py-4">
                {uniqueBidders.some((b) => !b.isDenied) && (
                  <p className="m-0 mb-3 text-[13.5px] leading-[1.5] text-ticker-mid">
                    {t("closeAuctionConfirmBody", { count: uniqueBidders.filter((b) => !b.isDenied).length })}
                  </p>
                )}
                <p className="inline-flex items-center gap-2 rounded-lg bg-ticker-red/[0.08] px-3 py-[9px] text-[12.5px] font-medium text-ticker-red">
                  <XCircle className="size-[14px]" strokeWidth={1.7} />
                  {t("closeAuctionConfirmWarn")}
                </p>
              </div>
              <div className="flex gap-2.5 px-4 pb-4 pt-2">
                <button
                  type="button"
                  onClick={() => setCloseModalOpen(false)}
                  className="h-12 flex-1 rounded-xl border border-ticker-line text-[14px] font-medium text-ticker-mid transition-colors hover:bg-ticker-bg-3 hover:text-ticker-text"
                >
                  {t("closeAuctionKeep")}
                </button>
                <button
                  type="button"
                  onClick={handleCloseWithoutWinner}
                  disabled={closing}
                  className="flex h-12 flex-[1.4] items-center justify-center rounded-xl bg-ticker-red text-[14px] font-bold text-white transition-colors hover:opacity-90 disabled:opacity-60"
                >
                  {closing ? <Loader2 className="size-4 animate-spin" /> : t("closeAuctionGo")}
                </button>
              </div>
            </DialogPrimitive.Popup>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      )}

      {/* Close auction with winner — confirmation modal */}
      {closeWinnerModalOpen && (
        <DialogPrimitive.Root open onOpenChange={(o) => { if (!o) setCloseWinnerModalOpen(false); }}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Backdrop className="fixed inset-0 z-[52] bg-black/40 backdrop-blur-[1px]" />
            <DialogPrimitive.Popup className="dark fixed inset-x-4 bottom-4 z-[53] mx-auto max-w-[420px] overflow-hidden rounded-2xl border border-ticker-line bg-ticker-bg text-ticker-text shadow-2xl outline-none md:inset-auto md:left-1/2 md:top-1/2 md:w-[420px] md:-translate-x-1/2 md:-translate-y-1/2">
              <div className="px-5 pb-3 pt-5">
                <DialogPrimitive.Title className="text-lg font-semibold">
                  {t("closeAuctionWinnerTitle")}
                </DialogPrimitive.Title>
                <p className="mt-2 text-[13.5px] leading-[1.5] text-ticker-mid">
                  {t("closeAuctionWinnerBody")}
                </p>
              </div>
              <div className="flex gap-2.5 px-4 pb-4 pt-2">
                <button
                  type="button"
                  onClick={() => setCloseWinnerModalOpen(false)}
                  className="h-12 flex-1 rounded-xl border border-ticker-line text-[14px] font-medium text-ticker-mid transition-colors hover:bg-ticker-bg-3 hover:text-ticker-text"
                >
                  {t("cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => { setCloseWinnerModalOpen(false); onClose(); }}
                  className="inline-flex h-12 flex-[1.4] items-center justify-center gap-1.5 rounded-xl bg-ticker-amber text-[14px] font-bold text-[oklch(0.18_0_0)] transition-colors hover:opacity-90"
                >
                  <Check className="size-[15px]" strokeWidth={2.4} />
                  {t("closeAuctionWinnerConfirm")}
                </button>
              </div>
            </DialogPrimitive.Popup>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      )}

      {/* Deny modal */}
      {denyTarget && (
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
