
"use client";

import { useState, useEffect, useCallback } from 'react';
import { getFirebaseFirestore } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import Image from 'next/image';
import { Award, CheckCircle } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';

interface Logo {
    id: string;
    title: string;
    url: string;
}

interface LogoLibraryProps {
  onSelectLogo: (logo: Logo) => void;
  selectedLogoUrl?: string | null;
}

export default function LogoLibrary({ onSelectLogo, selectedLogoUrl }: LogoLibraryProps) {
  const [logos, setLogos] = useState<Logo[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const db = getFirebaseFirestore();

  const fetchLogos = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'Contents'), where("Type", "==", "logo"));
      const querySnapshot = await getDocs(q);
      const logosList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Logo));
      setLogos(logosList);
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Failed to fetch logos' });
    } finally {
      setLoading(false);
    }
  }, [toast, db]);

  useEffect(() => {
    fetchLogos();
  }, [fetchLogos]);


  return (
    <>
      <ScrollArea className="flex-grow p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                    <Card key={i}><Skeleton className="aspect-square w-full" /></Card>
                ))
            ) : logos.map(logo => (
              <Card 
                key={logo.id} 
                className={cn("group cursor-pointer hover:ring-2 hover:ring-primary", selectedLogoUrl === logo.url && "ring-2 ring-primary")}
                onClick={() => onSelectLogo(logo)}
              >
                  <CardContent className="p-0">
                      <div className="relative aspect-square w-full">
                        <Image src={logo.url} alt={logo.title} fill style={{objectFit:"contain"}} className='p-2' />
                        {selectedLogoUrl === logo.url && (
                          <div className="absolute inset-0 bg-primary/70 flex items-center justify-center">
                              <CheckCircle className="h-8 w-8 text-white" />
                          </div>
                        )}
                      </div>
                      <p className="text-sm font-medium p-2 truncate">{logo.title}</p>
                  </CardContent>
              </Card>
            ))}
        </div>
        {!loading && logos.length === 0 && (
            <div className="text-center text-muted-foreground py-12 flex flex-col items-center">
                <Award className="h-12 w-12" />
                <p className="mt-2">No logos in the library. Upload one in the Content -{'>'} Logos section.</p>
            </div>
        )}
      </ScrollArea>
    </>
  );
}
