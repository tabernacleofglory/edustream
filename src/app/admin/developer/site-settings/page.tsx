
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import * as z from "zod";
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
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase";
import { useEffect, useState } from "react";
import { Loader2, Lock, icons, Sparkles, X } from "lucide-react";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DynamicIcon from "@/components/dynamic-icon";
import { generateKeywords } from "@/ai/flows/keyword-generator";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";


const formSchema = z.object({
    websiteName: z.string().min(2, "Website name must be at least 2 characters."),
    metaDescription: z.string().min(10, "Meta description must be at least 10 characters."),
    seoKeywords: z.array(z.string()).min(1, "Please provide at least one SEO keyword."),
    homepageTitle: z.string().min(5, "Homepage title must be at least 5 characters."),
    homepageSubtitle: z.string().min(10, "Homepage subtitle must be at least 10 characters."),
    enrollButtonText: z.string().min(1, "Enroll button text is required."),
    enrollButtonLink: z.string().min(1, "Please enter a valid URL or path."),
    exploreButtonText: z.string().min(1, "Explore button text is required."),
    exploreButtonLink: z.string().min(1, "Please enter a valid URL or path."),
    featuresTitle: z.string().min(5, "Features section title is required."),
    featuresSubtitle: z.string().min(10, "Features section subtitle is required."),
    feature1Icon: z.string().min(1, "Icon is required."),
    feature1Title: z.string().min(3, "Feature 1 title is required."),
    feature1Description: z.string().min(10, "Feature 1 description is required."),
    feature2Icon: z.string().min(1, "Icon is required."),
    feature2Title: z.string().min(3, "Feature 2 title is required."),
    feature2Description: z.string().min(10, "Feature 2 description is required."),
    feature3Icon: z.string().min(1, "Icon is required."),
    feature3Title: z.string().min(3, "Feature 3 title is required."),
    feature3Description: z.string().min(10, "Feature 3 description is required."),
    favicon: z.any(),
    homepageBackgroundImage: z.any(),
});

const ICON_NAMES = Object.keys(icons);

