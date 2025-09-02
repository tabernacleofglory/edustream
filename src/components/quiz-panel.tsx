
"use client";

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from './ui/button';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { CheckCircle2, XCircle, Trophy, FileQuestion, Loader2, Repeat } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import type { Quiz as QuizData, UserQuizResult, QuizQuestion, SiteSettings } from '@/lib/types';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import Confetti from 'react-confetti';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import { cn } from '@/lib/utils';


interface QuizPanelProps {
  quizData: QuizData;
  courseId: string;
  onQuizComplete: () => void;
}

const createQuizSchema = (quizData: QuizData) => {
    const shape: { [key: string]: any } = {};
    (quizData.questions || []).forEach((q) => {
        switch (q.type) {
            case 'multiple-choice':
                shape[`question_${q.id}`] = z.string({ required_error: "Please select an answer." });
                break;
            case 'multiple-select':
                shape[`question_${q.id}`] = z.array(z.number()).min(1, "Please select at least one answer.");
                break;
            case 'free-text':
                 const minLength = q.minCharLength || 1;
                shape[`question_${q.id}`] = z.string().min(minLength, `Your answer must be at least ${minLength} characters long.`);
                break;
            default:
                break;
        }
    });
    return z.object(shape);
};

interface AnswerResult extends QuizQuestion {
    isCorrect: boolean;
    userAnswer: any;
}


