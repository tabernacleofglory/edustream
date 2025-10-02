
"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { db, storage, videoStorage } from '@/lib/firebase';
import { doc, updateDoc, deleteDoc, onSnapshot, query, collection, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, deleteObject, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Edit, Trash2, Loader2, Check, Eye, Play, Film, RefreshCw, X, AlertTriangle, VideoOff, Youtube, RemoveFormattingIcon, FolderKanban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import type { Video } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { AspectRatio } from './ui/aspect-ratio';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import ReactPlayer from 'react-player/lazy';
import { useAuth } from '@/hooks/use-auth';


const VideoPlayerPreview = ({ video }: { video: Video }) => {
    const isYouTube = video.type === 'youtube' || video.url?.includes('youtube.com') || video.url?.includes('youtu.be');
    const isGoogleDrive = video.type === 'googledrive';

    let videoUrl = video.url;
    if (isGoogleDrive && videoUrl?.includes('/view')) {
        videoUrl = videoUrl.replace('/view', '/preview');
    }

    if (isYouTube || isGoogleDrive) {
        return (
            <ReactPlayer
                url={videoUrl}
                controls
                playing
                width="100%"
                height="100%"
                className="w-full h-full rounded-md"
            />
        );
    }
    
    return <video src={video.hlsUrl || video.url} controls autoPlay muted playsInline className="w-full h-full rounded-md" />;
};

const EMPTY_ARRAY: Video[] = [];

interface VideoLibraryProps {
    videos?: Video[];
    isLoading?: boolean;
    onStatusChange?: (video: Video, newStatus: boolean) => void;
    onDeleteVideo?: (videoId: string) => void;
    onUpdateVideo?: (video: Video) => void;
    onSelectVideos?: (videos: Video[]) => void;
    initialSelectedVideos?: Video[];
}

export default function VideoLibrary({ videos: initialVideos = [], isLoading: initialLoading = false, onStatusChange, onDeleteVideo, onUpdateVideo, onSelectVideos, initialSelectedVideos = EMPTY_ARRAY }: VideoLibraryProps) {
    const [videos, setVideos] = useState<Video[]>(initialVideos);
    const [isLoading, setIsLoading] = useState(initialLoading);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingVideo, setEditingVideo] = useState<Video | null>(null);
    const { toast } = useToast();
    const [selectedVideos, setSelectedVideos] = useState<Video[]>([]);
    const [previewingVideo, setPreviewingVideo] = useState<Video | null>(null);
    const [isTranscoding, setIsTranscoding] = useState<string | null>(null);
    const { user } = useAuth();
    
    // State for the edit form
    const [title, setTitle] = useState('');
    const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
    const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        setIsLoading(true);
        const q = query(collection(db, 'Contents'), where("Type", "in", ["video", "youtube", "googledrive"]));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const videosList = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as Video))
                .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setVideos(videosList);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching videos in real-time: ", error);
            toast({ variant: 'destructive', title: 'Failed to sync videos.' });
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [toast]);
    
    useEffect(() => {
        if (initialSelectedVideos && videos.length > 0) {
            const initialSelection = videos.filter(v => initialSelectedVideos.some(iv => iv.id === v.id));
            setSelectedVideos(initialSelection);
        }
    }, [initialSelectedVideos, videos]);

    useEffect(() => {
        if (editingVideo) {
            setTitle(editingVideo.title);
            setThumbnailPreview(editingVideo.Thumbnail);
            setThumbnailFile(null);
        }
    }, [editingVideo]);


    const toggleSelection = (video: Video) => {
        if (!onSelectVideos) return;
        setSelectedVideos(prev => 
            prev.some(v => v.id === video.id)
                ? prev.filter(d => d.id !== video.id)
                : [...prev, video]
        );
    }

    const filteredVideos = useMemo(() => {
        if (!searchTerm) return videos || [];
        return (videos || []).filter(video =>
            video.title.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [videos, searchTerm]);

    const handleRemove = async (video: Video) => {
        try {
            await deleteDoc(doc(db, 'Contents', video.id));
            toast({ title: `Video removed successfully.` });
            if (onDeleteVideo) onDeleteVideo(video.id);
        } catch (error) {
             toast({ variant: 'destructive', title: "Action failed.", description: `Could not remove the video.` });
             console.error("Remove error: ", error);
        }
    }
    
    const handleUpdateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingVideo) return;
        
        setIsUpdating(true);
        try {
            const videoDocRef = doc(db, 'Contents', editingVideo.id);
            const updatedData: { title: string; Thumbnail?: string; thumbnailPath?: string } = { title };

            if (thumbnailFile) {
                if (editingVideo.thumbnailPath && editingVideo.type !== 'youtube' && editingVideo.type !== 'googledrive') {
                    const oldThumbnailRef = ref(storage, editingVideo.thumbnailPath);
                    await deleteObject(oldThumbnailRef).catch(err => console.warn("Could not delete old thumbnail", err));
                }

                const newThumbnailPath = `thumbnails/${editingVideo.id}/${Date.now()}_${thumbnailFile.name}`;
                const newThumbnailRef = ref(storage, newThumbnailPath);
                await uploadBytes(newThumbnailRef, thumbnailFile);
                const newThumbnailUrl = await getDownloadURL(newThumbnailRef);

                updatedData.Thumbnail = newThumbnailUrl;
                updatedData.thumbnailPath = newThumbnailPath;
            }
            
            await updateDoc(videoDocRef, updatedData);

            toast({ title: "Video updated!" });
            setEditingVideo(null);
        } catch (error) {
             toast({ variant: 'destructive', title: "Update failed", description: "Could not update the video details." });
             console.error("Update error: ", error);
        } finally {
            setIsUpdating(false);
        }
    }

    const handleDisableTranscoding = async () => {
        if (!editingVideo) return;
        setIsUpdating(true);
        try {
            const videoDocRef = doc(db, 'Contents', editingVideo.id);
            await updateDoc(videoDocRef, {
                hlsUrl: null, // or deleteField() if you prefer
                transcodeStatus: 'not_requested'
            });

            toast({ title: "Transcoding Disabled", description: "The video will now use standard playback." });
            setEditingVideo(null);
        } catch (error) {
            toast({ variant: 'destructive', title: "Update Failed", description: "Could not disable transcoding." });
        } finally {
            setIsUpdating(false);
        }
    };
    
    const handleRetranscode = async (video: Video) => {
        setIsTranscoding(video.id);
        try {
            const videoRef = doc(db, 'Contents', video.id);
            await updateDoc(videoRef, { 
                transcodeStatus: 'processing',
                transcodeTrigger: 'manual' 
            });
            toast({ title: "Transcoding Started", description: "The video is now being processed." });
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Transcoding Failed", description: error.message });
        } finally {
            setIsTranscoding(null);
        }
    }
    
    const handleCancelTranscode = async (video: Video) => {
        if (isTranscoding === video.id) return;
        setIsTranscoding(video.id);
        try {
            const videoRef = doc(db, 'Contents', video.id);
            // This update now happens immediately on the client for instant UI feedback.
            await updateDoc(videoRef, { 
                transcodeStatus: 'cancelled',
                transcodeTrigger: 'cancel', // Still set trigger for backend cleanup
                errorMessage: null // Clear any old errors
            });
            toast({ title: "Cancellation Requested", description: "The transcoding job will be stopped." });
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Cancellation Failed", description: error.message });
        } finally {
            setIsTranscoding(null);
        }
    }

    const renderTranscodeBadge = (status?: string) => {
        switch (status) {
            case 'pending':
            case 'processing':
                return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Processing</Badge>;
            case 'succeeded': return <Badge variant="secondary" className="bg-green-100 text-green-800">Ready</Badge>;
            case 'failed': return <Badge variant="destructive">Failed</Badge>;
            case 'cancelled': return <Badge variant="outline">Cancelled</Badge>;
            default: return <Badge variant="outline">Not Requested</Badge>;
        }
    };
    
    const renderActionButtons = (video: Video) => {
        if (video.type === 'youtube' || video.type === 'googledrive') return null;

        const isJobProcessing = video.transcodeStatus === 'processing' || video.transcodeStatus === 'pending';
        const isJobActionInProgress = isTranscoding === video.id;

        if (isJobProcessing) {
            return (
                <Button variant="outline" size="sm" className="w-full" onClick={() => handleCancelTranscode(video)} disabled={isJobActionInProgress}>
                    {isJobActionInProgress ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <X className="mr-2 h-3 w-3" />}
                    Stop
                </Button>
            );
        }

        const showRetranscode = video.transcodeStatus === 'failed' || video.transcodeStatus === 'cancelled';
        
        return (
            <Button variant="outline" size="sm" className="w-full" onClick={() => handleRetranscode(video)} disabled={isJobActionInProgress}>
                 {isJobActionInProgress ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : (showRetranscode ? <RefreshCw className="mr-2 h-3 w-3" /> : <Film className="mr-2 h-3 w-3" />)}
                 {showRetranscode ? 'Retranscode' : 'Transcode'}
            </Button>
        );
    }
    
    const renderRemoveButton = (video: Video) => {
        return (
             <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full mt-2" onClick={e => e.stopPropagation()}>
                        <Trash2 className="mr-2 h-3 w-3" /> Remove
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>This will remove the video record from your library. This action cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleRemove(video)}>Remove</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        )
    }

    return (
        <>
            <div className="px-6 pb-4 pt-2">
                <Input 
                    placeholder="Search videos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
             <ScrollArea className="flex-grow">
                 <div className="px-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {isLoading ? (
                        Array.from({ length: 12 }).map((_, i) => (
                            <Card key={i} className="animate-pulse bg-muted">
                               <div className="aspect-video w-full" />
                               <CardContent className="p-4 space-y-2">
                                   <div className="h-4 w-3/4 bg-muted-foreground/20 rounded-md" />
                                   <div className="h-4 w-1/2 bg-muted-foreground/20 rounded-md" />
                               </CardContent>
                            </Card>
                        ))
                    ) : (filteredVideos || []).length > 0 ? (
                        (filteredVideos || []).map(video => {
                            const selectionIndex = selectedVideos.findIndex(v => v.id === video.id);
                            const isSelected = selectionIndex !== -1;
                            
                            return (
                                <Card key={video.id} className="group overflow-hidden flex flex-col">
                                    <CardContent className="p-0">
                                        <div 
                                            className="relative aspect-video cursor-pointer"
                                            onClick={() => onSelectVideos ? toggleSelection(video) : video.url ? setPreviewingVideo(video) : null}
                                        >
                                            <Image
                                                src={video.Thumbnail || "https://placehold.co/600x400.png"}
                                                alt={video.title}
                                                fill
                                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                                style={{objectFit:"cover"}}
                                                className="transition-transform group-hover:scale-105"
                                            />
                                            {video.type === 'youtube' && (
                                                 <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                    <Youtube className="h-12 w-12 text-red-500/80" />
                                                </div>
                                            )}
                                             {video.type === 'googledrive' && (
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                    <FolderKanban className="h-12 w-12 text-blue-500/80" />
                                                </div>
                                            )}
                                            {(!onSelectVideos && video.url && video.type === 'video') && (
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Play className="h-12 w-12 text-white" />
                                                </div>
                                            )}
                                             <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                                                {onStatusChange && <Badge variant={video.status === 'published' ? 'default' : 'secondary'}>{video.status}</Badge>}
                                                {video.type === 'video' && video.transcodeStatus && renderTranscodeBadge(video.transcodeStatus)}
                                             </div>
                                            {(isSelected && onSelectVideos) && (
                                                <div className="absolute top-2 left-2 bg-primary text-primary-foreground rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold z-10">
                                                    {selectionIndex + 1}
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                    <div className="p-4 flex flex-col flex-grow">
                                        <p className="font-semibold text-sm flex-grow" title={video.title}>{video.title}</p>
                                        
                                        {!onSelectVideos && (
                                            <>
                                                {onStatusChange && (
                                                    <div className="flex items-center justify-between mt-2 pt-2 border-t">
                                                        <Label htmlFor={`status-${video.id}`} className="text-xs text-muted-foreground">
                                                            Publication Status
                                                        </Label>
                                                        <Switch
                                                            id={`status-${video.id}`}
                                                            checked={video.status === 'published'}
                                                            onCheckedChange={(checked) => onStatusChange(video, checked)}
                                                        />
                                                    </div>
                                                )}
                                                <div className="grid grid-cols-2 gap-2 mt-2">
                                                    {renderActionButtons(video)}
                                                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditingVideo(video)}>
                                                        <Edit className="mr-2 h-3 w-3" /> Edit
                                                    </Button>
                                                </div>
                                                {renderRemoveButton(video)}
                                            </>
                                        )}
                                    </div>
                                </Card>
                            )
                        })
                    ) : (
                        <div className="col-span-full text-center py-12 text-muted-foreground">
                            <VideoOff className="mx-auto h-12 w-12"/>
                            <p className="mt-4">No videos found.</p>
                        </div>
                    )}
                </div>
            </ScrollArea>
            {onSelectVideos && (
                <div className="p-6 border-t">
                    <Button onClick={() => onSelectVideos(selectedVideos)} className="w-full">
                        Confirm Selection ({selectedVideos.length})
                    </Button>
                </div>
            )}
             <Dialog open={!!editingVideo} onOpenChange={(isOpen) => !isOpen && setEditingVideo(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Video</DialogTitle>
                        <DialogDescription>Update the details for this video.</DialogDescription>
                    </DialogHeader>
                    {editingVideo && (
                        <form onSubmit={handleUpdateSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-video-title">Video Title</Label>
                                <Input id="edit-video-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-video-thumbnail">Thumbnail</Label>
                                {thumbnailPreview && (
                                    <div className="mt-2">
                                        <Image src={thumbnailPreview} alt="Thumbnail preview" width={160} height={90} className="rounded-md object-cover" />
                                    </div>
                                )}
                                <Input id="edit-video-thumbnail" type="file" accept="image/*" onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        const file = e.target.files[0];
                                        setThumbnailFile(file);
                                        const reader = new FileReader();
                                        reader.onloadend = () => {
                                            setThumbnailPreview(reader.result as string);
                                        };
                                        reader.readAsDataURL(file);
                                    }
                                }} />
                            </div>
                            {editingVideo.type === 'video' && editingVideo.transcodeStatus === 'succeeded' && editingVideo.hlsUrl && (
                                <div className="space-y-2 rounded-md border border-destructive/50 p-3">
                                    <Label className="text-destructive">Danger Zone</Label>
                                    <p className="text-xs text-muted-foreground">This will remove the transcoded version of the video and revert to standard playback.</p>
                                    <Button type="button" variant="destructive" onClick={handleDisableTranscoding} disabled={isUpdating}>
                                        <VideoOff className="mr-2 h-4 w-4" />
                                        Disable Transcoding
                                    </Button>
                                </div>
                            )}
                            <DialogFooter>
                                <Button type="button" variant="secondary" onClick={() => setEditingVideo(null)}>Cancel</Button>
                                <Button type="submit" disabled={isUpdating}>
                                    {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Changes
                                </Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
             <Dialog open={!!previewingVideo} onOpenChange={(isOpen) => !isOpen && setPreviewingVideo(null)}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{previewingVideo?.title}</DialogTitle>
                        <DialogDescription>Video preview</DialogDescription>
                    </DialogHeader>
                    {previewingVideo && (
                        <AspectRatio ratio={16/9} className="bg-black">
                             <VideoPlayerPreview video={previewingVideo} />
                        </AspectRatio>
                    )}
                </DialogContent>
             </Dialog>
        </>
    );
}

    