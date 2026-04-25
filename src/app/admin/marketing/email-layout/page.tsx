
"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Image as ImageIcon, Eye, X } from "lucide-react";
import LogoLibrary from "@/components/logo-library";
import { wrapInEmailLayout } from "@/lib/email-utils";
import Image from "next/image";
import type { EmailLayoutSettings } from "@/lib/types";

const layoutSchema = z.object({
    headerGradientStart: z.string().min(4),
    headerGradientEnd: z.string().min(4),
    headerLogoUrl: z.string().url(),
    headerTitle: z.string().min(1),
    headerSlogan: z.string().min(1),
    footerText: z.string().min(1),
    buttonColor: z.string().min(4),
    buttonTextColor: z.string().min(4),
    bodyBgColor: z.string().min(4),
    cardBgColor: z.string().min(4),
    preHeaderText: z.string().optional(),
    buttonText: z.string().min(1),
    buttonUrl: z.string().url(),
});

type LayoutFormValues = z.infer<typeof layoutSchema>;

export default function EmailLayoutPage() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isLogoPickerOpen, setIsLogoPickerOpen] = useState(false);

    const form = useForm<LayoutFormValues>({
        resolver: zodResolver(layoutSchema),
        defaultValues: {
            headerGradientStart: "#004d40",
            headerGradientEnd: "#00897b",
            headerLogoUrl: "https://firebasestorage.googleapis.com/v0/b/edustream-5t6z4.appspot.com/o/site%2Flogo.png?alt=media",
            headerTitle: "Glory Training Hub",
            headerSlogan: "Forming Solid disciples for Christ",
            footerText: "© 2024 Tabernacle of Glory. All rights reserved.",
            buttonColor: "#00897b",
            buttonTextColor: "#ffffff",
            bodyBgColor: "#f4f4f4",
            cardBgColor: "#ffffff",
            preHeaderText: "ENGLISH VERSION",
            buttonText: "Continue Courses",
            buttonUrl: "https://gloryhub.net/dashboard",
        }
    });

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const docSnap = await getDoc(doc(db, "siteSettings", "emailLayout"));
                if (docSnap.exists()) {
                    form.reset(docSnap.data() as LayoutFormValues);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, [db, form]);

    const onSubmit = async (values: LayoutFormValues) => {
        setIsSaving(true);
        try {
            await setDoc(doc(db, "siteSettings", "emailLayout"), values);
            toast({ title: "Email Layout Saved" });
        } catch (error) {
            toast({ variant: "destructive", title: "Save Failed" });
        } finally {
            setIsSaving(false);
        }
    };

    const watchedValues = form.watch();
    const previewHtml = wrapInEmailLayout(
        `<p>Hello <strong>Student Name</strong>,</p><p>This is a preview of how your email content will look inside the white-labeled template.</p><p>Keep up the great work in your spiritual journey!</p>`,
        watchedValues as EmailLayoutSettings,
        watchedValues.buttonText,
        watchedValues.buttonUrl
    );

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8" /></div>;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Email Layout Builder</h1>
                    <p className="text-muted-foreground">Customize the global whitelabel template for all outbound emails.</p>
                </div>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <Card>
                        <CardHeader><CardTitle>Header & Branding</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Gradient Start</Label>
                                    <div className="flex gap-2">
                                        <input type="color" {...form.register('headerGradientStart')} className="w-12 h-10 p-1 rounded border" />
                                        <Input {...form.register('headerGradientStart')} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Gradient End</Label>
                                    <div className="flex gap-2">
                                        <input type="color" {...form.register('headerGradientEnd')} className="w-12 h-10 p-1 rounded border" />
                                        <Input {...form.register('headerGradientEnd')} />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Header Logo</Label>
                                <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/20">
                                    <div className="relative h-12 w-12 bg-white rounded border flex items-center justify-center overflow-hidden">
                                        <Image src={watchedValues.headerLogoUrl} alt="Logo" fill className="object-contain p-1" />
                                    </div>
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => setIsLogoPickerOpen(!isLogoPickerOpen)}
                                    >
                                        {isLogoPickerOpen ? <><X className="mr-2 h-4 w-4" /> Close Library</> : <><ImageIcon className="mr-2 h-4 w-4" /> Change Logo</>}
                                    </Button>
                                </div>
                                {isLogoPickerOpen && (
                                    <div className="border rounded-lg mt-2 overflow-hidden h-[300px] flex flex-col bg-background shadow-inner">
                                        <LogoLibrary 
                                            onSelectLogo={(l) => { 
                                                form.setValue('headerLogoUrl', l.url, { shouldDirty: true }); 
                                                setIsLogoPickerOpen(false); 
                                            }} 
                                            selectedLogoUrl={watchedValues.headerLogoUrl} 
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label>Title</Label>
                                <Input {...form.register('headerTitle')} />
                            </div>
                            <div className="space-y-2">
                                <Label>Slogan</Label>
                                <Input {...form.register('headerSlogan')} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Colors & Typography</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Body Background</Label>
                                    <div className="flex gap-2">
                                        <input type="color" {...form.register('bodyBgColor')} className="w-12 h-10 p-1 rounded border" />
                                        <Input {...form.register('bodyBgColor')} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Card Background</Label>
                                    <div className="flex gap-2">
                                        <input type="color" {...form.register('cardBgColor')} className="w-12 h-10 p-1 rounded border" />
                                        <Input {...form.register('cardBgColor')} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Button Color</Label>
                                    <div className="flex gap-2">
                                        <input type="color" {...form.register('buttonColor')} className="w-12 h-10 p-1 rounded border" />
                                        <Input {...form.register('buttonColor')} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Button Text Color</Label>
                                    <div className="flex gap-2">
                                        <input type="color" {...form.register('buttonTextColor')} className="w-12 h-10 p-1 rounded border" />
                                        <Input {...form.register('buttonTextColor')} />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Call to Action Button</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Button Text</Label>
                                <Input {...form.register('buttonText')} placeholder="e.g., Continue Courses" />
                            </div>
                            <div className="space-y-2">
                                <Label>Button Link (Absolute URL)</Label>
                                <Input {...form.register('buttonUrl')} placeholder="https://..." />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Content & Footer</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Pre-header Version Text (Optional)</Label>
                                <Input {...form.register('preHeaderText')} placeholder="e.g., ENGLISH VERSION" />
                            </div>
                            <div className="space-y-2">
                                <Label>Footer Text</Label>
                                <Input {...form.register('footerText')} />
                            </div>
                        </CardContent>
                        <CardFooter className="border-t pt-6">
                            <Button type="submit" disabled={isSaving} className="w-full">
                                {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                Save Email Settings
                            </Button>
                        </CardFooter>
                    </Card>
                </form>
            </div>

            <div className="sticky top-24">
                <Card className="overflow-hidden border-2 border-primary/20">
                    <CardHeader className="bg-primary/5 border-b py-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Eye className="h-4 w-4" /> Live Desktop Preview
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <iframe
                            srcDoc={previewHtml}
                            className="w-full h-[700px] border-0"
                            title="Email Preview"
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
