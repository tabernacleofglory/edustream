'use server';

import { askGroqJson } from '@/lib/ai/groq';

export interface SuggestCourseTagsInput {
  courseTitle: string;
  courseDescription: string;
}

export interface SuggestCourseTagsOutput {
  suggestedCategories: string[];
  suggestedTags: string[];
  reasoning: string;
}

const SYSTEM_PROMPT = `You are an expert instructional designer and SEO specialist for an online learning platform. Analyze course titles and descriptions to suggest relevant categories and tags.`;

export async function suggestCourseTags(input: SuggestCourseTagsInput): Promise<SuggestCourseTagsOutput> {
  const prompt = `Analyze the following course and suggest categories and tags.

Course Title: ${input.courseTitle}
Course Description: ${input.courseDescription}

Return a JSON object with:
- suggestedCategories: array of 2-3 broad categories
- suggestedTags: array of 5-10 specific keywords
- reasoning: a brief one-sentence explanation`;

  return askGroqJson<SuggestCourseTagsOutput>(SYSTEM_PROMPT, prompt);
}
