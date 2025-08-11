
'use server';

/**
 * @fileOverview An AI-powered global search agent for the platform.
 * It searches across courses, videos, and documentation.
 *
 * - globalSearch - A function that performs the search.
 * - GlobalSearchInput - The input type for the globalSearch function.
 * - GlobalSearchOutput - The return type for the globalSearch function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

export const GlobalSearchInputSchema = z.object({
  query: z.string().describe('The user\'s search query.'),
  courses: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    Category: z.array(z.string()),
    tags: z.array(z.string()),
  })).describe('List of all available courses.'),
  videos: z.array(z.object({
    id: z.string(),
    title: z.string(),
    courseId: z.string(),
    courseTitle: z.string(),
  })).describe('List of all available videos with their course context.'),
  documentation: z.array(z.object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
  })).describe('List of all documentation articles.'),
  users: z.array(z.object({
      id: z.string(),
      displayName: z.string().optional().nullable(),
      email: z.string().optional().nullable(),
      role: z.string().optional().nullable(),
      campus: z.string().optional().nullable(),
  })).describe('List of all users.'),
});
export type GlobalSearchInput = z.infer<typeof GlobalSearchInputSchema>;

export const GlobalSearchOutputSchema = z.object({
  results: z.array(z.object({
    id: z.string().describe('The ID of the found item.'),
    title: z.string().describe('The title of the found item.'),
    url: z.string().describe('The URL to the found item.'),
    type: z.enum(['course', 'video', 'document', 'user']).describe('The type of content found.'),
  })).describe('A list of search results.'),
});
export type GlobalSearchOutput = z.infer<typeof GlobalSearchOutputSchema>;

export async function globalSearch(input: GlobalSearchInput): Promise<GlobalSearchOutput> {
  return globalSearchFlow(input);
}

const globalSearchPrompt = ai.definePrompt({
  name: 'globalSearchPrompt',
  input: { schema: GlobalSearchInputSchema },
  output: { schema: GlobalSearchOutputSchema },
  prompt: `You are a powerful search agent for an educational platform. Your task is to find the most relevant content based on the user's query from the provided data.

Search Query: {{{query}}}

Available Data:
---
Courses:
{{#each courses}}
- ID: {{this.id}}, Title: {{this.title}}, Description: {{this.description}}, Categories: {{this.Category}}, Tags: {{this.tags}}
{{/each}}
---
Videos:
{{#each videos}}
- ID: {{this.id}}, Title: {{this.title}}, Course: "{{this.courseTitle}}" (ID: {{this.courseId}})
{{/each}}
---
Documentation:
{{#each documentation}}
- ID: {{this.id}}, Title: {{this.title}}
{{/each}}
---
Users:
{{#each users}}
- ID: {{this.id}}, Name: {{this.displayName}}, Email: {{this.email}}, Role: {{this.role}}, Campus: {{this.campus}}
{{/each}}
---

Based on the query, return a list of the top 5 most relevant results. For each result, provide the ID, title, a URL, and the type of content.

URL Formats:
- Course: /courses/{{id}}
- Video: /courses/{{courseId}}/video/{{id}}
- Document: /documentation#{{id}} (This will need client-side handling to scroll to)
- User: /admin/users?userId={{id}}
`,
});

const globalSearchFlow = ai.defineFlow(
  {
    name: 'globalSearchFlow',
    inputSchema: GlobalSearchInputSchema,
    outputSchema: GlobalSearchOutputSchema,
  },
  async input => {
    const { output } = await globalSearchPrompt(input);
    return output!;
  }
);

    