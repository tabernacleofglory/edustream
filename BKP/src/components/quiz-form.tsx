
"use client";

import { useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from 'zod';
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { v4 as uuidv4 } from 'uuid';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Trash2 } from "lucide-react";
import type { Quiz } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Form } from "@/components/ui/form";

const quizQuestionSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().default(() => uuidv4()),
    type: z.literal("multiple-choice"),
    questionText: z.string().min(1, "Question text is required"),
    options: z.array(z.string().min(1, "Option cannot be empty")).min(2, "At least two options are required").max(6, "No more than six options are allowed"),
    correctAnswerIndex: z.coerce.number({invalid_type_error: "Please select a correct answer"}).min(0).max(5),
  }),
  z.object({
    id: z.string().default(() => uuidv4()),
    type: z.literal("multiple-select"),
    questionText: z.string().min(1, "Question text is required"),
    options: z.array(z.string().min(1, "Option cannot be empty")).min(2, "At least two options are required").max(6, "No more than six options are allowed"),
    correctAnswerIndexes: z.array(z.number()).min(1, "Select at least one correct answer"),
  }),
  z.object({
    id: z.string().default(() => uuidv4()),
    type: z.literal("free-text"),
    questionText: z.string().min(1, "Question text is required"),
    options: z.array(z.string()).optional(), // Not used for free-text but helps with TS
  }),
]);

const quizFormSchema = z.object({
  title: z.string().min(3, "Quiz title is required"),
  questions: z.array(quizQuestionSchema).min(1, "At least one question is required"),
});

type QuizFormValues = z.infer<typeof quizFormSchema>;

const QuizForm = ({ quiz, onSuccess, closeDialog }: { quiz?: Quiz | null; onSuccess: () => void; closeDialog: () => void; }) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<QuizFormValues>({
    resolver: zodResolver(quizFormSchema),
    defaultValues: {
      title: quiz?.title || '',
      questions: quiz?.questions || [{ id: uuidv4(), type: 'multiple-choice', questionText: '', options: ['', ''], correctAnswerIndex: -1 }],
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "questions",
  });

  const onSubmit = async (data: QuizFormValues) => {
    setIsSubmitting(true);
    try {
      if (quiz) {
        // Update existing quiz
        const quizRef = doc(db, 'quizzes', quiz.id);
        await updateDoc(quizRef, data as any); // Cast because serverTimestamp is not in Zod schema
        toast({ title: "Quiz Updated", description: "The quiz has been successfully updated." });
      } else {
        // Create new quiz
        await addDoc(collection(db, 'quizzes'), {
          ...data,
          createdAt: serverTimestamp(),
        });
        toast({ title: "Quiz Created", description: "The new quiz has been successfully created." });
      }
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
    }

    update(index, newQuestion);
};


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-2">
            <Label htmlFor="quiz-title">Quiz Title</Label>
            <Input id="quiz-title" {...form.register('title')} placeholder="e.g., Final Exam" />
            {form.formState.errors.title && <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>}
        </div>
        <ScrollArea className="h-96 pr-4 -mr-4">
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

                            {field.type !== 'free-text' && <Label>Options & Correct Answer(s)</Label>}

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
                            
                            {field.type === 'free-text' && (
                                <Textarea placeholder="Student response will be captured here." disabled />
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
        </ScrollArea>
         <Button type="button" variant="secondary" onClick={() => append({ id: uuidv4(), type: 'multiple-choice', questionText: '', options: ['', ''], correctAnswerIndex: -1 })}>
            <Plus className="mr-2 h-4 w-4" /> Add Question
        </Button>
        <DialogFooter>
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
export default QuizForm;
