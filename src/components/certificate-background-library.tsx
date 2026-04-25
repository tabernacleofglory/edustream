
"use client";

import { useState, useEffect, useCallback } from 'react';
import { getFirebaseFirestore } from '@/lib/firebase';
import { collection, getDocs, query } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import Image from 'next/image';
import { Award, CheckCircle } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';

interface CertificateBackground {
    id: string;
    title: string;
    url: string;
}

interface CertificateBackgroundLibraryProps {
  onSelectCertificate: (certificate: CertificateBackground) => void;
  selectedCertificateUrl?: string | null;
}

export default function CertificateBackgroundLibrary({ onSelectCertificate, selectedCertificateUrl }: CertificateBackgroundLibraryProps) {
  const [backgrounds, setBackgrounds] = useState<CertificateBackground[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const db = getFirebaseFirestore();

  const fetchBackgrounds = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'certificates'));
      const querySnapshot = await getDocs(q);
      const bgList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CertificateBackground));
      setBackgrounds(bgList);
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Failed to fetch certificate backgrounds' });
    } finally {
      setLoading(false);
    }
  }, [toast, db]);

  useEffect(() => {
    fetchBackgrounds();
  }, [fetchBackgrounds]);

  return (
    <>
      <ScrollArea className="flex-grow p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i}><Skeleton className="aspect-video w-full" /></Card>
                ))
            ) : backgrounds.map(bg => (
              <Card 
                key={bg.id} 
                className={cn("group cursor-pointer hover:ring-2 hover:ring-primary", selectedCertificateUrl === bg.url && "ring-2 ring-primary")}
                onClick={() => onSelectCertificate(bg)}
              >
                  <CardContent className="p-0">
                      <div className="relative aspect-video w-full">
                        <Image src={bg.url} alt={bg.title} layout="fill" objectFit="cover" className='rounded-t-lg' />
                        {selectedCertificateUrl === bg.url && (
                          <div className="absolute inset-0 bg-primary/70 flex items-center justify-center">
                              <CheckCircle className="h-8 w-8 text-white" />
                          </div>
                        )}
                      </div>
                      <p className="text-sm font-medium p-2 truncate">{bg.title}</p>
                  </CardContent>
              </Card>
            ))}
        </div>
        {!loading && backgrounds.length === 0 && (
            <div className="text-center text-muted-foreground py-12 flex flex-col items-center">
                <Award className="h-12 w-12" />
                <p className="mt-2">No backgrounds in the library. Upload one in the Content -{'>'} Backgrounds section.</p>
            </div>
        )}
      </ScrollArea>
       <DialogFooter className="p-6 border-t">
            <Button variant="outline" onClick={() => onSelectCertificate({id: 'none', url: '', title: 'No Certificate' })}>
                No Certificate
            </Button>
      </DialogFooter>
    </>
  );
}
