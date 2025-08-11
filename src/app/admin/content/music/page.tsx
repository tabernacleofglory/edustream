"use client";

import { useState, useEffect, useCallback, FormEvent, MouseEvent, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, getDocs, query, where, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { v4 as uuidv4 } from "uuid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Music, Upload, Loader2, Edit, Trash, PlayCircle, PauseCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import type { User } from "@/lib/types";
import { Track } from "@/hooks/use-audio-player";
import { Switch } from "@/components/ui/switch";

interface StoredAudio {
    id: string;
    title: string;
    url: string;
    path: string;
    status: 'published' | 'private';
    createdAt?: { seconds: number; nanoseconds: number; };
}

const AudioUploadForm = ({ user, onUploadSuccess, closeDialog }: { user: User | null, onUploadSuccess: (newAudio: StoredAudio) => void, closeDialog: () => void }) => {
    const [title, setTitle] = useState('');
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!audioFile || !title) {
            toast({ variant: 'destructive', title: 'Please fill all fields' });
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);
        
        try {
            const audioPath = `contents/music/${uuidv4()}-${audioFile.name}`;
            const storageRef = ref(storage, audioPath);
            const uploadTask = uploadBytesResumable(storageRef, audioFile);

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
                    const audioUrl = await getDownloadURL(uploadTask.snapshot.ref);
                    const now = serverTimestamp();
                    const docRef = await addDoc(collection(db, 'Contents'), {
                        title: title,
                        url: audioUrl,
                        path: audioPath,
                        'File name': audioFile.name,
                        Size: audioFile.size,
                        Type: "audio",
                        status: "private",
                        createdAt: now,
                        uploaderId: user?.uid,
                        uploaderName: user?.displayName,
                    });

                    const newAudio: StoredAudio = { id: docRef.id, title, url: audioUrl, path: audioPath, status: 'private', createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 } };
                    toast({ title: "Music uploaded successfully!" });
                    onUploadSuccess(newAudio);
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

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="audio-title">Music Title</Label>
                <Input id="audio-title" value={title} onChange={e => setTitle(e.target.value)} required disabled={isUploading} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="audio-file">Audio File</Label>
                <Input id="audio-file" type="file" accept="audio/*" onChange={e => setAudioFile(e.target.files?.[0] || null)} required disabled={isUploading} />
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

const AudioEditForm = ({ audio, onUpdateSuccess, closeDialog }: { audio: StoredAudio, onUpdateSuccess: (updatedAudio: StoredAudio) => void, closeDialog: () => void }) => {
    const [title, setTitle] = useState(audio.title);
    const [isUpdating, setIsUpdating] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsUpdating(true);
        try {
            const audioDocRef = doc(db, 'Contents', audio.id);
            await updateDoc(audioDocRef, { title });
            toast({ title: "Music updated!" });
            onUpdateSuccess({ ...audio, title });
            closeDialog();
        } catch (error) {
             toast({ variant: 'destructive', title: "Update failed", description: "Could not update the music details." });
             console.error("Update error: ", error);
        } finally {
            setIsUpdating(false);
        }
    }
    
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
             <div className="space-y-2">
                <Label htmlFor="edit-audio-title">Music Title</Label>
                <Input id="edit-audio-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <DialogFooter>
                 <Button type="button" variant="secondary" onClick={closeDialog}>Cancel</Button>
                <Button type="submit" disabled={isUpdating}>
                    {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                </Button>
            </DialogFooter>
        </form>
    );
}


