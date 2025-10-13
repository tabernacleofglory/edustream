

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, Timestamp } from "firebase/firestore";
import { v4 as uuidv4 } from 'uuid';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Edit, Trash2, FileQuestion, Percent, BarChart2 } from "lucide-react";
import type { Quiz, QuizQuestion } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useFieldArray, useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormMessage, FormLabel, FormDescription } from "@/components/ui/form";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useDebounce } from 'use-debounce';
import Link from 'next/link';


const quizQuestionSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().default(() => uuidv4()),
    type: z.literal("multiple-choice"),
    questionText: z.string().min(1, "Question text is required"),
    options: z.array(z.string().min(1, "Option cannot be empty")).min(2, "At least two options are required").max(6, "No more than six options are allowed"),
    correctAnswerIndex: z.coerce.number({invalid_type_error: "Please select a correct answer"}).min(0).max(5),
    minCharLength: z.number().optional(), // Keep for type consistency
  }),
  z.object({
    id: z.string().default(() => uuidv4()),
    type: z.literal("multiple-select"),
    questionText: z.string().min(1, "Question text is required"),
    options: z.array(z.string().min(1, "Option cannot be empty")).min(2, "At least two options are required").max(6, "No more than six options are allowed"),
    correctAnswerIndexes: z.array(z.number()).min(1, "Select at least one correct answer"),
    minCharLength: z.number().optional(), // Keep for type consistency
  }),
  z.object({
    id: z.string().default(() => uuidv4()),
    type: z.literal("free-text"),
    questionText: z.string().min(1, "Question text is required"),
    options: z.array(z.string()).optional(), // Not used for free-text but helps with TS
    minCharLength: z.coerce.number().optional(),
  }),
]);


const quizFormSchema = z.object({
  title: z.string().min(3, "Quiz title is required"),
  passThreshold: z.coerce.number().min(0).max(100).optional(),
  shuffleQuestions: z.boolean().optional(),
  timeLimitEnabled: z.boolean().optional(),
  timeLimitPerQuestion: z.coerce.number().min(1, "Time limit must be at least 1 minute.").optional(),
  questions: z.array(quizQuestionSchema).min(1, "At least one question is required"),
});

type QuizFormValues = z.infer<typeof quizFormSchema>;

const DRAFT_STORAGE_KEY = 'quiz-form-draft';

