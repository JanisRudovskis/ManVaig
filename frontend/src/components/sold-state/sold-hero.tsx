"use client";

import { useTranslations } from "next-intl";

interface SoldHeroProps {
  amount: number;
  winnerDisplayName: string;
  onUserClick: (displayName: string) => void;
}

export function SoldHero({ amount, winnerDisplayName, onUserClick }: SoldHeroProps) {
  const t = useTranslations("offers");
  const [whole, frac] = amount.toFixed(2).split(".");

  return (
    <div className="relative flex-none overflow-hidden px-6 pb-[18px] pt-6 text-center">
      {/* Stamp — anchored top-right, grows leftward */}
      <div
        className="pointer-events-none absolute right-3.5 top-3.5 whitespace-nowrap rounded-[2px] border-2 border-ticker-emer bg-ticker-emer/[0.13] px-3.5 py-1 font-[family-name:var(--font-ticker)] text-[14px] font-extrabold uppercase tracking-[0.22em] text-ticker-emer"
        style={{
          transformOrigin: "top right",
          transform: "rotate(8deg)",
          boxShadow: "0 6px 18px oklch(0.78 0.18 165 / 0.25)",
        }}
      >
        {t("soldStamp")}
      </div>

      <div className="mt-0.5 font-[family-name:var(--font-ticker)] text-[56px] font-bold leading-[0.95] tracking-[-0.025em] tabular-nums text-ticker-emer">
        <span className="mr-px align-[16px] text-[30px] font-medium">&euro;</span>
        {whole}
        <span className="text-[30px] font-medium opacity-70">.{frac}</span>
      </div>

      <div className="mt-2 text-[13px] text-ticker-mid">
        {t("soldToPrefix")}{" "}
        <button
          type="button"
          onClick={() => onUserClick(winnerDisplayName)}
          className="cursor-pointer font-semibold text-ticker-text hover:underline"
        >
          @{winnerDisplayName}
        </button>
      </div>
    </div>
  );
}
