
"use client";

import { useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  suggestCourseTags,
  type SuggestCourseTagsInput,
  type SuggestCourseTagsOutput,
} from "@/ai/flows/smart-tagging";
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
import { Lightbulb, Loader2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";

const formSchema = z.object({
  courseTitle: z.string().min(5, "Title must be at least 5 characters"),
  courseDescription: z
    .string()
    .min(20, "Description must be at least 20 characters"),
});

export default function SmartTagger() {
  const [result, setResult] = useState<SuggestCourseTagsOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SuggestCourseTagsInput>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit: SubmitHandler<SuggestCourseTagsInput> = async (data) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await suggestCourseTags(data);
      if (!response.suggestedCategories || !response.suggestedTags) {
        throw new Error("The AI returned an invalid response. Please try adjusting your input.");
      }
      setResult(response);
    } catch (e: any) {
      const errorMessage = e.message || "An unexpected error occurred. Please check the console or try again later.";
      setError(errorMessage);
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Course Details</CardTitle>
          <CardDescription>
            Enter the details for the course you want to tag.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="courseTitle">Course Title</Label>
              <Input
                id="courseTitle"
                {...register("courseTitle")}
                placeholder="e.g., Advanced TypeScript"
              />
              {errors.courseTitle && (
                <p className="text-sm text-destructive">
                  {errors.courseTitle.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="courseDescription">Course Description</Label>
              <Textarea
                id="courseDescription"
                {...register("courseDescription")}
                placeholder="Describe the course content, target audience, and learning objectives."
                rows={6}
              />
              {errors.courseDescription && (
                <p className="text-sm text-destructive">
                  {errors.courseDescription.message}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate Suggestions
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>AI Suggestions</CardTitle>
          <CardDescription>
            Categories and tags suggested by the AI.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
             <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Suggestion Failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!result && !isLoading && !error && (
            <div className="text-center text-muted-foreground py-8">
              <Lightbulb className="mx-auto h-12 w-12" />
              <p className="mt-4">Your suggestions will appear here.</p>
            </div>
          )}
          {isLoading && (
            <div className="space-y-6">
                <div className="space-y-2">
                    <div className="h-5 w-32 bg-muted rounded animate-pulse" />
                    <div className="flex flex-wrap gap-2">
                        <div className="h-6 w-20 bg-muted rounded-full animate-pulse" />
                        <div className="h-6 w-24 bg-muted rounded-full animate-pulse" />
                        <div className="h-6 w-16 bg-muted rounded-full animate-pulse" />
                    </div>
                </div>
                 <div className="space-y-2">
                    <div className="h-5 w-32 bg-muted rounded animate-pulse" />
                    <div className="flex flex-wrap gap-2">
                        <div className="h-6 w-28 bg-muted rounded-full animate-pulse" />
                        <div className="h-6 w-20 bg-muted rounded-full animate-pulse" />
                    </div>
                </div>
                 <div className="space-y-2">
                    <div className="h-5 w-24 bg-muted rounded animate-pulse" />
                    <div className="h-16 w-full bg-muted rounded animate-pulse" />
                </div>
            </div>
          )}

          {result && (
            <>
              <div>
                <h3 className="font-semibold mb-2">Suggested Categories</h3>
                <div className="flex flex-wrap gap-2">
                  {result.suggestedCategories.map((cat) => (
                    <Badge key={cat} variant="secondary" className="text-sm">{cat}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Suggested Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {result.suggestedTags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-sm">{tag}</Badge>
                  ))}
                </div>
              </div>
              <div>
                 <h3 className="font-semibold mb-2">Reasoning</h3>
                 <p className="text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg">
                    {result.reasoning}
                 </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
