
"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  useSidebar,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, BookOpen, UserCog, Settings, LogOut, Tv, Music, MessageSquare, BookCopy, Shield, Menu, Award, Theater, Play } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { getFirebaseAuth, getFirebaseFirestore } from "@/lib/firebase";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-is-mobile";
import type { Ladder } from '@/lib/types';
import { onSnapshot, doc } from "firebase/firestore";
import DynamicIcon from "@/components/dynamic-icon";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Lock } from 'lucide-react';
import GlobalSearch from "@/components/global-search";
import LanguageSwitcher from "@/components/language-switcher";


const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", permission: "viewDashboard" },
  { href: "/courses", icon: BookOpen, label: "All Courses", permission: "viewCoursesPage" },
  { href: "/my-certificates", icon: Award, label: "My Certificates", permission: "viewDashboard" },
  { href: "/live", icon: Tv, label: "Live", permission: "viewLivePage" },
  { href: "/admin/courses/teaching", icon: Play, label: "Teaching", permission: "viewTeachingPage" },
  { href: "/music", icon: Music, label: "Music", permission: "viewMusicPage" },
  { href: "/community", icon: MessageSquare, label: "Community", permission: "viewCommunityPage" },
  { href: "/documentation", icon: BookCopy, label: "Documentation", permission: "viewDocumentationPage" },
];


const getInitials = (name?: string | null) => {
    if (!name) return 'U';
    const names = name.split(' ');
    const initials = names.map(n => n[0]).join('').toUpperCase();
    return initials.toUpperCase();
}

const UserProfile = () => {
    const { user, hasPermission } = useAuth();
    const router = useRouter();
    const [userLadder, setUserLadder] = useState<Ladder | null>(null);
    const auth = getFirebaseAuth();
    const db = getFirebaseFirestore();

     useEffect(() => {
        if (user?.classLadderId) {
            const ladderDocRef = doc(db, "courseLevels", user.classLadderId);
            const unsubscribe = onSnapshot(ladderDocRef, (doc) => {
                if (doc.exists()) {
                    setUserLadder({ id: doc.id, ...doc.data() } as Ladder);
                } else {
                    setUserLadder(null);
                }
            });
            return () => unsubscribe();
        } else {
            setUserLadder(null);
        }
    }, [user?.classLadderId, db]);

    const handleLogout = async () => {
        await auth.signOut();
        router.push("/login");
    };

    if (!user) return null;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                 <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                    <Avatar className="h-9 w-9">
                        <AvatarImage src={user.photoURL || undefined} alt={user.displayName || "User"} />
                        <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.displayName}</p>
                    <div className="text-xs leading-none text-muted-foreground flex items-center gap-1">
                        {userLadder?.icon && <DynamicIcon name={userLadder.icon} className="h-3 w-3" />}
                        <span>{userLadder?.name || user.role}</span>
                    </div>
                     {user.ministry && (
                        <p className="text-xs leading-none text-muted-foreground">
                            Ministry: {user.ministry}
                        </p>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard">
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    <span>Dashboard</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                {hasPermission('viewAdminDashboard') && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin/analytics">
                      <UserCog className="mr-2 h-4 w-4" />
                      <span>Admin Panel</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
        </DropdownMenu>
    );
};

const HeaderContent = () => {
  const { open: isSidebarOpen, setOpen } = useSidebar();
  const isMobile = useIsMobile();
  const pathname = usePathname();
  
  if (pathname.startsWith('/admin')) {
      return null;
  }

  const isVideoPage = pathname.includes('/courses/') && pathname.includes('/video/');

  return (
     <header className="sticky top-0 z-40 flex h-16 w-full items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
        <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setOpen(!isSidebarOpen)}>
                <Menu className="h-6 w-6" />
            </Button>
            <div className={cn(isMobile ? 'block' : 'hidden', isSidebarOpen && 'hidden')}>
                <Logo />
            </div>
             {!isSidebarOpen && !isMobile && (
                <div className="hidden md:block">
                    <Logo />
                </div>
            )}
        </div>
        {!isVideoPage && (
            <>
                <div className="hidden md:flex flex-1 justify-center px-4">
                    <GlobalSearch />
                </div>
                 <div className="ml-auto flex items-center gap-2">
                    <LanguageSwitcher />
                    {!isMobile && <ThemeToggle />}
                    <UserProfile />
                </div>
            </>
        )}
         {isVideoPage && (
            <div className="ml-auto flex items-center gap-2">
                <LanguageSwitcher />
                {!isMobile && <ThemeToggle />}
                <UserProfile />
            </div>
        )}
    </header>
  )
}

