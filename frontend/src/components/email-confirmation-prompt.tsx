"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Mail, CheckCircle2, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resendConfirmationWithRateLimit } from "@/lib/auth";

interface EmailConfirmationPromptProps {
  email?: string;
  variant?: "page" | "inline";
}

const COOLDOWN_SECONDS = 120;

export function EmailConfirmationPrompt({
  email,
  variant = "page",
}: EmailConfirmationPromptProps) {
  const t = useTranslations("emailConfirmation");
  const locale = useLocale();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldown = useCallback((seconds: number) => {
    setCooldown(seconds);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function formatCooldown(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  async function handleResend() {
    setResending(true);
    setError(null);
    setResent(false);
    try {
      await resendConfirmationWithRateLimit(locale);
      setResent(true);
      startCooldown(COOLDOWN_SECONDS);
    } catch (err: unknown) {
      const e = err as Error & { retryAfter?: number };
      if (e.message === "RATE_LIMITED" && e.retryAfter) {
        startCooldown(e.retryAfter);
        setError(t("rateLimited"));
      } else {
        setError(t("resendError"));
      }
    } finally {
      setResending(false);
    }
  }

  if (variant === "inline") {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-2">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              {t("inlineTitle")}
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {t("inlineDescription")}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResend}
              disabled={resending || cooldown > 0}
            >
              {resending && <Loader2 className="mr-2 size-3 animate-spin" />}
              {cooldown > 0 ? (
                <span className="flex items-center gap-1">
                  <Clock className="size-3" />
                  {t("resendIn", { time: formatCooldown(cooldown) })}
                </span>
              ) : resent ? (
                t("resent")
              ) : (
                t("resend")
              )}
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-2rem)] items-center justify-center">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10">
          <Mail className="size-8 text-primary" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">
            {email
              ? t("descriptionWithEmail", { email })
              : t("description")}
          </p>
        </div>

        <div className="space-y-3">
          {cooldown > 0 ? (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Clock className="size-4" />
              {t("resendIn", { time: formatCooldown(cooldown) })}
            </div>
          ) : resent ? (
            <div className="flex items-center justify-center gap-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 className="size-4" />
              {t("resent")}
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={handleResend}
              disabled={resending}
            >
              {resending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t("resend")}
            </Button>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <p className="text-xs text-muted-foreground">{t("checkSpam")}</p>
      </div>
    </div>
  );
}
