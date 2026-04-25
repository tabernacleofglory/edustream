import { Logo } from '@/components/logo';
import LanguageSwitcher from '@/components/language-switcher';
import { ReactNode } from 'react';

export default function ExternalLayout({ children }: { children: ReactNode }) {
  const currentYear = new Date().getFullYear();

  return (
    <div className="flex flex-col min-h-screen bg-muted/40">
      <header className="py-4 px-6 border-b bg-background shadow-sm">
        <div className="container mx-auto flex justify-between items-center">
          <Logo />
          <LanguageSwitcher />
        </div>
      </header>
      <main className="flex-grow flex items-center justify-center py-8">
        {children}
      </main>
       <footer className="py-4 px-6 border-t bg-background">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          &copy; {currentYear} Tabernacle of Glory. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
