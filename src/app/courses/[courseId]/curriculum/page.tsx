
"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, collection, query, where, getDocs, documentId, Timestamp, collectionGroup } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Lock, Play, FileQuestion, FileText, ArrowRight, LayoutDashboard, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Course, Video, Quiz, CustomForm, UserProgress, UserQuizResult } from "@/lib/types";
import { useI18n } from "@/hooks/use-i18n";

interface CurriculumItem {
    id: string;
    title: string;
    type: 'video' | 'quiz' | 'form';
    isCompleted: boolean;
    url?: string;
}

export default function CourseCurriculumPage() {
    const params = useParams();
    const router = useRouter();
    const { t } = useI18n();
    const { courseId } = params as { courseId: string };
    const { user, loading: authLoading } = useAuth();
    
    const [course, setCourse] = useState<Course | null>(null);
    const [content, setContent] = useState<{ videos: Video[], quizzes: Quiz[], form: CustomForm | null }>({ videos: [], quizzes: [], form: null });
    const [completions, setCompletions] = useState<{ videos: Set<string>, quizzes: Set<string>, form: Set<string> }>({ videos: new Set(), quizzes: new Set(), form: new Set() });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.push('/login');
            return;
        }

        const fetchData = async () => {
            if (!course) setLoading(true);
            try {
                const courseSnap = await getDoc(doc(db, 'courses', courseId));
                if (!courseSnap.exists()) {
                    router.push('/dashboard');
                    return;
                }
                const courseData = { id: courseSnap.id, ...courseSnap.data() } as Course;
                setCourse(courseData);

                const videoIds = courseData.videos || [];
                const quizIds = courseData.quizIds || [];
                const formId = courseData.formId;

                let videos: Video[] = [];
                if (videoIds.length > 0) {
                    const chunk = videoIds.slice(0, 30);
                    const vSnap = await getDocs(query(collection(db, 'Contents'), where(documentId(), 'in', chunk)));
                    const vMap = new Map(vSnap.docs.map(d => [d.id, { id: d.id, ...d.data() } as Video]));
                    videos = videoIds.map(id => vMap.get(id)).filter(Boolean) as Video[];
                }

                let quizzes: Quiz[] = [];
                if (quizIds.length > 0) {
                    const qSnap = await getDocs(query(collection(db, 'quizzes'), where(documentId(), 'in', quizIds)));
                    quizzes = qSnap.docs.map(d => ({ id: d.id, ...d.data() } as Quiz));
                }

                let form: CustomForm | null = null;
                if (formId) {
                    const fSnap = await getDoc(doc(db, 'forms', formId));
                    if (fSnap.exists()) form = { id: fSnap.id, ...fSnap.data() } as CustomForm;
                }

                setContent({ videos, quizzes, form });

                const [progressSnap, quizResultsSnap, globalSnap, onsiteSnap, submissionSnap] = await Promise.all([
                    getDoc(doc(db, 'userVideoProgress', `${user.uid}_${courseId}`)),
                    getDocs(query(collection(db, 'userQuizResults'), where('userId', '==', user.uid), where('courseId', '==', courseId), where('passed', '==', true))),
                    getDoc(doc(db, 'userContentProgress', user.uid)),
                    getDocs(query(collection(db, 'onsiteCompletions'), where('userId', '==', user.uid), where('courseId', '==', courseId))),
                    formId ? getDocs(query(collectionGroup(db, 'submissions'), where('userId', '==', user.uid), where('formId', '==', formId))) : Promise.resolve({ empty: true } as any)
                ]);

                const videoDone = new Set<string>();
                const quizDone = new Set<string>();
                const formDone = new Set<string>();

                const globalCompletions = globalSnap.exists() ? (globalSnap.data().completedItems || {}) : {};

                // Priority 1: Global Log
                videoIds.forEach(id => { if (globalCompletions[id]) videoDone.add(id); });
                quizIds.forEach(id => { if (globalCompletions[id]) quizDone.add(id); });
                if (formId && globalCompletions[formId]) formDone.add(formId);

                // Priority 2: In-course progress
                if (progressSnap.exists()) {
                    progressSnap.data().videoProgress?.forEach((vp: any) => { if (vp.completed) videoDone.add(vp.videoId); });
                }
                quizResultsSnap.docs.forEach(d => quizDone.add(d.data().quizId));
                if (!submissionSnap.empty) formDone.add(formId!);

                // Priority 3: Onsite/Manual
                if (!onsiteSnap.empty) {
                    videoIds.forEach(id => videoDone.add(id));
                    quizIds.forEach(id => quizDone.add(id));
                    if (formId) formDone.add(formId);
                }

                setCompletions({ videos: videoDone, quizzes: quizDone, form: formDone });

            } catch (error) {
                console.error("Error loading curriculum:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [courseId, user?.uid, authLoading, db, router]);

    const curriculum = useMemo((): CurriculumItem[] => {
        const items: CurriculumItem[] = [];
        content.videos.forEach(v => items.push({ id: v.id, title: v.title, type: 'video', isCompleted: completions.videos.has(v.id) }));
        content.quizzes.forEach(q => items.push({ id: q.id, title: q.title, type: 'quiz', isCompleted: completions.quizzes.has(q.id) }));
        if (content.form) items.push({ id: content.form.id, title: content.form.title, type: 'form', isCompleted: completions.form.has(content.form.id) });
        return items;
    }, [content, completions]);

    const nextItem = useMemo(() => curriculum.find(item => !item.isCompleted), [curriculum]);
    const allCompleted = curriculum.length > 0 && !nextItem;

    const handleContinue = () => {
        if (!nextItem) {
            router.push('/dashboard');
            return;
        }
        if (nextItem.type === 'video') router.push(`/courses/${courseId}/video/${nextItem.id}`);
        else if (nextItem.type === 'quiz') router.push(`/courses/${courseId}/quiz/${nextItem.id}`);
        else if (nextItem.type === 'form') router.push(`/courses/${courseId}/form/${nextItem.id}`);
    };

    if (loading) return <div className="max-w-2xl mx-auto py-8 px-4"><Skeleton className="h-40 w-full" /></div>;

    return (
        <div className="max-w-2xl mx-auto py-8 px-4">
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold font-headline mb-2">{course?.title}</h1>
                <p className="text-muted-foreground">{t('curriculum.subtitle', 'Course Curriculum & Next Steps')}</p>
            </div>

            <Card className="shadow-lg border-primary/10">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <LayoutDashboard className="h-5 w-5 text-primary" />
                        {t('curriculum.checklist.title', 'Progress Checklist')}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y">
                        {curriculum.map((item, index) => (
                            <div key={item.id} className={cn("flex items-center justify-between p-4 transition-colors", item.isCompleted ? "bg-muted/30" : "bg-background")}>
                                <div className="flex items-center gap-4">
                                    <div className="flex-shrink-0">
                                        {item.isCompleted ? <CheckCircle2 className="h-6 w-6 text-green-500" /> : <Circle className="h-6 w-6 text-muted-foreground" />}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className={cn("font-medium text-sm", item.isCompleted && "text-muted-foreground line-through")}>{item.title}</span>
                                        <span className="text-[10px] uppercase font-bold text-muted-foreground">{item.type}</span>
                                    </div>
                                </div>
                                <Badge variant={item.isCompleted ? "default" : "outline"}>{item.isCompleted ? t('curriculum.status.done', 'Done') : t('curriculum.status.next', 'Next')}</Badge>
                            </div>
                        ))}
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-3 p-6 border-t bg-muted/5">
                    <Button onClick={handleContinue} className="w-full h-12 text-lg rounded-full" size="lg">
                        {allCompleted ? t('curriculum.action.return_dashboard', 'Return to Dashboard') : t('curriculum.action.continue', 'Continue Course')}
                        <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