export default function SiteSettingsPage() {
    const { user, loading: authLoading, hasPermission } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const db = getFirebaseFirestore();
    const storage = getStorage();
    const [isLoading, setIsLoading] = useState(true);
    const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
    const [backgroundPreview, setBackgroundPreview] = useState<string | null>(null);
    const [isGeneratingKeywords, setIsGeneratingKeywords] = useState(false);
    const [keywordInput, setKeywordInput] = useState('');

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            websiteName: "",
            metaDescription: "",
            seoKeywords: [],
            homepageTitle: "",
            homepageSubtitle: "",
            enrollButtonText: "Get Started",
            enrollButtonLink: "/signup",
            exploreButtonText: "Explore Courses",
            exploreButtonLink: "/courses",
            featuresTitle: "Why Choose Us?",
            featuresSubtitle: "Everything you need for your spiritual growth.",
            feature1Icon: "BookOpen",
            feature1Title: "Expert-Led Courses",
            feature1Description: "Learn from experienced pastors and leaders on a variety of biblical topics.",
            feature2Icon: "Users",
            feature2Title: "Community",
            feature2Description: "Connect with a global community of believers and grow together.",
            feature3Icon: "Video",
            feature3Title: "On-Demand Video",
            feature3Description: "Access our extensive library of video resources anytime, anywhere.",
        },
    });
    
    const { reset, watch, setValue, control } = form;
    const currentKeywords = watch('seoKeywords');
    
    const canAccess = hasPermission('developer');

    useEffect(() => {
        const fetchSettings = async () => {
            const docRef = doc(db, "siteSettings", "main");
            try {
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    reset({ ...data, seoKeywords: Array.isArray(data.seoKeywords) ? data.seoKeywords : (data.seoKeywords ? data.seoKeywords.split(',').map((k: string) => k.trim()) : []) });
                    if (data.faviconUrl) setFaviconPreview(data.faviconUrl);
                    if (data.homepageBackgroundImageUrl) setBackgroundPreview(data.homepageBackgroundImageUrl);
                }
            } catch (error) {
                console.error("Error fetching site settings:", error);
                toast({
                    variant: "destructive",
                    title: "Could not load site settings",
                    description: "You may not have permission to view these settings.",
                });
            } finally {
                setIsLoading(false);
            }
        };

        if (authLoading) {
            return;
        }

        if (!canAccess) {
             setIsLoading(false);
        } else {
            fetchSettings();
        }
    }, [user, reset, db, toast, canAccess, authLoading, router]);

    const handleGenerateKeywords = async () => {
        setIsGeneratingKeywords(true);
        const description = form.getValues('metaDescription');
        if (!description) {
            toast({
                variant: 'destructive',
                title: 'Please enter a meta description first',
                description: 'The AI needs a description to generate keywords from.',
            });
            setIsGeneratingKeywords(false);
            return;
        }
        try {
            const result = await generateKeywords({ topic: description });
            const newKeywords = result.keywords.filter(k => !currentKeywords.includes(k));
            setValue('seoKeywords', [...currentKeywords, ...newKeywords]);
            toast({ title: 'AI Keywords Generated!' });
        } catch (error) {
            console.error('Error generating keywords:', error);
            toast({ variant: 'destructive', title: 'AI Keyword Generation Failed' });
        } finally {
            setIsGeneratingKeywords(false);
        }
    };

    const handleKeywordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const newKeyword = keywordInput.trim();
            if (newKeyword && !currentKeywords.includes(newKeyword)) {
                setValue('seoKeywords', [...currentKeywords, newKeyword]);
            }
            setKeywordInput('');
        }
    };

    const removeKeyword = (keywordToRemove: string) => {
        setValue('seoKeywords', currentKeywords.filter(k => k !== keywordToRemove));
    };


    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        if (!canAccess) {
             toast({
                variant: "destructive",
                title: "Permission Denied",
                description: "You do not have permission to save settings.",
            });
            return;
        }

        setIsLoading(true);
        try {
            let faviconUrl = faviconPreview;
            if (values.favicon && values.favicon.length > 0) {
                const file = values.favicon[0];
                const storageRef = ref(storage, `site/favicon`);
                await uploadBytes(storageRef, file);
                faviconUrl = await getDownloadURL(storageRef);
            }

            let homepageBackgroundImageUrl = backgroundPreview;
            if (values.homepageBackgroundImage && values.homepageBackgroundImage.length > 0) {
                const file = values.homepageBackgroundImage[0];
                const storageRef = ref(storage, `site/homepage-background`);
                await uploadBytes(storageRef, file);
                homepageBackgroundImageUrl = await getDownloadURL(storageRef);
            }

            const { favicon, homepageBackgroundImage, ...settingsData } = values;

            await setDoc(doc(db, "siteSettings", "main"), {
                ...settingsData,
                seoKeywords: settingsData.seoKeywords.join(','), // Store as comma-separated string
                faviconUrl,
                homepageBackgroundImageUrl,
            }, { merge: true });
            
            toast({
                title: "Settings saved!",
                description: "Your website settings have been updated.",
            });
        } catch (error) {
            console.error("Error saving settings:", error);
            toast({
                variant: "destructive",
                title: "Uh oh! Something went wrong.",
                description: "There was a problem saving your settings. Check your permissions.",
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

    if (authLoading || isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (!canAccess) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle>Access Denied</CardTitle>
                </CardHeader>
                <CardContent>
                    <Alert variant="destructive">
                        <Lock className="h-4 w-4" />
                        <AlertTitle>Developer Access Only</AlertTitle>
                        <AlertDescription>
                            This page is restricted to users with the 'developer' role.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }


    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold">Site Settings</h1>
                        <p className="text-muted-foreground">Manage your website's core settings.</p>
                    </div>
                     <Button type="submit" disabled={form.formState.isSubmitting}>
                        {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save All Settings
                    </Button>
                </div>
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    <Card className="lg:col-span-1">
                        <CardHeader>
                            <CardTitle>General Settings</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                             <FormField
                                control={form.control}
                                name="websiteName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Website Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="My Awesome Website" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="favicon"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Favicon</FormLabel>
                                        <FormControl>
                                            <Input 
                                                type="file" 
                                                accept="image/x-icon, image/png, image/svg+xml"
                                                onChange={(e) => {
                                                    const file = e.target.files ? e.target.files[0] : null;
                                                    if (file) {
                                                        field.onChange([file]);
                                                        setFaviconPreview(URL.createObjectURL(file));
                                                    }
                                                }}
                                            />
                                        </FormControl>
                                        {faviconPreview && <Image src={faviconPreview} alt="Favicon preview" className="h-8 w-8 mt-2" width={32} height={32} />}
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="metaDescription"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Meta Description</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="A short and sweet description of your website." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="seoKeywords"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>SEO Keywords</FormLabel>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                placeholder="Add a keyword and press Enter"
                                                value={keywordInput}
                                                onChange={(e) => setKeywordInput(e.target.value)}
                                                onKeyDown={handleKeywordKeyDown}
                                            />
                                            <Button type="button" variant="outline" size="icon" onClick={handleGenerateKeywords} disabled={isGeneratingKeywords}>
                                                {isGeneratingKeywords ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {field.value.map(keyword => (
                                                <Badge key={keyword} variant="secondary">
                                                    {keyword}
                                                    <button type="button" onClick={() => removeKeyword(keyword)} className="ml-1 rounded-full p-0.5 hover:bg-background/50">
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </Badge>
                                            ))}
                                        </div>
                                        <FormDescription>Keywords for search engine optimization. Press Enter or comma to add.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    <Card className="lg:col-span-1">
                        <CardHeader>
                            <CardTitle>Homepage Hero Section</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                              <FormField
                                control={form.control}
                                name="homepageBackgroundImage"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Background Image</FormLabel>
                                        <FormControl>
                                            <Input 
                                                type="file" 
                                                accept="image/png, image/jpeg, image/webp"
                                                onChange={(e) => {
                                                    const file = e.target.files ? e.target.files[0] : null;
                                                    if (file) {
                                                        field.onChange([file]);
                                                        setBackgroundPreview(URL.createObjectURL(file));
                                                    }
                                                }}
                                            />
                                        </FormControl>
                                        {backgroundPreview && <Image src={backgroundPreview} alt="Background preview" className="w-full h-auto mt-2 rounded-md" width={400} height={225} style={{objectFit: 'cover'}}/>}
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="homepageTitle"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Title</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Welcome to Learning!" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="homepageSubtitle"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Subtitle</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="Start your journey to mastery with our expert-led courses." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="enrollButtonText"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Primary Button Text</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Start Your Journey" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="enrollButtonLink"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Primary Button Link</FormLabel>
                                        <FormControl>
                                            <Input placeholder="/signup or https://..." {...field} />
                                        </FormControl>
                                        <FormDescription>Internal path or external URL.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="exploreButtonText"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Secondary Button Text</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Explore Courses" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="exploreButtonLink"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Secondary Button Link</FormLabel>
                                        <FormControl>
                                            <Input placeholder="/courses or https://..." {...field} />
                                        </FormControl>
                                        <FormDescription>Internal path or external URL.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>

                    <Card className="lg:col-span-1">
                        <CardHeader>
                            <CardTitle>Homepage Features</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <FormField
                                control={form.control}
                                name="featuresTitle"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Section Title</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Why Choose Us?" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="featuresSubtitle"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Section Subtitle</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Everything you need for your spiritual growth." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Separator />
                            <h4 className="font-semibold text-md">Feature 1</h4>
                             <FormField control={form.control} name="feature1Icon" render={({ field }) => (<FormItem><FormLabel>Icon</FormLabel><IconSelect field={field} /><FormMessage /></FormItem>)} />
                             <FormField control={form.control} name="feature1Title" render={({ field }) => (<FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                             <FormField control={form.control} name="feature1Description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />

                             <Separator />
                             <h4 className="font-semibold text-md">Feature 2</h4>
                             <FormField control={form.control} name="feature2Icon" render={({ field }) => (<FormItem><FormLabel>Icon</FormLabel><IconSelect field={field} /><FormMessage /></FormItem>)} />
                             <FormField control={form.control} name="feature2Title" render={({ field }) => (<FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                             <FormField control={form.control} name="feature2Description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />

                             <Separator />
                             <h4 className="font-semibold text-md">Feature 3</h4>
                              <FormField control={form.control} name="feature3Icon" render={({ field }) => (<FormItem><FormLabel>Icon</FormLabel><IconSelect field={field} /><FormMessage /></FormItem>)} />
                             <FormField control={form.control} name="feature3Title" render={({ field }) => (<FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                             <FormField control={form.control} name="feature3Description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </CardContent>
                    </Card>
                 </div>
            </form>
        </Form>
    );
}
