
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import Link from 'next/link';
import { Skeleton } from './ui/skeleton';
import { ArrowRight } from 'lucide-react';

interface Announcement {
    id: string;
    imageUrl: string;
    description: string;
    buttonText: string;
    buttonUrl: string;
    isActive: boolean;
}

const ConditionalLink = ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: any }) => {
    const isExternal = href?.startsWith('http');
    if (isExternal) {
        return (
            <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                {children}
            </a>
        );
    }
    return (
        <Link href={href || ''} {...props}>
            {children}
        </Link>
    );
};


export default function AnnouncementCard() {
    const [announcement, setAnnouncement] = useState<Announcement | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(
            collection(db, 'announcements'),
            where('isActive', '==', true),
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                setAnnouncement({ id: doc.id, ...doc.data() } as Announcement);
            } else {
                setAnnouncement(null);
            }
            setLoading(false);
        }, (error) => {
            console.error("Error fetching announcement:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    if (loading) {
        return <Skeleton className="h-48 w-full" />;
    }

    if (!announcement) {
        return null; // Don't render anything if there's no active announcement
    }

    return (
        <Card className="overflow-hidden">
            <div className="grid md:grid-cols-2">
                <div className="relative h-48 md:h-full min-h-[200px]">
                    <Image
                        src={announcement.imageUrl}
                        alt={announcement.description}
                        fill
                        style={{ objectFit: 'cover' }}
                    />
                </div>
                <div className="p-6 flex flex-col justify-center">
                    <p className="text-lg mb-4">{announcement.description}</p>
                    <ConditionalLink href={announcement.buttonUrl}>
                        <Button>
                            {announcement.buttonText}
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </ConditionalLink>
                </div>
            </div>
        </Card>
    );
}
