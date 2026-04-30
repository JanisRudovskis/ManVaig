"use client";

import { useState, useEffect, useRef } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { checkDisplayName } from "@/lib/auth";

interface UsernameChecklistProps {
  username: string;
}

const FORMAT_REGEX = /^[a-zA-Z0-9_-]+$/;
const DEBOUNCE_MS = 500;

export function UsernameChecklist({ username }: UsernameChecklistProps) {
  const t = useTranslations("usernameChecklist");
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lengthOk = username.length >= 3 && username.length <= 30;
  const formatOk = username.length > 0 && FORMAT_REGEX.test(username);
  const allLocalOk = lengthOk && formatOk;

  // Debounced availability check
  useEffect(() => {
    setAvailable(null);

    if (!allLocalOk) {
      setChecking(false);
      return;
    }

    setChecking(true);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const result = await checkDisplayName(username);
        setAvailable(result.available);
      } catch {
        setAvailable(null);
      } finally {
        setChecking(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [username, allLocalOk]);

  // Don't show anything until the user starts typing
  if (!username) return null;

  return (
    <ul className="space-y-1">
      <RuleRow passed={lengthOk} label={t("length")} />
      <RuleRow passed={formatOk} label={t("format")} />
      {allLocalOk && (
        <li className="flex items-center gap-1.5 text-xs">
          {checking ? (
            <Loader2 className="size-3 animate-spin text-muted-foreground" />
          ) : available ? (
            <Check className="size-3 text-green-600 dark:text-green-400" />
          ) : (
            <X className="size-3 text-destructive" />
          )}
          <span
            className={
              checking
                ? "text-muted-foreground"
                : available
                  ? "text-green-600 dark:text-green-400"
                  : "text-destructive"
            }
          >
            {checking ? t("checking") : available ? t("available") : t("taken")}
          </span>
        </li>
      )}
    </ul>
  );
}

function RuleRow({ passed, label }: { passed: boolean; label: string }) {
  return (
    <li className="flex items-center gap-1.5 text-xs">
      {passed ? (
        <Check className="size-3 text-green-600 dark:text-green-400" />
      ) : (
        <X className="size-3 text-muted-foreground" />
      )}
      <span className={passed ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>
        {label}
      </span>
    </li>
  );
}
