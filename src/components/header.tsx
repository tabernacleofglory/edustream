
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu, User, Shield } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
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
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { NavLink } from "@/lib/types";
import { Skeleton } from "./ui/skeleton";

export function Header() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [navLinks, setNavLinks] = useState<NavLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(true);

  useEffect(() => {
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

  const handleSignOut = async () => {
    try {
      await signOut(getFirebaseAuth());
      toast({ title: "Signed Out", description: "You have been successfully signed out." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to sign out." });
    }
  };

  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    const names = name.split(" ");
    return names.map(n => n[0]).join("").toUpperCase();
  };

  const mainLinks = [
    { href: "/courses", label: "Courses" },
    { href: "/live", label: "Live" },
    { href: "/music", label: "Music" },
  ];
  
  const allLinks = [...mainLinks, ...navLinks.map(l => ({ href: l.url, label: l.title }))];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 hidden md:flex">
          <Logo />
          <nav className="flex items-center space-x-6 text-sm font-medium ml-6">
            {linksLoading ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6 w-20" />)
            ) : (
                allLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`transition-colors hover:text-foreground/80 ${
                  pathname === link.href ? "text-foreground" : "text-foreground/60"
                }`}
              >
                {link.label}
              </Link>
            )))}
          </nav>
        </div>

        <div className="md:hidden flex items-center gap-2">
            <Sheet>
            <SheetTrigger asChild>
                <Button
                variant="ghost"
                className="px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                >
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle Menu</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="pr-0">
                <SheetHeader className="p-2 text-left">
                  <SheetTitle className="sr-only">Mobile Navigation Menu</SheetTitle>
                  <Logo />
                </SheetHeader>
                <div className="my-4 h-[calc(100vh-8rem)] pb-10 pl-6">
                <div className="flex flex-col space-y-3">
                    {allLinks.map((link) => (
                    <Link
                        key={link.href}
                        href={link.href}
                        className="text-muted-foreground"
                    >
                        {link.label}
                    </Link>
                    ))}
                </div>
                </div>
            </SheetContent>
            </Sheet>
             <div className="md:hidden">
                <Logo />
            </div>
        </div>
        
        <div className="flex flex-1 items-center justify-end space-x-2">
          {loading ? (
             <Skeleton className="h-8 w-8 rounded-full" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.photoURL || undefined} alt={user.displayName || ""} />
                  <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{user.displayName}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard">Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">Settings</Link>
                </DropdownMenuItem>
                {(user.role === 'admin' || user.role === 'developer') && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/admin/analytics">
                        <Shield className="mr-2 h-4 w-4" />
                        Admin Panel
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild>
              <Link href="/login">Sign In</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
