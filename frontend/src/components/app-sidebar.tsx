"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Home, Search, PlusCircle, Bell, LogIn, Store, PanelLeft, PanelLeftClose } from "lucide-react";
import { SidebarMoreMenu } from "@/components/sidebar-more-menu";
import { UserAvatar } from "@/components/user-avatar";
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
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { key: "home", href: "/", icon: Home },
  { key: "browse", href: "/browse", icon: Search },
  { key: "myStalls", href: "/my-stalls", icon: Store, auth: true },
  { key: "sell", href: "/sell", icon: PlusCircle },
  { key: "notifications", href: "/notifications", icon: Bell },
];

/* Instagram-style: uses size="lg" (h-12) for proper collapsed handling.
   Only override text/gap/radius — leave padding to sidebar framework. */
const navButtonClass =
  "!rounded-xl !text-[15px] !font-normal !gap-4 hover:!bg-sidebar-accent/60";

export function AppSidebar() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const { isLoggedIn, user } = useAuth();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";

  const visibleNavItems = navItems.filter(
    (item) => !item.auth || isLoggedIn
  );

  return (
    <Sidebar collapsible="icon">
      {/* Logo header + collapse toggle */}
      <SidebarHeader className={collapsed ? "" : "!pt-4 !pb-3"}>
        {!collapsed ? (
          <div className="flex items-center justify-between px-1">
            <Link
              href="/"
              className="text-xl font-semibold tracking-tight text-sidebar-foreground"
            >
              ManVaig
            </Link>
            <button
              onClick={toggleSidebar}
              aria-label="Collapse sidebar"
              className="flex size-8 items-center justify-center rounded-lg text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"
            >
              <PanelLeftClose className="size-5" strokeWidth={1.5} />
            </button>
          </div>
        ) : (
          <button
            onClick={toggleSidebar}
            aria-label="Expand sidebar"
            className="flex size-10 mx-auto items-center justify-center rounded-xl text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-colors"
          >
            <PanelLeft className="size-5" strokeWidth={1.5} />
          </button>
        )}
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="!gap-1">
              {visibleNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    size="lg"
                    className={navButtonClass}
                    isActive={item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)}
                    tooltip={t(item.key)}
                    render={<Link href={item.href} />}
                  >
                    <item.icon
                      className="!size-6 shrink-0"
                      strokeWidth={pathname === item.href ? 2.5 : 1.5}
                      aria-hidden="true"
                    />
                    <span
                      className={
                        pathname === item.href ? "font-semibold" : ""
                      }
                    >
                      {t(item.key)}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer: Profile/Login + More */}
      <SidebarFooter className={collapsed ? "" : "!pb-4"}>
        <SidebarMenu className="!gap-1">
          {isLoggedIn ? (
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                className={navButtonClass}
                isActive={pathname === "/profile"}
                tooltip={user?.displayName ?? ""}
                render={<Link href="/profile" />}
              >
                <UserAvatar
                  displayName={user?.displayName ?? ""}
                  avatarUrl={user?.avatarUrl ?? null}
                  size="xs"
                  className="shrink-0"
                />
                <span
                  className={`truncate ${pathname === "/profile" ? "font-semibold" : ""}`}
                >
                  {user?.displayName}
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : (
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                className={navButtonClass}
                tooltip={t("login")}
                render={<Link href="/login" />}
              >
                <LogIn className="!size-6 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                <span>{t("login")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMoreMenu />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
