"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Home, Search, PlusCircle, Bell, LogIn, LogOut, PanelLeftClose, PanelLeft, User } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useAuth } from "@/lib/auth-context";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { key: "home", href: "/", icon: Home },
  { key: "browse", href: "/browse", icon: Search },
  { key: "sell", href: "/sell", icon: PlusCircle },
  { key: "notifications", href: "/notifications", icon: Bell },
];

/* Match Claude's sidebar nav button style exactly:
   12px, weight 400, 32px tall, 6px gap, 6px radius, padding 6px 16px */
const navButtonClass = "!h-8 !rounded-md !px-4 !py-1.5 !text-sm !font-normal !gap-3";

function SidebarHeaderContent() {
  const { toggleSidebar, state } = useSidebar();

  if (state === "collapsed") {
    return (
      <div className="flex justify-center py-2">
        <button
          onClick={toggleSidebar}
          aria-label="Expand sidebar"
          className="flex size-8 items-center justify-center rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
        >
          <PanelLeft className="size-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-4 py-2">
      <Link href="/" className="text-base font-normal text-sidebar-foreground">
        ManVaig
      </Link>
      <button
        onClick={toggleSidebar}
        aria-label="Collapse sidebar"
        className="flex size-7 items-center justify-center rounded-md text-sidebar-foreground/40 hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
      >
        <PanelLeftClose className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function AuthButton() {
  const t = useTranslations("nav");
  const { isLoggedIn, user, logout } = useAuth();

  if (isLoggedIn) {
    return (
      <>
        <SidebarMenuItem>
          <SidebarMenuButton className={navButtonClass} tooltip={user?.displayName ?? ""} render={<Link href="/profile" />}>
            <User className="!size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{user?.displayName}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton className={navButtonClass} tooltip={t("logout")} onClick={logout}>
            <LogOut className="!size-4 shrink-0" aria-hidden="true" />
            <span>{t("logout")}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton className={navButtonClass} tooltip={t("login")} render={<Link href="/login" />}>
        <LogIn className="!size-4 shrink-0" aria-hidden="true" />
        <span>{t("login")}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="!pb-0">
        <SidebarHeaderContent />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="!gap-1.5">
          <SidebarGroupContent>
            <SidebarMenu className="!gap-0.5">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    className={navButtonClass}
                    isActive={pathname === item.href}
                    tooltip={t(item.key)}
                    render={<Link href={item.href} />}
                  >
                    <item.icon className="!size-4 shrink-0" aria-hidden="true" />
                    <span>{t(item.key)}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="!gap-0.5">
        <SidebarSeparator />
        <SidebarMenu className="!gap-0.5">
          <SidebarMenuItem>
            <ThemeToggle />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <LanguageSwitcher />
          </SidebarMenuItem>
          <AuthButton />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
