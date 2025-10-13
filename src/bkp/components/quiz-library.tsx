
"use client";

import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Check, Edit, FileQuestion, Plus, Trash2, Library, CheckCircle } from 'lucide-react';
import { Quiz, QuizQuestion } from '@/lib/types';
import { Skeleton } from './ui/skeleton';
import { Badge } from './ui/badge';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from './ui/alert-dialog';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import QuizForm from './quiz-form';

interface QuizLibraryProps {
    quizzes: Quiz[];
    onSelectQuizzes: (quizzes: Quiz[]) => void;
    initialSelectedQuizIds?: string[];
    onRefreshQuizzes: () => void;
}

export default function QuizLibrary({
    quizzes,
    onSelectQuizzes,
    initialSelectedQuizIds = [],
    onRefreshQuizzes,
}: QuizLibraryProps) {
    const [selectedQuizzes, setSelectedQuizzes] = useState<Quiz[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
    const { toast } = useToast();

    useMemo(() => {
        const initialSelection = quizzes.filter(q => initialSelectedQuizIds.includes(q.id));
        setSelectedQuizzes(initialSelection);
    }, [quizzes, initialSelectedQuizIds]);
    
    const filteredQuizzes = useMemo(() => {
        return quizzes.filter(q => q.title.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [quizzes, searchTerm]);
    
    const toggleSelection = (quiz: Quiz) => {
        setSelectedQuizzes(prev => 
            prev.some(q => q.id === quiz.id)
                ? prev.filter(q => q.id !== quiz.id)
                : [...prev, quiz]
        );
    };

    const handleDelete = async (quizId: string) => {
        if (!window.confirm("Are you sure you want to delete this quiz?")) return;
        try {
            await deleteDoc(doc(db, 'quizzes', quizId));
            toast({ title: 'Quiz deleted' });
            onRefreshQuizzes();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Failed to delete quiz' });
        }
    };
    
    const handleSuccess = () => {
        setIsCreateDialogOpen(false);
        setEditingQuiz(null);
        onRefreshQuizzes();
    }
    
    return (
        <>
            <DialogHeader className="p-6 pb-0">
                <DialogTitle>Quiz Library</DialogTitle>
                <DialogDescription>Select quizzes to attach to this course.</DialogDescription>
            </DialogHeader>
            <div className="px-6">
                <Input placeholder="Search quizzes..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <ScrollArea className="flex-grow p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredQuizzes.map(quiz => (
                         <Card key={quiz.id} className="group relative cursor-pointer hover:ring-2 hover:ring-primary" onClick={() => toggleSelection(quiz)}>
                             <CardContent className="p-4 flex items-center justify-between">
                                 <div className="flex items-center gap-3">
                                    <FileQuestion className="h-6 w-6 text-muted-foreground" />
                                    <div>
                                        <p className="font-semibold">{quiz.title}</p>
                                        <p className="text-xs text-muted-foreground">{quiz.questions.length} questions</p>
                                    </div>
                                 </div>
                                 <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => {e.stopPropagation(); setEditingQuiz(quiz); setIsCreateDialogOpen(true);}}><Edit className="h-4 w-4" /></Button>
                                    <AlertDialog onOpenChange={(open) => !open && e.stopPropagation()}>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                <AlertDialogDescription>This will permanently delete the quiz "{quiz.title}".</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={(e) => {e.stopPropagation(); handleDelete(quiz.id)}}>Delete</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                 </div>
                                  {selectedQuizzes.some(q => q.id === quiz.id) && (
                                    <div className="absolute top-2 right-2 bg-primary text-white rounded-full h-5 w-5 flex items-center justify-center">
                                        <Check className="h-3 w-3" />
                                    </div>
                                 )}
                             </CardContent>
                         </Card>
                    ))}
                </div>
            </ScrollArea>
             <DialogFooter className="p-6 border-t flex justify-between items-center">
                <Button variant="outline" onClick={() => { setEditingQuiz(null); setIsCreateDialogOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4" /> Create New Quiz
                </Button>
                <Button onClick={() => onSelectQuizzes(selectedQuizzes)}>
                    Confirm Selection ({selectedQuizzes.length})
                </Button>
             </DialogFooter>

             <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>{editingQuiz ? 'Edit Quiz' : 'Create New Quiz'}</DialogTitle>
                    </DialogHeader>
                     <QuizForm quiz={editingQuiz} onSuccess={handleSuccess} closeDialog={() => setIsCreateDialogOpen(false)} />
                </DialogContent>
             </Dialog>
        </>
    )
}
