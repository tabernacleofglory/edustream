
"use client";

import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useForm, SubmitHandler, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getFirebaseFirestore, getFirebaseStorage } from "@/lib/firebase";
import { collection, doc, getDocs, query, updateDoc, orderBy, where, onSnapshot } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback } from "react";
import { Loader2, UserCheck, Trophy } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Ladder, User as AppUser, UserBadge } from "@/lib/types";
import { useRouter } from "next/navigation";
import LanguageSwitcher from "@/components/language-switcher";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import Image from "next/image";
import { format } from "date-fns";
import { useProcessedCourses, CourseWithStatus } from "@/hooks/useProcessedCourses";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/hooks/use-i18n";
import allLanguagesList from "@/lib/languages.json";


interface StoredItem {
    id: string;
    name: string;
    status?: string;
}

interface Campus {
    id: string;
    "Campus Name": string;
}

const settingsSchema = z.discriminatedUnion("isInHpGroup", [
    z.object({
        isInHpGroup: z.literal(true),
        firstName: z.string().min(1, "First name is required."),
        lastName: z.string().min(1, "Last name is required."),
        photoFile: z.any().optional(),
        gender: z.string().min(1, "Gender is required."),
        ageRange: z.string().min(1, "Age range is required."),
        bio: z.string().max(200, "Bio cannot be more than 200 characters.").optional(),
        phoneNumber: z.string().optional(),
        hpNumber: z.string().min(1, "HP Number is required."),
        facilitatorName: z.string().optional(),
        isBaptized: z.enum(['true', 'false']).optional(),
        denomination: z.string().optional(),
        campus: z.string().min(1, "Campus is required."),
        language: z.string().min(1, "Language is required."),
        locationPreference: z.enum(['Onsite', 'Online'], { required_error: "Please select your location preference."}),
        charge: z.string().optional(),
        role: z.string(),
        classLadderId: z.string().optional(),
        side: z.string().optional(),
    }),
    z.object({
        isInHpGroup: z.literal(false),
        firstName: z.string().min(1, "First name is required."),
        lastName: z.string().min(1, "Last name is required."),
        photoFile: z.any().optional(),
        gender: z.string().min(1, "Gender is required."),
        ageRange: z.string().min(1, "Age range is required."),
        bio: z.string().max(200, "Bio cannot be more than 200 characters.").optional(),
        phoneNumber: z.string().optional(),
        campus: z.string().min(1, "Campus is required."),
        language: z.string().min(1, "Language is required."),
        locationPreference: z.enum(['Onsite', 'Online'], { required_error: "Please select your location preference."}),
        hpAvailabilityDay: z.string().min(1, "Please select an availability day."),
        hpAvailabilityTime: z.string().min(1, "Please enter an availability time."),
        isBaptized: z.enum(['true', 'false']).optional(),
        denomination: z.string().optional(),
        hpNumber: z.string().optional(),
        facilitatorName: z.string().optional(),
        charge: z.string().optional(),
        role: z.string(),
        classLadderId: z.string().optional(),
        side: z.string().optional(),
    })
]);


type SettingsFormValues = z.infer<typeof settingsSchema>;

const cleanNativeName = (name: string) => {
    if (!name) return "";
    const firstPart = name.split(/[;,]/)[0].trim();
    return firstPart.charAt(0).toUpperCase() + firstPart.slice(1);
};

const AchievementsTab = ({ userId }: { userId: string }) => {
    const { processedCourses, loading } = useProcessedCourses();
    const { user } = useAuth();
    
    const completedCourses = processedCourses.filter(c => 
        c.isCompleted && c.language === user?.language
    );

    if (loading) {
        return (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex flex-col items-center text-center">
                        <Skeleton className="h-24 w-24 rounded-md" />
                        <Skeleton className="h-4 w-20 mt-2" />
                        <Skeleton className="h-3 w-16 mt-1" />
                    </div>
                ))}
            </div>
        );
    }

    if (completedCourses.length === 0) {
        return (
            <div className="text-center p-8 text-muted-foreground">
                <Trophy className="mx-auto h-12 w-12" />
                <p className="mt-4">No achievements yet. Complete courses to earn trophies!</p>
            </div>
        );
    }
    
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {completedCourses.map(course => (
                <div key={course.id} className="flex flex-col items-center text-center p-2 rounded-lg hover:bg-muted/50">
                    <Trophy className="h-24 w-24 text-yellow-500 fill-yellow-400" />
                    <p className="font-semibold text-sm line-clamp-2 mt-2">{course.title}</p>
                    {course.completedAt && <p className="text-xs text-muted-foreground">{format(new Date(course.completedAt), 'PPP')}</p>}
                </div>
            ))}
        </div>
    );
};


