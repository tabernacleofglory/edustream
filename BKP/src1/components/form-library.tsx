
"use client";

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { FileQuestion, CheckCircle } from 'lucide-react';
import type { CustomForm } from '@/lib/types';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';

interface FormLibraryProps {
    forms: CustomForm[];
    onSelectForm: (form: CustomForm) => void;
    selectedFormId?: string;
}

export default function FormLibrary({
    forms,
    onSelectForm,
    selectedFormId,
}: FormLibraryProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false); // Assuming forms are passed in, so not loading initially

    const filteredForms = useMemo(() => {
        return forms.filter(f => f.title.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [forms, searchTerm]);

    return (
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle>Form Library</DialogTitle>
                <DialogDescription>Select a form to attach to this course.</DialogDescription>
            </DialogHeader>
            <div className="px-6 pt-4">
                <Input placeholder="Search forms..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <ScrollArea className="h-96 px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                    {loading ? (
                        Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
                    ) : filteredForms.length > 0 ? (
                        filteredForms.map(form => {
                            const isSelected = selectedFormId === form.id;
                            return (
                                <Card
                                    key={form.id}
                                    className={cn("group relative cursor-pointer hover:ring-2 hover:ring-primary", isSelected && "ring-2 ring-primary")}
                                    onClick={() => onSelectForm(form)}
                                >
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <FileQuestion className="h-6 w-6 text-muted-foreground" />
                                            <div>
                                                <p className="font-semibold">{form.title}</p>
                                                <p className="text-xs text-muted-foreground capitalize">{form.type} form</p>
                                            </div>
                                        </div>
                                        {isSelected && (
                                            <div className="absolute top-2 right-2 bg-primary text-white rounded-full h-5 w-5 flex items-center justify-center">
                                                <CheckCircle className="h-3 w-3" />
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })
                    ) : (
                        <p className="col-span-full text-center text-muted-foreground">No forms found.</p>
                    )}
                </div>
            </ScrollArea>
        </DialogContent>
    );
}

