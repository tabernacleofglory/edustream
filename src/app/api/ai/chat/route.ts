import { NextRequest, NextResponse } from "next/server";
import { askGroq } from "@/lib/ai/groq";
import { GLORY_AI_SYSTEM_PROMPT } from "@/lib/ai/chat-config";

export async function POST(request: NextRequest) {
  try {
    const { question, history } = await request.json();

    if (!question || typeof question !== "string" || !question.trim()) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 }
      );
    }

    const messages = [
      { role: "system", content: GLORY_AI_SYSTEM_PROMPT },
      ...(Array.isArray(history) ? history.slice(-10) : []),
      { role: "user", content: question.trim() },
    ];

    const answer = await askGroq(messages);

    return NextResponse.json({ answer });
  } catch (error: any) {
    console.error("AI Chat error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get AI response" },
      { status: 500 }
    );
  }
}
