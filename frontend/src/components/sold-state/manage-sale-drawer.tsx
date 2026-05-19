"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, Loader2, XCircle } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { formatPrice } from "@/components/item-card-shared";
import type { UniqueBidder } from "@/lib/items";

interface ManageSaleDrawerProps {
  onPassTo: (bidder: UniqueBidder) => Promise<void>;
  onClose: () => void;
  onCloseAuction: () => Promise<void>;
  nextBidder: UniqueBidder | null;
}

export function ManageSaleDrawer({
  onPassTo,
  onClose,
  onCloseAuction,
  nextBidder,
}: ManageSaleDrawerProps) {
  const t = useTranslations("offers");
  const [passLoading, setPassLoading] = useState(false);
  const [closeLoading, setCloseLoading] = useState(false);

  const handlePass = async () => {
    if (!nextBidder) return;
    setPassLoading(true);
    try { await onPassTo(nextBidder); }
    finally { setPassLoading(false); }
  };
  const handleCloseAuction = async () => {
    setCloseLoading(true);
    try { await onCloseAuction(); }
    finally { setCloseLoading(false); }
  };

  return (
    <div className="flex flex-none flex-col gap-2.5 border-t border-ticker-line bg-ticker-bg-2 px-4 pb-4 pt-3.5">
      <div className="flex items-baseline justify-between">
        <span className="font-[family-name:var(--font-ticker)] text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ticker-dim">
          {t("manageSaleHeader")}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="bg-transparent text-[11.5px] text-ticker-dim hover:text-ticker-mid"
        >
          {t("manageSaleClose")}
        </button>
      </div>
      <p className="m-0 text-[12px] leading-[1.5] text-ticker-dim">
        {t("manageSaleIntro")}
      </p>

      {/* Pass to next bidder — only when runners-up exist */}
      {nextBidder && (
        <div className="rounded-[10px] border border-ticker-line bg-transparent p-[11px_13px]">
          <div className="mb-2 flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-[12.5px] font-medium text-ticker-text">
                {t("passToNextTitle")}
              </div>
              <div className="mt-[2px] truncate text-[11px] text-ticker-dim">
                @{nextBidder.bidderName} &middot; {formatPrice(nextBidder.bestAmount)}
              </div>
            </div>
            <UserAvatar
              displayName={nextBidder.bidderName}
              avatarUrl={nextBidder.bidderAvatarUrl}
              size="xs"
            />
          </div>
          <button
            type="button"
            onClick={handlePass}
            disabled={passLoading}
            className="flex h-8 w-full items-center justify-center gap-1 rounded-[7px] border border-ticker-line bg-transparent text-[11.5px] font-medium text-ticker-mid hover:bg-ticker-bg-2 disabled:opacity-50"
          >
            {passLoading ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <>
                {t("passToNextCta", { name: nextBidder.bidderName })}
                <ArrowRight className="size-3" />
              </>
            )}
          </button>
        </div>
      )}

      {/* Close auction — always available */}
      <div className="rounded-[10px] border border-ticker-red/20 bg-transparent p-[11px_13px]">
        <div className="mb-2">
          <div className="text-[12.5px] font-medium text-ticker-text">
            {t("closeAuctionTitle")}
          </div>
          <div className="mt-[2px] text-[11px] text-ticker-dim">
            {t("closeAuctionDesc")}
          </div>
        </div>
        <button
          type="button"
          onClick={handleCloseAuction}
          disabled={closeLoading}
          className="flex h-8 w-full items-center justify-center gap-1 rounded-[7px] border border-ticker-red/30 bg-transparent text-[11.5px] font-medium text-ticker-red hover:bg-ticker-red/10 disabled:opacity-50"
        >
          {closeLoading ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <>
              <XCircle className="size-3" />
              {t("closeAuctionCta")}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
