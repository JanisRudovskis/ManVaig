"use client";

import { useTranslations } from "next-intl";
import { Lightbulb, X } from "lucide-react";

interface TipsBannerProps {
  tab: "details" | "pricing" | "terms";
  onDismiss: () => void;
}

export function TipsBanner({ tab, onDismiss }: TipsBannerProps) {
  const t = useTranslations("tips");

  const tips: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const key = `${tab}.tip${i}`;
    if (!t.has(key)) break;
    tips.push(t(key));
  }

  if (tips.length === 0) return null;

  return (
    <div className="mb-6 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-amber-300">
          <Lightbulb className="size-4" />
          {t(`${tab}.title`)}
        </div>
        <button
          onClick={onDismiss}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label={t("dismiss")}
        >
          <X className="size-3.5" />
        </button>
      </div>
      <ul className="space-y-1.5 text-xs text-muted-foreground">
        {tips.map((tip, idx) => (
          <li key={idx} className="flex items-start gap-2">
            <span className="mt-0.5 text-amber-400">&#x2022;</span>
            {tip}
          </li>
        ))}
      </ul>
    </div>
  );
}
