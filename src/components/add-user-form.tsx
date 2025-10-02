

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
  maritalStatus: z.string().optional(),
  ministry: z.string().optional(),
  charge: z.string().optional(),
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

// A secondary Firebase app instance to avoid conflicts with the main app's auth state
const secondaryAppName = "secondary";
let secondaryApp = getApps().find(app => app.name === secondaryAppName);
if (!secondaryApp) {
    const mainAppConfig = getApp().options;
    secondaryApp = initializeApp(mainAppConfig, secondaryAppName);
}
const secondaryAuth = getAuth(secondaryApp);

export default function AddUserForm({ onUserAdded, ladders }: AddUserFormProps) {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [defaultLadderId, setDefaultLadderId] = useState("");
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [isCampusDialogOpen, setIsCampusDialogOpen] = useState(false);
  const [newCampusName, setNewCampusName] = useState("");
  const [maritalStatuses, setMaritalStatuses] = useState<StoredItem[]>([]);
  const [isMaritalStatusDialogOpen, setIsMaritalStatusDialogOpen] = useState(false);
  const [newMaritalStatusName, setNewMaritalStatusName] = useState("");
  const [ministries, setMinistries] = useState<StoredItem[]>([]);
  const [isMinistryDialogOpen, setIsMinistryDialogOpen] = useState(false);
  const [newMinistryName, setNewMinistryName] = useState("");
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
    const fetchMaritalStatuses = async () => {
        try {
            const querySnapshot = await getDocs(query(collection(db, "maritalStatuses"), orderBy("name")));
            const statusesList = querySnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name } as StoredItem));
            setMaritalStatuses(statusesList);
        } catch (error) {
            toast({ variant: "destructive", title: "Error fetching marital statuses" });
        }
    };
    const fetchMinistries = async () => {
        try {
            const querySnapshot = await getDocs(query(collection(db, "ministries"), orderBy("name")));
            const ministriesList = querySnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name } as StoredItem));
            setMinistries(ministriesList);
        } catch (error) {
            toast({ variant: "destructive", title: "Error fetching ministries" });
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
    fetchMaritalStatuses();
    fetchMinistries();
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
        maritalStatus: "",
        ministry: "",
        charge: "",
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

    const handleAddMaritalStatus = async () => {
        if (!newMaritalStatusName.trim()) return;
        try {
            const docRef = await addDoc(collection(db, "maritalStatuses"), { name: newMaritalStatusName.trim() });
            const newItem = { id: docRef.id, name: newMaritalStatusName.trim() };
            setMaritalStatuses(prev => [...prev, newItem].sort((a,b) => a.name.localeCompare(b.name)));
            setValue('maritalStatus', newItem.name, { shouldValidate: true });
            setNewMaritalStatusName("");
            toast({ title: "Marital Status Added" });
        } catch (error) {
            toast({ variant: "destructive", title: "Error adding marital status" });
        }
    };

    const handleRemoveMaritalStatus = async (itemId: string) => {
        try {
            await deleteDoc(doc(db, "maritalStatuses", itemId));
            const updatedItems = maritalStatuses.filter(item => item.id !== itemId);
            setMaritalStatuses(updatedItems);
            if (watch('maritalStatus') === maritalStatuses.find(item => item.id === itemId)?.name) {
                setValue('maritalStatus', updatedItems.length > 0 ? updatedItems[0].name : "");
            }
            toast({ title: "Marital Status Removed" });
        } catch (error) {
            toast({ variant: "destructive", title: "Error removing marital status" });
        }
    };

    const handleAddMinistry = async () => {
        if (!newMinistryName.trim()) return;
        try {
            const docRef = await addDoc(collection(db, "ministries"), { name: newMinistryName.trim() });
            const newItem = { id: docRef.id, name: newMinistryName.trim() };
            setMinistries(prev => [...prev, newItem].sort((a,b) => a.name.localeCompare(b.name)));
            setValue('ministry', newItem.name, { shouldValidate: true });
            setNewMinistryName("");
            toast({ title: "Ministry Added" });
        } catch (error) {
            toast({ variant: "destructive", title: "Error adding ministry" });
        }
    };

    const handleRemoveMinistry = async (itemId: string) => {
        try {
            await deleteDoc(doc(db, "ministries", itemId));
            const updatedItems = ministries.filter(item => item.id !== itemId);
            setMinistries(updatedItems);
            if (watch('ministry') === ministries.find(item => item.id === itemId)?.name) {
                setValue('ministry', updatedItems.length > 0 ? updatedItems[0].name : "");
            }
            toast({ title: "Ministry Removed" });
        } catch (error) {
            toast({ variant: "destructive", title: "Error removing ministry" });
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
        maritalStatus: data.maritalStatus,
        ministry: data.ministry,
        charge: data.charge,
      };

      await setDoc(doc(db, "users", user.uid), newUser);

      // Important: Sign out the newly created user from the secondary auth instance
      await signOut(secondaryAuth);
      
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
            <Label htmlFor="maritalStatus">Marital Status</Label>
            <div className="flex gap-2">
                 <Controller
                    name="maritalStatus"
                    control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                            <SelectTrigger><SelectValue placeholder="Select marital status" /></SelectTrigger>
                            <SelectContent>
                                {maritalStatuses.map((s) => (<SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>))}
                            </SelectContent>
                        </Select>
                    )}
                />
                <Dialog open={isMaritalStatusDialogOpen} onOpenChange={setIsMaritalStatusDialogOpen}>
                    <DialogTrigger asChild><Button type="button" variant="outline">Manage</Button></DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader><DialogTitle>Manage Marital Statuses</DialogTitle></DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2"><Label>Existing Statuses</Label>
                                <div className="space-y-2 rounded-md border p-2 max-h-48 overflow-y-auto">
                                    {maritalStatuses.map(s => (<div key={s.id} className="flex items-center justify-between"><span>{s.name}</span><Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveMaritalStatus(s.id)}><Trash className="h-4 w-4" /></Button></div>))}
                                </div>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="new-marital-status" className="text-right">New</Label><Input id="new-marital-status" value={newMaritalStatusName} onChange={(e) => setNewMaritalStatusName(e.target.value)} className="col-span-3" /></div>
                        </div>
                        <DialogFooter><Button type="button" variant="secondary" onClick={() => setIsMaritalStatusDialogOpen(false)}>Close</Button><Button type="button" onClick={handleAddMaritalStatus}>Save New Status</Button></DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
            {errors.maritalStatus && <p className="text-sm text-destructive">{errors.maritalStatus.message}</p>}
        </div>

        <div className="space-y-2">
            <Label htmlFor="ministry">Ministry</Label>
            <div className="flex gap-2">
                 <Controller
                    name="ministry"
                    control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                            <SelectTrigger><SelectValue placeholder="Select ministry" /></SelectTrigger>
                            <SelectContent>
                                {ministries.map((m) => (<SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>))}
                            </SelectContent>
                        </Select>
                    )}
                />
                <Dialog open={isMinistryDialogOpen} onOpenChange={setIsMinistryDialogOpen}>
                    <DialogTrigger asChild><Button type="button" variant="outline">Manage</Button></DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader><DialogTitle>Manage Ministries</DialogTitle></DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2"><Label>Existing Ministries</Label>
                                <div className="space-y-2 rounded-md border p-2 max-h-48 overflow-y-auto">
                                    {ministries.map(m => (<div key={m.id} className="flex items-center justify-between"><span>{m.name}</span><Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveMinistry(m.id)}><Trash className="h-4 w-4" /></Button></div>))}
                                </div>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="new-ministry" className="text-right">New</Label><Input id="new-ministry" value={newMinistryName} onChange={(e) => setNewMinistryName(e.target.value)} className="col-span-3" /></div>
                        </div>
                        <DialogFooter><Button type="button" variant="secondary" onClick={() => setIsMinistryDialogOpen(false)}>Close</Button><Button type="button" onClick={handleAddMinistry}>Save New Ministry</Button></DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
            {errors.ministry && <p className="text-sm text-destructive">{errors.ministry.message}</p>}
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
