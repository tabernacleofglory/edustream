
import CustomFieldManagement from "@/components/custom-field-management";

export default function AdminCustomFieldsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold md:text-4xl">
          Custom Field Management
        </h1>
        <p className="text-muted-foreground">
          Create reusable groups of options (sub-fields) for your forms.
        </p>
      </div>
      <CustomFieldManagement />
    </div>
  );
}
