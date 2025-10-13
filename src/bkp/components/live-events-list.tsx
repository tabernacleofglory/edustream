
"use client";

import { useState } from 'react';
import type { LiveEvent } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Tv, Copy, Check, Share2, Loader2, PlayCircle, StopCircle, RefreshCw, Mic, Eye, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from './ui/textarea';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"


interface LiveEventsListProps {
  events: LiveEvent[];
  loading: boolean;
  isAdmin: boolean;
  onGoLive: (eventId: string, vdoNinjaRoomId?: string) => void;
  onEndLive: (eventId: string) => void;
  onDelete: (eventId: string) => void;
  onDuplicate: (event: LiveEvent) => void;
}

export default function LiveEventsList({ events, loading, isAdmin, onGoLive, onEndLive, onDelete, onDuplicate }: LiveEventsListProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [sharingEvent, setSharingEvent] = useState<LiveEvent | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGoLiveClick = async (event: LiveEvent) => {
    setIsProcessing(event.id);
    await onGoLive(event.id, event.vdoNinjaRoomId);
    setIsProcessing(null);
  };
  
  const handleEndLiveClick = async (eventId: string) => {
    setIsProcessing(eventId);
    await onEndLive(eventId);
    setIsProcessing(null);
  }

  const handleDeleteClick = async (eventId: string) => {
      setIsProcessing(eventId);
      await onDelete(eventId);
      setIsProcessing(null);
  }

  const handleShare = (event: LiveEvent) => {
    setSharingEvent(event);
  }
  
  const renderActionButtons = (event: LiveEvent) => {
    const isThisEventProcessing = isProcessing === event.id;

    const actionButtons = [];
    const utilityButtons = [];

    switch (event.status) {
      case 'live':
         if (!event.gloryLiveRoomId) {
            actionButtons.push(<Button key="preparing" disabled className="flex-1"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing...</Button>);
        } else {
            actionButtons.push(
                <Button asChild key="moderate" className="flex-1" variant="secondary">
                    <Link href={`/admin/glory-live/${event.gloryLiveRoomId}?password=${event.gloryLiveRoomPassword}`} target="_blank">
                        <Mic className="mr-2 h-4 w-4" />
                        Moderate
                    </Link>
                </Button>,
                <Button asChild key="view" className="flex-1">
                    <Link href={`/live/${event.gloryLiveRoomId}`} target="_blank">
                        <Eye className="mr-2 h-4 w-4" />
                        View
                    </Link>
                </Button>,
                 <Button key="end" onClick={() => handleEndLiveClick(event.id)} disabled={isThisEventProcessing} className="flex-1" variant="destructive">
                    {isThisEventProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <StopCircle className="mr-2 h-4 w-4" />}
                    End
                </Button>
            );
            utilityButtons.push(
                <Button key="share" onClick={() => handleShare(event)} variant="outline" size="icon">
                    <Share2 className="h-4 w-4" />
                </Button>
            );
        }
        break;
      case 'upcoming':
        actionButtons.push(
          <Button key="go-live" onClick={() => handleGoLiveClick(event)} disabled={isThisEventProcessing} className="flex-1">
            {isThisEventProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
            Go Live
          </Button>
        );
        utilityButtons.push(
            <AlertDialog key="delete-alert">
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="icon" disabled={isThisEventProcessing}>
                    <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the event.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleDeleteClick(event.id)}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        );
        break;
      case 'ended':
         if (event.eventType === 'recurring') {
            actionButtons.push(
                <Button key="go-live-again" onClick={() => handleGoLiveClick(event)} disabled={isThisEventProcessing} className="flex-1">
                    {isThisEventProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                    Go Live Again
                </Button>
            );
         } else {
            actionButtons.push(<Button key="ended" disabled className="flex-1">Ended</Button>);
            utilityButtons.push(
                <Button key="duplicate" variant="outline" size="icon" onClick={() => onDuplicate(event)} disabled={isThisEventProcessing}>
                    <Copy className="h-4 w-4" />
                </Button>
            );
         }
         utilityButtons.push(
            <AlertDialog key="delete-alert-ended">
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="icon" disabled={isThisEventProcessing}>
                    <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the event.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleDeleteClick(event.id)}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
         );
        break;
      default:
        return null;
    }

    return (
        <div className="flex w-full gap-2">
            <div className="flex-grow flex gap-2">
                {actionButtons}
            </div>
            <div className="flex gap-2">
                {utilityButtons}
            </div>
        </div>
    )
  }

  const generateShareMessage = (event: LiveEvent) => {
    const eventTime = format(new Date(event.startTime), "MMM d, yyyy 'at' p");
    const link = `${window.location.origin}/live/${event.gloryLiveRoomId || ''}`;
    return `
🎉 You're invited to a Glory Event! 🎉

Topic: ${event.title}
When: ${eventTime}
About: ${event.description}

Join us live here: ${link}
    `.trim();
  };

  const handleCopyToClipboard = (text: string) => {
    if (!sharingEvent?.gloryLiveRoomId) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Copied to clipboard!" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {loading ? (
        <p>Loading events...</p>
      ) : events.length === 0 ? (
        <p>No live events scheduled.</p>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <Card key={event.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                    <CardTitle>{event.title}</CardTitle>
                    <Badge variant={event.eventType === 'recurring' ? 'default' : 'outline'} className="capitalize">
                        {event.eventType === 'recurring' && <RefreshCw className="mr-2 h-3 w-3" />}
                        {event.eventType || 'one-time'}
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
                <div className="flex items-center">
                    <Tv className="mr-2 h-4 w-4" />
                    <Badge variant={event.status === 'live' ? 'destructive' : 'secondary'} className="capitalize">
                        {event.status}
                    </Badge>
                </div>
              </CardContent>
              {isAdmin && (
                <CardFooter>
                   {renderActionButtons(event)}
                </CardFooter>
              )}
            </Card>
          ))}
        </div>
      )}
       <Dialog open={!!sharingEvent} onOpenChange={() => setSharingEvent(null)}>
        <DialogContent>
            {sharingEvent && (
                <>
                <DialogHeader>
                    <DialogTitle>Share "{sharingEvent.title}"</DialogTitle>
                    <DialogDescription id="share-desc">
                        Copy the message below to share it with your audience.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <Textarea
                        aria-describedby="share-desc"
                        readOnly
                        value={generateShareMessage(sharingEvent)}
                        rows={8}
                        className="bg-muted"
                    />
                    <Button onClick={() => handleCopyToClipboard(generateShareMessage(sharingEvent))} className="w-full" disabled={!sharingEvent.gloryLiveRoomId}>
                        {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                        {copied ? 'Copied!' : 'Copy Message'}
                    </Button>
                </div>
                </>
            )}
        </DialogContent>
       </Dialog>
    </>
  );
};
