

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
import { Loader2, AlertTriangle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Ladder } from "@/lib/types";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";


interface StoredItem {
    id: string;
    name: string;
    status?: string;
}

interface Campus {
    id: string;
    "Campus Name": string;
}

const settingsSchema = z.object({
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  photoFile: z.any().optional(),
  bio: z.string().max(200, "Bio cannot be more than 200 characters.").optional(),
  phoneNumber: z.string().min(1, "Phone number is required."),
  hpNumber: z.string().min(1, "HP Number is required."),
  facilitatorName: z.string().min(1, "Facilitator's Full Name is required."),
  campus: z.string().min(1, "Campus is required."),
  maritalStatus: z.string().optional(),
  ministry: z.string().optional(),
  language: z.string().min(1, "Language is required."),
  charge: z.string().min(1, "Charge is required."),
  role: z.string(), // Not user-editable, but needed for form state
  classLadderId: z.string().min(1, "Class Ladder is required."),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
  const { user, refreshUser, isProfileComplete } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const db = getFirebaseFirestore();
  const storage = getFirebaseStorage();
  
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [maritalStatuses, setMaritalStatuses] = useState<StoredItem[]>([]);
  const [ministries, setMinistries] = useState<StoredItem[]>([]);
  const [availableLanguages, setAvailableLanguages] = useState<StoredItem[]>([]);
  const [ladders, setLadders] = useState<Ladder[]>([]);
  const [charges, setCharges] = useState<StoredItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
        firstName: "",
        lastName: "",
        bio: "",
        phoneNumber: "",
        hpNumber: "",
        facilitatorName: "",
        campus: "",
        maritalStatus: "",
        ministry: "",
        language: "",
        charge: "",
        role: "user",
        classLadderId: "",
    },
  });

   useEffect(() => {
    async function fetchAllData() {
        setDataLoading(true);
        try {
            const [
                campusesData,
                maritalStatusesData,
                ministriesData,
                languagesData,
                laddersData,
                chargesData,
            ] = await Promise.all([
                getDocs(query(collection(db, 'Campus'), orderBy('Campus Name'))),
                getDocs(query(collection(db, 'maritalStatuses'), orderBy('name'))),
                getDocs(query(collection(db, 'ministries'), orderBy('name'))),
                getDocs(query(collection(db, 'languages'), orderBy('name'))),
                getDocs(query(collection(db, 'courseLevels'), orderBy('order'))),
                getDocs(query(collection(db, 'charges'), orderBy('name'))),
            ]);

            setCampuses(campusesData.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campus)));
            setMaritalStatuses(maritalStatusesData.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredItem)));
            setMinistries(ministriesData.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredItem)));
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
            hpNumber: user.hpNumber || "",
            facilitatorName: user.facilitatorName || "",
            campus: user.campus || "",
            maritalStatus: user.maritalStatus || "",
            ministry: user.ministry || "",
            language: user.language || "",
            charge: user.charge || "",
            role: user.role || "user",
            classLadderId: user.classLadderId || "",
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
      await updateDoc(userDocRef, {
        firstName: data.firstName,
        lastName: data.lastName,
        fullName: fullName,
        displayName: fullName,
        photoURL: photoURL,
        bio: data.bio,
        phoneNumber: data.phoneNumber,
        hpNumber: data.hpNumber,
        facilitatorName: data.facilitatorName,
        campus: data.campus,
        maritalStatus: data.maritalStatus,
        ministry: data.ministry,
        language: data.language,
        charge: data.charge,
        classLadderId: data.classLadderId,
        classLadder: selectedLadder ? selectedLadder.name : '',
      });

      await refreshUser();
      toast({
        title: "Profile Updated",
        description: "Your settings have been successfully updated.",
      });
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
          {!isProfileComplete && (
            <Alert variant="destructive" className="mb-6">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Profile Incomplete</AlertTitle>
                <AlertDescription>
                    Please complete all required fields (marked with <span className="text-destructive">*</span>) to access all platform features.
                </AlertDescription>
            </Alert>
          )}
          {user && (
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
                 <div className="space-y-2 md:col-span-2">
                    <Label>Email</Label>
                    <Input value={user.email || ""} disabled />
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
                 <div className="space-y-2">
                    <Label htmlFor="phoneNumber">Phone Number <span className="text-destructive">*</span></Label>
                    <Input id="phoneNumber" {...register("phoneNumber")} />
                    {errors.phoneNumber && <p className="text-sm text-destructive">{errors.phoneNumber.message}</p>}
                 </div>
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
                    <Label>Class Ladder <span className="text-destructive">*</span></Label>
                    <Input value={ladders.find(l => l.id === user.classLadderId)?.name || 'Not Assigned'} disabled />
                </div>
                 <div className="space-y-2">
                    <Label>Charge <span className="text-destructive">*</span></Label>
                     <Input value={user.charge || 'Not Assigned'} disabled />
                </div>
                <div className="space-y-2">
                    <Label>Marital Status</Label>
                     <Controller
                        control={control}
                        name="maritalStatus"
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select marital status" />
                                </SelectTrigger>
                                <SelectContent>
                                    {maritalStatuses.map(status => (
                                        <SelectItem key={status.id} value={status.name}>{status.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Ministry</Label>
                     <Controller
                        control={control}
                        name="ministry"
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select your ministry" />
                                </SelectTrigger>
                                <SelectContent>
                                    {ministries.map(ministry => (
                                        <SelectItem key={ministry.id} value={ministry.name}>{ministry.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                </div>
                 <div className="space-y-2">
                    <Label>Role</Label>
                    <Input value={user.role || "user"} disabled className="capitalize"/>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Profile Bio</Label>
                <Textarea id="bio" {...register("bio")} placeholder="Tell us a little about yourself..." />
                {errors.bio && <p className="text-sm text-destructive">{errors.bio.message}</p>}
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
