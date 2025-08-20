
"use client";

import { useState, useEffect, useCallback, FormEvent, MouseEvent, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, getDocs, query, where, doc, updateDoc, deleteDoc, orderBy, onSnapshot, setDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, Edit, Trash, Video as VideoIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import type { User, Video } from "@/lib/types";
import VideoLibrary from "@/components/video-library";
import { Switch } from "@/components/ui/switch";

const VideoUploadForm = ({ user, onUploadSuccess, closeDialog }: { user: User | null, onUploadSuccess: (newVideo: Video) => void, closeDialog: () => void }) => {
    const [title, setTitle] = useState('');
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [duration, setDuration] = useState<number | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const { toast } = useToast();
    const videoRef = useRef<HTMLVideoElement>(null);

    const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        setVideoFile(file);
        if (file) {
            setFileName(file.name);
            const titleWithoutExtension = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            setTitle(titleWithoutExtension);

            const videoUrl = URL.createObjectURL(file);
            const videoElement = document.createElement('video');
            videoElement.src = videoUrl;
            videoElement.onloadedmetadata = () => {
                setDuration(videoElement.duration);
                URL.revokeObjectURL(videoUrl);
            };
        } else {
            setFileName(null);
            setDuration(null);
            setTitle('');
        }
    };
    
    const generateThumbnail = (videoFile: File): Promise<File> => {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            video.src = URL.createObjectURL(videoFile);
            video.onloadeddata = () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                video.currentTime = 1; 
            };
            video.onseeked = () => {
                if(context){
                    context.drawImage(video, 0, 0, canvas.width, canvas.height);
                    canvas.toBlob((blob) => {
                        if (blob) {
                            const thumbnail = new File([blob], 'thumbnail.png', { type: 'image/png' });
                            resolve(thumbnail);
                        } else {
                            reject(new Error('Canvas to Blob conversion failed'));
                        }
                        URL.revokeObjectURL(video.src);
                    }, 'image/png');
                }
            };
            video.onerror = (err) => {
                reject(err);
                URL.revokeObjectURL(video.src);
            };
        });
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!videoFile || !title) {
            toast({ variant: 'destructive', title: 'Video file and title are required' });
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);
        
        try {
            let finalThumbnailFile = thumbnailFile;
            if (!finalThumbnailFile) {
                finalThumbnailFile = await generateThumbnail(videoFile);
            }

            const thumbnailPath = `contents/thumbnails/${uuidv4()}-${finalThumbnailFile.name}`;
            const thumbnailRef = ref(storage, thumbnailPath);
            await uploadBytesResumable(thumbnailRef, finalThumbnailFile);
            const thumbnailUrl = await getDownloadURL(thumbnailRef);

            const videoPath = `contents/videos/${uuidv4()}-${videoFile.name}`;
            const videoStorageRef = ref(storage, videoPath);
            const uploadTask = uploadBytesResumable(videoStorageRef, videoFile);

            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadProgress(progress);
                },
                (error) => {
                    console.error("Upload error:", error);
                    toast({ variant: 'destructive', title: "Upload failed" });
                    setIsUploading(false);
                },
                async () => {
                    const videoUrl = await getDownloadURL(uploadTask.snapshot.ref);
                    const videoDuration = duration || 0;
                    
                    const docRef = await addDoc(collection(db, 'Contents'), {
                        title: title,
                        url: videoUrl,
                        duration: videoDuration,
                        Thumbnail: thumbnailUrl,
                        thumbnailPath: thumbnailPath,
                        path: videoPath,
                        'File name': videoFile.name,
                        Size: videoFile.size,
                        Type: 'video', // Use Type field for consistency
                        status: "published", // Default to published
                        createdAt: serverTimestamp(),
                        uploaderId: user?.uid,
                        uploaderName: user?.displayName,
                    });

                    const newVideo: Video = { id: docRef.id, title, url: videoUrl, duration: videoDuration, Thumbnail: thumbnailUrl, thumbnailPath, path: videoPath, status: 'published', createdAt: new Date() };
                    toast({ title: "Video uploaded successfully!" });
                    onUploadSuccess(newVideo);
                    closeDialog();
                    setIsUploading(false);
                }
            );
        } catch (error) {
            console.error("Upload error:", error);
            toast({ variant: 'destructive', title: "Upload failed" });
            setIsUploading(false);
        }
    }
    
    const formatDuration = (seconds: number | null) => {
        if (seconds === null) return "Will be auto-calculated";
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="video-file">Video File</Label>
                <Input id="video-file" type="file" accept="video/*" onChange={handleVideoFileChange} required disabled={isUploading} />
                {fileName && <p className="text-sm text-muted-foreground">Selected: {fileName}</p>}
            </div>
            <div className="space-y-2">
                <Label htmlFor="video-title">Video Title</Label>
                <Input id="video-title" value={title} onChange={e => setTitle(e.target.value)} required disabled={isUploading} />
            </div>
             <div className="space-y-2">
                <Label htmlFor="duration">Duration</Label>
                <Input id="duration" value={formatDuration(duration)} readOnly disabled />
            </div>
            <div className="space-y-2">
                <Label htmlFor="thumbnail-file">Thumbnail Image (Optional)</Label>
                <Input id="thumbnail-file" type="file" accept="image/*" onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)} disabled={isUploading} />
                 <p className="text-xs text-muted-foreground">If not provided, a thumbnail will be generated from the video.</p>
            </div>
            {isUploading && <Progress value={uploadProgress} className="w-full" />}
            <DialogFooter>
                <Button type="button" variant="secondary" onClick={closeDialog} disabled={isUploading}>Cancel</Button>
                <Button type="submit" disabled={isUploading}>
                    {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isUploading ? `Uploading... ${Math.round(uploadProgress)}%` : 'Upload'}
                </Button>
            </DialogFooter>
        </form>
    );
}

