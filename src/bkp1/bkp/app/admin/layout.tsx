
"use client";

import { ReactNode, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Users,
  BookOpen,
  Settings,
  BarChart2,
  Tag,
  Link2,
  Tv,
  FileText,
  Music,
  Image as ImageIcon,
  Award,
  BookCopy,
  Folder,
  Home,
  Menu,
  ChevronDown,
  ChevronUp,
  Building,
  LogOut,
  LayoutDashboard,
  Code,
  Shield,
  UserRound,
  UserCheck,
  Megaphone,
  FileQuestion,
  Languages,
  Church,
  UserPlus,
  Globe,
  Group,
  BookCheck,
  Sparkles
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
import { collection, query, orderBy, onSnapshot, doc, getDoc } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase";
import DynamicIcon from "@/components/dynamic-icon";
import { Logo } from "@/components/logo";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Lock } from 'lucide-react';
import GlobalSearch from "@/components/global-search";
import { useI18n } from "@/hooks/use-i18n";


const NavItem = ({ href, label, icon: Icon, subItems, permission }: { href?: string; label:string; icon: React.ElementType; subItems?: any[]; permission?: string }) => {
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
          <Button variant="ghost" className="w-full justify-between pr-2">
            <div className="flex items-center gap-3">
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </div>
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pl-6">
          <div className="flex flex-col gap-1">
            {visibleSubItems.map((item, index) => (
              <NavItem key={`${item.label}-${index}`} {...item} />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <Link href={href!} className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary', pathname === href && 'bg-muted text-primary')}>
        <Icon className="h-5 w-5" />
        <span>{label}</span>
    </Link>
  );
};


export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isMobile = useIsMobile();
  const { user, loading, hasPermission, refreshUser } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [userLadder, setUserLadder] = useState<Ladder | null>(null);
  const db = getFirebaseFirestore();

  const isFullscreenPage = pathname.startsWith('/admin/glory-live') || pathname.startsWith('/admin/live/');

  if (isFullscreenPage) {
    return <>{children}</>;
  }


  const navLinks = [
    {
      group: t('admin.nav.group.main', "Main"),
      items: [
        { href: "/admin/analytics", label: t('admin.nav.analytics', "Analytics"), icon: BarChart2, permission: 'viewAnalytics' },
        {
          label: t('admin.nav.users.group', "Users"),
          icon: Users,
          permission: 'viewUserManagement',
          subItems: [
            { href: "/admin/users", label: t('admin.nav.users.management', "User Management"), icon: Users, permission: 'manageUsers' },
            { href: "/admin/ladders", label: t('admin.nav.users.ladders', "Ladders"), icon: Shield, permission: 'manageUsers' },
            { href: "/admin/speakers", label: t('admin.nav.users.speakers', "Speakers"), icon: UserRound, permission: 'manageContent' },
            { href: "/admin/promotions", label: t('admin.nav.users.promotions', "Promotion Requests"), icon: UserCheck, permission: 'managePromotions'},
            { href: "/admin/users/hp-requests", label: t('admin.nav.users.hp_requests', "HP Requests"), icon: UserPlus, permission: 'manageHpRequests' },
            { href: "/admin/users/completions", label: "Completions", icon: BookCheck, permission: 'manageCompletions' },
          ],
        },
      ],
    },
    {
      group: t('admin.nav.group.content', "Content"),
      items: [
        { href: "/admin/courses", label: t('admin.nav.content.courses', "Courses"), icon: BookOpen, permission: 'viewCourseManagement' },
        { href: "/admin/content/groups", label: "Learning Paths", icon: Group, permission: 'manageContent' },
        { href: "/admin/forms", label: "Forms", icon: FileQuestion, permission: 'viewForms' },
        {
          label: t('admin.nav.content.libraries', "Libraries"),
          icon: Folder,
          permission: 'viewContentLibraries',
          subItems: [
            { href: "/admin/content/videos", label: t('admin.nav.content.videos', "Videos"), icon: Tv },
            { href: "/admin/content/documents", label: t('admin.nav.content.documents', "Documents"), icon: FileText },
            { href: "/admin/content/quizzes", label: t('admin.nav.content.quizzes', "Quizzes"), icon: FileQuestion },
            { href: "/admin/content/images", label: t('admin.nav.content.images', "Images"), icon: ImageIcon },
            { href: "/admin/content/music", label: t('admin.nav.content.music', "Music"), icon: Music },
            { href: "/admin/content/logos", label: t('admin.nav.content.logos', "Logos"), icon: Award },
            { href: "/admin/content/certificates", label: t('admin.nav.content.certificates', "Certificates"), icon: Award },
            { href: "/admin/content/documentation", label: t('admin.nav.content.documentation', "Documentation"), icon: BookCopy },
            { href: "/admin/content/announcements", label: t('admin.nav.content.announcements', "Announcements"), icon: Megaphone },
            { href: "/admin/content/languages", label: t('admin.nav.content.languages', "Languages"), icon: Languages },
            { href: "/admin/content/ministries", label: t('admin.nav.content.ministries', "Ministries"), icon: Church },
          ],
        },
      ],
    },
    {
      group: "Reports",
      items: [
        { href: "/admin/reports/quizzes", label: "Quiz Reports", icon: BarChart2, permission: 'viewAnalytics' },
      ],
    },
    {
      group: t('admin.nav.group.platform', "Platform"),
      items: [
        { href: "/admin/campus", label: t('admin.nav.platform.campus', "Campus"), icon: Building, permission: 'viewCampusManagement' },
        { href: "/admin/live", label: t('admin.nav.platform.live', "Live"), icon: Tv, permission: 'viewLiveManagement' },
        { href: "/my-certificates", label: t('admin.nav.platform.my_certificates', "My Certificates"), icon: Award, permission: 'viewDashboard' },
        {
          label: t('admin.nav.platform.developer', "Developer"),
          icon: Code,
          permission: 'developer', // This section is special
          subItems: [
              { href: "/admin/developer/site-settings", label: t('admin.nav.platform.dev.site_settings', "Site Settings"), icon: Settings },
              { href: "/admin/developer/certificate-builder", label: t('admin.nav.platform.dev.cert_builder', "Certificate Builder"), icon: Award },
              { href: "/admin/links", label: t('admin.nav.platform.dev.links', "Links"), icon: Link2 },
              { href: "/admin/permissions", label: t('admin.nav.platform.dev.permissions', "Permissions"), icon: Shield },
              { href: "/admin/developer/ai-tools", label: t('admin.nav.platform.dev.ai_tools', "AI Tools"), icon: Sparkles },
              { href: "/admin/developer/localization", label: t('admin.nav.platform.dev.localization', "Localization"), icon: Globe },
          ]
        },
      ],
    },
  ];

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
      <aside className={`fixed inset-y-0 left-0 z-50 flex h-full max-h-screen flex-col w-[220px] lg:w-[280px] bg-background border-r transition-transform duration-300 ease-in-out md:translate-x-0 ${isMobile && (isSidebarOpen ? 'translate-x-0' : '-translate-x-full')}`}>
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Home className="h-6 w-6" />
            <span className="">Glory Training Hub</span>
          </Link>
        </div>
        <div className="flex-1 overflow-auto py-2">
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
            {navLinks.map((group) => (
              <div key={group.group} className="mb-4">
                <h3 className="mb-2 px-3 text-xs font-semibold uppercase text-muted-foreground">
                  {group.group}
                </h3>
                {group.items.map((item, index) => (
                  <NavItem key={`${group.group}-${item.label}-${index}`} {...item} />
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
                        <div className="flex flex-col items-start">
                            <span className="text-sm font-medium">{user?.displayName}</span>
                        </div>
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
                        <span>Student View</span>
                       </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                       <Link href="/settings">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                       </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut}>
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Log out</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <ThemeToggle />
        </div>
      </aside>
       {isMobile && isSidebarOpen && (
          <div 
              className="fixed inset-0 z-40 bg-black/50" 
              onClick={() => setIsSidebarOpen(false)} 
          />
        )}
       <div className="flex flex-col md:pl-[220px] lg:pl-[280px]">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur-sm lg:h-[60px] lg:px-6">
            <div className="flex items-center gap-2">
                 {isMobile && (
                    <Button variant="outline" size="icon" onClick={() => setIsSidebarOpen(prev => !prev)}>
                        <Menu className="h-5 w-5" />
                    </Button>
                )}
                 {isMobile && <Logo />}
            </div>
            <div className="flex-1 px-4">
                <GlobalSearch />
            </div>
            <div className="ml-auto flex items-center gap-2">
                <ThemeToggle />
            </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 bg-muted/40 overflow-auto">
            {children}
        </main>
      </div>
    </div>
  );
}
