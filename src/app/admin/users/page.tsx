
"use client";

import UserManagement from "@/components/user-management";
import { useI18n } from "@/hooks/use-i18n";

export default function UserManagementPage() {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold md:text-4xl">
          {t('admin.users.title', "User Management")}
        </h1>
        <p className="text-muted-foreground">
          {t('admin.users.description', "View, edit, and manage user roles, permissions, and details.")}
        </p>
      </div>
      <UserManagement />
    </div>
  );
}
