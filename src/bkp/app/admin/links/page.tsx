
import LinkManager from "@/components/link-manager";

export default function LinksPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold md:text-4xl">
          Link Management
        </h1>
        <p className="text-muted-foreground">
          Add, view, and manage main navigation links.
        </p>
      </div>
      <LinkManager />
    </div>
  );
}
