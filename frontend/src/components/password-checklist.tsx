"use client";

import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";

interface PasswordChecklistProps {
  password: string;
}

const rules = [
  { key: "length" as const, test: (pw: string) => pw.length >= 8 },
  { key: "uppercase" as const, test: (pw: string) => /[A-Z]/.test(pw) },
  { key: "digit" as const, test: (pw: string) => /\d/.test(pw) },
];

export function PasswordChecklist({ password }: PasswordChecklistProps) {
  const t = useTranslations("passwordChecklist");

  // Don't show anything until the user starts typing
  if (!password) return null;

  return (
    <ul className="space-y-1">
      {rules.map(({ key, test }) => {
        const passed = test(password);
        return (
          <li key={key} className="flex items-center gap-1.5 text-xs">
            {passed ? (
              <Check className="size-3 text-green-600 dark:text-green-400" />
            ) : (
              <X className="size-3 text-muted-foreground" />
            )}
            <span className={passed ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>
              {t(key)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
