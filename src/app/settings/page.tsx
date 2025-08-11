
"use client";

import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getFirebaseFirestore, getFirebaseStorage } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

const settingsSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters."),
  photoFile: z.any().optional(),
  bio: z.string().max(200, "Bio cannot be more than 200 characters.").optional(),
  phoneNumber: z.string().optional(),
  hpNumber: z.string().optional(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const db = getFirebaseFirestore();
  const storage = getFirebaseStorage();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      fullName: user?.fullName || user?.displayName || "",
      bio: user?.bio || "",
      phoneNumber: user?.phoneNumber || "",
      hpNumber: user?.hpNumber || "",
    },
  });

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

      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        fullName: data.fullName,
        displayName: data.fullName,
        photoURL: photoURL,
        bio: data.bio,
        phoneNumber: data.phoneNumber,
        hpNumber: data.hpNumber,
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
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input id="fullName" {...register("fullName")} />
                    {errors.fullName && (
                    <p className="text-sm text-destructive">{errors.fullName.message}</p>
                    )}
                </div>
                 <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={user.email || ""} disabled />
                 </div>
                 <div className="space-y-2">
                    <Label htmlFor="phoneNumber">Phone Number</Label>
                    <Input id="phoneNumber" {...register("phoneNumber")} />
                    {errors.phoneNumber && (
                        <p className="text-sm text-destructive">{errors.phoneNumber.message}</p>
                    )}
                 </div>
                 <div className="space-y-2">
                    <Label htmlFor="hpNumber">HP Number</Label>
                    <Input id="hpNumber" {...register("hpNumber")} />
                    {errors.hpNumber && (
                        <p className="text-sm text-destructive">{errors.hpNumber.message}</p>
                    )}
                </div>
                <div className="space-y-2">
                    <Label>Campus</Label>
                    <Input value={user.campus || "Not specified"} disabled />
                </div>
                <div className="space-y-2">
                    <Label>Class Ladder</Label>
                    <Input value={user.classLadder || "Not specified"} disabled />
                </div>
                 <div className="space-y-2">
                    <Label>Marital Status</Label>
                    <Input value={user.maritalStatus || "Not specified"} disabled />
                </div>
                <div className="space-y-2">
                    <Label>Ministry</Label>
                    <Input value={user.ministry || "Not specified"} disabled />
                </div>
                 <div className="space-y-2">
                    <Label>Charge</Label>
                    <Input value={user.charge || "Not specified"} disabled />
                </div>
                 <div className="space-y-2">
                    <Label>Role</Label>
                    <Input value={user.role || "user"} disabled className="capitalize"/>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Profile Bio</Label>
                <Textarea id="bio" {...register("bio")} placeholder="Tell us a little about yourself..." />
                {errors.bio && (
                    <p className="text-sm text-destructive">{errors.bio.message}</p>
                )}
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
