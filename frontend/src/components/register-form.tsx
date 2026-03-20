"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { register, saveToken, type AuthResponse } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";
import { EmailConfirmationPrompt } from "@/components/email-confirmation-prompt";

interface RegisterFormContentProps {
  onSuccess?: (data: AuthResponse) => void;
}

export function RegisterFormContent({ onSuccess }: RegisterFormContentProps) {
  const t = useTranslations("register");
  const { setUser } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validate(): string | null {
    if (displayName.trim().length < 3) return t("errorDisplayNameLength");
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return t("errorEmailFormat");
    if (password.length < 8) return t("errorPasswordLength");
    if (!/[0-9]/.test(password)) return t("errorPasswordDigit");
    if (!/[A-Z]/.test(password)) return t("errorPasswordUppercase");
    if (password !== confirmPassword) return t("errorPasswordMismatch");
    if (!termsAccepted) return t("errorTermsRequired");
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const res = await register(email, password, displayName.trim());
      saveToken(res.token);
      setUser(res);
      onSuccess?.(res);
    } catch (err) {
      if (err instanceof Error) {
        const msg = err.message.toLowerCase();
        if (msg.includes("duplicate") || msg.includes("already taken")) {
          setError(t("errorDuplicateEmail"));
        } else if (msg.includes("digit")) {
          setError(t("errorPasswordDigit"));
        } else if (msg.includes("uppercase")) {
          setError(t("errorPasswordUppercase"));
        } else {
          setError(t("errorGeneric"));
        }
      } else {
        setError(t("errorGeneric"));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <h1 className="text-center text-2xl font-bold">{t("title")}</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="register-displayname" className="flex items-center gap-1 text-sm font-medium leading-none">
            {t("displayName")}
            <span className="text-destructive">{t("required")}</span>
          </label>
          <Input
            id="register-displayname"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="register-email" className="flex items-center gap-1 text-sm font-medium leading-none">
            {t("email")}
            <span className="text-destructive">{t("required")}</span>
          </label>
          <Input
            id="register-email"
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="register-password" className="flex items-center gap-1 text-sm font-medium leading-none">
            {t("password")}
            <span className="text-destructive">{t("required")}</span>
          </label>
          <Input
            id="register-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="register-confirm" className="flex items-center gap-1 text-sm font-medium leading-none">
            {t("confirmPassword")}
            <span className="text-destructive">{t("required")}</span>
          </label>
          <Input
            id="register-confirm"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>

        <div className="flex items-start gap-2">
          <input
            id="register-terms"
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-1 size-4 rounded border-border accent-primary"
          />
          <span className="text-sm text-muted-foreground">
            {t.rich("termsCheckbox", {
              terms: (chunks) => (
                <Link href="#" className="text-primary underline-offset-4 hover:underline">
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link href="#" className="text-primary underline-offset-4 hover:underline">
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? "..." : t("submit")}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            {t("orContinueWith")}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <Button variant="outline" className="w-full" size="lg" disabled>
          <svg className="mr-2 size-4" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          {t("google")}
          <span className="ml-auto text-xs text-muted-foreground">({t("comingSoon")})</span>
        </Button>

        <Button variant="outline" className="w-full" size="lg" disabled>
          <svg className="mr-2 size-4" viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          {t("facebook")}
          <span className="ml-auto text-xs text-muted-foreground">({t("comingSoon")})</span>
        </Button>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        {t("hasAccount")}{" "}
        <Link href="/login" className="text-primary underline-offset-4 hover:underline">
          {t("login")}
        </Link>
      </p>
    </div>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [registered, setRegistered] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  if (registered) {
    return <EmailConfirmationPrompt email={registeredEmail} variant="page" />;
  }

  return (
    <div className="flex min-h-[calc(100vh-2rem)] items-center justify-center">
      <RegisterFormContent
        onSuccess={(data) => {
          setRegisteredEmail(data.email);
          setRegistered(true);
        }}
      />
    </div>
  );
}
