"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Loader2, Clock, X } from "lucide-react";

interface ChangeEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cooldown: number;
  onCooldownStart: (seconds: number) => void;
  onChanged: (newEmail: string, emailConfirmed: boolean) => void;
  formatCooldown: (seconds: number) => string;
}

export function ChangeEmailDialog({
  open,
  onOpenChange,
  cooldown,
  onCooldownStart,
  onChanged,
  formatCooldown,
}: ChangeEmailDialogProps) {
  const t = useTranslations("emailManagement");
  const locale = useLocale();
  const { setUser } = useAuth();

  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setNewEmail("");
      setPassword("");
      setError("");
    }
  }, [open]);

  function validateEmail(val: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  }

  async function handleSubmit() {
    setError("");
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
      saveToken(authResponse.token);
      setUser(authResponse);
      onChanged(authResponse.email, authResponse.emailConfirmed);
      onCooldownStart(120);
      onOpenChange(false);
    } catch (err: unknown) {
      const e = err as Error & { retryAfter?: number };
      if (e.message === "RATE_LIMITED" && e.retryAfter) {
        onCooldownStart(e.retryAfter);
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

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("changeEmail")}</DialogTitle>
          <DialogDescription>{t("changeEmailDescription")}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!saving && cooldown === 0) handleSubmit();
          }}
          className="contents"
        >
          <div className="space-y-3">
            <div>
              <Label htmlFor="change-email-new" className="text-xs font-medium">
                {t("newEmailLabel")}
              </Label>
              <Input
                id="change-email-new"
                type="text"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder={t("newEmailPlaceholder")}
                className="mt-1"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="change-email-password" className="text-xs font-medium">
                {t("passwordLabel")}
              </Label>
              <Input
                id="change-email-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("passwordPlaceholder")}
                className="mt-1"
              />
            </div>
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              <X className="size-3.5 mr-1" />
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving || cooldown > 0}
            >
              {saving && <Loader2 className="size-3.5 mr-1 animate-spin" />}
              {cooldown > 0 ? (
                <span className="flex items-center gap-1">
                  <Clock className="size-3" />
                  {t("resendIn", { time: formatCooldown(cooldown) })}
                </span>
              ) : (
                t("sendVerification")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function useResendConfirmation(
  onCooldownStart: (seconds: number) => void
) {
  const t = useTranslations("emailManagement");
  const locale = useLocale();
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function resend() {
    setError("");
    setSuccess("");
    setResending(true);
    try {
      await resendConfirmationWithRateLimit(locale);
      setSuccess(t("resendSuccess"));
      onCooldownStart(120);
    } catch (err: unknown) {
      const e = err as Error & { retryAfter?: number };
      if (e.message === "RATE_LIMITED" && e.retryAfter) {
        onCooldownStart(e.retryAfter);
        setError(t("errorRateLimited"));
      } else {
        setError(t("errorResendFailed"));
      }
    } finally {
      setResending(false);
    }
  }

  return { resending, error, success, resend, clearMessages: () => { setError(""); setSuccess(""); } };
}
