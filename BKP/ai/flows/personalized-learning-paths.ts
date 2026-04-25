'use server';

/**
 * @fileOverview Personalized learning path suggestion AI agent.
 *
 * - suggestPersonalizedLearningPaths - A function that suggests personalized learning paths based on user data.
 * - PersonalizedLearningPathsInput - The input type for the suggestPersonalizedLearningPaths function.
 * - PersonalizedLearningPathsOutput - The return type for the suggestPersonalizedLearningPaths function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PersonalizedLearningPathsInputSchema = z.object({
  watchHistory: z.array(z.string()).describe('List of video IDs the user has watched.'),
  completedCourses: z.array(z.string()).describe('List of course IDs the user has completed.'),
  engagementLevel: z
    .number()
    .describe(
      'A number representing the users engagement level, higher numbers mean higher engagement.'
    ),
  classLadder: z.string().optional().describe("The user's assigned class ladder/level."),
  allCourses: z
    .array(z.object({
      courseId: z.string().describe('The ID of the course'),
      title: z.string().describe('The title of the course'),
      description: z.string().describe('A short description of the course'),
      category: z.string().describe('The category of the course'),
      tags: z.array(z.string()).describe('Tags associated with the course'),
    }))
    .describe('A list of all available courses with their details.'),
});
export type PersonalizedLearningPathsInput = z.infer<typeof PersonalizedLearningPathsInputSchema>;

const PersonalizedLearningPathsOutputSchema = z.object({
  suggestedPaths: z.array(z.string()).describe('List of suggested learning path IDs.'),
  relevantCourses: z
    .array(
      z.object({
        courseId: z.string().describe('The ID of the recommended course.'),
        reason: z
          .string()
          .describe('Explanation of why the course is relevant to the user.'),
      })
    )
    .describe('List of relevant courses with reasons for recommendation.'),
});
export type PersonalizedLearningPathsOutput = z.infer<typeof PersonalizedLearningPathsOutputSchema>;

export async function suggestPersonalizedLearningPaths(
  input: PersonalizedLearningPathsInput
): Promise<PersonalizedLearningPathsOutput> {
  return suggestPersonalizedLearningPathsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'personalizedLearningPathsPrompt',
  input: {schema: PersonalizedLearningPathsInputSchema},
  output: {schema: PersonalizedLearningPathsOutputSchema},
  prompt: `You are an AI assistant designed to suggest personalized learning paths and relevant courses to users based on their learning history and preferences.

  Analyze the user's watch history, completed courses, and engagement level to understand their interests and goals. Pay close attention to the user's class ladder, as this indicates their current learning level. You should only recommend courses that match this ladder.

  Use the following information about the user:
  Watch History: {{watchHistory}}
  Completed Courses: {{completedCourses}}
  Engagement Level: {{engagementLevel}}
  Class Ladder: {{classLadder}}

  All Courses:{{#each allCourses}}\nCourse ID: {{this.courseId}}, Title: {{this.title}}, Description: {{this.description}}, Category: {{this.category}}, Tags: {{this.tags}}{{/each}}

  Based on this analysis, suggest personalized learning paths (just give their IDs), and also suggest relevant courses with a brief explanation of why each course is relevant to the user, and return in the format specified by the output schema. Be concise.`, // Ensure Handlebars syntax is correctly used
});

const suggestPersonalizedLearningPathsFlow = ai.defineFlow(
  {
    name: 'suggestPersonalizedLearningPathsFlow',
    inputSchema: PersonalizedLearningPathsInputSchema,
    outputSchema: PersonalizedLearningPathsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
