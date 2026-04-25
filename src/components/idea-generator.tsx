"use client";

import { useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  generateCourseIdeas,
  type GenerateCourseIdeasInput,
  type GenerateCourseIdeasOutput,
} from "@/ai/flows/course-ideas";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Loader2, Sparkles, BookOpen } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Separator } from "./ui/separator";
import { Skeleton } from "./ui/skeleton";

const formSchema = z.object({
  topic: z.string().min(3, "Topic must be at least 3 characters"),
  targetAudience: z
    .string()
    .min(3, "Target audience must be at least 3 characters"),
});

export default function IdeaGenerator() {
  const [result, setResult] = useState<GenerateCourseIdeasOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GenerateCourseIdeasInput>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit: SubmitHandler<GenerateCourseIdeasInput> = async (data) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await generateCourseIdeas(data);
      setResult(response);
    } catch (e) {
      setError("Failed to get suggestions. Please try again.");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Course Idea Generator</CardTitle>
          <CardDescription>
            Enter a topic and target audience to brainstorm new course ideas.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="topic">Topic</Label>
              <Input
                id="topic"
                {...register("topic")}
                placeholder="e.g., Digital Marketing, Leadership, etc."
              />
              {errors.topic && (
                <p className="text-sm text-destructive">
                  {errors.topic.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetAudience">Target Audience</Label>
              <Input
                id="targetAudience"
                {...register("targetAudience")}
                placeholder="e.g., Beginners, Small Business Owners, etc."
              />
              {errors.targetAudience && (
                <p className="text-sm text-destructive">
                  {errors.targetAudience.message}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate Ideas
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Generated Ideas</CardTitle>
          <CardDescription>
            Creative and structured course ideas from the AI.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
             <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!result && !isLoading && !error && (
            <div className="text-center text-muted-foreground py-8">
              <Sparkles className="mx-auto h-12 w-12" />
              <p className="mt-4">Your generated course ideas will appear here.</p>
            </div>
          )}
          {isLoading && (
            <div className="space-y-6">
                {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="space-y-3">
                        <Skeleton className="h-6 w-3/4 bg-muted" />
                        <Skeleton className="h-4 w-full bg-muted" />
                        <Skeleton className="h-4 w-5/6 bg-muted" />
                         <Skeleton className="h-5 w-24 mt-2 bg-muted" />
                        <div className="space-y-2 pl-4">
                            <Skeleton className="h-4 w-1/2 bg-muted" />
                            <Skeleton className="h-4 w-1/2 bg-muted" />
                        </div>
                    </div>
                ))}
            </div>
          )}

          {result && (
            <div className="space-y-6">
                {result.ideas.map((idea, index) => (
                    <div key={index}>
                        <h3 className="font-headline text-lg font-semibold">{idea.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1 mb-3">{idea.description}</p>
                        
                        <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
                            <BookOpen className="h-4 w-4" />
                            Potential Modules
                        </h4>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                            {idea.potentialModules.map((module, modIndex) => (
                                <li key={modIndex}>{module}</li>
                            ))}
                        </ul>

                        {index < result.ideas.length - 1 && <Separator className="my-6" />}
                    </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
