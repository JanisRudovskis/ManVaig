"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2 } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { acceptInstantBuy, declineInstantBuy } from "@/lib/items";
import type { BidListResponse } from "@/lib/items";

interface Props {
  itemId: string;
  pending: NonNullable<BidListResponse["pendingInstantBuy"]>;
  onResolved: () => void;
  onUserClick: (displayName: string) => void;
}

export function SellerInstantBuyCard({ itemId, pending, onResolved, onUserClick }: Props) {
  const t = useTranslations("offers");
  const [action, setAction] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState("");

  const handle = async (kind: "accept" | "decline") => {
    setAction(kind);
    setError("");
    try {
      if (kind === "accept") await acceptInstantBuy(itemId);
      else await declineInstantBuy(itemId);
      onResolved();
    } catch (err) {
      const code = err instanceof Error ? err.message : "instant_buy_failed";
      setError(t(`error_${code}` as Parameters<typeof t>[0]));
      setAction(null);
    }
  };

  return (
    <div className="mx-4 mb-3.5 flex-none rounded-[14px] border border-ticker-emer/[0.35] bg-gradient-to-b from-ticker-emer/[0.10] to-ticker-emer/[0.04] p-[14px]">
      <div className="mb-3 font-[family-name:var(--font-ticker)] text-[11px] font-semibold uppercase tracking-[0.18em] text-ticker-emer">
        {t("instantBuyOfferKicker")}
      </div>
      <div className="mb-3.5 flex items-center gap-3">
        <button type="button" onClick={() => onUserClick(pending.buyerDisplayName)} className="cursor-pointer">
          <UserAvatar
            displayName={pending.buyerDisplayName}
            avatarUrl={pending.buyerAvatarUrl}
            size="lg"
          />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-sm leading-snug text-ticker-mid">
            <button
              type="button"
              onClick={() => onUserClick(pending.buyerDisplayName)}
              className="cursor-pointer font-semibold text-ticker-text hover:underline"
            >
              {pending.buyerDisplayName}
            </button>{" "}
            {t("wantsToBuyFor")}
          </div>
          <div className="mt-0.5 font-[family-name:var(--font-ticker)] text-[26px] font-bold leading-tight tabular-nums tracking-[-0.015em] text-ticker-text">
            &euro;{pending.amount.toFixed(2)}
          </div>
        </div>
      </div>
      {error && (
        <p className="mb-2 text-xs font-medium text-ticker-red">{error}</p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handle("accept")}
          disabled={action !== null}
          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-ticker-emer text-[14.5px] font-semibold text-[oklch(0.15_0_0)] transition-colors hover:opacity-90 disabled:opacity-50"
          style={{
            boxShadow: "0 4px 14px oklch(0.78 0.18 165 / 0.30)",
          }}
        >
          {action === "accept" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <Check className="size-4" />
              {t("acceptSale")}
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => handle("decline")}
          disabled={action !== null}
          className="flex h-11 flex-1 items-center justify-center rounded-[10px] border border-ticker-line/60 bg-transparent text-[14.5px] font-medium text-ticker-mid transition-colors hover:bg-ticker-bg-2 disabled:opacity-50"
        >
          {action === "decline" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            t("declineSale")
          )}
        </button>
      </div>
    </div>
  );
}
