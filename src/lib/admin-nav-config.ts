import {
  BookOpen,
  BarChart2,
  Tv,
  FileText,
  Music,
  ImageIcon,
  Award,
  BookCopy,
  Folder,
  Building,
  Code,
  Shield,
  UserRound,
  UserCheck,
  Megaphone,
  FileQuestion,
  Languages,
  Church,
  UserPlus,
  Group,
  BookCheck,
  Users2,
  AlertTriangle,
  Play,
  List,
  Mail,
  Send,
  Palette,
  Package,
  RefreshCw,
  Settings,
  Link2,
  Globe,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavSubItem {
  href: string;
  label: string;
  i18nKey: string;
  icon: LucideIcon;
  permission?: string;
}

export interface NavGroupItem {
  href?: string;
  label: string;
  i18nKey: string;
  icon: LucideIcon;
  permission?: string;
  subItems?: NavSubItem[];
}

export interface NavGroup {
  group: string;
  i18nKey: string;
  permission?: string;
  items: NavGroupItem[];
}

export const navLinks: NavGroup[] = [
  {
    group: "Main",
    i18nKey: "admin.nav.group.main",
    items: [
      { href: "/admin/analytics", label: "Analytics", i18nKey: "admin.nav.analytics", icon: BarChart2, permission: "viewAnalytics" },
      {
        label: "Users",
        i18nKey: "admin.nav.users.group",
        icon: Shield,
        permission: "viewUserManagement",
        subItems: [
          { href: "/admin/users", label: "User Management", i18nKey: "admin.nav.users.management", icon: Users2, permission: "manageUsers" },
          { href: "/admin/users/completions", label: "Onsite Completions", i18nKey: "admin.nav.users.onsite_completions", icon: BookCheck, permission: "manageCompletions" },
          { href: "/admin/users/course-credit", label: "Course Credit", i18nKey: "admin.nav.users.course_credit", icon: Award, permission: "manageCourseCredit" },
          { href: "/admin/ladders", label: "Ladders", i18nKey: "admin.nav.users.ladders", icon: Shield, permission: "manageUsers" },
          { href: "/admin/speakers", label: "Speakers", i18nKey: "admin.nav.users.speakers", icon: UserRound, permission: "manageContent" },
          { href: "/admin/promotions", label: "Promotion Requests", i18nKey: "admin.nav.users.promotions", icon: UserCheck, permission: "managePromotions" },
          { href: "/admin/users/hp-requests", label: "HP Requests", i18nKey: "admin.nav.users.hp_requests", icon: UserPlus, permission: "manageHpRequests" },
        ],
      },
    ],
  },
  {
    group: "Marketing",
    i18nKey: "admin.nav.group.marketing",
    items: [
      { href: "/admin/content/announcements", label: "Announcements", i18nKey: "admin.nav.marketing.announcements", icon: Megaphone, permission: "manageContent" },
      { href: "/admin/content/emails", label: "Email Templates", i18nKey: "admin.nav.marketing.emails", icon: Mail, permission: "manageContent" },
      { href: "/admin/content/email-sender", label: "Email Sender", i18nKey: "admin.nav.marketing.email_sender", icon: Send, permission: "manageContent" },
      { href: "/admin/marketing/email-layout", label: "Email Layout", i18nKey: "admin.nav.marketing.email_layout", icon: Palette, permission: "manageContent" },
    ],
  },
  {
    group: "Content",
    i18nKey: "admin.nav.group.content",
    items: [
      {
        label: "Courses",
        i18nKey: "admin.nav.content.courses",
        icon: BookOpen,
        permission: "viewCourseManagement",
        subItems: [
          { href: "/admin/courses", label: "Course Manager", i18nKey: "admin.nav.content.courses.manager", icon: Settings },
          { href: "/admin/courses/enrollments", label: "Enrollments", i18nKey: "admin.nav.content.courses.enrollments", icon: Users2 },
          { href: "/admin/courses/enrollment-issues", label: "Enrollment Issues", i18nKey: "admin.nav.content.courses.issues", icon: AlertTriangle },
        ],
      },
      { href: "/admin/content/groups", label: "Learning Paths", i18nKey: "admin.nav.content.paths", icon: Group, permission: "manageContent" },
      { href: "/admin/forms", label: "Forms", i18nKey: "admin.nav.content.forms", icon: FileQuestion, permission: "viewForms" },
      {
        label: "Libraries",
        i18nKey: "admin.nav.content.libraries",
        icon: Folder,
        permission: "viewContentLibraries",
        subItems: [
          { href: "/admin/content/videos", label: "Videos", i18nKey: "admin.nav.content.videos", icon: Tv },
          { href: "/admin/content/documents", label: "Documents", i18nKey: "admin.nav.content.documents", icon: FileText },
          { href: "/admin/content/quizzes", label: "Quizzes", i18nKey: "admin.nav.content.quizzes", icon: FileQuestion },
          { href: "/admin/content/images", label: "Images", i18nKey: "admin.nav.content.images", icon: ImageIcon },
          { href: "/admin/content/music", label: "Music", i18nKey: "admin.nav.content.music", icon: Music },
          { href: "/admin/content/logos", label: "Logos", i18nKey: "admin.nav.content.logos", icon: Award },
          { href: "/admin/content/certificates", label: "Certificates", i18nKey: "admin.nav.content.certificates", icon: Award },
          { href: "/admin/content/documentation", label: "Documentation", i18nKey: "admin.nav.content.documentation", icon: BookCopy },
          { href: "/admin/content/languages", label: "Languages", i18nKey: "admin.nav.content.languages", icon: Languages },
          { href: "/admin/content/ministries", label: "Ministries", i18nKey: "admin.nav.content.ministries", icon: Church },
        ],
      },
    ],
  },
  {
    group: "Church Management",
    i18nKey: "admin.nav.group.church_management",
    items: [
      { href: "/admin/inventory", label: "Inventory", i18nKey: "admin.nav.inventory", icon: Package, permission: "viewInventory" },
    ],
  },
  {
    group: "Reports",
    i18nKey: "admin.nav.group.reports",
    permission: "viewReports",
    items: [
      { href: "/admin/reports/courses", label: "Course Reports", i18nKey: "admin.nav.reports.courses", icon: BarChart2 },
      { href: "/admin/reports/quizzes", label: "Quiz Reports", i18nKey: "admin.nav.reports.quizzes", icon: BarChart2 },
      { href: "/admin/reports/user-completion", label: "User Completion", i18nKey: "admin.nav.reports.user_completion", icon: BarChart2 },
    ],
  },
  {
    group: "Platform",
    i18nKey: "admin.nav.group.platform",
    items: [
      { href: "/admin/campus", label: "Campus", i18nKey: "admin.nav.platform.campus", icon: Building, permission: "viewCampusManagement" },
      { href: "/admin/custom-fields", label: "Custom Fields", i18nKey: "admin.nav.platform.custom_fields", icon: List, permission: "manageForms" },
      { href: "/admin/courses/teaching", label: "Teaching", i18nKey: "admin.nav.platform.teaching", icon: Play },
      { href: "/admin/live", label: "Live", i18nKey: "admin.nav.platform.live", icon: Tv, permission: "viewLiveManagement" },
      { href: "/my-certificates", label: "My Certificates", i18nKey: "admin.nav.platform.my_certificates", icon: Award, permission: "viewDashboard" },
      { href: "/admin/maintenance", label: "Maintenance Mode", i18nKey: "admin.nav.platform.maintenance", icon: AlertTriangle, permission: "manageMaintenance" },
      { href: "/admin/platform/automation", label: "Automation Manager", i18nKey: "admin.nav.platform.automation", icon: RefreshCw, permission: "manageAutomation" },
      {
        label: "Developer",
        i18nKey: "nav.admin_panel",
        icon: Code,
        permission: "developer",
        subItems: [
          { href: "/admin/developer/site-settings", label: "Site Settings", i18nKey: "admin.nav.platform.dev.site_settings", icon: Settings },
          { href: "/admin/developer/certificate-builder", label: "Certificate Builder", i18nKey: "admin.nav.platform.dev.cert_builder", icon: Award },
          { href: "/admin/links", label: "Links", i18nKey: "admin.nav.platform.dev.links", icon: Link2 },
          { href: "/admin/developer/code-manager", label: "Code Manager", i18nKey: "admin.nav.platform.dev.code_manager", icon: Code },
          { href: "/admin/developer/localization", label: "Localization", i18nKey: "admin.nav.platform.dev.localization", icon: Globe },
        ],
      },
    ],
  },
];
