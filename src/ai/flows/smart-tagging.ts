
'use server';

/**
 * @fileOverview AI-powered course tagging flow.
 *
 * - suggestCourseTags - A function that suggests categories and tags for a course.
 * - SuggestCourseTagsInput - The input type for the suggestCourseTags function.
 * - SuggestCourseTagsOutput - The return type for the suggestCourseTags function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

export const SuggestCourseTagsInputSchema = z.object({
  courseTitle: z.string().describe('The title of the course.'),
  courseDescription: z.string().describe('The detailed description of the course content.'),
});
export type SuggestCourseTagsInput = z.infer<typeof SuggestCourseTagsInputSchema>;


export const SuggestCourseTagsOutputSchema = z.object({
  suggestedCategories: z.array(z.string()).describe('A list of 2-3 suggested high-level categories for the course.'),
  suggestedTags: z.array(z.string()).describe('A list of 5-10 specific keywords or tags for the course.'),
  reasoning: z.string().describe('A brief explanation of why these categories and tags were chosen.'),
});
export type SuggestCourseTagsOutput = z.infer<typeof SuggestCourseTagsOutputSchema>;

export async function suggestCourseTags(input: SuggestCourseTagsInput): Promise<SuggestCourseTagsOutput> {
  return suggestCourseTagsFlow(input);
}

const suggestTagsPrompt = ai.definePrompt({
  name: 'suggestCourseTagsPrompt',
  input: {schema: SuggestCourseTagsInputSchema},
  output: {schema: SuggestCourseTagsOutputSchema},
  prompt: `You are an expert instructional designer and SEO specialist for an online learning platform. Your task is to analyze a course title and description and suggest relevant categories and tags.

Course Title: {{{courseTitle}}}
Course Description: {{{courseDescription}}}

Based on this information, please provide:
1.  A list of 2-3 broad categories that this course would fit into.
2.  A list of 5-10 specific tags (keywords) that accurately describe the course content.
3.  A brief, one-sentence reasoning for your choices.

Return the result in the format specified by the output schema.
`,
});

const suggestCourseTagsFlow = ai.defineFlow(
  {
    name: 'suggestCourseTagsFlow',
    inputSchema: SuggestCourseTagsInputSchema,
    outputSchema: SuggestCourseTagsOutputSchema,
  },
  async input => {
    const {output} = await suggestTagsPrompt(input);
    return output!;
  }
);

    