const QuizForm = ({ quiz, onSuccess, closeDialog }: { quiz?: Quiz | null; onSuccess: () => void; closeDialog: () => void; }) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<QuizFormValues>({
    resolver: zodResolver(quizFormSchema),
    defaultValues: {
      title: quiz?.title || '',
      passThreshold: quiz?.passThreshold,
      shuffleQuestions: quiz?.shuffleQuestions || false,
      timeLimitEnabled: quiz?.timeLimitEnabled || false,
      timeLimitPerQuestion: quiz?.timeLimitPerQuestion || 3,
      questions: quiz?.questions || [{ id: uuidv4(), type: 'multiple-choice', questionText: '', options: ['', ''], correctAnswerIndex: -1 }],
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "questions",
  });
  
  const watchTimeLimitEnabled = form.watch('timeLimitEnabled');
  const watchedForm = form.watch();
  const [debouncedForm] = useDebounce(watchedForm, 1000);

  // Auto-save draft
  useEffect(() => {
    // Don't save if it's the initial state of an existing quiz
    if (quiz && !form.formState.isDirty) return;
    
    // Save to localStorage
    const draftData = JSON.stringify(debouncedForm);
    localStorage.setItem(DRAFT_STORAGE_KEY, draftData);
  }, [debouncedForm, quiz, form.formState.isDirty]);
  
  // Load draft on component mount
  useEffect(() => {
    const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (savedDraft && !quiz) { // Only load draft for new quizzes
      const draftData = JSON.parse(savedDraft);
      toast({
        title: "Draft Found",
        description: "You have an unsaved quiz draft.",
        action: (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => {
                form.reset(draftData);
                toast({ title: "Draft restored!" });
            }}>
              Restore
            </Button>
            <Button size="sm" variant="secondary" onClick={() => {
                localStorage.removeItem(DRAFT_STORAGE_KEY);
                toast({ title: "Draft cleared." });
            }}>
              Discard
            </Button>
          </div>
        ),
        duration: 10000,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz, form.reset]);


  const onSubmit = async (data: QuizFormValues) => {
    setIsSubmitting(true);
    try {
      const dataToSave: Partial<Quiz> = {
        ...data,
        passThreshold: data.passThreshold === undefined ? null : data.passThreshold,
        timeLimitEnabled: data.timeLimitEnabled,
        timeLimitPerQuestion: data.timeLimitPerQuestion,
      }

      if (quiz) {
        // Update existing quiz
        const quizRef = doc(db, 'quizzes', quiz.id);
        await updateDoc(quizRef, dataToSave);
        toast({ title: "Quiz Updated", description: "The quiz has been successfully updated." });
      } else {
        // Create new quiz
        await addDoc(collection(db, 'quizzes'), {
          ...dataToSave,
          createdAt: serverTimestamp(),
        });
        toast({ title: "Quiz Created", description: "The new quiz has been successfully created." });
      }
      localStorage.removeItem(DRAFT_STORAGE_KEY); // Clear draft on successful submission
      onSuccess();
      closeDialog();
    } catch (error) {
      console.error("Error saving quiz:", error);
      toast({ variant: 'destructive', title: "Save Failed", description: "An unexpected error occurred." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addOption = (questionIndex: number) => {
    const options = form.getValues(`questions.${questionIndex}.options`) || [];
    if (options.length < 6) {
      form.setValue(`questions.${questionIndex}.options`, [...options, '']);
    }
  };
  
  const removeOption = (questionIndex: number, optionIndex: number) => {
    const options = form.getValues(`questions.${questionIndex}.options`) || [];
    options.splice(optionIndex, 1);
    form.setValue(`questions.${questionIndex}.options`, options);
  };
  
  const handleQuestionTypeChange = (value: 'multiple-choice' | 'multiple-select' | 'free-text', index: number) => {
    const currentQuestion = form.getValues(`questions.${index}`);
    const newQuestion: any = {
        ...currentQuestion,
        type: value,
    };
    
    // Reset specific answer fields when type changes
    if (value === 'multiple-choice') {
        delete newQuestion.correctAnswerIndexes;
        newQuestion.correctAnswerIndex = -1;
    } else if (value === 'multiple-select') {
        delete newQuestion.correctAnswerIndex;
        newQuestion.correctAnswerIndexes = [];
    } else if (value === 'free-text') {
        delete newQuestion.correctAnswerIndex;
        delete newQuestion.correctAnswerIndexes;
        newQuestion.options = [];
        newQuestion.minCharLength = 50; // Default min length
    }

    update(index, newQuestion);
};


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
        <ScrollArea className="flex-grow pr-6 -mr-6">
            <div className="space-y-6">
                <div className="space-y-4">
                    <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Quiz Title</FormLabel>
                            <FormControl>
                                <Input {...field} placeholder="e.g., Final Exam" />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    
                    <FormField
                        control={form.control}
                        name="shuffleQuestions"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                <div className="space-y-0.5">
                                    <FormLabel>Shuffle Questions</FormLabel>
                                    <FormDescription>Randomize the question order for each attempt.</FormDescription>
                                </div>
                                <FormControl>
                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="timeLimitEnabled"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                <div className="space-y-0.5">
                                    <FormLabel>Enable Time Limit</FormLabel>
                                    <FormDescription>Set a time limit for the entire quiz.</FormDescription>
                                </div>
                                <FormControl>
                                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                            </FormItem>
                        )}
                    />

                    {watchTimeLimitEnabled && (
                        <FormField
                            control={form.control}
                            name="timeLimitPerQuestion"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Time Limit Per Question (minutes)</FormLabel>
                                <FormControl>
                                    <Input type="number" {...field} value={field.value || ''} placeholder="e.g., 3" />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}


                    <FormField
                        control={form.control}
                        name="passThreshold"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Passing Percentage ({field.value || 'Default'}%)</FormLabel>
                            <FormControl>
                                <Slider
                                    defaultValue={[field.value || 70]}
                                    onValueChange={(value) => field.onChange(value[0])}
                                    max={100}
                                    step={5}
                                />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="space-y-4">
                    {fields.map((field, index) => (
                        <Card key={field.id} className="p-4">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-semibold">Question {index + 1}</h4>
                                <div className="flex items-center gap-2">
                                    <Select onValueChange={(value: 'multiple-choice' | 'multiple-select' | 'free-text') => handleQuestionTypeChange(value, index)} defaultValue={field.type}>
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue placeholder="Question Type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="multiple-choice">Multiple Choice</SelectItem>
                                            <SelectItem value="multiple-select">Multiple Select</SelectItem>
                                            <SelectItem value="free-text">Free Text</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor={`questions.${index}.questionText`}>Question</Label>
                                <Textarea id={`questions.${index}.questionText`} {...form.register(`questions.${index}.questionText`)} />
                                {form.formState.errors.questions?.[index]?.questionText && <p className="text-sm text-destructive">{form.formState.errors.questions?.[index]?.questionText?.message}</p>}
                                
                                {field.type === 'free-text' ? (
                                    <FormField
                                        control={form.control}
                                        name={`questions.${index}.minCharLength`}
                                        render={({ field: lengthField }) => (
                                            <FormItem>
                                                <FormLabel>Min. Character Length</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        {...lengthField}
                                                        value={lengthField.value || ''}
                                                        onChange={e => lengthField.onChange(parseInt(e.target.value, 10))}
                                                        placeholder="e.g., 50"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                ) : <Label>Options & Correct Answer(s)</Label> }

                                {field.type === 'multiple-choice' && (
                                    <Controller
                                        control={form.control}
                                        name={`questions.${index}.correctAnswerIndex`}
                                        render={({ field: radioField }) => (
                                            <RadioGroup onValueChange={(val) => radioField.onChange(Number(val))} value={String(radioField.value)} className="space-y-2">
                                                {(form.watch(`questions.${index}.options`) || []).map((_, optionIndex) => (
                                                    <div key={optionIndex} className="flex items-center gap-2">
                                                        <RadioGroupItem value={String(optionIndex)} id={`questions.${index}.option.${optionIndex}.radio`} />
                                                        <Input {...form.register(`questions.${index}.options.${optionIndex}`)} placeholder={`Option ${optionIndex + 1}`} />
                                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(index, optionIndex)}><Trash2 className="h-4 w-4" /></Button>
                                                    </div>
                                                ))}
                                            </RadioGroup>
                                        )}
                                    />
                                )}

                                {field.type === 'multiple-select' && (
                                    <Controller
                                        control={form.control}
                                        name={`questions.${index}.correctAnswerIndexes`}
                                        render={({ field: checkboxField }) => (
                                            <div className="space-y-2">
                                                {(form.watch(`questions.${index}.options`) || []).map((_, optionIndex) => (
                                                    <div key={optionIndex} className="flex items-center gap-2">
                                                        <Checkbox
                                                            checked={checkboxField.value?.includes(optionIndex)}
                                                            onCheckedChange={(checked) => {
                                                                const currentValues = checkboxField.value || [];
                                                                if (checked) {
                                                                    checkboxField.onChange([...currentValues, optionIndex]);
                                                                } else {
                                                                    checkboxField.onChange(currentValues.filter((v) => v !== optionIndex));
                                                                }
                                                            }}
                                                        />
                                                        <Input {...form.register(`questions.${index}.options.${optionIndex}`)} placeholder={`Option ${optionIndex + 1}`} />
                                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(index, optionIndex)}><Trash2 className="h-4 w-4" /></Button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    />
                                )}

                                {field.type !== 'free-text' && (
                                    <Button type="button" variant="outline" size="sm" onClick={() => addOption(index)} disabled={(form.watch(`questions.${index}.options`) || []).length >= 6}>
                                        <Plus className="mr-2 h-4 w-4" /> Add Option
                                    </Button>
                                )}

                                {form.formState.errors.questions?.[index]?.options && <p className="text-sm text-destructive">{form.formState.errors.questions?.[index]?.options?.message}</p>}
                                {form.formState.errors.questions?.[index]?.correctAnswerIndex && <p className="text-sm text-destructive">{form.formState.errors.questions?.[index]?.correctAnswerIndex?.message}</p>}
                                {form.formState.errors.questions?.[index]?.correctAnswerIndexes && <p className="text-sm text-destructive">{form.formState.errors.questions?.[index]?.correctAnswerIndexes?.message}</p>}
                            </div>
                        </Card>
                    ))}
                </div>
                <Button type="button" variant="secondary" onClick={() => append({ id: uuidv4(), type: 'multiple-choice', questionText: '', options: ['', ''], correctAnswerIndex: -1 })}>
                    <Plus className="mr-2 h-4 w-4" /> Add Question
                </Button>
            </div>
        </ScrollArea>
        <DialogFooter className="pt-4 border-t">
          <Button type="button" variant="secondary" onClick={closeDialog}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {quiz ? 'Save Changes' : 'Create Quiz'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
};

export default function QuizzesPage() {
    const { hasPermission } = useAuth();
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
    const { toast } = useToast();

    const fetchQuizzes = useCallback(async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'quizzes'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const quizList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quiz));
            setQuizzes(quizList);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Failed to fetch quizzes.' });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        if(hasPermission('manageQuizzes')) {
            fetchQuizzes();
        } else {
            setLoading(false);
        }
    }, [fetchQuizzes, hasPermission]);

    const handleSuccess = () => {
        setIsFormOpen(false);
        setEditingQuiz(null);
        fetchQuizzes();
    };
    
    const handleDelete = async (quizId: string) => {
        try {
            await deleteDoc(doc(db, 'quizzes', quizId));
            toast({ title: 'Quiz deleted successfully.' });
            fetchQuizzes();
        } catch (error) {
             toast({ variant: 'destructive', title: 'Failed to delete quiz.' });
        }
    };

    if (!hasPermission('manageQuizzes')) {
        return <p>You do not have permission to manage quizzes.</p>
    }

    return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold md:text-4xl">Content Library - Quizzes</h1>
        <p className="text-muted-foreground">Create, edit, and manage course quizzes.</p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All Quizzes</CardTitle>
          <div className="flex gap-2">
            <Button asChild variant="outline">
                <Link href="/admin/reports/quizzes"><BarChart2 className="mr-2 h-4 w-4" /> View Reports</Link>
            </Button>
            <Button onClick={() => { setEditingQuiz(null); setIsFormOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" /> Add New Quiz
            </Button>
          </div>
        </CardHeader>
        <CardContent>
            {loading ? (
                Array.from({length: 3}).map((_, i) => <Skeleton key={i} className="h-16 w-full mb-2" />)
            ) : quizzes.length > 0 ? (
                <div className="border rounded-lg">
                    <div className="divide-y">
                        {quizzes.map(quiz => (
                            <div key={quiz.id} className="p-4 flex justify-between items-center hover:bg-muted/50">
                                <div>
                                    <p className="font-semibold">{quiz.title}</p>
                                    <p className="text-sm text-muted-foreground">{quiz.questions.length} questions</p>
                                </div>
                                <div className="flex items-center gap-2">
                                     <Button variant="ghost" size="icon" onClick={() => { setEditingQuiz(quiz); setIsFormOpen(true); }}>
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This will permanently delete the quiz "{quiz.title}".
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDelete(quiz.id)}>Delete</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
                    <FileQuestion className="h-12 w-12" />
                    <p className="mt-4">No quizzes found. Add one to get started.</p>
                </div>
            )}
        </CardContent>
      </Card>
      
       <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingQuiz ? 'Edit Quiz' : 'Create New Quiz'}</DialogTitle>
          </DialogHeader>
          <QuizForm quiz={editingQuiz} onSuccess={handleSuccess} closeDialog={() => setIsFormOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}



