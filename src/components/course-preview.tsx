"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Course, Video as VideoType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Lock } from "lucide-react";
import { getFirebaseFirestore } from "@/lib/firebase";
import { collection, query, where, documentId, getDocs } from "firebase/firestore";
import { Skeleton } from "./ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "./ui/dialog";
import CertificatePrint from "./certificate-print";
import { useAuth } from "@/hooks/use-auth";
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface CoursePreviewProps {
  course: Course & { isLocked?: boolean; prerequisiteCourse?: { id: string; title: string } };
  isEnrolled: boolean;
  isCompleted: boolean;
  onEnroll: () => void;
  isLocked?: boolean; // trusted from parent/hook
}

export default function CoursePreview({
  course,
  isEnrolled,
  isCompleted,
  onEnroll,
  isLocked,
}: CoursePreviewProps) {
  const [videos, setVideos] = useState<VideoType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { user } = useAuth();
  const db = getFirebaseFirestore();

  useEffect(() => {
    const fetchVideos = async () => {
      if (!course.videos || course.videos.length === 0) {
        setVideos([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        // Firestore 'in' queries are limited to 10 IDs — chunk the requests
        const ids = course.videos as string[];
        const chunkSize = 10;
        const fetched: Record<string, VideoType> = {};

        for (let i = 0; i < ids.length; i += chunkSize) {
          const slice = ids.slice(i, i + chunkSize);
          const q = query(
            collection(db, "Contents"),
            where(documentId(), "in", slice),
            where("status", "==", "published")
          );
          const snap = await getDocs(q);
          snap.docs.forEach((d) => {
            fetched[d.id] = { id: d.id, ...(d.data() as any) } as VideoType;
          });
        }

        // Preserve the order defined in course.videos
        const ordered = ids
          .map((id) => fetched[id])
          .filter(Boolean) as VideoType[];

        setVideos(ordered);
      } catch (err) {
        console.error("Failed to fetch course videos:", err);
        setVideos([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVideos();
  }, [course.videos, db]);

  const firstVideoId = videos.length > 0 ? videos[0].id : null;

  const handlePrimaryAction = () => {
    if (isEnrolled) {
      if (firstVideoId) {
        router.push(`/courses/${course.id}/video/${firstVideoId}`);
      }
      return;
    }
    // Not enrolled
    onEnroll();
  };

  const PrimaryButton = () => {
    if (isCompleted) {
      return (
        <Dialog>
          <DialogTrigger asChild>
            <Button className="w-full" size="lg">
              View Certificate
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Certificate of Completion</DialogTitle>
              <DialogDescription id="cert-desc">
                Your certificate for completing {course.title}.
              </DialogDescription>
            </DialogHeader>
            <CertificatePrint userName={user?.displayName || "Valued Student"} course={course} />
          </DialogContent>
        </Dialog>
      );
    }

    if (isLocked) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-full">
                <Button disabled className="w-full" size="lg">
                  <Lock className="mr-2 h-4 w-4" />
                  Locked
                </Button>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {course.prerequisiteCourse?.title
                  ? `Complete "${course.prerequisiteCourse.title}" to unlock this course.`
                  : "This course is in a higher ladder and is locked for now."}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <Button
        onClick={handlePrimaryAction}
        className="w-full"
        size="lg"
        disabled={isEnrolled && !firstVideoId}
      >
        {isEnrolled ? "Go to Course" : "Enroll Now"}
      </Button>
    );
  };

  return (
    <div className="grid md:grid-cols-2 max-h-[90vh]">
      <div className="relative h-64 md:h-full hidden md:block">
        <Image
          src={(course as any)["Image ID"] || "https://placehold.co/600x400.png"}
          alt={course.title || "Course thumbnail"}
          fill
          priority
          style={{ objectFit: "cover" }}
          className="rounded-l-lg"
        />
      </div>

      <div className="flex flex-col max-h-[90vh] overflow-hidden">
        <div className="p-6 flex-shrink-0">
          <h2 className="text-2xl font-bold font-headline mb-2">{course.title}</h2>
          <p className="text-muted-foreground mb-4">{course.description}</p>
        </div>

        <ScrollArea className="flex-grow px-6 -mx-6">
          <div className="px-6">
            <h3 className="font-semibold mb-2">Lessons in this course</h3>
            <div className="space-y-2">
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : videos.length > 0 ? (
                <div className="space-y-2">
                  {videos.map((video, index) => (
                    <Link
                      key={video.id}
                      href={
                        isEnrolled && video.id
                          ? `/courses/${course.id}/video/${video.id}`
                          : "#"
                      }
                      className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${
                        isEnrolled ? "hover:bg-muted cursor-pointer" : "cursor-default"
                      }`}
                    >
                      <span className="text-lg font-bold text-muted-foreground">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <p className="font-semibold">{video.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {Math.round(((video as any).duration ?? 0) / 60)} min
                        </p>
                      </div>
                      {!isEnrolled && <Lock className="h-5 w-5 text-muted-foreground" />}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No lessons available yet.</p>
              )}
            </div>
          </div>
        </ScrollArea>

        <div className="p-6 pt-6 border-t mt-auto flex-shrink-0">
          <PrimaryButton />
        </div>
      </div>
    </div>
  );
}
