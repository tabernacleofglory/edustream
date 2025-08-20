
"use client";

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { BookCopy, Search, FileText, Lock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from 'date-fns';
import { useAuth } from '@/hooks/use-auth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Documentation {
  id: string;
  title: string;
  content: string;
  createdAt: Timestamp;
}

export default function DocumentationPage() {
    const [documents, setDocuments] = useState<Documentation[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDoc, setSelectedDoc] = useState<Documentation | null>(null);
    const { hasPermission, loading: authLoading } = useAuth();

    const canViewPage = hasPermission('viewDocumentationPage');

    useEffect(() => {
        if (authLoading) return;
        if (!canViewPage) {
            setLoading(false);
            return;
        }

        const q = query(collection(db, "documentation"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const docsList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Documentation));
            setDocuments(docsList);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [canViewPage, authLoading]);

    const filteredDocuments = useMemo(() => {
        if (!searchTerm) {
            return documents;
        }
        return documents.filter(doc => 
            doc.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
            doc.content.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [searchTerm, documents]);
    
    if (authLoading) {
        return <div>Loading...</div>;
    }

    if (!canViewPage) {
        return (
            <Alert variant="destructive">
                <Lock className="h-4 w-4" />
                <AlertTitle>Access Denied</AlertTitle>
                <AlertDescription>You do not have permission to view this page.</AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="container mx-auto py-8">
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold mb-2">Documentation Hub</h1>
                <p className="text-muted-foreground">Find articles and guides to help you use the platform.</p>
            </div>

            <div className="max-w-4xl mx-auto">
                <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input 
                        placeholder="Search documentation..."
                        className="pl-10 h-12 text-lg"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="space-y-4">
                    {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <Card key={i}>
                                <CardHeader>
                                    <Skeleton className="h-6 w-3/4" />
                                    <Skeleton className="h-4 w-1/4 mt-2" />
                                </CardHeader>
                            </Card>
                        ))
                    ) : filteredDocuments.length > 0 ? (
                        filteredDocuments.map(doc => (
                            <Card key={doc.id} className="cursor-pointer hover:border-primary transition-all" onClick={() => setSelectedDoc(doc)}>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <FileText className="h-5 w-5 text-primary" />
                                        {doc.title}
                                    </CardTitle>
                                    <CardDescription>
                                        Last updated on {doc.createdAt ? format(doc.createdAt.toDate(), 'PPP') : 'N/A'}
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        ))
                    ) : (
                         <div className="text-center text-muted-foreground py-12 flex flex-col items-center">
                            <BookCopy className="h-12 w-12" />
                            <p className="mt-4">No documentation articles found.</p>
                        </div>
                    )}
                </div>
            </div>
            
            <Dialog open={!!selectedDoc} onOpenChange={() => setSelectedDoc(null)}>
                <DialogContent className="max-w-4xl">
                    {selectedDoc && (
                        <>
                            <DialogHeader>
                                <DialogTitle>{selectedDoc.title}</DialogTitle>
                            </DialogHeader>
                            <ScrollArea className="h-[70vh] p-1 -mx-4">
                                <article className="prose dark:prose-invert px-4">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                                        {selectedDoc.content}
                                    </ReactMarkdown>
                                </article>
                            </ScrollArea>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
