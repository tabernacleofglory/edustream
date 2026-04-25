
'use client';

import React from 'react';
import type { Course, CourseGroup, SiteSettings } from '@/lib/types';
import CertificatePrint from '@/components/certificate-print';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';

interface CertificatePageClientProps {
  course: Course;
  courseGroup?: CourseGroup | null;
  settings: SiteSettings | null;
  completionDate: string | null;
}

export default function CertificatePageClient({ course, courseGroup, settings, completionDate }: CertificatePageClientProps) {
    const { user, loading } = useAuth();

    if (loading) {
        return <Skeleton className="w-full aspect-[11/8.5]" />;
    }

    if (!user) {
        return <p>Please log in to view your certificate.</p>
    }
    
    // Determine which template and logo to use. Group takes precedence.
    const certificateTemplateUrl = courseGroup?.certificateTemplateUrl || course.certificateTemplateUrl;
    const logoUrl = course.logoUrl; // Logo seems to always come from the course for now
    
    // Determine the title for the certificate.
    const certificateTitle = courseGroup ? courseGroup.title : course.title;

    return (
        <CertificatePrint 
            userName={user.displayName || "Student"} 
            course={{...course, title: certificateTitle}} // Pass the correct title
            completionDate={completionDate}
            templateUrl={certificateTemplateUrl}
            logoUrl={logoUrl}
            settings={settings}
        />
    );
}
