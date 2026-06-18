"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AiAssistant() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Glory AI Assistant</CardTitle>
        <CardDescription>
          The AI chat is available on every page via the floating chat bubble.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">
          Click the blue chat bubble at the bottom-right corner of any page to
          ask questions about the platform in any language.
        </p>
        <p className="text-muted-foreground">
          Glory AI can help you navigate courses, explain features, find content,
          and more.
        </p>
      </CardContent>
    </Card>
  );
}
