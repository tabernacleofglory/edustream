
import { z } from 'genkit';

export const GlobalSearchInputSchema = z.object({
  query: z.string().describe("The user's search query."),
  courses: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        description: z.string(),
        Category: z.array(z.string()),
        tags: z.array(z.string()),
      })
    )
    .describe('List of all available courses.'),
  videos: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        courseId: z.string(),
        courseTitle: z.string(),
      })
    )
    .describe('List of all available videos with their course context.'),
  documentation: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        content: z.string(),
      })
    )
    .describe('List of all documentation articles.'),
  users: z
    .array(
      z.object({
        id: z.string(),
        displayName: z.string().optional().nullable(),
        email: z.string().optional().nullable(),
        role: z.string().optional().nullable(),
        campus: z.string().optional().nullable(),
      })
    )
    .describe('List of all users.'),
});
export type GlobalSearchInput = z.infer<typeof GlobalSearchInputSchema>;

export const GlobalSearchOutputSchema = z.object({
  results: z
    .array(
      z.object({
        id: z.string().describe('The ID of the found item.'),
        title: z.string().describe('The title of the found item.'),
        url: z.string().describe('The URL to the found item.'),
        type: z
          .enum(['course', 'video', 'document', 'user'])
          .describe('The type of content found.'),
      })
    )
    .describe('A list of search results.'),
});
export type GlobalSearchOutput = z.infer<typeof GlobalSearchOutputSchema>;
