
export interface User {
  id: string;
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  role?: 'admin' | 'user' | 'developer' | 'moderator' | 'team';
  fullName?: string;
  firstName?: string;
  lastName?: string;
  campusId?: string;
  campusName?: string;
  maritalStatus?: string;
  ministry?: string;
  charge?: string;
  membershipStatus?: string;
  graduationStatus?: string;
  graduationDate?: string;
  classLadder?: string;
  classLadderId?: string;
  side?: 'ministry' | 'hp' | 'none';
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
  isBaptized?: boolean;
  baptismDate?: string;
  denomination?: string;
  lastActiveAt?: any;
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
  ministryIds?: string[];
  creatorId: string;
  speakerId?: string;
  enrollmentCount?: number;
  status: 'published' | 'draft';
  certificateTemplateUrl?: string;
  logoUrl?: string;
  attendanceLinks?: { title: string; url: string }[];
  quizIds?: string[];
  formId?: string;
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
  contentItems?: {
    order: number;
    type: 'video' | 'quiz' | 'form';
    contentId: string;
  }[];
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
    creditedVideos?: string[];
    creditedQuizzes?: string[];
    creditedForm?: { formId: string, submissionId: string };
    source?: 'manual_credit' | 'onsite';
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
  uploaderId?: string;
}

export interface UserQuizResult {
  id: string;
  userId: string;
  courseId: string;
  quizId: string;
  answers: any; 
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
    percent?: number;
    updatedAt?: any;
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
    originalLinks?: { url: string, label: string }[];
    originalAttachments?: { url: string, type: 'image' | 'document', name: string }[];
    links?: { url: string, label: string }[];
    attachments?: { url: string, type: 'image' | 'document', name: string }[];
    isPinned?: boolean;
    repostCount?: number;
    shareCount?: number;
    parentId?: string;
    parentAuthorName?: string;
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
  platform: 'gloryLive' | 'external';
  externalLink?: string;
  gloryLiveRoomId?: string;
  gloryLiveRoomPassword?: string;
  vdoNinjaRoomId?: string;
  ladderIds?: string[];
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

export interface CustomForm {
    id: string;
    title: string;
    type: 'userProfile' | 'custom' | 'hybrid';
    public?: boolean;
    fields: FormFieldConfig[];
    submissionCount: number;
    createdAt: any;
    createdBy: string;
    autoSignup?: boolean;
    emailConfirmationEnabled?: boolean;
    emailTemplateId?: string;
}

export interface FormFieldConfig {
    fieldId: string; // Not just keyof User, can be custom
    label: string;
    visible: boolean;
    required: boolean;
    type?: 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'multiple-choice' | 'multiple-select' | 'password' | 'date' | 'address';
    options?: string[];
    dataSource?: 'manual' | 'campuses' | 'ladders' | 'ministries' | 'charges' | 'roles' | 'languages' | 'genders' | 'ageRanges' | 'locationPreferences' | 'hpAvailabilityDays' | 'maritalStatuses';
    dataSourceOptions?: {
        ladders?: string[];
        campuses?: string[];
    };
    userProfileField?: string;
    conditionalLogic?: {
        fieldId: string;
        operator: 'is' | 'isNot' | 'contains' | 'doesNotContain' | 'isNotEmpty';
        value?: string;
    };
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  createdAt: any;
  fromEmail?: string;
}

export interface EmailLayoutSettings {
    headerGradientStart: string;
    headerGradientEnd: string;
    headerLogoUrl: string;
    headerTitle: string;
    headerSlogan: string;
    footerText: string;
    buttonColor: string;
    buttonTextColor: string;
    bodyBgColor: string;
    cardBgColor: string;
    preHeaderText?: string;
    buttonText?: string;
    buttonUrl?: string;
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
    cert_show_title?: boolean;
    cert_subtitle: string;
    cert_subtitle_size?: number;
    cert_show_subtitle?: boolean;
    cert_decoration_icon: string;
    cert_decoration_icon_size?: number;
    cert_show_decoration?: boolean;
    cert_showLineUnderUserName: boolean;
    cert_presentedToText: string;
    cert_presentedToText_size?: number;
    cert_show_presentedToText?: boolean;
    cert_completionText: string;
    cert_completionText_size?: number;
    cert_show_completionText?: boolean;
    cert_userName_size?: number;
    cert_courseName_size?: number;
    cert_date_size?: number;
    cert_show_date?: boolean;
    cert_signatureName: string;
    cert_signatureName_size?: number;
    cert_signatureTitle: string;
    cert_signatureTitle_size?: number;
    cert_show_signatures?: boolean;
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
    emailLayout?: EmailLayoutSettings;
}
