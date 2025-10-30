
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash } from "lucide-react";
import { getAuth, updateProfile } from "firebase/auth";
import { doc, updateDoc, collection, addDoc, serverTimestamp, deleteDoc, getDocs, query, orderBy, where } from "firebase/firestore";
import { getFirebaseFirestore, getFirebaseStorage } from "@/lib/firebase";
import type { User, Ladder } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Textarea } from "./ui/textarea";
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email(),
  phoneNumber: z.string().optional().or(z.literal("")).or(z.undefined()),
  hpNumber: z.string().optional(),
  facilitatorName: z.string().optional(),
  campus: z.string().optional(),
  classLadderId: z.string().optional(),
  role: z.string().optional(),
  membershipStatus: z.string().optional(),
  charge: z.string().optional(),
  gender: z.string().optional(),
  ageRange: z.string().optional(),
  maritalStatus: z.string().optional(),
  ministry: z.string().optional(),
  bio: z.string().optional(),
  isInHpGroup: z.enum(['true', 'false']),
  hpAvailabilityDay: z.string().optional(),
  hpAvailabilityTime: z.string().optional(),
  locationPreference: z.string().optional(),
  language: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface StoredItem {
    id: string;
    name: string;
}

interface Campus {
    id: string;
    "Campus Name": string;
}

interface EditUserFormProps {
    userToEdit: User;
    onUserUpdated: () => void;
}

