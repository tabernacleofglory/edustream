
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
import { collection, doc, getDocs, query, updateDoc, orderBy, where } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback } from "react";
import { Loader2, AlertTriangle, UserCheck } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Ladder } from "@/lib/types";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useRouter } from "next/navigation";


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
        phoneNumber: z.string().min(1, "Phone number is required."),
        hpNumber: z.string().min(1, "HP Number is required."),
        facilitatorName: z.string().min(1, "Facilitator's name is required."),
        campus: z.string().min(1, "Campus is required."),
        language: z.string().min(1, "Language is required."),
        charge: z.string().optional(),
        role: z.string(),
        classLadderId: z.string().optional(),
        hpAvailabilityDay: z.string().optional(),
        hpAvailabilityTime: z.string().optional(),
    }),
    z.object({
        isInHpGroup: z.literal(false),
        firstName: z.string().min(1, "First name is required."),
        lastName: z.string().min(1, "Last name is required."),
        photoFile: z.any().optional(),
        gender: z.string().min(1, "Gender is required."),
        ageRange: z.string().min(1, "Age range is required."),
        bio: z.string().max(200, "Bio cannot be more than 200 characters.").optional(),
        phoneNumber: z.string().min(1, "Phone number is required."),
        hpNumber: z.string().optional(),
        facilitatorName: z.string().optional(),
        campus: z.string().min(1, "Campus is required."),
        language: z.string().min(1, "Language is required."),
        charge: z.string().optional(),
        role: z.string(),
        classLadderId: z.string().optional(),
        hpAvailabilityDay: z.string().min(1, "Please select an availability day."),
        hpAvailabilityTime: z.string().min(1, "Please enter an availability time."),
    })
]);


