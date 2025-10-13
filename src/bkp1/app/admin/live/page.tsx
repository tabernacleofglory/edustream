
'use client';
import { useState, useEffect, FormEvent } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import LiveEventsList from '@/components/live-events-list';
import { createLiveEvent, goLiveWithGloryLive, deleteLiveEvent as deleteEvent } from '@/lib/live-events';
import { useToast } from '@/hooks/use-toast';
import { collection, onSnapshot, orderBy, query, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { LiveEvent } from '@/lib/types';
import Image from 'next/image';
import { Calendar as CalendarIcon, UploadCloud, Link as LinkIcon, Copy, Check, Plus, Settings2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import ImageLibrary from '@/components/image-library';
import { useAuth } from '@/hooks/use-auth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const LivePage = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState<Date | undefined>(new Date());
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [eventType, setEventType] = useState<'one-time' | 'recurring'>('one-time');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isImageLibraryOpen, setIsImageLibraryOpen] = useState(false);
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  
  const [gloryLiveLinks, setGloryLiveLinks] = useState<{ broadcastUrl: string, viewUrl: string} | null>(null);
  const [isGloryLiveModalOpen, setIsGloryLiveModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState<'broadcast' | 'view' | null>(null);
  const [vdoNinjaRoomId, setVdoNinjaRoomId] = useState('');


  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'liveEvents'), orderBy('startTime', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const eventsList = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          startTime: data.startTime?.toDate ? data.startTime.toDate().toISOString() : data.startTime,
        }
      }) as LiveEvent[];
      setEvents(eventsList);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching live events:", error);
      toast({ variant: 'destructive', title: "Error", description: "Could not fetch live events." });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);
  
  const handleGoLive = async (eventId: string, vdoNinjaRoomId?: string) => {
    setIsSubmitting(true);
    try {
        const result = await goLiveWithGloryLive(eventId, vdoNinjaRoomId);
        if (result.success && result.roomId) {
            const broadcastUrl = `${window.location.origin}/admin/glory-live/${result.roomId}?password=${result.password}`;
            const viewUrl = `${window.location.origin}/live/${result.roomId}`;
            
            setGloryLiveLinks({ broadcastUrl, viewUrl });
            setIsGloryLiveModalOpen(true);
            toast({ title: 'Success', description: 'Your Glory Live room is ready!' });
        } else {
            throw new Error(result.message || 'Failed to start live stream.');
        }
    } catch (err: any) {
        toast({ variant: 'destructive', title: 'Error Going Live', description: err.message });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleEndLive = async (eventId: string) => {
    setIsSubmitting(true);
    try {
      const eventToEnd = events.find(e => e.id === eventId);
      const newStatus = eventToEnd?.eventType === 'recurring' ? 'upcoming' : 'ended';

      await updateDoc(doc(db, 'liveEvents', eventId), {
        status: newStatus,
        gloryLiveRoomId: null, // Explicitly clear the room ID
        gloryLiveRoomPassword: null, // Explicitly clear the password
      });
      toast({ title: 'Success', description: 'The live event has been ended.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error Ending Live Event', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (eventId: string) => {
    try {
      await deleteEvent(eventId);
      toast({ title: "Success", description: "Live event deleted successfully." });
    } catch (err: any) {
      console.error('Error deleting live event:', err);
      toast({ variant: 'destructive', title: "Error", description: err.message || "Failed to delete live event." });
    }
  };

  const handleDuplicate = (event: LiveEvent) => {
    setTitle(event.title + ' (Copy)');
    setDescription(event.description);
    setImageUrl(event.imageUrl || null);
    setEventType('one-time');
    setStartTime(new Date()); // Reset to now
    setIsCreateSheetOpen(true);
  }


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !startTime) {
      toast({ variant: 'destructive', title: "Error", description: "Title, description, and start time are required." });
      return;
    }
    setIsSubmitting(true);
    try {
      await createLiveEvent({ title, description, startTime, imageUrl: imageUrl || '', eventType, vdoNinjaRoomId: vdoNinjaRoomId || undefined });
      setTitle('');
      setDescription('');
      setStartTime(new Date());
      setImageUrl(null);
      setEventType('one-time');
      setVdoNinjaRoomId('');
      toast({ title: "Success", description: "Live event created successfully." });
      setIsCreateSheetOpen(false);
    } catch (err: any) {
      console.error('Error creating live event:', err);
      toast({ variant: 'destructive', title: "Error", description: err.message || "Failed to create live event." });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleImageSelect = (image: { url: string }) => {
      setImageUrl(image.url);
      setIsImageLibraryOpen(false);
  }

  const handleCopy = (text: string, type: 'broadcast' | 'view') => {
    navigator.clipboard.writeText(text);
    setCopiedLink(type);
    setTimeout(() => setCopiedLink(null), 2000);
  }

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Scheduled Events</CardTitle>
              <CardDescription>
                Here are your upcoming and past live events.
              </CardDescription>
            </div>
             <Sheet open={isCreateSheetOpen} onOpenChange={setIsCreateSheetOpen}>
              <SheetTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Event
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-md">
                <ScrollArea className="h-full w-full pr-6 -mr-6">
                <SheetHeader>
                  <SheetTitle>Create a New Live Event</SheetTitle>
                  <SheetDescription>
                    Fill in the details to schedule a new live event.
                  </SheetDescription>
                </SheetHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Event Thumbnail</Label>
                        <div 
                            className="aspect-video relative bg-muted rounded-lg flex items-center justify-center cursor-pointer border-2 border-dashed hover:border-primary"
                            onClick={() => setIsImageLibraryOpen(true)}
                        >
                            {imageUrl ? (
                                <Image src={imageUrl} alt="Event Thumbnail" layout="fill" objectFit="cover" className="rounded-lg" />
                            ) : (
                                <div className="text-center text-muted-foreground">
                                    <UploadCloud className="mx-auto h-8 w-8" />
                                    <p>Select an Image</p>
                                </div>
                            )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="title">Event Title</Label>
                        <Input
                          id="title"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="e.g., Weekly Q&A"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="description">Event Description</Label>
                        <Textarea
                          id="description"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="e.g., Join us for a live Q&A session."
                          required
                        />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="eventType">Event Type</Label>
                          <Select value={eventType} onValueChange={(value: 'one-time' | 'recurring') => setEventType(value)}>
                              <SelectTrigger id="eventType">
                                  <SelectValue placeholder="Select event type" />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="one-time" translate="no">One-Time Event</SelectItem>
                                  <SelectItem value="recurring" translate="no">Recurring Event</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="start-time">Event Start Time</Label>
                        {isClient && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !startTime && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {startTime ? format(startTime, "PPP HH:mm") : <span>Pick a date and time</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={startTime}
                                onSelect={setStartTime}
                                initialFocus
                              />
                              <div className="p-3 border-t border-border">
                                  <Label>Time</Label>
                                  <Input 
                                      type="time" 
                                      step="60"
                                      value={startTime ? format(startTime, "HH:mm") : ""}
                                      onChange={(e) => {
                                          const newTime = e.target.value;
                                          const [hours, minutes] = newTime.split(':').map(Number);
                                          const newDate = startTime ? new Date(startTime) : new Date();
                                          newDate.setHours(hours, minutes);
                                          setStartTime(newDate);
                                      }}
                                  />
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                       <Collapsible>
                            <CollapsibleTrigger asChild>
                                <Button variant="outline" className="w-full">
                                    <Settings2 className="mr-2 h-4 w-4" />
                                    Glory Live Settings (Optional)
                                </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pt-4 space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="vdo-ninja-room-id">Custom Room ID</Label>
                                    <Input 
                                        id="vdo-ninja-room-id"
                                        value={vdoNinjaRoomId}
                                        onChange={(e) => setVdoNinjaRoomId(e.target.value)}
                                        placeholder="e.g., my-special-event"
                                    />
                                    <p className="text-xs text-muted-foreground">If left blank, a room ID will be generated from the title.</p>
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    </div>
                    <CardFooter className="px-0">
                      <Button type="submit" disabled={isSubmitting} className="w-full">
                        {isSubmitting ? 'Creating...' : 'Create Event'}
                      </Button>
                    </CardFooter>
                </form>
                </ScrollArea>
              </SheetContent>
            </Sheet>
        </CardHeader>
        <CardContent>
          <LiveEventsList 
            events={events} 
            loading={loading} 
            isAdmin={hasPermission('manageLive')} 
            onGoLive={handleGoLive}
            onEndLive={handleEndLive}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
          />
        </CardContent>
      </Card>

       <Dialog open={isImageLibraryOpen} onOpenChange={setIsImageLibraryOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Select an Image</DialogTitle>
             <DialogDescription>Choose an image from the library for your event thumbnail.</DialogDescription>
          </DialogHeader>
          <ImageLibrary onSelectImage={handleImageSelect} selectedImageUrl={imageUrl} />
        </DialogContent>
      </Dialog>
      
       <Dialog open={isGloryLiveModalOpen} onOpenChange={setIsGloryLiveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Glory Live Stream Ready</DialogTitle>
            <DialogDescription>
              Your live stream room has been created. Use the links below to broadcast and share.
            </DialogDescription>
          </DialogHeader>
          {gloryLiveLinks && (
            <div className="space-y-4 pt-4">
              <div>
                <Label htmlFor="broadcast-link">Broadcaster Link</Label>
                <div className="flex items-center gap-2">
                    <Input id="broadcast-link" value={gloryLiveLinks.broadcastUrl} readOnly />
                    <Button variant="outline" size="icon" onClick={() => handleCopy(gloryLiveLinks.broadcastUrl, 'broadcast')}>
                        {copiedLink === 'broadcast' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                </div>
                 <p className="text-xs text-muted-foreground mt-1">Open this link to start your camera and broadcast.</p>
              </div>
              <div>
                <Label htmlFor="view-link">Public View Link</Label>
                <div className="flex items-center gap-2">
                    <Input id="view-link" value={gloryLiveLinks.viewUrl} readOnly />
                     <Button variant="outline" size="icon" onClick={() => handleCopy(gloryLiveLinks.viewUrl, 'view')}>
                        {copiedLink === 'view' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Share this link with your audience.</p>
              </div>
            </div>
          )}
           <DialogFooter>
                <Button onClick={() => setIsGloryLiveModalOpen(false)}>Close</Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LivePage;
