"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Home } from "lucide-react";

const topNavItems = [
  { key: "home", href: "/", icon: Home },
  // Future icons: Auctions, Nearby, Categories, etc.
];

export function TopNavBar() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <div className="sticky top-0 z-40 flex h-12 w-full items-center border-b border-border bg-card/95 backdrop-blur-sm">
      {/* Left: Logo (mobile) */}
      <div className="flex w-16 shrink-0 items-center justify-center md:w-20">
        <Link href="/" className="text-sm font-semibold text-foreground md:hidden">
          MV
        </Link>
      </div>

      {/* Center: Icon tabs */}
      <div className="flex flex-1 items-center justify-center gap-1">
        {topNavItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex h-12 items-center justify-center px-8 transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              title={t(item.key)}
            >
              <item.icon className="size-5" />
              {/* Active indicator line */}
              {isActive && (
                <span className="absolute bottom-0 left-2 right-2 h-[3px] rounded-t-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>

      {/* Right: spacer to balance */}
      <div className="w-16 shrink-0 md:w-20" />
    </div>
  );
}
