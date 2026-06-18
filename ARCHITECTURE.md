# Glory Training Hub — Architecture (Current)

> Last updated: 2026-06-18

---

## 1. Overview

- **Platform**: Glory Training Hub — Christian education & leadership training platform
- **Framework**: Next.js 15 (React 18)
- **Styling**: Tailwind CSS with Radix UI primitives
- **Database**: Firebase Firestore (primary datastore)
- **Auth**: Firebase Authentication (client-side only)
- **Storage**: Firebase Storage (images, thumbnails)
- **Video**: Google Cloud Video Transcoder API (HLS)
- **AI**: Genkit + Google Gemini 2.0 Flash
- **Live Streaming**: Vdo.Ninja (iframe embed)
- **Hosting**: Firebase App Hosting + Firebase Cloud Functions
- **Language**: TypeScript

---

## 2. Directory Structure

```
src/
├── ai/                          # Genkit AI flows (Gemini)
│   ├── flows/
│   │   ├── course-ideas.ts
│   │   ├── global-search.ts
│   │   ├── keyword-generator.ts
│   │   ├── personalized-learning-paths.ts
│   │   ├── smart-tagging.ts
│   │   └── translate-keys.ts
│   ├── schemas/
│   │   └── global-search-schemas.ts
│   └── genkit.ts               # Genkit config (googleAI plugin)
│
├── app/                         # Next.js App Router
│   ├── admin/                   # Admin panel (30+ pages)
│   │   ├── (fullscreen)/
│   │   │   └── glory-live/[roomId]/  # Vdo.Ninja director iframe
│   │   ├── analytics/
│   │   ├── campus/
│   │   ├── content/
│   │   ├── courses/
│   │   ├── developer/
│   │   ├── forms/
│   │   ├── live/               # Live events management
│   │   ├── marketing/
│   │   ├── reports/
│   │   ├── users/
│   │   └── layout.tsx           # 415-line admin layout (inline nav)
│   ├── api/
│   │   ├── auth/               # Auth API routes
│   │   └── live-events/        # Live event API routes
│   ├── community/              # Discussion forums
│   ├── courses/                # Course pages + video player
│   ├── dashboard/              # User dashboard
│   ├── live/                   # Live event viewer
│   │   └── [roomId]/           # Vdo.Ninja viewer iframe
│   ├── layout.tsx              # Root layout (5 Google Fonts)
│   ├── page.tsx                # Homepage (hero + features)
│   └── providers.tsx           # Client providers wrapper
│
├── components/                  # React components
│   ├── ui/                     # Radix UI primitives (35+ components)
│   ├── ai-assistant.tsx        # Empty shell (placeholder)
│   ├── ai-chat-widget.tsx      # DOES NOT EXIST YET
│   ├── video-player.tsx        # 933-line monolith
│   ├── live-events-list.tsx    # Live events CRUD list
│   ├── header.tsx              # App header (duplicated nav fetch)
│   └── ...
│
├── hooks/                      # Custom React hooks
│   ├── use-auth.tsx            # Auth context + provider (352 lines)
│   ├── use-i18n.tsx            # i18n with caching
│   ├── useProcessedCourses.tsx # Course processing
│   └── ...
│
├── lib/                        # Utilities & services
│   ├── firebase.ts             # Firebase client init
│   ├── data.ts                 # getSiteSettings() server function
│   ├── live-events.ts          # Live event CRUD (fire-and-forget)
│   ├── types.ts                # 472-line type definitions
│   ├── email-utils.ts          # Email template builder
│   └── ...
│
└── functions/src/              # Firebase Cloud Functions
    ├── index.ts                # Auth triggers, email, utils
    └── transcoding.ts          # Google Cloud Video Transcoder
```

---

## 3. Data Flow Architecture

```
┌──────────┐     ┌───────────┐     ┌──────────────┐
│  Browser  │────▶│  Next.js  │────▶│  Firebase     │
│ (Client)  │     │  Server   │     │  Firestore    │
└──────────┘     └───────────┘     └──────────────┘
     │                                  │
     │── real-time listeners (onSnapshot)
     │── getDocs queries (no cache)
     └── sessionStorage (languages, permissions only)
```

### Current caching strategy:
- **SessionStorage**: valid languages, role permissions (TTL-based)
- **No cache**: site settings, nav links, course data, live events
- **No external cache lib**: no SWR, React Query, or TanStack Query
- **Firestore reads**: every page load triggers fresh reads

### Firestore collections used:
| Collection | Purpose | Read pattern |
|------------|---------|-------------|
| `siteSettings` | Site config | `getDoc` on every homepage visit |
| `navLinks` | Navigation links | `getDocs` on homepage + header mount |
| `users` | User profiles | `onSnapshot` real-time |
| `courses` | Course data | `getDocs` on courses page |
| `liveEvents` | Live events | `onSnapshot` real-time |
| `contents` | Videos | `getDocs` per course |
| `quizzes` | Quizzes | `getDocs` per course |
| `forms` | Custom forms | `getDocs` per course |
| `userVideoProgress` | Watch tracking | `getDocs` per user dashboard |
| `userQuizResults` | Quiz results | `getDocs` per user dashboard |
| `userContentProgress` | Global completions | `getDoc` per user dashboard |
| `announcements` | Announcements | `onSnapshot` real-time |
| `rolePermissions` | Permissions | `getDoc` per role (cached) |
| `languages` | Available languages | `getDocs` on auth init (cached) |
| `courseLevels` | Ladder system | `getDocs` on init |
| `communityPosts` | Community posts | `getDocs` paginated |

