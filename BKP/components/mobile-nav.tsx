
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BookOpen, Tv, MessageSquare, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/hooks/use-i18n";

interface MobileNavProps {
  onMenuClick?: () => void;
}

export default function MobileNav({ onMenuClick }: MobileNavProps) {
  const pathname = usePathname();
  const { t } = useI18n();

  const navItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: t('nav.dashboard', 'Dashboard') },
    { href: "/courses", icon: BookOpen, label: t('nav.courses', 'Courses') },
    { href: "/live", icon: Tv, label: t('nav.live', 'Live'), isCenter: true },
    { href: "/community", icon: MessageSquare, label: t('nav.community', 'Community') },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 border-t backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-[env(safe-area-inset-bottom,0)]">
      <nav className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground",
                item.isCenter && "relative"
              )}
            >
              {item.isCenter ? (
                <div className="absolute -top-6 bg-primary text-primary-foreground p-3 rounded-xl shadow-lg border-4 border-background transform rotate-45">
                  <item.icon className="-rotate-45 h-6 w-6" />
                </div>
              ) : (
                <item.icon className="h-5 w-5" />
              )}
              {!item.isCenter && <span className="text-[10px] font-medium">{item.label}</span>}
            </Link>
          );
        })}
        <button
          onClick={onMenuClick}
          className="flex flex-col items-center justify-center flex-1 h-full gap-1 text-muted-foreground"
        >
          <Menu className="h-5 w-5" />
          <span className="text-[10px] font-medium">{t('nav.more', 'More')}</span>
        </button>
      </nav>
    </div>
  );
}
