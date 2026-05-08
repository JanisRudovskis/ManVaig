"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Mail,
  CheckCircle,
  AlertCircle,
  ArrowRightLeft,
  Loader2,
  Clock,
} from "lucide-react";
import {
  ChangeEmailDialog,
  useResendConfirmation,
} from "@/components/change-email-dialog";

interface EmailManagementProps {
  email: string;
  emailConfirmed: boolean;
  editing: boolean;
}

export function EmailManagement({
  email,
  emailConfirmed,
  editing,
}: EmailManagementProps) {
  const t = useTranslations("emailManagement");

  // Local state — updates immediately on email change without waiting for profile reload
  const [currentEmail, setCurrentEmail] = useState(email);
  const [currentConfirmed, setCurrentConfirmed] = useState(emailConfirmed);

  useEffect(() => {
    setCurrentEmail(email);
    setCurrentConfirmed(emailConfirmed);
  }, [email, emailConfirmed]);

  const [dialogOpen, setDialogOpen] = useState(false);

  // Cooldown timer (lifted here so it persists across dialog open/close)
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldown = useCallback((seconds: number) => {
    setCooldown(seconds);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
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

  const { resending, error: resendError, success: resendSuccess, resend, clearMessages } =
    useResendConfirmation(startCooldown);

  // Clear messages when leaving edit mode
  useEffect(() => {
    if (!editing) clearMessages();
  }, [editing, clearMessages]);

  function handleEmailChanged(newEmail: string, confirmed: boolean) {
    setCurrentEmail(newEmail);
    setCurrentConfirmed(confirmed);
  }

  return (
    <div className="space-y-2">
      {/* Email display row — wraps on narrow widths so email isn't truncated */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 min-w-0">
          <Mail className="size-4 flex-shrink-0" />
          <span className="truncate">{currentEmail}</span>
        </div>
        {currentConfirmed ? (
          <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300 text-xs whitespace-nowrap">
            <CheckCircle className="size-3.5" />
            {t("verified")}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300 text-xs whitespace-nowrap">
            <AlertCircle className="size-3.5" />
            {t("notVerified")}
          </span>
        )}
        {editing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDialogOpen(true)}
            className="h-8 text-xs px-2 ml-auto flex-shrink-0"
          >
            <ArrowRightLeft className="size-3 mr-1" />
            {t("changeEmail")}
          </Button>
        )}
      </div>

      {/* Resend verification — only in edit mode, only when unverified */}
      {editing && !currentConfirmed && (
        <div className="flex items-center gap-2 ml-6">
          <Button
            variant="outline"
            size="sm"
            onClick={resend}
            disabled={resending || cooldown > 0}
            className="h-7 text-xs"
          >
            {resending && <Loader2 className="size-3 mr-1 animate-spin" />}
            {cooldown > 0 ? (
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {t("resendIn", { time: formatCooldown(cooldown) })}
              </span>
            ) : (
              t("resendVerification")
            )}
          </Button>
        </div>
      )}

      {resendSuccess && (
        <p className="ml-6 text-xs text-emerald-700 dark:text-emerald-300">{resendSuccess}</p>
      )}
      {resendError && (
        <p className="ml-6 text-xs text-destructive">{resendError}</p>
      )}

      <ChangeEmailDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        cooldown={cooldown}
        onCooldownStart={startCooldown}
        onChanged={handleEmailChanged}
        formatCooldown={formatCooldown}
      />
    </div>
  );
}
