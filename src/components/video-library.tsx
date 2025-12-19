
"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { db, storage, getFirebaseFirestore, getFirebaseStorage } from '@/lib/firebase';
import { doc, updateDoc, deleteDoc, onSnapshot, query, collection, where, addDoc, serverTimestamp, getDocs, getDoc, documentId } from 'firebase/firestore';
import { ref, deleteObject, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Edit, Trash2, Loader2, Check, Eye, Play, Film, RefreshCw, X, AlertTriangle, VideoOff, Youtube, RemoveFormattingIcon, FolderKanban, Minus, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import type { Video, User } from '@/lib/types';
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
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Skeleton } from './ui/skeleton';
import { Slider } from './ui/slider';


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
    
    return <video src={video.url} controls autoPlay muted playsInline className="w-full h-full rounded-md" />;
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

const formatDuration = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const hStr = h > 0 ? `${h}:` : '';
    const mStr = h > 0 && m < 10 ? `0${m}` : `${m}`;
    const sStr = s < 10 ? `0${s}` : `${s}`;
    return `${hStr}${mStr}:${sStr}`;
};

export default function VideoLibrary({ videos: initialVideos = [], isLoading: initialLoading = false, onStatusChange, onDeleteVideo, onUpdateVideo, onSelectVideos, initialSelectedVideos = EMPTY_ARRAY }: VideoLibraryProps) {
    const [videos, setVideos] = useState<Video[]>(initialVideos);
    const [isLoading, setIsLoading] = useState(initialLoading);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingVideo, setEditingVideo] = useState<Video | null>(null);
    const { toast } = useToast();
    const [selectedVideos, setSelectedVideos] = useState<Video[]>([]);
    const [previewingVideo, setPreviewingVideo] = useState<Video | null>(null);
    const { user } = useAuth();
    
    // State for the edit form
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [status, setStatus] = useState<'published' | 'private'>('private');
    const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
    const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
    const [enableStillWatching, setEnableStillWatching] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [uploaderName, setUploaderName] = useState<string | null>(null);
    const [durationH, setDurationH] = useState(0);
    const [durationM, setDurationM] = useState(0);
    const [durationS, setDurationS] = useState(0);
    const [isAddingYouTube, setIsAddingYouTube] = useState(false);

    const db = getFirebaseFirestore();
    const storage = getFirebaseStorage();

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
    }, [toast, db]);
    
    useEffect(() => {
        if (initialSelectedVideos && videos.length > 0) {
            const initialSelection = videos.filter(v => initialSelectedVideos.some(iv => iv.id === v.id));
            setSelectedVideos(initialSelection);
        }
    }, [initialSelectedVideos, videos]);

    useEffect(() => {
        if (editingVideo) {
            setTitle(editingVideo.title);
            setUrl(editingVideo.url || '');
            setStatus(editingVideo.status || 'private');
            setThumbnailPreview(editingVideo.Thumbnail);
            setEnableStillWatching(editingVideo.enableStillWatchingPrompt || false);
            
            const totalSeconds = editingVideo.duration || 0;
            setDurationH(Math.floor(totalSeconds / 3600));
            setDurationM(Math.floor((totalSeconds % 3600) / 60));
            setDurationS(totalSeconds % 60);

            setThumbnailFile(null);
            
            if (editingVideo.uploaderId) {
                getDoc(doc(db, 'users', editingVideo.uploaderId)).then(docSnap => {
                    if (docSnap.exists()) {
                        setUploaderName((docSnap.data() as User).displayName || 'Unknown');
                    } else {
                        setUploaderName('Unknown User');
                    }
                });
            } else {
                setUploaderName('N/A');
            }
        }
    }, [editingVideo, db]);


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
            
            let totalDurationInSeconds = (durationH * 3600) + (durationM * 60) + durationS;

            const updatedData: { title: string; url: string; status: string; Thumbnail?: string; thumbnailPath?: string; enableStillWatchingPrompt?: boolean, duration?: number } = { 
                title,
                url,
                status,
                enableStillWatchingPrompt: enableStillWatching,
                duration: totalDurationInSeconds
            };

            // If it's a youtube video, refetch info before saving
            if (editingVideo.type === 'youtube' && url) {
                try {
                    const refreshedData = await fetchYouTubeVideoInfo(url);
                    if (refreshedData) {
                        updatedData.title = refreshedData.title;
                        updatedData.Thumbnail = refreshedData.thumbnail;
                        if (refreshedData.durationInSeconds > 0) {
                             updatedData.duration = refreshedData.durationInSeconds;
                             totalDurationInSeconds = refreshedData.durationInSeconds;
                             setDurationH(Math.floor(totalDurationInSeconds / 3600));
                             setDurationM(Math.floor((totalDurationInSeconds % 3600) / 60));
                             setDurationS(totalDurationInSeconds % 60);
                        }
                    }
                } catch (refreshError) {
                    console.warn("Could not refetch YouTube info, saving with current data.", refreshError);
                }
            }
            
            updatedData.duration = totalDurationInSeconds;

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
    
    const fetchYouTubeVideoInfo = async (videoUrl: string) => {
        const oembedResponse = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`);
        if (!oembedResponse.ok) throw new Error("Failed to fetch oEmbed data.");
        const oembedData = await oembedResponse.json();

        const videoIdMatch = videoUrl.match(/(?:v=)([^&]+)/) || videoUrl.match(/(?:youtu\.be\/)([^?]+)/);
        let durationInSeconds = 0;
        if(videoIdMatch?.[1]) {
            const videoId = videoIdMatch[1];
            try {
                const videoDetailsResponse = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=contentDetails&key=${process.env.NEXT_PUBLIC_YOUTUBE_API_KEY}`);
                const videoDetails = await videoDetailsResponse.json();
                const durationISO = videoDetails.items[0]?.contentDetails?.duration;
                if (durationISO) {
                    const match = durationISO.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
                    if (match) {
                        const hours = parseInt(match[1] || '0');
                        const minutes = parseInt(match[2] || '0');
                        const seconds = parseInt(match[3] || '0');
                        durationInSeconds = hours * 3600 + minutes * 60 + seconds;
                    }
                }
            } catch (apiError) {
                console.warn("Could not fetch duration from YouTube API, it might be missing a key or have restrictions.", apiError);
            }
        }
        return {
            title: oembedData.title,
            thumbnail: oembedData.thumbnail_url,
            durationInSeconds
        };
    };

    const handleRefetch = async (video: Video) => {
        if (video.type !== 'youtube' || !video.url) return;
        setIsUpdating(true);
        try {
            const info = await fetchYouTubeVideoInfo(video.url);
            if (info) {
                const videoRef = doc(db, 'Contents', video.id);
                await updateDoc(videoRef, {
                    title: info.title,
                    Thumbnail: info.thumbnail,
                    duration: info.durationInSeconds > 0 ? info.durationInSeconds : video.duration,
                });
                toast({ title: 'Video info refreshed successfully!' });
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Failed to refetch video info.' });
        } finally {
            setIsUpdating(false);
        }
    }


    const renderActionButtons = (video: Video) => {
        return (
            <div className="flex flex-col gap-2 mt-2">
                 <Button variant="outline" size="sm" className="w-full" onClick={(e) => {e.stopPropagation(); setEditingVideo(video)}}>
                    <Edit className="mr-2 h-3 w-3" /> Edit
                </Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full" onClick={e => e.stopPropagation()}>
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
                 {video.type === 'youtube' && (
                    <Button variant="outline" size="sm" className="w-full" onClick={(e) => {e.stopPropagation(); handleRefetch(video);}}>
                        {isUpdating ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-2 h-3 w-3" />}
                        Refetch
                    </Button>
                )}
            </div>
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
                                        <p className="text-xs text-muted-foreground mt-1">{formatDuration(video.duration)}</p>
                                        
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
                                                {renderActionButtons(video)}
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
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Video</DialogTitle>
                        <DialogDescription>Update the details for this video.</DialogDescription>
                    </DialogHeader>
                    {editingVideo && (
                        <ScrollArea className="max-h-[70vh] pr-6 -mr-6">
                            <form onSubmit={handleUpdateSubmit} className="space-y-4 pr-1">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-video-title">Video Title</Label>
                                    <Input id="edit-video-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-video-url">Video URL</Label>
                                    <Input id="edit-video-url" value={url} onChange={(e) => setUrl(e.target.value)} required />
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
                                <div className="space-y-2">
                                    <Label>Status</Label>
                                    <Select value={status} onValueChange={(value: 'published' | 'private') => setStatus(value)}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="published">Published</SelectItem>
                                            <SelectItem value="private">Private</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {editingVideo.type === 'video' && (
                                    <div className="flex items-center space-x-2">
                                        <Switch
                                            id="still-watching-switch"
                                            checked={enableStillWatching}
                                            onCheckedChange={setEnableStillWatching}
                                        />
                                        <Label htmlFor="still-watching-switch">Enable "Are you still watching?" prompt</Label>
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <Label>Duration</Label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <Label htmlFor="duration-h" className="text-xs text-muted-foreground">HH</Label>
                                            <Input id="duration-h" type="number" value={durationH} onChange={e => setDurationH(Number(e.target.value))} placeholder="HH" />
                                        </div>
                                        <div>
                                            <Label htmlFor="duration-m" className="text-xs text-muted-foreground">MM</Label>
                                            <Input id="duration-m" type="number" value={durationM} onChange={e => setDurationM(Number(e.target.value))} placeholder="MM" />
                                        </div>
                                        <div>
                                            <Label htmlFor="duration-s" className="text-xs text-muted-foreground">SS</Label>
                                            <Input id="duration-s" type="number" value={durationS} onChange={e => setDurationS(Number(e.target.value))} placeholder="SS" />
                                        </div>
                                    </div>
                                    <div className="text-sm text-muted-foreground">Total Seconds: {(durationH * 3600) + (durationM * 60) + durationS}</div>
                                </div>

                                <div className="space-y-1 text-sm text-muted-foreground border-t pt-4 mt-4">
                                    <div><strong>Uploader:</strong>
                                        <div>
                                            {uploaderName ? (
                                                <>
                                                    <p className="font-medium">{uploaderName}</p>
                                                    <p className="text-xs font-mono">{editingVideo.uploaderId || 'N/A'}</p>
                                                </>
                                            ) : <Skeleton className="h-4 w-24 inline-block" />}
                                        </div>
                                    </div>
                                    <div><strong>Created:</strong> {editingVideo.createdAt?.toDate ? format(editingVideo.createdAt.toDate(), 'PPP p') : 'N/A'}</div>
                                </div>
                                
                                <DialogFooter className="pt-4">
                                    <Button type="button" variant="secondary" onClick={() => setEditingVideo(null)}>Cancel</Button>
                                    <Button type="submit" disabled={isUpdating}>
                                        {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Save Changes
                                    </Button>
                                </DialogFooter>
                            </form>
                        </ScrollArea>
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
