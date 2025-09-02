
"use client"

import { useForm, useFieldArray, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getFirebaseFirestore, getFirebaseStorage } from '@/lib/firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp, writeBatch, getDoc, query, where, getDocs, deleteDoc, orderBy, documentId } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Trash, PlusCircle, Loader2, Video, Link as LinkIcon, Library, Award, Settings2, ChevronDown, Image as ImageIcon, FileText, FileType, File as FileIcon, FileImage, X, Minus, GripVertical, FileQuestion } from 'lucide-react';
import { useState, useEffect, useCallback, ChangeEvent, FormEvent } from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useAuth } from '@/hooks/use-auth';
import VideoLibrary from './video-library';
import type { Video as VideoType, Course, Ladder, Speaker, QuizQuestion, Quiz } from '@/lib/types';
import DocumentLibrary from './document-library';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import LogoLibrary from './logo-library';
import CertificateBackgroundLibrary from './certificate-background-library';
import { ScrollArea } from './ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import QuizLibrary from './quiz-library';


const attendanceLinkSchema = z.object({
    title: z.string().min(1, "Link title is required"),
    url: z.string().url({ message: "Please enter a valid URL" }),
});

const resourceSchema = z.object({
    title: z.string().min(1, "Resource title is required"),
    file: z.any().optional(),
    url: z.string().optional(),
    id: z.string().optional(),
    "File name": z.string().optional(),
}).refine(data => data.file || data.url, {
    message: "A file or a selected document is required.",
    path: ["file"],
});

const courseSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  Category: z.array(z.string()).min(1, "At least one Category is required"),
  ladderIds: z.array(z.string()).min(1, "At least one Class Ladder is required"),
  speakerId: z.string().optional(),
  thumbnailFile: z.any().optional(),
  videos: z.array(z.object({
    id: z.string(),
    title: z.string(),
    Thumbnail: z.string().optional()
  })).min(1, "At least one video is required."),
  attendanceLinks: z.array(attendanceLinkSchema).optional(),
  resources: z.array(resourceSchema).optional(),
  quizIds: z.array(z.string()).optional(),
  certificateTemplateUrl: z.string().url("Please select a valid certificate background.").optional().or(z.literal('')),
  logoUrl: z.string().url("Please select a valid logo.").optional().or(z.literal('')),
  status: z.enum(['published', 'draft']).default('draft'),
  order: z.number().optional(),
});

type CourseFormValues = z.infer<typeof courseSchema>;

interface StoredItem {
    id: string;
    name: string;
}

interface AddCourseFormProps {
    allCourses: Course[]; // Pass all courses for order calculation
    onCourseUpdated?: () => void;
}

interface CertificateTemplate {
    id: string;
    title: string;
    url: string;
}

