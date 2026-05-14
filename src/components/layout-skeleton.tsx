"use client";

import React from "react";
import { 
  Sidebar, 
  SidebarHeader, 
  SidebarContent, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton, 
  SidebarProvider 
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Logo } from "@/components/logo";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function LayoutSkeleton() {
  return (
    <SidebarProvider open={true}>
      <div className="flex h-screen w-full bg-background overflow-hidden">
        {/* Desktop Sidebar Skeleton */}
        <Sidebar className="hidden md:flex shrink-0">
          <SidebarHeader>
            <div className="flex items-center gap-2 p-2">
              <Logo />
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              {Array.from({ length: 8 }).map((_, i) => (
                <SidebarMenuItem key={i}>
                  <SidebarMenuButton disabled>
                    <Skeleton className="h-5 w-5 rounded-md" />
                    <Skeleton className="h-4 w-28" />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>

        {/* Main Content Area */}
        <div className="flex flex-col flex-1 h-screen overflow-hidden">
          {/* Header Skeleton */}
          <header className="h-16 border-b flex items-center justify-between px-4 md:px-6 shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center gap-4">
              <Skeleton className="h-9 w-9 rounded-md md:hidden" />
              <div className="hidden md:block">
                 <Skeleton className="h-9 w-64 rounded-full" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-24 rounded-full hidden sm:block" />
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className="h-9 w-9 rounded-full" />
            </div>
          </header>

          {/* Main Body Skeleton */}
          <ScrollArea className="flex-1">
            <main className="p-4 md:p-8 space-y-8">
              <div className="space-y-3">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-4 w-96 max-w-full" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-3 border rounded-xl p-4">
                    <Skeleton className="h-40 w-full rounded-lg" />
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <Skeleton className="h-8 w-32" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                   {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-32 w-full rounded-lg" />
                   ))}
                </div>
              </div>
            </main>
          </ScrollArea>
        </div>
      </div>
    </SidebarProvider>
  );
}
