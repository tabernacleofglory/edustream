
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Save, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const SUPPORTED_LOCALES = ['en', 'ht', 'fr', 'es'];

interface TranslationDoc {
    id: string; // The key, e.g., "homepage.welcome"
    en: string;
    ht: string;
    fr: string;
    es: string;
}

export default function LocalizationManager() {
    const [translations, setTranslations] = useState<TranslationDoc[]>([]);
    const [changedKeys, setChangedKeys] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { toast } = useToast();

    const fetchTranslations = useCallback(async () => {
        setLoading(true);
        try {
            const snapshot = await getDocs(collection(db, 'translations'));
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as TranslationDoc));
            setTranslations(data);
        } catch (error) {
            console.error("Error fetching translations:", error);
            toast({ variant: 'destructive', title: 'Failed to load translations.' });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchTranslations();
    }, [fetchTranslations]);

    const handleTextChange = (key: string, locale: string, value: string) => {
        setTranslations(prev =>
            prev.map(t => (t.id === key ? { ...t, [locale]: value } : t))
        );
        setChangedKeys(prev => new Set(prev).add(key));
    };

    const handleSaveChanges = async () => {
        setSaving(true);
        const batch = writeBatch(db);
        let changesCount = 0;

        changedKeys.forEach(key => {
            const translationDoc = translations.find(t => t.id === key);
            if (translationDoc) {
                const { id, ...data } = translationDoc;
                const docRef = doc(db, 'translations', id);
                batch.update(docRef, data);
                changesCount++;
            }
        });
        
        try {
            await batch.commit();
            toast({ title: 'Success', description: `${changesCount} translations updated successfully.` });
            setChangedKeys(new Set());
        } catch (error) {
            console.error("Error saving translations:", error);
            toast({ variant: 'destructive', title: 'Failed to save changes.' });
        } finally {
            setSaving(false);
        }
    };

    const filteredTranslations = useMemo(() => {
        if (!searchTerm) return translations;
        const lowercasedFilter = searchTerm.toLowerCase();
        return translations.filter(t =>
            t.id.toLowerCase().includes(lowercasedFilter) ||
            t.en.toLowerCase().includes(lowercasedFilter) ||
            t.ht.toLowerCase().includes(lowercasedFilter) ||
            t.fr.toLowerCase().includes(lowercasedFilter) ||
            t.es.toLowerCase().includes(lowercasedFilter)
        );
    }, [searchTerm, translations]);

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div>
                        <CardTitle>Translation Management</CardTitle>
                        <CardDescription>Edit text content for all supported languages.</CardDescription>
                    </div>
                    <div className="flex w-full sm:w-auto gap-2">
                        <div className="relative flex-1 sm:flex-initial">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search keys or text..."
                                className="pl-8"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                         <Button onClick={handleSaveChanges} disabled={saving || changedKeys.size === 0}>
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save ({changedKeys.size})
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="min-w-[200px]">Translation Key</TableHead>
                                {SUPPORTED_LOCALES.map(locale => (
                                    <TableHead key={locale} className="min-w-[250px] uppercase">{locale}</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-8 w-full" /></TableCell>
                                        {SUPPORTED_LOCALES.map(locale => (
                                            <TableCell key={locale}><Skeleton className="h-8 w-full" /></TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : (
                                filteredTranslations.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-mono text-xs">{item.id}</TableCell>
                                        {SUPPORTED_LOCALES.map(locale => (
                                            <TableCell key={locale}>
                                                <Textarea
                                                    value={item[locale as keyof TranslationDoc]}
                                                    onChange={(e) => handleTextChange(item.id, locale, e.target.value)}
                                                    className={`min-h-[60px] ${!item[locale as keyof TranslationDoc] && 'border-yellow-400'}`}
                                                    rows={2}
                                                />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
