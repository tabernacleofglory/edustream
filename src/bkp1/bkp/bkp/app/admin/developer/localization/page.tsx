
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, writeBatch, setDoc, query, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Save, Search, Languages } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const DEFAULT_TRANSLATIONS: { [key: string]: { [key: string]: string } } = {
    // This object can be expanded with more default EN keys
    "dashboard.welcome": { "en": "Welcome" },
    "dashboard.continueLearning.title": { "en": "Continue Learning" },
    "login.title": { "en": "Welcome Back" },
    // Admin
    "admin.nav.group.main": { "en": "Main" },
    "admin.nav.analytics": { "en": "Analytics" },
    "admin.nav.users.group": { "en": "Users" },
    "admin.nav.users.management": { "en": "User Management" },
    "admin.nav.users.ladders": { "en": "Ladders" },
    "admin.nav.users.speakers": { "en": "Speakers" },
    "admin.nav.users.promotions": { "en": "Promotion Requests" },
    "admin.nav.users.hp_requests": { "en": "HP Requests" },
    "admin.nav.group.content": { "en": "Content" },
    "admin.nav.content.courses": { "en": "Courses" },
    "admin.nav.content.libraries": { "en": "Libraries" },
    "admin.nav.content.videos": { "en": "Videos" },
    "admin.nav.content.documents": { "en": "Documents" },
    "admin.nav.content.quizzes": { "en": "Quizzes" },
    "admin.nav.content.images": { "en": "Images" },
    "admin.nav.content.music": { "en": "Music" },
    "admin.nav.content.logos": { "en": "Logos" },
    "admin.nav.content.certificates": { "en": "Certificates" },
    "admin.nav.content.documentation": { "en": "Documentation" },
    "admin.nav.content.announcements": { "en": "Announcements" },
    "admin.nav.content.languages": { "en": "Languages" },
    "admin.nav.content.ministries": { "en": "Ministries" },
    "admin.nav.group.platform": { "en": "Platform" },
    "admin.nav.platform.campus": { "en": "Campus" },
    "admin.nav.platform.live": { "en": "Live" },
    "admin.nav.platform.my_certificates": { "en": "My Certificates" },
    "admin.nav.platform.developer": { "en": "Developer" },
    "admin.nav.platform.dev.site_settings": { "en": "Site Settings" },
    "admin.nav.platform.dev.cert_builder": { "en": "Certificate Builder" },
    "admin.nav.platform.dev.links": { "en": "Links" },
    "admin.nav.platform.dev.permissions": { "en": "Permissions" },
    "admin.nav.platform.dev.ai_tools": { "en": "AI Tools" },
    "admin.nav.platform.dev.localization": { "en": "Localization" },
    "admin.courses.title": { "en": "Course Management" },
    "admin.courses.description": { "en": "Create, view, and edit courses in your catalog." },
    "admin.courses.add_button": { "en": "Add Course" },
    "admin.courses.filter.ladders_placeholder": { "en": "All Class Ladders" },
    "admin.courses.filter.all_ladders": { "en": "All Ladders" },
    "admin.courses.filter.more": { "en": "More" },
    "admin.courses.filter.all_categories": { "en": "All Categories" },
    "admin.courses.edit_sheet_title": { "en": "Edit Course" },
    "admin.courses.add_sheet_title": { "en": "Create a New Course" },
    "admin.users.title": { "en": "User Management" },
    "admin.users.description": { "en": "View, edit, and manage user roles, permissions, and details." }
};

interface StoredLanguage {
    id: string; // The two-letter language code (e.g., "en")
    name: string; // The full name (e.g., "English")
    status: 'published' | 'private';
}

interface TranslationDoc {
    id: string; // The key, e.g., "homepage.welcome"
    [key: string]: string; // e.g., en: "Welcome", fr: "Bienvenue"
}

export default function LocalizationManager() {
    const [translations, setTranslations] = useState<TranslationDoc[]>([]);
    const [activeLanguages, setActiveLanguages] = useState<StoredLanguage[]>([]);
    const [changedKeys, setChangedKeys] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isInitializing, setIsInitializing] = useState(false);
    const { toast } = useToast();

    const fetchLanguagesAndTranslations = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch published languages
            const langQuery = query(collection(db, 'languages'), where('status', '==', 'published'));
            const langSnapshot = await getDocs(langQuery);
            const langList = langSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredLanguage));
            setActiveLanguages(langList);

            // Fetch all translations
            const transSnapshot = await getDocs(collection(db, 'translations'));
            const transData = transSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as TranslationDoc));
            setTranslations(transData);

        } catch (error) {
            console.error("Error fetching data:", error);
            toast({ variant: 'destructive', title: 'Failed to load localization data.' });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchLanguagesAndTranslations();
    }, [fetchLanguagesAndTranslations]);

    const handleInitializeTranslations = async () => {
        setIsInitializing(true);
        try {
            const existingKeys = new Set(translations.map(t => t.id));
            const batch = writeBatch(db);
            let addedCount = 0;

            Object.entries(DEFAULT_TRANSLATIONS).forEach(([key, value]) => {
                if (!existingKeys.has(key)) {
                    const docRef = doc(db, 'translations', key);
                    batch.set(docRef, { en: value.en }); // Only set the default English text
                    addedCount++;
                }
            });

            if (addedCount > 0) {
                await batch.commit();
                toast({ title: 'Success', description: `${addedCount} new translation keys have been added.` });
                fetchLanguagesAndTranslations(); // Refresh the list
            } else {
                toast({ title: 'No New Keys', description: 'All default translation keys already exist.' });
            }

        } catch (error) {
            console.error("Error initializing translations:", error);
            toast({ variant: 'destructive', title: 'Initialization Failed.' });
        } finally {
            setIsInitializing(false);
        }
    };

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
        // Also check default translations for English text
        return translations.filter(t =>
            t.id.toLowerCase().includes(lowercasedFilter) ||
            Object.values(t).some(val => String(val).toLowerCase().includes(lowercasedFilter)) ||
            DEFAULT_TRANSLATIONS[t.id]?.en?.toLowerCase().includes(lowercasedFilter)
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
                        <Button onClick={handleInitializeTranslations} disabled={isInitializing || loading}>
                            {isInitializing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Languages className="mr-2 h-4 w-4" />}
                            Sync Keys
                        </Button>
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
                                {activeLanguages.map(lang => (
                                    <TableHead key={lang.id} className="min-w-[250px] uppercase">{lang.name}</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-8 w-full" /></TableCell>
                                        {activeLanguages.map(lang => (
                                            <TableCell key={lang.id}><Skeleton className="h-8 w-full" /></TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : filteredTranslations.length > 0 ? (
                                filteredTranslations.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-mono text-xs">{item.id}</TableCell>
                                        {activeLanguages.map(lang => (
                                            <TableCell key={lang.id}>
                                                <Textarea
                                                    value={item[lang.id] || ''}
                                                    onChange={(e) => handleTextChange(item.id, lang.id, e.target.value)}
                                                    placeholder={item.en || DEFAULT_TRANSLATIONS[item.id]?.en || ''}
                                                    className={`min-h-[60px] ${!item[lang.id] && 'placeholder:text-muted-foreground/60'}`}
                                                    rows={2}
                                                />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : (
                                 <TableRow>
                                    <TableCell colSpan={activeLanguages.length + 1} className="text-center py-8">
                                        <p className="text-muted-foreground">
                                            {translations.length === 0 ? 'No translation keys found. Click "Sync Keys" to get started.' : 'No results found for your search.'}
                                        </p>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
