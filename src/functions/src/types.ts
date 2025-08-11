
// A copy of the types from the main app, to be used in functions.
// In a monorepo setup, these could be shared.

export interface Course {
  id: string;
  title: string;
  videos: string[];
  ladderIds: string[];
}

export interface Ladder {
  id: string;
  name: string;
  order: number;
}

export interface UserProgress {
    userId: string;
    courseId: string;
    videoProgress: {
        videoId: string;
        completed: boolean;
    }[];
}