export default function EditUserForm({ userToEdit, onUserUpdated }: EditUserFormProps) {
  const { user: currentUser, refreshUser } = useAuth();
  const { toast } = useToast();
  const auth = getAuth();
  const storage = getFirebaseStorage();
  const db = getFirebaseFirestore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [ladders, setLadders] = useState<Ladder[]>([]);
  const [roles, setRoles] = useState<StoredItem[]>([]);
  const [statuses, setStatuses] = useState<StoredItem[]>([]);
  const [charges, setCharges] = useState<StoredItem[]>([]);
  const [ministries, setMinistries] = useState<StoredItem[]>([]);
  const [availableLanguages, setAvailableLanguages] = useState<StoredItem[]>([]);
  
  const [isCampusDialogOpen, setIsCampusDialogOpen] = useState(false);
  const [newCampusName, setNewCampusName] = useState("");
  const [isChargeDialogOpen, setIsChargeDialogOpen] = useState(false);
  const [newChargeName, setNewChargeName] = useState("");
  
  const formatPhoneNumber = (phone?: string) => {
    if (!phone) return undefined;
    if (phone.startsWith('+')) return phone;
    return `+${phone}`;
  }

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors, isDirty },
    reset,
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
        firstName: userToEdit.firstName || "",
        lastName: userToEdit.lastName || "",
        email: userToEdit.email || "",
        phoneNumber: formatPhoneNumber(userToEdit.phoneNumber),
        hpNumber: userToEdit.hpNumber || "",
        facilitatorName: userToEdit.facilitatorName || "",
        campus: userToEdit.campus || "",
        classLadderId: userToEdit.classLadderId || "",
        role: userToEdit.role || "user",
        membershipStatus: userToEdit.membershipStatus || "free",
        charge: userToEdit.charge || "",
        gender: userToEdit.gender || "",
        ageRange: userToEdit.ageRange || "",
        maritalStatus: userToEdit.maritalStatus || "",
        ministry: userToEdit.ministry || "",
        bio: userToEdit.bio || "",
        isInHpGroup: String(userToEdit.isInHpGroup || 'false') as 'true' | 'false',
        hpAvailabilityDay: userToEdit.hpAvailabilityDay || "",
        hpAvailabilityTime: userToEdit.hpAvailabilityTime || "",
        locationPreference: userToEdit.locationPreference || "",
        language: userToEdit.language || "",
    }
  });
  
  const isInHpGroupValue = watch('isInHpGroup');

  const fetchItems = useCallback(async (collectionName: string, setter: React.Dispatch<React.SetStateAction<any[]>>, orderByField = "name") => {
    try {
        const q = query(collection(db, collectionName), orderBy(orderByField));
        const querySnapshot = await getDocs(q);
        const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setter(items);
    } catch (error) {
        toast({ variant: 'destructive', title: `Failed to fetch ${collectionName}` });
    }
  }, [toast, db]);

  const fetchCampuses = useCallback(async () => {
    try {
        const querySnapshot = await getDocs(collection(db, "Campus"));
        const campusesList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        })) as Campus[];
        setCampuses(campusesList);
    } catch (error) {
        toast({ variant: "destructive", title: "Error fetching campuses" });
    }
  }, [toast, db]);
  
    useEffect(() => {
        fetchCampuses();
        fetchItems('courseLevels', setLadders, 'order');
        fetchItems('membershipStatuses', setStatuses);
        fetchItems('charges', setCharges);
        fetchItems('ministries', setMinistries);
        
        const langQuery = query(collection(db, 'languages'), where('status', '==', 'published'));
        getDocs(langQuery).then(snapshot => {
            setAvailableLanguages(snapshot.docs.map(d => ({id: d.id, name: d.data().name} as StoredItem)));
        });

        const roleHierarchy: Record<string, string[]> = {
            developer: ['developer', 'admin', 'moderator', 'team', 'user'],
            admin: ['admin', 'moderator', 'team', 'user'],
            moderator: ['moderator', 'team', 'user'],
            team: ['team', 'user'],
            user: ['user']
        };

        const currentUserRole = currentUser?.role || 'user';
        const visibleRoles = roleHierarchy[currentUserRole] || ['user'];
        
        const allRoles = [
            { id: 'developer', name: 'Developer' },
            { id: 'admin', name: 'Admin' },
            { id: 'moderator', name: 'Moderator' },
            { id: 'team', name: 'Team' },
            { id: 'user', name: 'User' },
        ];

        setRoles(allRoles.filter(role => visibleRoles.includes(role.id)));

    }, [fetchCampuses, fetchItems, db, currentUser?.role]);

  const onSubmit: SubmitHandler<ProfileFormValues> = async (data) => {
    setIsSubmitting(true);
    
    try {
      const userDocRef = doc(db, "users", userToEdit.uid);
      const selectedLadder = ladders.find(l => l.id === data.classLadderId);
      
      const firestoreData: Partial<User> = {
        displayName: `${data.firstName} ${data.lastName}`.trim(),
        fullName: `${data.firstName} ${data.lastName}`.trim(),
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phoneNumber: data.phoneNumber,
        hpNumber: data.hpNumber,
        facilitatorName: data.facilitatorName,
        campus: data.campus,
        classLadder: selectedLadder ? selectedLadder.name : '',
        classLadderId: data.classLadderId,
        role: data.role?.toLowerCase() as User['role'],
        membershipStatus: data.membershipStatus,
        charge: data.charge,
        gender: data.gender,
        ageRange: data.ageRange,
        maritalStatus: data.maritalStatus,
        ministry: data.ministry,
        bio: data.bio,
        isInHpGroup: data.isInHpGroup === 'true',
        hpAvailabilityDay: data.hpAvailabilityDay,
        hpAvailabilityTime: data.hpAvailabilityTime,
        locationPreference: data.locationPreference as 'Onsite' | 'Online',
        language: data.language,
      };

      await updateDoc(userDocRef, firestoreData);

      if (userToEdit.uid === currentUser?.uid && auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: `${data.firstName} ${data.lastName}`.trim(),
        });
        await refreshUser();
      } 
      
      onUserUpdated();
      toast({
        title: "Profile Updated",
        description: "User profile information has been successfully updated.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) {
      return;
    }
    const file = event.target.files[0];
    
    setIsUploading(true);
    try {
      const storageRef = ref(storage, `avatars/${userToEdit.uid}`);
      await uploadBytes(storageRef, file);
      const photoURL = await getDownloadURL(storageRef);
      
      const userDocRef = doc(db, "users", userToEdit.uid);
      await updateDoc(userDocRef, { photoURL });

      if (userToEdit.uid === currentUser?.uid && auth.currentUser) {
        await updateProfile(auth.currentUser, { photoURL });
        await refreshUser();
      } 
      
      toast({
        title: "Avatar Updated",
        description: "Your avatar has been successfully updated.",
      });
      onUserUpdated();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error.message,
      });
    } finally {
      setIsUploading(false);
    }
  }
  
  const getInitials = (name?: string | null) => {
    if (!name) return 'U';
    const names = name.split(' ');
    const initials = names.map(n => n[0]).join('');
    return initials.toUpperCase();
  }

  const isCurrentUserAdmin = currentUser?.role === 'admin' || currentUser?.role === 'developer';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex items-center space-x-4">
            <Avatar className="h-20 w-20">
                <AvatarImage src={userToEdit?.photoURL || undefined} />
                <AvatarFallback className="text-3xl">{getInitials(userToEdit?.displayName)}</AvatarFallback>
            </Avatar>
            <Input type="file" ref={fileInputRef} onChange={handleAvatarChange} className="hidden" accept="image/*" />
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Change Avatar
            </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" {...register("firstName")} />
                {errors.firstName && <p className="text-sm text-destructive">{errors.firstName.message}</p>}
            </div>
             <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" {...register("lastName")} />
                {errors.lastName && <p className="text-sm text-destructive">{errors.lastName.message}</p>}
            </div>
            <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register("email")} disabled={true} />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
             <div className="space-y-2">
                <Label>Gender</Label>
                <Controller
                    name="gender"
                    control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                            <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Male">Male</SelectItem>
                                <SelectItem value="Female">Female</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                />
            </div>
            <div className="space-y-2">
                <Label>Age Range</Label>
                <Controller
                    name="ageRange"
                    control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                            <SelectTrigger><SelectValue placeholder="Select age range" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="13-17">13-17</SelectItem>
                                <SelectItem value="18-24">18-24</SelectItem>
                                <SelectItem value="25-34">25-34</SelectItem>
                                <SelectItem value="35-44">35-44</SelectItem>
                                <SelectItem value="45-54">45-54</SelectItem>
                                <SelectItem value="55-64">55-64</SelectItem>
                                <SelectItem value="65+">65+</SelectItem>
                                <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number</Label>
                 <Controller
                    name="phoneNumber"
                    control={control}
                    render={({ field }) => (
                        <PhoneInput
                            id="phoneNumber"
                            international
                            defaultCountry="US"
                            {...field}
                            value={field.value || undefined}
                            disabled={isSubmitting}
                            className="PhoneInputInput"
                        />
                    )}
                />
            </div>
             <div className="space-y-2">
                <Label>Are you in a Prayer Group (HP)?</Label>
                <Controller
                    name="isInHpGroup"
                    control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                            <SelectTrigger><SelectValue placeholder="Select an option" /></SelectTrigger>
                            <SelectContent>
                            <SelectItem value="true">Yes</SelectItem>
                            <SelectItem value="false">No</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                />
            </div>
             {isInHpGroupValue === 'true' ? (
                <>
                    <div className="space-y-2">
                        <Label htmlFor="hpNumber">HP Number</Label>
                        <Input id="hpNumber" {...register("hpNumber")} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="facilitatorName">Facilitator's Full Name</Label>
                        <Input id="facilitatorName" {...register("facilitatorName")} />
                    </div>
                </>
            ) : (
                <>
                    <div className="space-y-2">
                        <Label>HP Availability Day</Label>
                        <Controller
                            name="hpAvailabilityDay"
                            control={control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                                    <SelectTrigger><SelectValue placeholder="Select a day" /></SelectTrigger>
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
                    </div>
                     <div className="space-y-2">
                        <Label>HP Availability Time</Label>
                        <Input type="time" {...register("hpAvailabilityTime")} disabled={isSubmitting} />
                    </div>
                </>
            )}
            <div className="space-y-2">
                <Label>Campus</Label>
                <Controller
                    name="campus"
                    control={control}
                    render={({ field }) => (
                         <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a campus" />
                            </SelectTrigger>
                            <SelectContent>
                                {currentUser?.campus === 'All Campuses' && <SelectItem value="All Campuses">All Campuses</SelectItem>}
                                {campuses.filter(c => c["Campus Name"] !== 'All Campuses').map((c) => (
                                    <SelectItem key={c.id} value={c["Campus Name"]}>{c["Campus Name"]}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
            </div>
             <div className="space-y-2">
                <Label>Location Preference</Label>
                <Controller
                    name="locationPreference"
                    control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger><SelectValue placeholder="Select location preference" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Onsite">Onsite</SelectItem>
                                <SelectItem value="Online">Online</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                />
            </div>
            <div className="space-y-2">
                <Label>Language</Label>
                <Controller
                    name="language"
                    control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger><SelectValue placeholder="Select language" /></SelectTrigger>
                            <SelectContent>
                                {availableLanguages.map((lang) => (
                                    <SelectItem key={lang.id} value={lang.name}>{lang.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
            </div>
             <div className="space-y-2">
                <Label>Marital Status</Label>
                <Controller
                    name="maritalStatus"
                    control={control}
                    render={({ field }) => (
                         <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger><SelectValue placeholder="Select marital status" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Single">Single</SelectItem>
                                <SelectItem value="Married">Married</SelectItem>
                                <SelectItem value="Divorced">Divorced</SelectItem>
                                <SelectItem value="Widowed">Widowed</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                />
            </div>
            <div className="space-y-2">
                <Label>Ministry</Label>
                <Controller
                    name="ministry"
                    control={control}
                    render={({ field }) => (
                         <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger><SelectValue placeholder="Select ministry" /></SelectTrigger>
                            <SelectContent>
                                {ministries.map((m) => (
                                    <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
            </div>
            <div className="space-y-2">
                <Label>Class Ladder</Label>
                <Controller
                    control={control}
                    name="classLadderId"
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger><SelectValue placeholder="Select a ladder..." /></SelectTrigger>
                            <SelectContent>
                                {ladders.map((ladder) => (
                                    <SelectItem key={ladder.id} value={ladder.id}>{ladder.name} {ladder.side !== 'none' && `(${ladder.side})`}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
            </div>
             <div className="space-y-2">
                <Label>Charge</Label>
                <Controller
                    name="charge"
                    control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a charge" />
                            </SelectTrigger>
                            <SelectContent>
                                {charges.map((c) => (
                                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
            </div>
            {isCurrentUserAdmin && (
                <>
                    <div className="space-y-2">
                        <Label>Role</Label>
                        <Controller
                            control={control}
                            name="role"
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {roles.map((role) => (
                                            <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>
                     <div className="space-y-2">
                        <Label>Membership Status</Label>
                        <Controller
                            control={control}
                            name="membershipStatus"
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {statuses.map((status) => (
                                            <SelectItem key={status.id} value={status.name}>{status.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        />
                    </div>
                </>
            )}
             <div className="space-y-2 md:col-span-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea id="bio" {...register("bio")} placeholder="A brief user bio..." />
            </div>
        </div>
        
        <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onUserUpdated}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
            </Button>
        </div>
    </form>
  );
}
