"use client";

/**
 * Client-only Quiz page
 * - Waits for useAuth() to hydrate (no SSR session calls)
 * - Reads course, quiz, and enrollment with the client Firestore SDK
 * - If not logged in -> push to /login
 * - If not enrolled -> push to /dashboard
 * - Otherwise renders your existing <QuizPanel />
 *
 * This avoids the “blank page → login → dashboard” loop caused by
 * server-side session checks running before client auth is ready.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  documentId,
  Timestamp,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase";
import type { Course, Quiz, UserQuizResult } from "@/lib/types";
import QuizPanel from "@/components/quiz-panel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, Shield } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function normalizeTimestamps<T = any>(data: T): T {
  const isTS = (v: any) => v instanceof Timestamp;
  const walk = (o: any): any => {
    if (Array.isArray(o)) return o.map(walk);
    if (o && typeof o === "object") {
      const out: any = {};
      for (const k of Object.keys(o)) {
        const v = o[k];
        out[k] = isTS(v) ? v.toDate().toISOString() : walk(v);
      }
      return out;
    }
    return o;
  };
  return walk(data);
}

type LoadState =
  | { kind: "idle" }
  | { kind: "auth-check" }
  | { kind: "loading" }
  | { kind: "ready"; course: Course; quiz: Quiz }
  | { kind: "not-enrolled" }
  | { kind: "not-found" }
  | { kind: "denied"; message?: string }
  | { kind: "error"; message?: string };

// Friendly loading shell
function FullscreenState({
  icon,
  title,
  desc,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  desc?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader className="flex flex-col items-center gap-2">
          {icon}
          <CardTitle className="text-center">{title}</CardTitle>
          {desc && <CardDescription className="text-center">{desc}</CardDescription>}
        </CardHeader>
        {children && <CardContent>{children}</CardContent>}
      </Card>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Page (Client)
// -----------------------------------------------------------------------------

export default function QuizPageClient() {
  const router = useRouter();
  const params = useParams() as { courseId: string; quizId: string };
  const { user, loading: authLoading } = useAuth();

  const db = getFirebaseFirestore();

  const [state, setState] = useState<LoadState>({ kind: "idle" });

  // avoid setState after unmount
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    // 1) Wait for auth to hydrate
    if (state.kind === "idle") setState({ kind: "auth-check" });
    if (authLoading) return;

    // 2) If no user, go login (client-side)
    if (!user) {
      // Keep a visible screen so it doesn’t look like a crash
      setState({ kind: "denied", message: "You need to sign in to take this quiz." });
      router.push("/login");
      return;
    }

    // 3) Fetch course + quiz + enrollment entirely on the client
    const run = async () => {
      try {
        setState({ kind: "loading" });

        const { courseId, quizId } = params;

        // course & quiz
        const courseSnap = await getDoc(doc(db, "courses", courseId));
        const quizSnap = await getDoc(doc(db, "quizzes", quizId));

        if (!courseSnap.exists() || !quizSnap.exists()) {
          if (alive.current) setState({ kind: "not-found" });
          return;
        }

        const course = normalizeTimestamps({ id: courseSnap.id, ...courseSnap.data() }) as Course;
        const quiz = normalizeTimestamps({ id: quizSnap.id, ...quizSnap.data() }) as Quiz;

        // enrollment (owner can read; rules already allow that)
        const enrollmentSnap = await getDoc(doc(db, "enrollments", `${user.uid}_${courseId}`));

        if (!enrollmentSnap.exists()) {
          // NOT enrolled → bump them away gracefully
          if (alive.current) setState({ kind: "not-enrolled" });
          // small delay so the message flashes before route change feels less jarring
          setTimeout(() => router.push("/dashboard"), 300);
          return;
        }

        if (alive.current) setState({ kind: "ready", course, quiz });
      } catch (err: any) {
        // Permission-denied reads (e.g. rules mis-match) often come here
        const msg =
          err?.code === "permission-denied"
            ? "You don’t have permission to view this quiz."
            : err?.message || "Something went wrong loading the quiz.";
        if (alive.current) setState({ kind: "error", message: msg });
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.uid, params.courseId, params.quizId]);

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------

  if (state.kind === "auth-check" || state.kind === "loading" || authLoading) {
    return (
      <FullscreenState
        icon={<Loader2 className="h-8 w-8 animate-spin" />}
        title="Loading quiz…"
        desc="Getting things ready."
      />
    );
  }

  if (state.kind === "denied") {
    return (
      <FullscreenState
        icon={<Shield className="h-8 w-8" />}
        title="Sign-in required"
        desc={state.message}
      >
        <div className="flex justify-center">
          <Button onClick={() => router.push("/login")}>Go to login</Button>
        </div>
      </FullscreenState>
    );
  }

  if (state.kind === "not-enrolled") {
    return (
      <FullscreenState
        icon={<AlertTriangle className="h-8 w-8 text-amber-500" />}
        title="You’re not enrolled in this course"
        desc="We’ll take you back to your dashboard."
      />
    );
  }

  if (state.kind === "not-found") {
    return (
      <FullscreenState
        icon={<AlertTriangle className="h-8 w-8 text-amber-500" />}
        title="Quiz not found"
        desc="This quiz may have been removed."
      >
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => router.push("/courses")}>
            Back to courses
          </Button>
        </div>
      </FullscreenState>
    );
  }

  if (state.kind === "error") {
    return (
      <FullscreenState
        icon={<AlertTriangle className="h-8 w-8 text-red-500" />}
        title="Couldn’t load the quiz"
        desc={state.message}
      >
        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={() => router.refresh()}>
            Try again
          </Button>
          <Button onClick={() => router.push("/courses")}>Back to courses</Button>
        </div>
      </FullscreenState>
    );
  }

  if (state.kind === "ready") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/40">
        <QuizPanel
          quizData={state.quiz}
          courseId={state.course.id}
          onQuizComplete={() => router.push("/courses")}
        />
      </div>
    );
  }

  // Fallback (shouldn’t hit)
  return (
    <FullscreenState
      icon={<Loader2 className="h-8 w-8 animate-spin" />}
      title="Loading…"
    />
  );
}
