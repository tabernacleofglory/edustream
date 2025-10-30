
'use client';

import React from 'react';
import type { Course } from '@/lib/types';
import CertificatePrint from '@/components/certificate-print';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';

interface CertificatePageClientProps {
  course: Course;
}

export default function CertificatePageClient({ course }: CertificatePageClientProps) {
    const { user, loading } = useAuth();

    if (loading) {
        return <Skeleton className="w-full aspect-[11/8.5]" />;
    }

    if (!user) {
        return <p>Please log in to view your certificate.</p>
    }
    
    return (
        <CertificatePrint userName={user.displayName || "Student"} course={course} />
    );
}
