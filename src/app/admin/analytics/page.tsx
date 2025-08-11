
"use client";

import AnalyticsDashboard from "@/components/analytics-dashboard";
import { useAuth } from "@/hooks/use-auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Lock } from "lucide-react";

export default function AnalyticsPage() {
  const { hasPermission, loading } = useAuth();
  
  if (loading) {
    return <div>Loading...</div>
  }
  
  if (!hasPermission('viewAnalytics')) {
    return (
        <Alert variant="destructive">
            <Lock className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>You do not have permission to view this page.</AlertDescription>
        </Alert>
    );
  }

  return (
    <div className="py-8">
      <div className="flex flex-col gap-8 px-4">
        <div>
          <h1 className="font-headline text-3xl font-bold md:text-4xl">
            Analytics Console
          </h1>
          <p className="text-muted-foreground">
            Insights into user engagement, course performance, and social interaction.
          </p>
        </div>
        <AnalyticsDashboard />
      </div>
    </div>
  );
}
