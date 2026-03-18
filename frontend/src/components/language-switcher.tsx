"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Globe, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useSidebar } from "@/components/ui/sidebar";
import { locales, localeNames, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("language");
  const { state: sidebarState } = useSidebar();
  const collapsed = sidebarState === "collapsed";
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="flex h-8 items-center gap-3 rounded-md px-4 py-1.5 text-sidebar-foreground/50">
        <Globe className="!size-4 shrink-0" />
        {!collapsed && <span className="text-sm font-normal uppercase">{locale}</span>}
      </div>
    );
  }

  function switchLocale(newLocale: Locale) {
    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=${60 * 60 * 24 * 365}`;
    setOpen(false);
    router.refresh();
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "flex h-8 w-full items-center rounded-md text-sm font-normal text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
          collapsed ? "justify-center px-0" : "gap-3 px-4 py-1.5"
        )}
        aria-label={t("switchTo")}
        title={collapsed ? localeNames[locale as Locale] : undefined}
      >
        <Globe className="!size-4 shrink-0" aria-hidden="true" />
        {!collapsed && (
          <span className="uppercase">{locale}</span>
        )}
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-40 p-1">
        {locales.map((loc) => (
          <button
            key={loc}
            onClick={() => switchLocale(loc)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm",
              loc === locale
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent/50"
            )}
          >
            <Check
              className={cn(
                "size-3.5 shrink-0",
                loc === locale ? "opacity-100" : "opacity-0"
              )}
            />
            <span className="font-mono text-xs uppercase">{loc}</span>
            <span>{localeNames[loc]}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