export default function SettingsPage() {
  const { user, refreshUser, isProfileComplete } = useAuth();
  const { t } = useI18n();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const db = getFirebaseFirestore();
  const storage = getFirebaseStorage();
  const router = useRouter();
  
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [availableLanguages, setAvailableLanguages] = useState<StoredItem[]>([]);
  const [ladders, setLadders] = useState<Ladder[]>([]);
  const [charges, setCharges] = useState<StoredItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [showProfileForm, setShowProfileForm] = useState(true);

   useEffect(() => {
    if (user && user.isInHpGroup === false && isProfileComplete === false) {
        setShowProfileForm(false);
    } else {
        setShowProfileForm(true);
    }
  }, [user, isProfileComplete]);


  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
        firstName: "",
        lastName: "",
        bio: "",
        phoneNumber: undefined,
        isInHpGroup: false,
        hpNumber: "",
        facilitatorName: "",
        hpAvailabilityDay: "",
        hpAvailabilityTime: "",
        isBaptized: undefined,
        denomination: "",
        campus: "",
        language: "",
        locationPreference: undefined,
        charge: "",
        role: "user",
        classLadderId: "",
        side: "hp",
        gender: "",
        ageRange: "",
    },
  });
  
  const isInHpGroup = watch("isInHpGroup");
  const isBaptized = watch("isBaptized");
  
   useEffect(() => {
    if (isBaptized === 'false') {
        setValue('denomination', 'Other');
    }
  }, [isBaptized, setValue]);
  
  useEffect(() => {
    if (isInHpGroup === true) {
        setValue('hpAvailabilityDay', undefined, { shouldValidate: true });
        setValue('hpAvailabilityTime', undefined, { shouldValidate: true });
    } else if (isInHpGroup === false) {
        setValue('hpNumber', undefined, { shouldValidate: true });
        setValue('facilitatorName', undefined, { shouldValidate: true });
        setValue('bio', undefined, { shouldValidate: true });
        setValue('charge', undefined, { shouldValidate: true });
    }
  }, [isInHpGroup, setValue]);

   useEffect(() => {
    async function fetchAllData() {
        setDataLoading(true);
        try {
            const [
                campusesData,
                languagesData,
                laddersData,
                chargesData,
            ] = await Promise.all([
                getDocs(query(collection(db, 'Campus'), orderBy('Campus Name'))),
                getDocs(query(collection(db, 'languages'), where('status', '==', 'published'), orderBy('name'))),
                getDocs(query(collection(db, 'courseLevels'), orderBy('order'))),
                getDocs(query(collection(db, 'charges'), orderBy('name'))),
            ]);

            setCampuses(campusesData.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campus)));
            setAvailableLanguages(languagesData.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredItem)));
            setLadders(laddersData.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ladder)));
            setCharges(chargesData.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredItem)));

        } catch (error) {
            toast({ variant: 'destructive', title: 'Failed to load page data.' });
            console.error("Failed to fetch settings options:", error);
        } finally {
            setDataLoading(false);
        }
    }
    fetchAllData();
  }, [db, toast]);

  useEffect(() => {
    if (user && !dataLoading) {
        reset({
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            bio: user.bio || "",
            phoneNumber: user.phoneNumber || undefined,
            isInHpGroup: user.isInHpGroup || false,
            hpNumber: user.hpNumber || "",
            isBaptized: user.isBaptized !== undefined ? String(user.isBaptized) as 'true' | 'false' : undefined,
            denomination: user.denomination || "",
            hpAvailabilityDay: user.hpAvailabilityDay || "",
            hpAvailabilityTime: user.hpAvailabilityTime || "",
            campus: user.campus || "",
            language: user.language || "",
            locationPreference: user.locationPreference,
            charge: user.charge || "",
            role: user.role || "user",
            classLadderId: user.classLadderId || "",
            side: user.side || "hp",
            gender: user.gender || "",
            ageRange: user.ageRange || "",
            facilitatorName: user.facilitatorName || '',
        });
    }
  }, [user, dataLoading, reset]);

  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    const names = name.split(" ");
    return names.map(n => n[0]).join("").toUpperCase();
  };

  const onSubmit: SubmitHandler<SettingsFormValues> = async (data) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      let photoURL = user.photoURL;
      if (data.photoFile && data.photoFile.length > 0) {
        const file = data.photoFile[0];
        const storageRef = ref(storage, `avatars/${user.uid}`);
        await uploadBytes(storageRef, file);
        photoURL = await getDownloadURL(storageRef);
      }
      
      const fullName = `${data.firstName} ${data.lastName}`.trim();
      const selectedLadder = ladders.find(l => l.id === data.classLadderId);

      const userDocRef = doc(db, "users", user.uid);
      
      const dataToUpdate: { [key: string]: any } = {
        firstName: data.firstName,
        lastName: data.lastName,
        fullName: fullName,
        displayName: fullName,
        photoURL: photoURL,
        gender: data.gender,
        ageRange: data.ageRange,
        isInHpGroup: data.isInHpGroup,
        phoneNumber: data.phoneNumber,
        campus: data.campus,
        language: data.language,
        locationPreference: data.locationPreference,
        isBaptized: data.isBaptized === 'true',
        denomination: data.isBaptized === 'false' ? 'Other' : data.denomination || 'Other',
        side: data.side,
        
        hpNumber: data.isInHpGroup ? data.hpNumber : null,
        facilitatorName: data.isInHpGroup ? (data as any).facilitatorName : null,
        bio: data.isInHpGroup ? data.bio : null,
        charge: data.isInHpGroup ? data.charge : null,
        classLadderId: data.isInHpGroup ? data.classLadderId : user.classLadderId,
        classLadder: data.isInHpGroup ? (selectedLadder ? selectedLadder.name : '') : user.classLadder,
        hpAvailabilityDay: !data.isInHpGroup ? data.hpAvailabilityDay : null,
        hpAvailabilityTime: !data.isInHpGroup ? data.hpAvailabilityTime : null,
      };

      for (const key in dataToUpdate) {
        if (dataToUpdate[key] === undefined) {
          dataToUpdate[key] = null;
        }
      }

      await updateDoc(userDocRef, dataToUpdate);

      await refreshUser();
      
      if (!data.isInHpGroup) {
          toast({
              title: t('settings.hp_followup.title', "Information Received!"),
              description: t('settings.hp_followup.description', "Thank you for filling out the form. We will follow up with you shortly to integrate you into a Prayer Group (HP) so you can start your classes."),
              duration: 10000,
          });
          setShowProfileForm(false);
      } else {
         toast({
            title: t('settings.button.save', "Profile Updated"),
            description: "Your settings have been successfully updated.",
        });
        router.push('/dashboard');
      }

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "There was a problem updating your profile.",
      });
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>{t('nav.settings', 'Settings')}</CardTitle>
          <CardDescription>
            Manage your personal information, achievements, and account settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <Tabs defaultValue="profile">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="profile">{t('settings.tabs.profile', 'Profile')}</TabsTrigger>
                    <TabsTrigger value="achievements">{t('settings.tabs.achievements', 'My Achievements')}</TabsTrigger>
                </TabsList>
                <TabsContent value="profile">
                    {!showProfileForm ? (
                        <div className="text-center p-8 border-2 border-dashed rounded-lg">
                            <h3 className="text-lg font-semibold">{t('settings.hp_followup.title', 'Thank You!')}</h3>
                            <p className="text-muted-foreground mt-2">
                                {t('settings.hp_followup.description', "We have received your information. Someone from our team will reach out to place you in a prayer group (HP). Once you have your HP number, please come back to complete your profile.")}
                            </p>
                            <Button className="mt-4" onClick={() => setShowProfileForm(true)}>
                                {t('settings.hp_followup.button', 'Complete Profile Now')}
                            </Button>
                        </div>
                    ) : user && (
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <div className="flex items-center space-x-4">
                            <Avatar className="h-20 w-20">
                            <AvatarImage src={user.photoURL || undefined} />
                            <AvatarFallback className="text-3xl">{getInitials(user.displayName)}</AvatarFallback>
                            </Avatar>
                            <div className="space-y-2 flex-1">
                                <Label htmlFor="photoFile">{t('settings.labels.update_photo', 'Update Profile Picture')}</Label>
                                <Input id="photoFile" type="file" {...register("photoFile")} />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="firstName">{t('settings.labels.first_name', 'First Name')} <span className="text-destructive">*</span></Label>
                                <Input id="firstName" {...register("firstName")} />
                                {errors.firstName && <p className="text-sm text-destructive">{errors.firstName.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lastName">{t('settings.labels.last_name', 'Last Name')} <span className="text-destructive">*</span></Label>
                                <Input id="lastName" {...register("lastName")} />
                                {errors.lastName && <p className="text-sm text-destructive">{errors.lastName.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label>Email</Label>
                                <Input value={user.email || ""} disabled />
                            </div>
                            <div className="space-y-2">
                                <Label>{t('settings.labels.gender', 'Gender')} <span className="text-destructive">*</span></Label>
                                <Controller
                                    name="gender"
                                    control={control}
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Male">{t('common.gender.male', 'Male')}</SelectItem>
                                                <SelectItem value="Female">{t('common.gender.female', 'Female')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                {errors.gender && <p className="text-sm text-destructive">{errors.gender.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label>{t('settings.labels.age_range', 'Age Range')} <span className="text-destructive">*</span></Label>
                                <Controller
                                    name="ageRange"
                                    control={control}
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger><SelectValue placeholder="Select age range" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Less than 13">Less than 13</SelectItem>
                                                <SelectItem value="13-17">13-17</SelectItem>
                                                <SelectItem value="18-24">18-24</SelectItem>
                                                <SelectItem value="25-34">25-34</SelectItem>
                                                <SelectItem value="35-44">35-44</SelectItem>
                                                <SelectItem value="45-54">45-54</SelectItem>
                                                <SelectItem value="55-64">55-64</SelectItem>
                                                <SelectItem value="65+">65+</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                {errors.ageRange && <p className="text-sm text-destructive">{errors.ageRange.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phoneNumber">{t('settings.labels.phone', 'Phone Number')}</Label>
                                <Input id="phoneNumber" type="tel" {...register("phoneNumber")} />
                                {errors.phoneNumber && <p className="text-sm text-destructive">{errors.phoneNumber.message}</p>}
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <Label>{t('settings.labels.in_hp', 'Are you in a Prayer Group (HP)?')} <span className="text-destructive">*</span></Label>
                                <Controller
                                    name="isInHpGroup"
                                    control={control}
                                    render={({ field }) => (
                                        <div className="flex gap-2">
                                            <Button
                                                type="button"
                                                variant={field.value === true ? 'default' : 'outline'}
                                                onClick={() => field.onChange(true)}
                                                className="w-full"
                                            >
                                                {t('common.yes', 'Yes')}
                                            </Button>
                                            <Button
                                                type="button"
                                                variant={field.value === false ? 'default' : 'outline'}
                                                onClick={() => field.onChange(false)}
                                                className="w-full"
                                            >
                                                {t('common.no', 'No')}
                                            </Button>
                                        </div>
                                    )}
                                />
                            </div>

                            {isInHpGroup ? (
                                <div className="space-y-2">
                                    <Label htmlFor="hpNumber">{t('settings.labels.hp_number', 'HP Number')} <span className="text-destructive">*</span></Label>
                                    <Input id="hpNumber" {...register("hpNumber")} />
                                    {errors.hpNumber && <p className="text-sm text-destructive">{errors.hpNumber.message}</p>}
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="hpAvailabilityDay">{t('settings.labels.hp_day', 'HP Availability Day')} <span className="text-destructive">*</span></Label>
                                        <Controller
                                            name="hpAvailabilityDay"
                                            control={control}
                                            render={({ field }) => (
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select a day" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Monday">Monday</SelectItem>
                                                        <SelectItem value="Tuesday">Tuesday</SelectItem>
                                                        <SelectItem value="Wednesday">Wednesday</SelectItem>
                                                        <SelectItem value="Thursday">Thursday</SelectItem>
                                                        <SelectItem value="Friday">Friday</SelectItem>
                                                        <SelectItem value="Saturday">Saturday</SelectItem>
                                                        <SelectItem value="Sunday">Sunday</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                        {errors.hpAvailabilityDay && <p className="text-sm text-destructive">{errors.hpAvailabilityDay.message}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="hpAvailabilityTime">{t('settings.labels.hp_time', 'HP Availability Time')} <span className="text-destructive">*</span></Label>
                                        <Input id="hpAvailabilityTime" type="time" {...register("hpAvailabilityTime")} />
                                        {errors.hpAvailabilityTime && <p className="text-sm text-destructive">{errors.hpAvailabilityTime.message}</p>}
                                    </div>
                                </>
                            )}
                             <div className="space-y-2">
                                <Label>{t('settings.labels.is_baptized', 'Are you baptized?')}</Label>
                                <Controller
                                    name="isBaptized"
                                    control={control}
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger><SelectValue placeholder="Select an option" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="true">{t('common.yes', 'Yes')}</SelectItem>
                                                <SelectItem value="false">{t('common.no', 'No')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>{t('settings.labels.denomination', 'Denomination')}</Label>
                                <Controller
                                    name="denomination"
                                    control={control}
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger><SelectValue placeholder="Select denomination" /></SelectTrigger>
                                            <SelectContent>
                                                {[ "Apostolic", "Baptist", "Pentecostal", "Protestant", "Catholic", "Evangelical",
                                                    "Methodist", "Lutheran", "Presbyterian", "Anglican", "Other"
                                                ].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                {errors.denomination && <p className="text-sm text-destructive">{errors.denomination.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label>{t('settings.labels.campus', 'Campus')} <span className="text-destructive">*</span></Label>
                                <Controller
                                    control={control}
                                    name="campus"
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select your campus" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {campuses.map(campus => (
                                                    <SelectItem key={campus.id} value={campus["Campus Name"]}>{campus["Campus Name"]}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                    {errors.campus && <p className="text-sm text-destructive">{errors.campus.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label>{t('settings.labels.attending', "I'm attending")} <span className="text-destructive">*</span></Label>
                                <Controller
                                    control={control}
                                    name="locationPreference"
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select your preference" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Onsite">{t('common.location.onsite', 'Onsite')}</SelectItem>
                                                <SelectItem value="Online">{t('common.location.online', 'Online')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                {errors.locationPreference && <p className="text-sm text-destructive">{errors.locationPreference.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label>{t('settings.labels.language', 'Language')} <span className="text-destructive">*</span></Label>
                                <Controller
                                    control={control}
                                    name="language"
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select your language" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableLanguages.map(lang => {
                                                    const langInfo = allLanguagesList.find(l => l.code === lang.id);
                                                    const displayName = langInfo ? cleanNativeName(langInfo.nativeName) : lang.name;
                                                    return (
                                                        <SelectItem key={lang.id} value={lang.name}>{displayName}</SelectItem>
                                                    );
                                                })}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                {errors.language && <p className="text-sm text-destructive">{errors.language.message}</p>}
                            </div>
                            
                            {isInHpGroup ? (
                                <>
                                    <div className="space-y-2">
                                        <Label>{t('settings.labels.ladder', 'Class Ladder')}</Label>
                                        <Input value={ladders.find(l => l.id === user.classLadderId)?.name || 'Not Assigned'} disabled />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{t('settings.labels.side', 'Side')}</Label>
                                        <Controller
                                            name="side"
                                            control={control}
                                            render={({ field }) => (
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <SelectTrigger><SelectValue placeholder="Select a side" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="hp">HP</SelectItem>
                                                        <SelectItem value="ministry">Ministry</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{t('settings.labels.charge', 'Charge')}</Label>
                                        <Input value={user.charge || 'Not Assigned'} disabled />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{t('settings.labels.role', 'Role')}</Label>
                                        <Input value={user.role || "user"} disabled className="capitalize"/>
                                    </div>
                                    <div className="space-y-2 md:col-span-2">
                                        <Label htmlFor="bio">{t('settings.labels.bio', 'Profile Bio')}</Label>
                                        <Textarea id="bio" {...register("bio")} placeholder="Tell us a little about yourself..." />
                                        {errors.bio && <p className="text-sm text-destructive">{errors.bio.message}</p>}
                                    </div>
                                </>
                            ) : null}
                        </div>
                        
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => reset()}>
                                {t('settings.button.clear', 'Clear Form')}
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {t('settings.button.save', 'Save Changes')}
                            </Button>
                        </div>
                        </form>
                    )}
                </TabsContent>
                <TabsContent value="achievements">
                    {user && <AchievementsTab userId={user.uid} />}
                </TabsContent>
            </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
