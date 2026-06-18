'use server';

import { askGroqJson } from '@/lib/ai/groq';

export interface PersonalizedLearningPathsInput {
  watchHistory: string[];
  completedCourses: string[];
  engagementLevel: number;
  classLadder?: string;
  allCourses: {
    courseId: string;
    title: string;
    description: string;
    category: string;
    tags: string[];
  }[];
}

export interface PersonalizedLearningPathsOutput {
  suggestedPaths: string[];
  relevantCourses: {
    courseId: string;
    reason: string;
  }[];
}

const SYSTEM_PROMPT = `You are an AI assistant that suggests personalized learning paths and relevant courses to users based on their learning history and preferences. Only recommend courses that match the user's current class ladder.`;

export async function suggestPersonalizedLearningPaths(
  input: PersonalizedLearningPathsInput
): Promise<PersonalizedLearningPathsOutput> {
  const coursesStr = input.allCourses
    .map(c => `- ID: ${c.courseId}, Title: ${c.title}, Category: ${c.category}, Tags: ${c.tags.join(', ')}`)
    .join('\n');

  const prompt = `Analyze the user's learning profile and suggest personalized learning paths.

Watch History: ${input.watchHistory.join(', ') || 'None'}
Completed Courses: ${input.completedCourses.join(', ') || 'None'}
Engagement Level: ${input.engagementLevel}
Class Ladder: ${input.classLadder || 'Not assigned'}

Available Courses:
${coursesStr}

Return a JSON object with:
- suggestedPaths: array of learning path IDs
- relevantCourses: array of objects with courseId and reason fields`;

  return askGroqJson<PersonalizedLearningPathsOutput>(SYSTEM_PROMPT, prompt);
}
