'use server';

import { askGroqJson } from '@/lib/ai/groq';

export interface GlobalSearchInput {
  query: string;
  courses: {
    id: string;
    title: string;
    description: string;
    Category: string[];
    tags: string[];
  }[];
  videos: {
    id: string;
    title: string;
    courseId: string;
    courseTitle: string;
  }[];
  documentation: {
    id: string;
    title: string;
    content: string;
  }[];
  users: {
    id: string;
    displayName?: string | null;
    email?: string | null;
    role?: string | null;
    campus?: string | null;
  }[];
}

export interface GlobalSearchOutput {
  results: {
    id: string;
    title: string;
    url: string;
    type: 'course' | 'video' | 'document' | 'user';
  }[];
}

const SYSTEM_PROMPT = `You are a powerful search agent for an educational platform. Find the most relevant content based on the user's query from the provided data. Return results with proper URLs.`;

export async function globalSearch(input: GlobalSearchInput): Promise<GlobalSearchOutput> {
  const context = `
Available Courses:
${input.courses.map(c => `- ID: ${c.id}, Title: ${c.title}, Categories: ${c.Category.join(', ')}, Tags: ${c.tags.join(', ')}`).join('\n')}

Available Videos:
${input.videos.map(v => `- ID: ${v.id}, Title: ${v.title}, Course: ${v.courseTitle} (${v.courseId})`).join('\n')}

Available Documentation:
${input.documentation.map(d => `- ID: ${d.id}, Title: ${d.title}`).join('\n')}

Available Users:
${input.users.map(u => `- ID: ${u.id}, Name: ${u.displayName || 'N/A'}, Email: ${u.email || 'N/A'}, Role: ${u.role || 'N/A'}, Campus: ${u.campus || 'N/A'}`).join('\n')}
`;

  const prompt = `Search Query: ${input.query}

${context}

Return a JSON object with a "results" field containing an array of the top 5 most relevant results. Each result should have:
- id: the item ID
- title: the item title
- url: formatted as /courses/{id} for courses, /courses/{courseId}/video/{id} for videos, /admin/users?userId={id} for users
- type: one of "course", "video", "document", or "user"`;

  return askGroqJson<GlobalSearchOutput>(SYSTEM_PROMPT, prompt);
}