const SpeakerManager = ({ speakers, onSpeakersUpdate }: { speakers: Speaker[], onSpeakersUpdate: () => void }) => {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newSpeakerName, setNewSpeakerName] = useState("");
    const [newSpeakerPhoto, setNewSpeakerPhoto] = useState<File | null>(null);
    const db = getFirebaseFirestore();
    const storage = getFirebaseStorage();

    const handleAddSpeaker = async (e: FormEvent) => {
        e.preventDefault();
        if (!newSpeakerName || !newSpeakerPhoto) {
            toast({ variant: "destructive", title: "Name and photo are required." });
            return;
        }
        setIsSubmitting(true);
        try {
            const photoPath = `speakers/${uuidv4()}-${newSpeakerPhoto.name}`;
            const photoRef = ref(storage, photoPath);
            await uploadBytes(photoRef, newSpeakerPhoto);
            const photoURL = await getDownloadURL(photoRef);

            await addDoc(collection(db, 'speakers'), {
                name: newSpeakerName,
                photoURL: photoURL,
                createdAt: serverTimestamp(),
            });

            toast({ title: "Speaker Added" });
            setNewSpeakerName("");
            setNewSpeakerPhoto(null);
            onSpeakersUpdate();
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Failed to add speaker." });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDeleteSpeaker = async (speaker: Speaker) => {
        try {
            await deleteDoc(doc(db, 'speakers', speaker.id));
            if (speaker.photoURL) {
                const photoRef = ref(storage, speaker.photoURL);
                await deleteObject(photoRef).catch(err => console.warn("Could not delete speaker photo", err));
            }
            toast({ title: "Speaker Deleted" });
            onSpeakersUpdate();
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: "Failed to delete speaker." });
        }
    }

    return (
        <div className="space-y-4">
            <h4 className="font-medium">Existing Speakers</h4>
            <ScrollArea className="h-48 border rounded-md">
                {speakers.map(speaker => (
                    <div key={speaker.id} className="flex items-center justify-between p-2 border-b">
                        <div className="flex items-center gap-2">
                           <Image src={speaker.photoURL} alt={speaker.name} width={32} height={32} className="rounded-full" />
                           <span>{speaker.name}</span>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon"><Trash className="h-4 w-4 text-destructive" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>This will permanently delete the speaker "{speaker.name}".</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteSpeaker(speaker)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                    </div>
                ))}
            </ScrollArea>
             <form onSubmit={handleAddSpeaker} className="space-y-4 pt-4 border-t">
                 <h4 className="font-medium">Add New Speaker</h4>
                 <div className="space-y-2">
                    <Label htmlFor="new-speaker-name">Name</Label>
                    <Input id="new-speaker-name" value={newSpeakerName} onChange={e => setNewSpeakerName(e.target.value)} disabled={isSubmitting} />
                 </div>
                 <div className="space-y-2">
                    <Label htmlFor="new-speaker-photo">Photo</Label>
                    <Input id="new-speaker-photo" type="file" accept="image/*" onChange={e => setNewSpeakerPhoto(e.target.files?.[0] || null)} disabled={isSubmitting} />
                 </div>
                 <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add Speaker
                 </Button>
            </form>
        </div>
    );
};


