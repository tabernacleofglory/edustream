"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "./ui/button";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Label } from "./ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import {
  Trophy,
  FileQuestion,
  Loader2,
  Repeat,
  Clock,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { Quiz as QuizData, UserQuizResult, QuizQuestion, SiteSettings } from "@/lib/types";
import { collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import Confetti from "react-confetti";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";

interface QuizPanelProps {
  quizData: QuizData;
  courseId: string;
  onQuizComplete: () => void;
}

const createQuizSchema = (quizData: QuizData) => {
  const shape: Record<string, any> = {};
  (quizData.questions || []).forEach((q) => {
    switch (q.type) {
      case "multiple-choice":
        shape[`question_${q.id}`] = z.string({ required_error: "Please select an answer." });
        break;
      case "multiple-select":
        shape[`question_${q.id}`] = z.array(z.number()).min(1, "Select at least one answer.");
        break;
      case "free-text":
        const minLength = q.minCharLength || 1;
        shape[`question_${q.id}`] = z.string().min(minLength, `At least ${minLength} characters.`);
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
  const [passThreshold, setPassThreshold] = useState(70);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const shuffledQuestions = useMemo(() => {
    if (quizData.shuffleQuestions) {
      return [...(quizData.questions || [])].sort(() => Math.random() - 0.5);
    }
    return quizData.questions || [];
  }, [quizData]);

  const timeLimitInSeconds = useMemo(() => {
    if (!quizData.timeLimitEnabled || !quizData.timeLimitPerQuestion) return null;
    return (quizData.timeLimitPerQuestion || 0) * (quizData.questions?.length || 0) * 60;
  }, [quizData]);

  useEffect(() => {
    if (timeLimitInSeconds !== null && !submitted) {
      setTimeLeft(timeLimitInSeconds);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev && prev > 1) return prev - 1;
          if (timerRef.current) clearInterval(timerRef.current);
          handleSubmit(onSubmit)(); // auto submit
          return 0;
        });
      }, 1000);
    }
    return () => timerRef.current && clearInterval(timerRef.current);
  }, [timeLimitInSeconds, submitted]);

  useEffect(() => {
    const fetchSettings = async () => {
      if (quizData.passThreshold != null) {
        setPassThreshold(quizData.passThreshold);
      } else {
        const sSnap = await getDoc(doc(db, "siteSettings", "main"));
        if (sSnap.exists()) {
          const s = sSnap.data() as SiteSettings;
          setPassThreshold(s.quiz_pass_threshold || 70);
        }
      }
    };
    fetchSettings();
  }, [quizData]);

  const quizSchema = createQuizSchema(quizData);

  // Default values ensure no uncontrolled fields
  const defaultValues = Object.fromEntries(
    (quizData.questions || []).map((q) => [
      `question_${q.id}`,
      q.type === "multiple-select" ? [] : "",
    ])
  );

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    resolver: zodResolver(quizSchema),
    defaultValues,
  });

  const onSubmit = async (data: any) => {
    setIsLoading(true);
    let correctAnswers = 0;
    const answerResults: AnswerResult[] = [];

    shuffledQuestions.forEach((q) => {
      const userAnswer = data[`question_${q.id}`];
      let isCorrect = false;

      switch (q.type) {
        case "multiple-choice":
          isCorrect = Number(userAnswer) === q.correctAnswerIndex;
          break;
        case "multiple-select":
          const correct = new Set(q.correctAnswerIndexes);
          const user = new Set(userAnswer);
          isCorrect = correct.size === user.size && [...correct].every((x) => user.has(x));
          break;
        case "free-text":
          isCorrect = true;
          break;
      }

      if (isCorrect && q.type !== "free-text") correctAnswers++;
      answerResults.push({ ...q, userAnswer, isCorrect });
    });

    const graded = (quizData.questions || []).filter((q) => q.type !== "free-text").length || 1;
    const calculatedScore = (correctAnswers / graded) * 100;
    const hasPassed = calculatedScore >= passThreshold;

    setScore(calculatedScore);
    setResults(answerResults);
    setPassed(hasPassed);
    setSubmitted(true);
    timerRef.current && clearInterval(timerRef.current);

    if (user) {
      try {
        await addDoc(collection(db, "userQuizResults"), {
          userId: user.uid,
          courseId,
          quizId: quizData.id,
          answers: data,
          score: calculatedScore,
          passed: hasPassed,
          attemptedAt: serverTimestamp(),
        });
        if (hasPassed) onQuizComplete();
        toast({ title: "Quiz Submitted", description: `You scored ${calculatedScore.toFixed(0)}%.` });
      } catch (err) {
        console.error("Error saving quiz:", err);
        toast({ variant: "destructive", title: "Error", description: "Could not save results." });
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

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // --- UI ---
  if (!shuffledQuestions.length)
    return <div className="flex items-center justify-center h-full bg-muted"><p>No questions yet.</p></div>;

  if (submitted) {
    const incorrect = results.filter((r) => !r.isCorrect && r.type !== "free-text");
    return (
      <Card className="m-auto max-w-2xl">
        {passed && <Confetti recycle={false} />}
        <CardHeader className="text-center">
          <Trophy className="mx-auto h-12 w-12 text-yellow-500" />
          <CardTitle>Quiz Complete!</CardTitle>
          <CardDescription>You scored</CardDescription>
          <p className="text-4xl font-bold">{score.toFixed(0)}%</p>
          {passed ? (
            <Alert className="bg-green-100 dark:bg-green-900 border-green-200 dark:border-green-800">
              <AlertTitle className="text-green-800 dark:text-green-200">You passed!</AlertTitle>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <AlertTitle>Try Again</AlertTitle>
              <AlertDescription>Need {passThreshold}% or higher.</AlertDescription>
            </Alert>
          )}
        </CardHeader>

        {!passed && (
          <CardContent>
            <h3 className="font-semibold text-center mb-4">Review Incorrect Answers</h3>
            <div className="space-y-4 max-h-[40vh] overflow-y-auto p-2">
              {incorrect.map((r, i) => (
                <div key={r.id} className="border p-4 rounded-md">
                  <div className="flex items-start justify-between">
                    <p className="font-semibold">{i + 1}. {r.questionText}</p>
                    <XCircle className="text-destructive" />
                  </div>
                  <ul className="mt-2 text-sm text-muted-foreground list-disc pl-5">
                    {r.options.map((opt, idx) => (
                      <li
                        key={idx}
                        className={cn(
                          (r.type === "multiple-choice" && idx === r.correctAnswerIndex) && "font-bold text-green-600",
                          (r.type === "multiple-select" && r.correctAnswerIndexes?.includes(idx)) && "font-bold text-green-600"
                        )}
                      >
                        {opt}
                        {r.type === "multiple-choice" && idx === Number(r.userAnswer) && <Badge variant="destructive" className="ml-2">Your Answer</Badge>}
                        {r.type === "multiple-select" && r.userAnswer?.includes(idx) && <Badge variant="destructive" className="ml-2">Your Answer</Badge>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {!incorrect.length && <p className="text-center text-muted-foreground">All graded questions correct!</p>}
            </div>
          </CardContent>
        )}

        <CardFooter className="flex flex-col sm:flex-row gap-2">
          {passed ? (
            <Button className="w-full" onClick={onQuizComplete}>Continue</Button>
          ) : (
            <Button className="w-full" onClick={handleRetake}><Repeat className="mr-2 h-4 w-4" />Retake Quiz</Button>
          )}
        </CardFooter>
      </Card>
    );
  }

  // Quiz in progress
  return (
    <div className="p-4 md:p-8 h-full bg-background overflow-y-auto">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2"><FileQuestion /> {quizData.title}</div>
            {timeLeft !== null && (
              <Badge variant={timeLeft < 60 ? "destructive" : "outline"} className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>{formatTime(timeLeft)}</span>
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Complete the quiz to finalize the course.</CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            {shuffledQuestions.map((q, idx) => (
              <div key={q.id}>
                <p className="font-semibold mb-2">{idx + 1}. {q.questionText}</p>

                {q.type === "multiple-choice" && (
                  <Controller
                    name={`question_${q.id}`}
                    control={control}
                    render={({ field }) => (
                      <RadioGroup value={field.value ?? ""} onValueChange={field.onChange} className="space-y-2">
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

                {q.type === "multiple-select" && (
                  <Controller
                    name={`question_${q.id}`}
                    control={control}
                    render={({ field }) => (
                      <div className="space-y-2">
                        {q.options.map((option, i) => (
                          <Label key={i} className="flex items-center gap-2 p-3 rounded-md border has-[:checked]:border-primary cursor-pointer">
                            <Checkbox
                              checked={(field.value || []).includes(i)}
                              onCheckedChange={(checked) => {
                                const current = field.value || [];
                                field.onChange(checked ? [...current, i] : current.filter((v: number) => v !== i));
                              }}
                            />
                            {option}
                          </Label>
                        ))}
                      </div>
                    )}
                  />
                )}

                {q.type === "free-text" && (
                  <Controller
                    name={`question_${q.id}`}
                    control={control}
                    render={({ field }) => (
                      <Textarea {...field} placeholder="Type your answer..." rows={4} />
                    )}
                  />
                )}

                {errors[`question_${q.id}`] && (
                  <p className="text-sm text-destructive mt-1">
                    {(errors[`question_${q.id}`] as any).message}
                  </p>
                )}
              </div>
            ))}
          </CardContent>

          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit Quiz
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