export default function MusicPage() {
  const { user, isCurrentUserAdmin } = useAuth();
  const [audios, setAudios] = useState<StoredAudio[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [editingAudio, setEditingAudio] = useState<StoredAudio | null>(null);
  const { toast } = useToast();
  const { playTrack, togglePlayPause, currentTrack, isPlaying } = useAudioPlayer();
  const audioTracks = useRef<Track[]>([]);

  const fetchAudios = useCallback(async () => {
    setLoading(true);
    try {
        const q = query(collection(db, 'Contents'), where("Type", "==", "audio"));
        const querySnapshot = await getDocs(q);
        const audiosList = querySnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as StoredAudio))
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)); // Sort client-side
        
        setAudios(audiosList);
         audioTracks.current = audiosList.map(audio => ({
            id: audio.id,
            title: audio.title,
            url: audio.url,
            artist: "Unknown Artist",
            thumbnailUrl: "https://placehold.co/100x100.png?text=?"
        }));
    } catch (error) {
        toast({ variant: 'destructive', title: 'Failed to fetch music.' });
        console.error(error);
    } finally {
        setLoading(false);
    }
  }, [toast]);
  
  useEffect(() => {
    fetchAudios();
  }, [fetchAudios]);
  
  const handleUploadSuccess = (newAudio: StoredAudio) => {
    const updatedAudios = [newAudio, ...audios].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    setAudios(updatedAudios);
     audioTracks.current = updatedAudios.map(audio => ({
        id: audio.id,
        title: audio.title,
        url: audio.url,
        artist: "Unknown Artist",
        thumbnailUrl: "https://placehold.co/100x100.png?text=?"
    }));
    setIsUploadDialogOpen(false);
  }

  const handleUpdateSuccess = (updatedAudio: StoredAudio) => {
      const updatedAudios = audios.map(aud => aud.id === updatedAudio.id ? updatedAudio : aud);
      setAudios(updatedAudios);
      audioTracks.current = audioTracks.current.map(track => track.id === updatedAudio.id ? { ...track, title: updatedAudio.title } : track);
      setEditingAudio(null);
  }
  
  const handleDelete = async (audio: StoredAudio) => {
      if (!window.confirm("Are you sure you want to delete this audio track? This cannot be undone.")) return;
      
      try {
          const audioStorageRef = ref(storage, audio.path);
          await deleteObject(audioStorageRef);
          await deleteDoc(doc(db, 'Contents', audio.id));
          const newAudios = audios.filter(aud => aud.id !== audio.id);
          setAudios(newAudios);
          audioTracks.current = audioTracks.current.filter(track => track.id !== audio.id);
          toast({ title: "Music deleted successfully." });
      } catch (error) {
           toast({ variant: 'destructive', title: "Delete failed.", description: "Could not delete the music track." });
           console.error("Delete error: ", error);
      }
  }

  const handlePlayClick = (trackToPlay: Track) => {
    if (currentTrack?.id === trackToPlay.id) {
        togglePlayPause();
    } else {
        playTrack(trackToPlay, audioTracks.current);
    }
  }
  
  const handleStatusChange = async (audio: StoredAudio, newStatus: boolean) => {
    const status = newStatus ? 'published' : 'private';
    try {
        const audioDocRef = doc(db, 'Contents', audio.id);
        await updateDoc(audioDocRef, { status });
        toast({ title: `Music status changed to ${status}` });
        setAudios(prevAudios => prevAudios.map(a => a.id === audio.id ? { ...a, status } : a));
    } catch (error) {
        toast({ variant: 'destructive', title: 'Status update failed' });
        console.error("Status update error: ", error);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold md:text-4xl">
          Content Library - Music
        </h1>
        <p className="text-muted-foreground">
          Manage all music and audio tracks on the platform.
        </p>
      </div>
      <Card className="flex-1">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle>Music Management</CardTitle>
          {isCurrentUserAdmin && (
             <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
                <DialogTrigger asChild>
                    <Button>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload New Music
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Upload new music</DialogTitle>
                        <DialogDescription>
                            The audio file will be added to the library.
                        </DialogDescription>
                    </DialogHeader>
                    <AudioUploadForm user={user} onUploadSuccess={handleUploadSuccess} closeDialog={() => setIsUploadDialogOpen(false)} />
                </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
           <div className="space-y-2">
                {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex items-center justify-between p-2">
                            <Skeleton className="h-8 w-3/4" />
                            <div className="flex gap-2">
                                <Skeleton className="h-8 w-8 rounded-md" />
                                <Skeleton className="h-8 w-8 rounded-md" />
                            </div>
                        </div>
                    ))
                ) : audios.length > 0 ? (
                    audios.map(audio => (
                        <div key={audio.id} className="flex items-center p-2 hover:bg-muted/50 rounded-md">
                           <Button variant="ghost" size="icon" onClick={() => handlePlayClick(audioTracks.current.find(t => t.id === audio.id)!)}>
                                {isPlaying && currentTrack?.id === audio.id ? <PauseCircle className="h-5 w-5" /> : <PlayCircle className="h-5 w-5" />}
                           </Button>
                           <p className="flex-1 ml-2 font-medium truncate">{audio.title}</p>
                            <div className="flex items-center gap-4">
                               <div className="flex items-center space-x-2">
                                   <Switch
                                       id={`status-switch-${audio.id}`}
                                       checked={audio.status === 'published'}
                                       onCheckedChange={(newStatus) => handleStatusChange(audio, newStatus)}
                                   />
                                   <Label htmlFor={`status-switch-${audio.id}`} className="text-sm">{audio.status === 'published' ? 'Published' : 'Private'}</Label>
                               </div>
                                <Button size="icon" className="text-white bg-gradient-to-r from-pink-500 to-orange-400 hover:from-pink-600 hover:to-orange-500" onClick={() => setEditingAudio(audio)}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="destructive" onClick={() => handleDelete(audio)}>
                                    <Trash className="h-4 w-4" />
                                </Button>
                           </div>
                        </div>
                    ))
                ) : (
                    <div className="col-span-full text-center text-muted-foreground py-12 flex flex-col items-center">
                        <Music className="h-12 w-12" />
                        <p className="mt-4">No music in the library. Upload something to get started.</p>
                    </div>
                )}
            </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingAudio} onOpenChange={(isOpen) => !isOpen && setEditingAudio(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Music</DialogTitle>
            <DialogDescription>Update the details for this audio track.</DialogDescription>
          </DialogHeader>
          {editingAudio && (
            <AudioEditForm 
              audio={editingAudio} 
              onUpdateSuccess={handleUpdateSuccess} 
              closeDialog={() => setEditingAudio(null)} 
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
