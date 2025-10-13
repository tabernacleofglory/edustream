
"use client";

import { useState, useEffect, FormEvent } from "react";
import { getFirebaseFirestore } from "@/lib/firebase";
import { collection, addDoc, getDocs, doc, deleteDoc, serverTimestamp, query, orderBy, updateDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Trash, Edit } from "lucide-react";
import { Skeleton } from "./ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "./ui/label";

interface Campus {
  id: string;
  "Campus Name": string;
  Address?: string;
  Email?: string;
  Phone?: string;
}

const CampusEditForm = ({ campus, onUpdateSuccess, closeDialog }: { campus: Campus, onUpdateSuccess: (updatedCampus: Campus) => void, closeDialog: () => void }) => {
    const [formData, setFormData] = useState({
        name: campus["Campus Name"],
        address: campus.Address || "",
        email: campus.Email || "",
        phone: campus.Phone || ""
    });
    const [isUpdating, setIsUpdating] = useState(false);
    const { toast } = useToast();
    const db = getFirebaseFirestore();

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsUpdating(true);
        try {
            const campusDocRef = doc(db, 'Campus', campus.id);
            const updatedData = {
                "Campus Name": formData.name,
                Address: formData.address,
                Email: formData.email,
                Phone: formData.phone,
            };
            await updateDoc(campusDocRef, updatedData);
            
            toast({ title: "Campus updated!" });
            onUpdateSuccess({ ...campus, ...updatedData });
            closeDialog();

        } catch (error) {
             toast({ variant: 'destructive', title: "Update failed", description: "Could not update the campus details." });
             console.error("Update error: ", error);
        } finally {
            setIsUpdating(false);
        }
    }
    
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="edit-campus-name">Campus Name</Label>
                <Input id="edit-campus-name" name="name" value={formData.name} onChange={handleInputChange} required disabled={isUpdating} />
            </div>
             <div className="space-y-2">
                <Label htmlFor="edit-campus-address">Address</Label>
                <Input id="edit-campus-address" name="address" value={formData.address} onChange={handleInputChange} disabled={isUpdating} />
            </div>
             <div className="space-y-2">
                <Label htmlFor="edit-campus-email">Email</Label>
                <Input id="edit-campus-email" name="email" type="email" value={formData.email} onChange={handleInputChange} disabled={isUpdating} />
            </div>
             <div className="space-y-2">
                <Label htmlFor="edit-campus-phone">Phone</Label>
                <Input id="edit-campus-phone" name="phone" type="tel" value={formData.phone} onChange={handleInputChange} disabled={isUpdating} />
            </div>
            <DialogFooter>
                 <Button type="button" variant="secondary" onClick={closeDialog}>Cancel</Button>
                <Button type="submit" disabled={isUpdating}>
                    {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                </Button>
            </DialogFooter>
        </form>
    );
}

