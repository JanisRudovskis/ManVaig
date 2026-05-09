"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { Globe, Users, Link as LinkIcon, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "stall" | "item";

interface VisibilityRadioCardsProps {
  value: number;
  onChange: (value: number) => void;
  mode: Mode;
  name?: string;
  disabled?: boolean;
  labelledBy?: string;
  className?: string;
}

const OPTIONS = [
  { value: 0, key: "public", Icon: Globe },
  { value: 1, key: "registeredOnly", Icon: Users },
  { value: 2, key: "linkOnly", Icon: LinkIcon },
  { value: 3, key: "private", Icon: Lock },
] as const;

export function VisibilityRadioCards({
  value,
  onChange,
  mode,
  name,
  disabled,
  labelledBy,
  className,
}: VisibilityRadioCardsProps) {
  const t = useTranslations("visibility");
  const helperKey = mode === "stall" ? "helperStall" : "helperItem";
  const groupRef = useRef<HTMLDivElement>(null);

  const focusOptionAt = (idx: number) => {
    const el = groupRef.current?.querySelectorAll<HTMLButtonElement>(
      "[role='radio']"
    )[idx];
    el?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const currentIdx = OPTIONS.findIndex((o) => o.value === value);
    let nextIdx = currentIdx;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      nextIdx = (currentIdx + 1) % OPTIONS.length;
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      nextIdx = (currentIdx - 1 + OPTIONS.length) % OPTIONS.length;
    } else if (e.key === "Home") {
      nextIdx = 0;
    } else if (e.key === "End") {
      nextIdx = OPTIONS.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    onChange(OPTIONS[nextIdx].value);
    focusOptionAt(nextIdx);
  };

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-disabled={disabled || undefined}
      onKeyDown={handleKeyDown}
      className={cn("flex flex-col gap-2", className)}
    >
      {OPTIONS.map(({ value: optValue, key, Icon }) => {
        const checked = value === optValue;
        return (
          <button
            key={optValue}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            disabled={disabled}
            data-name={name}
            onClick={() => onChange(optValue)}
            className={cn(
              "flex min-h-[64px] w-full items-start gap-3 rounded-lg border bg-card px-3 py-3 text-left transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              "disabled:cursor-not-allowed disabled:opacity-60",
              checked
                ? "border-primary bg-primary/5"
                : "border-border hover:border-foreground/30"
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md",
                checked
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              )}
              aria-hidden="true"
            >
              <Icon className="size-4" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-medium text-foreground">
                {t(`${key}.label`)}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {t(`${key}.${helperKey}`)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
