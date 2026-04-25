'use server';
/**
 * @fileOverview An AI-powered flow to generate course ideas.
 *
 * - generateCourseIdeas - A function that suggests course ideas based on a topic and audience.
 * - GenerateCourseIdeasInput - The input type for the generateCourseIdeas function.
 * - GenerateCourseIdeasOutput - The return type for the generateCourseIdeas function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

export const GenerateCourseIdeasInputSchema = z.object({
  topic: z.string().describe('The core subject or topic for the course.'),
  targetAudience: z.string().describe('The intended audience for the course (e.g., beginners, experts).'),
});
export type GenerateCourseIdeasInput = z.infer<typeof GenerateCourseIdeasInputSchema>;


export const GenerateCourseIdeasOutputSchema = z.object({
    ideas: z.array(z.object({
        title: z.string().describe("A compelling title for the potential course."),
        description: z.string().describe("A brief, one-paragraph summary of what the course will cover."),
        potentialModules: z.array(z.string()).describe("A list of 3-5 potential module titles for the course."),
    })).describe("A list of generated course ideas."),
});
export type GenerateCourseIdeasOutput = z.infer<typeof GenerateCourseIdeasOutputSchema>;


export async function generateCourseIdeas(input: GenerateCourseIdeasInput): Promise<GenerateCourseIdeasOutput> {
  return generateCourseIdeasFlow(input);
}

const generateIdeasPrompt = ai.definePrompt({
  name: 'generateCourseIdeasPrompt',
  input: {schema: GenerateCourseIdeasInputSchema},
  output: {schema: GenerateCourseIdeasOutputSchema},
  prompt: `You are an expert curriculum designer for an online learning platform.
Based on the provided topic and target audience, generate a list of 3 distinct and engaging course ideas.

Topic: {{{topic}}}
Target Audience: {{{targetAudience}}}

For each idea, provide:
1. A compelling title.
2. A brief, one-paragraph description.
3. A list of 3-5 potential module titles.

Return the result in the format specified by the output schema.
`,
});

const generateCourseIdeasFlow = ai.defineFlow(
  {
    name: 'generateCourseIdeasFlow',
    inputSchema: GenerateCourseIdeasInputSchema,
    outputSchema: GenerateCourseIdeasOutputSchema,
  },
  async input => {
    const {output} = await generateIdeasPrompt(input);
    return output!;
  }
);
