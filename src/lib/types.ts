

export interface User {
  id: string;
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  role?: 'admin' | 'user' | 'developer' | 'moderator';
  fullName?: string;
  firstName?: string;
  lastName?: string;
  campusId?: string;
  campusName?: string;
  maritalStatus?: string;
  ministry?: string;
  charge?: string;
  membershipStatus?: string;
  classLadder?: string;
  classLadderId?: string;
  bio?: string;
  postCount?: number;
  commentCount?: number;
  hpNumber?: string;
  phoneNumber?: string;
  facilitatorName?: string;
  language?: string;
  isInHpGroup?: boolean;
  hpAvailabilityDay?: string;
  hpAvailabilityTime?: string;
  gender?: string;
  ageRange?: string;
  locationPreference?: 'Onsite' | 'Online';
  campus?: string;
}

export interface Speaker {
  id: string;
  name: string;
  photoURL: string;
  createdAt: any;
}

export interface QuizQuestion {
  id: string;
  questionText: string;
  options: string[];
  type: 'multiple-choice' | 'multiple-select' | 'free-text';
  correctAnswerIndex?: number;
  correctAnswerIndexes?: number[];
  minCharLength?: number;
}


export interface Quiz {
    id: string;
    title: string;
    questions: QuizQuestion[];
    createdAt: any;
    passThreshold?: number;
    shuffleQuestions?: boolean;
    timeLimitEnabled?: boolean;
    timeLimitPerQuestion?: number; // in minutes
}

export interface Course {
  id: string;
  title: string;
  description: string;
  "Image ID": string;
  videos: string[];
  "Resource Doc": string[];
  Category: string[];
  tags: string[];
  ladders: string[];
  ladderIds: string[];
  creatorId: string;
  speakerId?: string;
  enrollmentCount?: number;
  status: 'published' | 'draft';
  certificateTemplateUrl?: string;
  logoUrl?: string;
  attendanceLinks?: { title: string; url: string }[];
  quizIds?: string[];
  createdAt?: any;
  updatedAt?: any;
  completedAt?: any;
  order?: number;
  prerequisiteCourse?: {
    id: string;
    title: string;
  };
  language?: string;
  certificateEnabled?: boolean;
  badgeEnabled?: boolean;
}

export interface CourseGroup {
  id: string;
  title: string;
  description: string;
  courseIds: string[];
  certificateTemplateUrl?: string;
  status: 'published' | 'draft';
  createdAt: any;
}

export interface UserBadge {
  id: string;
  userId: string;
  courseId: string;
  badgeTitle: string;
  badgeIconUrl: string;
  earnedAt: any;
}

export interface OnsiteCompletion {
    id: string;
    userId: string;
    userName: string;
    userCampus: string;
    courseId: string;
    courseName: string;
    completedAt: any;
    markedBy: string;
}


export interface Video {
  id: string;
  title: string;
  duration: number;
  url: string;
  Thumbnail: string;
  path: string;
  thumbnailPath: string;
  createdAt: any;
  likeCount?: number;
  shareCount?: number;
  commentCount?: number;
  status?: 'published' | 'private';
  hlsUrl?: string;
  type?: 'video' | 'quiz' | 'youtube' | 'googledrive';
  questions?: QuizQuestion[];
  enableStillWatchingPrompt?: boolean;
}

export interface UserQuizResult {
  userId: string;
  courseId: string;
  quizId: string;
  answers: any; // Changed from number[] to any to support multiple answer types
  score: number;
  passed: boolean;
  attemptedAt: any;
}

export interface Enrollment {
  userId: string;
  courseId: string;
  enrolledAt: any;
  completedAt?: any;
}

export interface UserProgress {
    userId: string;
    courseId: string;
    videoProgress: VideoProgress[];
    totalProgress: number;
    lastWatchedVideoId?: string;
}

