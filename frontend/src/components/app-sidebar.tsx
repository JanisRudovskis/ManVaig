"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, PlusCircle, Bell, LogIn, PanelLeftClose, PanelLeft } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
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
  { label: "Home", href: "/", icon: Home },
  { label: "Browse", href: "/browse", icon: Search },
  { label: "Sell", href: "/sell", icon: PlusCircle },
  { label: "Notifications", href: "/notifications", icon: Bell },
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

export function AppSidebar() {
  const pathname = usePathname();

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
                    tooltip={item.label}
                    render={<Link href={item.href} />}
                  >
                    <item.icon className="!size-4 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
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
            <SidebarMenuButton className={navButtonClass} tooltip="Login" render={<Link href="/login" />}>
              <LogIn className="!size-4 shrink-0" aria-hidden="true" />
              <span>Login</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
