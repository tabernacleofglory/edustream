
"use client";

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { LiveEvent } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Tv, Eye, Lock } from 'lucide-react';
import { format } from 'date-fns';
import Image from 'next/image';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function LiveEventsPage() {
    const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
    const [upcomingEvents, setUpcomingEvents] = useState<LiveEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const { hasPermission, loading: authLoading } = useAuth();
    const router = useRouter();

    const canViewPage = hasPermission('viewLivePage');

    useEffect(() => {
        if (authLoading) return;
        if (!canViewPage) {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, 'liveEvents'), 
            where('status', 'in', ['live', 'upcoming'])
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const events = snapshot.docs.map(doc => {
                const data = doc.data();
                return { 
                    id: doc.id, 
                    ...data,
                    startTime: data.startTime instanceof Timestamp ? data.startTime.toDate().toISOString() : data.startTime,
                } as LiveEvent
            });
            
            const sortedEvents = events.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

            setLiveEvents(sortedEvents.filter(e => e.status === 'live'));
            setUpcomingEvents(sortedEvents.filter(e => e.status === 'upcoming'));
            setLoading(false);
        });

        return () => unsubscribe();
    }, [canViewPage, authLoading]);

    const handleJoinEvent = (event: LiveEvent) => {
        if (!event.gloryLiveRoomId) return;
        router.push(`/live/${event.gloryLiveRoomId}`);
    };

    const EventCard = ({ event }: { event: LiveEvent }) => (
        <Card>
            <CardHeader>
                {event.imageUrl && (
                    <div className="relative aspect-video w-full mb-4">
                        <Image src={event.imageUrl} alt={event.title} fill style={{objectFit:"cover"}} className="rounded-t-lg" />
                    </div>
                )}
                <div className="flex justify-between items-center">
                    <CardTitle>{event.title}</CardTitle>
                    <Badge variant={event.status === 'live' ? 'destructive' : 'default'} className="capitalize">
                        <Tv className="mr-2 h-3 w-3" />
                        {event.status}
                    </Badge>
                </div>
                <CardDescription>{event.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
                 <div className="flex items-center">
                  <Calendar className="mr-2 h-4 w-4" />
                  <span>{format(new Date(event.startTime), 'PPP')}</span>
                </div>
                <div className="flex items-center">
                  <Clock className="mr-2 h-4 w-4" />
                  <span>{format(new Date(event.startTime), 'p')}</span>
                </div>
            </CardContent>
            {event.status === 'live' && event.gloryLiveRoomId && (
                <CardFooter>
                    <Button onClick={() => handleJoinEvent(event)} className="w-full">
                        <Eye className="mr-2 h-4 w-4" />
                        Join Event
                    </Button>
                </CardFooter>
            )}
        </Card>
    );

    const LoadingSkeleton = () => (
        <Card>
            <CardHeader>
                <Skeleton className="h-40 w-full mb-4" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-full mt-2" />
            </CardHeader>
            <CardContent className="space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/2" />
            </CardContent>
            <CardFooter>
                <Skeleton className="h-10 w-full" />
            </CardFooter>
        </Card>
    );
    
    if (authLoading) {
        return <div>Loading...</div>; // Or a proper loading skeleton for the whole page
    }

    if (!canViewPage) {
        return (
            <Alert variant="destructive">
                <Lock className="h-4 w-4" />
                <AlertTitle>Access Denied</AlertTitle>
                <AlertDescription>You do not have permission to view this page.</AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="container mx-auto py-8">
            <h1 className="text-3xl font-bold mb-2">Live Events</h1>
            <p className="text-muted-foreground mb-8">Join our live sessions and engage with the community.</p>

            <section>
                <h2 className="text-2xl font-semibold mb-4">Happening Now</h2>
                {loading ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <LoadingSkeleton />
                    </div>
                ) : liveEvents.length > 0 ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {liveEvents.map(event => <EventCard key={event.id} event={event} />)}
                    </div>
                ) : (
                    <p className="text-muted-foreground">No live events are happening right now.</p>
                )}
            </section>

            <section className="mt-12">
                <h2 className="text-2xl font-semibold mb-4">Upcoming Events</h2>
                 {loading ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <LoadingSkeleton />
                        <LoadingSkeleton />
                    </div>
                ) : upcomingEvents.length > 0 ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {upcomingEvents.map(event => <EventCard key={event.id} event={event} />)}
                    </div>
                ) : (
                    <p className="text-muted-foreground">No upcoming events scheduled. Check back soon!</p>
                )}
            </section>
        </div>
    );
}