export interface VideoProgress {
    videoId: string;
    timeSpent: number;
    completed: boolean;
}

export interface Post {
    id: string;
    authorId: string;
    authorName: string;
    authorPhotoURL?: string | null;
    content: string;
    createdAt: any;
    likes: string[];
    likeCount: number;
    repostOf?: string;
    originalAuthorName?: string;
    originalContent?: string;
    isPinned?: boolean;
    repostCount?: number;
    shareCount?: number;
}


export interface Comment {
  id: string;
  userId: string;
  userName: string | null;
  userAvatar: string | null;
  text: string;
  createdAt: any;
  reactions: { [emoji: string]: string[] };
  parentId?: string;
  parentAuthor?: string;
  parentText?: string;
  isPinned?: boolean;
}

export interface NavLink {
  id: string;
  title: string;
  url: string;
  order: number;
}

export interface LiveEvent {
  id: string;
  title: string;
  description: string;
  startTime: string;
  status: 'upcoming' | 'live' | 'ended';
  imageUrl?: string;
  gloryLiveRoomId?: string;
  gloryLiveRoomPassword?: string;
  eventType?: 'one-time' | 'recurring';
  vdoNinjaRoomId?: string;
}

export interface Permission {
  id: string;
  name: string;
  description: string;
}

export interface RolePermission {
  role: string;
  permissions: string[];
}


export interface Subscription {
  subscriberId: string;
  creatorId: string;
  subscribedAt: any;
}

export interface Ladder {
  id: string;
  name: string;
  order: number;
  side: 'ministry' | 'hp' | 'none';
  category: 'membership' | 'leadership';
  icon?: string;
}

export interface UserLadderProgress {
    ladderId: string;
    ladderName: string;
    ladderSide: string;
    progress: number;
    totalCourses: number;
    completedCourses: number;
}

export interface PromotionRequest {
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    currentLadderId: string;
    currentLadderName: string;
    requestedLadderId: string;
    requestedLadderName: string;
    status: 'pending' | 'approved' | 'rejected';
    requestedAt: any;
    resolvedAt?: any;
    resolverId?: string;
}

export interface SiteSettings {
    websiteName: string;
    metaDescription: string;
    seoKeywords: string;
    homepageTitle: string;
    homepageSubtitle: string;
    enrollButtonText: string;
    enrollButtonLink: string;
    exploreButtonText: string;
    exploreButtonLink: string;
    faviconUrl: string;
    homepageBackgroundImageUrl: string;
    featuresTitle: string;
    featuresSubtitle: string;
    feature1Icon: string;
    feature1Title: string;
    feature1Description: string;
    feature2Icon: string;
    feature2Title: string;
    feature2Description: string;
    feature3Icon: string;
    feature3Title: string;
    feature3Description: string;
    // Certificate settings
    cert_title: string;
    cert_title_size?: number;
    cert_subtitle: string;
    cert_subtitle_size?: number;
    cert_decoration_icon: string;
    cert_decoration_icon_size?: number;
    cert_showLineUnderUserName: boolean;
    cert_presentedToText: string;
    cert_presentedToText_size?: number;
    cert_completionText: string;
    cert_completionText_size?: number;
    cert_userName_size?: number;
    cert_courseName_size?: number;
    cert_date_size?: number;
    cert_signatureName: string;
    cert_signatureName_size?: number;
    cert_signatureTitle: string;
    cert_signatureTitle_size?: number;
    cert_defaultLogoUrl?: string;
    cert_defaultBackgroundUrl?: string;
    cert_spacing_title_subtitle?: number;
    cert_spacing_subtitle_decoration?: number;
    cert_spacing_decoration_presentedTo?: number;
    cert_spacing_presentedTo_userName?: number;
    cert_spacing_userName_completionText?: number;
    cert_spacing_completionText_courseName?: number;
    cert_spacing_courseName_signatures?: number;
    quiz_pass_threshold?: number;
}

    