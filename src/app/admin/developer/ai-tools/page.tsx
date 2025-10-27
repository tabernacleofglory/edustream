
'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Lightbulb, MessageSquare } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SmartTagger from '@/components/smart-tagger';
import AiAssistant from '@/components/ai-assistant';
import IdeaGenerator from '@/components/idea-generator';

function AIToolsContent() {
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get('tool') || 'assistant';

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-headline text-3xl font-bold md:text-4xl">
          AI Tools
        </h1>
        <p className="text-muted-foreground">
          Leverage AI for content generation and platform assistance.
        </p>
      </div>

      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Usage Costs</AlertTitle>
        <AlertDescription>
          Please be aware that every interaction with these AI tools sends a
          request to Google's generative models and will incur charges on your
          Firebase project's billing account. Use these tools judiciously.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="assistant">
            <MessageSquare className="mr-2 h-4 w-4" />
            AI Assistant
          </TabsTrigger>
          <TabsTrigger value="tagger">
            <Lightbulb className="mr-2 h-4 w-4" />
            Smart Tagger
          </TabsTrigger>
           <TabsTrigger value="idea-generator">
            <Lightbulb className="mr-2 h-4 w-4" />
            Idea Generator
          </TabsTrigger>
        </TabsList>
        <TabsContent value="assistant" className="mt-6">
          <AiAssistant />
        </TabsContent>
        <TabsContent value="tagger" className="mt-6">
          <SmartTagger />
        </TabsContent>
         <TabsContent value="idea-generator" className="mt-6">
          <IdeaGenerator />
        </TabsContent>
      </Tabs>
    </div>
  );
}


export default function AIToolsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AIToolsContent />
    </Suspense>
  )
}
