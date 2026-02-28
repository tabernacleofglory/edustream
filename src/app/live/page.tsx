
"use client";

import { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { LiveEvent } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye, Lock, Tv, Calendar as CalendarIcon, X } from 'lucide-react';
import { format, isWithinInterval, startOfDay, endOfDay, startOfWeek, endOfWeek } from 'date-fns';
import Image from 'next/image';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DateRange } from 'react-day-picker';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from '@/lib/utils';

export default function LiveEventsPage() {
    const [events, setEvents] = useState<LiveEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const { user, hasPermission, loading: authLoading } = useAuth();
    const router = useRouter();

    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: startOfWeek(new Date()),
        to: endOfWeek(new Date()),
    });

    const canViewPage = hasPermission('viewLivePage');

    useEffect(() => {
        if (authLoading) return;
        if (!canViewPage) {
            setLoading(false);
            return;
        }

        const q = query(collection(db, 'liveEvents'), orderBy('startTime', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const eventsList = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    startTime: data.startTime instanceof Timestamp ? data.startTime.toDate().toISOString() : data.startTime,
                } as LiveEvent
            }).filter(event => {
                if (!user) { // Guest user
                    return !event.ladderIds || event.ladderIds.length === 0;
                }
                if (!event.ladderIds || event.ladderIds.length === 0) {
                    return true;
                }
                return event.ladderIds.includes(user.classLadderId || '');
            });
            setEvents(eventsList);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [canViewPage, authLoading, user]);

    const filteredEvents = useMemo(() => {
        if (!dateRange || !dateRange.from) return events;
        
        const start = startOfDay(dateRange.from);
        const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
        
        return events.filter(event => {
            const eventDate = new Date(event.startTime);
            return isWithinInterval(eventDate, { start, end });
        });
    }, [events, dateRange]);
    
    const handleJoinEvent = (event: LiveEvent) => {
        if (event.platform === 'gloryLive' && event.gloryLiveRoomId) {
            router.push(`/live/${event.gloryLiveRoomId}`);
        } else if (event.platform === 'external' && event.externalLink) {
            window.open(event.externalLink, '_blank');
        }
    };

    if (authLoading) {
        return <div className="container mx-auto py-8"><Skeleton className="h-[500px] w-full" /></div>;
    }

    if (!canViewPage) {
        return (
            <div className="container mx-auto py-8">
                <Alert variant="destructive">
                    <Lock className="h-4 w-4" />
                    <AlertTitle>Access Denied</AlertTitle>
                    <AlertDescription>You do not have permission to view this page.</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Live Events</h1>
                    <p className="text-muted-foreground">Browse upcoming and live events.</p>
                </div>
                 <div className="flex items-center gap-2">
                    <div className="grid gap-1">
                        <Label htmlFor="start-date" className="text-xs">Start Date</Label>
                        <Input
                            id="start-date"
                            type="date"
                            value={dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : ''}
                            onChange={(e) => {
                                const from = e.target.value ? new Date(e.target.value.replace(/-/g, '/')) : undefined;
                                setDateRange((prev) => ({ ...prev, from }));
                            }}
                            className="w-full sm:w-[150px]"
                        />
                    </div>
                    <div className="grid gap-1">
                        <Label htmlFor="end-date" className="text-xs">End Date</Label>
                        <Input
                            id="end-date"
                            type="date"
                            value={dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : ''}
                            onChange={(e) => {
                                const to = e.target.value ? new Date(e.target.value.replace(/-/g, '/')) : undefined;
                                setDateRange((prev) => ({ ...prev, to }));
                            }}
                            className="w-full sm:w-[150px]"
                        />
                    </div>
                    {(dateRange?.from || dateRange?.to) && (
                        <Button variant="ghost" size="icon" onClick={() => setDateRange(undefined)} className="self-end">
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                 </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
                </div>
            ) : filteredEvents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filteredEvents.map(event => (
                        <Card key={event.id} className={cn("flex flex-col transition-all hover:shadow-lg", 
                            event.status === 'live' ? 'bg-destructive/10 border-destructive/20' : 
                            event.status === 'upcoming' ? 'bg-primary/5' : 'bg-muted/50'
                        )}>
                            <CardHeader>
                                <CardTitle className="text-lg">{event.title}</CardTitle>
                                <div className="mt-1">
                                    <Badge variant={event.status === 'live' ? 'destructive' : 'secondary'} className="capitalize">
                                        <Tv className="mr-1 h-3 w-3" />{event.status}
                                    </Badge>
                                </div>
                                <CardDescription>{format(new Date(event.startTime), 'PPP p')}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-grow">
                                {event.imageUrl && (
                                    <div className="relative aspect-video mb-4">
                                        <Image
                                            src={event.imageUrl}
                                            alt={event.title}
                                            fill
                                            style={{ objectFit: 'cover' }}
                                            className="rounded-md"
                                        />
                                    </div>
                                )}
                                <p className="text-sm text-muted-foreground line-clamp-3">{event.description}</p>
                            </CardContent>
                            <CardFooter className="pt-0">
                                <Button className="w-full" disabled={event.status !== 'live'} onClick={() => handleJoinEvent(event)}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    {event.status === 'live' ? 'Join Live' : 'Not Live'}
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            ) : (
                 <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
                    <CalendarIcon className="mx-auto h-12 w-12" />
                    <p className="mt-4">No events scheduled for the selected date range.</p>
                </div>
            )}
        </div>
    );
}
