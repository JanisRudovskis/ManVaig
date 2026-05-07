"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  X,
  Loader2,
  HandCoins,
  UserCircle,
  Check,
  XCircle,
  Ban,
  AlertTriangle,
  Mail,
  Eye,
  EyeOff,
  ChevronDown,
  ExternalLink,
  Volume2,
  VolumeOff,
  Clock,
  RefreshCw,
  Minus,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { UserAvatar } from "@/components/user-avatar";
import { Switch } from "@/components/ui/switch";
import { formatPrice, EndDateCountdown, isEnded } from "@/components/item-card-shared";
import { placeBid } from "@/lib/items";
import type { BidListResponse, BidResponse } from "@/lib/items";
import { useOffersBids, INITIAL_LIMIT } from "@/hooks/use-offers-bids";

// === Types ===

interface OffersPopupProps {
  itemId: string;
  itemTitle: string;
  itemImages?: { url: string }[];
  onClose: () => void;
}

// === Image gallery lightbox ===

export function ImageGallery({ images, onClose }: { images: { url: string }[]; onClose: () => void }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, images.length - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [images.length, onClose]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90" onClick={onClose}>
      <div className="relative flex max-h-[90vh] max-w-[90vw] flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <img
          src={images[index].url}
          alt=""
          className="max-h-[80vh] max-w-[90vw] rounded-lg object-contain"
        />
        {images.length > 1 && (
          <div className="mt-3 flex items-center gap-4">
            <button
              onClick={() => setIndex((i) => Math.max(i - 1, 0))}
              disabled={index === 0}
              className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-30"
            >
              <ChevronDown className="size-5 rotate-90" />
            </button>
            <span className="text-sm text-white/70 tabular-nums">
              {index + 1} / {images.length}
            </span>
            <button
              onClick={() => setIndex((i) => Math.min(i + 1, images.length - 1))}
              disabled={index === images.length - 1}
              className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-30"
            >
              <ChevronDown className="size-5 -rotate-90" />
            </button>
          </div>
        )}
        <button
          onClick={onClose}
          className="absolute -right-2 -top-2 flex size-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
        >
          <X className="size-5" />
        </button>
      </div>
    </div>
  );
}

// === Exported sub-components (shared with full page) ===

export function timeAgoShort(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  return `${Math.max(1, mins)}m`;
}

export function BidRowSkeleton() {
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-muted/30 px-3 py-2.5">
      <div className="size-5 shrink-0 animate-pulse rounded-full bg-muted" />
      <div className="size-6 shrink-0 animate-pulse rounded-full bg-muted" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
      </div>
      <div className="space-y-1.5 text-right">
        <div className="h-3.5 w-14 animate-pulse rounded bg-muted" />
        <div className="h-2 w-8 animate-pulse rounded bg-muted ml-auto" />
      </div>
    </div>
  );
}

// === Live ticking countdown ===