function AppContentInternal({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading, hasPermission, isProfileComplete } = useAuth();
  const router = useRouter();
  const { currentTrack } = useAudioPlayer();

  const isMobile = useIsMobile();
  const isVideoPage = pathname.includes('/courses/') && pathname.includes('/video/');
  const [isSidebarOpen, setIsSidebarOpen] = useState(isMobile === undefined ? false : !isMobile && !isVideoPage);


  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/signup');
  const isLandingPage = pathname === '/';
  const isExternalPage = pathname.startsWith('/external');
  
  const showAppLayout = !isAuthPage && !isLandingPage && !isExternalPage;

  const canSeeFullMenu = isProfileComplete && user?.isInHpGroup;

   useEffect(() => {
    if (isMobile === undefined) return;
    if (isVideoPage) {
        setIsSidebarOpen(false);
    } else if (showAppLayout && !isMobile) { 
        setIsSidebarOpen(true);
    } else if (isMobile) {
        setIsSidebarOpen(false);
    }
  }, [pathname, isVideoPage, showAppLayout, isMobile]);

  useEffect(() => {
    if (showAppLayout && !loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router, showAppLayout]);
  
  if (isAuthPage || isLandingPage || isExternalPage) {
    return <>{children}</>;
  }

  const isAdminPage = pathname.startsWith('/admin');
  if (isAdminPage) {
      return <>{children}</>;
  }

  if (loading || (!user && showAppLayout)) {
    return (
        <div className="flex min-h-screen">
             <div className="hidden md:flex flex-col gap-4 border-r bg-background p-2 w-64">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <div className="mt-auto flex justify-between items-center">
                    <Skeleton className="h-10 w-10 rounded-full" />
                     <Skeleton className="h-10 w-10 rounded-full" />
                </div>
            </div>
            <div className="flex-1 p-6">
                <Skeleton className="h-16 w-full mb-4" />
                <Skeleton className="h-64 w-full" />
            </div>
        </div>
    )
  }
  
  if (!user) return null;

  return (
        <SidebarProvider open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
            <PanelGroup direction="horizontal" className="min-h-screen w-full relative">
                <Sidebar>
                <SidebarHeader>
                    <div className="flex items-center gap-2">
                        {isSidebarOpen && <Logo />}
                    </div>
                </SidebarHeader>
                <SidebarContent>
                    <SidebarMenu>
                    {canSeeFullMenu && navItems.filter(item => hasPermission(item.permission)).map((item) => (
                        <SidebarMenuItem key={item.href}>
                        <Link href={item.href}>
                            <SidebarMenuButton
                            isActive={pathname.startsWith(item.href) && (item.href !== '/courses' || pathname === '/courses')}
                            tooltip={{ children: item.label }}
                            >
                            <item.icon />
                            {isSidebarOpen && <span>{item.label}</span>}
                            </SidebarMenuButton>
                        </Link>
                        </SidebarMenuItem>
                    ))}
                    {canSeeFullMenu && hasPermission('viewAdminDashboard') && (
                        <SidebarMenuItem>
                            <Link href="/admin/analytics">
                                <SidebarMenuButton
                                    isActive={pathname.startsWith('/admin')}
                                    tooltip={{ children: 'Admin Panel' }}
                                >
                                    <Shield />
                                    {isSidebarOpen && <span>Admin Panel</span>}
                                </SidebarMenuButton>
                            </Link>
                        </SidebarMenuItem>
                    )}
                    {!canSeeFullMenu && (
                         <SidebarMenuItem>
                            <Link href="/settings">
                                <SidebarMenuButton
                                    isActive={pathname.startsWith('/settings')}
                                    tooltip={{ children: 'Complete Profile' }}
                                >
                                    <Settings />
                                    {isSidebarOpen && <span>Complete Profile</span>}
                                </SidebarMenuButton>
                            </Link>
                        </SidebarMenuItem>
                    )}
                    </SidebarMenu>
                </SidebarContent>
                    <SidebarFooter className="sticky bottom-0 bg-background border-t border-border">
                    </SidebarFooter>
                </Sidebar>
                <div className={cn("absolute inset-0 bg-black/50 z-40 md:hidden", isSidebarOpen ? 'block' : 'hidden')} onClick={() => setIsSidebarOpen(false)} />
                <PanelResizeHandle className={cn("w-px items-center justify-center bg-border", isMobile ? 'hidden' : 'flex')} />
                <Panel className={cn(isMobile && isSidebarOpen && "pointer-events-none")}>
                    <div className={cn("flex flex-col h-screen", currentTrack && 'pb-16')}>
                        <HeaderContent />
                        <ScrollArea className="flex-1">
                            <main className={cn("flex-1", isVideoPage ? "p-0" : "p-4 md:p-8")}>
                                {children}
                            </main>
                        </ScrollArea>
                    </div>
                </Panel>
            </PanelGroup>
        </SidebarProvider>
  );
}

export default function AppContent({ children }: { children: React.ReactNode }) {
  return <AppContentInternal>{children}</AppContentInternal>;
}
