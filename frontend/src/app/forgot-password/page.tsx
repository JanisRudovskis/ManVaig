"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPassword } from "@/lib/auth";

export default function ForgotPasswordPage() {
  const t = useTranslations("forgotPassword");
  const locale = useLocale();

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError(t("errorEmailRequired"));
      return;
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError(t("errorEmailFormat"));
      return;
    }

    setLoading(true);

    try {
      await forgotPassword(trimmed, locale);
      setSent(true);
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setLoading(false);
    }
  }

  // Success state — "check your email"
  if (sent) {
    return (
      <div className="flex min-h-[calc(100vh-2rem)] items-center justify-center">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10">
            <Mail className="size-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">{t("sentTitle")}</h1>
            <p className="text-sm text-muted-foreground">{t("sentDescription")}</p>
          </div>
          <p className="text-xs text-muted-foreground">{t("checkSpam")}</p>
          <Link href="/login">
            <Button variant="outline" className="mt-2">
              <ArrowLeft className="mr-2 size-4" />
              {t("backToLogin")}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Form state
  return (
    <div className="flex min-h-[calc(100vh-2rem)] items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="forgot-email">{t("email")}</Label>
            <Input
              id="forgot-email"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("emailPlaceholder")}
              autoComplete="email"
              autoFocus
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "..." : t("submit")}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="text-primary underline-offset-4 hover:underline">
            <ArrowLeft className="mr-1 inline size-3" />
            {t("backToLogin")}
          </Link>
        </p>
      </div>
    </div>
  );
}
