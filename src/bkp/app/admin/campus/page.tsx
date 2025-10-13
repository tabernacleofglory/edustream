
import CampusManagement from "@/components/campus-management";

export default function AdminCampusPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold md:text-4xl">
          Campus Management
        </h1>
        <p className="text-muted-foreground">
          Add, view, and manage campus locations.
        </p>
      </div>
      <CampusManagement />
    </div>
  );
}
