
"use client";

import UserDashboardClient from "@/components/user-dashboard-client";
import { useAuth } from "@/hooks/use-auth";

export default function DashboardPage() {
  const { user } = useAuth();
  
  const userName = user?.displayName?.split(" ")[0] || "there";

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-8 py-8">
        <div>
          <h1 className="font-headline text-3xl font-bold md:text-4xl">
            Welcome back, {userName}!
          </h1>
          <p className="text-muted-foreground">
            Let&apos;s continue your learning journey.
          </p>
        </div>
        <UserDashboardClient />
      </div>
    </div>
  );
}
