
"use client";

import { useState, useEffect } from 'react';
import type { User, Ladder } from '@/lib/types';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from './ui/card';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Progress } from './ui/progress';
import { Skeleton } from './ui/skeleton';
import { useProcessedCourses } from '@/hooks/useProcessedCourses';
import { Award } from 'lucide-react';

interface UserProfileSidebarProps {
    user: User;
}

const getInitials = (name?: string | null) => {
    if (!name) return "U";
    const names = name.split(" ");
    return names.map((n) => n[0]).join("").toUpperCase();
};

export default function UserProfileSidebar({ user }: UserProfileSidebarProps) {
    const { allLadders, processedCourses, loading } = useProcessedCourses();
    const [ladderProgress, setLadderProgress] = useState<{
        currentLadder: Ladder | null,
        completedCourses: number,
        totalCourses: number,
        progress: number,
    } | null>(null);

    useEffect(() => {
        if (!loading && user.classLadderId && allLadders.length > 0 && processedCourses.length > 0) {
            const currentLadder = allLadders.find(l => l.id === user.classLadderId) || null;
            if (currentLadder) {
                const coursesInLadder = processedCourses.filter(c => c.ladderIds?.includes(currentLadder.id));
                const completedInLadder = coursesInLadder.filter(c => c.isCompleted).length;
                const totalInLadder = coursesInLadder.length;
                const progress = totalInLadder > 0 ? Math.round((completedInLadder / totalInLadder) * 100) : 0;
                
                setLadderProgress({
                    currentLadder,
                    completedCourses: completedInLadder,
                    totalCourses: totalInLadder,
                    progress
                });
            }
        }
    }, [user, allLadders, processedCourses, loading]);


    return (
        <Card>
            <CardHeader className="items-center text-center">
                 <Avatar className="h-20 w-20 mb-2">
                    <AvatarImage src={user.photoURL || undefined} />
                    <AvatarFallback className="text-3xl">{getInitials(user.displayName)}</AvatarFallback>
                </Avatar>
                <CardTitle>{user.displayName}</CardTitle>
                <CardDescription>{ladderProgress?.currentLadder?.name || user.role}</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="space-y-4">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-2 w-full" />
                        <Skeleton className="h-4 w-1/2" />
                    </div>
                ) : ladderProgress ? (
                     <div className="space-y-2 text-center">
                        <p className="text-sm font-medium">Ladder Progress</p>
                        <Progress value={ladderProgress.progress} className="w-full h-2" />
                        <p className="text-xs text-muted-foreground">
                            {ladderProgress.completedCourses} of {ladderProgress.totalCourses} courses completed
                        </p>
                    </div>
                ) : (
                    <div className="text-center text-sm text-muted-foreground p-4">
                        <Award className="mx-auto h-8 w-8 mb-2" />
                        <p>No progress to show.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
