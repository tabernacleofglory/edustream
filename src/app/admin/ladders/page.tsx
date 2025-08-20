
"use client";

import { useState, useEffect, useCallback } from "react";
import { getFirebaseFirestore } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, query, orderBy, deleteDoc, addDoc, serverTimestamp } from "firebase/firestore";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit, Plus, Trash, Loader2, Eye, Users as UsersIcon, Download, Award, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { Ladder, User } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Papa from "papaparse";
import DynamicIcon from "@/components/dynamic-icon";

const ICONS = [
    'Award', 'Badge', 'Bible', 'Book', 'Bookmark', 'Brain', 'Briefcase', 'Building', 'Castle', 'CheckCircle2',
    'ChevronUp', 'Circle', 'Clipboard', 'Cloud', 'Code', 'Compass', 'Cross', 'Crown', 'Diamond', 'Feather',
    'Flag', 'FlaskConical', 'Gem', 'GraduationCap', 'Hammer', 'Hand', 'Heart', 'Hexagon', 'Home', 'Key',
    'Leaf', 'LifeBuoy', 'Lightbulb', 'Link', 'Map', 'Medal', 'Milestone', 'Mountain', 'MousePointer',
    'Palette', 'Pen', 'Rocket', 'Settings', 'Shield', 'Sprout', 'Star', 'Sun', 'Target', 'Telescope',
    'Trophy', 'User', 'Users', 'Wrench'
];


