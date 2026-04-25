
"use client";

import { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { LiveEvent } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye, Lock, Tv, Calendar as CalendarIcon, X, Play, Youtube, Loader2, Filter } from 'lucide-react';
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
import ReactPlayer from 'react-player/lazy';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { resolveYoutubeLiveUrl } from '@/lib/youtube-actions';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
    SheetClose,
} from "@/components/ui/sheet";

export default function LiveEventsPage() {
    const [events, setEvents] = useState<LiveEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const { user, hasPermission, loading: authLoading } = useAuth();
    const router = useRouter();
    const [hasMounted, setHasMounted] = useState(false);
    const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
    const [isResolving, setIsResolving] = useState(false);

    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: startOfWeek(new Date()),
        to: endOfWeek(new Date()),
    });

    const canViewPage = hasPermission('viewLivePage');

    useEffect(() => {
        setHasMounted(true);
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
    }, [canViewPage, authLoading, user, db]);

    const featuredLiveEvent = useMemo(() => {
        // Find any active event marked 'live' with a YouTube link
        return events.find(e => 
            e.status === 'live' && 
            e.platform === 'external' && 
            (e.externalLink?.includes('youtube.com') || e.externalLink?.includes('youtu.be'))
        );
    }, [events]);

    useEffect(() => {
        if (featuredLiveEvent?.externalLink) {
            setIsResolving(true);
            resolveYoutubeLiveUrl(featuredLiveEvent.externalLink).then(url => {
                setResolvedUrl(url);
                setIsResolving(false);
            });
        } else {
            setResolvedUrl(null);
        }
    }, [featuredLiveEvent]);

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
        <div className="w-full pb-12">
            {/* Featured Live Stream Section - Immersive Wide Layout */}
            {(hasMounted && featuredLiveEvent) && (
                <section className="mb-12 animate-in fade-in slide-in-from-top-4 duration-1000">
                    <div className="w-full bg-black flex items-center justify-center border-b border-border shadow-2xl relative overflow-hidden">
                        <div className="w-full max-w-[1600px] mx-auto relative group">
                            {isResolving ? (
                                <div className="aspect-video flex flex-col items-center justify-center gap-2 text-white">
                                    <Loader2 className="h-8 w-8 animate-spin" />
                                    <p className="text-sm">Resolving live stream...</p>
                                </div>
                            ) : resolvedUrl ? (
                                <AspectRatio ratio={16 / 9} className="w-full">
                                    <ReactPlayer
                                        key={resolvedUrl}
                                        url={resolvedUrl}
                                        playing={true}
                                        muted={true}
                                        playsinline={true}
                                        controls={true}
                                        width="100%"
                                        height="100%"
                                        className="absolute top-0 left-0"
                                        config={{
                                            youtube: {
                                                playerVars: { 
                                                    autoplay: 1, 
                                                    mute: 1,
                                                    origin: typeof window !== 'undefined' ? window.location.origin : '',
                                                    modestbranding: 1,
                                                    rel: 0,
                                                    iv_load_policy: 3
                                                }
                                            }
                                        }}
                                    />
                                </AspectRatio>
                            ) : (
                                <div className="aspect-video flex items-center justify-center text-white text-center p-8">
                                    <p>Failed to load stream. Please try refreshing or opening directly on YouTube.</p>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="container mx-auto px-4 mt-6">
                        <div className="flex items-center justify-between gap-2 sm:gap-4">
                            <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
                                <Badge variant="destructive" className="animate-pulse px-2 py-0.5 sm:px-3 sm:py-1 flex items-center gap-1 uppercase tracking-wider font-bold text-[10px] sm:text-xs flex-shrink-0">
                                    <Tv className="h-3 w-3" />
                                    <span className="hidden xs:inline">LIVE NOW</span>
                                    <span className="xs:hidden">LIVE</span>
                                </Badge>
                                <h2 className="text-sm sm:text-2xl md:text-3xl font-bold font-headline truncate flex-1">{featuredLiveEvent.title}</h2>
                            </div>
                            <Button asChild variant="outline" size="sm" className="h-8 px-2 sm:h-9 sm:px-4 flex-shrink-0">
                                <a href={featuredLiveEvent.externalLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 sm:gap-2">
                                    <Youtube className="h-3 w-3 sm:h-4 sm:w-4 text-red-600" />
                                    <span className="text-[10px] sm:text-sm">YouTube</span>
                                </a>
                            </Button>
                        </div>
                        <div className="mt-4 p-4 bg-muted/30 rounded-lg border border-border">
                            <p className="text-sm text-muted-foreground">{featuredLiveEvent.description}</p>
                        </div>
                    </div>
                </section>
            )}

            <div className="container mx-auto px-4 mt-8">
                {!featuredLiveEvent && !loading && events.some(e => e.status === 'live' && e.platform === 'gloryLive') && (
                    <section className="mb-12">
                        <Alert className="bg-primary/5 border-primary/20 flex flex-col sm:flex-row items-center justify-between gap-4 p-6 rounded-xl">
                            <div className="flex items-center gap-4">
                                <div className="bg-primary text-primary-foreground p-3 rounded-full animate-pulse shadow-lg shadow-primary/20">
                                    <Play className="h-6 w-6" />
                                </div>
                                <div>
                                    <AlertTitle className="text-lg font-bold">A session is live on Glory Hub!</AlertTitle>
                                    <AlertDescription className="text-muted-foreground">
                                        Join the interactive live session currently in progress.
                                    </AlertDescription>
                                </div>
                            </div>
                            <Button asChild size="lg" className="shadow-lg shadow-primary/20">
                                <Link href={`/live/${events.find(e => e.status === 'live' && e.platform === 'gloryLive')?.gloryLiveRoomId}`}>
                                    Join Now
                                </Link>
                            </Button>
                        </Alert>
                    </section>
                )}

                <div className="flex justify-between items-center mb-8 gap-4 border-b pb-4">
                    <div>
                        <h1 className="text-2xl font-bold">Live Events</h1>
                        <p className="text-sm text-muted-foreground">Browse upcoming and live events.</p>
                    </div>
                    
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="outline" size="icon" className="relative h-10 w-10">
                                <CalendarIcon className="h-5 w-5" />
                                {(dateRange?.from || dateRange?.to) && (
                                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                                    </span>
                                )}
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="h-[50vh] sm:h-[40vh]">
                            <div className="container max-w-lg mx-auto">
                                <SheetHeader className="mb-6">
                                    <SheetTitle>Filter Events</SheetTitle>
                                    <SheetDescription>Select a date range to find specific live sessions.</SheetDescription>
                                </SheetHeader>
                                <div className="grid gap-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="sheet-start-date" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Start Date</Label>
                                            <Input
                                                id="sheet-start-date"
                                                type="date"
                                                className="h-11"
                                                value={dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : ''}
                                                onChange={(e) => {
                                                    const from = e.target.value ? new Date(e.target.value + 'T00:00:00') : undefined;
                                                    setDateRange((prev) => ({ ...prev, from }));
                                                }}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="sheet-end-date" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">End Date</Label>
                                            <Input
                                                id="sheet-end-date"
                                                type="date"
                                                className="h-11"
                                                value={dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : ''}
                                                onChange={(e) => {
                                                    const to = e.target.value ? new Date(e.target.value + 'T23:59:59') : undefined;
                                                    setDateRange((prev) => ({ ...prev, to }));
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <Button variant="outline" className="flex-1 h-11" onClick={() => setDateRange(undefined)}>
                                            <X className="mr-2 h-4 w-4" /> Reset
                                        </Button>
                                        <SheetClose asChild>
                                            <Button className="flex-1 h-11">Show Results</Button>
                                        </SheetClose>
                                    </div>
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
                    </div>
                ) : filteredEvents.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {filteredEvents.map(event => (
                            <Card key={event.id} className={cn("flex flex-col transition-all hover:shadow-lg group", 
                                event.status === 'live' ? 'bg-destructive/5 border-destructive/20' : 
                                event.status === 'upcoming' ? 'bg-primary/5 border-primary/10' : 'bg-muted/50 border-border'
                            )}>
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-xl group-hover:text-primary transition-colors">{event.title}</CardTitle>
                                        <Badge variant={event.status === 'live' ? 'destructive' : 'secondary'} className="capitalize shrink-0">
                                            <Tv className="mr-1 h-3 w-3" />{event.status}
                                        </Badge>
                                    </div>
                                    <CardDescription className="flex items-center gap-1.5 font-medium">
                                        <CalendarIcon className="h-3 w-3" />
                                        {format(new Date(event.startTime), 'PPP p')}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                    {event.imageUrl && (
                                        <div className="relative aspect-video mb-4 overflow-hidden rounded-md border border-border/50">
                                            <Image
                                                src={event.imageUrl}
                                                alt={event.title}
                                                fill
                                                style={{ objectFit: 'cover' }}
                                                className="transition-transform duration-500 group-hover:scale-105"
                                            />
                                        </div>
                                    )}
                                    <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">{event.description}</p>
                                </CardContent>
                                <CardFooter className="pt-0">
                                    <Button className="w-full" disabled={event.status !== 'live'} onClick={() => handleJoinEvent(event)}>
                                        <Eye className="mr-2 h-4 w-4" />
                                        {event.status === 'live' ? 'Join Live Stream' : 'Event Not Live'}
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 text-muted-foreground border-2 border-dashed rounded-lg bg-muted/10">
                        <CalendarIcon className="mx-auto h-16 w-16 opacity-20 mb-4" />
                        <h3 className="text-lg font-semibold text-foreground/70">No Events Scheduled</h3>
                        <p className="max-w-xs mx-auto mt-2">Adjust your date range filters to find more events.</p>
                        <Button variant="link" onClick={() => setDateRange(undefined)} className="mt-4">Clear all filters</Button>
                    </div>
                )}
            </div>
        </div>
    );
}
