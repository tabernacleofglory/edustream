
"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { User, Course, Ladder, OnsiteCompletion, Enrollment } from '@/lib/types';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirebaseApp, getFirebaseFirestore } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';


interface CompletionState {
  courseId: string;
  isCompleted: boolean;
  isOnsite: boolean;
}

const getInitials = (name?: string | null) => {
    if (!name) return 'U';
    const names = name.split(' ');
    const initials = names.map(n => n[0]).join('');
    return initials.toUpperCase();
};

export default function ManageCompletionsPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [ladders, setLadders] = useState<Ladder[]>([]);
    const [onsiteCompletions, setOnsiteCompletions] = useState<OnsiteCompletion[]>([]);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [completions, setCompletions] = useState<CompletionState[]>([]);
    const [initialCompletions, setInitialCompletions] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [courseSearchTerm, setCourseSearchTerm] = useState('');
    const { toast } = useToast();
    const functions = getFunctions(getFirebaseApp());
    const db = getFirebaseFirestore();

    const fetchAllData = useCallback(async () => {
        setIsLoading(true);
        try {
            const usersSnapshotPromise = getDocs(query(collection(db, "users"), orderBy("displayName")));
            const coursesSnapshotPromise = getDocs(query(collection(db, 'courses'), where('status', '==', 'published'), orderBy('title')));
            const laddersSnapshotPromise = getDocs(query(collection(db, "courseLevels"), orderBy("order")));
            
            const [usersSnapshot, coursesSnapshot, laddersSnapshot] = await Promise.all([
                usersSnapshotPromise,
                coursesSnapshotPromise,
                laddersSnapshotPromise,
            ]);

            setUsers(usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
            setCourses(coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
            setLadders(laddersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ladder)));

        } catch (error) {
            toast({ variant: 'destructive', title: 'Failed to load initial data.' });
        } finally {
            setIsLoading(false);
        }
    }, [db, toast]);

    useEffect(() => {
        fetchAllData();

        const onsiteQuery = query(collection(db, 'onsiteCompletions'), orderBy('completedAt', 'desc'));
        const unsubscribe = onSnapshot(onsiteQuery, (snapshot) => {
            const onsiteData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OnsiteCompletion));
            setOnsiteCompletions(onsiteData);
        });
        return () => unsubscribe();
    }, [fetchAllData, db]);

    useEffect(() => {
        if (selectedUser) {
            const fetchInitialCompletions = async () => {
                setIsLoading(true);
                try {
                    const q = query(
                        collection(db, 'enrollments'),
                        where('userId', '==', selectedUser.uid)
                    );
                    const snapshot = await getDocs(q);
                    const userEnrollments = snapshot.docs.map(doc => doc.data() as Enrollment);
                    
                    const completedCourseIds = new Set(userEnrollments.filter(e => e.completedAt).map(e => e.courseId));
                    setInitialCompletions(completedCourseIds);

                    const initialState = courses.map(course => ({
                        courseId: course.id,
                        isCompleted: completedCourseIds.has(course.id),
                        isOnsite: false,
                    }));
                    setCompletions(initialState);
                } catch (error) {
                    console.error('Failed to fetch user completions', error);
                    toast({ variant: 'destructive', title: 'Error', description: 'Could not load user completion data.'});
                } finally {
                    setIsLoading(false);
                }
            };
            fetchInitialCompletions();
        }
    }, [selectedUser, courses, toast, db]);

    const filteredUsers = useMemo(() => {
        return users.filter(user => 
            user.displayName?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
            user.email?.toLowerCase().includes(userSearchTerm.toLowerCase())
        );
    }, [users, userSearchTerm]);

    const handleCompletionChange = (courseId: string, checked: boolean) => {
        setCompletions(prev => prev.map(c => (c.courseId === courseId ? { ...c, isCompleted: checked } : c)));
    };
    
    const handleOnsiteChange = (courseId: string, checked: boolean) => {
        setCompletions(prev => prev.map(c => (c.courseId === courseId ? { ...c, isOnsite: checked } : c)));
    };
    
    const handleSaveChanges = async () => {
        if (!selectedUser) return;
        setIsSaving(true);
        try {
            const setCourseCompletions = httpsCallable(functions, 'setCourseCompletions');
            await setCourseCompletions({ userId: selectedUser.uid, completions });
            toast({ title: "Success", description: `${selectedUser.displayName}'s course completions have been updated.` });
            setSelectedUser(null);
        } catch(error: any) {
            toast({ variant: "destructive", title: "Update Failed", description: error.message });
        } finally {
            setIsSaving(false);
        }
    }

    const groupedCourses = useMemo(() => {
        if (!selectedUser) return [];
        let languageFilteredCourses = courses.filter(course => course.language === selectedUser.language);

        if (courseSearchTerm) {
            languageFilteredCourses = languageFilteredCourses.filter(course => 
                course.title.toLowerCase().includes(courseSearchTerm.toLowerCase())
            );
        }

        return ladders.map(ladder => ({
            ...ladder,
            courses: languageFilteredCourses.filter(c => c.ladderIds?.includes(ladder.id)),
        })).filter(l => l.courses.length > 0);
    }, [ladders, courses, selectedUser, courseSearchTerm]);

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="font-headline text-3xl font-bold md:text-4xl">Manage Course Completions</h1>
                <p className="text-muted-foreground">Select a user to manually update their course completion status.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <Card className="md:col-span-1">
                    <CardHeader>
                        <CardTitle>Select a User</CardTitle>
                        <div className="relative pt-2">
                             <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search users..." value={userSearchTerm} onChange={e => setUserSearchTerm(e.target.value)} className="pl-8" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-96">
                            {isLoading ? <p>Loading users...</p> : (
                                <div className="space-y-2">
                                    {filteredUsers.map(user => (
                                        <Button key={user.id} variant={selectedUser?.id === user.id ? 'secondary' : 'ghost'} className="w-full justify-start gap-2 h-auto" onClick={() => setSelectedUser(user)}>
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={user.photoURL || ''} />
                                                <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                                            </Avatar>
                                            <div className="text-left">
                                                <p className="font-medium text-sm">{user.displayName}</p>
                                                <p className="text-xs text-muted-foreground">{user.email}</p>
                                            </div>
                                        </Button>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Completions for {selectedUser ? selectedUser.displayName : '...'}</CardTitle>
                        <CardDescription>Select which courses this user has completed.</CardDescription>
                         <div className="relative pt-2">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Search courses..." 
                                value={courseSearchTerm} 
                                onChange={(e) => setCourseSearchTerm(e.target.value)}
                                className="pl-8"
                                disabled={!selectedUser}
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        {selectedUser ? (
                            <ScrollArea className="h-96 pr-4">
                                {isLoading ? (
                                    <div className="flex items-center justify-center h-full">
                                        <Loader2 className="h-8 w-8 animate-spin" />
                                    </div>
                                ) : (
                                    <Accordion type="multiple" defaultValue={ladders.map(l => l.id)}>
                                        {groupedCourses.map(ladder => (
                                            <AccordionItem key={ladder.id} value={ladder.id}>
                                                <AccordionTrigger>{ladder.name}</AccordionTrigger>
                                                <AccordionContent>
                                                    <div className="space-y-2">
                                                        {ladder.courses.map(course => {
                                                            const completionState = completions.find(c => c.courseId === course.id);
                                                            const isAlreadyCompletedOnline = initialCompletions.has(course.id);
                                                            
                                                            return (
                                                                <div key={course.id} className={cn(
                                                                    "flex items-center space-x-4 p-2 rounded-md", 
                                                                    isAlreadyCompletedOnline && "bg-muted cursor-not-allowed opacity-60"
                                                                )}>
                                                                    <Checkbox
                                                                        id={`${course.id}-completed`}
                                                                        checked={isAlreadyCompletedOnline || completionState?.isCompleted}
                                                                        onCheckedChange={(checked) => !isAlreadyCompletedOnline && handleCompletionChange(course.id, !!checked)}
                                                                        disabled={isAlreadyCompletedOnline}
                                                                    />
                                                                    <Label htmlFor={`${course.id}-completed`} className={cn("font-normal flex-1", !isAlreadyCompletedOnline && "cursor-pointer")}>
                                                                        {course.title}
                                                                    </Label>
                                                                    <div className="flex items-center space-x-2">
                                                                        {isAlreadyCompletedOnline ? (
                                                                            <Badge variant="secondary">Online</Badge>
                                                                        ) : (
                                                                            <>
                                                                                <Checkbox
                                                                                    id={`${course.id}-onsite`}
                                                                                    checked={completionState?.isOnsite || false}
                                                                                    onCheckedChange={(checked) => handleOnsiteChange(course.id, !!checked)}
                                                                                />
                                                                                <Label htmlFor={`${course.id}-onsite`}>Onsite</Label>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                )}
                            </ScrollArea>
                        ) : (
                            <div className="flex items-center justify-center h-96 border-2 border-dashed rounded-lg">
                                <p className="text-muted-foreground">Select a user to begin</p>
                            </div>
                        )}
                    </CardContent>
                    <CardFooter>
                         <Button onClick={handleSaveChanges} disabled={isSaving || !selectedUser || isLoading}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </CardFooter>
                </Card>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Onsite Completion Log</CardTitle>
                    <CardDescription>A log of all manually recorded onsite course completions.</CardDescription>
                </CardHeader>
                <CardContent>
                     <ScrollArea className="h-96">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Campus</TableHead>
                                    <TableHead>Course</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Marked By</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {onsiteCompletions.map(oc => (
                                    <TableRow key={oc.id}>
                                        <TableCell>{oc.userName}</TableCell>
                                        <TableCell>{oc.userCampus}</TableCell>
                                        <TableCell>{oc.courseName}</TableCell>
                                        <TableCell>{oc.completedAt ? format(new Date((oc.completedAt as unknown as Timestamp).seconds * 1000), 'PPP') : 'N/A'}</TableCell>
                                        <TableCell>{oc.markedBy}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
