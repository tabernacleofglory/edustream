'use server';

import { askGroqJson } from '@/lib/ai/groq';

export interface GenerateCourseIdeasInput {
  topic: string;
  targetAudience: string;
}

export interface GenerateCourseIdeasOutput {
  ideas: {
    title: string;
    description: string;
    potentialModules: string[];
  }[];
}

const SYSTEM_PROMPT = `You are an expert curriculum designer for an online learning platform. Generate creative and engaging course ideas based on a topic and target audience.`;

export async function generateCourseIdeas(input: GenerateCourseIdeasInput): Promise<GenerateCourseIdeasOutput> {
  const prompt = `Based on the provided topic and target audience, generate 3 distinct course ideas.

Topic: ${input.topic}
Target Audience: ${input.targetAudience}

Return a JSON object with an "ideas" field containing an array of objects. Each object should have:
- title: a compelling course title
- description: a one-paragraph summary
- potentialModules: an array of 3-5 module titles`;

  return askGroqJson<GenerateCourseIdeasOutput>(SYSTEM_PROMPT, prompt);
}
