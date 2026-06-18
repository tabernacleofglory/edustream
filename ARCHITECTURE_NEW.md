# GloryHub — Architecture (After Optimization)

> Last updated: 2026-06-18
> This document describes the target architecture after all planned optimizations and new features are implemented.

---

## 1. Key Changes Summary

| Area | Before | After |
|------|--------|-------|
| **AI Provider** | Google Gemini 2.0 Flash (Genkit) | Groq LLaMA 3.3 70B (direct API) |
| **AI Chat** | Empty component (not implemented) | Glory AI Bot chat widget |
| **Firestore Caching** | None (fresh reads every page load) | sessionStorage + hardcoded defaults |
| **Live Streaming** | Bare Vdo.Ninja iframes (no branding) | Custom React UI wrapping Vdo.Ninja JS API |
| **Live Recording** | None | Local MediaRecorder → Google Drive |
| **Admin Nav Config** | Inline in layout.tsx (415 lines) | Extracted to separate config file |
| **video-player.tsx** | 933-line monolith | Split into focused components |
| **Genkit** | Full Genkit dependency | Removed entirely |
| **Package.json** | 4 genkit packages | 0 genkit packages |
| **Nav Links** | Fetched independently in 2 places | Shared provider + cache |
| **Site Settings** | Firestore-only, no fallback | Hardcoded defaults + overlay |
| **Form State** | 17 individual useState hooks | Grouped useReducer |
| **Git Repo** | tabernacleofglory/edustream | jrihosting/GloryHub |

---

## 2. New Directory Structure

```
src/
├── lib/
│   ├── ai/                      # [NEW] AI service layer
│   │   ├── groq.ts              # Groq API wrapper
│   │   └── chat-config.ts       # System prompt + app context
│   ├── admin-nav-config.ts      # [NEW] Extracted from admin/layout.tsx
│   ├── glory/                   # [NEW] Glory Live custom components
│   │   └── recorder.ts          # Local recording → Google Drive
│   └── ...                      # (rest unchanged)
│
├── providers/
│   └── nav-links-provider.tsx   # [NEW] Shared nav links context
│
├── components/
│   ├── ai-chat-widget.tsx       # [NEW] Floating AI chat bot
│   ├── glory/                   # [NEW] Custom Glory Live components
│   │   ├── broadcaster.tsx      # Admin director console
│   │   ├── viewer.tsx           # User watch view
│   │   └── participant.tsx      # Join-with-camera flow
│   ├── video/                   # [NEW] Split from video-player.tsx
│   │   ├── video-player-core.tsx
│   │   ├── video-controls.tsx
│   │   ├── video-sidebar.tsx
│   │   └── video-progress-tracker.tsx
│   ├── live-events/
│   │   └── delete-event-dialog.tsx  # [NEW] Extracted component
│   ├── ui/                      # (unchanged)
│   └── ...
│
├── app/
│   ├── api/
│   │   ├── ai/
│   │   │   └── chat/route.ts    # [NEW] Groq-powered chat endpoint
│   │   ├── auth/                # (unchanged)
│   │   └── live-events/         # (unchanged)
│   ├── admin/
│   │   ├── (fullscreen)/
│   │   │   └── glory-live/[roomId]/  # [MOD] Uses GloryBroadcaster
│   │   ├── layout.tsx           # [MOD] Nav imported from config
│   │   └── ...
│   ├── live/[roomId]/           # [MOD] Uses GloryViewer + GloryParticipant
│   ├── layout.tsx               # [MOD] +AiChatWidget, -Google Fonts
│   └── ...
│
├── hooks/                       # (unchanged)
├── functions/src/               # (unchanged)
└── ai/                          # [DEL] Entire directory removed
```

---

## 3. Data Flow — Caching Strategy (New)

