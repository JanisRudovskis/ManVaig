"use client";

import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* Mobile sidebar trigger — only visible below md breakpoint */}
        <div className="sticky top-0 z-30 flex h-12 items-center border-b border-border bg-background px-4 md:hidden">
          <SidebarTrigger />
          <span className="ml-3 text-sm font-semibold">ManVaig</span>
        </div>
        <main className="flex-1 p-4">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
