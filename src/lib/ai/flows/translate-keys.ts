'use server';

import { askGroqJson } from '@/lib/ai/groq';

export interface TranslateInput {
  keys: Record<string, string>;
}

export interface TranslationValues {
  ht: string;
  fr: string;
  es: string;
}

export interface TranslateOutput {
  translations: Record<string, TranslationValues>;
}

const SYSTEM_PROMPT = `You are an expert translator specializing in English, Haitian Creole, French, and Spanish. Translate each English string into the other three languages while maintaining the original meaning and tone. Do not translate names, technical terms, or platform-specific identifiers like "HP".`;

export async function translateKeys(input: TranslateInput): Promise<TranslateOutput> {
  const prompt = `Translate the following English text into Haitian Creole (ht), French (fr), and Spanish (es).

Keys to translate:
${JSON.stringify(input.keys, null, 2)}

Return a JSON object with a "translations" field. Each key should map to an object with "ht", "fr", and "es" fields containing the translations.`;

  return askGroqJson<TranslateOutput>(SYSTEM_PROMPT, prompt);
}
