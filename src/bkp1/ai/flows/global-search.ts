
'use server';

/**
 * @fileOverview An AI-powered global search agent for the platform.
 * It searches across courses, videos, and documentation.
 *
 * - globalSearch - a function that performs the search.
 */

import { ai } from '@/ai/genkit';
import {
  GlobalSearchInputSchema,
  GlobalSearchOutputSchema,
  type GlobalSearchInput,
  type GlobalSearchOutput,
} from '@/ai/schemas/global-search-schemas';

export async function globalSearch(
  input: GlobalSearchInput
): Promise<GlobalSearchOutput> {
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
  async (input) => {
    const { output } = await globalSearchPrompt(input);
    return output!;
  }
);