export default function CampusManagement() {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [newCampus, setNewCampus] = useState({ name: "", address: "", email: "", phone: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCampus, setEditingCampus] = useState<Campus | null>(null);
  const { toast } = useToast();
  const db = getFirebaseFirestore();

  useEffect(() => {
    const fetchCampuses = async () => {
      setIsLoading(true);
      try {
        const q = query(collection(db, "Campus"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const campusesList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as Campus));
        setCampuses(campusesList);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error fetching campuses",
          description: "Could not load the list of campuses.",
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchCampuses();
  }, [toast, db]);

  const handleAddCampus = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCampus.name.trim()) {
        toast({
            variant: "destructive",
            title: "Campus name cannot be empty.",
        });
        return;
    }
    setIsSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, "Campus"), {
        "Campus Name": newCampus.name.trim(),
        "Address": newCampus.address.trim(),
        "Email": newCampus.email.trim(),
        "Phone": newCampus.phone.trim(),
        createdAt: serverTimestamp(),
      });
      const addedCampus: Campus = { 
          id: docRef.id, 
          "Campus Name": newCampus.name.trim(),
          Address: newCampus.address.trim(),
          Email: newCampus.email.trim(),
          Phone: newCampus.phone.trim()
      };
      setCampuses(prevCampuses => [addedCampus, ...prevCampuses]);
      setNewCampus({ name: "", address: "", email: "", phone: "" });
      toast({
        title: "Campus Added",
        description: `"${newCampus.name.trim()}" has been successfully added.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add the new campus.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCampus = async (campusId: string, campusName: string) => {
    try {
        await deleteDoc(doc(db, "Campus", campusId));
        setCampuses(campuses.filter((campus) => campus.id !== campusId));
        toast({
            title: "Campus Deleted",
            description: `"${campusName}" has been successfully deleted.`,
        });
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to delete the campus.",
        });
    }
  }
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setNewCampus(prev => ({ ...prev, [name]: value }));
  }

  const handleUpdateSuccess = (updatedCampus: Campus) => {
      setCampuses(prev => prev.map(c => c.id === updatedCampus.id ? updatedCampus : c));
      setEditingCampus(null);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Add New Campus</CardTitle>
          <CardDescription>
            Enter the details of the new campus to add it to the list.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleAddCampus}>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="campus-name">Campus Name</Label>
                    <Input id="campus-name" name="name" placeholder="e.g., Main Campus" value={newCampus.name} onChange={handleInputChange} disabled={isSubmitting} />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="campus-address">Address</Label>
                    <Input id="campus-address" name="address" placeholder="e.g., 123 Main St, Anytown, USA" value={newCampus.address} onChange={handleInputChange} disabled={isSubmitting} />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="campus-email">Email</Label>
                    <Input id="campus-email" name="email" type="email" placeholder="e.g., contact@maincampus.com" value={newCampus.email} onChange={handleInputChange} disabled={isSubmitting} />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="campus-phone">Phone</Label>
                    <Input id="campus-phone" name="phone" type="tel" placeholder="e.g., 555-123-4567" value={newCampus.phone} onChange={handleInputChange} disabled={isSubmitting} />
                </div>
            </CardContent>
            <CardFooter>
                <Button type="submit" disabled={isSubmitting || !newCampus.name.trim()} className="w-full sm:w-auto">
                {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Plus className="mr-2 h-4 w-4" />
                )}
                Add Campus
                </Button>
            </CardFooter>
        </form>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Existing Campuses</CardTitle>
          <CardDescription>
            The list of all available campuses.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="space-y-2 rounded-md border p-2 max-h-96 overflow-y-auto">
            {isLoading ? (
                Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="flex items-center justify-between p-2">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-8 w-8" />
                    </div>
                ))
            ) : campuses.length > 0 ? (
                campuses.map((campus) => (
                <div key={campus.id} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-md">
                    <div>
                        <p className="font-medium">{campus["Campus Name"]}</p>
                        <p className="text-sm text-muted-foreground">{campus.Address}</p>
                    </div>
                    <div className="flex items-center">
                        <Button type="button" variant="ghost" size="icon" onClick={() => setEditingCampus(campus)}>
                            <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <Trash className="h-4 w-4 text-destructive" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the
                                    "{campus["Campus Name"]}" campus.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteCampus(campus.id, campus["Campus Name"])}>
                                    Continue
                                </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
                ))
            ) : (
                <p className="text-center text-muted-foreground p-4">No campuses have been added yet.</p>
            )}
            </div>
        </CardContent>
      </Card>

      <Dialog open={!!editingCampus} onOpenChange={(isOpen) => !isOpen && setEditingCampus(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Campus</DialogTitle>
            <DialogDescription>Update the details for this campus.</DialogDescription>
          </DialogHeader>
          {editingCampus && (
            <CampusEditForm 
              campus={editingCampus} 
              onUpdateSuccess={handleUpdateSuccess} 
              closeDialog={() => setEditingCampus(null)} 
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
