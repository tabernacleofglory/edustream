
"use client";

import CourseCreditManager from "@/components/course-credit-manager";

export default function CourseCreditPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold md:text-4xl">
          Course Credit
        </h1>
        <p className="text-muted-foreground">
          Manually grant full or partial course credit to users.
        </p>
      </div>
      <CourseCreditManager />
    </div>
  );
}
