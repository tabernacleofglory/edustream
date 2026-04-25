
"use client";

import { useState, useEffect, FormEvent, useCallback } from "react";
import { getFirebaseFirestore } from "@/lib/firebase";
import { collection, addDoc, getDocs, doc, deleteDoc, serverTimestamp, query, orderBy, updateDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Trash, Edit, List } from "lucide-react";
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
} from "@/components/ui/dialog"
import { Label } from "./ui/label";

interface SubField {
    id: string;
    name: string;
}

interface CustomField {
  id: string;
  name: string;
  subFields?: SubField[];
}

const SubFieldManager = ({ field, onUpdate }: { field: CustomField, onUpdate: () => void }) => {
    const [subFields, setSubFields] = useState<SubField[]>([]);
    const [newSubFieldName, setNewSubFieldName] = useState("");
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const db = getFirebaseFirestore();
    const { toast } = useToast();

    const fetchSubFields = useCallback(async () => {
        setLoading(true);
        const q = query(collection(db, "customFields", field.id, "options"), orderBy("name"));
        const snapshot = await getDocs(q);
        setSubFields(snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
        setLoading(false);
    }, [db, field.id]);

    useEffect(() => {
        fetchSubFields();
    }, [fetchSubFields]);

    const handleAddSubField = async () => {
        if (!newSubFieldName.trim()) return;
        setIsSubmitting(true);
        try {
            await addDoc(collection(db, "customFields", field.id, "options"), {
                name: newSubFieldName.trim(),
            });
            setNewSubFieldName("");
            toast({ title: "Sub-field Added" });
            fetchSubFields();
        } catch (error) {
            toast({ variant: "destructive", title: "Error adding sub-field" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteSubField = async (subFieldId: string) => {
        try {
            await deleteDoc(doc(db, "customFields", field.id, "options", subFieldId));
            toast({ title: "Sub-field Removed" });
            fetchSubFields();
        } catch (error) {
            toast({ variant: "destructive", title: "Error removing sub-field" });
        }
    };

    return (
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Manage Sub-fields for "{field.name}"</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="flex gap-2">
                    <Input
                        placeholder="New sub-field name..."
                        value={newSubFieldName}
                        onChange={(e) => setNewSubFieldName(e.target.value)}
                        disabled={isSubmitting}
                    />
                    <Button onClick={handleAddSubField} disabled={isSubmitting || !newSubFieldName.trim()}>
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    </Button>
                </div>
                <div className="space-y-2 rounded-md border p-2 max-h-64 overflow-y-auto">
                    {loading ? <p>Loading...</p> : subFields.length > 0 ? (
                        subFields.map(sf => (
                            <div key={sf.id} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-md">
                                <p className="font-medium text-sm">{sf.name}</p>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteSubField(sf.id)}>
                                    <Trash className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        ))
                    ) : (
                        <p className="text-center text-muted-foreground p-4 text-sm">No sub-fields yet.</p>
                    )}
                </div>
            </div>
        </DialogContent>
    )
}

export default function CustomFieldManagement() {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [newFieldName, setNewFieldName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [managingSubFields, setManagingSubFields] = useState<CustomField | null>(null);
  const { toast } = useToast();
  const db = getFirebaseFirestore();

  const fetchFields = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "customFields"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const fieldList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as CustomField));
      setFields(fieldList);
    } catch (error) {
      toast({ variant: "destructive", title: "Error fetching custom fields" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, db]);

  useEffect(() => {
    fetchFields();
  }, [fetchFields]);

  const handleAddField = async (e: FormEvent) => {
    e.preventDefault();
    if (!newFieldName.trim()) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "customFields"), {
        "name": newFieldName.trim(),
        createdAt: serverTimestamp(),
      });
      setNewFieldName("");
      toast({ title: "Custom Field Added" });
      fetchFields();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to add the new field." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    try {
        await deleteDoc(doc(db, "customFields", fieldId));
        toast({ title: "Field Deleted" });
        fetchFields();
    } catch (error) {
        toast({ variant: "destructive", title: "Error", description: "Failed to delete the field." });
    }
  }
  
  const handleUpdateName = async () => {
    if (!editingField || !editingField.name.trim()) return;
    setIsSubmitting(true);
    try {
        await updateDoc(doc(db, 'customFields', editingField.id), { name: editingField.name.trim() });
        toast({ title: 'Field Renamed' });
        setEditingField(null);
        fetchFields();
    } catch (error) {
        toast({ variant: 'destructive', title: 'Rename failed' });
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <>
    <Card>
        <CardHeader>
          <CardTitle>Manage Custom Fields</CardTitle>
          <CardDescription>
            Create and manage reusable sets of options for your forms.
          </CardDescription>
        </CardHeader>
        <CardContent>
             <form onSubmit={handleAddField} className="flex items-end gap-2 mb-4">
                <div className="flex-grow space-y-1">
                    <Label htmlFor="field-name" className="sr-only">Field Name</Label>
                    <Input id="field-name" name="name" placeholder="New field group name (e.g., Departments)" value={newFieldName} onChange={(e) => setNewFieldName(e.target.value)} disabled={isSubmitting} />
                </div>
                <Button type="submit" disabled={isSubmitting || !newFieldName.trim()}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    Add Group
                </Button>
            </form>
            <div className="space-y-2 rounded-md border p-2 max-h-96 overflow-y-auto">
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="flex items-center justify-between p-2">
                            <Skeleton className="h-5 w-3/4" />
                            <Skeleton className="h-8 w-8" />
                        </div>
                    ))
                ) : fields.length > 0 ? (
                    fields.map((field) => (
                    <div key={field.id} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-md">
                        <p className="font-medium">{field.name}</p>
                        <div className="flex items-center">
                            <Button variant="outline" size="sm" onClick={() => setManagingSubFields(field)}>
                                <List className="mr-2 h-4 w-4" />
                                Manage Sub-fields
                            </Button>
                             <Button type="button" variant="ghost" size="icon" onClick={() => setEditingField(field)}>
                                <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon"><Trash className="h-4 w-4 text-destructive" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will permanently delete the "{field.name}" field group and all its sub-fields.
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteField(field.id)}>Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>
                    ))
                ) : (
                    <p className="text-center text-muted-foreground p-4">No custom fields have been added yet.</p>
                )}
            </div>
        </CardContent>
      </Card>
      
      <Dialog open={!!managingSubFields} onOpenChange={(open) => !open && setManagingSubFields(null)}>
        {managingSubFields && <SubFieldManager field={managingSubFields} onUpdate={fetchFields} />}
      </Dialog>

      <Dialog open={!!editingField} onOpenChange={(isOpen) => !isOpen && setEditingField(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Field Name</DialogTitle>
          </DialogHeader>
          {editingField && (
            <div className="space-y-4 pt-4">
                <div className="space-y-2">
                    <Label htmlFor="edit-field-name">Field Name</Label>
                    <Input id="edit-field-name" value={editingField.name} onChange={(e) => setEditingField({...editingField, name: e.target.value})} />
                </div>
                <DialogFooter>
                    <Button variant="secondary" onClick={() => setEditingField(null)}>Cancel</Button>
                    <Button onClick={handleUpdateName} disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save
                    </Button>
                </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