function LiveCountdown({ end, t }: { end: string; t: (key: string) => string }) {
  const [now, setNow] = useState(Date.now());
  const endTime = new Date(end).getTime();
  const diff = endTime - now;

  const isUnder1h = diff < 3600000;

  // Tick every second under 1h (show seconds), every 30s otherwise (no seconds)
  useEffect(() => {
    const interval = isUnder1h ? 1000 : 30000;
    const timer = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(timer);
  }, [isUnder1h]);

  if (diff <= 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-orange-500/10 px-3 py-2 text-xs font-medium text-orange-400">
        <AlertTriangle className="size-3.5 shrink-0" />
        {t("biddingEnded")} — {t("awaitingSeller")}
      </div>
    );
  }

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  const isUrgent = isUnder1h;
  const isWarning = diff < 86400000;

  let timeText: string;
  if (days > 0) timeText = `${days}d ${hours}h ${minutes}m`;
  else if (!isUnder1h) timeText = `${hours}h ${minutes}m`;
  else timeText = `${minutes}m ${seconds}s`;

  const colorClass = isUrgent
    ? "bg-red-500/10 text-red-400"
    : isWarning
      ? "bg-orange-500/10 text-orange-400"
      : "bg-muted/50 text-muted-foreground";

  return (
    <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${colorClass}`}>
      <Clock className="size-3.5 shrink-0" />
      {t("biddingEndsIn")} {timeText}
    </div>
  );
}

export function StatusBanner({
  data,
  t,
}: {
  data: BidListResponse;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  if (data.biddingClosed) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-400">
        <Check className="size-3.5 shrink-0" />
        {t("sold")}
      </div>
    );
  }

  if (data.biddingPaused) {
    const acceptedBid = data.bids.find((b) => b.status === "Accepted");
    const ago = acceptedBid?.acceptedAt ? timeAgoShort(acceptedBid.acceptedAt) : "";
    return (
      <div className="flex items-center gap-2 rounded-lg bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-400">
        <HandCoins className="size-3.5 shrink-0" />
        <span>
          {t("dealInProgress")}
          {ago && <span className="ml-1 text-blue-400/60">· {t("acceptedAgo", { time: ago })}</span>}
        </span>
      </div>
    );
  }

  if (data.failedDealCount > 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-400">
        <AlertTriangle className="size-3.5 shrink-0" />
        <span>
          {t("biddingReopened")}
          <span className="ml-1 opacity-60">· {t("previousDealsFailed", { count: data.failedDealCount })}</span>
        </span>
      </div>
    );
  }

  // Timed auction — live countdown or ended
  if (data.endDate) {
    return <LiveCountdown end={data.endDate as string} t={t} />;
  }

  // Non-timed, no special state — no banner needed
  return null;
}

export function BidRow({
  bid,
  rank,
  isTop,
  flash,
  isNew,
  isOwner,
  t,
  onAccept,
  onDeny,
  onComplete,
  onFail,
}: {
  bid: BidResponse;
  rank: number;
  isTop: boolean;
  flash?: boolean;
  isNew?: boolean;
  isOwner: boolean;
  t: (key: string, values?: Record<string, string | number>) => string;
  onAccept: () => void;
  onDeny: () => void;
  onComplete: () => void;
  onFail: () => void;
}) {
  const isDenied = bid.status === "Denied";
  const isFailed = bid.status === "Failed";
  const isAccepted = bid.status === "Accepted";
  const isCompleted = bid.status === "Completed";
  const hasStatusBadge = isAccepted || isCompleted || isDenied || isFailed;

  return (
    <div
      className={cn(
        "rounded-lg px-3 py-3 transition-colors duration-700",
        isAccepted && "border-l-4 border-blue-500 bg-blue-500/10",
        isCompleted && "border-l-4 border-emerald-500 bg-emerald-500/10",
        isDenied && "opacity-50",
        isFailed && "opacity-60",
        isTop && !isAccepted && !isCompleted && "bg-emerald-500/5 border-l-4 border-emerald-500/40",
        !hasStatusBadge && !isTop && "bg-muted/30",
        flash && "!bg-emerald-500/20",
        isNew && "bid-slide-in"
      )}
    >
      <div className="flex items-center gap-2.5">
        {/* Rank */}
        <span className={cn(
          "w-7 shrink-0 text-right text-xs font-medium tabular-nums",
          isTop ? "text-emerald-400" : "text-muted-foreground/60"
        )}>
          #{rank}
        </span>

        {/* Avatar — anonymous bids always show generic icon */}
        {bid.isAnonymous ? (
          <EyeOff className="size-10 shrink-0 text-muted-foreground/40" />
        ) : (
          <UserAvatar
            displayName={bid.bidderName ?? bid.bidderLabel}
            avatarUrl={bid.bidderAvatarUrl ?? null}
            size="base"
          />
        )}

        {/* Name + badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={cn("text-base font-medium truncate", isDenied && "line-through")}>
              {bid.isAnonymous ? t("anonymous") : (bid.bidderName ?? bid.bidderLabel)}
            </span>
            {bid.isOwnBid && (
              <span className="shrink-0 rounded-full bg-primary/20 px-1.5 py-0.5 text-[0.6rem] font-semibold text-primary">
                {t("you")}
              </span>
            )}
            {hasStatusBadge && (
              <span
                className={cn(
                  "shrink-0 rounded-full px-1.5 py-0.5 text-[0.6rem] font-semibold",
                  isAccepted && "bg-blue-500/20 text-blue-400",
                  isCompleted && "bg-emerald-500/20 text-emerald-400",
                  isDenied && "bg-red-500/20 text-red-400",
                  isFailed && "bg-orange-500/20 text-orange-400"
                )}
              >
                {t(`status_${bid.status}`)}
              </span>
            )}
          </div>

          {/* Contact info (revealed after acceptance) */}
          {(bid.bidderContact || bid.sellerContact) && (
            <div className="mt-1 flex flex-col gap-0.5">
              {bid.bidderContact && (
                <span className="flex items-center gap-1 text-[0.65rem] text-muted-foreground">
                  <Mail className="size-3" />
                  {t("bidderEmail")}: {bid.bidderContact}
                </span>
              )}
              {bid.sellerContact && (
                <span className="flex items-center gap-1 text-[0.65rem] text-muted-foreground">
                  <Mail className="size-3" />
                  {t("sellerEmail")}: {bid.sellerContact}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Amount + time */}
        <div className="shrink-0 text-right">
          <span className={cn("text-base font-bold text-emerald-400", isDenied && "line-through text-muted-foreground")}>
            {formatPrice(bid.amount)}
          </span>
          <p className="text-xs text-muted-foreground">{timeAgoShort(bid.createdAt)}</p>
        </div>
      </div>

      {/* Seller action buttons */}
      {isOwner && bid.status === "Active" && (
        <div className="mt-2 flex gap-2">
          <button
            onClick={onAccept}
            className="flex-1 rounded-md bg-emerald-500/15 px-2 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/25"
          >
            <Check className="mr-1 inline size-3" />
            {t("accept")}
          </button>
          <button
            onClick={onDeny}
            className="flex-1 rounded-md bg-red-500/10 px-2 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20"
          >
            <Ban className="mr-1 inline size-3" />
            {t("deny")}
          </button>
        </div>
      )}

      {/* Accepted bid: complete / fail actions */}
      {isOwner && isAccepted && (
        <div className="mt-2 flex gap-2">
          <button
            onClick={onComplete}
            className="flex-1 rounded-md bg-emerald-500/15 px-2 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/25"
          >
            <Check className="mr-1 inline size-3" />
            {t("completeDeal")}
          </button>
          <button
            onClick={onFail}
            className="flex-1 rounded-md bg-orange-500/10 px-2 py-1.5 text-xs font-medium text-orange-400 transition-colors hover:bg-orange-500/20"
          >
            <XCircle className="mr-1 inline size-3" />
            {t("dealFailed")}
          </button>
        </div>
      )}
    </div>
  );
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  confirmColor,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  confirmColor: "emerald" | "orange" | "red";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const colorClasses = {
    emerald: "bg-emerald-500 text-white hover:bg-emerald-600",
    orange: "bg-orange-500 text-white hover:bg-orange-600",
    red: "bg-red-500 text-white hover:bg-red-600",
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative z-10 mx-4 w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl">
        <h3 className="mb-2 text-sm font-semibold">{title}</h3>
        <p className="mb-5 text-xs text-muted-foreground">{body}</p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-md border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={cn("flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors", colorClasses[confirmColor])}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PlaceBidForm({
  data,
  itemId,
  t,
  onBidPlaced,
  inputFocusedRef,
}: {
  data: BidListResponse;
  itemId: string;
  t: (key: string, values?: Record<string, string | number>) => string;
  onBidPlaced: () => void;
  inputFocusedRef: React.MutableRefObject<boolean>;
}) {
  const { isLoggedIn, openLoginDialog } = useAuth();
  const [amount, setAmount] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("manvaig_bid_anon") === "on";
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirming, setConfirming] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (data.minNextBid != null) {
      setAmount(data.minNextBid.toFixed(2));
    }
  }, [data.minNextBid]);

  if (!isLoggedIn) {
    return (
      <button
        onClick={openLoginDialog}
        className="w-full rounded-md bg-primary/15 px-3 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/25"
      >
        {t("loginToOffer")}
      </button>
    );
  }

  if (data.isOwner) return <p className="text-center text-xs text-muted-foreground py-2">{t("cannotBidOwn")}</p>;
  if (data.biddingClosed) return <p className="text-center text-xs text-muted-foreground py-2">{t("biddingClosed")}</p>;
  if (data.biddingPaused) return <p className="text-center text-xs text-muted-foreground py-2">{t("biddingPaused")}</p>;
  if (data.endDate && isEnded(data.endDate as string)) return <p className="text-center text-xs text-muted-foreground py-2">{t("biddingEnded")}</p>;

  const minBid = data.minNextBid ?? 0.01;
  const step = data.offerStep ?? 0.01;

  const adjustAmount = (dir: 1 | -1) => {
    const current = parseFloat(amount) || 0;
    const next = Math.round((current + dir * step) * 100) / 100;
    if (next >= minBid) {
      setAmount(next.toFixed(2));
      resetConfirm();
    }
  };

  const resetConfirm = () => {
    setConfirming(false);
    if (confirmTimerRef.current) { clearTimeout(confirmTimerRef.current); confirmTimerRef.current = null; }
  };

  const handleSubmit = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;
    if (numAmount < minBid) {
      setError(t("error_BID_TOO_LOW"));
      setAmount(minBid.toFixed(2));
      return;
    }

    // Two-tap confirm: first tap → confirming, second tap → submit
    if (!confirming) {
      setConfirming(true);
      confirmTimerRef.current = setTimeout(() => setConfirming(false), 3000);
      return;
    }

    resetConfirm();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const result = await placeBid(itemId, numAmount, isAnonymous);
      setSuccess(result.updated ? t("bidUpdated") : t("bidPlaced"));
      onBidPlaced();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      const code = err instanceof Error ? err.message : "bid_place_failed";
      setError(t(`error_${code}`));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
      {success && <p className="text-sm font-medium text-emerald-400">{success}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => adjustAmount(-1)}
          disabled={parseFloat(amount) <= minBid}
          className="flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground disabled:opacity-30"
        >
          <Minus className="size-5" />
        </button>
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
          <input
            type="number"
            step={step}
            min={minBid}
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setError(""); resetConfirm(); }}
            onFocus={() => { inputFocusedRef.current = true; }}
            onBlur={() => { inputFocusedRef.current = false; }}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
            placeholder={minBid.toFixed(2)}
            className="no-spinner w-full rounded-md border border-border bg-input pl-7 pr-3 py-2.5 text-center text-base outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
          />
        </div>
        <button
          type="button"
          onClick={() => adjustAmount(1)}
          className="flex size-11 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
        >
          <Plus className="size-5" />
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading || !amount}
          className={cn(
            "shrink-0 rounded-md px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-50",
            confirming
              ? "bg-amber-500 text-white hover:bg-amber-600"
              : "bg-emerald-500 text-white hover:bg-emerald-600"
          )}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : confirming ? `${t("confirm")} €${parseFloat(amount).toFixed(2)}?` : t("placeBid")}
        </button>
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
          <Switch size="sm" checked={isAnonymous} onCheckedChange={(v) => { setIsAnonymous(v); localStorage.setItem("manvaig_bid_anon", v ? "on" : "off"); }} />
          {isAnonymous ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          {t("bidAnonymously")}
        </label>
        <span className="text-[0.65rem] text-muted-foreground">
          {t("minBid", { amount: formatPrice(minBid) })}
        </span>
      </div>
    </div>
  );
}

// === Freshness indicator (silent when healthy, one warning when stale) ===

export function FreshnessIndicator({
  lastUpdatedAt,
  staleWarningMs,
  connectionLost,
  onRefresh,
  t,
}: {
  lastUpdatedAt: number | null;
  staleWarningMs: number;
  staleDangerMs?: number;
  connectionLost: boolean;
  onRefresh: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    const check = () => {
      if (!lastUpdatedAt) { setIsStale(false); return; }
      setIsStale(Date.now() - lastUpdatedAt > staleWarningMs);
    };
    check();
    const timer = setInterval(check, 5000);
    return () => clearInterval(timer);
  }, [lastUpdatedAt, staleWarningMs]);

  if (!connectionLost && !isStale) return null;

  return (
    <button
      onClick={onRefresh}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs font-semibold text-amber-400 animate-pulse transition-colors hover:bg-amber-500/20"
    >
      <AlertTriangle className="size-4 shrink-0" />
      {t("dataStale")}
    </button>
  );
}

// === Summary bar (shared) ===

export function BidsSummaryBar({
  data,
  lastUpdatedAt,
  staleWarningMs,
  staleDangerMs,
  connectionLost,
  onRefresh,
  t,
}: {
  data: BidListResponse | null;
  lastUpdatedAt?: number | null;
  staleWarningMs?: number;
  staleDangerMs?: number;
  connectionLost?: boolean;
  onRefresh?: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  if (!data) {
    return (
      <>
        <div className="h-8 animate-pulse rounded-lg bg-muted" />
        <div className="flex items-center justify-between">
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          <div className="h-3 w-14 animate-pulse rounded bg-muted" />
        </div>
      </>
    );
  }

  return (
    <>
      <StatusBanner data={data} t={t} />
      {onRefresh && (
        <FreshnessIndicator
          lastUpdatedAt={lastUpdatedAt ?? null}
          staleWarningMs={staleWarningMs ?? 30000}
          staleDangerMs={staleDangerMs ?? 60000}
          connectionLost={connectionLost ?? false}
          onRefresh={onRefresh}
          t={t}
        />
      )}
    </>
  );
}

// === Bid list body (shared) ===

export function BidListBody({
  data,
  loading,
  error,
  topBidFlash,
  newBidIds,
  manualRefreshing,
  hasMore,
  expanded,
  t,
  onShowAll,
  onShowLess,
  onAccept,
  onDeny,
  onComplete,
  onFail,
}: {
  data: BidListResponse | null;
  loading: boolean;
  error: string;
  topBidFlash: boolean;
  newBidIds?: Set<string>;
  manualRefreshing?: boolean;
  hasMore: boolean;
  expanded: boolean;
  t: (key: string, values?: Record<string, string | number>) => string;
  onShowAll: () => void;
  onShowLess: () => void;
  onAccept: (bid: BidResponse) => void;
  onDeny: (bidId: string) => void;
  onComplete: (bid: BidResponse) => void;
  onFail: (bid: BidResponse) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-1.5">
        {Array.from({ length: 3 }).map((_, i) => <BidRowSkeleton key={i} />)}
      </div>
    );
  }

  if (error && !data) {
    return <p className="py-12 text-center text-sm text-destructive">{error}</p>;
  }

  if (!data || data.bids.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <HandCoins className="size-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t("noBidsYet")}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "space-y-1.5 transition-all duration-200",
        manualRefreshing ? "opacity-0 scale-[0.98]" : "opacity-100 scale-100"
      )}
    >
      {data.bids.map((bid, index) => (
        <BidRow
          key={bid.id}
          bid={bid}
          rank={data.totalAllBids - index}
          isTop={index === 0 && bid.status !== "Denied" && bid.status !== "Failed"}
          flash={index === 0 && topBidFlash}
          isNew={newBidIds?.has(bid.id)}
          isOwner={data.isOwner}
          t={t}
          onAccept={() => onAccept(bid)}
          onDeny={() => onDeny(bid.id)}
          onComplete={() => onComplete(bid)}
          onFail={() => onFail(bid)}
        />
      ))}

      {hasMore && (
        <button
          onClick={onShowAll}
          className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronDown className="size-3.5" />
          {t("showAllBids", { count: data.totalAllBids })}
        </button>
      )}
      {expanded && !hasMore && data.totalAllBids > INITIAL_LIMIT && (
        <button
          onClick={onShowLess}
          className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {t("showLess")}
        </button>
      )}

      {error && data && (
        <p className="mt-2 text-center text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}

// === Main OffersPopup ===

export function OffersPopup({ itemId, itemTitle, itemImages, onClose }: OffersPopupProps) {
  const t = useTranslations("offers");
  const [showGallery, setShowGallery] = useState(false);

  // Lock body scroll while popup is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const bids = useOffersBids({ itemId });

  const bidActionCallbacks = {
    onAccept: (bid: BidResponse) =>
      bids.setConfirmAction({ type: "accept", bidId: bid.id, bidAmount: bid.amount, bidderName: bid.bidderName ?? bid.bidderLabel }),
    onDeny: (bidId: string) => bids.handleDeny(bidId),
    onComplete: (bid: BidResponse) =>
      bids.setConfirmAction({ type: "complete", bidId: bid.id, bidAmount: bid.amount, bidderName: bid.bidderName ?? bid.bidderLabel }),
    onFail: (bid: BidResponse) =>
      bids.setConfirmAction({ type: "fail", bidId: bid.id, bidAmount: bid.amount, bidderName: bid.bidderName ?? bid.bidderLabel }),
  };

  return (
    <>
      {/* Confirmation dialog */}
      {bids.confirmAction && (
        <ConfirmDialog
          title={t(`${bids.confirmAction.type}ConfirmTitle`)}
          body={t(`${bids.confirmAction.type}ConfirmBody`)}
          confirmLabel={t(`${bids.confirmAction.type}ConfirmButton`)}
          confirmColor={bids.confirmAction.type === "fail" ? "orange" : "emerald"}
          onConfirm={bids.executeConfirm}
          onCancel={() => bids.setConfirmAction(null)}
        />
      )}

      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Bottom sheet (mobile) / Centered modal (desktop) */}
      <div
        className={cn(
          "fixed z-51 flex flex-col overflow-hidden border border-border bg-card shadow-2xl",
          "inset-x-0 bottom-0 h-[75vh] rounded-t-2xl",
          "md:inset-auto md:left-1/2 md:top-1/2 md:h-[70vh] md:w-[480px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl"
        )}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center py-2 md:hidden">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Gallery lightbox */}
        {showGallery && itemImages && itemImages.length > 0 && (
          <ImageGallery images={itemImages} onClose={() => setShowGallery(false)} />
        )}

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 md:px-6 md:py-4">
          <div className="flex items-center gap-3 min-w-0">
            {itemImages && itemImages[0] && (
              <button
                onClick={() => setShowGallery(true)}
                className="shrink-0 overflow-hidden rounded-lg transition-opacity hover:opacity-80"
              >
                <img src={itemImages[0].url} alt="" className="size-14 object-cover" />
              </button>
            )}
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">{t("title")}</h2>
              <p className="text-xs text-muted-foreground truncate">
                {itemTitle}
                {bids.data && bids.data.uniqueBidders > 0 && (
                  <span className="ml-1.5 opacity-60">· {t("bidders", { count: bids.data.uniqueBidders })}</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={bids.toggleSound}
              className={`flex size-9 items-center justify-center rounded-lg transition-colors hover:bg-muted ${
                bids.soundEnabled ? "text-emerald-400" : "text-muted-foreground"
              }`}
              title={bids.soundEnabled ? t("soundEnabled") : t("soundDisabled")}
            >
              {bids.soundEnabled ? <Volume2 className="size-5" /> : <VolumeOff className="size-5" />}
            </button>
            <button
              onClick={bids.manualRefresh}
              disabled={bids.manualRefreshing}
              className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Refresh"
            >
              <RefreshCw className={cn("size-5 transition-transform", bids.manualRefreshing && "animate-spin")} />
            </button>
            <a
              href={`/items/${itemId}/offers`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Open in new tab"
            >
              <ExternalLink className="size-5" />
            </a>
            <button
              onClick={onClose}
              className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Status banner + summary */}
        <div className="shrink-0 space-y-2 border-b border-border px-4 py-3 md:px-6">
          <BidsSummaryBar
            data={bids.data}
            lastUpdatedAt={bids.lastUpdatedAt}
            staleWarningMs={bids.staleWarningMs}
            staleDangerMs={bids.staleDangerMs}
            connectionLost={bids.connectionLost}
            onRefresh={bids.manualRefresh}
            t={t}
          />
        </div>

        {/* Bid list (scrollable) */}
        <div className="flex-1 overflow-y-auto px-4 py-3 md:px-6">
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
            {...bidActionCallbacks}
          />
        </div>

        {/* Bottom: Place Bid form */}
        <div className="shrink-0 border-t border-border px-4 py-3 md:px-6">
          {bids.data ? (
            <PlaceBidForm
              data={bids.data}
              itemId={itemId}
              t={t}
              onBidPlaced={() => bids.loadBids(bids.currentLimit)}
              inputFocusedRef={bids.inputFocusedRef}
            />
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="h-10 flex-1 animate-pulse rounded-md bg-muted" />
                <div className="h-10 w-28 animate-pulse rounded-md bg-muted" />
              </div>
              <div className="flex items-center justify-between">
                <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