---

## 4. Authentication Flow

```
Firebase Auth (onAuthStateChanged)
    │
    ▼
AuthProvider (use-auth.tsx)
    │
    ├── fetchUserDocument() → onSnapshot(users/{uid})
    │       └── Real-time user doc listener
    ├── fetchValidLanguages() → getDocs(languages)
    │       └── Cached in sessionStorage
    ├── fetchPermissions() → getDoc(rolePermissions/{role})
    │       └── Cached in sessionStorage
    │
    ├── Navigation guard (profile completion check)
    ├── Impersonation system (sessionStorage UID)
    └── Right-click prevention (global event listener)
```

**Current limitations:**
- Client-side only auth (no HTTP-only session cookies)
- No middleware auth guard (all pages public by default)
- Navigation guard uses `useEffect` + `router.push` (causes flash)

---

## 5. AI Architecture (Current)

```
Genkit (genkit.ts)
    │
    └── googleAI plugin (Gemini 2.0 Flash)
            │
            ├── generateKeywords()   → Site settings
            ├── suggestCourseTags()  → Smart tagger UI
            ├── generateCourseIdeas()→ Idea generator UI
            ├── suggestPersonalizedLearningPaths() → NEVER CALLED
            ├── translateKeys()      → Localization page
            └── globalSearch()       → Global search
```

- **Provider**: Google Gemini 2.0 Flash via `@genkit-ai/googleai`
- **API Key**: `GEMINI_API_KEY` in `.env.local`
- **Dependencies**: `@genkit-ai/googleai`, `@genkit-ai/firebase`, `@genkit-ai/next`, `genkit-cli`
- **AI Chat**: `ai-assistant.tsx` is an empty component (not implemented)
- **Unused flows**: `personalized-learning-paths.ts` exists but never wired into UI

---

## 6. Live Streaming Architecture (Current)

```
Admin flow:
  Create event → Go Live → Vdo.Ninja iframe (director mode)
                                         │
                                         ▼
                                  /admin/glory-live/[roomId]
                                  (bare iframe, no branding)

User flow:
  View event → Watch/Join → Vdo.Ninja iframe (viewer mode)
                                         │
                                         ▼
                                  /live/[roomId]
                                  (bare iframe, no branding)
```

- **Engine**: Vdo.Ninja (peer-to-peer WebRTC via iframe embed)
- **Room management**: Firestore doc updates (`gloryLiveRoomId`, `gloryLiveRoomPassword`)
- **Recording**: None
- **Branding**: None (raw Vdo.Ninja UI)
- **Multi-participant**: Vdo.Ninja handles it, but no custom UI controls

---

## 7. Admin Panel

- **Structure**: Single `admin/layout.tsx` with inline sidebar nav (415 lines)
- **Sidebar**: Collapsible sub-items, icon + label, permission-gated
- **Pages**: 30+ pages across Content, Marketing, Users, Reports, Platform
- **Permissions**: Role-based via Firestore `rolePermissions` collection
- **UI library**: Radix UI (Collapsible, DropdownMenu, ScrollArea, etc.)
- **No admin framework**: Fully custom implementation

---

## 8. Frontend Dependencies (Key)

| Package | Purpose |
|---------|---------|
| next 15 | Framework |
| react 18 | UI |
| tailwindcss + tailwindcss-animate | Styling |
| @radix-ui/* | Headless UI primitives (35+ components) |
| framer-motion | Animations |
| firebase | SDK |
| lucide-react | Icons |
| hls.js | HLS video playback |
| react-player | Video player (YouTube/Drive) |
| papaparse | CSV export |
| jspdf + jspdf-autotable | PDF export |
| html2canvas | Certificate capture |
| recharts | Analytics charts |
| embla-carousel-react | Carousels |
| next-themes | Dark/light mode |
| use-debounce | Debounced inputs |
| @hookform/resolvers + react-hook-form + zod | Forms |

---

## 9. Performance Concerns

| Issue | Location | Impact |
|-------|----------|--------|
| No Firestore caching | Every page | High cost |
| Duplicate nav link fetch | page.tsx + header.tsx | Extra reads |
| 933-line video-player.tsx | Main video component | Maintainability |
| 5 Google Fonts | layout.tsx | Load time |
| Inline admin nav (415 lines) | admin/layout.tsx | Maintainability |
| RequiredStepsCard (4 queries) | user-dashboard-client.tsx | Cost per visit |
| Empty ai-assistant.tsx | components/ | Dead code |
| fire-and-forget Firestore writes | live-events.ts | Risk of data loss |
| Unused Mux SDK | lib/mux.ts | Dead code |
| Images unoptimized | next.config.js | Performance |
