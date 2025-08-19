
'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  globalSearch,
  type GlobalSearchInput,
} from '@/ai/flows/global-search';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from './ui/skeleton';
import { getFirebaseFirestore } from '@/lib/firebase';
import { collection, getDocs, query, where, documentId } from 'firebase/firestore';
import type { Course, Video, Documentation, User } from '@/lib/types';
import { ai } from '@/ai/genkit';


const formSchema = z.object({
  query: z.string().min(1, 'Please enter a question.'),
});

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AiAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchableData, setSearchableData] = useState<Omit<GlobalSearchInput, 'query'> | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const { user } = useAuth();
  const db = getFirebaseFirestore();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<{ query: string }>({
    resolver: zodResolver(formSchema),
  });

   useEffect(() => {
    const fetchAllData = async () => {
        setLoadingData(true);
        try {
            const coursesSnapshot = await getDocs(collection(db, 'courses'));
            const courses = coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));

            const allVideoIds = courses.flatMap(course => course.videos || []);
            let videos: { id: string; title: string; courseId: string; courseTitle: string }[] = [];
            if (allVideoIds.length > 0) {
                 const videoChunks: string[][] = [];
                 for (let i = 0; i < allVideoIds.length; i += 30) {
                     videoChunks.push(allVideoIds.slice(i, i + 30));
                 }
                 const videoPromises = videoChunks.map(chunk => getDocs(query(collection(db, 'Contents'), where(documentId(), 'in', chunk))));
                 const videoSnapshots = await Promise.all(videoPromises);
                 const allVideoDocs = videoSnapshots.flatMap(s => s.docs);

                 videos = allVideoDocs.map(doc => {
                     const data = doc.data();
                     const course = courses.find(c => Array.isArray(c.videos) && c.videos.includes(doc.id));
                     return { id: doc.id, title: data.title, courseId: course?.id || '', courseTitle: course?.title || '' };
                 });
            }

            const docsSnapshot = await getDocs(collection(db, 'documentation'));
            const documentation = docsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Documentation));

            const usersSnapshot = await getDocs(collection(db, 'users'));
            const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));

            setSearchableData({ courses, videos, documentation, users });
        } catch (error) {
            console.error("Failed to fetch searchable data:", error);
        } finally {
            setLoadingData(false);
        }
    };
    fetchAllData();
  }, [db]);

  useEffect(() => {
    if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);


  const onSubmit: SubmitHandler<{ query: string }> = async (data) => {
    if (!searchableData) {
        console.error("Searchable data is not loaded yet.");
        return;
    }
    const userMessage: Message = { role: 'user', content: data.query };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    reset();

    try {
        const { output } = await globalSearch({ query: data.query, ...searchableData });
        
        if (!output || !output.results) {
            throw new Error("No valid response from AI.");
        }
        
        let assistantResponse = "Here's what I found:\n\n";
        if (output.results.length === 0) {
            assistantResponse = "I couldn't find any specific content matching your query, but I can try to answer based on my general knowledge. How can I help?";
        } else {
            output.results.forEach(result => {
                assistantResponse += `- **[${result.title}](${result.url})** - (${result.type})\n`;
            });
        }
        
        const assistantMessage: Message = { role: 'assistant', content: assistantResponse };
        setMessages((prev) => [...prev, assistantMessage]);

    } catch (e) {
      console.error(e);
      const errorMessage: Message = { role: 'assistant', content: "Sorry, I encountered an error. Please try again." };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>AI Assistant</CardTitle>
        <CardDescription>
            Ask questions about your platform's content, users, and structure.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col h-[60vh]">
        <ScrollArea className="flex-1 p-4 border rounded-md" ref={scrollAreaRef as any}>
            <div className="space-y-4">
                {messages.length === 0 && !isLoading && (
                    <div className="text-center text-muted-foreground py-8">
                        <Sparkles className="mx-auto h-12 w-12" />
                        <p className="mt-4">Ask me anything about your platform!</p>
                    </div>
                )}
                {messages.map((message, index) => (
                    <div key={index} className={`flex items-start gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
                         {message.role === 'assistant' && (
                            <Avatar className="h-8 w-8 bg-primary text-primary-foreground">
                                <AvatarFallback><Sparkles /></AvatarFallback>
                            </Avatar>
                         )}
                         <div className={`p-3 rounded-lg max-w-lg ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                            <ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none">{message.content}</ReactMarkdown>
                         </div>
                         {message.role === 'user' && (
                             <Avatar className="h-8 w-8">
                                <AvatarImage src={user?.photoURL || undefined} />
                                <AvatarFallback>{getInitials(user?.displayName)}</AvatarFallback>
                            </Avatar>
                         )}
                    </div>
                ))}
                 {isLoading && (
                    <div className="flex items-start gap-3">
                         <Avatar className="h-8 w-8 bg-primary text-primary-foreground">
                            <AvatarFallback><Sparkles /></AvatarFallback>
                        </Avatar>
                        <div className="p-3 rounded-lg bg-muted">
                           <Skeleton className="h-4 w-8 bg-muted-foreground/30 animate-pulse" />
                        </div>
                    </div>
                 )}
            </div>
        </ScrollArea>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 flex gap-2">
            <Input 
                {...register("query")}
                placeholder="e.g., How many courses are in the 'Leadership' ladder?"
                autoComplete="off"
                disabled={isLoading || loadingData}
            />
            <Button type="submit" disabled={isLoading || loadingData}>
                {isLoading || loadingData ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </Button>
        </form>
         {errors.query && <p className="text-sm text-destructive mt-1">{errors.query.message}</p>}
      </CardContent>
    </Card>
  );
}
