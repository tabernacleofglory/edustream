
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { db, storage } from "@/lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
} from "firebase/firestore";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { v4 as uuidv4 } from "uuid";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, Youtube, FolderKanban } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { User, Video } from "@/lib/types";
import VideoLibrary from "@/components/video-library";
import { Switch } from "@/components/ui/switch";

export default function VideosPage() {
  const { user, hasPermission } = useAuth();
  const [isYouTubeDialogOpen, setIsYouTubeDialogOpen] = useState(false);
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [youTubeUrl, setYouTubeUrl] = useState('');
  const [isSubmittingYouTube, setIsSubmittingYouTube] = useState(false);
  const { toast } = useToast();
  const canManageContent = hasPermission("manageContent");
  const [isGoogleDriveDialogOpen, setIsGoogleDriveDialogOpen] = useState(false);
  const [googleDriveUrl, setGoogleDriveUrl] = useState('');
  const [googleDriveTitle, setGoogleDriveTitle] = useState('');
  const [isSubmittingGoogleDrive, setIsSubmittingGoogleDrive] = useState(false);

  const fetchVideos = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "Contents"), where("Type", "in", ["video", "youtube", "googledrive"]));
      const querySnapshot = await getDocs(q);
      const videosList = querySnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as Video))
        .sort(
          (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
        );
      setVideos(videosList);
    } catch (error) {
      toast({ variant: "destructive", title: "Failed to fetch videos." });
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const handleAddYouTubeVideo = async () => {
    if (!youTubeUrl) {
      toast({ variant: 'destructive', title: 'Please enter a YouTube URL' });
      return;
    }
    
    const q = query(collection(db, 'Contents'), where('url', '==', youTubeUrl));
    const existing = await getDocs(q);
    if (!existing.empty) {
        const existingVideoTitle = existing.docs[0].data().title;
        toast({
            variant: 'destructive',
            title: 'Duplicate Video',
            description: `This video already exists in the library as "${existingVideoTitle}".`,
        });
        return;
    }
  
    setIsSubmittingYouTube(true);
    try {
      const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(youTubeUrl)}&format=json`);
      if (!response.ok) {
        throw new Error('Could not fetch video details. Please check the URL and ensure the video is public.');
      }
      
      const responseText = await response.text();
      let videoData;
      try {
        videoData = JSON.parse(responseText);
      } catch (e) {
        throw new Error("Received an invalid response from YouTube. The video may be private or unavailable.");
      }

      const videoTitle = videoData.title || 'YouTube Video';
  
      const docRef = await addDoc(collection(db, 'Contents'), {
        title: videoTitle,
        url: youTubeUrl,
        Type: "youtube",
        Thumbnail: videoData.thumbnail_url,
        status: 'published',
        createdAt: serverTimestamp(),
        uploaderId: user?.uid,
      });
  
      const newVideo: Video = {
        id: docRef.id,
        title: videoTitle,
        url: youTubeUrl,
        Thumbnail: videoData.thumbnail_url || '',
        duration: 0,
        path: '',
        thumbnailPath: '',
        createdAt: new Date(),
        type: 'youtube',
      };
  
      toast({ title: "YouTube video added" });
      setVideos(prev => [newVideo, ...prev]);
      setYouTubeUrl('');
      setIsYouTubeDialogOpen(false);
    } catch (error: any) {
      console.error("Error adding YouTube video:", error);
      toast({ variant: 'destructive', title: "Failed to add YouTube video", description: error.message });
    } finally {
      setIsSubmittingYouTube(false);
    }
  };

  const handleAddGoogleDriveVideo = async () => {
    if (!googleDriveUrl || !googleDriveTitle) {
      toast({ variant: 'destructive', title: 'URL and Title are required.' });
      return;
    }

     // Check for duplicates
    const q = query(collection(db, 'Contents'), where('url', '==', googleDriveUrl));
    const existing = await getDocs(q);
    if (!existing.empty) {
        const existingVideoTitle = existing.docs[0].data().title;
        toast({
            variant: 'destructive',
            title: 'Duplicate Video',
            description: `This video already exists in the library as "${existingVideoTitle}".`,
        });
        return;
    }

    setIsSubmittingGoogleDrive(true);
    try {
      await addDoc(collection(db, 'Contents'), {
        title: googleDriveTitle,
        url: googleDriveUrl,
        Type: "googledrive",
        status: 'published',
        createdAt: serverTimestamp(),
        uploaderId: user?.uid,
      });
      toast({ title: "Google Drive video added" });
      fetchVideos();
      setGoogleDriveUrl('');
      setGoogleDriveTitle('');
      setIsGoogleDriveDialogOpen(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: "Failed to add video", description: error.message });
    } finally {
      setIsSubmittingGoogleDrive(false);
    }
  };

  const handleStatusChange = async (video: Video, newStatus: boolean) => {
    const status = newStatus ? "published" : "private";
    try {
      const videoDocRef = doc(db, "Contents", video.id);
      await updateDoc(videoDocRef, { status });
      toast({ title: `Video status changed to ${status}` });
      setVideos((prevVideos) =>
        prevVideos.map((v) =>
          v.id === video.id ? { ...v, status } : v
        )
      );
    } catch (error) {
      toast({ variant: "destructive", title: "Status update failed" });
      console.error("Status update error: ", error);
    }
  };

  const handleUpdateVideo = (updatedVideo: Video) => {
    setVideos((prevVideos) =>
      prevVideos.map((v) => (v.id === updatedVideo.id ? updatedVideo : v))
    );
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold md:text-4xl">
          Content Library - Videos
        </h1>
        <p className="text-muted-foreground">
          Manage all video content on the platform.
        </p>
      </div>
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle>Video Management</CardTitle>
          {canManageContent && (
            <div className="flex flex-col sm:flex-row gap-2">
            <Dialog
              open={isYouTubeDialogOpen}
              onOpenChange={setIsYouTubeDialogOpen}
            >
              <DialogTrigger asChild>
                <Button>
                  <Youtube className="mr-2 h-4 w-4" />
                  Add from YouTube
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add YouTube Video</DialogTitle>
                  <DialogDescription>
                    Paste the full YouTube video URL below.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <Label htmlFor="youtube-url">YouTube URL</Label>
                  <Input
                    id="youtube-url"
                    value={youTubeUrl}
                    onChange={(e) => setYouTubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setIsYouTubeDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleAddYouTubeVideo}
                    disabled={isSubmittingYouTube}
                  >
                    {isSubmittingYouTube && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Add to Library
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog
                open={isGoogleDriveDialogOpen}
                onOpenChange={setIsGoogleDriveDialogOpen}
            >
                <DialogTrigger asChild>
                    <Button variant='outline'>
                        <FolderKanban className="mr-2 h-4 w-4" />
                        Add from Google Drive
                    </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                      <DialogTitle>Add from Google Drive</DialogTitle>
                      <DialogDescription>Paste the public share link and enter a title.</DialogDescription>
                  </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                          <Label htmlFor="gdrive-title">Video Title</Label>
                          <Input id="gdrive-title" value={googleDriveTitle} onChange={(e) => setGoogleDriveTitle(e.target.value)} placeholder="Enter video title" />
                      </div>
                        <div className="space-y-2">
                          <Label htmlFor="gdrive-url">Google Drive Share URL</Label>
                          <Input id="gdrive-url" value={googleDriveUrl} onChange={(e) => setGoogleDriveUrl(e.target.value)} placeholder="https://drive.google.com/..." />
                      </div>
                  </div>
                  <DialogFooter>
                      <Button variant="secondary" onClick={() => setIsGoogleDriveDialogOpen(false)}>Cancel</Button>
                      <Button onClick={handleAddGoogleDriveVideo} disabled={isSubmittingGoogleDrive}>
                          {isSubmittingGoogleDrive && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Add to Library
                      </Button>
                  </DialogFooter>
                </DialogContent>
            </Dialog>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <VideoLibrary
            videos={videos}
            isLoading={isLoading}
            onStatusChange={handleStatusChange}
            onDeleteVideo={(videoId) =>
              setVideos((prev) => prev.filter((v) => v.id !== videoId))
            }
            onUpdateVideo={handleUpdateVideo}
          />
        </CardContent>
      </Card>
    </div>
  );
}