export default function QuizPanel({ quizData, courseId, onQuizComplete }: QuizPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [passed, setPassed] = useState(false);
  const [results, setResults] = useState<AnswerResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [passThreshold, setPassThreshold] = useState(70); // Default threshold

  useEffect(() => {
    const fetchSettings = async () => {
        if (quizData.passThreshold !== undefined && quizData.passThreshold !== null) {
            setPassThreshold(quizData.passThreshold);
        } else {
            const settingsDoc = await getDoc(doc(db, 'siteSettings', 'main'));
            if (settingsDoc.exists()) {
                const settings = settingsDoc.data() as SiteSettings;
                setPassThreshold(settings.quiz_pass_threshold || 70);
            }
        }
    };
    fetchSettings();
  }, [quizData]);

  const quizSchema = createQuizSchema(quizData);

  const { control, handleSubmit, formState: { errors }, reset } = useForm({
    resolver: zodResolver(quizSchema)
  });

  const onSubmit = async (data: any) => {
    setIsLoading(true);
    let correctAnswers = 0;
    const answerResults: AnswerResult[] = [];

    (quizData.questions || []).forEach((q) => {
        const userAnswer = data[`question_${q.id}`];
        let isCorrect = false;

        switch(q.type) {
            case 'multiple-choice':
                isCorrect = Number(userAnswer) === q.correctAnswerIndex;
                break;
            case 'multiple-select':
                const correctIndexes = new Set(q.correctAnswerIndexes);
                const userIndexes = new Set(userAnswer);
                isCorrect = correctIndexes.size === userIndexes.size && [...correctIndexes].every(index => userIndexes.has(index));
                break;
            case 'free-text':
                isCorrect = true; 
                break;
        }
        
        if (isCorrect && q.type !== 'free-text') { // Don't count free-text towards score
            correctAnswers++;
        }
        answerResults.push({ ...q, userAnswer, isCorrect });
    });

    const gradedQuestionsCount = quizData.questions?.filter(q => q.type !== 'free-text').length || 1;
    const calculatedScore = (correctAnswers / gradedQuestionsCount) * 100;
    const hasPassed = calculatedScore >= passThreshold;
    
    setScore(calculatedScore);
    setResults(answerResults);
    setPassed(hasPassed);
    setSubmitted(true);
    

    if (user) {
        try {
            await addDoc(collection(db, "userQuizResults"), {
                userId: user.uid,
                courseId: courseId,
                quizId: quizData.id,
                answers: data,
                score: calculatedScore,
                passed: hasPassed,
                attemptedAt: serverTimestamp(),
            } as Omit<UserQuizResult, 'id' | 'answers'> & { answers: any });

            if (hasPassed) {
                onQuizComplete();
            }
             toast({ title: "Quiz Submitted", description: `You scored ${calculatedScore.toFixed(0)}%.` });

        } catch (error) {
            console.error("Error saving quiz results:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not save your quiz results.' });
        }
    }
    setIsLoading(false);
  };

  const handleRetake = () => {
    setSubmitted(false);
    setScore(0);
    setResults([]);
    reset();
  };

  if (!quizData.questions || quizData.questions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-muted">
        <p>This quiz has no questions yet.</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <Card className="m-auto max-w-2xl">
         {passed && <Confetti recycle={false} />}
        <CardHeader className="text-center">
            <Trophy className="mx-auto h-12 w-12 text-yellow-500" />
            <CardTitle>Quiz Complete!</CardTitle>
            <CardDescription>You scored</CardDescription>
            <p className="text-4xl font-bold">{score.toFixed(0)}%</p>
            {passed ? (
                <Alert variant="default" className="bg-green-100 dark:bg-green-900 border-green-200 dark:border-green-800">
                    <AlertTitle className="text-green-800 dark:text-green-200">Congratulations, you passed!</AlertTitle>
                </Alert>
            ) : (
                 <Alert variant="destructive">
                    <AlertTitle>Try Again</AlertTitle>
                    <AlertDescription>You need to score {passThreshold}% or higher to pass.</AlertDescription>
                </Alert>
            )}
        </CardHeader>
        <CardContent>
            <div className="space-y-4 max-h-[40vh] overflow-y-auto p-2">
                {results.map((r, index) => (
                    <div key={r.id} className="border p-4 rounded-md">
                        <div className="flex items-start justify-between">
                            <p className="font-semibold">{index + 1}. {r.questionText}</p>
                            {r.type === 'free-text' ? null : r.isCorrect ? <CheckCircle2 className="text-green-500" /> : <XCircle className="text-destructive" />}
                        </div>
                         {r.type !== 'free-text' && (
                             <ul className="mt-2 text-sm text-muted-foreground list-disc pl-5">
                                {r.options.map((opt, i) => (
                                    <li key={i} className={cn(
                                        r.type === 'multiple-choice' && i === r.correctAnswerIndex && 'font-bold text-green-600',
                                        r.type === 'multiple-select' && r.correctAnswerIndexes?.includes(i) && 'font-bold text-green-600'
                                    )}>
                                        {opt}
                                    </li>
                                ))}
                            </ul>
                         )}
                         {r.type === 'free-text' && (
                            <div className="mt-2 p-2 bg-muted rounded-md text-sm">
                                <strong>Your Answer:</strong> <em>{r.userAnswer}</em>
                            </div>
                         )}
                    </div>
                ))}
            </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-2">
            {passed ? (
                <Button className="w-full" onClick={onQuizComplete}>
                    Continue
                </Button>
            ) : (
                <Button className="w-full" onClick={handleRetake}>
                   <Repeat className="mr-2 h-4 w-4" /> Retake Quiz
                </Button>
            )}
        </CardFooter>
      </Card>
    );
  }


  return (
    <div className="p-4 md:p-8 h-full bg-background overflow-y-auto">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileQuestion /> {quizData.title}
          </CardTitle>
          <CardDescription>Complete the quiz to finalize the course.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            {(quizData.questions || []).map((q, index) => (
              <div key={q.id}>
                <p className="font-semibold mb-2">
                  {index + 1}. {q.questionText}
                </p>
                 {q.type === 'multiple-choice' && (
                     <Controller
                      name={`question_${q.id}`}
                      control={control}
                      render={({ field }) => (
                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="space-y-2">
                          {q.options.map((option, i) => (
                            <Label key={i} className="flex items-center gap-2 p-3 rounded-md border has-[:checked]:border-primary cursor-pointer">
                              <RadioGroupItem value={String(i)} />
                              {option}
                            </Label>
                          ))}
                        </RadioGroup>
                      )}
                    />
                 )}
                 {q.type === 'multiple-select' && (
                     <Controller
                        name={`question_${q.id}`}
                        control={control}
                        render={({ field }) => (
                            <div className="space-y-2">
                                {q.options.map((option, i) => (
                                    <Label key={i} className="flex items-center gap-2 p-3 rounded-md border has-[:checked]:border-primary cursor-pointer">
                                        <Checkbox
                                            checked={field.value?.includes(i)}
                                            onCheckedChange={(checked) => {
                                                const currentValues = field.value || [];
                                                if (checked) {
                                                    field.onChange([...currentValues, i]);
                                                } else {
                                                    field.onChange(currentValues.filter((v: number) => v !== i));
                                                }
                                            }}
                                        />
                                        {option}
                                    </Label>
                                ))}
                            </div>
                        )}
                    />
                 )}
                  {q.type === 'free-text' && (
                    <Controller
                        name={`question_${q.id}`}
                        control={control}
                        render={({ field }) => (
                            <Textarea
                                {...field}
                                placeholder="Type your answer here..."
                                rows={4}
                            />
                        )}
                    />
                  )}
                 {errors[`question_${q.id}`] && <p className="text-sm text-destructive mt-1">{(errors[`question_${q.id}`] as any).message}</p>}
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Quiz
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
