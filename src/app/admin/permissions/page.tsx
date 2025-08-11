
"use client";

import PermissionManager from "@/components/permission-manager";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Lock } from "lucide-react";

export default function PermissionsPage() {
  const { user, loading, hasPermission } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !hasPermission('managePermissions')) {
      router.push('/admin/analytics');
    }
  }, [user, loading, router, hasPermission]);
  
  if (loading) {
    return <div>Loading...</div>;
  }

  if (!hasPermission('managePermissions')) {
     return (
        <Card>
            <CardHeader>
                <CardTitle>Access Denied</CardTitle>
                <CardDescription>
                    You do not have the required permissions to view this page.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Alert variant="destructive">
                    <Lock className="h-4 w-4" />
                    <AlertTitle>Access Restricted</AlertTitle>
                    <AlertDescription>
                        Please contact a site administrator if you believe you should have access.
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold md:text-4xl">
          Permission Management
        </h1>
        <p className="text-muted-foreground">
          Configure permissions for different user roles.
        </p>
      </div>
      <PermissionManager />
    </div>
  );
}
