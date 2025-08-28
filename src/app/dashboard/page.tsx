"use client";

import { useMemo } from "react";
import UserDashboardClient from "@/components/user-dashboard-client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();

  // Safer first name extraction (handles extra spaces and one-word names)
  const userName = useMemo(() => {
    const name = user?.displayName?.trim() ?? "";
    if (!name) return "";
    const parts = name.split(/\s+/).filter(Boolean);
    return parts[0] || "";
  }, [user?.displayName]);

  if (authLoading) {
    // Simple skeleton so the header doesn’t flicker "there"
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 py-8">
          <div>
            <Skeleton className="h-10 w-72 mb-2" />
            <Skeleton className="h-5 w-64" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    );
  }

  // Guest view (not signed in)
  if (!user) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 py-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
              <span className="animate-text-gradient bg-gradient-to-r from-pink-500 via-red-500 to-orange-400 bg-clip-text text-transparent">
                Welcome!
              </span>
            </h1>
            <p className="text-muted-foreground mt-2">
              Sign in to pick up where you left off.
            </p>
          </div>
          <div>
            <Button asChild size="lg" className="bg-gradient-to-r from-pink-500 to-orange-400 hover:from-pink-600 hover:to-orange-500">
              <Link href="/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated view
  const greetingName = userName || "friend";

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-8 py-8">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            <span className="animate-text-gradient bg-gradient-to-r from-pink-500 via-red-500 to-orange-400 bg-clip-text text-transparent">
              Welcome back, {greetingName}!
            </span>
          </h1>
          <p className="text-muted-foreground mt-2">
            Let&apos;s continue your learning journey.
          </p>
        </div>

        {/* User-specific dashboard content */}
        <UserDashboardClient />
      </div>
    </div>
  );
}
