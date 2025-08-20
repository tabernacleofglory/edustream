
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
           <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            <span className="animate-text-gradient bg-gradient-to-r from-pink-500 via-red-500 to-orange-400 bg-clip-text text-transparent">
                Welcome back, {userName}!
            </span>
           </h1>
          <p className="text-muted-foreground mt-2">
            Let&apos;s continue your learning journey.
          </p>
        </div>
        <UserDashboardClient />
      </div>
    </div>
  );
}
