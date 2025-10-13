"use client";

import PermissionManager from "@/components/permission-manager";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Lock } from "lucide-react";

export default function PermissionsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect non-developers away from this page
  useEffect(() => {
    if (!loading && user && user.role !== "developer") {
      router.push("/admin/analytics");
    }
  }, [user, loading, router]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user || user.role !== "developer") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>
            Only developers can manage site permissions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <Lock className="h-4 w-4" />
            <AlertTitle>Access Restricted</AlertTitle>
            <AlertDescription>
              You must be signed in as a developer to access this page.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold md:text-4xl">
          Permission Management
        </h1>
        <p className="text-muted-foreground">
          Define which roles may use each permission. (Developer-only)
        </p>
      </div>
      <PermissionManager />
    </div>
  );
}
