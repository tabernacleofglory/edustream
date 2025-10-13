
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Globe } from 'lucide-react';
import Image from 'next/image';

interface Language {
    id: string; // e.g., 'en', 'es', 'fr'
    name: string; // e.g., 'English', 'Español', 'Français'
}

interface Translations {
    [key: string]: string;
}

interface I18nContextType {
    languages: Language[];
    currentLanguage: string;
    setLanguage: (lang: string) => void;
    translations: Translations;
    t: (key: string, fallback?: string) => string;
    loading: boolean;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const LanguageSelector = ({ languages, onSelect, defaultBgUrl }: { languages: Language[], onSelect: (lang: string) => void, defaultBgUrl?: string | null }) => {
    return (
        <div className="fixed inset-0 z-[200] bg-background flex items-center justify-center p-4">
             {defaultBgUrl && (
                <Image 
                    src={defaultBgUrl}
                    alt="Background"
                    fill
                    style={{objectFit:"cover"}}
                    className="opacity-20"
                />
            )}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <Card className="relative z-10 w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto bg-primary text-primary-foreground rounded-full p-3 w-fit mb-4">
                        <Globe className="h-8 w-8" />
                    </div>
                    <CardTitle>Select Your Language</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                    {languages.map(lang => (
                        <Button key={lang.id} variant="outline" size="lg" onClick={() => onSelect(lang.id)}>
                            {lang.name}
                        </Button>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
};


export const I18nProvider = ({ children }: { children: ReactNode }) => {
    const [languages, setLanguages] = useState<Language[]>([]);
    const [currentLanguage, setCurrentLanguageState] = useState<string | null>(null);
    const [translations, setTranslations] = useState<Translations>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                // Fetch languages and translations in parallel
                const langQuery = query(collection(db, 'languages'), where('status', '==', 'published'));
                const transSnapshotPromise = getDocs(collection(db, 'translations'));
                const langSnapshotPromise = getDocs(langQuery);
                
                const [transSnapshot, langSnapshot] = await Promise.all([
                    transSnapshotPromise,
                    langSnapshotPromise,
                ]);

                const availableLangs = langSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name } as Language));
                setLanguages(availableLangs);
                
                const storedLang = typeof window !== 'undefined' ? localStorage.getItem('user_language') : null;
                // Default to 'en' if no language is stored or if the stored language is not in the available list
                const initialLang = (storedLang && availableLangs.some(l => l.id === storedLang)) ? storedLang : 'en';
                
                const allTranslations: Translations = {};
                const fallbackLang = 'en';

                transSnapshot.forEach(doc => {
                    allTranslations[doc.id] = doc.data()[initialLang] || doc.data()[fallbackLang] || `[${doc.id}]`;
                });
                
                setTranslations(allTranslations);
                setCurrentLanguageState(initialLang);

            } catch (error) {
                console.error("Failed to initialize i18n:", error);
                 // Fallback to English if there's an error
                setCurrentLanguageState('en');
            } finally {
                setLoading(false);
            }
        };

        fetchInitialData();
    }, []);

    const setLanguage = useCallback((lang: string) => {
        localStorage.setItem('user_language', lang);
        window.location.reload(); // Reload to apply the new language everywhere
    }, []);

    const t = useCallback((key: string, fallback?: string): string => {
        return translations[key] || fallback || `[${key}]`;
    }, [translations]);
    
    if (loading || !currentLanguage) {
        return (
             <div className="flex min-h-screen items-center justify-center">
                <Skeleton className="h-screen w-screen" />
            </div>
        )
    }
    
    return (
        <I18nContext.Provider value={{ languages, currentLanguage: currentLanguage!, setLanguage, translations, t, loading }}>
            {children}
        </I18nContext.Provider>
    );
};

export const useI18n = (): I18nContextType => {
    const context = useContext(I18nContext);
    if (context === undefined) {
        throw new Error('useI18n must be used within an I18nProvider');
    }
    return context;
};
