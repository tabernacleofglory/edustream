'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, RotateCcw } from 'lucide-react';
import { useI18n } from "@/hooks/use-i18n";

const DEFAULT_SCRIPT = `var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
(function(){
var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
s1.async=true;
s1.src='https://embed.tawk.to/69a30f709d76e61c38796886/1jiif8kn3';
s1.charset='UTF-8';
s1.setAttribute('crossorigin','*');
s0.parentNode.insertBefore(s1,s0);
})();`;

export default function CodeManager() {
  const { t } = useI18n();
  const [script, setScript] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const db = getFirebaseFirestore();
  const { toast } = useToast();
  const scriptDocRef = doc(db, 'siteSettings', 'liveChat');

  useEffect(() => {
    const fetchScript = async () => {
      try {
        const docSnap = await getDoc(scriptDocRef);
        if (docSnap.exists()) {
          setScript(docSnap.data().script);
        } else {
          // If no script exists in DB yet, show the original default one
          setScript(DEFAULT_SCRIPT);
        }
      } catch (error) {
        console.error('Error fetching script:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch the live chat script.',
          variant: 'destructive',
        });
      }
      setIsLoading(false);
    };

    fetchScript();
  }, [db, scriptDocRef, toast]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setDoc(scriptDocRef, { script });
      toast({
        title: 'Success',
        description: 'Live chat script saved successfully.',
      });
    } catch (error) {
      console.error('Error saving script:', error);
      toast({
        title: 'Error',
        description: 'Failed to save the live chat script.',
        variant: 'destructive',
      });
    }
    setIsSaving(false);
  };

  const handleResetToDefault = () => {
    if (window.confirm("Are you sure you want to reset to the original Tawk.to script?")) {
        setScript(DEFAULT_SCRIPT);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle>{t('admin.code_manager.title', "Live Chat Management")}</CardTitle>
                <CardDescription>
                {t('admin.code_manager.description', "Update the Tawk.to live chat script for your website.")}
                </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={handleResetToDefault} className="text-muted-foreground">
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset to Default
            </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="animate-spin h-8 w-8 text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            <Textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder={t('admin.code_manager.placeholder', "Paste your Tawk.to script here")}
              rows={12}
              className="font-mono text-xs"
            />
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
              ) : (
                t('admin.code_manager.save_button', 'Save Script')
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
