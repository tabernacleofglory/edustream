
'use server';
/**
 * @fileOverview An AI-powered flow to translate a batch of text from English to multiple languages.
 *
 * - translateKeys - A function that takes a map of keys to English text and returns translations.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const TranslateInputSchema = z.object({
  keys: z.record(z.string()).describe('An object where keys are translation keys and values are the English text to be translated.'),
});

const TranslationValuesSchema = z.object({
  ht: z.string().describe("The Haitian Creole translation."),
  fr: z.string().describe("The French translation."),
  es: z.string().describe("The Spanish translation."),
});

const TranslateOutputSchema = z.object({
  translations: z.record(TranslationValuesSchema).describe("An object where keys are the original translation keys and values are objects containing the translations for 'ht', 'fr', and 'es'."),
});

export type TranslateInput = z.infer<typeof TranslateInputSchema>;
export type TranslateOutput = z.infer<typeof TranslateOutputSchema>;

export async function translateKeys(input: TranslateInput): Promise<TranslateOutput> {
  return translateKeysFlow(input);
}

const translateKeysPrompt = ai.definePrompt({
  name: 'translateKeysPrompt',
  input: { schema: TranslateInputSchema },
  output: { schema: TranslateOutputSchema },
  prompt: `You are an expert translator specializing in English, Haitian Creole, French, and Spanish.
You will be given a JSON object where the keys are translation identifiers and the values are English strings.
Your task is to translate each English string into the other three languages: Haitian Creole, French, and Spanish.

For each key, provide an object with 'ht', 'fr', and 'es' translations.

Maintain the original meaning and tone as closely as possible for a professional, educational platform.
If a value contains a name or a technical term (like a person's name or "HP"), do not translate it.
Return the result as a single JSON object that matches the specified output schema.

Here are the keys and their English text to translate:
{{{jsonStringify keys}}}
`,
});

const translateKeysFlow = ai.defineFlow(
  {
    name: 'translateKeysFlow',
    inputSchema: TranslateInputSchema,
    outputSchema: TranslateOutputSchema,
  },
  async (input) => {
    const { output } = await translateKeysPrompt(input);
    return output!;
  }
);
