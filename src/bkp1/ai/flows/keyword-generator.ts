
'use server';

/**
 * @fileOverview AI-powered SEO keyword generation flow.
 *
 * - generateKeywords - A function that suggests SEO keywords based on a topic or description.
 * - GenerateKeywordsInput - The input type for the generateKeywords function.
 * - GenerateKeywordsOutput - The return type for the generateKeywords function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateKeywordsInputSchema = z.object({
  topic: z.string().describe('The main topic or description to generate keywords for.'),
});
export type GenerateKeywordsInput = z.infer<typeof GenerateKeywordsInputSchema>;


const GenerateKeywordsOutputSchema = z.object({
  keywords: z.array(z.string()).describe('An array of generated SEO keywords.'),
});
export type GenerateKeywordsOutput = z.infer<typeof GenerateKeywordsOutputSchema>;

export async function generateKeywords(input: GenerateKeywordsInput): Promise<GenerateKeywordsOutput> {
  return generateKeywordsFlow(input);
}

const generateKeywordsPrompt = ai.definePrompt({
  name: 'generateKeywordsPrompt',
  input: {schema: GenerateKeywordsInputSchema},
  output: {schema: GenerateKeywordsOutputSchema},
  prompt: `You are an SEO expert. Based on the following topic or description, generate a list of 10-15 relevant and high-traffic SEO keywords.

Topic: {{{topic}}}

Return the keywords in the format specified by the output schema.`,
});

const generateKeywordsFlow = ai.defineFlow(
  {
    name: 'generateKeywordsFlow',
    inputSchema: GenerateKeywordsInputSchema,
    outputSchema: GenerateKeywordsOutputSchema,
  },
  async input => {
    const {output} = await generateKeywordsPrompt(input);
    return output!;
  }
);
