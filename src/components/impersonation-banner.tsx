
"use client";

import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { UserCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Displayed at the top of every page while an admin is impersonating a student.
 * Kept intentionally simple and read-only — admins cannot write data as the student.
 */
export function ImpersonationBanner() {
  const { isImpersonating, user, stopImpersonation } = useAuth();

  if (!isImpersonating || !user) return null;

  return (
    <div
      className={cn(
        "w-full z-[9999] flex items-center justify-between gap-4",
        "bg-amber-500 text-amber-950 px-4 py-2 text-sm font-medium",
        "sticky top-0"
      )}
    >
      <div className="flex items-center gap-2">
        <UserCheck className="h-4 w-4 shrink-0" />
        <span>
          Viewing as{" "}
          <strong>{user.displayName || user.email}</strong>
          {user.email && user.displayName ? ` (${user.email})` : ""}
          {" "}— Read-only view
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="border-amber-800 bg-transparent text-amber-950 hover:bg-amber-600 hover:text-amber-950 shrink-0"
        onClick={stopImpersonation}
      >
        <X className="mr-1.5 h-3.5 w-3.5" />
        Exit Student View
      </Button>
    </div>
  );
}
