

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { getFirebaseFirestore, getFirebaseApp } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, query, orderBy, deleteDoc, setDoc, addDoc, serverTimestamp, where, documentId } from "firebase/firestore";
import { getAuth, deleteUser } from "firebase/auth";
import type { User, Course, Enrollment, UserProgress as UserProgressType, Ladder, UserLadderProgress } from "@/lib/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter
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
import { Edit, Eye, Loader2, Plus, Trash, Upload, Download, UserMinus, ChevronLeft, ChevronRight, Mail, BookCheck, Search, Star } from "lucide-react";
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

interface UserCourseProgress {
    courseId: string;
    courseTitle: string;
    totalProgress: number;
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

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [ladders, setLadders] = useState<Ladder[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
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

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCampus, setSelectedCampus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage, setUsersPerPage] = useState(10);


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
      
      usersList.sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));
      setUsers(usersList);
      setLadders(laddersList);
      setCourses(coursesList);

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
        const matchesSearch = searchTerm === '' ||
            user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesCampus = selectedCampus === 'all' || 
            (user.campus && user.campus.toLowerCase() === selectedCampus.toLowerCase());

        return matchesSearch && matchesCampus;
    });
  }, [users, searchTerm, selectedCampus]);

  const allCampuses = useMemo(() => {
    const campusSet = new Set(users.map(u => u.campus).filter(Boolean));
    return Array.from(campusSet).sort();
  }, [users]);

  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * usersPerPage, currentPage * usersPerPage);

  const fetchUserProgressAndCompletions = useCallback(async (user: User) => {
    if (!user?.uid || courses.length === 0) return;
    setIsProgressLoading(true);
    try {
        const enrollmentsQuery = query(collection(db, 'enrollments'), where('userId', '==', user.uid));
        const onsiteQuery = query(collection(db, 'onsiteCompletions'), where('userId', '==', user.uid));

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

        const progressQuery = query(collection(db, 'userVideoProgress'), where('userId', '==', user.uid));
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
        
        const detailedCourseProgress = enrolledCourses.map(course => {
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
        });
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
        setUsers(users.map(u => u.id === userId ? { ...u, role: roleInLowercase } : u));
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

  const handleLadderChange = async (userId: string, newLadderId: string) => {
    const userDocRef = doc(db, "users", userId);
    try {
        await updateDoc(userDocRef, { classLadderId: newLadderId });
        setUsers(users.map(u => u.id === userId ? { ...u, classLadderId: newLadderId } : u));
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
  
  const handleDeleteUser = async (userId: string, userName: string) => {
    try {
        const userDocRef = doc(db, "users", userId);
        await deleteDoc(userDocRef);
        setUsers(prevUsers => prevUsers.filter(u => u.id !== userId));
        toast({
            title: "User Data Removed",
            description: `User ${userName}'s data has been removed from the database.`
        });
    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "Deletion Failed",
            description: "Could not delete user data from the database. " + error.message
        });
    }
  }

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
                  role: userData.role || 'user',
                  membershipStatus: userData.membershipStatus || 'Active',
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
              
              if (secondaryAuth.currentUser?.uid === user.uid) {
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
        if (users.length === 0) {
            toast({ variant: 'destructive', title: 'No users to export' });
            return;
        }

        const dataToExport = users.map(user => ({
            "User ID": user.uid,
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
    
    const LadderProgressStars = ({user}: {user: User}) => {
        const ladder = ladders.find(l => l.id === user.classLadderId);
        if (!ladder) return <p className="text-sm text-muted-foreground">Not assigned to a ladder.</p>;

        const coursesInLadder = courses.filter(c => 
            c.ladderIds?.includes(ladder.id) &&
            c.language === user.language // Filter by user's language
        );
        const totalCourses = coursesInLadder.length;

        if (totalCourses === 0) return <p className="text-sm text-muted-foreground">No courses for this ladder in your language.</p>;

        return (
            <div>
                 <p className="font-semibold mb-2">Ladder Progress: {ladder.name}</p>
                 <div className="flex items-center gap-1">
                    <TooltipProvider>
                    {Array.from({ length: totalCourses }).map((_, index) => {
                        const course = coursesInLadder[index];
                        const isCompleted = viewingUserCompletions.has(course.id);
                        return (
                             <Tooltip key={index}>
                                <TooltipTrigger asChild>
                                    <span tabIndex={0}>
                                        <Star className={cn("h-6 w-6", isCompleted ? "text-yellow-500 fill-yellow-400" : "text-gray-300 dark:text-gray-600")} />
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{course.title}</p>
                                </TooltipContent>
                            </Tooltip>
                        )
                    })}
                    </TooltipProvider>
                </div>
            </div>
        )
    };

  return (
    <>
    <Card>
      <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <CardTitle>All Users</CardTitle>
            <CardDescription>A list of all users in the system.</CardDescription>
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
                    placeholder="Search by name or email..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
             <Select value={selectedCampus} onValueChange={setSelectedCampus}>
                <SelectTrigger className="w-full md:w-[200px]">
                    <SelectValue placeholder="Filter by campus" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Campuses</SelectItem>
                    {allCampuses.map(campus => (
                        <SelectItem key={campus} value={campus}>{campus}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
        <div className="overflow-x-auto">
            <Table>
            <TableHeader>
                <TableRow>
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
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    <Skeleton className="h-10 w-10 rounded-full" />
                                    <div className="space-y-1">
                                        <Skeleton className="h-4 w-32" />
                                        <Skeleton className="h-3 w-40" />
                                    </div>
                                </div>
                            </TableCell>
                             <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-6 w-[120px]" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-[180px]" /></TableCell>
                            <TableCell className="text-right">
                            <Skeleton className="h-8 w-8 rounded-md" />
                            </TableCell>
                        </TableRow>
                    ))
                ) : (
                    paginatedUsers.map((user) => (
                    <TableRow key={user.id} onClick={() => handleRowClick(user)} className="cursor-pointer">
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
                            {user.campus || 'N/A'}
                        </TableCell>
                        <TableCell>
                             <Badge variant={user.role === 'admin' || user.role === 'developer' ? 'default' : 'secondary'} className="capitalize">
                                {user.role}
                            </Badge>
                        </TableCell>
                        <TableCell>
                            <Select value={user.classLadderId} onValueChange={(value) => handleLadderChange(user.id, value)}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Select Ladder" />
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
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="icon" onClick={(e) => e.stopPropagation()}>
                                        <Trash className="h-4 w-4" />
                                        <span className="sr-only">Delete User</span>
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action will delete the user's data from the database. It cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteUser(user.uid, user.displayName || 'user')}>
                                            Delete
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
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
                          <p className="text-xs text-muted-foreground break-all">{viewingUser.uid}</p>
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
                                        <Button size="sm" variant="outline" onClick={() => handleUnenroll(viewingUser.uid, p.courseId)}>
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
                       <Button onClick={() => setEditingUser(viewingUser)}>
                           <Edit className="mr-2 h-4 w-4" />
                           Edit
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

