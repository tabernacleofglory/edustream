'use server';

import { askGroqJson } from '@/lib/ai/groq';

export interface GenerateKeywordsInput {
  topic: string;
}

export interface GenerateKeywordsOutput {
  keywords: string[];
}

const SYSTEM_PROMPT = `You are an SEO expert. Generate relevant and high-traffic SEO keywords based on a given topic.`;

export async function generateKeywords(input: GenerateKeywordsInput): Promise<GenerateKeywordsOutput> {
  const prompt = `Based on the following topic, generate a list of 10-15 relevant SEO keywords.

Topic: ${input.topic}

Return a JSON object with a "keywords" field containing an array of keyword strings.`;

  return askGroqJson<GenerateKeywordsOutput>(SYSTEM_PROMPT, prompt);
}
