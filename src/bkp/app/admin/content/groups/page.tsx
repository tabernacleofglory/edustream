
"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, getDocs, query, doc, updateDoc, deleteDoc, orderBy, where } from "firebase/firestore";
import type { Course, CourseGroup } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Edit, Trash2, Library, BookCopy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import CertificateBackgroundLibrary from "@/components/certificate-background-library";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

const GroupForm = ({ group, onSave, closeDialog }: { group?: CourseGroup | null; onSave: (groupData: any) => void; closeDialog: () => void; }) => {
    const [title, setTitle] = useState(group?.title || '');
    const [description, setDescription] = useState(group?.description || '');
    const [courseIds, setCourseIds] = useState<string[]>(group?.courseIds || []);
    const [allCourses, setAllCourses] = useState<Course[]>([]);
    const [isLoadingCourses, setIsLoadingCourses] = useState(true);
    const [isCertLibraryOpen, setIsCertLibraryOpen] = useState(false);
    const [certificateTemplateUrl, setCertificateTemplateUrl] = useState(group?.certificateTemplateUrl || '');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchCourses = async () => {
            setIsLoadingCourses(true);
            const coursesSnapshot = await getDocs(query(collection(db, 'courses'), where('status', '==', 'published'), orderBy('title')));
            setAllCourses(coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
            setIsLoadingCourses(false);
        };
        fetchCourses();
    }, []);

    const handleCourseSelection = (courseId: string, checked: boolean) => {
        setCourseIds(prev =>
            checked ? [...prev, courseId] : prev.filter(id => id !== courseId)
        );
    };

    const handleSelectCertificate = (cert: { id: string; url: string; }) => {
        setCertificateTemplateUrl(cert.url);
        setIsCertLibraryOpen(false);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ title, description, courseIds, certificateTemplateUrl, status: group?.status || 'draft' });
    };

    const filteredCourses = allCourses.filter(course =>
        course.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <form onSubmit={handleSubmit} className="h-full flex flex-col">
            <ScrollArea className="flex-grow pr-6 -mr-6">
              <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="title">Learning Path Title</Label>
                    <Input id="title" value={title} onChange={e => setTitle(e.target.value)} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} required />
                </div>
                <div className="space-y-2">
                    <Label>Courses</Label>
                    <Input
                        type="search"
                        placeholder="Search for courses to add..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="mb-2"
                    />
                    <ScrollArea className="h-64 border rounded-md p-2">
                        {isLoadingCourses ? <p>Loading courses...</p> :
                            filteredCourses.map(course => (
                                <div key={course.id} className="flex items-center space-x-2 p-1">
                                    <Checkbox
                                        id={course.id}
                                        checked={courseIds.includes(course.id)}
                                        onCheckedChange={(checked) => handleCourseSelection(course.id, !!checked)}
                                    />
                                    <Label htmlFor={course.id} className="font-normal">{course.title}</Label>
                                </div>
                            ))
                        }
                    </ScrollArea>
                </div>
                <div className="space-y-2">
                    <Label>Group Certificate Background</Label>
                    <div className='flex items-center gap-2 mt-2'>
                        <div className="w-32 h-20 border rounded-md flex items-center justify-center bg-muted overflow-hidden">
                            {certificateTemplateUrl && <img src={certificateTemplateUrl} alt="Cert BG" className='object-cover' />}
                        </div>
                        <Dialog open={isCertLibraryOpen} onOpenChange={setIsCertLibraryOpen}>
                            <DialogTrigger asChild>
                                <Button type="button" variant="outline">Select Background</Button>
                            </DialogTrigger>
                            <CertificateBackgroundLibrary onSelectCertificate={handleSelectCertificate} selectedCertificateUrl={certificateTemplateUrl} />
                        </Dialog>
                    </div>
                </div>
              </div>
            </ScrollArea>
            <DialogFooter className="pt-6 border-t mt-6 flex-shrink-0">
                <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
                <Button type="submit">Save</Button>
            </DialogFooter>
        </form>
    );
};


