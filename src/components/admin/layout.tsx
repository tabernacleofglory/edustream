

"use client"

import { ReactNode, useState, useEffect } from "react";
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
  Sparkles,
  MessageSquare,
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
import { collection, query, orderBy, onSnapshot, doc } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase";
import DynamicIcon from "@/components/dynamic-icon";
import { Logo } from "@/components/logo";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";


const NavItem = ({ href, label, icon: Icon, subItems, permission }: { href?: string; label: string; icon: React.ElementType; subItems?: any[]; permission?: string }) => {
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
            {visibleSubItems.map(item => (
              <NavItem key={item.href} {...item} />
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

const AiFab = () => {
    return (
        <div className="fixed bottom-6 right-6 z-50">
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        size="icon"
                        className="rounded-full w-14 h-14 bg-gradient-to-br from-pink-500 to-orange-400 text-white shadow-lg hover:scale-110 transition-transform"
                    >
                        <Sparkles className="h-6 w-6" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 mb-2" align="end">
                    <div className="grid gap-2">
                        <p className="font-bold text-center mb-1">AI Tools</p>
                        <Button variant="ghost" asChild className="justify-start">
                            <Link href="/admin/developer/ai-tools?tool=assistant">
                                <MessageSquare className="mr-2 h-4 w-4" />
                                AI Assistant
                            </Link>
                        </Button>
                        <Button variant="ghost" asChild className="justify-start">
                             <Link href="/admin/developer/ai-tools?tool=tagger">
                                <Tag className="mr-2 h-4 w-4" />
                                Smart Tagger
                            </Link>
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
};


export default function AdminLayout({ children }: { children: ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isMobile = useIsMobile();
  const { user, hasPermission } = useAuth();
  const router = useRouter();
  const [userLadder, setUserLadder] = useState<Ladder | null>(null);
  const db = getFirebaseFirestore();
  const pathname = usePathname();

  const isDeveloperPage = hasPermission('viewDeveloperTools');
  
  const navLinks = [
    {
      group: "Main",
      items: [
        { href: "/admin/analytics", label: "Analytics", icon: BarChart2, permission: 'viewAnalytics' },
        {
          label: "Users",
          icon: Users,
          permission: 'viewUserManagement',
          subItems: [
            { href: "/admin/users", label: "User Management", icon: Users },
            { href: "/admin/ladders", label: "Ladders", icon: Shield },
            { href: "/admin/speakers", label: "Speakers", icon: UserRound },
            { href: "/admin/promotions", label: "Promotion Requests", icon: UserCheck },
          ],
        },
      ],
    },
    {
      group: "Content",
      items: [
        { href: "/admin/courses", label: "Courses", icon: BookOpen, permission: 'viewCourseManagement' },
        {
          label: "Libraries",
          icon: Folder,
          permission: 'viewContentLibraries',
          subItems: [
            { href: "/admin/content/videos", label: "Videos", icon: Tv },
            { href: "/admin/content/documents", label: "Documents", icon: FileText },
            { href: "/admin/content/images", label: "Images", icon: ImageIcon },
            { href: "/admin/content/music", label: "Music", icon: Music },
            { href: "/admin/content/logos", label: "Logos", icon: Award },
            { href: "/admin/content/certificates", label: "Certificates", icon: Award },
            { href: "/admin/content/documentation", label: "Documentation", icon: BookCopy },
          ],
        },
      ],
    },
    {
      group: "Platform",
      items: [
        { href: "/admin/campus", label: "Campus", icon: Building, permission: 'viewCampusManagement' },
        { href: "/admin/live", label: "Live", icon: Tv, permission: 'viewLiveManagement' },
        {
          label: "Developer",
          icon: Code,
          permission: 'viewDeveloperTools',
          subItems: [
              { href: "/admin/developer/site-settings", label: "Site Settings", icon: Settings },
              { href: "/admin/developer/certificate-builder", label: "Certificate Builder", icon: Award },
              { href: "/admin/developer/ai-tools", label: "AI Tools", icon: Sparkles },
              { href: "/admin/links", label: "Links", icon: Link2 },
              { href: "/admin/permissions", label: "Permissions", icon: Shield, permission: 'viewPermissionsPage' },
          ]
        },
      ],
    },
  ];


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
  
  return (
    <div className="min-h-screen w-full">
      <aside className={cn('fixed inset-y-0 left-0 z-50 flex h-full max-h-screen flex-col w-[220px] lg:w-[280px] bg-background border-r transition-transform duration-300 ease-in-out md:translate-x-0', isMobile && (isSidebarOpen ? 'translate-x-0' : '-translate-x-full'))}>
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
                {group.items.map((item) => (
                  <NavItem key={item.href || item.label} {...item} />
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
            <div className="flex-1">
               {/* Global Search Removed */}
            </div>
            <div className="ml-auto flex items-center gap-2">
                <ThemeToggle />
            </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 bg-muted/40 overflow-auto">
            {children}
             {isDeveloperPage && <AiFab />}
        </main>
      </div>
    </div>
  );
}
