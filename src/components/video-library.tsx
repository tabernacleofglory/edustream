
"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { db, storage } from '@/lib/firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, deleteObject, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Edit, Trash, Loader2, Check, Eye, Play } from 'lucide-react';
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

interface VideoLibraryProps {
    videos?: Video[];
    isLoading?: boolean;
    onStatusChange?: (video: Video, newStatus: boolean) => void;
    onDeleteVideo?: (videoId: string) => void;
    onUpdateVideo?: (video: Video) => void;
    onSelectVideos?: (videos: Video[]) => void;
    initialSelectedVideos?: {id: string}[];
}

const VideoPlayerPreview = ({ video }: { video: Video }) => {    
    const videoRef = useRef<HTMLVideoElement>(null);
    return <video ref={videoRef} src={video.url} controls autoPlay muted playsInline className="w-full h-full rounded-md" />;
};

const EMPTY_ARRAY: Video[] = [];

export default function VideoLibrary({ videos = [], isLoading = false, onStatusChange, onDeleteVideo, onUpdateVideo, onSelectVideos, initialSelectedVideos = EMPTY_ARRAY }: VideoLibraryProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [editingVideo, setEditingVideo] = useState<Video | null>(null);
    const { toast } = useToast();
    const [selectedVideos, setSelectedVideos] = useState<Video[]>([]);
    const [previewingVideo, setPreviewingVideo] = useState<Video | null>(null);
    
    // State for the edit form
    const [title, setTitle] = useState('');
    const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
    const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    
    useEffect(() => {
        const initialSelection = videos.filter(v => initialSelectedVideos.some(iv => iv.id === v.id));
        setSelectedVideos(initialSelection);
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
                ? prev.filter(v => v.id !== video.id)
                : [...prev, video]
        );
    }

    const filteredVideos = useMemo(() => {
        if (!searchTerm) return videos || [];
        return (videos || []).filter(video =>
            video.title.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [videos, searchTerm]);

    const handleDelete = async (video: Video) => {
        if (!window.confirm("Are you sure you want to delete this video? This cannot be undone.")) return;
        
        try {
            if (video.path) {
                const videoStorageRef = ref(storage, video.path);
                await deleteObject(videoStorageRef);
            }
            if(video.thumbnailPath) {
                const thumbnailStorageRef = ref(storage, video.thumbnailPath);
                await deleteObject(thumbnailStorageRef);
            }
            await deleteDoc(doc(db, 'Contents', video.id));
            toast({ title: "Video deleted successfully." });
            if (onDeleteVideo) onDeleteVideo(video.id);
        } catch (error) {
             toast({ variant: 'destructive', title: "Delete failed.", description: "Could not delete the video." });
             console.error("Delete error: ", error);
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
                if (editingVideo.thumbnailPath) {
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

            const updatedVideo: Video = {
                ...editingVideo,
                title: updatedData.title,
                Thumbnail: updatedData.Thumbnail || editingVideo.Thumbnail,
                thumbnailPath: updatedData.thumbnailPath || editingVideo.thumbnailPath,
            };

            toast({ title: "Video updated!" });
            if (onUpdateVideo) onUpdateVideo(updatedVideo);
            setEditingVideo(null);
        } catch (error) {
             toast({ variant: 'destructive', title: "Update failed", description: "Could not update the video details." });
             console.error("Update error: ", error);
        } finally {
            setIsUpdating(false);
        }
    }

    const renderStatusBadge = (video: Video) => {
        if (video.status === 'published') {
            return <Badge variant="default" className="absolute top-2 right-2">Published</Badge>;
        }
        return <Badge variant="secondary" className="absolute top-2 right-2">Private</Badge>;
    };

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
                    ) : (
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
                                            {(!onSelectVideos && video.url) && (
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Play className="h-12 w-12 text-white" />
                                                </div>
                                            )}
                                            {renderStatusBadge(video)}
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
                                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setPreviewingVideo(video)} disabled={!video.url}>
                                                        <Eye className="mr-2 h-3 w-3" /> Watch
                                                    </Button>
                                                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditingVideo(video)}>
                                                        <Edit className="mr-2 h-3 w-3" /> Edit
                                                    </Button>
                                                    <Button variant="destructive" size="sm" className="flex-1" onClick={() => handleDelete(video)}>
                                                        <Trash className="mr-2 h-3 w-3" /> Delete
                                                    </Button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </Card>
                            )
                        })
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
};
