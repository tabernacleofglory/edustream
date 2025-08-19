
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase";
import { useEffect, useState } from "react";
import { Loader2, Lock, Eye, Save, icons, ChevronsUpDown, Minus, Plus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import Certificate from "@/components/certificate";
import type { SiteSettings } from "@/lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import LogoLibrary from "@/components/logo-library";
import CertificateBackgroundLibrary from "@/components/certificate-background-library";
import Image from "next/image";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DynamicIcon from "@/components/dynamic-icon";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

const certificateSettingsSchema = z.object({
  cert_title: z.string().min(1, "Title is required."),
  cert_title_size: z.coerce.number().min(0.1, "Size must be at least 0.1.").optional(),
  cert_subtitle: z.string().min(1, "Subtitle is required."),
  cert_subtitle_size: z.coerce.number().min(0.1, "Size must be at least 0.1.").optional(),
  cert_decoration_icon: z.string().min(1, "Icon name is required."),
  cert_decoration_icon_size: z.coerce.number().min(0.1, "Size must be at least 0.1.").optional(),
  cert_presentedToText: z.string().min(1, "This text is required."),
  cert_presentedToText_size: z.coerce.number().min(0.1, "Size must be at least 0.1.").optional(),
  cert_completionText: z.string().min(1, "This text is required."),
  cert_completionText_size: z.coerce.number().min(0.1, "Size must be at least 0.1.").optional(),
  cert_userName_size: z.coerce.number().min(0.1, "Size must be at least 0.1.").optional(),
  cert_courseName_size: z.coerce.number().min(0.1, "Size must be at least 0.1.").optional(),
  cert_date_size: z.coerce.number().min(0.1, "Size must be at least 0.1.").optional(),
  cert_signatureName: z.string().min(1, "Signature name is required."),
  cert_signatureName_size: z.coerce.number().min(0.1, "Size must be at least 0.1.").optional(),
  cert_signatureTitle: z.string().min(1, "Signature title is required."),
  cert_signatureTitle_size: z.coerce.number().min(0.1, "Size must be at least 0.1.").optional(),
  cert_defaultLogoUrl: z.string().url("Please select a valid logo URL.").optional().or(z.literal('')),
  cert_defaultBackgroundUrl: z.string().url("Please select a valid background URL.").optional().or(z.literal('')),
  cert_showLineUnderUserName: z.boolean().default(false),
  cert_spacing_title_subtitle: z.coerce.number().optional(),
  cert_spacing_subtitle_decoration: z.coerce.number().optional(),
  cert_spacing_decoration_presentedTo: z.coerce.number().optional(),
  cert_spacing_presentedTo_userName: z.coerce.number().optional(),
  cert_spacing_userName_completionText: z.coerce.number().optional(),
  cert_spacing_completionText_courseName: z.coerce.number().optional(),
  cert_spacing_courseName_signatures: z.coerce.number().optional(),
});

type FormValues = z.infer<typeof certificateSettingsSchema>;

const ICON_NAMES = Object.keys(icons);

export default function CertificateBuilderPage() {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const db = getFirebaseFirestore();
  const [isLoading, setIsLoading] = useState(true);
  const [isLogoLibraryOpen, setIsLogoLibraryOpen] = useState(false);
  const [isCertLibraryOpen, setIsCertLibraryOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(certificateSettingsSchema),
    defaultValues: {
      cert_title: "Certificate",
      cert_title_size: 5.3,
      cert_subtitle: "of Completion",
      cert_subtitle_size: 2,
      cert_decoration_icon: "Award",
      cert_decoration_icon_size: 3,
      cert_showLineUnderUserName: false,
      cert_presentedToText: "This certificate is proudly presented to",
      cert_presentedToText_size: 1.125,
      cert_completionText: "for successfully completing the course of",
      cert_completionText_size: 1.125,
      cert_userName_size: 5,
      cert_courseName_size: 2,
      cert_date_size: 1,
      cert_signatureName: "Gregory Toussaint",
      cert_signatureName_size: 2,
      cert_signatureTitle: "Senior Pastor",
      cert_signatureTitle_size: 1,
      cert_defaultLogoUrl: '',
      cert_defaultBackgroundUrl: '',
      cert_spacing_title_subtitle: 0,
      cert_spacing_subtitle_decoration: 1,
      cert_spacing_decoration_presentedTo: 1,
      cert_spacing_presentedTo_userName: 0.5,
      cert_spacing_userName_completionText: 0.5,
      cert_spacing_completionText_courseName: 0.5,
      cert_spacing_courseName_signatures: 1,
    },
  });

  const watchedValues = form.watch();

  useEffect(() => {
    const fetchSettings = async () => {
      const docRef = doc(db, "siteSettings", "main");
      try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as Partial<FormValues>;
          form.reset({
            ...form.getValues(), // Keep default values for any new fields
            ...data,
          });
        }
      } catch (error) {
        console.error("Error fetching site settings:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, [db, form]);
  
  const handleSelectLogo = (logo: { id: string, url: string }) => {
    form.setValue('cert_defaultLogoUrl', logo.url, { shouldValidate: true, shouldDirty: true });
    setIsLogoLibraryOpen(false);
  }

  const handleSelectCertificate = (cert: { id: string, url: string }) => {
    form.setValue('cert_defaultBackgroundUrl', cert.url, { shouldValidate: true, shouldDirty: true });
    setIsCertLibraryOpen(false);
  }


  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    try {
      await setDoc(doc(db, "siteSettings", "main"), values, { merge: true });
      toast({
        title: "Settings Saved!",
        description: "Your certificate settings have been updated.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error Saving",
        description: "Could not save certificate settings.",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const IconSelect = ({ field }: { field: any }) => (
      <Select onValueChange={field.onChange} defaultValue={field.value}>
          <FormControl>
              <SelectTrigger>
                  <SelectValue placeholder="Select an icon" />
              </SelectTrigger>
          </FormControl>
          <SelectContent>
              {ICON_NAMES.map(iconName => (
                  <SelectItem key={iconName} value={iconName}>
                      <div className="flex items-center gap-2">
                         <DynamicIcon name={iconName} className="h-4 w-4" />
                         <span>{iconName}</span>
                      </div>
                  </SelectItem>
              ))}
          </SelectContent>
      </Select>
  );

  const SizeStepper = ({ field, step = 0.1, min = 0.1 }: { field: any, step?: number, min?: number }) => (
    <div className="flex items-center gap-2">
        <Button type='button' variant="outline" size="icon" onClick={() => field.onChange(Math.max(min, (field.value || 0) - step))}>
            <Minus className="h-4 w-4" />
        </Button>
        <div className="w-20 h-10 flex items-center justify-center border rounded-md font-mono text-lg bg-muted">
            {(field.value || 0).toFixed(1)}
        </div>
        <Button type='button' variant="outline" size="icon" onClick={() => field.onChange((field.value || 0) + step)}>
            <Plus className="h-4 w-4" />
        </Button>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!hasPermission("developer")) {
    return <p>You do not have permission to access this page.</p>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
      <Card>
        <CardHeader>
          <CardTitle>Certificate Builder</CardTitle>
          <CardDescription>
            Customize the default content and appearance of your course certificates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              <h4 className="font-semibold text-lg border-b pb-2">Header Section</h4>
              <div className="grid grid-cols-3 gap-2 items-end">
                <FormField control={form.control} name="cert_title" render={({ field }) => ( <FormItem className="col-span-2"><FormLabel>Main Title</FormLabel><FormControl><Input {...field} placeholder="e.g., Certificate"/></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="cert_title_size" render={({ field }) => ( <FormItem><FormLabel>Size</FormLabel><FormControl><SizeStepper field={field} /></FormControl></FormItem> )}/>
              </div>
              <FormField control={form.control} name="cert_spacing_title_subtitle" render={({ field }) => ( <FormItem><FormLabel>Spacing After Title (cqw)</FormLabel><FormControl><SizeStepper field={field} min={0} /></FormControl></FormItem> )}/>
              
              <div className="grid grid-cols-3 gap-2 items-end">
                <FormField control={form.control} name="cert_subtitle" render={({ field }) => ( <FormItem className="col-span-2"><FormLabel>Subtitle</FormLabel><FormControl><Input {...field} placeholder="e.g., of Completion"/></FormControl><FormMessage /></FormItem> )}/>
                <FormField control={form.control} name="cert_subtitle_size" render={({ field }) => ( <FormItem><FormLabel>Size</FormLabel><FormControl><SizeStepper field={field} /></FormControl></FormItem> )}/>
              </div>
              <FormField control={form.control} name="cert_spacing_subtitle_decoration" render={({ field }) => ( <FormItem><FormLabel>Spacing After Subtitle (cqw)</FormLabel><FormControl><SizeStepper field={field} min={0} /></FormControl></FormItem> )}/>

              <div className="grid grid-cols-3 gap-2 items-end">
                <FormField control={form.control} name="cert_decoration_icon" render={({ field }) => ( <FormItem className="col-span-2"><FormLabel>Decoration Icon</FormLabel><IconSelect field={field} /><FormDescription>Any icon name from lucide-react.</FormDescription><FormMessage /></FormItem> )}/>
                <FormField control={form.control} name="cert_decoration_icon_size" render={({ field }) => ( <FormItem><FormLabel>Icon Size</FormLabel><FormControl><SizeStepper field={field} /></FormControl></FormItem> )}/>
              </div>
              <FormField control={form.control} name="cert_spacing_decoration_presentedTo" render={({ field }) => ( <FormItem><FormLabel>Spacing After Decoration (cqw)</FormLabel><FormControl><SizeStepper field={field} min={0} /></FormControl></FormItem> )}/>
              
              <Separator />
              <h4 className="font-semibold text-lg border-b pb-2">Body Section</h4>
              <div className="grid grid-cols-3 gap-2 items-end">
                  <FormField control={form.control} name="cert_presentedToText" render={({ field }) => ( <FormItem className="col-span-2"><FormLabel>Presented To Text</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                  <FormField control={form.control} name="cert_presentedToText_size" render={({ field }) => ( <FormItem><FormLabel>Size</FormLabel><FormControl><SizeStepper field={field} /></FormControl></FormItem> )}/>
              </div>
              <FormField control={form.control} name="cert_spacing_presentedTo_userName" render={({ field }) => ( <FormItem><FormLabel>Spacing After "Presented To" (cqw)</FormLabel><FormControl><SizeStepper field={field} min={0} /></FormControl></FormItem> )}/>

              <FormField control={form.control} name="cert_userName_size" render={({ field }) => ( <FormItem><FormLabel>Student Name Size</FormLabel><FormControl><SizeStepper field={field} /></FormControl><FormMessage /></FormItem> )}/>
              <FormField control={form.control} name="cert_showLineUnderUserName" render={({ field }) => ( <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Show Line Under Name</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)}/>
              <FormField control={form.control} name="cert_spacing_userName_completionText" render={({ field }) => ( <FormItem><FormLabel>Spacing After Name (cqw)</FormLabel><FormControl><SizeStepper field={field} min={0} /></FormControl></FormItem> )}/>


              <div className="grid grid-cols-3 gap-2 items-end">
                 <FormField control={form.control} name="cert_completionText" render={({ field }) => ( <FormItem className="col-span-2"><FormLabel>Completion Text</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                 <FormField control={form.control} name="cert_completionText_size" render={({ field }) => ( <FormItem><FormLabel>Size</FormLabel><FormControl><SizeStepper field={field} /></FormControl></FormItem> )}/>
              </div>
               <FormField control={form.control} name="cert_spacing_completionText_courseName" render={({ field }) => ( <FormItem><FormLabel>Spacing After Completion Text (cqw)</FormLabel><FormControl><SizeStepper field={field} min={0} /></FormControl></FormItem> )}/>
              
              <FormField control={form.control} name="cert_courseName_size" render={({ field }) => ( <FormItem><FormLabel>Course Name Size</FormLabel><FormControl><SizeStepper field={field} /></FormControl><FormMessage /></FormItem> )}/>
              <FormField control={form.control} name="cert_spacing_courseName_signatures" render={({ field }) => ( <FormItem><FormLabel>Spacing After Course Name (cqw)</FormLabel><FormControl><SizeStepper field={field} min={0} /></FormControl></FormItem> )}/>

              <Separator />
              <h4 className="font-semibold text-lg border-b pb-2">Footer Section</h4>
              <div className="grid grid-cols-3 gap-2 items-end">
                <FormField control={form.control} name="cert_signatureName" render={({ field }) => ( <FormItem className="col-span-2"><FormLabel>Signature Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                <FormField control={form.control} name="cert_signatureName_size" render={({ field }) => ( <FormItem><FormLabel>Size</FormLabel><FormControl><SizeStepper field={field} /></FormControl></FormItem> )}/>
              </div>

              <div className="grid grid-cols-3 gap-2 items-end">
                <FormField control={form.control} name="cert_signatureTitle" render={({ field }) => ( <FormItem className="col-span-2"><FormLabel>Signature Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                <FormField control={form.control} name="cert_signatureTitle_size" render={({ field }) => ( <FormItem><FormLabel>Size</FormLabel><FormControl><SizeStepper field={field} /></FormControl></FormItem> )}/>
              </div>
              <FormField control={form.control} name="cert_date_size" render={({ field }) => ( <FormItem><FormLabel>Date Text Size</FormLabel><FormControl><SizeStepper field={field} /></FormControl><FormMessage /></FormItem> )}/>

               <Separator />
               <h4 className="font-semibold text-lg border-b pb-2">Default Assets</h4>
               <div className="space-y-2">
                  <Label>Default Background</Label>
                  <div className='flex items-center gap-2 mt-2'>
                    <div className="w-32 h-20 border rounded-md flex items-center justify-center bg-muted overflow-hidden">
                        {watchedValues.cert_defaultBackgroundUrl && <Image src={watchedValues.cert_defaultBackgroundUrl} alt="Cert BG" width={128} height={80} className='object-cover' />}
                    </div>
                    <Button type="button" variant="outline" onClick={() => setIsCertLibraryOpen(true)}>Select Background</Button>
                  </div>
              </div>
              <div className="space-y-2">
                  <Label>Default Logo</Label>
                  <div className='flex items-center gap-2 mt-2'>
                      <div className="w-20 h-20 border rounded-md flex items-center justify-center bg-muted">
                          {watchedValues.cert_defaultLogoUrl && <Image src={watchedValues.cert_defaultLogoUrl} alt="Logo" width={80} height={80} className='object-contain' />}
                      </div>
                      <Button type="button" variant="outline" onClick={() => setIsLogoLibraryOpen(true)}>Select Logo</Button>
                  </div>
              </div>

              <Button type="submit" disabled={form.formState.isSubmitting}>
                <Save className="mr-2 h-4 w-4" />
                Save Settings
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live Preview</CardTitle>
          <CardDescription>
            This is how your certificate will look with the current settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg" style={{ containerType: 'inline-size' }}>
                 <Certificate
                    userName="Student Name"
                    courseName="Example Course Title"
                    completionDate={new Date().toISOString()}
                    settingsOverride={watchedValues}
                  />
            </div>
        </CardContent>
      </Card>

      <Dialog open={isLogoLibraryOpen} onOpenChange={setIsLogoLibraryOpen}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
          <DialogHeader>
              <DialogTitle>Logo Library</DialogTitle>
          </DialogHeader>
          <LogoLibrary 
            onSelectLogo={handleSelectLogo}
            selectedLogoUrl={watchedValues.cert_defaultLogoUrl}
          />
        </DialogContent>
      </Dialog>
      
      <Dialog open={isCertLibraryOpen} onOpenChange={setIsCertLibraryOpen}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
           <DialogHeader>
              <DialogTitle>Certificate Background Library</DialogTitle>
            </DialogHeader>
          <CertificateBackgroundLibrary 
            onSelectCertificate={handleSelectCertificate}
            selectedCertificateUrl={watchedValues.cert_defaultBackgroundUrl}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
