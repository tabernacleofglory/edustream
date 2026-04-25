
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { db, getFirebaseAuth } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, onSnapshot, limit } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Globe, AlertCircle, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import allLanguages from '@/lib/languages.json';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

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

const FLAG_MAP: Record<string, string> = {
    ht: '🇭🇹',
    en: '🇺🇸',
    fr: '🇫🇷',
    es: '🇪🇸',
    pt: '🇧🇷',
    de: '🇩🇪',
    it: '🇮🇹',
    ru: '🇷🇺',
    zh: '🇨🇳',
    ja: '🇯🇵',
    ko: '🇰🇷',
    ar: '🇸🇦',
};

const cleanNativeName = (name: string) => {
    if (!name) return "";
    const firstPart = name.split(/[;,]/)[0].trim();
    return firstPart.charAt(0).toUpperCase() + firstPart.slice(1);
};

// Helper to compare language names loosely
const normalizeLangName = (name: string) => 
    name.toLowerCase().replace(/[^a-z]/g, '').trim();

const LanguageSelector = ({ 
    languages, 
    onSelect, 
    defaultBgUrl,
    conflictState,
    onApplyLanguage,
    onCancelConflict,
    t
}: { 
    languages: Language[], 
    onSelect: (lang: string) => void, 
    defaultBgUrl?: string | null,
    conflictState: any,
    onApplyLanguage: (lang: string) => void,
    onCancelConflict: () => void,
    t: (key: string, fallback?: string) => string
}) => {
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
            <Card className="relative z-10 w-full max-w-md shadow-2xl border-primary/20">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto bg-primary text-primary-foreground rounded-full p-4 w-fit mb-6 shadow-lg">
                        <Globe className="h-10 w-10" />
                    </div>
                    <CardTitle className="text-2xl font-headline">Please Choose Your Preferred Language</CardTitle>
                    <p className="text-muted-foreground text-sm mt-2">
                        Selectionnez votre langue pour continuer<br />
                        (Selecciona tu idioma para continuar)
                    </p>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 pt-6">
                    {languages.length > 0 ? languages.map(lang => (
                        <div key={lang.id} className="space-y-3">
                            <Button 
                                variant="outline" 
                                size="lg" 
                                className={cn(
                                    "h-16 text-lg justify-start px-6 gap-4 hover:border-primary hover:bg-primary/5 transition-all group w-full",
                                    conflictState?.isOpen && conflictState.selectedLanguageCode === lang.id && "border-primary bg-primary/5"
                                )}
                                onClick={() => onSelect(lang.id)}
                                disabled={conflictState?.isOpen && conflictState.selectedLanguageCode !== lang.id}
                            >
                                <span className="text-2xl grayscale group-hover:grayscale-0 transition-all">{FLAG_MAP[lang.id.toLowerCase()] || '🌐'}</span>
                                <span className="font-semibold">{lang.name}</span>
                            </Button>
                            
                            {conflictState?.isOpen && conflictState.selectedLanguageCode === lang.id && (
                                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg animate-in slide-in-from-top-2 duration-300 shadow-sm">
                                    <div className="flex items-start gap-3 text-amber-800 dark:text-amber-200">
                                        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                                        <div className="space-y-3">
                                            <p className="text-sm font-medium leading-relaxed">
                                                {t('i18n.conflict.message', 'You have already started a course in {{language}}. Would you like to continue with {{language}} instead?').replace(/{{language}}/g, conflictState.previousLanguageName)}
                                            </p>
                                            <div className="flex flex-col gap-2">
                                                <Button 
                                                    size="sm"
                                                    className="w-full bg-amber-600 hover:bg-amber-700 text-white border-none shadow-sm"
                                                    onClick={() => onApplyLanguage(conflictState.previousLanguageCode)}
                                                >
                                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                                    Continue in {conflictState.previousLanguageName}
                                                </Button>
                                                <Button 
                                                    size="sm"
                                                    variant="outline"
                                                    className="w-full border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                                                    onClick={() => onApplyLanguage(conflictState.selectedLanguageCode)}
                                                >
                                                    {t('i18n.conflict.button.switch', 'Switch Anyway')}
                                                </Button>
                                                <Button 
                                                    size="sm"
                                                    variant="ghost"
                                                    className="w-full text-xs text-amber-700 dark:text-amber-400"
                                                    onClick={onCancelConflict}
                                                >
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )) : (
                        <Button 
                            variant="outline" 
                            size="lg" 
                            className="h-16 text-lg justify-start px-6 gap-4 hover:border-primary hover:bg-primary/5 transition-all group"
                            onClick={() => onSelect('en')}
                        >
                            <span className="text-2xl grayscale group-hover:grayscale-0 transition-all">🇺🇸</span>
                            <span className="font-semibold">English (Default)</span>
                        </Button>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};


export const I18nProvider = ({ children }: { children: ReactNode }) => {
    const [languages, setLanguages] = useState<Language[]>([]);
    const [langMapping, setLangMapping] = useState<Record<string, string>>({});
    const [currentLanguage, setCurrentLanguageState] = useState<string | null>(null);
    const [rawTranslations, setRawTranslations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasChosenThisSession, setHasChosenThisSession] = useState(false);
    const [siteSettings, setSiteSettings] = useState<any>(null);
    const pathname = usePathname();

    const [conflictState, setConflictState] = useState<{
        isOpen: boolean;
        previousLanguageName: string;
        previousLanguageCode: string;
        selectedLanguageCode: string;
    } | null>(null);

    const translations = useMemo(() => {
        const out: Translations = {};
        const lang = currentLanguage || 'en';
        const fallback = 'en';
        rawTranslations.forEach(item => {
            out[item.id] = item[lang] || item[fallback] || `[${item.id}]`;
        });
        return out;
    }, [rawTranslations, currentLanguage]);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                // Check session
                const sessionChosen = sessionStorage.getItem('language_chosen');
                if (sessionChosen) setHasChosenThisSession(true);

                // Fetch languages, translations, and settings in parallel
                const langQuery = query(collection(db, 'languages'), where('status', '==', 'published'));
                const transSnapshotPromise = getDocs(collection(db, 'translations'));
                const langSnapshotPromise = getDocs(langQuery);
                const settingsPromise = getDoc(doc(db, "siteSettings", "main"));
                
                const [transSnapshot, langSnapshot, settingsSnap] = await Promise.all([
                    transSnapshotPromise,
                    langSnapshotPromise,
                    settingsPromise
                ]);

                if (settingsSnap.exists()) setSiteSettings(settingsSnap.data());

                const mapping: Record<string, string> = {};
                let availableLangs = langSnapshot.docs.map(docSnapshot => {
                    const id = docSnapshot.id;
                    const dbName = docSnapshot.data().name;
                    mapping[id] = dbName;
                    const langInfo = allLanguages.find(l => l.code === id);
                    
                    // Use native name if found in the reference library
                    const nativeName = langInfo ? cleanNativeName(langInfo.nativeName) : dbName;
                    
                    return { id, name: nativeName } as Language;
                });
                
                // FALLBACK: If no published languages found in DB, provide English as default
                if (availableLangs.length === 0) {
                    availableLangs = [{ id: 'en', name: 'English' }];
                    mapping['en'] = 'English';
                }
                
                setLanguages(availableLangs);
                setLangMapping(mapping);
                setRawTranslations(transSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
                
                const storedLang = typeof window !== 'undefined' ? localStorage.getItem('user_language') : null;
                // Default to 'en' if no language is stored or if the stored language is not in the available list
                const initialLang = (storedLang && availableLangs.some(l => l.id === storedLang)) ? storedLang : 'en';
                
                setCurrentLanguageState(initialLang);

            } catch (error) {
                console.error("Failed to initialize i18n:", error);
                setLanguages([{ id: 'en', name: 'English' }]);
                setCurrentLanguageState('en');
            } finally {
                setLoading(false);
            }
        };

        fetchInitialData();
    }, []);

    // Sync Firestore language -> UI language
    useEffect(() => {
        if (!langMapping || Object.keys(langMapping).length === 0) return;

        const auth = getFirebaseAuth();
        let unsubUser: (() => void) | null = null;

        const unsubAuth = onAuthStateChanged(auth, (user) => {
            if (user) {
                unsubUser = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
                    if (docSnap.exists()) {
                        const fbLangName = docSnap.data().language;
                        if (fbLangName) {
                            const normalizedTarget = normalizeLangName(fbLangName);
                            const langCode = Object.keys(langMapping).find(key => 
                                normalizeLangName(langMapping[key]) === normalizedTarget
                            );
                            if (langCode && langCode !== currentLanguage) {
                                localStorage.setItem('user_language', langCode);
                                setCurrentLanguageState(langCode);
                            }
                        }
                    }
                });
            } else {
                if (unsubUser) unsubUser();
                unsubUser = null;
            }
        });

        return () => {
            unsubAuth();
            if (unsubUser) unsubUser();
        };
    }, [langMapping, currentLanguage]);

    const applyLanguage = useCallback(async (langCode: string) => {
        localStorage.setItem('user_language', langCode);
        sessionStorage.setItem('language_chosen', 'true');
        
        const auth = getFirebaseAuth();
        const user = auth.currentUser;
        
        if (user) {
            const officialName = langMapping[langCode];
            if (officialName) {
                try {
                    await updateDoc(doc(db, 'users', user.uid), {
                        language: officialName
                    });
                } catch (e) {
                    console.error("Failed to sync language to user profile:", e);
                }
            }
        }

        window.location.reload();
    }, [langMapping]);

    const setLanguage = useCallback(async (langCode: string) => {
        const auth = getFirebaseAuth();
        const user = auth.currentUser;

        if (user) {
            try {
                // Check for existing progress in another language
                const enrollmentsSnap = await getDocs(query(collection(db, 'enrollments'), where('userId', '==', user.uid), limit(1)));
                if (!enrollmentsSnap.empty) {
                    const firstEnrollment = enrollmentsSnap.docs[0].data();
                    const courseSnap = await getDoc(doc(db, 'courses', firstEnrollment.courseId));
                    if (courseSnap.exists()) {
                        const courseLangName = courseSnap.data().language;
                        const normalizedCourseLang = normalizeLangName(courseLangName);
                        
                        // Find internal code for the course language
                        const courseLangCode = Object.keys(langMapping).find(key => 
                            normalizeLangName(langMapping[key]) === normalizedCourseLang
                        );
                        
                        if (courseLangCode && courseLangCode !== langCode) {
                            setConflictState({
                                isOpen: true,
                                previousLanguageName: languages.find(l => l.id === courseLangCode)?.name || courseLangName,
                                previousLanguageCode: courseLangCode,
                                selectedLanguageCode: langCode
                            });
                            return;
                        }
                    }
                }
            } catch (e) {
                console.error("Conflict check failed:", e);
            }
        }

        await applyLanguage(langCode);
    }, [applyLanguage, langMapping, languages]);

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

    const isMandatoryScreen = pathname === '/' && !hasChosenThisSession;

    if (isMandatoryScreen) {
        return (
            <LanguageSelector 
                languages={languages} 
                onSelect={setLanguage} 
                defaultBgUrl={siteSettings?.homepageBackgroundImageUrl} 
                conflictState={conflictState}
                onApplyLanguage={applyLanguage}
                onCancelConflict={() => setConflictState(null)}
                t={t}
            />
        );
    }
    
    return (
        <I18nContext.Provider value={{ languages, currentLanguage: currentLanguage!, setLanguage, translations, t, loading }}>
            {children}
            {!isMandatoryScreen && conflictState && (
                <Dialog open={conflictState.isOpen} onOpenChange={(open) => !open && setConflictState(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{t('i18n.conflict.title', 'Language Conflict')}</DialogTitle>
                            <DialogDescription>
                                {t('i18n.conflict.message', 'You have already started a course in {{language}}. Would you like to continue with {{language}} instead?').replace(/{{language}}/g, conflictState.previousLanguageName)}
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
                            <Button variant="outline" className="flex-1" onClick={() => applyLanguage(conflictState.selectedLanguageCode)}>
                                {t('i18n.conflict.button.switch', 'Switch Anyway')}
                            </Button>
                            <Button className="flex-1" onClick={() => applyLanguage(conflictState.previousLanguageCode)}>
                                {t('i18n.conflict.button.continue', 'Continue in {{language}}').replace(/{{language}}/g, conflictState.previousLanguageName)}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
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
