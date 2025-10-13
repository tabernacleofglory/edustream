
"use client";

import { useAuth } from "@/hooks/use-auth";
import { useProcessedCourses } from "@/hooks/useProcessedCourses";
import { CourseCard } from "./course-card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import Link from "next/link";
import { Button } from "./ui/button";
import { ArrowRight } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const RecommendationsLoading = () => (
  <CarouselContent>
    {Array.from({ length: 3 }).map((_, index) => (
      <CarouselItem key={index} className="basis-full md:basis-1/2 lg:basis-1/3">
        <div className="p-1">
          <Card>
            <CardHeader className="p-0">
              <Skeleton className="h-48 w-full" />
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
        </div>
      </CarouselItem>
    ))}
  </CarouselContent>
);

export default function HomepageClient() {
  const { user, loading: authLoading } = useAuth();
  const { processedCourses, loading: coursesLoading, refresh } = useProcessedCourses();
  const isMobile = useIsMobile();

  const coursesToDisplay = processedCourses.filter(p => !p.isCompleted);

  if (authLoading) {
    return (
      <section id="courses" className="container mx-auto py-12 md:py-16">
        <Skeleton className="h-8 w-1/3 mx-auto mb-2" />
        <Skeleton className="h-4 w-1/2 mx-auto mb-8" />
        <div className="w-full">
            <Carousel opts={{ align: "start" }}>
                <RecommendationsLoading />
            </Carousel>
        </div>
      </section>
    )
  }

  if (!user) {
    return (
      <section id="courses" className="py-12 md:py-16 text-center">
        <h2 className="font-headline text-3xl font-bold md:text-4xl">Explore Our Courses</h2>
        <p className="text-muted-foreground mt-2 mb-8">Find the perfect course to advance your skills and knowledge.</p>
        <Button asChild>
          <Link href="/courses">
            View All Courses <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </section>
    );
  }

  return (
    <section id="courses" className="container mx-auto py-12 md:py-16">
      <div className="flex justify-between items-center mb-8">
        <div>
            <h2 className="font-headline text-3xl font-bold md:text-4xl">Your Next Steps</h2>
            <p className="text-muted-foreground mt-2">
                Continue your learning journey with these recommended courses.
            </p>
        </div>
         <Button asChild variant="outline">
          <Link href="/courses">
            View All <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      {coursesLoading ? (
        <Carousel opts={{ align: "start" }} className="w-full">
            <RecommendationsLoading />
        </Carousel>
      ) : coursesToDisplay.length > 0 ? (
        isMobile ? (
          <div className="grid grid-cols-1 gap-4">
            {coursesToDisplay.slice(0, 3).map(course => (
              <CourseCard key={course.id} course={course} onUnenroll={refresh} />
            ))}
          </div>
        ) : (
          <Carousel opts={{ align: "start", loop: coursesToDisplay.length > 3 }} className="w-full">
            <CarouselContent>
              {coursesToDisplay.map(course => (
                <CarouselItem key={course.id} className="basis-full md:basis-1/2 lg:basis-1/3">
                  <div className="p-1">
                    <CourseCard course={course} onUnenroll={refresh} />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden sm:flex" />
            <CarouselNext className="hidden sm:flex"/>
          </Carousel>
        )
      ) : (
        <p className="text-muted-foreground text-center py-8">You've completed all available courses for your level!</p>
      )}
    </section>
  );
}
