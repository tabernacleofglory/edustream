

"use client";

import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useForm, SubmitHandler, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { updateProfile } from "firebase/auth";
import { getFirebaseAuth, getFirebaseStorage, getFirebaseFirestore } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, setDoc, collection, getDocs, addDoc, serverTimestamp, deleteDoc, query, orderBy, updateDoc } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash, Edit } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import type { User as AppUser, Ladder } from "@/lib/types";

const profileSchema = z.object({
  displayName: z.string().min(1, "Full name is required"),
  email: z.string().email(),
  phoneNumber: z.string().optional(),
  hpNumber: z.string().optional(),
  facilitatorName: z.string().optional(),
  campus: z.string().optional(),
  classLadderId: z.string().optional(),
  role: z.string().optional(),
  membershipStatus: z.string().optional(),
  charge: z.string().optional(),
  gender: z.string().optional(),
  ageRange: z.string().optional(),
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
    userToEdit: AppUser;
    onUserUpdated: () => void;
}

const ALL_ROLES: StoredItem[] = [
    { id: 'admin', name: 'Admin' },
    { id: 'moderator', name: 'Moderator' },
    { id: 'user', name: 'User' },
];

export default function EditUserForm({ userToEdit, onUserUpdated }: EditUserFormProps) {
  const { user: currentUser, refreshUser, isCurrentUserAdmin } = useAuth();
  const { toast } = useToast();
  const auth = getFirebaseAuth();
  const storage = getFirebaseStorage();
  const db = getFirebaseFirestore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [isCampusDialogOpen, setIsCampusDialogOpen] = useState(false);
  const [newCampusName, setNewCampusName] = useState("");
  
  const [ladders, setLadders] = useState<Ladder[]>([]);

  const [roles, setRoles] = useState<StoredItem[]>(ALL_ROLES);
  
  const [statuses, setStatuses] = useState<StoredItem[]>([]);
  
  const [charges, setCharges] = useState<StoredItem[]>([]);
  const [isChargeDialogOpen, setIsChargeDialogOpen] = useState(false);
  const [newChargeName, setNewChargeName] = useState("");


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
        displayName: userToEdit.displayName || "",
        email: userToEdit.email || "",
        phoneNumber: userToEdit.phoneNumber || "",
        hpNumber: userToEdit.hpNumber || "",
        facilitatorName: userToEdit.facilitatorName || "",
        campus: userToEdit.campus || "",
        classLadderId: userToEdit.classLadderId || "",
        role: userToEdit.role || "user",
        membershipStatus: userToEdit.membershipStatus || "free",
        charge: userToEdit.charge || "",
        gender: userToEdit.gender || "",
        ageRange: userToEdit.ageRange || "",
    }
  });
  
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
  
  const handleAddItem = async (
    collectionName: string, 
    itemName: string, 
    setter: React.Dispatch<React.SetStateAction<StoredItem[]>>,
    formField: keyof ProfileFormValues,
    setNewItemName: React.Dispatch<React.SetStateAction<string>>
  ) => {
      if (!itemName.trim()) return;
      try {
          const docRef = await addDoc(collection(db, collectionName), { name: itemName.trim() });
          const newItem = { id: docRef.id, name: itemName.trim() };
          const sortedItems = [...(await getDocs(query(collection(db, collectionName), orderBy("name")))).docs.map(doc => ({ id: doc.id, name: doc.data().name }))];
          setter(sortedItems);
          setValue(formField, newItem.name as any, { shouldValidate: true, shouldDirty: true });
          setNewItemName("");
          toast({ title: `${String(formField)} Added` });
      } catch (error) {
           toast({ variant: "destructive", title: `Error adding ${String(formField)}` });
      }
  }

  const handleRemoveItem = async (
    collectionName: string,
    itemId: string,
    setter: React.Dispatch<React.SetStateAction<StoredItem[]>>,
    currentValue: string | undefined,
    formField: keyof ProfileFormValues
  ) => {
      try {
          const itemDoc = await getDoc(doc(db, collectionName, itemId));
          const itemName = itemDoc.data()?.name;
          await deleteDoc(doc(db, collectionName, itemId));
          const updatedItems = (await getDocs(query(collection(db, collectionName), orderBy("name")))).docs.map(doc => ({ id: doc.id, name: doc.data().name }));
          setter(updatedItems);
          if (currentValue === itemName) {
               setValue(formField, (updatedItems.length > 0 ? updatedItems[0].name : "") as any, { shouldDirty: true });
          }
          toast({ title: `${String(formField)} Removed` });
      } catch (error) {
          toast({ variant: "destructive", title: `Error removing ${String(formField)}` });
      }
  }


  const fetchCampuses = useCallback(async () => {
    try {
        const querySnapshot = await getDocs(collection(db, "Campus"));
        const campusesList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        })) as Campus[];
        setCampuses(campusesList);
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Error fetching campuses",
        });
    }
  }, [toast, db]);
  
  useEffect(() => {
    fetchCampuses();
    fetchItems('courseLevels', setLadders, 'order');
    fetchItems('membershipStatuses', setStatuses);
    fetchItems('charges', setCharges);
  }, [fetchCampuses, fetchItems]);

  useEffect(() => {
    if (userToEdit) {
      reset({
        displayName: userToEdit.displayName || "",
        email: userToEdit.email || "",
        phoneNumber: userToEdit.phoneNumber || "",
        hpNumber: userToEdit.hpNumber || "",
        facilitatorName: userToEdit.facilitatorName || "",
        campus: userToEdit.campus || "",
        classLadderId: userToEdit.classLadderId || "",
        role: userToEdit.role || "user",
        membershipStatus: userToEdit.membershipStatus || "free",
        charge: userToEdit.charge || "",
        gender: userToEdit.gender || "",
        ageRange: userToEdit.ageRange || "",
      });
    }
  }, [userToEdit, reset]);

   const handleAddCampus = async () => {
        if (!newCampusName.trim()) return;
        try {
            const docRef = await addDoc(collection(db, "Campus"), {
                "Campus Name": newCampusName.trim(),
                createdAt: serverTimestamp(),
            });
            const newCampus = { id: docRef.id, "Campus Name": newCampusName.trim() };
            setCampuses([...campuses, newCampus]);
            setValue('campus', newCampus["Campus Name"], { shouldValidate: true, shouldDirty: true });
            setNewCampusName("");
            toast({ title: "Campus Added" });
        } catch (error) {
            toast({ variant: "destructive", title: "Error adding campus" });
        }
    };

    const handleRemoveCampus = async (campusId: string) => {
        try {
            const campusDoc = await getDoc(doc(db, 'Campus', campusId));
            const campusName = campusDoc.data()?.['Campus Name'];
            await deleteDoc(doc(db, "Campus", campusId));
            const updatedCampuses = campuses.filter(c => c.id !== campusId);
            setCampuses(updatedCampuses);
            if (watch('campus') === campusName) {
                 setValue('campus', updatedCampuses.length > 0 ? updatedCampuses[0]["Campus Name"] : "", { shouldDirty: true });
            }
            toast({ title: "Campus Removed" });
        } catch (error) {
            toast({ variant: "destructive", title: "Error removing campus" });
        }
    };

    const handleAddCharge = () => handleAddItem('charges', newChargeName, setCharges, 'charge', setNewChargeName);
    const handleRemoveCharge = (id: string) => handleRemoveItem('charges', id, setCharges, watch('charge'), 'charge');


  const onSubmit: SubmitHandler<ProfileFormValues> = async (data) => {
    setIsSubmitting(true);
    
    try {
      const userDocRef = doc(db, "users", userToEdit.uid);
      const selectedLadder = ladders.find(l => l.id === data.classLadderId);
      
      const firestoreData: Partial<AppUser> = {
        displayName: data.displayName,
        fullName: data.displayName,
        email: data.email,
        phoneNumber: data.phoneNumber,
        hpNumber: data.hpNumber,
        facilitatorName: data.facilitatorName,
        campus: data.campus,
        classLadder: selectedLadder ? selectedLadder.name : '',
        classLadderId: data.classLadderId,
        role: data.role?.toLowerCase() as AppUser['role'],
        membershipStatus: data.membershipStatus,
        charge: data.charge,
        gender: data.gender,
        ageRange: data.ageRange,
      };

      await updateDoc(userDocRef, firestoreData);

      if (userToEdit.uid === currentUser?.uid && auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: data.displayName,
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
      await setDoc(userDocRef, { photoURL }, { merge: true });

      if (userToEdit.uid === currentUser?.uid && auth.currentUser) {
        await updateProfile(auth.currentUser, { photoURL });
        await refreshUser();
      } 
      
      toast({
        title: "Avatar Updated",
        description: "Your avatar has been successfully updated.",
      });
      onUserUpdated(); // Refresh the list to show new avatar
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

  const renderField = (fieldName: keyof ProfileFormValues, label: string, items: {id: string; name: string}[], onAdd: () => void, onRemove: (id: string) => void, newItemName: string, setNewItemName: (name: string) => void, isManageDialogOpen: boolean, setIsManageDialogOpen: (isOpen: boolean) => void) => {
    
    const availableItems = (fieldName === 'role' && currentUser?.role !== 'developer')
      ? items.filter(item => item.name.toLowerCase() !== 'developer')
      : items;

    return (
        <div className="space-y-2">
            <Label htmlFor={fieldName}>{label}</Label>
            <div className="flex gap-2">
                <Controller
                    control={control}
                    name={fieldName}
                    render={({ field }) => (
                        <Select
                            onValueChange={(value) => field.onChange(value as any)}
                            value={field.value}
                            disabled={isSubmitting || ((fieldName === 'role' || fieldName === 'membershipStatus') && !isCurrentUserAdmin)}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder={`Select a ${label.toLowerCase()}`} />
                            </SelectTrigger>
                            <SelectContent>
                                {availableItems.map((item) => (
                                    <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
                {isCurrentUserAdmin && (
                    <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
                        <DialogTrigger asChild>
                            <Button type="button" variant="outline">Manage</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Manage {label}s</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Existing {label}s</Label>
                                    <div className="space-y-2 rounded-md border p-2 max-h-48 overflow-y-auto">
                                        {items.map(item => (
                                            <div key={item.id} className="flex items-center justify-between">
                                                <span>{item.name}</span>
                                                <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(item.id)}><Trash className="h-4 w-4" /></Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor={`new-${fieldName}`} className="text-right">New</Label>
                                    <Input id={`new-${fieldName}`} value={newItemName} onChange={(e) => setNewItemName(e.target.value)} className="col-span-3" />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="secondary" onClick={() => setIsManageDialogOpen(false)}>Close</Button>
                                <Button type="button" onClick={onAdd}>Save New {label}</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}
            </div>
            {errors[fieldName] && <p className="text-sm text-destructive">{errors[fieldName]?.message}</p>}
        </div>
    );
};


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
            <Label htmlFor="displayName">Full Name</Label>
            <Input
            id="displayName"
            {...register("displayName")}
            />
            {errors.displayName && (
            <p className="text-sm text-destructive">
                {errors.displayName.message}
            </p>
            )}
        </div>
        <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
            id="email"
            type="email"
            {...register("email")}
            disabled={true}
            />
            {errors.email && (
            <p className="text-sm text-destructive">
                {errors.email.message}
            </p>
            )}
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
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                            <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                        </SelectContent>
                    </Select>
                )}
            />
             {errors.gender && <p className="text-sm text-destructive">{errors.gender.message}</p>}
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
                            <SelectItem value="18-24">18-24</SelectItem>
                            <SelectItem value="25-34">25-34</SelectItem>
                            <SelectItem value="35-44">35-44</SelectItem>
                            <SelectItem value="45-54">45-54</SelectItem>
                            <SelectItem value="55-64">55-64</SelectItem>
                            <SelectItem value="65+">65+</SelectItem>
                            <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                        </SelectContent>
                    </Select>
                )}
            />
            {errors.ageRange && <p className="text-sm text-destructive">{errors.ageRange.message}</p>}
        </div>
        <div className="space-y-2">
            <Label htmlFor="phoneNumber">Phone Number</Label>
            <Input
            id="phoneNumber"
            type="tel"
            {...register("phoneNumber")}
                placeholder="e.g., +1 234 567 890"
            />
            {errors.phoneNumber && (
            <p className="text-sm text-destructive">
                {errors.phoneNumber.message}
            </p>
            )}
        </div>
        <div className="space-y-2">
            <Label htmlFor="hpNumber">HP Number</Label>
            <Input
            id="hpNumber"
            {...register("hpNumber")}
            placeholder="Your HP Number"
            />
            {errors.hpNumber && (
            <p className="text-sm text-destructive">
                {errors.hpNumber.message}
            </p>
            )}
        </div>
        <div className="space-y-2">
            <Label htmlFor="facilitatorName">Facilitator's Full Name</Label>
            <Input
            id="facilitatorName"
            {...register("facilitatorName")}
            placeholder="Facilitator's Name"
            />
            {errors.facilitatorName && (
            <p className="text-sm text-destructive">
                {errors.facilitatorName.message}
            </p>
            )}
        </div>
         <div className="space-y-2">
            <Label htmlFor="campus">Campus</Label>
            <div className="flex gap-2">
                <Controller
                    control={control}
                    name="campus"
                    render={({ field }) => (
                         <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a campus" />
                            </SelectTrigger>
                            <SelectContent>
                                {campuses.map((c) => (
                                    <SelectItem key={c.id} value={c["Campus Name"]}>{c["Campus Name"]}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
            </div>
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

        {renderField('charge', 'Charge', charges, handleAddCharge, handleRemoveCharge, newChargeName, setNewChargeName, isChargeDialogOpen, setIsChargeDialogOpen)}
        
        {isCurrentUserAdmin && renderField('role', 'Role', roles, () => {}, () => {}, '', () => {}, isChargeDialogOpen, setIsChargeDialogOpen)}
        {isCurrentUserAdmin && renderField('membershipStatus', 'Membership Status', statuses, () => {}, () => {}, '', () => {}, isChargeDialogOpen, setIsChargeDialogOpen)}
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

    