export default function AddCourseForm({ allCourses, onCourseUpdated }: AddCourseFormProps) {
    const { toast } = useToast();
    const { user, hasPermission } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [course, setCourse] = useState<Course | null>(null);

    const [categories, setCategories] = useState<StoredItem[]>([]);
    const [newCategory, setNewCategory] = useState('');
    const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);

    const [levels, setLevels] = useState<Ladder[]>([]);
    const [speakers, setSpeakers] = useState<Speaker[]>([]);
    const [isSpeakerManagerOpen, setIsSpeakerManagerOpen] = useState(false);
    const [libraryVideos, setLibraryVideos] = useState<VideoType[]>([]);
    const [isQuizLibraryOpen, setIsQuizLibraryOpen] = useState(false);
    const [libraryQuizzes, setLibraryQuizzes] = useState<Quiz[]>([]);
    const [isVideoLibraryOpen, setIsVideoLibraryOpen] = useState(false);
    const [isDocLibraryOpen, setIsDocLibraryOpen] = useState(false);
    const [isLogoLibraryOpen, setIsLogoLibraryOpen] = useState(false);
    const [isCertLibraryOpen, setIsCertLibraryOpen] = useState(false);

    const db = getFirebaseFirestore();
    const storage = getFirebaseStorage();
    const editCourseId = searchParams.get('editCourseId');
    const isDuplicateMode = searchParams.get('duplicate') === 'true';
    const isEditMode = !!editCourseId;
    const canManageSettings = hasPermission('manageContent'); // Example permission

     const fetchItems = useCallback(async (collectionName: string, setter: React.Dispatch<React.SetStateAction<any[]>>, orderByField = "name") => {
        try {
            const q = query(collection(db, collectionName), orderBy(orderByField));
            const querySnapshot = await getDocs(q);
            const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setter(items);
        } catch (error) {
            toast({ variant: 'destructive', title: `Failed to fetch ${collectionName}` });
        }
    }, [toast, db]);

    useEffect(() => {
        fetchItems('courseCategories', setCategories);
        fetchItems('courseLevels', setLevels, 'order');
        fetchItems('speakers', setSpeakers, 'name');
    }, [fetchItems]);
    
     const fetchLibraryVideos = useCallback(async () => {
        try {
            const q = query(collection(db, 'Contents'), where("Type", "==", "video"));
            const querySnapshot = await getDocs(q);
            const videosList = querySnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as VideoType))
            setLibraryVideos(videosList.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
        } catch (error) {
            toast({ variant: 'destructive', title: 'Failed to fetch video library.' });
            console.error(error);
        }
    }, [db, toast]);

    const fetchLibraryQuizzes = useCallback(async () => {
        try {
            const q = query(collection(db, 'quizzes'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const quizzesList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quiz));
            setLibraryQuizzes(quizzesList);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Failed to fetch quiz library.' });
        }
    }, [db, toast]);

    useEffect(() => {
        fetchLibraryVideos();
        fetchLibraryQuizzes();
    }, [fetchLibraryVideos, fetchLibraryQuizzes]);


    const {
        register,
        control,
        handleSubmit,
        reset,
        setValue,
        watch,
        getValues,
        formState: { errors },
    } = useForm<CourseFormValues>({
        resolver: zodResolver(courseSchema),
        defaultValues: {
            title: '',
            description: '',
            Category: [],
            ladderIds: [],
            speakerId: '',
            videos: [],
            attendanceLinks: [],
            resources: [],
            quizIds: [],
            certificateTemplateUrl: '',
            logoUrl: '',
            status: 'draft',
            order: 0,
        }
    });

    const watchLadderIds = watch('ladderIds', []);
    const watchCategory = watch('Category', []);
    const watchLogoUrl = watch('logoUrl');
    const watchCertificateUrl = watch('certificateTemplateUrl');
    const watchOrder = watch('order');
    const watchQuizIds = watch('quizIds', []);
    
    // Auto-calculate order when ladderIds change
    useEffect(() => {
        if (isEditMode && !isDuplicateMode) return; // Don't auto-change order when editing an existing course

        if (watchLadderIds && watchLadderIds.length > 0 && Array.isArray(allCourses)) {
            // Find the highest order number among courses in ANY of the selected ladders
            const coursesInSelectedLadders = allCourses.filter(c => 
                c.id !== course?.id &&
                c.ladderIds && c.ladderIds.some(id => watchLadderIds.includes(id))
            );

            const maxOrder = coursesInSelectedLadders.reduce((max, c) => Math.max(max, c.order ?? -1), -1);
            setValue('order', maxOrder + 1);
        } else if (!isEditMode) {
            setValue('order', 0);
        }
    }, [watchLadderIds, allCourses, setValue, isEditMode, course, isDuplicateMode]);


    useEffect(() => {
        const fetchCourseToEdit = async (id: string) => {
            const courseDocRef = doc(db, 'courses', id);
            const courseSnap = await getDoc(courseDocRef);
            if(courseSnap.exists()) {
                const courseData = courseSnap.data() as Course;
                
                const fetchVideoDetails = async (videoIds: string[]) => {
                    if (!videoIds || videoIds.length === 0) return [];
                    const videosData = await Promise.all(
                        videoIds.map(id => getDoc(doc(db, 'Contents', id)))
                    );
                    return videoIds.map((id, index) => {
                        const videoSnap = videosData[index];
                        const video = videoSnap.exists() ? { id: videoSnap.id, ...videoSnap.data() } as VideoType : null;
                        return {
                            id,
                            title: video?.title || 'Video',
                            Thumbnail: video?.Thumbnail
                        };
                    });
                };
                
                const fetchResourceDetails = async (resourceUrls: string[]) => {
                    if (!resourceUrls || resourceUrls.length === 0) return [];
                     const resourceDocsQuery = query(collection(db, 'Contents'), where('url', 'in', resourceUrls));
                    const querySnapshot = await getDocs(resourceDocsQuery);
                    return querySnapshot.docs.map(docSnap => {
                        const data = docSnap.data();
                        return {
                            id: docSnap.id,
                            title: data.title || data['File name'],
                            url: data.url,
                            "File name": data['File name'],
                        };
                    });
                };

                const videoDetails = await fetchVideoDetails(courseData.videos || []);
                const resourceDetails = await fetchResourceDetails(courseData["Resource Doc"] || []);
                
                if (isDuplicateMode) {
                    setCourse(null);
                } else {
                    setCourse(courseData);
                }

                reset({
                  title: isDuplicateMode ? `${courseData.title} (Copy)` : courseData.title,
                  description: courseData.description,
                  Category: Array.isArray(courseData.Category) ? courseData.Category : (courseData.Category ? [courseData.Category] : []),
                  ladderIds: courseData.ladderIds || [],
                  speakerId: courseData.speakerId || '',
                  thumbnailFile: courseData['Image ID'],
                  videos: videoDetails,
                  attendanceLinks: courseData.attendanceLinks || [],
                  resources: resourceDetails,
                  quizIds: courseData.quizIds || [],
                  certificateTemplateUrl: courseData.certificateTemplateUrl || '',
                  logoUrl: courseData.logoUrl,
                  status: courseData.status || 'draft',
                  order: courseData.order ?? 0,
                });
            }
        };

        if (editCourseId) {
            fetchCourseToEdit(editCourseId);
        } else {
            reset();
            setCourse(null);
        }
    }, [editCourseId, reset, db, isDuplicateMode]);

    const { fields: videoFields, replace: replaceVideos, remove: removeVideo } = useFieldArray({
        control,
        name: "videos"
    });

    const { fields: attendanceFields, append: appendAttendance, remove: removeAttendance } = useFieldArray({
        control,
        name: "attendanceLinks"
    });

     const { fields: resourceFields, append: appendResource, remove: removeResource, replace: replaceResources } = useFieldArray({
        control,
        name: "resources"
    });


    const handleAddItem = async (collectionName: string, itemName: string, setter: React.Dispatch<React.SetStateAction<any[]>>, formField: "Category", onSuccess?: () => void) => {
        if (itemName.trim()) {
            const docRef = await addDoc(collection(db, collectionName), { name: itemName.trim() });
            const newItem = { id: docRef.id, name: itemName.trim() };
            setter(prev => [...prev, newItem].sort((a,b) => a.name.localeCompare(b.name)));
            if (formField === 'Category') {
                 setValue('Category', [...watch('Category', []), newItem.name], { shouldValidate: true });
            }
            toast({ title: `${formField} Added`, description: `"${itemName.trim()}" has been added.` });
            onSuccess?.();
        }
    }

    const handleSelectVideos = (selectedVideos: VideoType[]) => {
        const newVideos = selectedVideos.map(v => ({ id: v.id, title: v.title, Thumbnail: v.Thumbnail }));
        replaceVideos(newVideos);
        setIsVideoLibraryOpen(false);
    }

    const handleSelectDocuments = (selectedDocs: any[]) => {
        const newResources = selectedDocs.map(d => ({
            id: d.id,
            title: d.title || d['File name'],
            url: d.url,
            "File name": d['File name'],
        }));
        replaceResources(newResources);
        setIsDocLibraryOpen(false);
    }

    const handleSelectLogo = (logo: { id: string, url: string }) => {
        setValue('logoUrl', logo.url, { shouldValidate: true });
        setIsLogoLibraryOpen(false);
    }

    const handleSelectCertificate = (cert: { id: string, url: string }) => {
        setValue('certificateTemplateUrl', cert.url, { shouldValidate: true });
        setIsCertLibraryOpen(false);
    }
    
    const handleSelectQuizzes = (quizzes: Quiz[]) => {
        const quizIds = quizzes.map(q => q.id);
        setValue('quizIds', quizIds, { shouldValidate: true });
        setIsQuizLibraryOpen(false);
    };

    const onSubmit: SubmitHandler<CourseFormValues> = async (data) => {
        if (!user) {
            toast({ variant: 'destructive', title: 'You must be logged in to create a course.' });
            return;
        }
        setIsSubmitting(true);
        const orderValue = getValues('order') ?? 0;
        
        const isActuallyEditing = isEditMode && !isDuplicateMode;

        if (Array.isArray(allCourses)) {
            const coursesInSelectedLadders = allCourses.filter(c => 
                c.id !== (isActuallyEditing ? editCourseId : undefined) && 
                c.ladderIds?.some(id => data.ladderIds.includes(id))
            );

            const conflictingCourse = coursesInSelectedLadders.find(c => c.order === orderValue);
            if (conflictingCourse) {
                const conflictingLadder = levels.find(l => conflictingCourse.ladderIds.includes(l.id) && data.ladderIds.includes(l.id));
                toast({
                    variant: 'destructive',
                    title: 'Duplicate Order Number',
                    description: `Another course ("${conflictingCourse.title}") in the "${conflictingLadder?.name || 'selected'}" ladder already has the order number ${orderValue}. Please choose a unique order number for this ladder.`,
                    duration: 6000,
                });
                setIsSubmitting(false);
                return;
            }
        }

        try {
            let courseThumbnailUrl = course?.['Image ID'] || '';

            if (data.thumbnailFile && typeof data.thumbnailFile !== 'string' && data.thumbnailFile.length > 0) {
                const courseThumbnailFile = data.thumbnailFile[0];
                const courseThumbnailRef = ref(storage, `course-thumbnails/${uuidv4()}-${courseThumbnailFile.name}`);
                await uploadBytes(courseThumbnailRef, courseThumbnailFile);
                courseThumbnailUrl = await getDownloadURL(courseThumbnailRef);
            } else if (!courseThumbnailUrl && data.videos.length > 0 && data.videos[0].Thumbnail) {
                courseThumbnailUrl = data.videos[0].Thumbnail;
            }

            if (!courseThumbnailUrl) {
                toast({
                    variant: 'destructive',
                    title: 'Thumbnail Required',
                    description: 'Please upload a thumbnail or add a video with a thumbnail to the course.',
                });
                setIsSubmitting(false);
                return;
            }

            const videoIds = data.videos?.map(v => v.id) || [];
            const ladderNames = data.ladderIds.map(id => levels.find(l => l.id === id)?.name).filter(Boolean) as string[];
            const resourceUrls = data.resources?.map(r => r.url).filter(Boolean) as string[] || [];


            const courseData: Partial<Course> = {
                title: data.title,
                description: data.description,
                Category: data.Category,
                ladders: ladderNames,
                ladderIds: data.ladderIds,
                speakerId: data.speakerId,
                "Image ID": courseThumbnailUrl,
                videos: videoIds,
                attendanceLinks: data.attendanceLinks,
                quizIds: data.quizIds,
                "Resource Doc": resourceUrls,
                tags: [...data.Category, ...ladderNames],
                status: data.status,
                updatedAt: serverTimestamp(),
                certificateTemplateUrl: data.certificateTemplateUrl,
                logoUrl: data.logoUrl,
                creatorId: course?.creatorId || user.uid,
                order: orderValue,
            };

            if (isActuallyEditing) {
                const courseRef = doc(db, 'courses', editCourseId!);
                await updateDoc(courseRef, courseData);
                toast({ title: "Course Updated!" });
                onCourseUpdated?.();
            } else {
                await addDoc(collection(db, 'courses'), { ...courseData, createdAt: serverTimestamp() });
                toast({ title: "Course Created!" });
                onCourseUpdated ? onCourseUpdated() : reset();
            }

        } catch (error: any) {
            console.error("Error saving course: ", error);
            toast({
                variant: 'destructive',
                title: 'Error Saving Course',
                description: error.message || 'An unexpected error occurred.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const getFileIcon = (fileName?: string) => {
        if (!fileName) return <FileIcon className="h-5 w-5 text-muted-foreground" />;
        const extension = fileName.split('.').pop()?.toLowerCase();
        switch(extension) {
            case 'pdf': return <FileImage className="h-5 w-5 text-red-500" />;
            case 'doc': case 'docx': return <FileType className="h-5 w-5 text-blue-500" />;
            case 'txt': return <FileText className="h-5 w-5 text-gray-500" />;
            default: return <FileIcon className="h-5 w-5 text-muted-foreground" />;
        }
    }


    return (
        <Tabs defaultValue="info" className="w-full">
            <div className="sticky top-0 bg-background z-10 p-6 -mx-6 mb-6 border-b">
                 <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="info">Course Info</TabsTrigger>
                    <TabsTrigger value="content">Content</TabsTrigger>
                    <TabsTrigger value="quiz">Quiz</TabsTrigger>
                    <TabsTrigger value="attachments">Attachments</TabsTrigger>
                </TabsList>
            </div>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 pb-24">
                <TabsContent value="info" className="space-y-8">
                     <Card>
                        <CardHeader>
                            <CardTitle>Course Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="title">Course Title</Label>
                                <Input id="title" {...register('title')} />
                                {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
                            </div>
                            <div>
                                <Label htmlFor="description">Description</Label>
                                <Textarea id="description" {...register('description')} rows={4} />
                                {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
                            </div>
                            <div>
                                <Label htmlFor="thumbnailFile">Course Thumbnail</Label>
                                <Input id="thumbnailFile" type="file" accept="image/*" {...register('thumbnailFile')} />
                                <p className="text-xs text-muted-foreground">Optional. If not provided, the first video's thumbnail is used.</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Details, Status & Priority</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             <div className="flex items-center space-x-2">
                                <Controller
                                    control={control}
                                    name="status"
                                    render={({ field }) => (
                                        <Switch
                                            id="status"
                                            checked={field.value === 'published'}
                                            onCheckedChange={(checked) => field.onChange(checked ? 'published' : 'draft')}
                                        />
                                    )}
                                />
                                <Label htmlFor="status">
                                {watch('status') === 'published' ? 'Published' : 'Draft'}
                                </Label>
                            </div>
                            <div>
                                <Label htmlFor="order">Course Priority (Order)</Label>
                                <div className="flex items-center gap-2 mt-1">
                                    <Button type='button' variant="outline" size="icon" onClick={() => setValue('order', Math.max(0, (watchOrder || 0) - 1))}>
                                        <Minus className="h-4 w-4" />
                                    </Button>
                                    <div className="w-20 h-10 flex items-center justify-center border rounded-md font-mono text-lg">
                                        {watchOrder}
                                    </div>
                                    <Button type='button' variant="outline" size="icon" onClick={() => setValue('order', (watchOrder || 0) + 1)}>
                                        <PlusCircle className="h-4 w-4" />
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">Lower numbers appear first within a ladder. This is auto-suggested.</p>
                                {errors.order && <p className="text-sm text-destructive">{errors.order.message}</p>}
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <Label>Category</Label>
                                    <Controller
                                        name="Category"
                                        control={control}
                                        render={({ field }) => (
                                            <>
                                            <div className="flex items-center gap-2">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="outline" className="w-full justify-start">Select Categories</Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                                                        {categories.map((cat) => (
                                                            <DropdownMenuCheckboxItem
                                                                key={cat.id}
                                                                checked={field.value?.includes(cat.name)}
                                                                onCheckedChange={(checked) => {
                                                                    const newValue = checked
                                                                        ? [...(field.value || []), cat.name]
                                                                        : (field.value || []).filter((name) => name !== cat.name);
                                                                    field.onChange(newValue);
                                                                }}
                                                            >
                                                                {cat.name}
                                                            </DropdownMenuCheckboxItem>
                                                        ))}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                                <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                                                    <DialogTrigger asChild>
                                                        <Button type="button" variant="outline" size="sm">Manage</Button>
                                                    </DialogTrigger>
                                                    <DialogContent>
                                                        <DialogHeader>
                                                            <DialogTitle>Manage Categories</DialogTitle>
                                                        </DialogHeader>
                                                        <div className="space-y-2">
                                                            <Label htmlFor="new-category">New Category Name</Label>
                                                            <Input id="new-category" value={newCategory} onChange={e => setNewCategory(e.target.value)} />
                                                        </div>
                                                        <DialogFooter>
                                                            <Button type="button" onClick={() => handleAddItem('courseCategories', newCategory, setCategories, 'Category', () => setNewCategory(''))}>Add Category</Button>
                                                        </DialogFooter>
                                                    </DialogContent>
                                                </Dialog>
                                            </div>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {field.value?.map(catName => (
                                                    <Badge key={catName} variant="secondary">
                                                        {catName}
                                                        <button type="button" onClick={() => field.onChange(field.value?.filter(name => name !== catName))} className="ml-1 rounded-full p-0.5 hover:bg-background/50">
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </Badge>
                                                ))}
                                            </div>
                                            </>
                                        )}
                                    />
                                    {errors.Category && <p className="text-sm text-destructive">{errors.Category.message}</p>}
                                </div>
                                <div>
                                    <Label>Class Ladders</Label>
                                    <Controller
                                        name="ladderIds"
                                        control={control}
                                        render={({ field }) => (
                                            <>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="outline" className="w-full justify-start">Select Ladders</Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                                                        {levels.map((level) => (
                                                            <DropdownMenuCheckboxItem
                                                                key={level.id}
                                                                checked={field.value?.includes(level.id)}
                                                                onCheckedChange={(checked) => {
                                                                    const newValue = checked
                                                                        ? [...(field.value || []), level.id]
                                                                        : (field.value || []).filter((id) => id !== level.id);
                                                                    field.onChange(newValue);
                                                                }}
                                                            >
                                                                {level.name} {level.side && level.side !== 'none' ? `(${level.side})` : ''}
                                                            </DropdownMenuCheckboxItem>
                                                        ))}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {field.value?.map(id => {
                                                        const level = levels.find(l => l.id === id);
                                                        return level ? (
                                                            <Badge key={id} variant="secondary">
                                                                {level.name} {level.side && level.side !== 'none' ? `(${level.side})` : ''}
                                                                <button type="button" onClick={() => field.onChange(field.value?.filter(ladderId => ladderId !== id))} className="ml-1 rounded-full p-0.5 hover:bg-background/50">
                                                                    <X className="h-3 w-3" />
                                                                </button>
                                                            </Badge>
                                                        ) : null
                                                    })}
                                                </div>
                                            </>
                                        )}
                                    />
                                    {errors.ladderIds && <p className="text-sm text-destructive">{errors.ladderIds.message}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="speakerId">Speaker</Label>
                                    <div className="flex items-center gap-2">
                                        <Controller
                                            name="speakerId"
                                            control={control}
                                            render={({ field }) => (
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <SelectTrigger id="speakerId">
                                                        <SelectValue placeholder="Select a speaker" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {speakers.map((speaker) => (
                                                            <SelectItem key={speaker.id} value={speaker.id}>
                                                                {speaker.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                        <Dialog open={isSpeakerManagerOpen} onOpenChange={setIsSpeakerManagerOpen}>
                                            <DialogTrigger asChild>
                                                <Button type="button" variant="outline" size="sm">Manage</Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle>Manage Speakers</DialogTitle>
                                                </DialogHeader>
                                                <SpeakerManager speakers={speakers} onSpeakersUpdate={() => fetchItems('speakers', setSpeakers, 'name')} />
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                    {errors.speakerId && <p className="text-sm text-destructive">{errors.speakerId.message}</p>}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                
                <TabsContent value="content" className="space-y-8">
                     <Card>
                        <CardHeader>
                            <CardTitle>Course Content</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Label className="font-semibold">Videos</Label>
                            <div className="p-4 border rounded-md mt-2">
                                {videoFields.length > 0 && (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                                        {videoFields.map((field, index) => (
                                            <div key={field.id} className="group relative aspect-video">
                                                <Image src={field.Thumbnail || "https://placehold.co/600x400.png"} alt={field.title} fill style={{objectFit:"cover"}} className="rounded-md" />
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <Button type="button" variant="destructive" size="icon" onClick={() => removeVideo(index)}>
                                                        <Trash className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <Dialog open={isVideoLibraryOpen} onOpenChange={setIsVideoLibraryOpen}>
                                    <DialogTrigger asChild>
                                        <Button type="button" variant="outline" className="w-full">
                                            <Library className="mr-2 h-4 w-4" />
                                            {videoFields.length > 0 ? 'Edit Videos' : 'Select Videos from Library'}
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-7xl h-[90vh] flex flex-col p-0">
                                        <VideoLibrary 
                                            videos={libraryVideos}
                                            onSelectVideos={handleSelectVideos} 
                                            initialSelectedVideos={videoFields} 
                                        />
                                    </DialogContent>
                                </Dialog>
                            </div>
                            {errors.videos && <p className="text-sm text-destructive mt-2">{errors.videos.message || errors.videos.root?.message}</p>}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="quiz" className="space-y-8">
                     <Card>
                        <CardHeader>
                            <CardTitle>Course Quizzes</CardTitle>
                            <CardDescription>Attach quizzes to this course from the library.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="p-4 border rounded-md mt-2">
                                {watchQuizIds && watchQuizIds.length > 0 && (
                                    <div className="space-y-2 mb-4">
                                        {watchQuizIds.map((quizId) => {
                                            const quiz = libraryQuizzes.find(q => q.id === quizId);
                                            return (
                                                <div key={quizId} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                                                     <p className="font-semibold">{quiz?.title || 'Loading quiz...'}</p>
                                                     <Button type="button" variant="ghost" size="icon" onClick={() => setValue('quizIds', watchQuizIds.filter(id => id !== quizId))}>
                                                        <Trash className="h-4 w-4 text-destructive"/>
                                                     </Button>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                                 <Dialog open={isQuizLibraryOpen} onOpenChange={setIsQuizLibraryOpen}>
                                    <DialogTrigger asChild>
                                        <Button type="button" variant="outline" className="w-full">
                                            <Library className="mr-2 h-4 w-4" />
                                            Select Quizzes
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
                                        <QuizLibrary
                                            quizzes={libraryQuizzes}
                                            onRefreshQuizzes={fetchLibraryQuizzes}
                                            onSelectQuizzes={handleSelectQuizzes}
                                            initialSelectedQuizIds={watchQuizIds}
                                        />
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="attachments" className="space-y-8">
                    {canManageSettings && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Attachments &amp; Certificate</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div>
                                    <Label className="font-semibold">Resources</Label>
                                    <div className="p-4 border rounded-md mt-2 space-y-2">
                                        {resourceFields.map((field, index) => (
                                            <div key={field.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                                                <div className="flex items-center gap-2">
                                                    {getFileIcon(field["File name"])}
                                                    <span className="text-sm">{field.title}</span>
                                                </div>
                                                <Button type="button" variant="ghost" size="icon" onClick={() => removeResource(index)}>
                                                    <Trash className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        ))}
                                        <Dialog open={isDocLibraryOpen} onOpenChange={setIsDocLibraryOpen}>
                                            <DialogTrigger asChild>
                                                <Button type="button" variant="outline" className="w-full">
                                                    <Library className="mr-2 h-4 w-4" />
                                                    Select Documents
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
                                                <DocumentLibrary onSelectDocuments={handleSelectDocuments} initialSelectedDocs={resourceFields} />
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                </div>

                                <div>
                                    <Label className="font-semibold">Attendance Links</Label>
                                    <div className="p-4 border rounded-md mt-2 space-y-2">
                                        {attendanceFields.map((field, index) => (
                                            <div key={field.id} className="flex items-center gap-2">
                                                <Input {...register(`attendanceLinks.${index}.title`)} placeholder="Link Title" className="flex-1"/>
                                                <Input {...register(`attendanceLinks.${index}.url`)} placeholder="https://..." className="flex-1"/>
                                                <Button type="button" variant="ghost" size="icon" onClick={() => removeAttendance(index)}>
                                                    <Trash className="h-4 w-4 text-destructive"/>
                                                </Button>
                                            </div>
                                        ))}
                                        <Button type="button" variant="outline" className="w-full" onClick={() => appendAttendance({ title: '', url: '' })}>
                                            <PlusCircle className="mr-2 h-4 w-4" /> Add Link
                                        </Button>
                                    </div>
                                </div>

                                <div>
                                    <Label className="font-semibold">Certificate Background</Label>
                                    <div className='flex items-center gap-2 mt-2'>
                                        <div className="w-32 h-20 border rounded-md flex items-center justify-center bg-muted overflow-hidden">
                                            {watchCertificateUrl && <Image src={watchCertificateUrl} alt="Cert BG" width={128} height={80} className='object-cover' />}
                                        </div>
                                        <Dialog open={isCertLibraryOpen} onOpenChange={setIsCertLibraryOpen}>
                                            <DialogTrigger asChild>
                                                <Button type="button" variant="outline">Select</Button>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
                                                <CertificateBackgroundLibrary
                                                onSelectCertificate={handleSelectCertificate} 
                                                selectedCertificateUrl={watchCertificateUrl}
                                                />
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                </div>
                                <div>
                                    <Label className="font-semibold">Certificate Logo</Label>
                                    <div className='flex items-center gap-2 mt-2'>
                                        <div className="w-20 h-20 border rounded-md flex items-center justify-center bg-muted">
                                            {watchLogoUrl && <Image src={watchLogoUrl} alt="Logo" width={80} height={80} className='object-contain' />}
                                        </div>
                                        <Dialog open={isLogoLibraryOpen} onOpenChange={setIsLogoLibraryOpen}>
                                            <DialogTrigger asChild>
                                                <Button type="button" variant="outline">Select</Button>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
                                                <LogoLibrary 
                                                onSelectLogo={handleSelectLogo}
                                                selectedLogoUrl={watchLogoUrl}
                                                />
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                <div className="fixed bottom-0 left-0 md:left-[280px] right-0 bg-background/95 p-4 border-t border-border z-10">
                    <div className="max-w-6xl mx-auto flex justify-end">
                        <Button type="submit" disabled={isSubmitting} size="lg">
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isEditMode ? 'Update Course' : 'Create Course'}
                        </Button>
                    </div>
                </div>
            </form>
        </Tabs>
    );
}
