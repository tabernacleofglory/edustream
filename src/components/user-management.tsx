
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { getFirebaseFirestore, getFirebaseApp, getFirebaseFunctions } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, query, orderBy, deleteDoc, setDoc, addDoc, serverTimestamp, where, documentId, writeBatch, getDoc, collectionGroup } from "firebase/firestore";
import { getAuth, deleteUser as deleteFirebaseAuthUser } from "firebase/auth";
import { httpsCallable } from 'firebase/functions';
import type { User, Course, Enrollment, UserProgress as UserProgressType, Ladder, UserLadderProgress } from "@/lib/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
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
} from "@/components/ui/alert-dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { Edit, Eye, Loader2, Plus, Trash, Upload, Download, UserMinus, ChevronLeft, ChevronRight, Mail, BookCheck, Search, Star, Trash2, Combine } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "./ui/skeleton";
import AddUserForm from "./add-user-form";
import { Badge } from "./ui/badge";
import Papa from "papaparse";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { initializeApp, getApps, getApp } from "firebase/app";
import { createUserWithEmailAndPassword, updateProfile, signOut, sendPasswordResetEmail } from "firebase/auth";
import { Progress } from "./ui/progress";
import { ScrollArea } from "./ui/scroll-area";
import { unenrollUserFromCourse } from "@/lib/user-actions";
import EditUserForm from "./edit-user-form";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Checkbox } from "./ui/checkbox";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";

interface UserCourseProgress {
    courseId: string;
    courseTitle: string;
    totalProgress: number;
}

interface Campus {
    id: string;
    "Campus Name": string;
}

const secondaryAppName = "secondary";
let secondaryApp = getApps().find(app => app.name === secondaryAppName);
if (!secondaryApp) {
    const mainAppConfig = getApp().options;
    secondaryApp = initializeApp(mainAppConfig, secondaryAppName);
}
const secondaryAuth = getAuth(secondaryApp);

const ImportUsersDialog = ({ onImport }: { onImport: (users: any[]) => void }) => {
    const [file, setFile] = useState<File | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const { toast } = useToast();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
        }
    };

    const handleImport = () => {
        if (!file) {
            toast({
                variant: "destructive",
                title: "No file selected",
                description: "Please select a CSV file to import.",
            });
            return;
        }

        setIsParsing(true);
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                onImport(results.data);
                setIsParsing(false);
            },
            error: (error) => {
                toast({
                    variant: "destructive",
                    title: "CSV Parsing Error",
                    description: error.message,
                });
                setIsParsing(false);
            },
        });
    };
    
    const handleDownloadTemplate = () => {
        const headers = "fullName,email,password,membershipLadder,campus,phoneNumber,hpNumber,maritalStatus,ministry,charge";
        const exampleRow = "John Doe,john.doe@example.com,strongpassword123,New Member's Ladder,Main Campus,+15551234567,98765432,Single,Usher,Member";
        const csvContent = `${headers}\n${exampleRow}`;
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", "user_import_template.csv");
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Import Users from CSV</DialogTitle>
                <DialogDescription>
                    Select a CSV file with user data. The file should have columns for 'fullName', 'email', and 'password'.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                    <Label htmlFor="csv-file">CSV File</Label>
                    <Input id="csv-file" type="file" accept=".csv" onChange={handleFileChange} />
                </div>
            </div>
            <DialogFooter className="gap-2 sm:justify-end">
                 <Button variant="outline" onClick={handleDownloadTemplate}>
                    <Download className="mr-2 h-4 w-4" />
                    Download Template
                </Button>
                <Button onClick={handleImport} disabled={isParsing || !file}>
                    {isParsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    Import Users
                </Button>
            </DialogFooter>
        </DialogContent>
    );
};

