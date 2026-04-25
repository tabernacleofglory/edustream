
"use client";

import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Course } from "@/lib/types";
import { Button } from "./ui/button";
import { Eye } from "lucide-react";
import { first } from "cypress/types/lodash";

interface TeachingCardProps {
  course: Course;
}

export function TeachingCard({ course }: TeachingCardProps) {
    const firstVideoId = Array.isArray(course.videos) && course.videos.length > 0 ? course.videos[0] : null;

    return (
        <Card className="h-full overflow-hidden transition-all duration-300 hover:shadow-lg flex flex-col">
            <CardHeader className="p-0">
                <div className="relative h-48 w-full">
                <Image
                    src={(course as any)["Image ID"] || "https://placehold.co/600x400.png"}
                    alt={course.title || "Course thumbnail"}
                    fill
                    style={{ objectFit: "cover" }}
                />
                </div>
            </CardHeader>
            <CardContent className="p-4 flex-grow">
                 <div className="flex flex-wrap gap-1 mb-2">
                    {(Array.isArray(course.Category) ? course.Category : [course.Category]).filter(Boolean).map((category, i) => (
                    <Badge key={`${category}-${i}`} variant="secondary">
                        {category}
                    </Badge>
                    ))}
                </div>
                <CardTitle className="mb-2 text-lg font-headline">
                    {course.title}
                </CardTitle>
            </CardContent>
             <CardFooter className="p-4 pt-0">
                {firstVideoId ? (
                    <Button asChild className="w-full" variant="outline">
                        <Link href={`/admin/courses/player?courseId=${course.id}&videoId=${firstVideoId}`}>
                             <Eye className="mr-2 h-4 w-4" /> View Course
                        </Link>
                    </Button>
                ) : (
                     <Button className="w-full" variant="outline" disabled>
                        No videos available
                    </Button>
                )}
            </CardFooter>
        </Card>
    );
}
