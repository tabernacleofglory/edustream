
"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash } from "lucide-react";
import { getApps, initializeApp, getApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, updateProfile, signOut } from "firebase/auth";
import { doc, setDoc, collection, addDoc, serverTimestamp, deleteDoc, getDocs, query, orderBy } from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase";
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

const addUserSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  classLadderId: z.string().min(1, "Membership ladder is required"),
  campus: z.string().min(1, "Campus is required"),
  phoneNumber: z.string().optional(),
  hpNumber: z.string().optional(),
  facilitatorName: z.string().optional(),
  charge: z.string().optional(),
  gender: z.string().optional(),
  ageRange: z.string().optional(),
});

type AddUserFormValues = z.infer<typeof addUserSchema>;

interface StoredItem {
    id: string;
    name: string;
}

interface Campus {
    id: string;
    "Campus Name": string;
}

interface AddUserFormProps {
    onUserAdded: (newUser: User) => void;
    ladders: Ladder[];
}

const getSecondaryAuth = () => {
    const secondaryAppName = "secondary";
    const existingApp = getApps().find(app => app.name === secondaryAppName);
    if (existingApp) {
        return getAuth(existingApp);
    }
    const mainAppConfig = getApp().options;
    const secondaryApp = initializeApp(mainAppConfig, secondaryAppName);
    return getAuth(secondaryApp);
};


