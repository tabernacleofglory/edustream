"use client";

import { useState, useEffect } from "react";
import { getFirebaseFirestore } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Lock, Loader2, AlertTriangle, ShieldCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { SiteSettings } from "@/lib/types";

export default function MaintenanceModePage() {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const db = getFirebaseFirestore();
  const [isMaintenanceMode, setIsMaintenanceMode] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const canManageMaintenance = hasPermission("manageMaintenance");

  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      try {
        const docRef = doc(db, "siteSettings", "main");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as SiteSettings;
          setIsMaintenanceMode(!!data.maintenanceModeEnabled);
        }
      } catch (error) {
        console.error("Failed to fetch settings:", error);
        toast({ title: "Error", description: "Failed to load maintenance settings.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };

    if (canManageMaintenance) {
      fetchSettings();
    } else {
      setIsLoading(false);
    }
  }, [db, canManageMaintenance, toast]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const docRef = doc(db, "siteSettings", "main");
      await setDoc(docRef, { maintenanceModeEnabled: isMaintenanceMode }, { merge: true });
      toast({
        title: "Settings Saved",
        description: `Maintenance mode has been ${isMaintenanceMode ? "enabled" : "disabled"}.`,
      });
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast({ title: "Error", description: "Failed to save maintenance settings.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (!canManageMaintenance) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>You do not have the required permissions to manage maintenance mode.</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <Lock className="h-4 w-4" />
            <AlertTitle>Permission Required</AlertTitle>
            <AlertDescription>This section requires the 'Manage Maintenance Mode' permission.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto">
      <div>
        <h1 className="font-headline text-3xl font-bold md:text-4xl flex items-center gap-3">
          <AlertTriangle className="h-8 w-8 text-primary" />
          Maintenance Mode
        </h1>
        <p className="text-muted-foreground mt-2">
          Control platform access during upgrades or emergencies. When enabled, only users with the 'Bypass Maintenance' permission can access the platform.
        </p>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-12 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : (
        <Card className={isMaintenanceMode ? "border-destructive/50" : ""}>
          <CardHeader>
            <CardTitle>Maintenance Settings</CardTitle>
            <CardDescription>
              Toggle the switch below to instantly lock out or allow regular users.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between border p-4 rounded-lg bg-card">
              <div className="space-y-1 pr-6">
                <Label className="text-base font-bold flex items-center gap-2">
                  Enable Maintenance Mode
                  {isMaintenanceMode && <span className="flex h-2 w-2 rounded-full bg-destructive animate-pulse" />}
                </Label>
                <p className="text-sm text-muted-foreground">
                  When active, users will see a "We'll be right back" message and won't be able to log in or use the app unless they have bypass permissions.
                </p>
              </div>
              <Switch
                checked={isMaintenanceMode}
                onCheckedChange={setIsMaintenanceMode}
                className={isMaintenanceMode ? "data-[state=checked]:bg-destructive" : ""}
              />
            </div>

            {isMaintenanceMode && (
              <Alert variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Warning: Platform is currently restricted</AlertTitle>
                <AlertDescription>
                  Make sure you and your team have the <strong>Bypass Maintenance</strong> permission before logging out, otherwise you will be locked out too!
                </AlertDescription>
              </Alert>
            )}

            {!isMaintenanceMode && (
               <Alert className="bg-primary/10 text-primary border-primary/20">
                <ShieldCheck className="h-4 w-4" />
                <AlertTitle>Platform is fully accessible</AlertTitle>
                <AlertDescription>
                  All registered users currently have normal access to the platform.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end pt-4">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
