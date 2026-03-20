"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmEmail } from "@/lib/auth";

export default function ConfirmEmailPage() {
  const t = useTranslations("emailConfirmation");
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    const userId = searchParams.get("userId");
    const token = searchParams.get("token");

    if (!userId || !token) {
      setStatus("error");
      return;
    }

    confirmEmail(userId, token)
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"));
  }, [searchParams]);

  return (
    <div className="flex min-h-[calc(100vh-2rem)] items-center justify-center">
      <div className="w-full max-w-md space-y-6 text-center">
        {status === "loading" && (
          <>
            <Loader2 className="mx-auto size-12 animate-spin text-primary" />
            <p className="text-muted-foreground">{t("confirming")}</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="size-8 text-green-600 dark:text-green-400" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">{t("confirmed")}</h1>
              <p className="text-muted-foreground">{t("confirmedDescription")}</p>
            </div>
            <Link href="/login">
              <Button>{t("goToLogin")}</Button>
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="size-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">{t("errorTitle")}</h1>
              <p className="text-muted-foreground">{t("errorDescription")}</p>
            </div>
            <Link href="/">
              <Button variant="outline">{t("goHome")}</Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
