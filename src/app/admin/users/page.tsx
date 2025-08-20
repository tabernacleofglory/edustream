import UserManagement from "@/components/user-management";

export default function UserManagementPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold md:text-4xl">
          User Management
        </h1>
        <p className="text-muted-foreground">
          View, edit, and manage user roles and permissions.
        </p>
      </div>
      <UserManagement />
    </div>
  );
}
