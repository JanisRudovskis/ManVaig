"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Menu,
  Sun,
  Moon,
  Globe,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Check,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth-context";
import { locales, localeNames, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

type View = "main" | "language";

const btnClass =
  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-popover-foreground hover:bg-accent transition-colors cursor-pointer";

export function SidebarMoreMenu() {
  const t = useTranslations("nav");
  const tTheme = useTranslations("theme");
  const tLang = useTranslations("language");
  const { resolvedTheme, setTheme } = useTheme();
  const locale = useLocale();
  const router = useRouter();
  const { state: sidebarState } = useSidebar();
  const { isLoggedIn, logout } = useAuth();
  const collapsed = sidebarState === "collapsed";

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("main");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Reset to main view when popover closes
  useEffect(() => {
    if (!open) {
      // Small delay so the animation finishes before resetting
      const timer = setTimeout(() => setView("main"), 150);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const isDark = mounted ? resolvedTheme === "dark" : true;
  const ThemeIcon = isDark ? Sun : Moon;
  const themeLabel = isDark ? tTheme("light") : tTheme("dark");

  function toggleTheme() {
    setTheme(isDark ? "light" : "dark");
  }

  function switchLocale(newLocale: Locale) {
    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=${60 * 60 * 24 * 365}`;
    setOpen(false);
    router.refresh();
  }

  function handleLogout() {
    setOpen(false);
    logout();
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "flex w-full items-center rounded-xl text-[15px] font-normal text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors",
          collapsed
            ? "size-10 justify-center p-0 mx-auto"
            : "h-12 gap-4 p-2"
        )}
        aria-label={t("more")}
        title={collapsed ? t("more") : undefined}
      >
        <Menu className="!size-6 shrink-0" strokeWidth={1.5} aria-hidden="true" />
        {!collapsed && <span>{t("more")}</span>}
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-56 !p-1.5 !gap-0"
      >
        {view === "main" && (
          <div className="flex flex-col">
            {/* Theme toggle */}
            <button onClick={toggleTheme} className={btnClass}>
              <ThemeIcon className="size-4 shrink-0" />
              <span className="flex-1 text-left">{themeLabel}</span>
            </button>

            {/* Language — opens sub-view */}
            <button
              onClick={() => setView("language")}
              className={btnClass}
            >
              <Globe className="size-4 shrink-0" />
              <span className="flex-1 text-left">{tLang("switchTo")}</span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>

            {/* Separator + Logout (only when logged in) */}
            {isLoggedIn && (
              <>
                <div className="my-1 h-px bg-border" />
                <button onClick={handleLogout} className={btnClass}>
                  <LogOut className="size-4 shrink-0" />
                  <span>{t("logout")}</span>
                </button>
              </>
            )}
          </div>
        )}

        {view === "language" && (
          <div className="flex flex-col">
            {/* Back header */}
            <button
              onClick={() => setView("main")}
              className={cn(btnClass, "mb-1")}
            >
              <ChevronLeft className="size-4 shrink-0" />
              <span className="flex-1 text-left font-medium">
                {tLang("switchTo")}
              </span>
              <Globe className="size-4 shrink-0 text-muted-foreground" />
            </button>

            <div className="h-px bg-border mb-1" />

            {/* Language options */}
            {locales.map((loc) => (
              <button
                key={loc}
                onClick={() => switchLocale(loc)}
                className={cn(
                  btnClass,
                  loc === locale && "bg-accent"
                )}
              >
                <Check
                  className={cn(
                    "size-4 shrink-0",
                    loc === locale ? "opacity-100" : "opacity-0"
                  )}
                />
                <span className="font-mono text-xs uppercase">{loc}</span>
                <span>{localeNames[loc]}</span>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
