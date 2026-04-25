"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { 
  collection, 
  getDocs, 
  addDoc, 
  serverTimestamp, 
  query, 
  orderBy, 
  onSnapshot,
  deleteDoc,
  doc,
  writeBatch,
  where,
  updateDoc,
  getCountFromServer,
  startAfter,
  DocumentSnapshot,
  Timestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import type { InventoryItem, InventoryCategory, User, Campus } from "@/lib/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Loader2, Plus, Package, Trash2, Search, 
  Calendar as CalendarIcon, User as UserIcon, 
  History, AlertTriangle, Box, Settings2, ArrowUp, ArrowDown,
  Edit, Check, X, ListFilter, MapPin, Layers, List, Users
} from "lucide-react";
import { format, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DateRange } from "react-day-picker";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const getInitials = (name?: string | null) => {
    if (!name) return "U";
    return name.trim().split(/\s+/).map((n) => n[0]).join("").toUpperCase();
};

interface SubCategory {
    id: string;
    name: string;
    order?: number;
}

const SubCategoryManager = ({ 
    category, 
    onClose 
}: { 
    category: InventoryCategory, 
    onClose: () => void 
}) => {
    const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
    const [newName, setNewName] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState("");
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const fetchSubCategories = useCallback(() => {
        setLoading(true);
        const q = query(collection(db, "inventoryCategories", category.id, "subCategories"), orderBy("order", "asc"));
        return onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubCategory));
            setSubCategories(list);
            setLoading(false);
        });
    }, [category.id]);

    useEffect(() => {
        const unsubscribe = fetchSubCategories();
        return () => unsubscribe();
    }, [fetchSubCategories]);

    const handleAdd = async () => {
        if (!newName.trim()) return;
        setIsSubmitting(true);
        try {
            const maxOrder = subCategories.reduce((max, c) => Math.max(max, c.order || 0), -1);
            await addDoc(collection(db, "inventoryCategories", category.id, "subCategories"), {
                name: newName.trim(),
                order: maxOrder + 1,
                createdAt: serverTimestamp(),
            });
            setNewName("");
            toast({ title: "Sub-category added" });
        } catch (e) {
            toast({ variant: "destructive", title: "Error adding sub-category" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteDoc(doc(db, "inventoryCategories", category.id, "subCategories", id));
            toast({ title: "Sub-category deleted" });
        } catch (e) {
            toast({ variant: "destructive", title: "Error deleting sub-category" });
        }
    };

    const handleUpdate = async (id: string) => {
        if (!editingName.trim()) return;
        setIsSubmitting(true);
        try {
            await updateDoc(doc(db, "inventoryCategories", category.id, "subCategories", id), {
                name: editingName.trim()
            });
            setEditingId(null);
            toast({ title: "Sub-category updated" });
        } catch (e) {
            toast({ variant: "destructive", title: "Error updating sub-category" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleMove = async (index: number, direction: 'up' | 'down') => {
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= subCategories.length) return;

        const batch = writeBatch(db);
        const current = subCategories[index];
        const target = subCategories[targetIndex];

        batch.update(doc(db, "inventoryCategories", category.id, "subCategories", current.id), { order: target.order || 0 });
        batch.update(doc(db, "inventoryCategories", category.id, "subCategories", target.id), { order: current.order || 0 });

        try {
            await batch.commit();
        } catch (e) {
            toast({ variant: "destructive", title: "Error reordering" });
        }
    };

    return (
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Manage Sub-categories for {category.name}</DialogTitle>
                <DialogDescription>Add or remove sub-categories for this classification.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="flex gap-2">
                    <Input 
                        placeholder="New Sub-category Name..." 
                        value={newName} 
                        onChange={(e) => setNewName(e.target.value)} 
                        disabled={isSubmitting || !!editingId}
                    />
                    <Button onClick={handleAdd} disabled={isSubmitting || !newName.trim() || !!editingId}>
                        {isSubmitting && !editingId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    </Button>
                </div>
                <ScrollArea className="h-64 rounded-md border p-2">
                    <div className="space-y-2">
                        {loading ? (
                            <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                        ) : subCategories.map((sub, i) => (
                            <div key={sub.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 group">
                                {editingId === sub.id ? (
                                    <Input 
                                        value={editingName} 
                                        onChange={(e) => setEditingName(e.target.value)} 
                                        className="h-8 text-sm flex-1 mr-2 bg-background"
                                        autoFocus
                                    />
                                ) : (
                                    <span className="text-sm font-medium">{sub.name}</span>
                                )}
                                
                                <div className={cn("flex items-center gap-1", editingId !== sub.id && "opacity-0 group-hover:opacity-100 transition-opacity")}>
                                    {editingId === sub.id ? (
                                        <>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={() => handleUpdate(sub.id)} disabled={isSubmitting}>
                                                {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setEditingId(null)} disabled={isSubmitting}>
                                                <X className="h-3.5 w-3.5" />
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingId(sub.id); setEditingName(sub.name); }}>
                                                <Edit className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMove(i, 'up')} disabled={i === 0 || !!editingId}>
                                                <ArrowUp className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMove(i, 'down')} disabled={i === subCategories.length - 1 || !!editingId}>
                                                <ArrowDown className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(sub.id)} disabled={!!editingId}>
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                        {!loading && subCategories.length === 0 && (
                            <p className="text-center text-xs text-muted-foreground py-8 italic">No sub-categories yet.</p>
                        )}
                    </div>
                </ScrollArea>
            </div>
            <DialogFooter>
                <Button variant="secondary" onClick={onClose}>Done</Button>
            </DialogFooter>
        </DialogContent>
    );
};

const CategoryManager = ({ 
  categories, 
  onClose 
}: { 
  categories: InventoryCategory[], 
  onClose: () => void 
}) => {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [managingSubId, setManagingSubId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setIsSubmitting(true);
    try {
      const maxOrder = categories.reduce((max, c) => Math.max(max, c.order || 0), -1);
      await addDoc(collection(db, "inventoryCategories"), {
        name: newName.trim(),
        order: maxOrder + 1,
        createdAt: serverTimestamp(),
      });
      setNewName("");
      toast({ title: "Category added" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error adding category" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "inventoryCategories", id));
      toast({ title: "Category deleted" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error deleting category" });
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editingName.trim()) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, "inventoryCategories", id), {
        name: editingName.trim()
      });
      setEditingId(null);
      toast({ title: "Category updated" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error updating category" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const batch = writeBatch(db);
    const current = categories[index];
    const target = categories[targetIndex];

    batch.update(doc(db, "inventoryCategories", current.id), { order: target.order });
    batch.update(doc(db, "inventoryCategories", target.id), { order: current.order });

    try {
      await batch.commit();
    } catch (e) {
      toast({ variant: "destructive", title: "Error reordering" });
    }
  };

  const selectedCategory = categories.find(c => c.id === managingSubId);

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Manage Inventory Categories</DialogTitle>
        <DialogDescription>
          Add, delete or reorder categories for your inventory items.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="flex gap-2">
          <Input 
            placeholder="New Category Name..." 
            value={newName} 
            onChange={(e) => setNewName(e.target.value)} 
            disabled={isSubmitting || !!editingId}
          />
          <Button onClick={handleAdd} disabled={isSubmitting || !newName.trim() || !!editingId}>
            {isSubmitting && !editingId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
        <ScrollArea className="h-64 rounded-md border p-2">
          <div className="space-y-2">
            {categories.map((cat, i) => (
              <div key={cat.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 group">
                {editingId === cat.id ? (
                  <Input 
                    value={editingName} 
                    onChange={(e) => setEditingName(e.target.value)} 
                    className="h-8 text-sm flex-1 mr-2 bg-background"
                    autoFocus
                  />
                ) : (
                  <span className="text-sm font-medium">{cat.name}</span>
                )}
                
                <div className={cn("flex items-center gap-1", editingId !== cat.id && "opacity-0 group-hover:opacity-100 transition-opacity")}>
                  {editingId === cat.id ? (
                    <>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={() => handleUpdate(cat.id)} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setEditingId(null)} disabled={isSubmitting}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setManagingSubId(cat.id)} title="Manage Sub-categories">
                        <List className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingId(cat.id); setEditingName(cat.name); }}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMove(i, 'up')} disabled={i === 0 || !!editingId}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMove(i, 'down')} disabled={i === categories.length - 1 || !!editingId}>
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(cat.id)} disabled={!!editingId}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {categories.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-8 italic">No categories yet.</p>
            )}
          </div>
        </ScrollArea>
      </div>
      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>Done</Button>
      </DialogFooter>

      {/* Nested Sub-category manager */}
      <Dialog open={!!managingSubId} onOpenChange={(o) => !o && setManagingSubId(null)}>
        {selectedCategory && <SubCategoryManager category={selectedCategory} onClose={() => setManagingSubId(null)} />}
      </Dialog>
    </DialogContent>
  );
};

export default function InventoryPage() {
  const { user, canViewAllCampuses } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [allAppUsers, setAllAppUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [viewingItem, setViewingItem] = useState<InventoryItem | null>(null);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isSubCategoryManagerOpen, setIsSubCategoryManagerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // User Lookup States
  const [isUserLookupOpen, setIsUserLookupOpen] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState("");

  // Sub-category state for form
  const [activeSubCategories, setActiveSubCategories] = useState<SubCategory[]>([]);

  // Filtering states
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterSubCategory, setFilterSubCategory] = useState("all");
  const [filterCampus, setFilterCampus] = useState("all");
  const [filterResponsible, setFilterResponsible] = useState("all");
  const [filterAddedBy, setFilterAddedBy] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCondition, setFilterCondition] = useState("all");
  const [filterDateRange, setFilterDateRange] = useState<DateRange | undefined>();

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    subCategory: "",
    assignedCampus: "",
    description: "",
    responsiblePerson: "",
    quantity: 0,
    inStock: 0,
    damaged: 0,
    loss: 0,
    inUse: 0,
    comments: ""
  });

  useEffect(() => {
    const q = query(collection(db, "inventory"), orderBy("createdAt", "desc"));
    const unsubscribeItems = onSnapshot(q, (snapshot) => {
      const inventoryList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as InventoryItem));
      setItems(inventoryList);
      setLoading(false);
    });

    const catQ = query(collection(db, "inventoryCategories"), orderBy("order", "asc"));
    const unsubscribeCats = onSnapshot(catQ, (snapshot) => {
      const catList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as InventoryCategory));
      setCategories(catList);
    });

    const fetchCampuses = async () => {
        const snap = await getDocs(query(collection(db, "Campus"), orderBy("Campus Name")));
        setCampuses(snap.docs.map(d => ({id: d.id, ...d.data()} as Campus)));
    };
    fetchCampuses();
    
    const fetchUsers = async () => {
        const snap = await getDocs(query(collection(db, "users"), orderBy("displayName")));
        setAllAppUsers(snap.docs.map(d => ({id: d.id, ...d.data()} as User)));
    };
    fetchUsers();

    return () => {
      unsubscribeItems();
      unsubscribeCats();
    };
  }, [db]);

  // Auto-calculate total quantity whenever components change
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      quantity: prev.inStock + prev.damaged + prev.inUse + prev.loss
    }));
  }, [formData.inStock, formData.damaged, formData.inUse, formData.loss]);

  // Handle category selection in form to fetch sub-categories
  useEffect(() => {
      if (formData.category) {
          const cat = categories.find(c => c.name === formData.category);
          if (cat) {
              const q = query(collection(db, "inventoryCategories", cat.id, "subCategories"), orderBy("order", "asc"));
              getDocs(q).then(snap => {
                  setActiveSubCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as SubCategory)));
              });
          }
      } else {
          setActiveSubCategories([]);
      }
  }, [formData.category, categories, db]);

  const uniqueResponsible = useMemo(() => {
    return Array.from(new Set(items.map(i => i.responsiblePerson).filter(Boolean))).sort();
  }, [items]);

  const uniqueAddedBy = useMemo(() => {
    return Array.from(new Set(items.map(i => i.addedBy).filter(Boolean))).sort();
  }, [items]);

  const uniqueSubCategories = useMemo(() => {
    return Array.from(new Set(items.map(i => i.subCategory).filter(Boolean))).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    let result = items;
    
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(item => 
        item.name.toLowerCase().includes(q) || 
        item.responsiblePerson.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (item.category || "").toLowerCase().includes(q)
      );
    }
    
    if (filterCategory !== "all") result = result.filter(item => item.category === filterCategory);
    if (filterSubCategory !== "all") result = result.filter(item => item.subCategory === filterSubCategory);
    if (filterResponsible !== "all") result = result.filter(item => item.responsiblePerson === filterResponsible);
    if (filterAddedBy !== "all") result = result.filter(item => item.addedBy === filterAddedBy);
    
    if (filterCampus !== "all") {
        const campusObj = campuses.find(c => c.id === filterCampus);
        if (campusObj) result = result.filter(item => item.assignedCampus === campusObj["Campus Name"]);
    }

    if (filterStatus !== "all") {
      switch (filterStatus) {
        case "in-stock": result = result.filter(item => item.inStock > 0); break;
        case "out-of-stock": result = result.filter(item => item.inStock === 0); break;
        case "low-stock": result = result.filter(item => item.inStock > 0 && item.inStock < 5); break;
      }
    }

    if (filterCondition !== "all") {
      switch (filterCondition) {
        case "damaged": result = result.filter(item => item.damaged > 0); break;
        case "loss": result = result.filter(item => item.loss > 0); break;
        case "in-use": result = result.filter(item => item.inUse > 0); break;
      }
    }

    if (filterDateRange?.from) {
      const start = startOfDay(filterDateRange.from);
      const end = filterDateRange.to ? endOfDay(filterDateRange.to) : endOfDay(filterDateRange.from);
      result = result.filter(item => {
        if (!item.createdAt) return false;
        const date = item.createdAt.toDate();
        return isWithinInterval(date, { start, end });
      });
    }

    return result;
  }, [items, searchTerm, filterCategory, filterSubCategory, filterResponsible, filterAddedBy, filterStatus, filterCondition, filterDateRange, filterCampus, campuses]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterCategory !== "all") count++;
    if (filterSubCategory !== "all") count++;
    if (filterCampus !== "all") count++;
    if (filterResponsible !== "all") count++;
    if (filterAddedBy !== "all") count++;
    if (filterStatus !== "all") count++;
    if (filterCondition !== "all") count++;
    if (filterDateRange?.from) count++;
    return count;
  }, [filterCategory, filterSubCategory, filterResponsible, filterAddedBy, filterStatus, filterCondition, filterDateRange, filterCampus]);

  const resetFilters = () => {
    setFilterCategory("all");
    setFilterSubCategory("all");
    setFilterCampus("all");
    setFilterResponsible("all");
    setFilterAddedBy("all");
    setFilterStatus("all");
    setFilterCondition("all");
    setFilterDateRange(undefined);
    setSearchTerm("");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (parseInt(value) || 0) : value
    }));
  };

  const handleSaveItem = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);

    try {
      if (editingItem) {
        const itemRef = doc(db, "inventory", editingItem.id);
        await updateDoc(itemRef, {
          ...formData,
          updatedAt: serverTimestamp(),
        });
        toast({ title: "Item Updated", description: `${formData.name} has been updated.` });
      } else {
        await addDoc(collection(db, "inventory"), {
          ...formData,
          addedBy: user.displayName || user.email,
          addedById: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        toast({ title: "Item Added", description: `${formData.name} has been added to inventory.` });
      }

      setIsSheetOpen(false);
      setEditingItem(null);
      setFormData({
        name: "", category: "", subCategory: "", assignedCampus: "", description: "", responsiblePerson: "",
        quantity: 0, inStock: 0, damaged: 0, loss: 0, inUse: 0, comments: ""
      });
    } catch (error) {
      console.error("Inventory save error:", error);
      toast({ variant: "destructive", title: "Save Failed" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    try {
      await deleteDoc(doc(db, "inventory", id));
      toast({ title: "Item Deleted" });
    } catch (error) {
      toast({ variant: "destructive", title: "Delete Failed" });
    }
  };

  const handleEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category || "",
      subCategory: item.subCategory || "",
      assignedCampus: item.assignedCampus || "",
      description: item.description || "",
      responsiblePerson: item.responsiblePerson || "",
      quantity: item.quantity || 0,
      inStock: item.inStock || 0,
      damaged: item.damaged || 0,
      loss: item.loss || 0,
      inUse: item.inUse || 0,
      comments: item.comments || ""
    });
    setIsSheetOpen(true);
  };

  const selectedCategoryObj = categories.find(c => c.name === formData.category);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="font-headline text-3xl font-bold md:text-4xl">Inventory Management</h1>
          <p className="text-muted-foreground">Track church assets, status, and responsibilities.</p>
        </div>
        <Button onClick={() => { setEditingItem(null); setIsSheetOpen(true); }} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" /> Add New Record
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search items, categories, responsible people..." 
                className="pl-10" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="relative h-10">
                  <ListFilter className="mr-2 h-4 w-4" />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px]">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
                <SheetHeader className="p-6 pb-0">
                  <SheetTitle>Filter Inventory</SheetTitle>
                  <SheetDescription>Refine the inventory list by specific criteria.</SheetDescription>
                </SheetHeader>
                <ScrollArea className="flex-1 px-6">
                  <div className="py-6 space-y-6">
                    <div className="space-y-2">
                      <Label>Assigned Campus</Label>
                      <Select value={filterCampus} onValueChange={setFilterCampus}>
                        <SelectTrigger>
                          <SelectValue placeholder="All Campuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Campuses</SelectItem>
                          {campuses.map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              {c["Campus Name"] === 'App Campus' ? 'All Campuses' : c["Campus Name"]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={filterCategory} onValueChange={setFilterCategory}>
                        <SelectTrigger>
                          <SelectValue placeholder="All Categories" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          {categories.map(cat => (
                            <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Sub-category</Label>
                      <Select value={filterSubCategory} onValueChange={setFilterSubCategory}>
                        <SelectTrigger>
                          <SelectValue placeholder="All Sub-categories" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Sub-categories</SelectItem>
                          {uniqueSubCategories.map(sub => (
                            <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Responsible Person</Label>
                      <Select value={filterResponsible} onValueChange={setFilterResponsible}>
                        <SelectTrigger>
                          <SelectValue placeholder="All Personnel" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Personnel</SelectItem>
                          {uniqueResponsible.map(name => (
                            <SelectItem key={name} value={name}>{name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Stock Status</Label>
                      <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger>
                          <SelectValue placeholder="Any Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Any Status</SelectItem>
                          <SelectItem value="in-stock">In Stock</SelectItem>
                          <SelectItem value="out-of-stock">Out of Stock</SelectItem>
                          <SelectItem value="low-stock">Low Stock (&lt; 5)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Condition & Usage</Label>
                      <Select value={filterCondition} onValueChange={setFilterCondition}>
                        <SelectTrigger>
                          <SelectValue placeholder="Any Condition" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Any Condition</SelectItem>
                          <SelectItem value="damaged">Has Damaged Units</SelectItem>
                          <SelectItem value="loss">Has Recorded Loss</SelectItem>
                          <SelectItem value="in-use">Currently In Use</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Date Added Range</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold">From</span>
                          <Input 
                            type="date" 
                            value={filterDateRange?.from ? format(filterDateRange.from, 'yyyy-MM-dd') : ''}
                            onChange={e => {
                              const from = e.target.value ? new Date(e.target.value + 'T00:00:00') : undefined;
                              setFilterDateRange(prev => ({ ...prev, from }));
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold">To</span>
                          <Input 
                            type="date" 
                            value={filterDateRange?.to ? format(filterDateRange.to, 'yyyy-MM-dd') : ''}
                            onChange={e => {
                              const to = e.target.value ? new Date(e.target.value + 'T23:59:59') : undefined;
                              setFilterDateRange(prev => ({ ...prev, to }));
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
                <SheetFooter className="p-6 border-t flex flex-col gap-2">
                  <Button variant="outline" onClick={resetFilters} className="w-full">Reset Filters</Button>
                  <SheetClose asChild>
                    <Button className="w-full">Apply Filters</Button>
                  </SheetClose>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px] whitespace-nowrap">ID</TableHead>
                  <TableHead className="whitespace-nowrap">Item</TableHead>
                  <TableHead className="whitespace-nowrap">Assigned Campus</TableHead>
                  <TableHead className="whitespace-nowrap">Category</TableHead>
                  <TableHead className="whitespace-nowrap">Sub-category</TableHead>
                  <TableHead className="whitespace-nowrap">Description</TableHead>
                  <TableHead className="whitespace-nowrap">Responsible</TableHead>
                  <TableHead className="text-center whitespace-nowrap">Total</TableHead>
                  <TableHead className="text-center whitespace-nowrap">In Stock</TableHead>
                  <TableHead className="text-center whitespace-nowrap">Damaged</TableHead>
                  <TableHead className="text-center whitespace-nowrap">Loss</TableHead>
                  <TableHead className="text-center whitespace-nowrap">In Use</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={13}><Skeleton className="h-10 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredItems.length > 0 ? (
                  filteredItems.map((item) => (
                    <TableRow key={item.id} className="group">
                      <TableCell className="font-mono text-[10px] uppercase text-muted-foreground whitespace-nowrap">{item.id.slice(0, 8)}</TableCell>
                      <TableCell 
                        className="font-medium whitespace-nowrap cursor-pointer hover:underline hover:text-primary transition-all"
                        onClick={() => setViewingItem(item)}
                      >
                        {item.name}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="secondary" className="text-[10px] whitespace-nowrap">
                            <MapPin className="h-3 w-3 mr-1" />
                            {item.assignedCampus === 'App Campus' ? 'All Campuses' : (item.assignedCampus || "Unassigned")}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="outline" className="text-[10px] font-bold uppercase whitespace-nowrap">{item.category || "Uncategorized"}</Badge>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{item.subCategory || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{item.description}</TableCell>
                      <TableCell className="text-xs font-semibold whitespace-nowrap">{item.responsiblePerson}</TableCell>
                      <TableCell className="text-center whitespace-nowrap">{item.quantity}</TableCell>
                      <TableCell className="text-center font-bold text-green-600 whitespace-nowrap">{item.inStock}</TableCell>
                      <TableCell className="text-center text-amber-600 whitespace-nowrap">{item.damaged}</TableCell>
                      <TableCell className="text-center text-red-600 whitespace-nowrap">{item.loss}</TableCell>
                      <TableCell className="text-center text-blue-600 whitespace-nowrap">{item.inUse}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditItem(item)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteItem(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-12 text-muted-foreground italic whitespace-nowrap">
                      No inventory records found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Sheet open={isSheetOpen} onOpenChange={(open) => {
          setIsSheetOpen(open);
          if (!open) {
              setEditingItem(null);
              setFormData({
                name: "", category: "", subCategory: "", assignedCampus: "", description: "", responsiblePerson: "",
                quantity: 0, inStock: 0, damaged: 0, loss: 0, inUse: 0, comments: ""
              });
          }
      }}>
        <SheetContent side="bottom" className="h-[75vh] rounded-t-3xl border-t-2 shadow-2xl flex flex-col p-0 overflow-hidden">
          <SheetHeader className="p-6 border-b shrink-0">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-full">
                    <Package className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <SheetTitle>{editingItem ? 'Edit' : 'Add New'} Inventory Record</SheetTitle>
                    <SheetDescription>{editingItem ? 'Update the details for this inventory item.' : 'Log a new church asset or equipment item.'}</SheetDescription>
                </div>
            </div>
          </SheetHeader>
          <form onSubmit={handleSaveItem} className="flex flex-col flex-1 overflow-hidden">
            <ScrollArea className="flex-1 px-6 py-6">
              <div className="space-y-8 max-w-4xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-primary border-b pb-1">Basic Info</h3>
                      <div className="space-y-2">
                          <Label htmlFor="name">Item Name</Label>
                          <Input id="name" name="name" value={formData.name} onChange={handleInputChange} placeholder="e.g., Sound Mixer" required />
                      </div>
                      <div className="space-y-2">
                          <Label>Assigned Campus</Label>
                          <Select 
                            value={formData.assignedCampus} 
                            onValueChange={(v) => setFormData(prev => ({ ...prev, assignedCampus: v }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select Campus..." />
                            </SelectTrigger>
                            <SelectContent>
                              {campuses.map(c => (
                                <SelectItem key={c.id} value={c["Campus Name"]}>
                                    {c["Campus Name"] === 'App Campus' ? 'All Campuses' : c["Campus Name"]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                      </div>
                      <div className="space-y-2">
                          <Label>Category</Label>
                          <div className="flex gap-2">
                            <Select 
                              value={formData.category} 
                              onValueChange={(v) => {
                                  setFormData(prev => ({ ...prev, category: v, subCategory: "" }));
                              }}
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Select Category..." />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map(cat => (
                                  <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Dialog open={isCategoryManagerOpen} onOpenChange={setIsCategoryManagerOpen}>
                              <DialogTrigger asChild>
                                <Button type="button" variant="outline" size="icon" className="shrink-0">
                                  <Settings2 className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <CategoryManager 
                                categories={categories} 
                                onClose={() => setIsCategoryManagerOpen(false)} 
                              />
                            </Dialog>
                          </div>
                      </div>
                      <div className="space-y-2">
                          <Label>Sub-category</Label>
                          <div className="flex gap-2">
                            <Select 
                              value={formData.subCategory} 
                              onValueChange={(v) => setFormData(prev => ({ ...prev, subCategory: v }))}
                              disabled={!formData.category}
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Select Sub-category..." />
                              </SelectTrigger>
                              <SelectContent>
                                {activeSubCategories.map(sub => (
                                  <SelectItem key={sub.id} value={sub.name}>{sub.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Dialog open={isSubCategoryManagerOpen} onOpenChange={setIsSubCategoryManagerOpen}>
                              <DialogTrigger asChild>
                                <Button type="button" variant="outline" size="icon" className="shrink-0" disabled={!formData.category}>
                                  <Settings2 className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              {selectedCategoryObj && (
                                <SubCategoryManager 
                                  category={selectedCategoryObj} 
                                  onClose={() => setIsSubCategoryManagerOpen(false)} 
                                />
                              )}
                            </Dialog>
                          </div>
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="responsiblePerson">Responsible Person / Department</Label>
                          <div className="relative">
                            <Input 
                                id="responsiblePerson" 
                                name="responsiblePerson" 
                                value={formData.responsiblePerson} 
                                onChange={handleInputChange} 
                                placeholder="e.g., Media Team" 
                                required 
                                className="pr-10"
                            />
                            <Popover border-none open={isUserLookupOpen} onOpenChange={setIsUserLookupOpen}>
                                <PopoverTrigger asChild>
                                    <Button 
                                        type="button"
                                        variant="ghost" 
                                        size="icon" 
                                        className="absolute right-0 top-0 h-10 w-10 text-muted-foreground hover:text-primary"
                                    >
                                        <UserIcon className="h-4 w-4" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0" align="end">
                                    <div className="p-3 border-b">
                                        <div className="relative">
                                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input 
                                                placeholder="Search users..." 
                                                className="pl-8 h-9" 
                                                value={userSearchTerm}
                                                onChange={e => setUserSearchTerm(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <ScrollArea className="h-72">
                                        <div className="p-2 space-y-1">
                                            {allAppUsers
                                                .filter(u => 
                                                    !userSearchTerm || 
                                                    (u.displayName || "").toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                                                    (u.email || "").toLowerCase().includes(userSearchTerm.toLowerCase())
                                                )
                                                .map(u => (
                                                    <Button
                                                        key={u.id}
                                                        variant="ghost"
                                                        className="w-full justify-start font-normal h-auto py-2 px-3"
                                                        onClick={() => {
                                                            setFormData(prev => ({ ...prev, responsiblePerson: u.displayName || u.email || '' }));
                                                            setIsUserLookupOpen(false);
                                                            setUserSearchTerm("");
                                                        }}
                                                    >
                                                        <Avatar className="h-6 w-6 mr-2">
                                                            <AvatarImage src={u.photoURL || ""} />
                                                            <AvatarFallback className="text-[10px]">{getInitials(u.displayName)}</AvatarFallback>
                                                        </Avatar>
                                                        <div className="text-left overflow-hidden">
                                                            <p className="text-sm font-medium truncate">{u.displayName}</p>
                                                            <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                                                        </div>
                                                    </Button>
                                                ))
                                            }
                                            {allAppUsers.length === 0 && <p className="text-center text-xs text-muted-foreground py-4">No users found.</p>}
                                        </div>
                                    </ScrollArea>
                                </PopoverContent>
                            </Popover>
                          </div>
                      </div>
                  </div>

                  <div className="space-y-4">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-primary border-b pb-1">Quantity & Status</h3>
                      <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                              <Label htmlFor="quantity">Total Quantity (Auto-calculated)</Label>
                              <Input id="quantity" name="quantity" type="number" value={formData.quantity} readOnly className="bg-muted cursor-not-allowed" />
                          </div>
                          <div className="space-y-2">
                              <Label htmlFor="inStock">In Stock</Label>
                              <Input id="inStock" name="inStock" type="number" value={formData.inStock} onChange={handleInputChange} min="0" />
                          </div>
                          <div className="space-y-2">
                              <Label htmlFor="damaged">Damaged</Label>
                              <Input id="damaged" name="damaged" type="number" value={formData.damaged} onChange={handleInputChange} min="0" />
                          </div>
                          <div className="space-y-2">
                              <Label htmlFor="loss">Loss</Label>
                              <Input id="loss" name="loss" type="number" value={formData.loss} onChange={handleInputChange} min="0" />
                          </div>
                          <div className="space-y-2 col-span-2">
                              <Label htmlFor="inUse">In Use</Label>
                              <Input id="inUse" name="inUse" type="number" value={formData.inUse} onChange={handleInputChange} min="0" />
                          </div>
                      </div>
                      <div className="space-y-2 pt-4">
                          <Label htmlFor="description">Description</Label>
                          <Textarea id="description" name="description" value={formData.description} onChange={handleInputChange} placeholder="Technical specs or location..." className="min-h-[100px]" />
                      </div>
                  </div>
                </div>

                <div className="space-y-2 border-t pt-4">
                  <Label htmlFor="comments">Internal Comments</Label>
                  <Textarea id="comments" name="comments" value={formData.comments} onChange={handleInputChange} placeholder="Any specific notes or warnings..." />
                </div>
              </div>
            </ScrollArea>

            <div className="p-6 border-t bg-background shrink-0 flex justify-end gap-3">
              <SheetClose asChild>
                  <Button variant="outline" type="button">Cancel</Button>
              </SheetClose>
              <Button type="submit" disabled={isSubmitting || !formData.name}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingItem ? 'Update' : 'Save'} Record
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <Dialog open={!!viewingItem} onOpenChange={(open) => !open && setViewingItem(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="p-6 pb-2 shrink-0 border-b">
            <DialogTitle>{viewingItem?.name}</DialogTitle>
            <DialogDescription>
              Full details and status for this inventory record.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 px-6">
            {viewingItem && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Classification</Label>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{viewingItem.category}</Badge>
                      {viewingItem.subCategory && <Badge variant="secondary">{viewingItem.subCategory}</Badge>}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Assigned Campus</Label>
                    <p className="text-sm flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      {viewingItem.assignedCampus === 'App Campus' ? 'All Campuses' : viewingItem.assignedCampus}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Responsible Person</Label>
                    <p className="text-sm flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      {viewingItem.responsiblePerson}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Description</Label>
                    <p className="text-sm bg-muted/30 p-3 rounded-md border whitespace-pre-wrap">{viewingItem.description || "No description provided."}</p>
                  </div>
                </div>

                <div className="space-y-4">
                   <h3 className="text-sm font-bold uppercase tracking-wider text-primary border-b pb-1">Stock Status</h3>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Total Quantity</Label>
                        <p className="text-2xl font-bold">{viewingItem.quantity}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">In Stock</Label>
                        <p className="text-2xl font-bold text-green-600">{viewingItem.inStock}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Damaged</Label>
                        <p className="text-2xl font-bold text-amber-600">{viewingItem.damaged}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Loss</Label>
                        <p className="text-2xl font-bold text-red-600">{viewingItem.loss}</p>
                      </div>
                      <div className="space-y-1 col-span-2">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Currently In Use</Label>
                        <p className="text-2xl font-bold text-blue-600">{viewingItem.inUse}</p>
                      </div>
                   </div>
                   {viewingItem.comments && (
                     <div className="space-y-1 mt-4">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Internal Comments</Label>
                        <p className="text-sm italic text-muted-foreground">{viewingItem.comments}</p>
                     </div>
                   )}
                </div>
                
                <div className="col-span-full border-t pt-4 mt-2">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-[10px] text-muted-foreground uppercase font-bold gap-2">
                        <span>Record Created: {viewingItem.createdAt instanceof Timestamp ? format(viewingItem.createdAt.toDate(), 'PPP p') : 'N/A'}</span>
                        <span>Added By: {viewingItem.addedBy}</span>
                    </div>
                </div>
              </div>
            )}
          </ScrollArea>
          <div className="p-4 border-t bg-background shrink-0 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setViewingItem(null)}>Close</Button>
            <Button onClick={() => { 
                const item = viewingItem!;
                setViewingItem(null); 
                handleEditItem(item); 
            }}>Edit Record</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
