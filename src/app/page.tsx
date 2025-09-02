
"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Users, Video, LayoutDashboard, Settings, Shield, LogOut, Menu } from "lucide-react";
import { getSiteSettings } from "@/lib/data";
import { useEffect, useState } from "react";
import DynamicIcon from "@/components/dynamic-icon";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { NavLink } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { signOut } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { Sheet, SheetContent, SheetHeader, SheetTrigger } from "@/components/ui/sheet";
import { DialogTitle, DialogDescription } from "@/components/ui/dialog";


type SiteSettings = Awaited<ReturnType<typeof getSiteSettings>>;

const FeatureCard = ({ icon, title, description }: { icon: string; title: string; description: string }) => (
  <div className="bg-white/5 p-6 rounded-lg backdrop-blur-sm border border-white/10">
    <div className="text-primary mb-4"><DynamicIcon name={icon} size={32} /></div>
    <h3 className="text-xl font-bold mb-2">{title}</h3>
    <p className="text-muted-foreground">{description}</p>
  </div>
);

const ConditionalLink = ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: any }) => {
    const isExternal = href?.startsWith('http');
    if (isExternal) {
        return (
            <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                {children}
            </a>
        );
    }
    return (
        <Link href={href || ''} {...props}>
            {children}
        </Link>
    );
};

const getInitials = (name?: string | null) => {
    if (!name) return "U";
    const names = name.split(" ");
    return names.map(n => n[0]).join("").toUpperCase();
};


export default function Home() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [navLinks, setNavLinks] = useState<NavLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(true);
  const { user, loading: authLoading, isCurrentUserAdmin } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut(getFirebaseAuth());
    router.push('/');
  }

  useEffect(() => {
    getSiteSettings().then(setSettings);
    
    const fetchLinks = async () => {
      try {
        const q = query(collection(db, "navLinks"), orderBy("order"), limit(10));
        const querySnapshot = await getDocs(q);
        const links = querySnapshot.docs.map(doc => doc.data() as NavLink);
        setNavLinks(links);
      } catch (error) {
        console.error("Error fetching nav links: ", error);
      } finally {
        setLinksLoading(false);
      }
    };
    fetchLinks();
  }, []);

  return (
    <div className="dark min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
        <div className="absolute inset-0 z-0">
            {settings?.homepageBackgroundImageUrl && (
                <Image 
                    src={settings.homepageBackgroundImageUrl}
                    alt="Homepage background"
                    fill
                    priority
                    style={{objectFit:"cover"}}
                    className="opacity-20"
                />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent" />
        </div>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-transparent backdrop-blur-sm">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center py-4">
          <div className="flex items-center gap-2">
            <div className="md:hidden">
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <Menu className="h-6 w-6" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left">
                        <SheetHeader>
                            <DialogTitle className="sr-only">Menu</DialogTitle>
                            <DialogDescription className="sr-only">Main navigation menu</DialogDescription>
                        </SheetHeader>
                         <div className="flex flex-col space-y-4 mt-8">
                            {navLinks.map((link) => (
                                <ConditionalLink key={link.url} href={link.url} className="text-lg font-medium text-foreground hover:text-primary transition-colors">
                                    {link.title}
                                </ConditionalLink>
                            ))}
                         </div>
                    </SheetContent>
                </Sheet>
            </div>
            <Logo />
          </div>
          <nav className="hidden md:flex items-center space-x-4">
              {linksLoading ? (
                  Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6 w-20 bg-white/10" />)
              ) : (
                  navLinks.map((link) => (
                    <ConditionalLink
                      key={link.url}
                      href={link.url}
                      className="hover:text-primary transition-colors text-white/80"
                    >
                      {link.title}
                    </ConditionalLink>
                ))
              )}
             {authLoading ? <Skeleton className="h-9 w-24 bg-white/10" /> : user ? (
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
                                <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
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
                        {isCurrentUserAdmin && (
                            <DropdownMenuItem asChild>
                                <Link href="/admin/analytics">
                                    <Shield className="mr-2 h-4 w-4" />
                                    <span>Admin Panel</span>
                                </Link>
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleSignOut}>
                             <LogOut className="mr-2 h-4 w-4" />
                             <span>Log out</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                 </DropdownMenu>
             ) : (
                <>
                    <ConditionalLink href="/login" className="hover:text-primary transition-colors text-white/80">Sign In</ConditionalLink>
                    <Button asChild><ConditionalLink href="/signup">Get Started</ConditionalLink></Button>
                </>
             )}
          </nav>
          <div className="md:hidden">
             {authLoading ? <Skeleton className="h-9 w-9 rounded-full bg-white/10" /> : user ? (
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
                                <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
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
                        {isCurrentUserAdmin && (
                            <DropdownMenuItem asChild>
                                <Link href="/admin/analytics">
                                    <Shield className="mr-2 h-4 w-4" />
                                    <span>Admin Panel</span>
                                </Link>
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleSignOut}>
                             <LogOut className="mr-2 h-4 w-4" />
                             <span>Log out</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                 </DropdownMenu>
             ) : (
                <Button asChild variant="ghost"><Link href="/login">Sign In</Link></Button>
             )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10">
        {/* Hero Section */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center justify-center text-center min-h-[calc(100vh-15rem)] py-12">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-4">
                    {settings?.homepageTitle || "Unlock Your Potential."}
                    </h1>
                    <p className="max-w-2xl mx-auto text-lg sm:text-xl text-muted-foreground mb-8">
                    {settings?.homepageSubtitle || "Join Glory Training Hub for world-class training and resources to help you grow in your faith and leadership."}
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Button size="lg" asChild className="w-full sm:w-auto text-base sm:text-sm">
                        <ConditionalLink href={settings?.enrollButtonLink || "/signup"}>
                        {settings?.enrollButtonText || "Start Your Journey"} <ArrowRight className="ml-2 h-5 w-5" />
                        </ConditionalLink>
                    </Button>
                    <Button size="lg" variant="outline" asChild className="w-full sm:w-auto text-base sm:text-sm">
                        <ConditionalLink href={settings?.exploreButtonLink || "/courses"}>
                        {settings?.exploreButtonText || "Explore Courses"}
                        </ConditionalLink>
                    </Button>
                    </div>
                </motion.div>
            </div>
        </div>

        {/* Features Section */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">{settings?.featuresTitle || "Why Choose Us?"}</h2>
            <p className="text-muted-foreground">{settings?.featuresSubtitle || "Everything you need for your spiritual growth."}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={settings?.feature1Icon || 'BookOpen'}
              title={settings?.feature1Title || "Expert-Led Courses"}
              description={settings?.feature1Description || "Learn from experienced pastors and leaders on a variety of biblical topics."}
            />
            <FeatureCard
              icon={settings?.feature2Icon || 'Users'}
              title={settings?.feature2Title || "Community"}
              description={settings?.feature2Description || "Connect with a global community of believers and grow together."}
            />
            <FeatureCard
              icon={settings?.feature3Icon || 'Video'}
              title={settings?.feature3Title || "On-Demand Video"}
              description={settings?.feature3Description || "Access our extensive library of video resources anytime, anywhere."}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 relative z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-muted-foreground">
          &copy; {new Date().getFullYear()} {settings?.websiteName || "Glory Training Hub"}. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