export default function CourseGroupsPage() {
    const { toast } = useToast();
    const [groups, setGroups] = useState<CourseGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<CourseGroup | null>(null);

    const fetchGroups = useCallback(async () => {
        setLoading(true);
        const snapshot = await getDocs(query(collection(db, "courseGroups"), orderBy('createdAt', 'desc')));
        setGroups(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CourseGroup)));
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchGroups();
    }, [fetchGroups]);

    const handleSave = async (groupData: any) => {
        try {
            if (editingGroup) {
                await updateDoc(doc(db, "courseGroups", editingGroup.id), groupData);
                toast({ title: "Learning Path Updated" });
            } else {
                await addDoc(collection(db, "courseGroups"), { ...groupData, createdAt: serverTimestamp() });
                toast({ title: "Learning Path Created" });
            }
            fetchGroups();
            setIsDialogOpen(false);
            setEditingGroup(null);
        } catch (error) {
            console.error("Error saving learning path:", error);
            toast({ variant: "destructive", title: "Save failed" });
        }
    };
    
    const handleDelete = async (groupId: string) => {
        try {
            await deleteDoc(doc(db, "courseGroups", groupId));
            toast({ title: "Learning Path Deleted" });
            fetchGroups();
        } catch (error) {
            toast({ variant: "destructive", title: "Delete failed" });
        }
    }
    
    const handleToggleStatus = async (group: CourseGroup) => {
        const newStatus = group.status === 'published' ? 'draft' : 'published';
        await updateDoc(doc(db, "courseGroups", group.id), { status: newStatus });
        fetchGroups();
        toast({ title: `Status changed to ${newStatus}`});
    }

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="font-headline text-3xl font-bold md:text-4xl">
                    Content Library - Learning Paths
                </h1>
                <p className="text-muted-foreground">
                    Group multiple courses into a structured learning path.
                </p>
            </div>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>All Learning Paths</CardTitle>
                    <Button onClick={() => { setEditingGroup(null); setIsDialogOpen(true); }}>
                        <Plus className="mr-2 h-4 w-4" /> Create New
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {loading ? Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
                            : groups.length > 0 ? (
                                groups.map(group => (
                                    <div key={group.id} className="flex items-center justify-between gap-4 rounded-lg border p-4">
                                        <div className="flex-1">
                                            <p className="font-semibold">{group.title}</p>
                                            <p className="text-sm text-muted-foreground">{group.courseIds?.length || 0} courses</p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center space-x-2">
                                                <Switch
                                                    id={`status-switch-${group.id}`}
                                                    checked={group.status === 'published'}
                                                    onCheckedChange={() => handleToggleStatus(group)}
                                                />
                                                <Label htmlFor={`status-switch-${group.id}`}>
                                                     <Badge variant={group.status === 'published' ? 'default' : 'outline'} className="capitalize">
                                                        {group.status}
                                                     </Badge>
                                                </Label>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button size="icon" variant="ghost" onClick={() => { setEditingGroup(group); setIsDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild><Button size="icon" variant="destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                            <AlertDialogDescription>This will delete the learning path. It will not delete the courses inside it.</AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDelete(group.id)}>Delete</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-12 text-muted-foreground flex flex-col items-center">
                                    <BookCopy className="h-12 w-12" />
                                    <p className="mt-4">No learning paths created yet.</p>
                                </div>
                            )}
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl h-[90vh] flex flex-col">
                    <DialogHeader className="flex-shrink-0">
                        <DialogTitle>{editingGroup ? 'Edit Learning Path' : 'Create Learning Path'}</DialogTitle>
                    </DialogHeader>
                    <GroupForm group={editingGroup} onSave={handleSave} closeDialog={() => setIsDialogOpen(false)} />
                </DialogContent>
            </Dialog>
        </div>
    );
}
