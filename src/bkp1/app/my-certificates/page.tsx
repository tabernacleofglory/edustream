
"use client";

import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useProcessedCourses } from '@/hooks/useProcessedCourses';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Award, Download, Eye, Linkedin, Share2, Link as LinkIcon, Lock, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import CertificatePrint from '@/components/certificate-print';
import { CourseWithStatus } from '@/hooks/useProcessedCourses';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';

const CertificateCard = ({ course }: { course: CourseWithStatus }) => {
    const { user } = useAuth();
    const { toast } = useToast();
    
    const handleShareLinkedIn = () => {
        const certUrl = `${window.location.origin}/certificate/${course.id}`;
        const issueDate = course.completedAt ? new Date(course.completedAt) : new Date();
        const issueYear = issueDate.getFullYear();
        const issueMonth = issueDate.getMonth() + 1;
        
        const linkedInUrl = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(course.title)}&organizationName=${encodeURIComponent("Glory Training Hub")}&issueYear=${issueYear}&issueMonth=${issueMonth}&certUrl=${encodeURIComponent(certUrl)}`;
        window.open(linkedInUrl, '_blank');
    };
    
    const handleCopyLink = () => {
        const certUrl = `${window.location.origin}/certificate/${course.id}`;
        navigator.clipboard.writeText(certUrl);
        toast({ title: 'Link Copied!', description: 'The public link to your certificate has been copied.' });
    };

    return (
        <Card className="flex flex-col">
            <CardHeader>
                <div className="relative aspect-[11/8.5] w-full bg-muted rounded-md overflow-hidden">
                    {course.certificateTemplateUrl ? (
                         <Image src={course.certificateTemplateUrl} alt={`Certificate for ${course.title}`} fill style={{objectFit:"cover"}} />
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <Award className="h-16 w-16 text-muted-foreground" />
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent className="flex-grow">
                <CardTitle className="text-lg">{course.title}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                    Earned on {course.completedAt ? format(new Date(course.completedAt), 'PPP') : 'N/A'}
                </p>
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row gap-2">
                 <Dialog>
                    <DialogTrigger asChild>
                       <Button className="w-full">
                            <Eye className="mr-2 h-4 w-4" /> View
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl">
                        <DialogHeader>
                            <DialogTitle>Certificate of Completion</DialogTitle>
                        </DialogHeader>
                        <CertificatePrint userName={user?.displayName || "Student"} course={course} />
                    </DialogContent>
                 </Dialog>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full">
                            <Share2 className="mr-2 h-4 w-4" /> Share
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onClick={handleShareLinkedIn}>
                            <Linkedin className="mr-2 h-4 w-4" />
                            Share on LinkedIn
                        </DropdownMenuItem>
                         <DropdownMenuItem onClick={handleCopyLink}>
                            <LinkIcon className="mr-2 h-4 w-4" />
                            Copy Link
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </CardFooter>
        </Card>
    );
};

const LoadingSkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index}>
                <CardHeader>
                    <Skeleton className="aspect-[11/8.5] w-full" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                </CardContent>
                 <CardFooter className="gap-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                 </CardFooter>
            </Card>
        ))}
    </div>
);


export default function MyCertificatesPage() {
    const { user, loading: authLoading, hasPermission } = useAuth();
    const { processedCourses, loading: coursesLoading } = useProcessedCourses(true);

    const canViewPage = hasPermission('viewDashboard'); // Assuming same permission as dashboard
    const loading = authLoading || coursesLoading;

    const completedCourses = useMemo(() => {
        return processedCourses.filter(course => course.isCompleted);
    }, [processedCourses]);
    
    if (authLoading) {
        return <LoadingSkeleton />;
    }

    if (!user) {
        return (
             <Alert variant="destructive">
                <Lock className="h-4 w-4" />
                <AlertTitle>Access Denied</AlertTitle>
                <AlertDescription>You must be logged in to view your certificates.</AlertDescription>
            </Alert>
        )
    }

    return (
        <div className="container mx-auto py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold font-headline">My Certificates</h1>
                <p className="text-muted-foreground">A collection of all your earned certificates.</p>
            </div>

            {loading ? (
                <LoadingSkeleton />
            ) : completedCourses.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {completedCourses.map(course => (
                        <CertificateCard key={course.id} course={course} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-20 bg-muted rounded-lg">
                    <Award className="mx-auto h-16 w-16 text-muted-foreground" />
                    <h3 className="mt-4 text-xl font-semibold">No Certificates Yet</h3>
                    <p className="mt-1 text-muted-foreground">Complete a course to earn your first certificate.</p>
                    <Button asChild className="mt-6">
                        <Link href="/courses">
                            Explore Courses <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </div>
            )}
        </div>
    );
}
