"use client";

import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const t = useTranslations("theme");
  const { state: sidebarState } = useSidebar();
  const collapsed = sidebarState === "collapsed";
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="flex h-8 items-center gap-3 rounded-md px-4 py-1.5 text-sidebar-foreground/50">
        <Moon className="!size-4 shrink-0" />
        {!collapsed && <span className="text-sm font-normal">{t("dark")}</span>}
      </div>
    );
  }

  const isDark = resolvedTheme === "dark";
  const Icon = isDark ? Sun : Moon;
  const next = isDark ? "light" : "dark";
  const label = isDark ? t("light") : t("dark");

  return (
    <button
      onClick={() => setTheme(next)}
      aria-label={t("switchTo")}
      title={collapsed ? label : undefined}
      className={cn(
        "flex h-8 w-full items-center rounded-md text-sm font-normal text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
        collapsed ? "justify-center px-0" : "gap-3 px-4 py-1.5"
      )}
    >
      <Icon className="!size-4 shrink-0" aria-hidden="true" />
      {!collapsed && <span>{label}</span>}
    </button>
  );
}
