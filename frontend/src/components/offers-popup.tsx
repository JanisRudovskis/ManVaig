"use client";

import { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  X,
  Loader2,
  RefreshCw,
  Minus,
  Plus,
  ChevronDown,
  Zap,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { UserAvatar } from "@/components/user-avatar";
import { SellerView, BidderCard, SectionDivider } from "@/components/seller-offers-popup";
import { formatPrice, isEnded } from "@/components/item-card-shared";
import { placeBid, placeInstantBuy } from "@/lib/items";
import type { BidListResponse, BidResponse, UniqueBidder } from "@/lib/items";
import { useOffersBids, INITIAL_LIMIT } from "@/hooks/use-offers-bids";

// ─── Types ───────────────────────────────────────────────────────────

interface OffersPopupProps {
  itemId: string;
  itemTitle: string;
  itemImageUrl?: string;
  onClose: () => void;
}

// ─── Client-side derived data ────────────────────────────────────────

function useDerivedBidData(data: BidListResponse | null) {
  return useMemo(() => {
    // Only consider active bids for all calculations
    const activeBids = data?.bids.filter((b) => b.status === "Active") ?? [];

    if (!data || activeBids.length === 0) {
      return {
        uniqueBidders: 0,
        previousTopBid: null as number | null,
        myBid: null as BidResponse | null,
        myBidRank: null as number | null,
        deltas: new Map<string, number>(),
      };
    }

    const bidderIds = new Set(activeBids.map((b) => b.bidderId));
    const uniqueBidders = bidderIds.size;

    const previousTopBid = activeBids.length > 1 ? activeBids[1].amount : null;

    const myBidIndex = activeBids.findIndex((b) => b.isOwnBid);
    const myBid = myBidIndex >= 0 ? activeBids[myBidIndex] : null;
    const myBidRank = myBidIndex >= 0 ? myBidIndex + 1 : null;

    // Check if user's bid was denied (not in active, but in full list)
    const myDeniedBid = myBid == null
      ? data.bids.find((b) => b.isOwnBid && b.status === "Denied") ?? null
      : null;

    const deltas = new Map<string, number>();
    for (let i = 0; i < activeBids.length; i++) {
      if (i < activeBids.length - 1) {
        deltas.set(activeBids[i].id, activeBids[i].amount - activeBids[i + 1].amount);
      }
    }

    return { uniqueBidders, previousTopBid, myBid, myBidRank, myDeniedBid, deltas };
  }, [data]);
}

// ─── Time helpers ────────────────────────────────────────────────────

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

/** "ends in 4h 12m" — largest unit ≥ 1, two-part phrase */
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

function formatEndTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

// ─── Urgency state ───────────────────────────────────────────────────

type UrgencyState = "final-10m" | "final-minute" | "live" | "ended" | "sold";

function getUrgencyState(data: BidListResponse | null, now: number): UrgencyState {
  if (!data) return "live";
  if (data.isSold) return "sold";
  if (data.endDate && isEnded(data.endDate)) return "ended";
  if (data.endDate) {
    const diff = new Date(data.endDate).getTime() - now;
    if (diff <= 60_000 && diff > 0) return "final-minute";
    if (diff <= 600_000 && diff > 0) return "final-10m";
  }
  return "live";
}

// ─── Rolling digit ───────────────────────────────────────────────────

function RollingDigit({ value }: { value: number }) {
  return (
    <span className="tx-rd">
      <span
        className="tx-rdcol"
        style={{ transform: `translateY(-${value}em)` }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <span key={d} className="tx-rdcell">
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}

// ─── Crown icon ─────────────────────────────────────────────────────

function CrownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M3 19 L5.5 4 L9 13 L12 8 L15 13 L18.5 4 L21 19 Z" />
    </svg>
  );
}

// ─── Bell icons ─────────────────────────────────────────────────────

function BellOff({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M7 8a5 5 0 0 1 10 0c0 6 2.5 8 2.5 8h-15s2.5-2 2.5-8" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

function BellOn({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M7 8a5 5 0 0 1 10 0c0 6 2.5 8 2.5 8h-15s2.5-2 2.5-8" />
      <path d="M10 20a2 2 0 0 0 4 0" />
      <path d="M3 6.5c0.6-1.2 1.5-2.2 2.7-2.9" opacity="0.9" />
      <path d="M21 6.5c-0.6-1.2-1.5-2.2-2.7-2.9" opacity="0.9" />
    </svg>
  );
}

// ─── Toggle bell with tooltip ────────────────────────────────────────

function ToggleBell({
  subscribed,
  onToggle,
  t,
}: {
  subscribed: boolean;
  onToggle: () => void;
  t: (key: string) => string;
}) {
  const [tooltip, setTooltip] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = () => {
    onToggle();
    const newState = !subscribed;
    setTooltip(newState ? t("subscribed") : t("unsubscribed"));
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setTooltip(null), 1500);
  };

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className={cn(
          "flex size-10 items-center justify-center rounded-[10px] transition-colors md:size-9",
          subscribed
            ? "text-ticker-emer hover:bg-ticker-emer/10"
            : "text-ticker-mid hover:bg-ticker-bg-2 hover:text-ticker-text"
        )}
      >
        {subscribed ? <BellOn /> : <BellOff />}
      </button>
      <span
        className={cn(
          "pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-ticker-bg-3 px-2 py-1 font-[family-name:var(--font-ticker)] text-[10px] text-ticker-text shadow-lg transition-opacity duration-200",
          tooltip ? "opacity-100" : "opacity-0",
        )}
      >
        {tooltip}
      </span>
    </div>
  );
}

// ─── 6. Header ───────────────────────────────────────────────────────

function TickerHeader({
  itemTitle,
  itemId,
  manualRefreshing,
  connectionLost,
  urgency,
  subscribed,
  isLoggedIn,
  onRefresh,
  onToggleSubscription,
  onItemClick,
  onClose,
  t,
}: {
  itemTitle: string;
  itemId: string;
  manualRefreshing: boolean;
  connectionLost: boolean;
  urgency: UrgencyState;
  subscribed: boolean | null;
  isLoggedIn: boolean;
  onRefresh: () => void;
  onToggleSubscription: () => void;
  onItemClick: () => void;
  onClose: () => void;
  t: (key: string) => string;
}) {
  const isLive = urgency === "live" || urgency === "final-10m" || urgency === "final-minute";

  // Connection lost — special header
  if (connectionLost) {
    return (
      <div className="flex flex-none items-center gap-3 border-b border-ticker-line px-4 pb-3 pt-3.5">
        <span className="inline-block size-2 shrink-0 rounded-full bg-ticker-red shadow-[0_0_0_4px_oklch(0.68_0.22_25/0.22)]" />
        <span className="flex-1 text-sm font-medium text-ticker-red">{t("connectionLost")}</span>
        <button
          onClick={onRefresh}
          className={cn(
            "flex size-10 items-center justify-center rounded-[10px] text-ticker-red transition-colors hover:bg-ticker-red/10 md:size-9",
            manualRefreshing && "is-spinning"
          )}
          title={t("refresh")}
        >
          <RefreshCw className="size-[18px]" />
        </button>
        <DialogPrimitive.Close
          className="flex size-10 items-center justify-center rounded-[10px] text-ticker-mid transition-colors hover:bg-ticker-bg-2 hover:text-ticker-text md:size-9"
          aria-label="Close"
        >
          <X className="size-5 md:size-[20px]" />
        </DialogPrimitive.Close>
      </div>
    );
  }

  return (
    <div className="flex flex-none items-center gap-3 border-b border-ticker-line px-4 pb-3 pt-3.5">
      {/* Live dot */}
      {isLive && (
        <span
          className={cn(
            "inline-block size-2 shrink-0 rounded-full bg-ticker-emer shadow-[0_0_0_4px_oklch(0.78_0.18_165/0.18)]",
            (urgency === "final-10m" || urgency === "final-minute") && "ticker-pulse"
          )}
        />
      )}

      {/* Title — clickable */}
      <button
        type="button"
        onClick={onItemClick}
        className="min-w-0 flex-1 cursor-pointer truncate text-left text-sm font-medium text-ticker-mid hover:text-ticker-text"
        title={itemTitle}
      >
        {itemTitle}
      </button>

      {/* Action cluster */}
      <div className="flex flex-none items-center gap-0.5">
        {/* Bell — subscription toggle (only for logged-in users) */}
        {isLoggedIn && subscribed != null && (
          <ToggleBell
            subscribed={subscribed}
            onToggle={onToggleSubscription}
            t={t}
          />
        )}

        {/* Refresh — always available (audit T8) */}
        <button
          onClick={onRefresh}
          className={cn(
            "flex size-10 items-center justify-center rounded-[10px] text-ticker-mid transition-colors hover:bg-ticker-bg-2 hover:text-ticker-text md:size-9",
            manualRefreshing && "is-spinning"
          )}
          title={t("refresh")}
        >
          <RefreshCw className="size-[18px]" />
        </button>

        {/* Close */}
        <DialogPrimitive.Close
          className="ml-1 flex size-10 items-center justify-center rounded-[10px] text-ticker-mid transition-colors hover:bg-ticker-bg-2 hover:text-ticker-text md:size-9"
          aria-label="Close"
        >
          <X className="size-[22px] md:size-5" />
        </DialogPrimitive.Close>
      </div>
    </div>
  );
}

// ─── 7. Hero with rolling digits ─────────────────────────────────────

function TickerHero({
  data,
  derived,
  topBidFlash,
  deltaBadge,
  isFinal10Min,
  isFinalMinute,
  t,
}: {
  data: BidListResponse;
  derived: ReturnType<typeof useDerivedBidData>;
  topBidFlash: boolean;
  deltaBadge: number | null;
  isFinal10Min: boolean;
  isFinalMinute: boolean;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const topBid = data.highestBid;
  const isEmpty = data.totalBids === 0;
  const topBidder = data.bids[0];

  // Split price for rolling digits
  const whole = topBid != null ? Math.floor(topBid) : 0;
  const frac = topBid != null ? (topBid % 1).toFixed(2).slice(2) : "00";
  const digits = String(whole).split("").map(Number);

  // Empty state — no price fields, just motivational message
  if (isEmpty) {
    return (
      <div className="flex-none px-7 pb-7 pt-9 text-center">
        <span className="text-[15px] text-ticker-mid">{t("noBidsYet")}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "tx-hero relative flex-none overflow-visible px-7 pb-7 pt-9 text-center",
        topBidFlash && "is-flash"
      )}
    >
      {/* Heartbeat pulse aura — final 10 minutes */}
      {isFinal10Min && (
        <span
          className={cn("tx-pulse-aura", isFinalMinute && "is-final-minute")}
          aria-hidden="true"
        />
      )}

      {/* Label */}
      <div className="relative z-[1] mb-4 font-[family-name:var(--font-ticker)] text-[11px] uppercase tracking-[0.22em] text-ticker-dim">
        {t("topOffer").toUpperCase()}
      </div>

      {/* Delta badge */}
      {deltaBadge != null && (
        <div className="tx-deltabadge absolute left-1/2 top-[26px] z-[2] -translate-x-1/2 rounded-full bg-ticker-emer px-3 py-[5px] font-[family-name:var(--font-ticker)] text-xs font-bold tracking-[0.04em] text-[oklch(0.15_0_0)] shadow-[0_6px_24px_oklch(0.78_0.18_165/0.35)]">
          ▲&nbsp;+€{deltaBadge.toFixed(0)}
        </div>
      )}

      {/* Hero number */}
      <div className="relative z-[1] font-[family-name:var(--font-ticker)] text-[68px] font-bold leading-[0.95] tracking-[-0.025em] tabular-nums text-ticker-text md:text-[76px]">
        <span className="mr-0.5 align-[22px] text-[36px] font-medium text-ticker-mid">€</span>
        {digits.map((d, i) => (
          <RollingDigit key={i} value={d} />
        ))}
        <span className="text-[36px] font-medium text-ticker-mid">.{frac}</span>
      </div>

      {/* From line */}
      {topBidder && (
        <div className="relative z-[1] mt-3.5">
          <span
            key={topBidder.bidderId + topBidder.amount}
            className="tx-from-anim inline-block text-[13.5px] text-ticker-mid"
          >
            from {topBidder.bidderName} · {timeAgo(topBidder.createdAt)}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── 8. Your bid card ────────────────────────────────────────────────

function TickerYourBid({
  data,
  derived,
  t,
}: {
  data: BidListResponse;
  derived: ReturnType<typeof useDerivedBidData>;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const { myBid, myBidRank, myDeniedBid } = derived;

  // Show denied state
  if (myDeniedBid) {
    return (
      <div className="mx-4 mb-4 flex-none rounded-xl border border-ticker-red/[0.22] bg-ticker-red/[0.06] p-[14px_16px]">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="font-[family-name:var(--font-ticker)] text-[10px] font-medium uppercase tracking-[0.18em] text-ticker-red">
            {t("yourOffer").toUpperCase()}
          </span>
          <span className="shrink-0 rounded-full bg-ticker-red/15 px-1.5 py-[2px] font-[family-name:var(--font-ticker)] text-[9.5px] font-bold uppercase tracking-[0.14em] text-ticker-red">
            {t("deniedPill")}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-[family-name:var(--font-ticker)] text-[22px] font-bold tracking-[-0.01em] tabular-nums text-ticker-dim line-through">
            €{myDeniedBid.amount.toFixed(2)}
          </span>
          {myDeniedBid.denyReason && (
            <span className="text-[12px] text-ticker-red/70">
              {t(`denyReason_${myDeniedBid.denyReason}` as Parameters<typeof t>[0])}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (!myBid || myBidRank == null) return null;

  const deltaBelow =
    data.highestBid != null ? data.highestBid - myBid.amount : 0;

  return (
    <div className="mx-4 mb-4 flex-none rounded-xl border border-ticker-emer/[0.22] bg-ticker-bg-2 p-[14px_16px]">
      {/* Top row */}
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="font-[family-name:var(--font-ticker)] text-[10px] font-medium uppercase tracking-[0.18em] text-ticker-emer">
          {t("yourOffer").toUpperCase()}
        </span>
        <span className="text-xs text-ticker-dim">
          {t("rankOfTotal", { rank: myBidRank, total: data.totalBids })}
        </span>
      </div>
      {/* Bottom row */}
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-[family-name:var(--font-ticker)] text-[22px] font-bold tracking-[-0.01em] tabular-nums">
          €{myBid.amount.toFixed(2)}
        </span>
        {deltaBelow > 0 && (
          <span className="text-[12.5px] text-ticker-mid">
            {t("belowTop", { delta: deltaBelow.toFixed(2) })}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Watcher segment (inline in time strip) ─────────────────────────

function WatcherSegment({
  count,
  t,
}: {
  count: number;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [hideIcon, setHideIcon] = useState(false);

  useLayoutEffect(() => {
    setHideIcon(false);
    if (!ref.current) return;
    const raf = requestAnimationFrame(() => {
      const parent = ref.current?.parentElement;
      if (parent && parent.getBoundingClientRect().height > 20) {
        setHideIcon(true);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [count]);

  if (count <= 0) return null;

  return (
    <span ref={ref} className="inline-flex items-center">
      <span aria-hidden="true">{" · "}</span>
      {!hideIcon && (
        <Eye
          aria-hidden="true"
          className="mr-1 inline-block"
          style={{ width: 11, height: 11, strokeWidth: 2.25, verticalAlign: "-1px" }}
        />
      )}
      <span className="tabular-nums">{t("watchingCount", { count })}</span>
    </span>
  );
}

// ─── 9. Time strip / Promoted countdown ──────────────────────────────

function TickerTimeStrip({
  data,
  urgency,
  now,
  t,
}: {
  data: BidListResponse;
  urgency: UrgencyState;
  now: number;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  // Sold/ended — status banner
  if (urgency === "sold" || urgency === "ended") {
    const endedTime = data.endDate ? formatEndTime(data.endDate) : "";
    const label = urgency === "sold" ? t("sold") : t("biddingEnded");
    return (
      <div className="mx-4 mb-4 flex-none rounded-xl bg-ticker-emer/[0.10] py-3 text-center font-[family-name:var(--font-ticker)] text-sm font-bold uppercase tracking-[0.08em] text-ticker-emer">
        {label}
        {endedTime ? ` · ${endedTime}` : ""}
      </div>
    );
  }

  // No end date — "Open for offers"
  if (!data.endDate) {
    return (
      <div className="flex flex-none items-center gap-3.5 px-7 pb-5 pt-2">
        <span className="h-px flex-1 bg-ticker-line" />
        <span className="inline-flex items-center whitespace-nowrap text-[12.5px] tracking-[0.02em] text-ticker-dim">
          {t("openForOffersBuyer")}
          <WatcherSegment count={data.watcherCount} t={t} />
        </span>
        <span className="h-px flex-1 bg-ticker-line" />
      </div>
    );
  }

  const diff = new Date(data.endDate).getTime() - now;
  if (diff <= 0) return null;

  // Final 10 minutes — promoted countdown
  if (urgency === "final-10m" || urgency === "final-minute") {
    const mm = Math.floor(diff / 60_000)
      .toString()
      .padStart(2, "0");
    const ss = Math.floor((diff % 60_000) / 1_000)
      .toString()
      .padStart(2, "0");
    const isRed = urgency === "final-minute";

    return (
      <div
        className={cn(
          "mx-4 mb-4 flex flex-none items-baseline justify-between rounded-xl border px-[18px] py-3",
          isRed
            ? "border-ticker-red/[0.35] bg-ticker-red/[0.08]"
            : "border-ticker-amber/30 bg-ticker-amber/[0.06]"
        )}
      >
        <span
          className={cn(
            "font-[family-name:var(--font-ticker)] text-[13px] font-medium uppercase tracking-[0.14em]",
            isRed ? "text-ticker-red/85" : "text-ticker-amber/85"
          )}
        >
          {isRed ? t("finalMinute").toUpperCase() : t("finalEndsIn").toUpperCase()}
        </span>
        <span
          className={cn(
            "font-[family-name:var(--font-ticker)] text-[30px] font-bold leading-none tabular-nums",
            isRed ? "text-ticker-red" : "text-ticker-amber"
          )}
        >
          {mm}:{ss}
        </span>
      </div>
    );
  }

  // Normal — "ends in 4h 12m"
  return (
    <div className="flex flex-none items-center gap-3.5 px-7 pb-5 pt-2">
      <span className="h-px flex-1 bg-ticker-line" />
      <span className="inline-flex items-center whitespace-nowrap text-[12.5px] tracking-[0.02em] text-ticker-dim">
        {t("endsInPhrase", { value: formatEndsIn(data.endDate) })}
        <WatcherSegment count={data.watcherCount} t={t} />
      </span>
      <span className="h-px flex-1 bg-ticker-line" />
    </div>
  );
}

// ─── 11. Bid form ────────────────────────────────────────────────────

function TickerBidForm({
  data,
  derived,
  itemId,
  t,
  onBidPlaced,
  inputFocusedRef,
  instantBuyPrice,
  pendingInstantBuy,
}: {
  data: BidListResponse;
  derived: ReturnType<typeof useDerivedBidData>;
  itemId: string;
  t: (key: string, values?: Record<string, string | number>) => string;
  onBidPlaced: () => void;
  inputFocusedRef: React.MutableRefObject<boolean>;
  instantBuyPrice?: number | null;
  pendingInstantBuy?: BidListResponse["pendingInstantBuy"];
}) {
  const { isLoggedIn, openLoginDialog } = useAuth();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirming, setConfirming] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeTab, setActiveTab] = useState<"offer" | "buy">("offer");
  const [ibConfirming, setIbConfirming] = useState(false);
  const [ibLoading, setIbLoading] = useState(false);
  const [ibError, setIbError] = useState("");

  const hasBid = derived.myBid != null;
  const isOwnIb = pendingInstantBuy?.isOwnInstantBuy === true;
  const showSwitch = instantBuyPrice != null && !isOwnIb;
  const ibDisabled = pendingInstantBuy != null;

  useEffect(() => {
    if (data.minNextBid != null) setAmount(data.minNextBid.toFixed(2));
  }, [data.minNextBid]);

  // Not logged in
  if (!isLoggedIn) {
    return (
      <div className="flex-none border-t border-ticker-line px-4 pb-4 pt-3.5">
        <button
          onClick={openLoginDialog}
          className="flex h-13 w-full items-center justify-center rounded-xl border border-ticker-emer font-semibold text-[15px] text-ticker-emer transition-colors hover:bg-ticker-emer/10"
        >
          {t("loginToPlaceOffer")}
        </button>
      </div>
    );
  }

  // Owner
  if (data.isOwner) {
    return (
      <div className="flex-none border-t border-ticker-line px-4 py-3">
        <p className="text-center font-[family-name:var(--font-ticker)] text-[11px] text-ticker-dim">
          {t("cannotBidOwn")}
        </p>
      </div>
    );
  }

  // User has a pending instant buy — can't also bid
  if (isOwnIb) {
    return null;
  }

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
    if (confirmTimerRef.current) {
      clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = null;
    }
  };

  const handleSubmit = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;
    if (numAmount < minBid) {
      setError(t("error_BID_TOO_LOW"));
      setAmount(minBid.toFixed(2));
      return;
    }

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
      const result = await placeBid(itemId, numAmount);
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

  const handleInstantBuy = async () => {
    if (!ibConfirming) {
      setIbConfirming(true);
      return;
    }
    setIbLoading(true);
    setIbError("");
    try {
      await placeInstantBuy(itemId);
      onBidPlaced(); // triggers refresh — popup updates with new instant buy state
    } catch (err) {
      const code = err instanceof Error ? err.message : "instant_buy_failed";
      setIbError(t(`error_${code}` as Parameters<typeof t>[0]));
      setIbConfirming(false);
    } finally {
      setIbLoading(false);
    }
  };

  return (
    <div className="flex-none border-t border-ticker-line px-4 pb-4 pt-3.5">
      {/* Segmented switch — only when instant buy price is available */}
      {showSwitch && (
        <div className="mb-3 grid grid-cols-2 gap-0 rounded-[10px] border border-ticker-line bg-ticker-bg-2 p-[3px]">
          <button
            type="button"
            onClick={() => { setActiveTab("offer"); setIbConfirming(false); setIbError(""); }}
            className={cn(
              "rounded-[7px] py-2.5 font-[family-name:var(--font-ticker)] text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors",
              activeTab === "offer" ? "bg-ticker-bg-3 text-ticker-text" : "text-ticker-dim hover:text-ticker-mid"
            )}
          >
            {t("placeOfferTab")}
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("buy"); setError(""); }}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-[7px] py-2.5 font-[family-name:var(--font-ticker)] text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors",
              activeTab === "buy" ? "bg-ticker-bg-3 text-ticker-amber" : "text-ticker-dim hover:text-ticker-mid"
            )}
          >
            <Zap className="size-3" />
            {t("buyNowTab")}
          </button>
        </div>
      )}

      {/* Buy Now panel */}
      {showSwitch && activeTab === "buy" ? (
        <>
          {/* Listed price summary card */}
          <div className="mb-3 flex items-center justify-between rounded-[10px] border border-ticker-line bg-ticker-bg-2 px-3.5 py-2.5">
            <div className="min-w-0">
              <div className="font-[family-name:var(--font-ticker)] text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ticker-dim">
                {t("listedPriceLabel")}
              </div>
              <div className="mt-0.5 text-xs text-ticker-mid">{t("skipBiddingHint")}</div>
            </div>
            <span className="font-[family-name:var(--font-ticker)] text-[22px] font-bold tabular-nums tracking-[-0.01em] text-ticker-text">
              &euro;{instantBuyPrice.toFixed(2)}
            </span>
          </div>

          {ibError && <p className="mb-2 text-xs font-medium text-ticker-red">{ibError}</p>}

          <button
            type="button"
            onClick={handleInstantBuy}
            disabled={ibLoading || ibDisabled}
            className="flex h-13 w-full items-center justify-center rounded-xl bg-ticker-amber text-[15px] font-semibold text-[oklch(0.15_0_0)] transition-colors hover:opacity-90 disabled:opacity-50"
            style={{ boxShadow: ibDisabled ? "none" : "0 0 0 1px oklch(0.82 0.16 80 / 0.40), 0 8px 20px oklch(0.82 0.16 80 / 0.18)" }}
          >
            {ibLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : ibConfirming ? (
              t("buyNowConfirm", { amount: instantBuyPrice.toFixed(2) })
            ) : (
              t("buyNowCta", { amount: instantBuyPrice.toFixed(2) })
            )}
          </button>
        </>
      ) : (
      <>
      {/* Feedback */}
      {error && (
        <p className="mb-2 text-xs font-medium text-ticker-red">{error}</p>
      )}
      {success && (
        <p className="mb-2 text-xs font-medium text-ticker-emer">{success}</p>
      )}

      {/* Label above input (audit T9) */}
      <div className="mb-2.5 text-xs tracking-[0.02em] text-ticker-dim">
        {hasBid ? t("raiseYourOffer") : t("placeAnOffer")}
      </div>

      {/* Controls row — stepper + input + submit, OR cancel + confirm */}
      {confirming ? (
        <div className="flex gap-2">
          <button
            onClick={resetConfirm}
            className="flex h-13 flex-1 items-center justify-center rounded-xl border border-ticker-line text-[15px] font-semibold text-ticker-mid transition-colors hover:bg-ticker-bg-2"
          >
            {t("cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex h-13 flex-1 items-center justify-center rounded-xl bg-ticker-emer text-[15px] font-semibold text-[oklch(0.15_0_0)] transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              t("confirmAmount", {
                amount: parseFloat(amount).toFixed(2),
              })
            )}
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          {/* Decrease */}
          <button
            type="button"
            onClick={() => adjustAmount(-1)}
            disabled={parseFloat(amount) <= minBid}
            className="flex h-13 w-11 shrink-0 items-center justify-center rounded-xl border border-ticker-line text-ticker-mid transition-colors hover:bg-ticker-bg-2 hover:text-ticker-text disabled:opacity-30 md:w-12"
          >
            <Minus className="size-4" />
          </button>

          {/* Input */}
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-[family-name:var(--font-ticker)] text-base font-medium text-ticker-mid">
              €
            </span>
            <input
              type="number"
              step={step}
              min={minBid}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError("");
                resetConfirm();
              }}
              onFocus={() => {
                inputFocusedRef.current = true;
              }}
              onBlur={() => {
                inputFocusedRef.current = false;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              placeholder={minBid.toFixed(2)}
              className="no-spinner h-13 w-full rounded-xl border border-ticker-line bg-ticker-bg-2 pl-8 pr-3 text-center font-[family-name:var(--font-ticker)] text-[22px] font-bold tabular-nums text-ticker-text outline-none focus:border-ticker-emer focus:ring-1 focus:ring-ticker-emer/30"
            />
          </div>

          {/* Increase */}
          <button
            type="button"
            onClick={() => adjustAmount(1)}
            className="flex h-13 w-11 shrink-0 items-center justify-center rounded-xl border border-ticker-line text-ticker-mid transition-colors hover:bg-ticker-bg-2 hover:text-ticker-text md:w-12"
          >
            <Plus className="size-4" />
          </button>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading || !amount}
            className="flex h-13 shrink-0 items-center justify-center rounded-xl bg-ticker-emer px-[22px] text-[15px] font-semibold text-[oklch(0.15_0_0)] transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              t("placeOfferCta")
            )}
          </button>
        </div>
      )}

      {/* Hint below */}
      <div className="mt-2 text-[11.5px] text-ticker-dim">
        {t("minimumOffer", { amount: minBid.toFixed(2) })}
      </div>
      </>
      )}
    </div>
  );
}

// ─── 12. Bid list with Active/All tabs ──────────────────────────────

function TickerExpandedBids({
  data,
  onUserClick,
  t,
}: {
  data: BidListResponse;
  onUserClick: (displayName: string) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const hasInstantBuy = data.bids.some(b => b.status === "InstantBuy");

  // ── Tab state: "active" (default) or "all" (active + denied) ──
  const STORAGE_KEY = "offers-popup.showDenied";
  const [tab, setTabState] = useState<"active" | "all">(() => {
    if (typeof window === "undefined") return "active";
    return window.localStorage.getItem(STORAGE_KEY) === "1" ? "all" : "active";
  });
  const setTab = (next: "active" | "all") => {
    setTabState(next);
    try { window.localStorage.setItem(STORAGE_KEY, next === "all" ? "1" : "0"); } catch {}
  };

  // ── Bid lists ──
  const activeBids = data.bids.filter(b => b.status === "Active");
  const instantBuyBids = data.bids.filter(b => b.status === "InstantBuy");
  const ibDenyReasons = new Set(["instant_buy_declined", "sale_reopened", "auction_ended"]);
  const deniedBids = data.bids.filter(b => b.status === "Denied" && !ibDenyReasons.has(b.denyReason ?? ""));
  const hasDenied = deniedBids.length > 0;

  if (data.totalBids === 0 && !hasDenied && !hasInstantBuy) return null;

  // ── Map individual bids → UniqueBidder shape for BidderCard ──
  const bidToBidder = (bid: BidResponse): UniqueBidder => ({
    bidderId: bid.bidderId,
    bidderName: bid.bidderName,
    bidderAvatarUrl: bid.bidderAvatarUrl,
    bestAmount: bid.amount,
    bidCount: 1,
    lastBidAt: bid.createdAt,
    isTop: bid.status === "Active" && activeBids.indexOf(bid) === 0,
    isDenied: bid.status === "Denied",
    denyReason: bid.denyReason,
    denyDetail: bid.denyDetail,
  });

  // Active tab: only active bids, sorted by amount desc (same as seller)
  const activeBidders = activeBids.map(bidToBidder);
  // All tab: active + denied, sorted by amount desc
  const allBidders = [...activeBids, ...deniedBids]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map(bidToBidder);

  const currentList = tab === "all" ? allBidders : activeBidders;
  const [listExpanded, setListExpanded] = useState(false);
  // Reset expansion when switching tabs
  const prevTab = useRef(tab);
  if (prevTab.current !== tab) { prevTab.current = tab; if (listExpanded) setListExpanded(false); }

  const slicedList = listExpanded ? currentList : currentList.slice(0, INITIAL_LIMIT);
  const hasMoreInList = !listExpanded && currentList.length > INITIAL_LIMIT;

  const noop = () => {};

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {/* Instant buy section — read-only amber card */}
      {instantBuyBids.length > 0 && (
        <div className="flex flex-col gap-1.5 px-4 pt-3 pb-2">
          <div className="flex items-center gap-2.5 px-1 pb-1 pt-1">
            <span className="flex items-center gap-1.5 flex-none font-[family-name:var(--font-ticker)] text-[10px] font-bold uppercase tracking-[0.24em] text-ticker-amber">
              <Zap className="size-[11px]" strokeWidth={2.4} />
              {t("instantBuyDivider")}
            </span>
            <span className="flex-1 h-px bg-[oklch(0.82_0.16_80/0.20)]" />
          </div>
          {instantBuyBids.map((bid) => (
            <button
              key={bid.id}
              onClick={() => onUserClick(bid.bidderName)}
              className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-ticker-amber/30 bg-[oklch(0.82_0.16_80/0.06)] p-[10px_10px_10px_12px] text-left"
            >
              <UserAvatar
                displayName={bid.bidderName}
                avatarUrl={bid.bidderAvatarUrl}
                size="base"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="truncate text-[14px] font-medium text-ticker-text">
                    {bid.bidderName}
                  </span>
                  <span className="inline-flex flex-none items-center gap-[3px] rounded-[3px] bg-ticker-amber/15 px-1.5 py-[2px] font-[family-name:var(--font-ticker)] text-[9.5px] font-bold uppercase tracking-[0.14em] text-ticker-amber">
                    <Zap className="size-[9px]" strokeWidth={2.4} />
                    {t("buyNowPill")}
                  </span>
                  {bid.isOwnBid && (
                    <span className="flex-none rounded-[3px] bg-ticker-emer/15 px-1.5 py-[2px] font-[family-name:var(--font-ticker)] text-[9.5px] font-bold uppercase tracking-[0.14em] text-ticker-emer">
                      {t("you").toLowerCase()}
                    </span>
                  )}
                </div>
                <div className="mt-[2px] text-[11.5px] font-medium text-ticker-amber">
                  {bid.isOwnBid ? t("yourBuyNowAwaitingSeller") : t("awaitingSellerResponse")}
                </div>
              </div>
              <span className="font-[family-name:var(--font-ticker)] text-[17px] font-bold tabular-nums leading-none text-ticker-amber">
                {formatPrice(bid.amount)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── Active / All tabs — only show when there are denied bids ── */}
      {hasDenied && (
        <div className="flex flex-none items-center gap-0 px-3.5 pt-2.5 pb-1">
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
            {t("activeTab", { count: activeBids.length })}
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
            {t("allTab", { count: activeBids.length + deniedBids.length })}
          </button>
        </div>
      )}

      {/* ── Bid list — BidderCard for all entries, matches seller 1:1 ── */}
      {currentList.length > 0 && (
        <div className="space-y-1.5 px-3.5 pb-2.5 pt-1.5">
          <SectionDivider kind="bidders" count={activeBids.length} t={t} />
          {slicedList.map((bidder) => (
            <BidderCard
              key={`${bidder.bidderId}-${bidder.isDenied ? `denied-${bidder.bestAmount}` : "active"}`}
              bidder={bidder}
              isOpen={false}
              sellPending={false}
              confirming={false}
              expandable={false}
              showSell={false}
              isBuyer={false}
              onToggle={noop}
              onDeny={noop}
              onSellTap={noop}
              onSellCancel={noop}
              onSellConfirm={noop}
              onMessage={noop}
              onUserClick={onUserClick}
              t={t}
            />
          ))}
          {hasMoreInList && (
            <button
              onClick={() => setListExpanded(true)}
              className="flex w-full items-center justify-center gap-1.5 py-3 text-[12.5px] text-ticker-mid transition-colors hover:text-ticker-text"
            >
              {t("showMoreBidders", { count: currentList.length - INITIAL_LIMIT })}
              <ChevronDown className="size-3" />
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {currentList.length === 0 && !hasInstantBuy && (
        <div className="flex items-center justify-center py-8">
          <span className="text-[13px] text-ticker-dim">{t("noBidsYet")}</span>
        </div>
      )}
    </div>
  );
}

// ─── Main OffersPopup ────────────────────────────────────────────────

export function OffersPopup({
  itemId,
  itemTitle,
  itemImageUrl,
  onClose,
}: OffersPopupProps) {
  const t = useTranslations("offers");
  const router = useRouter();
  const { isLoggedIn } = useAuth();

  // Clock — ticks for countdown/time displays
  const [now, setNow] = useState(Date.now());

  // Delta badge state
  const prevTopRef = useRef<number | null>(null);
  const [deltaBadge, setDeltaBadge] = useState<number | null>(null);

  const bids = useOffersBids({
    itemId,
    onNewExternalBid: (topBid) => {
      if (prevTopRef.current != null) {
        const delta = topBid.amount - prevTopRef.current;
        if (delta > 0) {
          setDeltaBadge(delta);
          setTimeout(() => setDeltaBadge(null), 1800);
        }
      }
      prevTopRef.current = topBid.amount;
    },
  });

  const derived = useDerivedBidData(bids.data);
  const urgency = getUrgencyState(bids.data, now);
  const auctionEnded = urgency === "sold" || urgency === "ended";
  const isFinal10Min =
    urgency === "final-10m" || urgency === "final-minute";
  const isFinalMinute = urgency === "final-minute";

  // Set prevTopRef on first load
  useEffect(() => {
    if (bids.data?.highestBid != null && prevTopRef.current === null) {
      prevTopRef.current = bids.data.highestBid;
    }
  }, [bids.data?.highestBid]);

  // Clock tick — 1s when <1h, 5s when <10min, 30s otherwise
  useEffect(() => {
    if (!bids.data?.endDate) return;
    const diff = new Date(bids.data.endDate).getTime() - Date.now();
    const interval =
      diff <= 600_000 ? 1_000 : diff <= 3_600_000 ? 5_000 : 30_000;
    const timer = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(timer);
  }, [bids.data?.endDate, urgency]);

  const handleUserClick = (displayName: string) => {
    router.push(`/user/${encodeURIComponent(displayName)}`);
    onClose();
  };


  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        {/* Backdrop */}
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />

        {/* Dialog popup — base-ui provides focus trap, ESC, focus return */}
        <DialogPrimitive.Popup
          className={cn(
            "dark",
            "fixed z-[51] flex flex-col overflow-hidden border border-ticker-line bg-ticker-bg text-ticker-text shadow-2xl outline-none",
            // Mobile: bottom sheet
            "inset-x-0 bottom-0 h-[85vh] rounded-t-2xl",
            // Desktop: centered modal
            "md:inset-auto md:left-1/2 md:top-1/2 md:h-auto md:max-h-[85vh] md:w-[480px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl"
          )}
        >
          {/* Accessible title — sr-only */}
          <DialogPrimitive.Title className="sr-only">
            {itemTitle} — {t("title")}
          </DialogPrimitive.Title>

          {/* Header */}
          <TickerHeader
            itemTitle={itemTitle}
            itemId={itemId}
            manualRefreshing={bids.manualRefreshing}
            connectionLost={bids.connectionLost}
            urgency={urgency}
            subscribed={bids.subscribed}
            isLoggedIn={isLoggedIn}
            onRefresh={bids.manualRefresh}
            onToggleSubscription={bids.toggleSubscription}
            onItemClick={() => {
              router.push(`/items/${itemId}`);
              onClose();
            }}
            onClose={onClose}
            t={t}
          />

          {/* Body — loading / seller / buyer / error */}
          {bids.loading && !bids.data ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-ticker-dim" />
            </div>
          ) : bids.data ? (
            bids.data.isOwner ? (
              /* ── Seller view ── */
              <SellerView
                data={bids.data}
                itemId={itemId}
                now={now}
                urgency={urgency}
                bids={bids}
                onUserClick={handleUserClick}
                onClose={onClose}
                t={t}
              />
            ) : (
              /* ── Buyer view ── */
              <div className="flex min-h-0 flex-1 flex-col">

                {/* Bid form — hidden when auction ended */}
                {!auctionEnded && (
                  <TickerBidForm
                    data={bids.data}
                    derived={derived}
                    itemId={itemId}
                    t={t}
                    onBidPlaced={() => bids.loadBids(bids.currentLimit)}
                    inputFocusedRef={bids.inputFocusedRef}
                    instantBuyPrice={bids.data.instantBuyPrice}
                    pendingInstantBuy={bids.data.pendingInstantBuy}
                  />
                )}

                {/* Show all / expanded list */}
                <TickerExpandedBids
                  data={bids.data}
                  onUserClick={handleUserClick}
                  t={t}
                />
              </div>
            )
          ) : (
            /* Error state */
            <div className="flex flex-1 items-center justify-center">
              <span className="text-xs text-ticker-red">
                {bids.error
                  ? t(`error_${bids.error}`)
                  : t("error_bids_fetch_failed")}
              </span>
            </div>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// Re-export for backward compat
export { INITIAL_LIMIT };