export default function LadderManagementPage() {
    const [ladders, setLadders] = useState<Ladder[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
    const [newLadderName, setNewLadderName] = useState("");
    const [newLadderCategory, setNewLadderCategory] = useState<'membership' | 'leadership'>('membership');
    const [newLadderSide, setNewLadderSide] = useState<'ministry' | 'hp' | 'none'>('none');
    const [newLadderOrder, setNewLadderOrder] = useState(0);
    const [newLadderIcon, setNewLadderIcon] = useState("Award");
    const [editingLadder, setEditingLadder] = useState<Ladder | null>(null);
    const [viewingLadder, setViewingLadder] = useState<Ladder | null>(null);
    const db = getFirebaseFirestore();

    const fetchLaddersAndUsers = useCallback(async () => {
        setLoading(true);
        try {
            const laddersQuery = query(collection(db, "courseLevels"), orderBy("order"));
            const laddersSnapshot = await getDocs(laddersQuery);
            const laddersList = laddersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), side: doc.data().side || 'none' } as Ladder));
            setLadders(laddersList);
            
            const usersCollection = collection(db, "users");
            const usersSnapshot = await getDocs(usersCollection);
            const usersList = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
            setUsers(usersList);

        } catch (error) {
            console.error("Error fetching data: ", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to fetch data from the database."
            })
        } finally {
            setLoading(false);
        }
    }, [toast, db]);

    useEffect(() => {
        fetchLaddersAndUsers();
    }, [fetchLaddersAndUsers]);

    const handleAddLadder = async () => {
        if (!newLadderName.trim()) return;
        try {
            await addDoc(collection(db, "courseLevels"), {
                name: newLadderName.trim(),
                order: newLadderOrder,
                category: newLadderCategory,
                side: newLadderSide,
                icon: newLadderIcon,
                createdAt: serverTimestamp(),
            });
            fetchLaddersAndUsers();
            setIsDialogOpen(false);
            toast({ title: "Ladder Added" });
        } catch (error) {
            toast({ variant: "destructive", title: "Error adding ladder" });
        }
    };

    const handleUpdateLadder = async () => {
        if (!editingLadder || !editingLadder.name.trim()) return;
        try {
            const ladderRef = doc(db, "courseLevels", editingLadder.id);
            await updateDoc(ladderRef, {
                name: editingLadder.name,
                order: editingLadder.order,
                category: editingLadder.category,
                side: editingLadder.side,
                icon: editingLadder.icon,
            });
            fetchLaddersAndUsers();
            setEditingLadder(null);
            setIsDialogOpen(false);
            toast({ title: "Ladder Updated" });
        } catch (error) {
            toast({ variant: "destructive", title: "Error updating ladder" });
        }
    }

    const handleDeleteLadder = async (ladderId: string) => {
        try {
            await deleteDoc(doc(db, "courseLevels", ladderId));
            const updatedLadders = ladders.filter(l => l.id !== ladderId);
            setLadders(updatedLadders);
            toast({ title: "Ladder Removed" });
        } catch (error) {
            toast({ variant: "destructive", title: "Error removing ladder" });
        }
    }
    
    const openEditDialog = (ladder: Ladder) => {
        setEditingLadder(JSON.parse(JSON.stringify(ladder)));
        setIsDialogOpen(true);
    }
    
    const openViewDialog = (ladder: Ladder) => {
        setViewingLadder(ladder);
        setIsViewDialogOpen(true);
    }

    const openAddDialog = () => {
        setEditingLadder(null);
        setNewLadderName("");
        setNewLadderCategory("membership");
        setNewLadderSide("none");
        setNewLadderIcon("Award");
        const nextOrder = ladders.length > 0 ? Math.max(...ladders.map(l => l.order)) + 1 : 0;
        setNewLadderOrder(nextOrder);
        setIsDialogOpen(true);
    }
    
    const handleExportCSV = () => {
        if (ladders.length === 0) {
            toast({ variant: "destructive", title: "No data to export" });
            return;
        }

        const dataToExport = ladders.flatMap(ladder => {
            const usersInLadder = users.filter(user => user.classLadderId === ladder.id);
            if (usersInLadder.length === 0) {
                return [{
                    "Ladder Name": ladder.name,
                    "Category": ladder.category,
                    "Side": ladder.side,
                    "Priority": ladder.order,
                    "User Name": "N/A",
                    "User Email": "N/A"
                }];
            }
            return usersInLadder.map(user => ({
                "Ladder Name": ladder.name,
                "Category": ladder.category,
                "Side": ladder.side,
                "Priority": ladder.order,
                "User Name": user.displayName || "",
                "User Email": user.email || ""
            }));
        });

        const csv = Papa.unparse(dataToExport);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "ladder_management_report.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getInitials = (name?: string | null) => {
        if (!name) return 'U';
        const names = name.split(' ');
        const initials = names.map(n => n[0]).join('');
        return initials.toUpperCase();
    }
    
    const usersInLadder = viewingLadder ? users.filter(user => user.classLadderId === viewingLadder.id) : [];

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row justify-between items-start">
                    <div>
                        <CardTitle>Ladder Management</CardTitle>
                        <CardDescription>Add, edit, or remove ladders and set their priority.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={handleExportCSV} variant="outline">
                            <Download className="mr-2 h-4 w-4" />
                            Export CSV
                        </Button>
                        <Button onClick={openAddDialog}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Ladder
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Icon</TableHead>
                                <TableHead>Ladder Name</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Side</TableHead>
                                <TableHead>Priority (Order)</TableHead>
                                <TableHead>User Count</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center">
                                        <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                                    </TableCell>
                                </TableRow>
                            ) : (
                                ladders.map(ladder => {
                                    const userCount = users.filter(u => u.classLadderId === ladder.id).length;
                                    return (
                                        <TableRow key={ladder.id}>
                                             <TableCell>
                                                {ladder.icon ? <DynamicIcon name={ladder.icon} className="h-5 w-5" /> : <Shield className="h-5 w-5 text-muted-foreground" />}
                                            </TableCell>
                                            <TableCell>{ladder.name}</TableCell>
                                            <TableCell>
                                                <Badge variant={ladder.category === 'leadership' ? 'default' : 'secondary'} className="capitalize">
                                                    {ladder.category}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {ladder.side !== 'none' && (
                                                    <Badge variant={ladder.side === 'ministry' ? 'default' : 'secondary'} className="capitalize">
                                                        {ladder.side}
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>{ladder.order}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <UsersIcon className="h-4 w-4 text-muted-foreground" />
                                                    <span>{userCount}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => openViewDialog(ladder)}>
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => openEditDialog(ladder)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button variant="destructive" size="icon" onClick={() => handleDeleteLadder(ladder.id)}>
                                                    <Trash className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingLadder ? 'Edit Ladder' : 'Add New Ladder'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="ladderName">Ladder Name</Label>
                            <Input 
                                id="ladderName" 
                                value={editingLadder ? editingLadder.name : newLadderName}
                                onChange={(e) => {
                                    if (editingLadder) {
                                        setEditingLadder({ ...editingLadder, name: e.target.value });
                                    } else {
                                        setNewLadderName(e.target.value);
                                    }
                                }} 
                            />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="ladderCategory">Category</Label>
                            <Select 
                                value={editingLadder ? editingLadder.category : newLadderCategory}
                                onValueChange={(value: 'membership' | 'leadership') => {
                                     if (editingLadder) {
                                        setEditingLadder({ ...editingLadder, category: value });
                                    } else {
                                        setNewLadderCategory(value);
                                    }
                                }}
                            >
                                <SelectTrigger id="ladderCategory">
                                    <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="membership">Membership</SelectItem>
                                    <SelectItem value="leadership">Leadership</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ladderSide">Side</Label>
                            <Select
                                value={editingLadder ? editingLadder.side : newLadderSide}
                                onValueChange={(value: 'ministry' | 'hp' | 'none') => {
                                    if (editingLadder) {
                                        setEditingLadder({ ...editingLadder, side: value });
                                    } else {
                                        setNewLadderSide(value);
                                    }
                                }}
                            >
                                <SelectTrigger id="ladderSide">
                                    <SelectValue placeholder="Select a side" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    <SelectItem value="ministry">Ministry</SelectItem>
                                    <SelectItem value="hp">HP</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ladderOrder">Priority (Order)</Label>
                            <Input 
                                id="ladderOrder" 
                                type="number"
                                value={editingLadder ? editingLadder.order : newLadderOrder}
                                onChange={(e) => {
                                    const value = parseInt(e.target.value) || 0;
                                    if (editingLadder) {
                                        setEditingLadder({ ...editingLadder, order: value });
                                    } else {
                                        setNewLadderOrder(value);
                                    }
                                }}
                            />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="ladderIcon">Icon</Label>
                             <Select
                                value={editingLadder ? editingLadder.icon : newLadderIcon}
                                onValueChange={(value) => {
                                    if (editingLadder) {
                                        setEditingLadder({ ...editingLadder, icon: value });
                                    } else {
                                        setNewLadderIcon(value);
                                    }
                                }}
                            >
                                <SelectTrigger id="ladderIcon">
                                    <SelectValue placeholder="Select an icon" />
                                </SelectTrigger>
                                <SelectContent>
                                    {ICONS.map(iconName => (
                                        <SelectItem key={iconName} value={iconName}>
                                            <div className="flex items-center gap-2">
                                                <DynamicIcon name={iconName} className="h-4 w-4" />
                                                <span>{iconName}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="secondary" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={editingLadder ? handleUpdateLadder : handleAddLadder}>
                            {editingLadder ? 'Save Changes' : 'Add Ladder'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            
            <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Ladder Details: {viewingLadder?.name}</DialogTitle>
                        <DialogDescription>
                            Viewing details and enrolled users for this ladder.
                        </DialogDescription>
                    </DialogHeader>
                    {viewingLadder && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                    <p className="font-semibold">Category</p>
                                    <p className="capitalize">{viewingLadder.category}</p>
                                </div>
                                <div>
                                    <p className="font-semibold">Side</p>
                                    <p className="capitalize">{viewingLadder.side}</p>
                                </div>
                                <div>
                                    <p className="font-semibold">Priority</p>
                                    <p>{viewingLadder.order}</p>
                                </div>
                            </div>
                            <div>
                                <h4 className="font-semibold mb-2">Users in this Ladder ({usersInLadder.length})</h4>
                                <ScrollArea className="h-64 border rounded-md">
                                    {usersInLadder.length > 0 ? (
                                        usersInLadder.map(user => (
                                            <div key={user.id} className="flex items-center gap-3 p-2 border-b">
                                                <Avatar>
                                                    <AvatarImage src={user.photoURL || undefined} alt={user.displayName || ""} />
                                                    <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-medium">{user.displayName}</p>
                                                    <p className="text-sm text-muted-foreground">{user.email}</p>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-sm text-muted-foreground text-center p-4">No users are currently in this ladder.</p>
                                    )}
                                </ScrollArea>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="secondary" onClick={() => setIsViewDialogOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
