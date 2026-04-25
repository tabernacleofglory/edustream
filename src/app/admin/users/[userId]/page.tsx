"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { collection, query, where, doc, getDoc, getDocs, documentId, collectionGroup, Timestamp, setDoc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Mail, Edit, Eye, CheckCircle, Circle, Trash, UserMinus, RefreshCw, Info, AlertTriangle } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { Course, User, Enrollment, UserProgress, Ladder, UserLadderProgress, Video, UserQuizResult, OnsiteCompletion } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { sendPasswordResetEmail, getAuth } from 'firebase/auth';
import { getFirebaseFirestore, getFirebaseFunctions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { Dialog, DialogHeader, DialogTitle, DialogContent } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import EditUserForm from '@/components/edit-user-form';
import { Skeleton } from '@/components/ui/skeleton';
import { unenrollUserFromCourse } from '@/lib/user-actions';
import { cn } from '@/lib/utils';

const getInitials = (name?: string | null) =>
  (!name ? "U" : name.trim().split(/\s+/).map(p => p[0]?.toUpperCase()).join(""));

const chunk = <T,>(arr: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

interface CourseProgressDetail extends UserProgress {
  videos: Video[];
  courseTitle: string;
}

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;

  const { hasPermission } = useAuth();
  const canManageUsers = hasPermission('manageUsers');

  const [user, setUser] = useState<User | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [ladders, setLadders] = useState<Ladder[]>([]);
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [completedCourses, setCompletedCourses] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [viewingCourseProgress, setViewingCourseProgress] = useState<CourseProgressDetail | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const db = getFirebaseFirestore();
  const functions = getFirebaseFunctions();

  const [computedCourseProgress, setComputedCourseProgress] = useState<
    { courseId: string; courseTitle: string; totalProgress: number; ladderIds: string[] }[]
  >([]);

  const [migrationStats, setMigrationStats] = useState({ legacyCount: 0, globalCount: 0, missingCount: 0, missingIds: [] as string[] });

  const fetchUserData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [userDoc, coursesSnap, laddersSnap] = await Promise.all([
        getDoc(doc(db, 'users', userId)),
        getDocs(collection(db, 'courses')),
        getDocs(collection(db, 'courseLevels')),
      ]);

      if (!userDoc.exists()) {
        toast({ variant: 'destructive', title: 'User not found.' });
        setLoading(false);
        router.replace('/admin/users');
        return;
      }

      const userData = { id: userDoc.id, ...userDoc.data() } as User;
      setUser(userData);
      const allCourses = coursesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Course));
      const allLadders = laddersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Ladder));
      setCourses(allCourses);
      setLadders(allLadders);

      const enrollmentsQuery = query(collection(db, 'enrollments'), where('userId', '==', userId));
      const onsiteQuery = query(collection(db, 'onsiteCompletions'), where('userId', '==', userId));
      const progressQuery = query(collection(db, 'userVideoProgress'), where('userId', '==', userId));
      const quizResultsQuery = query(collection(db, 'userQuizResults'), where('userId', '==', userId), where('passed', '==', true));
      const globalProgressQuery = getDoc(doc(db, "userContentProgress", userId));
      const formSubmissionsQuery = query(collectionGroup(db, 'submissions'), where('userId', '==', userId));

      const [enrollmentsSnap, onsiteSnap, progressSnap, quizResultsSnap, globalProgressSnap, formSubmissionsSnap] = await Promise.all([
        getDocs(enrollmentsQuery),
        getDocs(onsiteQuery),
        getDocs(progressQuery),
        getDocs(quizResultsQuery),
        globalProgressQuery,
        getDocs(formSubmissionsQuery),
      ]);

      const onlineEnrollments = enrollmentsSnap.docs.map(d => d.data() as Enrollment);
      setEnrollments(onlineEnrollments);

      const legacyVideoCompletions = new Set<string>();
      progressSnap.docs.forEach(progressDoc => {
          (progressDoc.data() as UserProgress).videoProgress?.forEach(vp => {
              if (vp.completed) legacyVideoCompletions.add(vp.videoId);
          });
      });
      const legacyQuizCompletions = new Set(quizResultsSnap.docs.map(d => d.data().quizId));
      
      const allCompletedCourseIds = new Set<string>();
      const manualCreditItems = new Set<string>();
      
      onsiteSnap.forEach(d => {
          const data = d.data();
          if (data.courseId) {
              allCompletedCourseIds.add(data.courseId);
              manualCreditItems.add(data.courseId);
          }
          if (Array.isArray(data.creditedVideos)) data.creditedVideos.forEach((id: string) => manualCreditItems.add(id));
          if (Array.isArray(data.creditedQuizzes)) data.creditedQuizzes.forEach((id: string) => manualCreditItems.add(id));
          if (data.creditedForm?.formId) manualCreditItems.add(data.creditedForm.formId);
      });
      
      onlineEnrollments.forEach(e => { if (e.completedAt) allCompletedCourseIds.add(e.courseId); });

      const globalCompletedItems = new Set<string>(globalProgressSnap.exists() ? Object.keys(globalProgressSnap.data()?.completedItems || {}) : []);

      const combinedLegacyItems = new Set<string>([
          ...Array.from(legacyVideoCompletions),
          ...Array.from(legacyQuizCompletions),
          ...Array.from(manualCreditItems),
          ...Array.from(allCompletedCourseIds)
      ]);
      
      const missingIds: string[] = [];
      combinedLegacyItems.forEach(id => { if (!globalCompletedItems.has(id)) missingIds.push(id); });
      
      setMigrationStats({
          legacyCount: combinedLegacyItems.size,
          globalCount: globalCompletedItems.size,
          missingCount: missingIds.length,
          missingIds: missingIds
      });

      if (globalProgressSnap.exists()) {
          const gItems = globalProgressSnap.data()?.completedItems || {};
          allCourses.forEach(c => { if (gItems[c.id]) allCompletedCourseIds.add(c.id); });
      }

      const progressDocs = progressSnap.docs.map(d => d.data() as UserProgress);
      const passedQuizzes = new Set(quizResultsSnap.docs.map(d => d.data().quizId));
      const submittedForms = new Set(formSubmissionsSnap.docs.map(d => d.data().formId));

      const videoCompletionsByCourse: Record<string, Set<string>> = {};
      progressDocs.forEach(p => {
          if (!videoCompletionsByCourse[p.courseId]) videoCompletionsByCourse[p.courseId] = new Set();
          p.videoProgress?.forEach(vp => { if (vp.completed) videoCompletionsByCourse[p.courseId].add(vp.videoId); });
      });

      allCourses.forEach(c => {
          const reqVideos = c.videos || [];
          const reqQuizzes = c.quizIds || [];
          const reqForm = c.formId;

          const videosOk = reqVideos.length > 0 ? reqVideos.every(id => videoCompletionsByCourse[c.id]?.has(id)) : true;
          const quizzesOk = reqQuizzes.length > 0 ? reqQuizzes.every(id => passedQuizzes.has(id)) : true;
          const formOk = reqForm ? submittedForms.has(reqForm) : true;

          if (videosOk && quizzesOk && formOk && (reqVideos.length > 0 || reqQuizzes.length > 0 || reqForm)) {
              allCompletedCourseIds.add(c.id);
          }
      });

      const enrolledCourseIds = Array.from(new Set([
          ...onlineEnrollments.map(e => e.courseId),
          ...Array.from(allCompletedCourseIds)
      ]));

      const detailedCourseProgress = enrolledCourseIds
        .map(cid => {
          const c = allCourses.find(course => course.id === cid);
          if (!c) return null;
          const totalVideos = c.videos?.length || 0;
          const completedVideosCount = videoCompletionsByCourse[c.id]?.size || 0;
          const progressDoc = progressDocs.find(p => p.courseId === c.id);
          const totalProgress = allCompletedCourseIds.has(c.id) ? 100 : (progressDoc?.totalProgress !== undefined ? progressDoc.totalProgress : (totalVideos > 0 ? Math.round((completedVideosCount / totalVideos) * 100) : 0));
          
          return {
            courseId: c.id,
            courseTitle: c.title,
            totalProgress,
            ladderIds: c.ladderIds || [],
          };
        })
        .filter(Boolean)
        .sort((a, b) => a!.courseTitle.localeCompare(b!.courseTitle)) as any[];

      setComputedCourseProgress(detailedCourseProgress);
      setCompletedCourses(allCompletedCourseIds);
      setUserProgress(progressDocs);

    } catch (error) {
      toast({ variant: 'destructive', title: 'Failed to load user data.' });
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [userId, toast, router, db]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  useEffect(() => {
    if (canManageUsers === false) {
      setLoading(false);
      toast({ variant: 'destructive', title: 'Permission Denied' });
      router.replace('/admin/analytics');
    }
  }, [canManageUsers, router, toast]);

  const userLadderProgress = useMemo(() => {
    if (!user || ladders.length === 0 || courses.length === 0) return [];
    return ladders
      .map(ladder => {
        const coursesInLadder = courses.filter(
          c => c.ladderIds?.includes(ladder.id) && (!user.language || c.language === user.language)
        );
        
        if (coursesInLadder.length === 0) return null;

        const completedCount = coursesInLadder.filter(c => completedCourses.has(c.id)).length;
        const prog = Math.round((completedCount / coursesInLadder.length) * 100);

        return {
          ladderId: ladder.id,
          ladderName: `${ladder.name} ${ladder.side !== 'none' ? `(${ladder.side})` : ''}`,
          progress: prog,
          totalCourses: coursesInLadder.length,
          completedCourses: completedCount,
        };
      })
      .filter((lp): lp is UserLadderProgress => lp !== null);
  }, [user, ladders, courses, completedCourses]);

  const enrolledCoursesProgress = useMemo(() => {
    const index = new Map(computedCourseProgress.map(p => [p.courseId, p]));
    return enrollments
      .filter(en => !completedCourses.has(en.courseId))
      .map(en => index.get(en.courseId))
      .filter(Boolean)
      .sort((a, b) => a!.courseTitle.localeCompare(b!.courseTitle)) as any[];
  }, [enrollments, completedCourses, computedCourseProgress]);

  const groupedEnrolledCourses = useMemo(() => {
    const grouped: { [key: string]: { ladderId: string, ladderName: string, courses: any[] } } = {};
    enrolledCoursesProgress.forEach(course => {
        const ladderId = course.ladderIds.length > 0 ? course.ladderIds[0] : 'uncategorized';
        const ladder = ladders.find(l => l.id === ladderId);
        const ladderName = ladder ? ladder.name : 'Uncategorized';
        if (!grouped[ladderId]) {
            grouped[ladderId] = { ladderId, ladderName, courses: [] };
        }
        grouped[ladderId].courses.push(course);
    });
    return Object.values(grouped).sort((a,b) => {
        const ladderA = ladders.find(l => l.id === a.ladderId);
        const ladderB = ladders.find(l => l.id === b.ladderId);
        return (ladderA?.order ?? 999) - (ladderB?.order ?? 999);
    });
  }, [enrolledCoursesProgress, ladders]);

  const completedCoursesList = useMemo(() => {
    if (!user) return [];
    const progMap = new Map(computedCourseProgress.map(p => [p.courseId, p.totalProgress]));
    return courses
      .filter(c => completedCourses.has(c.id))
      .map(c => ({
        courseId: c.id,
        courseTitle: c.title,
        totalProgress: progMap.get(c.id) ?? 100,
        ladderIds: c.ladderIds || [],
      }))
      .sort((a, b) => a.courseTitle.localeCompare(b.courseTitle));
  }, [courses, completedCourses, user, computedCourseProgress]);

  const groupedCompletedCourses = useMemo(() => {
    const grouped: { [key: string]: { ladderId: string, ladderName: string, courses: any[] } } = {};
    completedCoursesList.forEach(course => {
      const ladderId = course.ladderIds.length > 0 ? course.ladderIds[0] : 'uncategorized';
      const ladder = ladders.find(l => l.id === ladderId);
      const ladderName = ladder ? ladder.name : 'Uncategorized';
      if (!grouped[ladderId]) {
        grouped[ladderId] = { ladderId, ladderName, courses: [] };
      }
      grouped[ladderId].courses.push(course);
    });
    return Object.values(grouped).sort((a, b) => {
      const ladderA = ladders.find(l => l.id === a.ladderId);
      const ladderB = ladders.find(l => l.id === b.ladderId);
      return (ladderA?.order ?? 999) - (ladderB?.order ?? 999);
    });
  }, [completedCoursesList, ladders]);

  const handleViewCourseProgress = async (progressItem: { courseId: string; courseTitle: string }) => {
    const course = courses.find(c => c.id === progressItem.courseId);
    if (!course) return;
    const videoIds = Array.from(new Set((course.videos || []).filter(Boolean)));
    let videos: Video[] = [];
    if (videoIds.length > 0) {
        const chunks = chunk(videoIds, 10);
        const snaps = await Promise.all(
          chunks.map(ids =>
            getDocs(query(collection(db, 'Contents'), where(documentId(), 'in', ids)))
          )
        );
        const allDocs = snaps.flatMap(s => s.docs);
        const videoDetailsMap = new Map(allDocs.map(d => [d.id, d.data() as Video]));
        videos = videoIds.map(id => videoDetailsMap.get(id)).filter(Boolean) as Video[];
    }
    const progressData = userProgress.find(p => p.courseId === progressItem.courseId) || {
        userId: user!.id,
        courseId: progressItem.courseId,
        videoProgress: [],
        totalProgress: completedCourses.has(progressItem.courseId) ? 100 : 0
    };
    setViewingCourseProgress({ ...progressData, videos, courseTitle: progressItem.courseTitle });
  };

  const handleSendResetLink = async () => {
    if (!user?.email) {
      toast({ variant: 'destructive', title: 'No email found for this user.' });
      return;
    }
    try {
      await sendPasswordResetEmail(getAuth(), user.email);
      toast({ title: 'Password Reset Email Sent', description: `An email has been sent to ${user.email}.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error Sending Email', description: error.message });
    }
  };

  const handleDeleteUser = async () => {
    if (!user) return;
    try {
        const deleteUserAccount = httpsCallable(functions, 'deleteUserAccount');
        await deleteUserAccount({ uid: user.id });
        toast({ title: "User Deleted", description: `User ${user.displayName} has been removed.` });
        router.replace('/admin/users');
    } catch (error: any) {
        toast({ variant: "destructive", title: "Deletion Failed", description: "Could not delete user account. " + error.message });
    }
  };
  
   const handleSyncProgress = async () => {
    if (!user || migrationStats.missingCount === 0) return;
    setIsSyncing(true);
    try {
        const globalProgressRef = doc(db, 'userContentProgress', user.id);
        const updates: Record<string, any> = {};
        migrationStats.missingIds.forEach(id => {
            updates[`completedItems.${id}`] = serverTimestamp();
        });

        try {
            await updateDoc(globalProgressRef, updates);
        } catch (e: any) {
            if (e.code === 'not-found') {
                const initial: any = { completedItems: {} };
                migrationStats.missingIds.forEach(id => {
                    initial.completedItems[id] = serverTimestamp();
                });
                await setDoc(globalProgressRef, initial);
            } else {
                throw e;
            }
        }
        
        toast({
            title: 'Sync Complete',
            description: `${migrationStats.missingCount} record(s) were synced to the global progress log.`,
        });
        
        await fetchUserData(); 
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Sync Failed', description: error.message });
        console.error(error);
    } finally {
        setIsSyncing(false);
    }
  };

  const handleSyncIndividualCourse = async (courseId: string) => {
    if (!user) return;
    setIsSyncing(true);
    try {
        const globalProgressRef = doc(db, 'userContentProgress', user.id);
        const enrollmentRef = doc(db, 'enrollments', `${user.id}_${courseId}`);
        
        const updates = { [`completedItems.${courseId}`]: serverTimestamp() };
        
        try {
            await updateDoc(globalProgressRef, updates);
        } catch (e: any) {
            if (e.code === 'not-found') {
                await setDoc(globalProgressRef, { completedItems: { [courseId]: serverTimestamp() } });
            } else {
                throw e;
            }
        }

        await updateDoc(enrollmentRef, {
            completedAt: serverTimestamp()
        });

        toast({ title: 'Course Synchronized', description: 'Manual sync successful.' });
        await fetchUserData();
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Sync Failed', description: error.message });
    } finally {
        setIsSyncing(false);
    }
  };

  const handleUnenroll = async (userId: string, courseId: string) => {
      const result = await unenrollUserFromCourse(userId, courseId);
      if (result.success) {
          toast({ title: 'Success', description: result.message });
          fetchUserData();
      } else {
          toast({ variant: 'destructive', title: 'Error', description: result.message });
      }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleSendResetLink}>
              <Mail className="mr-2 h-4 w-4" /> Send Reset Link
            </Button>
            <Button onClick={() => setIsEditing(true)}>
              <Edit className="mr-2 h-4 w-4" /> Edit User
            </Button>
             <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                        <Trash className="mr-2 h-4 w-4" /> Delete User
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the user <span className="font-bold">{user.displayName}</span> and all associated data. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteUser}>
                            Yes, delete user
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-1">
            <CardHeader className="items-center text-center">
              <Avatar className="h-24 w-24 mb-2">
                <AvatarImage src={user.photoURL || undefined} />
                <AvatarFallback className="text-4xl">{getInitials(user.displayName)}</AvatarFallback>
              </Avatar>
              <CardTitle>{user.displayName}</CardTitle>
              <CardDescription>{user.email}</CardDescription>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                <Badge variant="secondary" className="capitalize">{user.role}</Badge>
                <Badge variant="outline" className="capitalize">{user.membershipStatus}</Badge>
              </div>
            </CardHeader>
            <CardContent className="text-sm">
              <div className="space-y-3">
                {[
                    { label: 'Full Name', value: user.fullName },
                    { label: 'First Name', value: user.firstName },
                    { label: 'Last Name', value: user.lastName },
                    { label: 'Gender', value: user.gender, capitalize: true },
                    { label: 'Age Range', value: user.ageRange },
                    { label: 'Phone Number', value: user.phoneNumber },
                    { label: 'Campus', value: user.campus },
                    { label: 'Language', value: user.language },
                    { label: 'Location Preference', value: user.locationPreference },
                    { label: 'In HP Group', value: user.isInHpGroup ? 'Yes' : 'No' },
                    ...(user.isInHpGroup ? [
                        { label: 'HP Number', value: user.hpNumber },
                        { label: 'HP Facilitator', value: user.facilitatorName },
                    ] : [
                        { label: 'HP Availability', value: user.hpAvailabilityDay ? `${user.hpAvailabilityDay} at ${user.hpAvailabilityTime}` : ''},
                    ]),
                    { label: 'Marital Status', value: user.maritalStatus },
                    { label: 'Baptized', value: user.isBaptized ? 'Yes' : 'No' },
                    ...(user.isBaptized ? [
                        { label: 'Baptism Date', value: user.baptismDate },
                        { label: 'Denomination', value: user.denomination }
                    ] : []),
                    { label: 'Ministry', value: user.ministry },
                    { label: 'Charge', value: user.charge },
                    { label: 'Graduation Status', value: user.graduationStatus || 'Not Started' },
                    ...(user.graduationStatus === 'Graduated' ? [{ label: 'Graduation Date', value: user.graduationDate }] : []),
                ].map(field => (
                  <div key={field.label}>
                    <p className="font-semibold">{field.label}</p>
                    <p className={`text-muted-foreground ${field.capitalize ? 'capitalize' : ''}`}>
                      {field.value || "Not provided"}
                    </p>
                  </div>
                ))}
                <div>
                  <p className="font-semibold">Bio</p>
                  <p className="text-muted-foreground text-xs p-3 bg-muted rounded-md min-h-[50px]">
                    {user.bio || "No bio provided."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="lg:col-span-2 space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        User Profile Sync
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 gap-1">
                            <Info className="h-3 w-3" />
                            Global Record Audit
                        </Badge>
                    </CardTitle>
                    <CardDescription>Consolidate completions from multiple legacy logs into the primary profile record.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-4 text-center">
                    <div>
                        <p className="text-2xl font-bold">{migrationStats.legacyCount}</p>
                        <p className="text-sm text-muted-foreground">Legacy Logs</p>
                    </div>
                     <div>
                        <p className="text-2xl font-bold">{migrationStats.globalCount}</p>
                        <p className="text-sm text-muted-foreground">Global Record</p>
                    </div>
                     <div>
                        <p className={cn("text-2xl font-bold", migrationStats.missingCount > 0 ? "text-amber-600" : "text-green-600")}>
                            {migrationStats.missingCount}
                        </p>
                        <p className="text-sm text-muted-foreground">Unsynced</p>
                    </div>
                </CardContent>
                 <CardContent>
                     <Button onClick={handleSyncProgress} disabled={isSyncing || migrationStats.missingCount === 0} className="w-full">
                        {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Sync Missing Records ({migrationStats.missingCount})
                    </Button>
                </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Ladder Progress</CardTitle>
                <CardDescription>User&apos;s progress through each learning path.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {userLadderProgress.length > 0 ? userLadderProgress.map(p => (
                  <div key={p.ladderId}>
                    <div className="flex justify-between items-center text-sm mb-1">
                      <p className="font-medium">{p.ladderName}</p>
                      <p className="text-muted-foreground">
                        {p.completedCourses} / {p.totalCourses} courses completed
                      </p>
                    </div>
                    <Progress value={p.progress} className="h-2" />
                  </div>
                )) : <p className="text-sm text-muted-foreground">No ladder progress available.</p>}
              </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Enrolled Courses</CardTitle>
                    <CardDescription>Courses the user is currently taking.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {groupedEnrolledCourses.length > 0 ? (
                        groupedEnrolledCourses.map(group => (
                            <div key={group.ladderId}>
                                <h4 className="font-semibold mb-2">{group.ladderName}</h4>
                                <div className="space-y-4 pl-4 border-l">
                                    {group.courses.map((p: any) => {
                                        const isLocallyFinished = p.totalProgress === 100;
                                        return (
                                        <div key={p.courseId} className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <div className="font-medium flex items-center gap-2">
                                                    {p.courseTitle}
                                                    {isLocallyFinished && <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-[10px] uppercase font-bold">Unsynced Final</Badge>}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Progress value={p.totalProgress} className="h-2 w-40" />
                                                    <span className="text-xs font-bold">{p.totalProgress}%</span>
                                                </div>
                                            </div>
                                            <div className='flex gap-2'>
                                                {isLocallyFinished && (
                                                    <Button variant="outline" size="icon" onClick={() => handleSyncIndividualCourse(p.courseId)} title="Manual Sync Final Status">
                                                        <RefreshCw className="h-4 w-4 text-amber-600" />
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="icon" onClick={() => handleViewCourseProgress(p)}>
                                                    <Eye className="mr-2 h-4 w-4" />
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={() => handleUnenroll(user.id, p.courseId)}>
                                                    <UserMinus className="mr-2 h-4 w-4" /> Un-enroll
                                                </Button>
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-muted-foreground">No active enrollments.</p>
                    )}
                </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Completed Courses</CardTitle>
                <CardDescription>Courses finished by this user.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {groupedCompletedCourses.length > 0 ? (
                  groupedCompletedCourses.map(group => (
                    <div key={group.ladderId}>
                      <h4 className="font-semibold mb-2">{group.ladderName}</h4>
                      <div className="space-y-4 pl-4 border-l">
                        {group.courses.map((p: any) => (
                          <div key={p.courseId} className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-medium flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                {p.courseTitle}
                              </div>
                              <div className="flex items-center gap-2">
                                <Progress value={p.totalProgress ?? 100} className="h-2 w-40" />
                                <span className="text-xs font-bold">{p.totalProgress ?? 100}%</span>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="ghost" size="icon" onClick={() => handleViewCourseProgress(p)}>
                                <Eye className="mr-2 h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No completed courses yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

       <Sheet open={isEditing} onOpenChange={setIsEditing}>
        <SheetContent className="w-full sm:max-w-md p-0">
          <SheetHeader className="p-6">
            <SheetTitle>Edit User: {user.displayName}</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-80px)]">
            <div className="p-6 pt-0">
              <EditUserForm userToEdit={user} onUserUpdated={() => { setIsEditing(false); fetchUserData(); }} />
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <Dialog open={!!viewingCourseProgress} onOpenChange={() => setViewingCourseProgress(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Video Progress for {viewingCourseProgress?.courseTitle}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-96 pr-4">
            <div className="space-y-2">
              {viewingCourseProgress?.videos.map((video, idx) => {
                const videoProgress = viewingCourseProgress.videoProgress.find(vp => vp.videoId === video.id);
                const isCompleted = videoProgress?.completed || false;
                return (
                  <div key={`${video.id || 'no-id'}-${idx}`} className="flex items-center gap-3 p-2 rounded-md bg-muted/50">
                    {isCompleted ? <CheckCircle className="h-5 w-5 text-green-500" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                    <span className="text-sm font-medium">{video.title}</span>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
