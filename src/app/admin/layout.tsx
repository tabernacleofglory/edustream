
"use client";

import { ReactNode, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Menu,
  ChevronDown,
  ChevronUp,
  LogOut,
  LayoutDashboard,
  Settings,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth/server-actions";
import { cn } from "@/lib/utils";
import type { Ladder } from '@/lib/types';
import { navLinks, type NavGroupItem } from "@/lib/admin-nav-config";
import { collection, query, orderBy, onSnapshot, doc, getDoc } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase";
import DynamicIcon from "@/components/dynamic-icon";
import { Logo } from "@/components/logo";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import GlobalSearch from "@/components/global-search";
import { useI18n } from "@/hooks/use-i18n";
import MobileNav from "@/components/mobile-nav";
import ActiveUsersSidebar from "@/components/active-users-sidebar";
import { ImpersonationBanner } from "@/components/impersonation-banner";


const NavItem = ({ href, label, icon: Icon, subItems, permission, isSidebarOpen }: { href?: string; label: string; icon: React.ElementType; subItems?: NavGroupItem[]; permission?: string, isSidebarOpen: boolean }) => {
  const pathname = usePathname();
  const { hasPermission } = useAuth();
  const [isOpen, setIsOpen] = useState(subItems?.some(item => pathname.startsWith(item.href || '')));

  if (permission && !hasPermission(permission)) {
    return null;
  }

  if (subItems) {
    const visibleSubItems = subItems.filter(item => !item.permission || hasPermission(item.permission));
    if (visibleSubItems.length === 0) return null;

    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className={cn("w-full pr-2", isSidebarOpen ? "justify-between" : "justify-center")}>
            <div className="flex items-center gap-3">
              <Icon className="h-5 w-5" />
              {isSidebarOpen && <span>{label}</span>}
            </div>
            {isSidebarOpen && (isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pl-6">
          <div className="flex flex-col gap-1">
            {visibleSubItems.map((item, index) => (
              <NavItem key={`${item.label}-${index}`} {...item} isSidebarOpen={isSidebarOpen} />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <Link href={href!} className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary', pathname === href && 'bg-muted text-primary', !isSidebarOpen && 'justify-center')}>
      <Icon className="h-5 w-5" />
      {isSidebarOpen && <span>{label}</span>}
    </Link>
  );
};


export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const { user, loading, hasPermission, refreshUser } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [userLadder, setUserLadder] = useState<Ladder | null>(null);
  const db = getFirebaseFirestore();

  const isFormBuilderPage = pathname.startsWith('/admin/forms/builder');
  const isUnrestrictedPlayerPage = pathname.startsWith('/admin/courses/player');
  const [isSidebarOpen, setIsSidebarOpen] = useState(isMobile ? false : (!isFormBuilderPage && !isUnrestrictedPlayerPage));

  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false);
    } else {
      setIsSidebarOpen(!isFormBuilderPage && !isUnrestrictedPlayerPage);
    }
  }, [isMobile, isFormBuilderPage, isUnrestrictedPlayerPage, pathname]);


  const isFullscreenPage = pathname.startsWith('/admin/glory-live') || pathname.startsWith('/admin/live/');

  if (isFullscreenPage) {
    return <>{children}</>;
  }


  const localizedNavLinks = navLinks.map(group => ({
    ...group,
    group: t(group.i18nKey, group.group),
    items: group.items.map(item => ({
      ...item,
      label: t(item.i18nKey, item.label),
      ...(item.subItems ? {
        subItems: item.subItems.map(sub => ({
          ...sub,
          label: t(sub.i18nKey, sub.label),
        }))
      } : {}),
    })),
  }));

  const fetchUserLadder = useCallback(async (ladderId: string) => {
    if (!ladderId) {
      setUserLadder(null);
      return;
    }
    const ladderDocRef = doc(db, "courseLevels", ladderId);
    try {
      const docSnap = await getDoc(ladderDocRef);
      if (docSnap.exists()) {
        setUserLadder({ id: docSnap.id, ...docSnap.data() } as Ladder);
      } else {
        setUserLadder(null);
      }
    } catch (e) {
      console.error("Failed to fetch user ladder", e);
      setUserLadder(null);
    }
  }, [db]);

  useEffect(() => {
    if (user) {
      fetchUserLadder(user.classLadderId || '');
    }
  }, [user, fetchUserLadder]);

  const getInitials = (name?: string | null) => {
    if (!name) return 'U';
    const names = name.split(' ');
    const initials = names.map(n => n[0]).join('');
    return initials.toUpperCase();
  }

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  if (loading) {
    return <div>Loading admin panel...</div>;
  }

  if (!hasPermission('viewAdminDashboard')) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Alert variant="destructive" className="max-w-md">
          <Lock className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You do not have permission to view the admin panel.
            <Button asChild variant="link"><Link href="/dashboard">Go to your dashboard</Link></Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full">
      <ImpersonationBanner />
      <aside className={cn(`fixed inset-y-0 left-0 z-50 flex h-full max-h-screen flex-col bg-background border-r transition-all duration-300 ease-in-out`, isSidebarOpen ? 'w-[220px] lg:w-[280px]' : 'w-0 md:w-16')}>
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Home className={cn("h-6 w-6", !isSidebarOpen && 'mx-auto md:block', isMobile && 'hidden')} />
            {isSidebarOpen && <span className="">Glory Training Hub</span>}
          </Link>
        </div>
        <div className="flex-1 overflow-auto py-2">
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
            {localizedNavLinks.map((group) => (
              <div key={group.group} className="mb-4">
                {isSidebarOpen && (
                  <h3 className="mb-2 px-3 text-xs font-semibold uppercase text-muted-foreground">
                    {group.group}
                  </h3>
                )}
                {group.items.map((item, index) => (
                  <NavItem key={`${group.group}-${item.label}-${index}`} {...item} isSidebarOpen={isSidebarOpen} />
                ))}
              </div>
            ))}
          </nav>
        </div>
        <div className="mt-auto p-4 border-t flex items-center justify-between">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-2 px-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.photoURL || undefined} alt="User avatar" />
                  <AvatarFallback>{getInitials(user?.displayName)}</AvatarFallback>
                </Avatar>
                {isSidebarOpen &&
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-medium">{user?.displayName}</span>
                  </div>
                }
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56" side="top" sideOffset={8}>
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.displayName}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                  <div className="text-xs leading-none text-muted-foreground flex items-center gap-1">
                    {userLadder?.icon && <DynamicIcon name={userLadder.icon} className="h-3 w-3" />}
                    <span>{userLadder?.name || user?.role || 'User'}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard">
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  <span>{t('nav.student_view', "Student View")}</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>{t('nav.settings', 'Settings')}</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>{t('nav.logout', 'Log Out')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {isSidebarOpen && <ThemeToggle />}
        </div>
      </aside>
      {isSidebarOpen && isMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      <div className={cn("flex flex-col transition-[padding]", isSidebarOpen ? "md:pl-[220px] lg:pl-[280px]" : "md:pl-16")}>
        <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur-sm lg:h-[60px] lg:px-6">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setIsSidebarOpen(prev => !prev)}>
              <Menu className="h-5 w-5" />
            </Button>
            {isMobile && !isSidebarOpen && <Logo />}
          </div>
          <div className="hidden md:flex flex-1 justify-center px-4">
            <GlobalSearch />
          </div>
          <div className="ml-auto flex items-center gap-2">
            {isMobile && <GlobalSearch />}
            <ThemeToggle />
          </div>
        </header>
        <main className={cn("flex-1 p-4 sm:p-6 bg-muted/40 overflow-auto", isMobile && "pb-24")}>
          {children}
        </main>
      </div>
      <MobileNav onMenuClick={() => setIsSidebarOpen(true)} />
      <ActiveUsersSidebar />
    </div>
  );
}
