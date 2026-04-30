"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  changeEmail,
  resendConfirmationWithRateLimit,
  saveToken,
  type AuthResponse,
} from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import {
  Mail,
  CheckCircle,
  AlertCircle,
  ArrowRightLeft,
  X,
  Loader2,
  Clock,
} from "lucide-react";

interface EmailManagementProps {
  email: string;
  emailConfirmed: boolean;
  editing: boolean;
}

const COOLDOWN_SECONDS = 120;

export function EmailManagement({
  email,
  emailConfirmed,
  editing,
}: EmailManagementProps) {
  const t = useTranslations("emailManagement");
  const locale = useLocale();
  const { setUser } = useAuth();

  // Local state that updates immediately after email change
  // (props won't refresh until profile is re-fetched from API)
  const [currentEmail, setCurrentEmail] = useState(email);
  const [currentConfirmed, setCurrentConfirmed] = useState(emailConfirmed);

  // Sync with props when they change externally (e.g. profile reload)
  useEffect(() => {
    setCurrentEmail(email);
    setCurrentConfirmed(emailConfirmed);
  }, [email, emailConfirmed]);

  // UI state
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Cooldown timer
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

  // Close change form when leaving edit mode
  useEffect(() => {
    if (!editing) {
      setShowChangeForm(false);
      setError("");
      setSuccess("");
    }
  }, [editing]);

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

  function openChangeForm() {
    setNewEmail("");
    setPassword("");
    setError("");
    setSuccess("");
    setShowChangeForm(true);
  }

  function closeChangeForm() {
    setShowChangeForm(false);
    setError("");
  }

  function validateEmail(val: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  }

  async function handleChangeEmail() {
    setError("");
    setSuccess("");

    const trimmed = newEmail.trim();
    if (!trimmed) {
      setError(t("errorEmailRequired"));
      return;
    }
    if (!validateEmail(trimmed)) {
      setError(t("errorEmailInvalid"));
      return;
    }
    if (!password) {
      setError(t("errorPasswordRequired"));
      return;
    }

    setSaving(true);
    try {
      const authResponse: AuthResponse = await changeEmail(
        trimmed,
        password,
        locale
      );
      // Update token + context with new email
      saveToken(authResponse.token);
      setUser(authResponse);
      // Update local display immediately
      setCurrentEmail(authResponse.email);
      setCurrentConfirmed(authResponse.emailConfirmed);
      setShowChangeForm(false);
      setSuccess(t("changeSuccess"));
      startCooldown(COOLDOWN_SECONDS);
    } catch (err: unknown) {
      const e = err as Error & { retryAfter?: number };
      if (e.message === "RATE_LIMITED" && e.retryAfter) {
        startCooldown(e.retryAfter);
        setError(t("errorRateLimited"));
      } else if (e.message === "INVALID_PASSWORD") {
        setError(t("errorInvalidPassword"));
      } else if (e.message === "EMAIL_TAKEN") {
        setError(t("errorEmailTaken"));
      } else if (e.message === "SAME_EMAIL") {
        setError(t("errorSameEmail"));
      } else {
        setError(t("errorGeneric"));
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleResend() {
    setError("");
    setSuccess("");
    setResending(true);
    try {
      await resendConfirmationWithRateLimit(locale);
      setSuccess(t("resendSuccess"));
      startCooldown(COOLDOWN_SECONDS);
    } catch (err: unknown) {
      const e = err as Error & { retryAfter?: number };
      if (e.message === "RATE_LIMITED" && e.retryAfter) {
        startCooldown(e.retryAfter);
        setError(t("errorRateLimited"));
      } else {
        setError(t("errorResendFailed"));
      }
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="space-y-2">
      {/* Email display row — change button inline on the right */}
      <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
        <Mail className="size-4 flex-shrink-0" />
        <span>{currentEmail}</span>
        {currentConfirmed ? (
          <span className="flex items-center gap-1 text-emerald-500 text-xs whitespace-nowrap">
            <CheckCircle className="size-3.5" />
            {t("verified")}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-amber-500 text-xs whitespace-nowrap">
            <AlertCircle className="size-3.5" />
            {t("notVerified")}
          </span>
        )}
        {/* Change email button — inline, only in edit mode */}
        {editing && !showChangeForm && (
          <Button
            variant="ghost"
            size="sm"
            onClick={openChangeForm}
            className="h-6 text-xs px-2 ml-auto"
          >
            <ArrowRightLeft className="size-3 mr-1" />
            {t("changeEmail")}
          </Button>
        )}
      </div>

      {/* Resend verification — only in edit mode, only when unverified */}
      {editing && !currentConfirmed && !showChangeForm && (
        <div className="flex items-center gap-2 ml-6">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResend}
            disabled={resending || cooldown > 0}
            className="h-7 text-xs"
          >
            {resending && (
              <Loader2 className="size-3 mr-1 animate-spin" />
            )}
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

      {/* Change email form — only in edit mode */}
      {editing && showChangeForm && (
        <div className="ml-6 mt-2 space-y-3 rounded-lg border border-border bg-muted/30 p-3">
          <div className="space-y-2">
            <div>
              <Label className="text-xs font-medium">
                {t("newEmailLabel")}
              </Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder={t("newEmailPlaceholder")}
                className="h-8 text-sm mt-1"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-xs font-medium">
                {t("passwordLabel")}
              </Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("passwordPlaceholder")}
                className="h-8 text-sm mt-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !saving) handleChangeEmail();
                }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleChangeEmail}
              disabled={saving || cooldown > 0}
              className="h-7 text-xs"
            >
              {saving && (
                <Loader2 className="size-3 mr-1 animate-spin" />
              )}
              {cooldown > 0 ? (
                <span className="flex items-center gap-1">
                  <Clock className="size-3" />
                  {t("resendIn", { time: formatCooldown(cooldown) })}
                </span>
              ) : (
                t("sendVerification")
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={closeChangeForm}
              disabled={saving}
              className="h-7 text-xs"
            >
              <X className="size-3 mr-1" />
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}

      {/* Success message */}
      {success && (
        <p className="ml-6 text-xs text-emerald-500">{success}</p>
      )}

      {/* Error message */}
      {error && (
        <p className="ml-6 text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