export default function AddUserForm({ onUserAdded, ladders }: AddUserFormProps) {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [defaultLadderId, setDefaultLadderId] = useState("");
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [isCampusDialogOpen, setIsCampusDialogOpen] = useState(false);
  const [newCampusName, setNewCampusName] = useState("");
  const [charges, setCharges] = useState<StoredItem[]>([]);
  const [isChargeDialogOpen, setIsChargeDialogOpen] = useState(false);
  const [newChargeName, setNewChargeName] = useState("");
  const db = getFirebaseFirestore();
  
  useEffect(() => {
    const newMemberLadder = ladders.find(l => l.name.toLowerCase().includes("new member"));
    if (newMemberLadder) {
        setDefaultLadderId(newMemberLadder.id);
    } else if (ladders.length > 0) {
        setDefaultLadderId(ladders[0].id);
    }
  }, [ladders]);

  useEffect(() => {
    const fetchCampuses = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, "Campus"));
            const campusesList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            } as Campus));
            setCampuses(campusesList);
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error fetching campuses",
            });
        }
    };
    const fetchCharges = async () => {
        try {
            const querySnapshot = await getDocs(query(collection(db, "charges"), orderBy("name")));
            const chargesList = querySnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name } as StoredItem));
            setCharges(chargesList);
        } catch (error) {
            toast({ variant: "destructive", title: "Error fetching charges" });
        }
    };
    fetchCampuses();
    fetchCharges();
  }, [toast, db]);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
    setValue,
    watch
  } = useForm<AddUserFormValues>({
    resolver: zodResolver(addUserSchema),
    defaultValues: {
        fullName: "",
        email: "",
        password: "",
        classLadderId: defaultLadderId || "",
        campus: "",
        phoneNumber: "",
        hpNumber: "",
        facilitatorName: "",
        charge: "",
        gender: "",
        ageRange: "",
    }
  });

   useEffect(() => {
    if (defaultLadderId) {
        setValue("classLadderId", defaultLadderId);
    }
    if (campuses.length > 0 && !watch('campus')) {
        setValue("campus", campuses[0]["Campus Name"]);
    }
  }, [defaultLadderId, campuses, setValue, watch]);


   const handleAddCampus = async () => {
        if (!newCampusName.trim()) return;
        try {
            const docRef = await addDoc(collection(db, "Campus"), {
                "Campus Name": newCampusName.trim(),
                createdAt: serverTimestamp(),
            });
            const newCampus = { id: docRef.id, "Campus Name": newCampusName.trim() };
            setCampuses([...campuses, newCampus]);
            setValue('campus', newCampus["Campus Name"], { shouldValidate: true });
            setNewCampusName("");
            toast({ title: "Campus Added" });
        } catch (error) {
            toast({ variant: "destructive", title: "Error adding campus" });
        }
    };

    const handleRemoveCampus = async (campusId: string) => {
        try {
            await deleteDoc(doc(db, "Campus", campusId));
            const updatedCampuses = campuses.filter(c => c.id !== campusId);
            setCampuses(updatedCampuses);
            if (watch('campus') === campuses.find(c => c.id === campusId)?.["Campus Name"]) {
                 setValue('campus', updatedCampuses.length > 0 ? updatedCampuses[0]["Campus Name"] : "");
            }
            toast({ title: "Campus Removed" });
        } catch (error) {
            toast({ variant: "destructive", title: "Error removing campus" });
        }
    };

    const handleAddCharge = async () => {
        if (!newChargeName.trim()) return;
        try {
            const docRef = await addDoc(collection(db, "charges"), { name: newChargeName.trim() });
            const newItem = { id: docRef.id, name: newChargeName.trim() };
            setCharges(prev => [...prev, newItem].sort((a,b) => a.name.localeCompare(b.name)));
            setValue('charge', newItem.name, { shouldValidate: true });
            setNewChargeName("");
            toast({ title: "Charge Added" });
        } catch (error) {
            toast({ variant: "destructive", title: "Error adding charge" });
        }
    };

    const handleRemoveCharge = async (itemId: string) => {
        try {
            await deleteDoc(doc(db, "charges", itemId));
            const updatedItems = charges.filter(item => item.id !== itemId);
            setCharges(updatedItems);
            if (watch('charge') === charges.find(item => item.id === itemId)?.name) {
                setValue('charge', updatedItems.length > 0 ? updatedItems[0].name : "");
            }
            toast({ title: "Charge Removed" });
        } catch (error) {
            toast({ variant: "destructive", title: "Error removing charge" });
        }
    };

  const onSubmit = async (data: AddUserFormValues) => {
    setIsSubmitting(true);
    try {
      const secondaryAuth = getSecondaryAuth();
      // Use the secondary auth instance to create the user
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, data.email, data.password);
      const user = userCredential.user;

      await updateProfile(user, {
        displayName: data.fullName
      });
      
      const selectedLadder = ladders.find(l => l.id === data.classLadderId);

      const newUser: User = {
        id: user.uid,
        uid: user.uid,
        displayName: data.fullName,
        fullName: data.fullName,
        email: data.email,
        role: 'user',
        membershipStatus: 'Active',
        classLadder: selectedLadder ? selectedLadder.name : '',
        classLadderId: data.classLadderId,
        campus: data.campus,
        phoneNumber: data.phoneNumber,
        hpNumber: data.hpNumber,
        facilitatorName: data.facilitatorName,
        charge: data.charge,
        gender: data.gender,
        ageRange: data.ageRange,
      };

      await setDoc(doc(db, "users", user.uid), newUser);

      // Important: Sign out the newly created user from the secondary auth instance
      if (secondaryAuth.currentUser?.uid === user.uid) {
        await signOut(secondaryAuth);
      }
      
      toast({
        title: "User Created",
        description: `${data.fullName} has been added successfully.`
      });
      
      onUserAdded(newUser);
      reset();

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Creation Failed",
        description: error.code === 'auth/email-already-in-use' 
            ? 'An account with this email already exists.'
            : error.message
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fullName">Full Name</Label>
        <Input id="fullName" {...register("fullName")} disabled={isSubmitting} />
        {errors.fullName && <p className="text-sm text-destructive">{errors.fullName.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" {...register("email")} disabled={isSubmitting} />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" {...register("password")} disabled={isSubmitting} />
        {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
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
                            <SelectItem value="male" translate="no">Male</SelectItem>
                            <SelectItem value="female" translate="no">Female</SelectItem>
                            <SelectItem value="other" translate="no">Other</SelectItem>
                            <SelectItem value="prefer-not-to-say" translate="no">Prefer not to say</SelectItem>
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
                            <SelectItem value="18-24" translate="no">18-24</SelectItem>
                            <SelectItem value="25-34" translate="no">25-34</SelectItem>
                            <SelectItem value="35-44" translate="no">35-44</SelectItem>
                            <SelectItem value="45-54" translate="no">45-54</SelectItem>
                            <SelectItem value="55-64" translate="no">55-64</SelectItem>
                            <SelectItem value="65+" translate="no">65+</SelectItem>
                            <SelectItem value="prefer-not-to-say" translate="no">Prefer not to say</SelectItem>
                        </SelectContent>
                    </Select>
                )}
            />
        </div>

      <div className="space-y-2">
        <Label htmlFor="phoneNumber">Phone Number</Label>
        <Input id="phoneNumber" type="tel" placeholder="e.g., +1 234 567 890" {...register("phoneNumber")} disabled={isSubmitting} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="hpNumber">HP Number</Label>
        <Input id="hpNumber" placeholder="Your HP Number" {...register("hpNumber")} disabled={isSubmitting} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="facilitatorName">Facilitator's Full Name</Label>
        <Input id="facilitatorName" placeholder="Facilitator's Name" {...register("facilitatorName")} disabled={isSubmitting} />
      </div>

       <div className="space-y-2">
        <Label htmlFor="campus">Campus</Label>
        <div className="flex gap-2">
            <Controller
                name="campus"
                control={control}
                render={({ field }) => (
                     <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
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
             <Dialog open={isCampusDialogOpen} onOpenChange={setIsCampusDialogOpen}>
                <DialogTrigger asChild>
                    <Button type="button" variant="outline">Manage</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Manage Campuses</DialogTitle>
                        <DialogDescription>
                            Add or remove campuses.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Existing Campuses</Label>
                            <div className="space-y-2 rounded-md border p-2 max-h-48 overflow-y-auto">
                                {campuses.map(c => (
                                    <div key={c.id} className="flex items-center justify-between">
                                        <span>{c["Campus Name"]}</span>
                                        <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveCampus(c.id)}>
                                            <Trash className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="new-campus" className="text-right">New</Label>
                            <Input id="new-campus" value={newCampusName} onChange={(e) => setNewCampusName(e.target.value)} className="col-span-3" />
                        </div>
                    </div>
                    <DialogFooter>
                         <Button type="button" variant="secondary" onClick={() => setIsCampusDialogOpen(false)}>Close</Button>
                        <Button type="button" onClick={handleAddCampus}>Save New Campus</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
        {errors.campus && <p className="text-sm text-destructive">{errors.campus.message}</p>}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="membershipLadder">Membership Ladder</Label>
        <div className="flex gap-2">
             <Controller
                name="classLadderId"
                control={control}
                render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a membership ladder" />
                        </SelectTrigger>
                        <SelectContent>
                            {ladders.map((l) => (
                                <SelectItem key={l.id} value={l.id}>{l.name} {l.side !== 'none' && `(${l.side})`}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            />
        </div>
        {errors.classLadderId && <p className="text-sm text-destructive">{errors.classLadderId.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="charge">Charge</Label>
        <div className="flex gap-2">
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
            <Dialog open={isChargeDialogOpen} onOpenChange={setIsChargeDialogOpen}>
                <DialogTrigger asChild>
                    <Button type="button" variant="outline">Manage</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Manage Charges</DialogTitle>
                        <DialogDescription>
                            Add or remove charges.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Existing Charges</Label>
                            <div className="space-y-2 rounded-md border p-2 max-h-48 overflow-y-auto">
                                {charges.map(c => (
                                    <div key={c.id} className="flex items-center justify-between">
                                        <span>{c.name}</span>
                                        <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveCharge(c.id)}>
                                            <Trash className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="new-charge" className="text-right">New</Label>
                            <Input id="new-charge" value={newChargeName} onChange={(e) => setNewChargeName(e.target.value)} className="col-span-3" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="secondary" onClick={() => setIsChargeDialogOpen(false)}>Close</Button>
                        <Button type="button" onClick={handleAddCharge}>Save New Charge</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
        {errors.charge && <p className="text-sm text-destructive">{errors.charge.message}</p>}
      </div>


      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create User
        </Button>
      </div>
    </form>
  );
}

    