```
┌──────────┐     ┌───────────┐     ┌──────────────┐
│  Browser  │────▶│  Next.js  │────▶│  Firebase     │
│ (Client)  │     │  Server   │     │  Firestore    │
└──────────┘     └───────────┘     └──────────────┘
     │                                  │
     │── sessionStorage cache           │
     │   ├── siteSettings (1hr TTL)     │
     │   ├── navLinks (session)         │
     │   ├── courseMetadata (5min TTL)  │
     │   ├── languages (session)        │
     │   └── permissions (session)      │
     │                                  │
     │── real-time listeners            │
     │   ├── user doc (auth state)      │
     │   ├── liveEvents (admin view)    │
     │   └── announcements              │
     │                                  │
     │── hardcoded defaults             │
     │   └── siteSettings fallback      │
     │       (no fetch if cached)       │
     └──────────────────────────────────┘
```

### New caching rules:

| Data | Cache Type | TTL | Strategy |
|------|-----------|-----|----------|
| **Site Settings** | sessionStorage | 1 hour | Cache-first, fallback to hardcoded defaults |
| **Nav Links** | sessionStorage | Session | Fetch once, share via context |
| **Course Metadata** | sessionStorage | 5 min | Titles only, progress queries stay live |
| **Languages** | sessionStorage | Session | Already implemented, no change |
| **Permissions** | sessionStorage | Session | Already implemented, no change |
| **User Video Progress** | None (real-time) | — | Always live, critical for tracking |
| **Live Events** | None (real-time) | — | Always live, admin needs updates |
| **Announcements** | None (real-time) | — | Always live, need real-time display |

---

## 4. AI Architecture (New)

```
src/
├── lib/ai/
│   ├── groq.ts                  # Core API wrapper
│   │   └── askGroq(messages, systemPrompt, options?)
│   │       └── POST https://api.groq.com/openai/v1/chat/completions
│   │       └── Model: llama-3.3-70b-versatile (free tier)
│   └── chat-config.ts           # System prompt with app context
│       └── Includes: features, pages, roles, ladder system, languages
│
├── app/api/ai/chat/route.ts     # Server endpoint (keeps API key secret)
│   └── POST { question, history[] } → { answer }
│
├── components/
│   └── ai-chat-widget.tsx       # Floating chat UI
│       ├── Floating button (bottom-right, z-50)
│       ├── Chat overlay panel
│       ├── Message bubbles (bot left, user right)
│       └── Typing indicator
│
└── (src/ai/ — DELETED entirely)
    └── flows/ → Rewritten to call groq.ts directly
        ├── keyword-generator.ts    → direct Groq
        ├── smart-tagging.ts        → direct Groq
        ├── course-ideas.ts         → direct Groq
        ├── personalized-learning-paths.ts → direct Groq
        ├── translate-keys.ts       → direct Groq
        └── global-search.ts        → direct Groq
```

### Groq API integration:
```
User message → /api/ai/chat → askGroq() → Groq API → response → client
```

### System prompt capabilities:
- Answers questions in any language (auto-detect + respond in same language)
- Platform knowledge: courses, live events, community, certificates, music
- User roles and permissions explained
- Ladder/progression system explained
- Admin panel navigation guidance
- Concise 2-3 sentence responses

---

## 5. Live Streaming Architecture (New)

```
┌─────────────────────────────────────────────────┐
│                 GloryBroadcaster                  │
│  ┌─────────────────────────────────────────┐     │
│  │  Custom React UI (platform branded)     │     │
│  │  ┌────────┐ ┌────────┐ ┌────────┐      │     │
│  │  │Camera  │ │ Mic    │ │ Screen │      │     │
│  │  │Preview │ │ Toggle │ │ Share  │      │     │
│  │  └────────┘ └────────┘ └────────┘      │     │
│  │  ┌──────────────────────────────┐      │     │
│  │  │  Participant Grid            │      │     │
│  │  │  [Self] [User 1] [User 2]    │      │     │
│  │  └──────────────────────────────┘      │     │
│  │  ┌──────────┐ ┌──────────┐            │     │
│  │  │ Go Live  │ │  Record  │            │     │
│  │  └──────────┘ └──────────┘            │     │
│  └─────────────────────────────────────────┘     │
│  ═══════════════════════════════════════════      │
│  Vdo.Ninja JS Engine (internal, hidden)          │
└─────────────────────────────────────────────────┘
         │                          │
         ▼                          ▼
┌──────────────────┐    ┌───────────────────┐
│  GloryViewer     │    │ GloryParticipant   │
│  (watch only)    │    │ (camera + mic)     │
│  ┌────────────┐  │    │ ┌───────────────┐ │
│  │Custom Vid  │  │    │ │Cam Select     │ │
│  │Controls    │  │    │ │Mic Select     │ │
│  │Fullscreen  │  │    │ │Join/Leave     │ │
│  └────────────┘  │    │ └───────────────┘ │
└──────────────────┘    └───────────────────┘
```