const MergeUsersDialog = ({ userIds, onClose, onMergeComplete }: { userIds: string[], onClose: () => void, onMergeComplete: () => void }) => {
    const [usersToMerge, setUsersToMerge] = useState<User[]>([]);
    const [primaryUserId, setPrimaryUserId] = useState<string>('');
    const [mergedData, setMergedData] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [isMerging, setIsMerging] = useState(false);
    const db = getFirebaseFirestore();
    const { toast } = useToast();

    useEffect(() => {
        const fetchUsers = async () => {
            setLoading(true);
            const userDocs = await Promise.all(userIds.map(id => getDoc(doc(db, 'users', id))));
            const fetchedUsers = userDocs.map(d => ({ id: d.id, ...d.data() } as User)).filter(u => u.email);
            setUsersToMerge(fetchedUsers);
            if (fetchedUsers.length > 0) {
                setPrimaryUserId(fetchedUsers[0].id);
                // Initialize mergedData with the first user's data
                const initialData: Record<string, any> = {};
                Object.keys(fetchedUsers[0]).forEach(key => {
                    initialData[key] = { value: (fetchedUsers[0] as any)[key], from: fetchedUsers[0].id };
                });
                setMergedData(initialData);
            }
            setLoading(false);
        };
        fetchUsers();
    }, [userIds, db]);

    const allKeys = useMemo(() => {
        const keys = new Set<string>();
        usersToMerge.forEach(user => {
            Object.keys(user).forEach(key => {
                if (!['id', 'uid', 'createdAt', 'classLadderId'].includes(key)) {
                    keys.add(key);
                }
            });
        });
        return Array.from(keys);
    }, [usersToMerge]);

    const handleFieldSelection = (field: string, value: any, fromUserId: string) => {
        setMergedData(prev => {
            const next = { ...prev, [field]: { value, from: fromUserId } };
            // If the user selects a classLadder, also select the corresponding classLadderId
            if (field === 'classLadder') {
                const sourceUser = usersToMerge.find(u => u.id === fromUserId);
                if (sourceUser) {
                    next['classLadderId'] = { value: sourceUser.classLadderId, from: fromUserId };
                }
            }
            return next;
        });
    };

    const handleMerge = async () => {
        setIsMerging(true);
        try {
            const finalData: Record<string, any> = {};
            Object.keys(mergedData).forEach(key => {
                finalData[key] = mergedData[key].value;
            });
            
            const batch = writeBatch(db);
            const primaryUserRef = doc(db, 'users', primaryUserId);
            const secondaryUserIds = userIds.filter(id => id !== primaryUserId);

            // 1. Update primary user document
            batch.update(primaryUserRef, finalData);

            // 2. Re-attribute data from secondary users
            const collectionsToReattribute = ["enrollments", "userVideoProgress", "userQuizResults", "promotionRequests", "onsiteCompletions", "userBadges"];
            
            for (const userId of secondaryUserIds) {
                for (const collectionName of collectionsToReattribute) {
                    const snapshot = await getDocs(query(collection(db, collectionName), where("userId", "==", userId)));
                    snapshot.forEach(docToMove => {
                        const newId = docToMove.id.replace(userId, primaryUserId);
                        const newDocRef = doc(db, collectionName, newId);
                        batch.set(newDocRef, { ...docToMove.data(), userId: primaryUserId });
                        batch.delete(docToMove.ref);
                    });
                }
            }

            // 3. Delete secondary user Firestore documents
            secondaryUserIds.forEach(userId => {
                batch.delete(doc(db, 'users', userId));
            });
            
            await batch.commit();

            toast({ title: "Merge Successful", description: "User data has been merged. Please manually delete the old auth accounts from the Firebase Console." });
            onMergeComplete();
            onClose();

        } catch (error: any) {
            console.error("Merge error:", error);
            toast({ variant: 'destructive', title: "Merge Failed", description: error.message });
        } finally {
            setIsMerging(false);
        }
    };
    
    return (
        <DialogContent className="max-w-4xl">
            <DialogHeader>
                <DialogTitle>Merge Users</DialogTitle>
                <DialogDescription>Select the primary user and choose which data to keep from each profile. The primary user's account will be kept, and the others will be deleted.</DialogDescription>
            </DialogHeader>
            {loading ? <Loader2 className="mx-auto h-8 w-8 animate-spin" /> : (
                <div className="space-y-4">
                    <div>
                        <Label>Select Primary User (Account to Keep)</Label>
                        <Select value={primaryUserId} onValueChange={setPrimaryUserId}>
                            <SelectTrigger><SelectValue placeholder="Select primary user..." /></SelectTrigger>
                            <SelectContent>
                                {usersToMerge.map(user => (
                                    <SelectItem key={user.id} value={user.id}>{user.displayName} ({user.email})</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <ScrollArea className="h-[50vh]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Field</TableHead>
                                    {usersToMerge.map(user => (
                                        <TableHead key={user.id} className="text-center">{user.displayName}</TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {allKeys.map(key => (
                                    <TableRow key={key}>
                                        <TableCell className="font-semibold capitalize">{key.replace(/([A-Z])/g, ' $1')}</TableCell>
                                        {usersToMerge.map(user => (
                                            <TableCell key={user.id}>
                                                <div className="flex items-center gap-2">
                                                    <RadioGroup
                                                        value={mergedData[key]?.from === user.id ? user.id : ''}
                                                        onValueChange={() => handleFieldSelection(key, (user as any)[key], user.id)}
                                                    >
                                                        <RadioGroupItem value={user.id} />
                                                    </RadioGroup>
                                                    <span className="text-xs">{String((user as any)[key] ?? 'N/A')}</span>
                                                </div>
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </div>
            )}
             <DialogFooter>
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button onClick={handleMerge} disabled={isMerging || loading}>
                    {isMerging ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Combine className="mr-2 h-4 w-4" />}
                    Merge Users
                </Button>
            </DialogFooter>
        </DialogContent>
    );
};

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [ladders, setLadders] = useState<Ladder[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [allCampuses, setAllCampuses] = useState<Campus[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isImportUserOpen, setIsImportUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [viewingUserProgress, setViewingUserProgress] = useState<UserCourseProgress[]>([]);
  const [viewingUserLadderProgress, setViewingUserLadderProgress] = useState<UserLadderProgress[]>([]);
  const [viewingUserCompletions, setViewingUserCompletions] = useState<Set<string>>(new Set());
  const [isProgressLoading, setIsProgressLoading] = useState(false);
  const { toast } = useToast();
  const db = getFirebaseFirestore();
  const functions = getFirebaseFunctions();
  const { user: currentUser, canViewAllCampuses, hasPermission, isCurrentUserAdmin } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCampus, setSelectedCampus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage, setUsersPerPage] = useState(10);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  
  const canDeleteUsers = hasPermission('deleteUsersClientSide');

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const usersCollection = collection(db, "users");
      const usersSnapshot = await getDocs(usersCollection);
      const usersList = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      
      const laddersQuery = query(collection(db, "courseLevels"), orderBy("order"));
      const laddersSnapshot = await getDocs(laddersQuery);
      const laddersList = laddersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ladder));
      
      const coursesSnapshot = await getDocs(collection(db, 'courses'));
      const coursesList = coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
      
      const campusSnapshot = await getDocs(query(collection(db, "Campus"), orderBy("Campus Name")));
      const campusList = campusSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Campus));

      usersList.sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));
      setUsers(usersList);
      setLadders(laddersList);
      setCourses(coursesList);
      setAllCampuses(campusList);

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
    fetchAllData();
  }, [fetchAllData]);
  
 const filteredUsers = useMemo(() => {
    return users.filter(user => {
        const lowercasedSearch = searchTerm.toLowerCase();
        const matchesSearch = searchTerm === '' ||
            user.displayName?.toLowerCase().includes(lowercasedSearch) ||
            user.email?.toLowerCase().includes(lowercasedSearch) ||
            user.phoneNumber?.toLowerCase().includes(lowercasedSearch) ||
            user.role?.toLowerCase().includes(lowercasedSearch) ||
            user.charge?.toLowerCase().includes(lowercasedSearch);
        
        let matchesCampus = true;
        if (!canViewAllCampuses) {
            matchesCampus = user.campus === currentUser?.campus;
        } else if (selectedCampus !== 'all') {
            const selectedCampusObject = allCampuses.find(c => c.id === selectedCampus);
            matchesCampus = user.campus === selectedCampusObject?.["Campus Name"];
        }

        return matchesSearch && matchesCampus;
    });
}, [users, searchTerm, selectedCampus, currentUser, canViewAllCampuses, allCampuses]);

  
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * usersPerPage, currentPage * usersPerPage);

  const fetchUserProgressAndCompletions = useCallback(async (user: User) => {
    if (!user?.id || courses.length === 0) return;
    setIsProgressLoading(true);
    try {
        const enrollmentsQuery = query(collection(db, 'enrollments'), where('userId', '==', user.id));
        const onsiteQuery = query(collection(db, 'onsiteCompletions'), where('userId', '==', user.id));

        const [enrollmentsSnapshot, onsiteSnapshot] = await Promise.all([
          getDocs(enrollmentsQuery),
          getDocs(onsiteQuery)
        ]);

        const allCompletedCourseIds = new Set<string>();
        onsiteSnapshot.forEach(doc => {
            allCompletedCourseIds.add(doc.data().courseId);
        });

        const enrolledCourseIds = enrollmentsSnapshot.docs.map(doc => (doc.data() as Enrollment).courseId);

        if (enrolledCourseIds.length === 0) {
            setViewingUserProgress([]);
            setViewingUserLadderProgress([]);
            setViewingUserCompletions(allCompletedCourseIds);
            setIsProgressLoading(false);
            return;
        }

        const coursesQuery = query(collection(db, 'courses'), where(documentId(), 'in', enrolledCourseIds));
        const coursesSnapshot = await getDocs(coursesQuery);
        const enrolledCourses = coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));

        const progressQuery = query(collection(db, 'userVideoProgress'), where('userId', '==', user.id));
        const progressSnapshot = await getDocs(progressQuery);
        const progressDocs = progressSnapshot.docs.map(doc => doc.data() as UserProgressType);
        
        const progressByCourse: { [courseId: string]: { completedVideos: Set<string> }} = {};
        progressDocs.forEach(progressDoc => {
            if (!progressByCourse[progressDoc.courseId]) {
                progressByCourse[progressDoc.courseId] = { completedVideos: new Set() };
            }
            if (progressDoc.videoProgress) {
                progressDoc.videoProgress.forEach(vp => {
                    if (vp.completed) progressByCourse[progressDoc.courseId].completedVideos.add(vp.videoId);
                });
            }
        });
        
        const detailedCourseProgress = enrolledCourses
            .filter(course => course.language === user.language) // Filter by user language
            .map(course => {
                const totalVideos = course.videos?.length || 0;
                const completedCount = progressByCourse[course.id]?.completedVideos.size || 0;
                const totalProgress = totalVideos > 0 ? Math.round((completedCount / totalVideos) * 100) : 0;
                if (totalProgress === 100) {
                    allCompletedCourseIds.add(course.id);
                }
                return {
                    courseId: course.id,
                    courseTitle: course.title,
                    totalProgress: totalProgress
                }
            })
            .sort((a, b) => a.courseTitle.localeCompare(b.courseTitle)); // Sort alphabetically

        setViewingUserProgress(detailedCourseProgress);
        setViewingUserCompletions(allCompletedCourseIds);

        const ladderProgressData: UserLadderProgress[] = ladders.map(ladder => {
            const coursesInLadder = courses.filter(c => 
                c.ladderIds?.includes(ladder.id) && c.language === user.language
            );
            const totalCourses = coursesInLadder.length;
            const completedCourses = coursesInLadder.filter(c => allCompletedCourseIds.has(c.id)).length;
            const progress = totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0;

            return {
                ladderId: ladder.id,
                ladderName: ladder.name,
                ladderSide: ladder.side,
                progress: progress,
                totalCourses: totalCourses,
                completedCourses: completedCourses
            }
        }).filter(lp => lp.totalCourses > 0);

        setViewingUserLadderProgress(ladderProgressData);

    } catch (error) {
        console.error("Error fetching user progress:", error);
        toast({ variant: 'destructive', title: 'Could not fetch user progress.' });
    } finally {
        setIsProgressLoading(false);
    }
  }, [toast, ladders, courses, db]);

  useEffect(() => {
    if (viewingUser) {
        fetchUserProgressAndCompletions(viewingUser);
    }
  }, [viewingUser, fetchUserProgressAndCompletions]);

  const handleRoleChange = async (userId: string, newRole: 'user' | 'admin' | string) => {
    const userDocRef = doc(db, "users", userId);
    const roleInLowercase = newRole.toLowerCase();
    try {
        await updateDoc(userDocRef, { role: roleInLowercase });
        setUsers(users.map(u => u.id === userId ? { ...u, role: roleInLowercase as User['role'] } : u));
        toast({
            title: "Success",
            description: "User role updated successfully."
        })
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to update user role."
        })
    }
  };
  
  const handleCampusChange = async (userId: string, campusName: string) => {
    const userDocRef = doc(db, "users", userId);
    try {
        await updateDoc(userDocRef, { campus: campusName });
        setUsers(users.map(u => u.id === userId ? { ...u, campus: campusName } : u));
        toast({
            title: "Success",
            description: "User campus updated successfully."
        })
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to update user campus."
        })
    }
  };

  const handleLadderChange = async (userId: string, newLadderId: string) => {
    const userDocRef = doc(db, "users", userId);
    const ladder = ladders.find(l => l.id === newLadderId);
    if (!ladder) return;
    try {
        await updateDoc(userDocRef, { 
            classLadderId: newLadderId,
            classLadder: ladder.name
        });
        setUsers(users.map(u => u.id === userId ? { ...u, classLadderId: newLadderId, classLadder: ladder.name } : u));
         toast({
            title: "Success",
            description: "User membership ladder updated successfully."
        })
    } catch (error) {
         toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to update membership ladder."
        })
    }
  };
  
  const handleDeleteSelected = async () => {
    if (selectedUserIds.length === 0) return;
    if (!canDeleteUsers) {
        toast({
            variant: 'destructive',
            title: 'Permission Denied',
            description: 'You do not have permission to delete users.',
        });
        return;
    }

    toast({ title: `Starting deletion of ${selectedUserIds.length} users...` });
    
    try {
        const batch = writeBatch(db);
        selectedUserIds.forEach(userId => {
            const userRef = doc(db, 'users', userId);
            batch.delete(userRef);
        });
        await batch.commit();

        toast({ title: "Users Deleted", description: `${selectedUserIds.length} user document(s) have been deleted.` });
        setSelectedUserIds([]);
        fetchAllData(); // Refresh data
    } catch (error: any) {
        console.error(`Failed to delete users:`, error);
        toast({
            variant: 'destructive',
            title: `Failed to delete users`,
            description: error.message || "An unknown error occurred.",
        });
    }
  };

  const handleUnenroll = async (userId: string, courseId: string) => {
      const result = await unenrollUserFromCourse(userId, courseId);
      if (result.success) {
          toast({ title: 'Success', description: result.message });
          if(viewingUser) {
              fetchUserProgressAndCompletions(viewingUser); // Refresh the progress list
          }
      } else {
          toast({ variant: 'destructive', title: 'Error', description: result.message });
      }
  }

  const handleUserAdded = (newUser: User) => {
    setUsers(prevUsers => [newUser, ...prevUsers]);
    setIsAddUserOpen(false);
  }

  const handleUserUpdated = () => {
    setEditingUser(null);
    fetchAllData();
  }

  const handleUsersImported = async (importedUsers: any[]) => {
      setIsImportUserOpen(false);
      let successCount = 0;
      let errorCount = 0;

      toast({
          title: `Starting user import...`,
          description: `Attempting to import ${importedUsers.length} users.`,
      });

      for (const userData of importedUsers) {
          try {
              if (!userData.email || !userData.password || !userData.fullName) {
                  throw new Error(`Skipping row, missing required fields (email, password, fullName).`);
              }
              const userCredential = await createUserWithEmailAndPassword(secondaryAuth, userData.email, userData.password);
              const user = userCredential.user;

              await updateProfile(user, {
                  displayName: userData.fullName
              });

              const newUserForDb: Partial<User> = {
                  uid: user.uid,
                  id: user.uid,
                  displayName: userData.fullName,
                  fullName: userData.fullName,
                  email: userData.email,
                  role: 'user',
                  membershipStatus: 'Active',
                  classLadder: userData.membershipLadder || 'New Member',
                  campus: userData.campus,
                  phoneNumber: userData.phoneNumber,
                  hpNumber: userData.hpNumber,
                  maritalStatus: userData.maritalStatus,
                  ministry: userData.ministry,
                  charge: userData.charge,
                  createdAt: serverTimestamp()
              };

              await setDoc(doc(db, "users", user.uid), newUserForDb);
              
              if (secondaryAuth.currentUser?.id === user.uid) {
                  await signOut(secondaryAuth);
              }
              
              successCount++;
          } catch (error: any) {
              errorCount++;
              console.error(`Failed to import user ${userData.email}:`, error);
          }
      }

      toast({
          title: "Import Complete",
          description: `${successCount} users imported successfully. ${errorCount} users failed.`,
      });
      fetchAllData();
  }

  const getInitials = (name?: string | null) => {
    if (!name) return 'U';
    const names = name.split(' ');
    const initials = names.map(n => n[0]).join('');
    return initials.toUpperCase();
  }
  
  const getUserLadderName = (classLadderId?: string) => {
    const ladder = ladders.find(l => l.id === classLadderId);
    if (!ladder) return 'Not assigned';
    return `${ladder.name} ${ladder.side !== 'none' ? `(${ladder.side})` : ''}`;
  }
  
  const handleRowClick = (user: User) => {
    setViewingUser(user);
  };

  const handleActionClick = (e: React.MouseEvent<HTMLButtonElement>, action: () => void) => {
    e.stopPropagation();
    action();
  }

  const viewingUserIndex = viewingUser ? users.findIndex(u => u.id === viewingUser.id) : -1;

  const handlePreviousUser = () => {
      if (viewingUserIndex > 0) {
          setViewingUser(users[viewingUserIndex - 1]);
      }
  };

  const handleNextUser = () => {
      if (viewingUserIndex < users.length - 1) {
          setViewingUser(users[viewingUserIndex + 1]);
      }
  };

    const handleExportCSV = () => {
        if (filteredUsers.length === 0) {
            toast({ variant: 'destructive', title: 'No users to export' });
            return;
        }

        const dataToExport = filteredUsers.map(user => ({
            "User ID": user.id,
            "Full Name": user.fullName,
            "Email": user.email,
            "Role": user.role,
            "Membership Status": user.membershipStatus,
            "Membership Ladder": getUserLadderName(user.classLadderId),
            "Campus": user.campus,
            "Phone Number": user.phoneNumber,
            "HP Number": user.hpNumber,
            "Marital Status": user.maritalStatus,
            "Ministry": user.ministry,
            "Charge": user.charge,
        }));

        const csv = Papa.unparse(dataToExport);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "users_export.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSendResetLink = async (email?: string | null) => {
        if (!email) {
            toast({ variant: 'destructive', title: 'No email found for this user.' });
            return;
        }
        try {
            await sendPasswordResetEmail(getAuth(), email);
            toast({ title: 'Password Reset Email Sent', description: `An email has been sent to ${email}.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error Sending Email', description: error.message });
        }
    };
    
    const LadderProgressStars = ({ user }: { user: User }) => {
        const ladder = ladders.find(l => l.id === user.classLadderId);
        if (!ladder) return <p className="text-sm text-muted-foreground">Not assigned to a ladder.</p>;
    
        const coursesInLadder = courses.filter(c =>
            c.ladderIds?.includes(ladder.id) &&
            c.language === user.language
        );
    
        if (coursesInLadder.length === 0) {
            return <p className="text-sm text-muted-foreground">No courses for this ladder in your language.</p>;
        }
    
        const completedCoursesInLadder = coursesInLadder.filter(c => viewingUserCompletions.has(c.id));
    
        return (
            <div>
                <p className="font-semibold mb-2">Ladder Progress: {ladder.name}</p>
                <div className="flex items-center gap-1">
                    <TooltipProvider>
                        {completedCoursesInLadder.map((course, index) => (
                            <Tooltip key={index}>
                                <TooltipTrigger asChild>
                                    <span tabIndex={0}>
                                        <Star className="h-6 w-6 text-yellow-500 fill-yellow-400" />
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{course.title}</p>
                                </TooltipContent>
                            </Tooltip>
                        ))}
                    </TooltipProvider>
                </div>
            </div>
        );
    };

    const handleToggleAllOnPage = () => {
        if (selectedUserIds.length === paginatedUsers.length) {
            setSelectedUserIds([]);
        } else {
            setSelectedUserIds(paginatedUsers.map(u => u.id));
        }
    };

    const handleToggleUserSelection = (userId: string) => {
        setSelectedUserIds(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

  return (
    <>
    <Card>
      <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <CardTitle>All Users</CardTitle>
            <CardDescription>
                Found {filteredUsers.length} users matching your filters.
            </CardDescription>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={handleExportCSV} className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Download CSV
            </Button>
            <Dialog open={isImportUserOpen} onOpenChange={setIsImportUserOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" className="w-full">
                        <Upload className="mr-2 h-4 w-4" />
                        Import CSV
                    </Button>
                </DialogTrigger>
                <ImportUsersDialog onImport={handleUsersImported} />
            </Dialog>
            <Sheet open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                <SheetTrigger asChild>
                    <Button className="w-full">
                        <Plus className="mr-2 h-4 w-4" />
                        Add User
                    </Button>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-md p-0">
                    <SheetHeader className="p-6">
                        <SheetTitle>Create a New User</SheetTitle>
                        <SheetDescription>
                            Enter the details below to create a new user account.
                        </SheetDescription>
                    </SheetHeader>
                    <ScrollArea className="h-[calc(100vh-100px)]">
                        <div className="p-6 pt-0">
                          <AddUserForm onUserAdded={handleUserAdded} ladders={ladders}/>
                        </div>
                    </ScrollArea>
                </SheetContent>
            </Sheet>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                    placeholder="Search name, email, phone, role, or charge..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
             <Select value={selectedCampus} onValueChange={setSelectedCampus} disabled={!canViewAllCampuses}>
                <SelectTrigger className="w-full md:w-[200px]">
                    <SelectValue placeholder="Filter by campus" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Campuses</SelectItem>
                    {allCampuses.map(campus => (
                        <SelectItem key={campus.id} value={campus.id}>{campus["Campus Name"]}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {selectedUserIds.length > 1 && (
                <Dialog open={isMergeDialogOpen} onOpenChange={setIsMergeDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline">
                            <Combine className="mr-2 h-4 w-4" />
                            Merge ({selectedUserIds.length})
                        </Button>
                    </DialogTrigger>
                    {isMergeDialogOpen && <MergeUsersDialog userIds={selectedUserIds} onClose={() => setIsMergeDialogOpen(false)} onMergeComplete={fetchAllData} />}
                </Dialog>
            )}
            {selectedUserIds.length > 0 && (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Selected ({selectedUserIds.length})
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete {selectedUserIds.length} user(s). This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteSelected}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </div>
        <div className="overflow-x-auto">
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead className="w-12">
                    <Checkbox
                        checked={selectedUserIds.length === paginatedUsers.length && paginatedUsers.length > 0}
                        onCheckedChange={handleToggleAllOnPage}
                        aria-label="Select all rows on this page"
                    />
                </TableHead>
                <TableHead>User</TableHead>
                <TableHead>Campus</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Membership Ladder</TableHead>
                <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {loading ? (
                    Array.from({ length: 3 }).map((_, index) => (
                        <TableRow key={index}>
                            <TableCell><Skeleton className="h-5 w-5" /></TableCell>
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    <Skeleton className="h-10 w-10 rounded-full" />
                                    <div className="space-y-1">
                                        <Skeleton className="h-4 w-32" />
                                        <Skeleton className="h-3 w-40" />
                                    </div>
                                </div>
                            </TableCell>
                             <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-[120px]" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-[180px]" /></TableCell>
                            <TableCell className="text-right">
                            <Skeleton className="h-8 w-8 rounded-md" />
                            </TableCell>
                        </TableRow>
                    ))
                ) : (
                    paginatedUsers.map((user) => (
                    <TableRow key={user.id} onClick={() => handleRowClick(user)} className="cursor-pointer" data-state={selectedUserIds.includes(user.id) ? "selected" : ""}>
                         <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                                checked={selectedUserIds.includes(user.id)}
                                onCheckedChange={() => handleToggleUserSelection(user.id)}
                                aria-label={`Select user ${user.displayName}`}
                            />
                        </TableCell>
                        <TableCell>
                        <div className="flex items-center gap-3">
                            <Avatar>
                            <AvatarImage src={user.photoURL || undefined} alt={user.displayName || ""} />
                            <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-medium hover:underline">
                                    {user.displayName} {user.charge && `(${user.charge})`}
                                </p>
                                <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                        </div>
                        </TableCell>
                         <TableCell>
                           {isCurrentUserAdmin ? (
                               <Select value={user.campus} onValueChange={(value) => handleCampusChange(user.id, value)}>
                                   <SelectTrigger className="w-[180px]">
                                       <SelectValue placeholder="Select Campus" />
                                   </SelectTrigger>
                                   <SelectContent>
                                       <SelectItem value="All Campuses">All Campuses</SelectItem>
                                       {allCampuses.filter(c => c["Campus Name"] !== 'All Campuses').map(campus => (
                                           <SelectItem key={campus.id} value={campus["Campus Name"]}>{campus["Campus Name"]}</SelectItem>
                                       ))}
                                   </SelectContent>
                               </Select>
                           ) : (
                               <Badge variant="outline">{user.campus || 'N/A'}</Badge>
                           )}
                        </TableCell>
                        <TableCell>
                            <Select value={user.role} onValueChange={(value) => handleRoleChange(user.id, value)}>
                                <SelectTrigger className="w-[120px]">
                                    <SelectValue placeholder="Select Role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="moderator">Moderator</SelectItem>
                                    <SelectItem value="team">Team</SelectItem>
                                    <SelectItem value="user">User</SelectItem>
                                    {isCurrentUserAdmin && <SelectItem value="developer">Developer</SelectItem>}
                                </SelectContent>
                            </Select>
                        </TableCell>
                        <TableCell>
                            <Select value={user.classLadderId} onValueChange={(value) => handleLadderChange(user.id, value)}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder={getUserLadderName(user.classLadderId)} />
                                </SelectTrigger>
                                <SelectContent>
                                    {ladders.map(ladder => (
                                        <SelectItem key={ladder.id} value={ladder.id}>{ladder.name} {ladder.side !== 'none' && `(${ladder.side})`}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </TableCell>
                        <TableCell className="text-right">
                           <div className="flex justify-end gap-1">
                             <Button variant="ghost" size="icon" onClick={(e) => handleActionClick(e, () => setViewingUser(user))}>
                                <Eye className="h-4 w-4" />
                                <span className="sr-only">View Details</span>
                            </Button>
                            <Button 
                                size="icon"
                                className="text-white bg-gradient-to-r from-pink-500 to-orange-400 hover:from-pink-600 hover:to-orange-500" 
                                onClick={(e) => handleActionClick(e, () => setEditingUser(user))}
                            >
                                <Edit className="h-4 w-4" />
                                <span className="sr-only">Edit User</span>
                            </Button>
                           </div>
                        </TableCell>
                    </TableRow>
                    ))
                )}
            </TableBody>
            </Table>
        </div>
         {!loading && users.length === 0 && (
            <div className="text-center p-8 text-muted-foreground">
                No users found in the database.
            </div>
        )}
      </CardContent>
       {totalPages > 1 && (
        <CardFooter className="flex justify-end items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Rows per page</span>
                <Select value={`${usersPerPage}`} onValueChange={value => setUsersPerPage(Number(value))}>
                    <SelectTrigger className="w-[70px]">
                        <SelectValue placeholder={`${usersPerPage}`} />
                    </SelectTrigger>
                    <SelectContent>
                        {[10, 25, 50, 100].map(size => (
                            <SelectItem key={size} value={`${size}`}>{size}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}>
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>
                    Next
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </CardFooter>
      )}
      </Card>
      
      <Dialog open={!!viewingUser} onOpenChange={(isOpen) => !isOpen && setViewingUser(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              Viewing full profile for {viewingUser?.displayName}.
            </DialogDescription>
          </DialogHeader>
          {viewingUser && (
            <>
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-6 pt-4 pr-6">
                  <div className="flex items-center space-x-4">
                      <Avatar className="h-20 w-20">
                          <AvatarImage src={viewingUser.photoURL || undefined} />
                          <AvatarFallback className="text-3xl">{getInitials(viewingUser.displayName)}</AvatarFallback>
                      </Avatar>
                      <div>
                          <h3 className="text-xl font-bold">{viewingUser.displayName}</h3>
                          <p className="text-muted-foreground">{viewingUser.email}</p>
                          {viewingUser.classLadderId && <LadderProgressStars user={viewingUser} />}
                      </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                      {[
                        { label: 'First Name', value: viewingUser.firstName },
                        { label: 'Last Name', value: viewingUser.lastName },
                        { label: 'Gender', value: viewingUser.gender, capitalize: true },
                        { label: 'Age Range', value: viewingUser.ageRange },
                        { label: 'Phone Number', value: viewingUser.phoneNumber },
                        { label: 'Campus', value: viewingUser.campus },
                        { label: 'Language', value: viewingUser.language },
                        { label: 'Location Preference', value: viewingUser.locationPreference },
                        { label: 'Marital Status', value: viewingUser.maritalStatus },
                        { label: 'Ministry', value: viewingUser.ministry },
                        { label: 'HP Number', value: viewingUser.hpNumber },
                        { label: 'HP Facilitator', value: viewingUser.facilitatorName },
                        { label: 'Membership Ladder', value: getUserLadderName(viewingUser.classLadderId) },
                        { label: 'Charge', value: viewingUser.charge },
                        { label: 'Role', value: viewingUser.role, isBadge: true, variant: (viewingUser.role === 'admin' || viewingUser.role === 'developer' ? 'default' : 'secondary') },
                        { label: 'Membership Status', value: viewingUser.membershipStatus, isBadge: true, variant: 'secondary' },
                      ].map(field => (
                        <div key={field.label}>
                            <p className="font-semibold">{field.label}</p>
                            {field.isBadge ? (
                                <Badge variant={field.variant as any} className="capitalize">{field.value || "Not provided"}</Badge>
                            ) : (
                                <p className={field.capitalize ? 'capitalize' : ''}>{field.value || "Not provided"}</p>
                            )}
                        </div>
                      ))}
                      <div className="col-span-2">
                          <Label>Bio</Label>
                          <p className="text-sm text-muted-foreground p-3 bg-muted rounded-md min-h-[60px]">{viewingUser.bio || "No bio provided."}</p>
                      </div>
                      <div className="col-span-2">
                          <p className="font-semibold">User ID</p>
                          <p className="text-xs text-muted-foreground break-all">{viewingUser.id}</p>
                      </div>
                  </div>
                    <div>
                      <h4 className="font-semibold mb-2">Ladder Progress</h4>
                      {isProgressLoading ? (
                          <div className="space-y-2">
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                          </div>
                      ) : viewingUserLadderProgress.length > 0 ? (
                           <div className="space-y-4">
                                {viewingUserLadderProgress.map(p => (
                                    <div key={p.ladderId}>
                                      <p className="text-sm font-medium">{p.ladderName}</p>
                                      <div className="flex items-center gap-2">
                                        <Progress value={p.progress} className="h-2 flex-1" />
                                        <span className="text-xs text-muted-foreground">{p.progress}%</span>
                                      </div>
                                      <p className="text-xs text-muted-foreground">{p.completedCourses} / {p.totalCourses} courses completed</p>
                                    </div>
                                ))}
                           </div>
                      ) : (
                          <p className="text-sm text-muted-foreground">This user has not made progress on any ladders.</p>
                      )}
                  </div>
                  <div>
                      <h4 className="font-semibold mb-2">Enrolled Courses</h4>
                      {isProgressLoading ? (
                          <div className="space-y-2">
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                          </div>
                      ) : viewingUserProgress.length > 0 ? (
                           <div className="space-y-4">
                                {viewingUserProgress.map(p => (
                                    <div key={p.courseId} className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium">{p.courseTitle}</p>
                                            <div className="flex items-center gap-2">
                                                <Progress value={p.totalProgress} className="h-2 w-40" />
                                                <span className="text-xs text-muted-foreground">{p.totalProgress}%</span>
                                            </div>
                                        </div>
                                        <Button size="sm" variant="outline" onClick={() => handleUnenroll(viewingUser.id, p.courseId)}>
                                            <UserMinus className="mr-2 h-4 w-4" />
                                            Un-enroll
                                        </Button>
                                    </div>
                                ))}
                           </div>
                      ) : (
                          <p className="text-sm text-muted-foreground">This user is not enrolled in any courses.</p>
                      )}
                  </div>
              </div>
              </ScrollArea>
              <DialogFooter className="justify-between pt-4 border-t">
                  <div>
                      <Button variant="outline" size="icon" onClick={handlePreviousUser} disabled={viewingUserIndex <= 0}>
                          <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={handleNextUser} disabled={viewingUserIndex >= users.length - 1} className="ml-2">
                          <ChevronRight className="h-4 w-4" />
                      </Button>
                  </div>
                  <div className="flex gap-2">
                      <Button variant="outline" onClick={() => handleSendResetLink(viewingUser?.email)}>
                        <Mail className="mr-2 h-4 w-4" />
                        Send Reset Link
                      </Button>
                      <Button variant="secondary" onClick={() => setViewingUser(null)}>Close</Button>
                       <Button onClick={() => { setEditingUser(viewingUser); setViewingUser(null); }}>
                           <Edit className="mr-2 h-4 w-4" />
                           Edit
                       </Button>
                       <Button asChild>
                           <Link href={`/admin/users/${viewingUser?.id}`}>Go to User Profile</Link>
                       </Button>
                  </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Sheet open={!!editingUser} onOpenChange={(isOpen) => !isOpen && setEditingUser(null)}>
        <SheetContent className="w-full sm:max-w-md p-0">
          <SheetHeader className="p-6">
            <SheetTitle>Edit User: {editingUser?.displayName}</SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-80px)]">
            <div className="p-6 pt-0">
                {editingUser && <EditUserForm userToEdit={editingUser} onUserUpdated={handleUserUpdated} />}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
