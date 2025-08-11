
// src/components/app-content.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
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
import { LayoutDashboard, BookOpen, UserCog, Settings, LogOut, Library, Video, Image as ImageIcon, Music, FileText, Building, Award, PanelLeft, Search, Users, LineChart, BookText, Tv, ChevronRight, Menu, MessageSquare, BookCopy } from "lucide-react";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { getFirebaseAuth, getFirebaseFirestore } from "@/lib/firebase";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-is-mobile";
import type { Ladder } from '@/lib/types';
import { collection, query, orderBy, onSnapshot, doc } from "firebase/firestore";
import DynamicIcon from "@/components/dynamic-icon";
import { Progress } from "@/components/ui/progress";
import useRealTimeProgress from "@/hooks/use-real-time-progress";
import { Toaster } from "@/components/ui/toaster";


const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/courses", icon: BookOpen, label: "All Courses" },
  { href: "/live", icon: Tv, label: "Live" },
  { href: "/music", icon: Music, label: "Music" },
  { href: "/community", icon: MessageSquare, label: "Community" },
  { href: "/documentation", icon: BookCopy, label: "Documentation" },
];

const adminNavItems = [
    { href: "/admin/analytics", icon: LineChart, label: "Analytics" },
    { href: "/admin/users", icon: Users, label: "User Management" },
    { href: "/admin/campus", icon: Building, label: "Campus" },
]

const contentLibraryItems = [
    { href: "/admin/content/videos", icon: Video, label: "Videos" },
    { href: "/admin/content/images", icon: ImageIcon, label: "Images" },
    { href: "/admin/content/music", icon: Music, label: "Music" },
    { href: "/admin/content/documents", icon: FileText, label: "Documents" },
    { href: "/admin/content/documentation", icon: BookText, label: "Documentation" },
    { href: "/admin/content/certificates", icon: Award, label: "Certificates" },
]

const getInitials = (name?: string | null) => {
    if (!name) return 'U';
    const names = name.split(' ');
    const initials = names.map(n => n[0]).join('');
    return initials.toUpperCase();
}

const UserProfile = () => {
    const { user, isCurrentUserAdmin } = useAuth();
    const router = useRouter();
    const isMobile = useIsMobile();
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
                        <span>{userLadder?.name || (isCurrentUserAdmin ? 'Administrator' : 'Premium Member')}</span>
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
                  <Link href="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                {isCurrentUserAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin/analytics">
                      <UserCog className="mr-2 h-4 w-4" />
                      <span>Admin Tools</span>
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
  
  if (usePathname().startsWith('/admin')) {
      return null;
  }

  return (
     <header className="sticky top-0 z-40 flex h-16 w-full items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
        <div className="flex items-center gap-2">
            {isMobile ? (
                <Button variant="ghost" size="icon" onClick={() => setOpen(!isSidebarOpen)}>
                    <Menu className="h-6 w-6" />
                </Button>
            ) : (
                <SidebarTrigger className="md:flex" />
            )}
             <div className="md:hidden">
                <Logo />
            </div>
             {!isSidebarOpen && !isMobile && (
                <div className="hidden md:block">
                    <Logo />
                </div>
            )}
        </div>
        <div className="hidden md:flex flex-1 justify-center px-4">
            {/* Global Search Removed */}
        </div>
         <div className="ml-auto flex items-center gap-2">
            {!isMobile && <ThemeToggle />}
            <UserProfile />
        </div>
    </header>
  )
}

export default function AppContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading, isCurrentUserAdmin } = useAuth();
  const router = useRouter();
  const db = getFirebaseFirestore();

  const [isContentMenuOpen, setIsContentMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  const [isSidebarOpen, setIsSidebarOpen] = useState(isMobile === undefined ? false : !isMobile);


  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/signup');
  const isLandingPage = pathname === '/';
  
  const showAppLayout = !isAuthPage && !isLandingPage;

  const isVideoPage = pathname.includes('/courses/') && pathname.includes('/video/');
    const courseId = isVideoPage ? pathname.split('/courses/')[1].split('/')[0] : '';
    const { percentage: progressPercentage } = useRealTimeProgress(user?.uid || '', courseId);


   useEffect(() => {
    setIsContentMenuOpen(pathname.startsWith('/admin/content'));
  }, [pathname]);

  useEffect(() => {
    if (isMobile === undefined) return;
    if (isVideoPage) {
        setIsSidebarOpen(false);
    } else if (showAppLayout && !isMobile) { // Only set to true if it's an app page and not mobile
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
  
  if (isAuthPage || isLandingPage) {
    return <>{children}<Toaster /></>;
  }

  const isAdminPage = pathname.startsWith('/admin');
  if (isAdminPage) {
      return (
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
            {children}
            <Toaster />
        </ThemeProvider>
      )
  }

  if (loading || !user) {
    return (
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
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
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
    >
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
                {navItems.map((item) => (
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
                    {isVideoPage && isSidebarOpen && (
                        <div className="px-4 mt-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm text-muted-foreground">Progress</span>
                                <span className="text-sm font-bold">{progressPercentage}%</span>
                            </div>
                            <Progress value={progressPercentage} className="w-full h-2 [&>div]:bg-gradient-to-r from-pink-500 to-orange-400" />
                        </div>
                    )}
                {isCurrentUserAdmin && (
                    <>
                        {adminNavItems.map((item) => (
                            <SidebarMenuItem key={item.href}>
                            <Link href={item.href}>
                                <SidebarMenuButton
                                isActive={pathname.startsWith(item.href)}
                                tooltip={{ children: item.label }}
                                >
                                <item.icon />
                                {isSidebarOpen && <span>{item.label}</span>}
                                </SidebarMenuButton>
                            </Link>
                            </SidebarMenuItem>
                        ))}
                        <Collapsible open={isSidebarOpen && isContentMenuOpen} onOpenChange={setIsContentMenuOpen} asChild>
                            <SidebarMenuItem>
                                <CollapsibleTrigger asChild>
                                    <SidebarMenuButton tooltip={{ children: 'Content Library' }}>
                                        <Library />
                                        {isSidebarOpen && <span>Content Library</span>}
                                        {isSidebarOpen && <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />}
                                    </SidebarMenuButton>
                                </CollapsibleTrigger>
                                <CollapsibleContent asChild>
                                    <SidebarMenuSub>
                                        {contentLibraryItems.map((item) => (
                                            <SidebarMenuSubItem key={item.href}>
                                                <Link href={item.href}>
                                                    <SidebarMenuSubButton isActive={pathname === item.href}>
                                                        <item.icon />
                                                        {isSidebarOpen && <span>{item.label}</span>}
                                                    </SidebarMenuSubButton>
                                                </Link>
                                            </SidebarMenuSubItem>
                                        ))}
                                    </SidebarMenuSub>
                                </CollapsibleContent>
                            </SidebarMenuItem>
                        </Collapsible>
                    </>
                )}
                </SidebarMenu>
            </SidebarContent>
                <SidebarFooter className="sticky bottom-0 bg-background border-t border-border">
                {/* User profile and theme toggle moved to header */}
                </SidebarFooter>
            </Sidebar>
            <div className={cn("absolute inset-0 bg-black/50 z-40 md:hidden", isSidebarOpen ? 'block' : 'hidden')} onClick={() => setIsSidebarOpen(false)} />
            <PanelResizeHandle className={cn("w-px items-center justify-center bg-border", isMobile ? 'hidden' : 'flex')} />
            <Panel className={cn(isMobile && isSidebarOpen && "pointer-events-none")}>
                <div className="flex flex-col h-screen">
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
        <Toaster />
    </ThemeProvider>
  );
}
