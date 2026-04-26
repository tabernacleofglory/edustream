"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/hooks/use-i18n";
import { useAuth } from "@/hooks/use-auth";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Bot, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { SiteSettings, AutomationSettings } from "@/lib/types";
import { runEnrollmentSync } from "@/lib/automation-actions";

export default function AutomationManagerPage() {
  const { toast } = useToast();
  const { t } = useI18n();
  const { hasPermission } = useAuth();
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRunningManual, setIsRunningManual] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "siteSettings", "main"), (doc) => {
      if (doc.exists()) {
        const data = doc.data() as SiteSettings;
        setSettings(data.automation || {
          enrollmentSyncEnabled: false,
          enrollmentSyncIntervalMinutes: 60,
        });
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleUpdateSettings = async (updates: Partial<AutomationSettings>) => {
    try {
      await updateDoc(doc(db, "siteSettings", "main"), {
        automation: { ...settings, ...updates }
      });
      toast({ title: "Settings updated" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Update failed", description: error.message });
    }
  };

  const handleManualSync = async () => {
    setIsRunningManual(true);
    const result = await runEnrollmentSync();
    if (result.success) {
      toast({ title: "Manual Sync Complete", description: `Updated ${result.updatesCount} enrollments.` });
    } else {
      toast({ variant: "destructive", title: "Manual Sync Failed", description: result.error });
    }
    setIsRunningManual(false);
  };

  if (!hasPermission("manageAutomation")) {
    return <div className="p-8 text-center">Access Denied</div>;
  }

  if (loading) {
    return <div className="p-8 text-center">Loading settings...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-3xl font-bold md:text-4xl">Automation Manager</h1>
        <p className="text-muted-foreground">Manage background bots and automated synchronization tasks.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              <CardTitle>Enrollment Auto-Sync</CardTitle>
            </div>
            <CardDescription>
              Automatically audits and updates enrollment status based on student progress.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Bot</Label>
                <p className="text-xs text-muted-foreground">
                  The system will periodically sync all enrollments.
                </p>
              </div>
              <Switch
                checked={settings?.enrollmentSyncEnabled}
                onCheckedChange={(checked) => handleUpdateSettings({ enrollmentSyncEnabled: checked })}
              />
            </div>

            <div className="space-y-2">
              <Label>Sync Interval</Label>
              <Select
                value={settings?.enrollmentSyncIntervalMinutes?.toString()}
                onValueChange={(val) => handleUpdateSettings({ enrollmentSyncIntervalMinutes: parseInt(val) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select interval" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">Every 5 Minutes</SelectItem>
                  <SelectItem value="15">Every 15 Minutes</SelectItem>
                  <SelectItem value="30">Every 30 Minutes</SelectItem>
                  <SelectItem value="60">Every Hour</SelectItem>
                  <SelectItem value="360">Every 6 Hours</SelectItem>
                  <SelectItem value="1440">Every 24 Hours</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="pt-4 border-t space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Last Run:
                </span>
                <span className="font-medium">
                  {settings?.lastRunAt 
                    ? format(settings.lastRunAt.toDate(), "MMM d, HH:mm:ss")
                    : "Never"}
                </span>
              </div>
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={handleManualSync}
                disabled={isRunningManual}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isRunningManual ? "animate-spin" : ""}`} />
                Run Sync Now
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              <CardTitle>Automation Logs</CardTitle>
            </div>
            <CardDescription>Recent activity from the automation bots.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground italic">
              Detailed logs feature coming soon. Last run recorded at {settings?.lastRunAt ? format(settings.lastRunAt.toDate(), "HH:mm") : "N/A"}.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-muted/50 border rounded-lg p-4 flex gap-3 items-start">
        <Bot className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm space-y-1">
          <p className="font-semibold text-foreground">How it works</p>
          <p className="text-muted-foreground">
            The Automation Runner operates client-side whenever an authorized admin is logged into the platform. 
            It checks the configured interval against the last run time and executes tasks as needed. 
            Multiple concurrent admins are handled via atomic timestamps to prevent redundant runs.
          </p>
        </div>
      </div>
    </div>
  );
}
