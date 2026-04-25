
"use client";

import { useI18n } from '@/hooks/use-i18n';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem } from './ui/dropdown-menu';
import { Globe } from 'lucide-react';
import { Skeleton } from './ui/skeleton';

export default function LanguageSwitcher() {
    const { currentLanguage, languages, setLanguage, loading } = useI18n();

    if (loading) {
        return <Skeleton className="h-10 w-10 rounded-full" />;
    }

    if (languages.length <= 1) {
        return null; // Don't show the switcher if there's only one or zero languages
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                    <Globe className="h-5 w-5" />
                    <span className="sr-only">Change language</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup value={currentLanguage} onValueChange={setLanguage}>
                    {languages.map(lang => (
                        <DropdownMenuRadioItem key={lang.id} value={lang.id}>
                            {lang.name}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