export default function VideosPage() {
    const { user, hasPermission } = useAuth();
    const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
    const [videos, setVideos] = useState<Video[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const canManageContent = hasPermission('manageContent');

    const fetchVideos = useCallback(async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, 'Contents'), where("Type", "==", "video"));
            const querySnapshot = await getDocs(q);
            const videosList = querySnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as Video))
                .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setVideos(videosList);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Failed to fetch videos.' });
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }, [toast]);
    
    useEffect(() => {
        fetchVideos();
    }, [fetchVideos]);

    const handleUploadSuccess = (newVideo: Video) => {
        setVideos(prev => [newVideo, ...prev]);
        setIsUploadDialogOpen(false);
    };
    
    const handleStatusChange = async (video: Video, newStatus: boolean) => {
        const status = newStatus ? 'published' : 'private';
        try {
            const videoDocRef = doc(db, 'Contents', video.id);
            await updateDoc(videoDocRef, { status });
            toast({ title: `Video status changed to ${status}` });
            setVideos(prevVideos => prevVideos.map(v => v.id === video.id ? { ...v, status } : v));
        } catch (error) {
            toast({ variant: 'destructive', title: 'Status update failed' });
            console.error("Status update error: ", error);
        }
    };

    const handleUpdateVideo = (updatedVideo: Video) => {
        setVideos(prevVideos => prevVideos.map(v => v.id === updatedVideo.id ? updatedVideo : v));
    };
    
    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="font-headline text-3xl font-bold md:text-4xl">Content Library - Videos</h1>
                <p className="text-muted-foreground">Manage all video content on the platform.</p>
            </div>
            <Card>
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <CardTitle>Video Management</CardTitle>
                    {canManageContent && (
                        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                            <DialogTrigger asChild>
                                <Button>
                                    <Upload className="mr-2 h-4 w-4" />
                                    Upload New Video
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Upload a new video</DialogTitle>
                                    <DialogDescription>The video will be added to the library.</DialogDescription>
                                </DialogHeader>
                                <VideoUploadForm user={user} onUploadSuccess={handleUploadSuccess} closeDialog={() => setIsUploadDialogOpen(false)} />
                            </DialogContent>
                        </Dialog>
                    )}
                </CardHeader>
                <CardContent>
                    <VideoLibrary 
                        videos={videos} 
                        isLoading={isLoading} 
                        onStatusChange={handleStatusChange} 
                        onDeleteVideo={(videoId) => setVideos(prev => prev.filter(v => v.id !== videoId))}
                        onUpdateVideo={handleUpdateVideo}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