type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
  const { user, refreshUser, isProfileComplete } = useAuth();
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
    // Show form by default if profile is incomplete.
    // The "thank you" message will hide it after successful submission.
    if (!isProfileComplete) {
      setShowProfileForm(true);
    }
  }, [isProfileComplete]);


  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
    watch,
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
        firstName: "",
        lastName: "",
        bio: "",
        phoneNumber: "",
        isInHpGroup: false,
        hpNumber: "",
        facilitatorName: "",
        hpAvailabilityDay: "",
        hpAvailabilityTime: "",
        campus: "",
        language: "",
        charge: "",
        role: "user",
        classLadderId: "",
        gender: "",
        ageRange: "",
    },
  });
  
  const isInHpGroup = watch("isInHpGroup");

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
            phoneNumber: user.phoneNumber || "",
            isInHpGroup: user.isInHpGroup || false,
            hpNumber: user.hpNumber || "",
            facilitatorName: user.facilitatorName || "",
            hpAvailabilityDay: user.hpAvailabilityDay || "",
            hpAvailabilityTime: user.hpAvailabilityTime || "",
            campus: user.campus || "",
            language: user.language || "",
            charge: user.charge || "",
            role: user.role || "user",
            classLadderId: user.classLadderId || "",
            gender: user.gender || "",
            ageRange: user.ageRange || "",
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
      
      let dataToUpdate: Partial<AppUser> = {
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
      };

      if (data.isInHpGroup) {
        dataToUpdate = {
          ...dataToUpdate,
          bio: data.bio,
          hpNumber: data.hpNumber,
          facilitatorName: data.facilitatorName,
          charge: data.charge,
          classLadderId: data.classLadderId,
          classLadder: selectedLadder ? selectedLadder.name : '',
        };
      } else {
         dataToUpdate = {
          ...dataToUpdate,
          hpAvailabilityDay: data.hpAvailabilityDay,
          hpAvailabilityTime: data.hpAvailabilityTime,
        };
      }

      await updateDoc(userDocRef, dataToUpdate);

      await refreshUser();
      
      if (!data.isInHpGroup) {
          toast({
              title: "Information Received!",
              description: "Thank you for filling out the form. We will follow up with you shortly to integrate you into a Prayer Group (HP) so you can start your classes.",
              duration: 10000,
          });
          setShowProfileForm(false); // Hide form and show message after submission
      } else {
          toast({
            title: "Profile Updated",
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
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Profile Settings</CardTitle>
          <CardDescription>
            Manage your personal information and account settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showProfileForm ? (
             <div className="text-center p-6 bg-muted/50 rounded-lg">
                <UserCheck className="mx-auto h-12 w-12 text-green-500" />
                <h3 className="mt-4 text-lg font-semibold">Thank You!</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                    As you are not yet in a Prayer Group (HP), we will follow up with you shortly to integrate you into an HP so you can start taking classes.
                </p>
                <div className="mt-6 flex justify-center gap-4">
                     <Button variant="ghost" onClick={() => setShowProfileForm(true)}>Edit Submission</Button>
                </div>
            </div>
          ) : user && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="flex items-center space-x-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={user.photoURL || undefined} />
                  <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                </Avatar>
                <div className="space-y-2 flex-1">
                    <Label htmlFor="photoFile">Update Profile Picture</Label>
                    <Input id="photoFile" type="file" {...register("photoFile")} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="firstName">First Name <span className="text-destructive">*</span></Label>
                    <Input id="firstName" {...register("firstName")} />
                    {errors.firstName && <p className="text-sm text-destructive">{errors.firstName.message}</p>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name <span className="text-destructive">*</span></Label>
                    <Input id="lastName" {...register("lastName")} />
                    {errors.lastName && <p className="text-sm text-destructive">{errors.lastName.message}</p>}
                </div>
                 <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={user.email || ""} disabled />
                 </div>
                 <div className="space-y-2">
                    <Label>Gender <span className="text-destructive">*</span></Label>
                     <Controller
                        name="gender"
                        control={control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="male">Male</SelectItem>
                                    <SelectItem value="female">Female</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    />
                    {errors.gender && <p className="text-sm text-destructive">{errors.gender.message}</p>}
                 </div>
                 <div className="space-y-2">
                    <Label>Age Range <span className="text-destructive">*</span></Label>
                     <Controller
                        name="ageRange"
                        control={control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger><SelectValue placeholder="Select age range" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Less than 13">Less than 13 | Moins de 13 ans</SelectItem>
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
                    <Label htmlFor="phoneNumber">Phone Number <span className="text-destructive">*</span></Label>
                    <Input id="phoneNumber" type="tel" {...register("phoneNumber")} />
                    {errors.phoneNumber && <p className="text-sm text-destructive">{errors.phoneNumber.message}</p>}
                </div>
                 <div className="space-y-2 md:col-span-2">
                    <Label>Are you in a Prayer Group (HP)? <span className="text-destructive">*</span></Label>
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
                                    Yes
                                </Button>
                                <Button
                                    type="button"
                                    variant={field.value === false ? 'default' : 'outline'}
                                    onClick={() => field.onChange(false)}
                                    className="w-full"
                                >
                                    No
                                </Button>
                            </div>
                        )}
                    />
                </div>

                {isInHpGroup ? (
                    <>
                        <div className="space-y-2">
                            <Label htmlFor="hpNumber">HP Number <span className="text-destructive">*</span></Label>
                            <Input id="hpNumber" {...register("hpNumber")} />
                            {errors.hpNumber && <p className="text-sm text-destructive">{errors.hpNumber.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="facilitatorName">Facilitator's Full Name <span className="text-destructive">*</span></Label>
                            <Input id="facilitatorName" {...register("facilitatorName")} />
                            {errors.facilitatorName && <p className="text-sm text-destructive">{errors.facilitatorName.message}</p>}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="space-y-2">
                            <Label htmlFor="hpAvailabilityDay">HP Availability Day <span className="text-destructive">*</span></Label>
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
                            <Label htmlFor="hpAvailabilityTime">HP Availability Time <span className="text-destructive">*</span></Label>
                            <Input id="hpAvailabilityTime" type="time" {...register("hpAvailabilityTime")} />
                            {errors.hpAvailabilityTime && <p className="text-sm text-destructive">{errors.hpAvailabilityTime.message}</p>}
                        </div>
                    </>
                )}


                
                <div className="space-y-2">
                    <Label>Campus <span className="text-destructive">*</span></Label>
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
                    <Label>Language <span className="text-destructive">*</span></Label>
                    <Controller
                        control={control}
                        name="language"
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select your language" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableLanguages.map(lang => (
                                        <SelectItem key={lang.id} value={lang.name}>{lang.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                    {errors.language && <p className="text-sm text-destructive">{errors.language.message}</p>}
                </div>
                
                {isInHpGroup ? (
                    <>
                         <div className="space-y-2">
                            <Label>Class Ladder</Label>
                            <Input value={ladders.find(l => l.id === user.classLadderId)?.name || 'Not Assigned'} disabled />
                        </div>
                         <div className="space-y-2">
                            <Label>Charge</Label>
                             <Input value={user.charge || 'Not Assigned'} disabled />
                        </div>
                         <div className="space-y-2">
                            <Label>Role</Label>
                            <Input value={user.role || "user"} disabled className="capitalize"/>
                        </div>
                         <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="bio">Profile Bio</Label>
                            <Textarea id="bio" {...register("bio")} placeholder="Tell us a little about yourself..." />
                            {errors.bio && <p className="text-sm text-destructive">{errors.bio.message}</p>}
                        </div>
                    </>
                ) : null}
              </div>
              
              <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