### Recording flow:
```
Admin clicks "Record" → MediaRecorder.start()
Admin ends stream    → MediaRecorder.stop()
                           │
                           ▼
                    Blob ready
                           │
                           ▼
           Google Drive API (private folder)
                           │
                           ▼
              Link saved to Firestore event doc
```

### Component responsibilities:
- **GloryBroadcaster**: Camera/mic/screen capture, participant grid, go-live/end-live, record button
- **GloryViewer**: Watch stream with custom controls, fullscreen, volume
- **GloryParticipant**: Camera/mic selection, join/leave stream

---

## 6. Admin Panel (After)

```
src/lib/admin-nav-config.ts          # [NEW] Typed config file
src/app/admin/layout.tsx             # [MOD] ~150 lines (was 415)
    └── import { navLinks } from '@/lib/admin-nav-config'
    └── NavItem component (same logic, cleaner)
```

### Benefits:
- Nav config is now testable, typed, and independently editable
- layout.tsx is focused on layout logic only
- Adding new sidebar items = edit one config file

---

## 7. Package Dependencies — Removed

```
Removed:
├── @genkit-ai/googleai       → Replaced by direct Groq API
├── @genkit-ai/firebase       → No longer needed
├── @genkit-ai/next           → No longer needed
└── genkit-cli (dev)          → No longer needed

Removed from npm scripts:
├── genkit:dev
└── genkit:watch

Removed from environment:
├── GEMINI_API_KEY
└── Added: GROQ_API_KEY
```

---

## 8. Performance Improvements (Expected)

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Firestore reads per homepage visit | ~5 | ~1 | **80% reduction** |
| Firestore reads per dashboard visit | ~12 | ~8 | **33% reduction** |
| Google Fonts loaded | 5 | 2 | **60% fewer** |
| video-player.tsx size | 933 lines | ~250 avg/file | **Modular** |
| Admin layout size | 415 lines | ~150 lines | **64% smaller** |
| Genkit dependencies | 4 packages | 0 | **Removed** |
| AI cost | Gemini paid | Groq free tier | **$0/month** |
| Live streaming | No recording | Google Drive | **Free storage** |
| Nav link fetches per page | 2 (duplicate) | 1 (shared) | **50% fewer** |

---

## 9. File Change Summary

| Change Type | Count | Files |
|------------|-------|-------|
| New files | 10 | `groq.ts`, `chat-config.ts`, `admin-nav-config.ts`, `nav-links-provider.tsx`, `ai-chat-widget.tsx`, `api/ai/chat/route.ts`, `broadcaster.tsx`, `viewer.tsx`, `participant.tsx`, `recorder.ts`, `video/*` (4) |
| Modified files | 14 | `data.ts`, `page.tsx`, `header.tsx`, `user-dashboard-client.tsx`, `live-events.ts`, `admin/layout.tsx`, `live-events-list.tsx`, `admin/live/page.tsx`, `live/[roomId]/page.tsx`, `layout.tsx`, `package.json`, `6 flow files`, `.env.local`, `ai/genkit.ts` |
| Deleted | ~7 files | `src/ai/*` (entire directory), `ai-assistant.tsx` |

---

## 10. Future Considerations (Post-V1)

- ✅ Push notifications (Firebase Cloud Messaging)
- ✅ PWA / offline support
- ✅ Sitemap + robots.txt (SEO)
- ✅ Global error boundary
- ✅ AI learning recommendations (wired in)
- ✅ Announcement scheduling (publish/expiry dates)
- ✅ Testing (vitest + Playwright)
- ✅ CI/CD (GitHub Actions)
