"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword } from "@/lib/auth";
import { PasswordChecklist } from "@/components/password-checklist";

export default function ResetPasswordPage() {
  const t = useTranslations("resetPassword");
  const searchParams = useSearchParams();

  const userId = searchParams.get("userId");
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"form" | "success" | "error">(
    userId && token ? "form" : "error"
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError(t("errorPasswordLength"));
      return;
    }

    if (!/[A-Z]/.test(password)) {
      setError(t("errorPasswordUppercase"));
      return;
    }

    if (!/\d/.test(password)) {
      setError(t("errorPasswordDigit"));
      return;
    }

    if (password !== confirmPw) {
      setError(t("errorPasswordMismatch"));
      return;
    }

    setLoading(true);

    try {
      await resetPassword(userId!, token!, password);
      setStatus("success");
    } catch (err) {
      if (err instanceof Error) {
        // Check for common backend errors
        if (err.message.includes("Invalid") || err.message.includes("expired")) {
          setStatus("error");
        } else {
          setError(err.message);
        }
      } else {
        setError(t("errorGeneric"));
      }
    } finally {
      setLoading(false);
    }
  }

  // Invalid/expired link
  if (status === "error") {
    return (
      <div className="flex min-h-[calc(100vh-2rem)] items-center justify-center">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-destructive/10">
            <XCircle className="size-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">{t("errorTitle")}</h1>
            <p className="text-muted-foreground">{t("errorDescription")}</p>
          </div>
          <Link href="/forgot-password">
            <Button variant="outline">{t("tryAgain")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Success
  if (status === "success") {
    return (
      <div className="flex min-h-[calc(100vh-2rem)] items-center justify-center">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircle2 className="size-8 text-green-600 dark:text-green-400" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">{t("successTitle")}</h1>
            <p className="text-muted-foreground">{t("successDescription")}</p>
          </div>
          <Link href="/login">
            <Button>{t("goToLogin")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Form
  return (
    <div className="flex min-h-[calc(100vh-2rem)] items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reset-password">{t("newPassword")}</Label>
            <Input
              id="reset-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              autoFocus
            />
            <PasswordChecklist password={password} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reset-confirm">{t("confirmPassword")}</Label>
            <Input
              id="reset-confirm"
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "..." : t("submit")}
          </Button>
        </form>
      </div>
    </div>
  );
}
