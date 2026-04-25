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
import { createLiveEvent, goLiveWithGloryLive, deleteLiveEvent as deleteEvent, updateLiveEvent } from '@/lib/live-events';
import { useToast } from '@/hooks/use-toast';
import { collection, onSnapshot, orderBy, query, updateDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { LiveEvent, Ladder } from '@/lib/types';
import Image from 'next/image';
import { Calendar as CalendarIcon, UploadCloud, Link as LinkIcon, Copy, Check, Plus, Settings2, ChevronDown, X, Youtube, Loader2, Info } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import ImageLibrary from '@/components/image-library';
import { useAuth } from '@/hooks/use-auth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const LivePage = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState<Date | undefined>(new Date());
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [platform, setPlatform] = useState<'gloryLive' | 'external'>('gloryLive');
  const [externalLink, setExternalLink] = useState('');
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
  const [ladders, setLadders] = useState<Ladder[]>([]);
  const [selectedLadderIds, setSelectedLadderIds] = useState<string[]>([]);
  const [editingEvent, setEditingEvent] = useState<LiveEvent | null>(null);


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
    
    const laddersQuery = query(collection(db, "courseLevels"), orderBy("order"));
    getDocs(laddersQuery).then(snapshot => {
        setLadders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ladder)));
    });

    return () => unsubscribe();
  }, [toast]);
  
  const handleGoLive = async (eventId: string, vdoNinjaRoomId?: string) => {
    setIsSubmitting(true);
    try {
        const result = await goLiveWithGloryLive(eventId, vdoNinjaRoomId);
        
        const event = events.find(e => e.id === eventId);
        if (event?.platform === 'external') {
            toast({ title: 'Success', description: 'Event has been set to live.' });
            return;
        }

        if (result.success && result.roomId) {
            const broadcastUrl = `${window.location.origin}/admin/glory-live/${result.roomId}?password=${result.password}`;
            const viewUrl = `${window.location.origin}/live/${result.roomId}`;
            
            setGloryLiveLinks({ broadcastUrl, viewUrl });
            setIsGloryLiveModalOpen(true);
            toast({ title: 'Success', description: 'Your Glory Live room is ready!' });
        } else if (result.success) {
            toast({ title: 'Success', description: 'Event status updated to live.' });
        }
        else {
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
      updateLiveEvent(eventId, { status: 'ended' });
      toast({ title: 'Success', description: 'The live event has been ended.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error Ending Live Event', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (eventId: string) => {
    try {
      deleteEvent(eventId);
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
    setPlatform(event.platform);
    setExternalLink(event.externalLink || '');
    setSelectedLadderIds(event.ladderIds || []);
    setStartTime(new Date()); 
    setEditingEvent(null);
    setIsCreateSheetOpen(true);
  }
  
  const handleEdit = (event: LiveEvent) => {
    setEditingEvent(event);
    setTitle(event.title);
    setDescription(event.description);
    setStartTime(new Date(event.startTime));
    setImageUrl(event.imageUrl || null);
    setPlatform(event.platform);
    setExternalLink(event.externalLink || '');
    setVdoNinjaRoomId(event.vdoNinjaRoomId || '');
    setSelectedLadderIds(event.ladderIds || []);
    setIsCreateSheetOpen(true);
  }

  const resetFormState = () => {
    setTitle('');
    setDescription('');
    setStartTime(new Date());
    setImageUrl(null);
    setPlatform('gloryLive');
    setExternalLink('');
    setVdoNinjaRoomId('');
    setSelectedLadderIds([]);
    setEditingEvent(null);
  };

  const handleSheetOpenChange = (open: boolean) => {
    setIsCreateSheetOpen(open);
    if (!open) {
      resetFormState();
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !startTime) {
      toast({ variant: 'destructive', title: "Error", description: "Title, description, and start time are required." });
      return;
    }
    if (platform === 'external' && !externalLink.trim()) {
      toast({ variant: 'destructive', title: "Error", description: "External link is required for this platform type." });
      return;
    }
    setIsSubmitting(true);
    try {
      const eventPayload: any = { 
        title, 
        description, 
        startTime: startTime.toISOString(), 
        imageUrl: imageUrl || '', 
        platform, 
        ladderIds: selectedLadderIds 
      };

      if (platform === 'external' && externalLink.trim()) {
        eventPayload.externalLink = externalLink.trim();
      }

      if (editingEvent) {
          updateLiveEvent(editingEvent.id, eventPayload);
          toast({ title: "Success", description: "Live event updated successfully." });
      } else {
          if (vdoNinjaRoomId.trim()) {
            eventPayload.vdoNinjaRoomId = vdoNinjaRoomId.trim();
          }
          createLiveEvent(eventPayload);
          toast({ title: "Success", description: "Live event created successfully." });
      }

      handleSheetOpenChange(false);

    } catch (err: any) {
      console.error('Error saving live event:', err);
      toast({ variant: 'destructive', title: "Error", description: err.message || "Failed to save live event." });
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
  
  const handleLadderSelect = (ladderId: string) => {
    setSelectedLadderIds(prev =>
      prev.includes(ladderId)
        ? prev.filter(id => id !== ladderId)
        : [...prev, ladderId]
    );
  };


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
             <Sheet open={isCreateSheetOpen} onOpenChange={handleSheetOpenChange}>
              <SheetTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Event
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-md">
                <ScrollArea className="h-full w-full pr-6 -mr-6">
                <SheetHeader>
                  <SheetTitle>{editingEvent ? 'Edit Live Event' : 'Create a New Live Event'}</SheetTitle>
                  <SheetDescription>
                    {editingEvent ? 'Update the details for your live event.' : 'Fill in the details to schedule a new live event.'}
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
                                <Image src={imageUrl} alt="Event Thumbnail" fill style={{objectFit:"cover"}} className="rounded-lg" />
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
                          <Label htmlFor="platform">Event Platform</Label>
                          <Select value={platform} onValueChange={(value: 'gloryLive' | 'external') => setPlatform(value)}>
                              <SelectTrigger id="platform">
                                  <SelectValue placeholder="Select platform" />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="gloryLive">Glory Live</SelectItem>
                                  <SelectItem value="external">External Link (Zoom, Meet, etc.)</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>
                      {platform === 'external' && (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="externalLink">External Meeting Link</Label>
                            <Input
                              id="externalLink"
                              value={externalLink}
                              onChange={(e) => setExternalLink(e.target.value)}
                              placeholder="https://www.youtube.com/watch?v=..."
                              required={platform === 'external'}
                            />
                          </div>
                          <Alert>
                            <Info className="h-4 w-4" />
                            <AlertTitle>YouTube Tip</AlertTitle>
                            <AlertDescription className="text-xs">
                              For the best experience, use a direct video link (e.g., <code>.../watch?v=ID</code>). Permanent channel links (e.g., <code>.../live</code>) work but may not show thumbnails.
                            </AlertDescription>
                          </Alert>
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label>Restrict to Ladders (Optional)</Label>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="w-full justify-between">
                                    <span>{selectedLadderIds.length > 0 ? `${selectedLadderIds.length} selected` : "All Ladders"}</span>
                                    <ChevronDown className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                                {ladders.map(ladder => (
                                    <DropdownMenuCheckboxItem
                                        key={ladder.id}
                                        checked={selectedLadderIds.includes(ladder.id)}
                                        onCheckedChange={() => handleLadderSelect(ladder.id)}
                                    >
                                        {ladder.name}
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <div className="flex flex-wrap gap-1 pt-1">
                            {selectedLadderIds.map(id => {
                                const ladder = ladders.find(l => l.id === id);
                                return (
                                    <Badge key={id} variant="secondary">
                                        {ladder?.name}
                                        <button type="button" className="ml-1" onClick={() => handleLadderSelect(id)}>
                                            <X className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                );
                            })}
                        </div>
                        <p className="text-xs text-muted-foreground">If no ladders are selected, the event will be visible to everyone.</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="start-time">Event Start Time</Label>
                        <div className="flex gap-2">
                            <Input
                                type="date"
                                value={startTime ? format(startTime, 'yyyy-MM-dd') : ''}
                                onChange={(e) => {
                                    const dateVal = e.target.value;
                                    if (!dateVal) {
                                        setStartTime(undefined);
                                        return;
                                    }
                                    const [y, m, d] = dateVal.split('-').map(Number);
                                    const newDate = startTime ? new Date(startTime) : new Date();
                                    newDate.setFullYear(y, m - 1, d);
                                    setStartTime(newDate);
                                }}
                                className="flex-1"
                            />
                            <Input
                                type="time"
                                value={startTime ? format(startTime, 'HH:mm') : ''}
                                onChange={(e) => {
                                    const timeVal = e.target.value;
                                    if (!timeVal) return;
                                    const [hours, minutes] = timeVal.split(':').map(Number);
                                    const newDate = startTime ? new Date(startTime) : new Date();
                                    newDate.setHours(hours, minutes);
                                    setStartTime(newDate);
                                }}
                                className="w-[120px]"
                            />
                        </div>
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
                                        disabled={!!editingEvent}
                                    />
                                    <p className="text-xs text-muted-foreground">If left blank, a room ID will be generated from the title. Cannot be changed after creation.</p>
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    </div>
                    <CardFooter className="px-0">
                      <Button type="submit" disabled={isSubmitting} className="w-full">
                        {isSubmitting ? 'Saving...' : editingEvent ? 'Save Changes' : 'Create Event'}
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
            onEdit={handleEdit}
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