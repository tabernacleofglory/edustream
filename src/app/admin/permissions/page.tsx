<<<<<<< HEAD

=======
>>>>>>> 7a833b1 (Set up Firebase Admin and environment variables for Vercel)
"use client";

import PermissionManager from "@/components/permission-manager";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Lock } from "lucide-react";

export default function PermissionsPage() {
<<<<<<< HEAD
  const { user, loading, hasPermission } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !hasPermission('managePermissions')) {
      router.push('/admin/analytics');
    }
  }, [user, loading, router, hasPermission]);
  
=======
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect non-developers away from this page
  useEffect(() => {
    if (!loading && user && user.role !== "developer") {
      router.push("/admin/analytics");
    }
  }, [user, loading, router]);

>>>>>>> 7a833b1 (Set up Firebase Admin and environment variables for Vercel)
  if (loading) {
    return <div>Loading...</div>;
  }

<<<<<<< HEAD
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
=======
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
>>>>>>> 7a833b1 (Set up Firebase Admin and environment variables for Vercel)
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold md:text-4xl">
          Permission Management
        </h1>
        <p className="text-muted-foreground">
<<<<<<< HEAD
          Configure permissions for different user roles.
=======
          Define which roles may use each permission. (Developer-only)
>>>>>>> 7a833b1 (Set up Firebase Admin and environment variables for Vercel)
        </p>
      </div>
      <PermissionManager />
    </div>
  );
}
