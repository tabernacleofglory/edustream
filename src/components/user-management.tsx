
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { getFirebaseFirestore, getFirebaseApp, getFirebaseFunctions } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, query, orderBy, deleteDoc, setDoc, addDoc, serverTimestamp, getDoc, where, documentId, writeBatch, collectionGroup, increment, limit, onSnapshot, DocumentSnapshot, Timestamp } from "firebase/firestore";
import { getAuth, createUserWithEmailAndPassword, updateProfile, signOut, sendPasswordResetEmail } from "firebase/auth";
import { httpsCallable } from 'firebase/functions';
import type { User, Course, Enrollment, UserProgress as UserProgressType, Ladder, UserLadderProgress, EmailTemplate, EmailLayoutSettings, Video, VideoProgress, PromotionRequest, OnsiteCompletion } from "@/lib/types";
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
    SelectGroup,
    SelectLabel,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
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
  SheetTrigger,
  SheetFooter,
  SheetClose,
  SheetDescription,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { Edit, Eye, Loader2, Plus, Trash, Upload, Download, UserMinus, ChevronLeft, ChevronRight, Mail, BookCheck, Search, Star, Trash2, Combine, User as UserIcon, CheckCircle2, Circle, X, Pin, ListFilter, Globe, ChevronDown } from "lucide-react";
import { Skeleton } from "./ui/skeleton";
import AddUserForm from "./add-user-form";
import { Badge } from "./ui/badge";
import Papa from "papaparse";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { initializeApp, getApps, getApp } from "firebase/app";
import { Progress } from "./ui/progress";
import { ScrollArea } from "./ui/scroll-area";
import { unenrollUserFromCourse } from "@/lib/user-actions";
import EditUserForm from "./edit-user-form";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { marked } from 'marked';
import { wrapInEmailLayout } from "@/lib/email-utils";
import { Checkbox } from "@/components/ui/checkbox";
import allLanguagesList from "@/lib/languages.json";

interface UserCourseProgress {
    courseId: string;
    courseTitle: string;
    totalProgress: number;
}

const getInitials = (name?: string | null) => {
    if (!name) return "U";
    const names = name.split(" ");
    return names.map((n) => n[0]).join("").toUpperCase();
};

const chunk = <T,>(arr: T[], size: number) => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
};

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
        const headers = "fullName,email,password,membershipLadder,campus,phoneNumber,hpNumber,facilitatorName,maritalStatus,ministry,charge";
        const exampleRow = "John Doe,john.doe@example.com,strongpassword123,New Member's Ladder,Main Campus,+15551234567,98765432,Jane Facilitator,Single,Usher,Member";
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

const SendEmailDialog = ({ user, onClose }: { user: User, onClose: () => void }) => {
    const [templates, setTemplates] = useState<EmailTemplate[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [loadingTemplates, setLoadingTemplates] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [emailLayout, setEmailLayout] = useState<EmailLayoutSettings | null>(null);
    const db = getFirebaseFirestore();
    const { toast } = useToast();

    useEffect(() => {
        const fetchTemplates = async () => {
            setLoadingTemplates(true);
            try {
                const [templatesSnap, layoutSnap] = await Promise.all([
                    getDocs(query(collection(db, 'emailTemplates'), orderBy('name', 'asc'))),
                    getDoc(doc(db, 'siteSettings', 'emailLayout'))
                ]);
                setTemplates(templatesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmailTemplate)));
                if (layoutSnap.exists()) setEmailLayout(layoutSnap.data() as EmailLayoutSettings);
            } catch (error) {
                toast({ variant: 'destructive', title: 'Failed to load templates' });
            } finally {
                setLoadingTemplates(false);
            }
        };
        fetchTemplates();
    }, [db, toast]);

    const handleSendEmail = async () => {
        if (!selectedTemplateId) {
            toast({ variant: 'destructive', title: 'Please select a template' });
            return;
        }
        setIsSending(true);
        try {
            const template = templates.find(t => t.id === selectedTemplateId);
            if (!template) throw new Error("Template not found");

            let subject = template.subject || '';
            let body = template.body || '';

            const placeholders: Record<string, any> = {
                userName: user.displayName || user.firstName || 'User',
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                email: user.email || '',
                phoneNumber: user.phoneNumber || '',
                campus: user.campus || '',
                hpNumber: user.hpNumber || '',
                facilitatorName: user.facilitatorName || '',
                classLadder: user.classLadder || '',
                ministry: user.ministry || '',
                charge: user.charge || '',
            };

            Object.entries(placeholders).forEach(([key, val]) => {
                const regex = new RegExp(`{{${key}}}`, "g");
                subject = subject.replace(regex, String(val ?? ''));
                body = body.replace(regex, String(val ?? ''));
            });

            const formPlaceholderRegex = /{{form:([^:]+):([^}]+)}}/g;
            const formTitleRegex = /{{formTitle:([^}]+)}}/g;
            
            const combinedText = subject + " " + body;
            const formMatches = Array.from(combinedText.matchAll(formPlaceholderRegex));
            const formTitleMatches = Array.from(combinedText.matchAll(formTitleRegex));
            
            const formIdsInUse = Array.from(new Set([
                ...formMatches.map(m => m[1]),
                ...formTitleMatches.map(m => m[1])
            ]));

            const formSubmissionsMap: Record<string, any> = {};
            const formTitlesMap: Record<string, string> = {};

            for (const fId of formIdsInUse) {
                try {
                    const formSnap = await getDoc(doc(db, 'forms', fId));
                    if (formSnap.exists()) {
                        formTitlesMap[fId] = formSnap.data().title || 'Untitled Form';
                    }
                } catch (e) {
                    console.warn(`Could not fetch form ${fId}:`, e);
                }

                const hasFieldMatch = formMatches.some(m => m[1] === fId);
                if (hasFieldMatch) {
                    const subQuery = query(
                        collection(db, 'forms', fId, 'submissions'),
                        where('userId', '==', user.id),
                        orderBy('submittedAt', 'desc'),
                        limit(1)
                    );
                    try {
                        const snap = await getDocs(subQuery);
                        if (!snap.empty) {
                            const subData = snap.docs[0].data();
                            formSubmissionsMap[fId] = subData.data || subData;
                        }
                    } catch (e) {
                        console.warn(`Could not fetch submission for form ${fId}:`, e);
                    }
                }
            }

            const formReplacer = (match: string, fId: string, fFieldId: string) => {
                const val = formSubmissionsMap[fId]?.[fFieldId];
                return val == null ? '' : Array.isArray(val) ? val.join(', ') : String(val);
            };
            subject = subject.replace(formPlaceholderRegex, formReplacer);
            body = body.replace(formPlaceholderRegex, formReplacer);

            const titleReplacer = (match: string, fId: string) => {
                return formTitlesMap[fId] || '';
            };
            subject = subject.replace(formTitleRegex, titleReplacer);
            body = body.replace(formTitleRegex, titleReplacer);

            const resolvedBody = body;
            const htmlContent = marked.parse(resolvedBody, { breaks: true });
            
            let finalHtml = `<div style="font-family:sans-serif;line-height:1.5;color:#2d3748;max-width:600px;margin:0 auto;">${htmlContent}</div>`;
            if (emailLayout) {
                finalHtml = wrapInEmailLayout(htmlContent, emailLayout, "View Student Dashboard", `${window.location.origin}/dashboard`);
            }

            await addDoc(collection(db, 'mail'), {
                to: [user.email],
                message: {
                    subject: subject,
                    html: finalHtml,
                },
                templateId: selectedTemplateId,
                userId: user.id
            });

            toast({ title: 'Email Queued', description: `Email for ${user.displayName} has been added to the queue.` });
            onClose();
        } catch (error: any) {
            console.error("Error queueing email:", error);
            toast({ variant: 'destructive', title: 'Send Failed', description: error.message });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Send Email to {user.displayName}</DialogTitle>
                <DialogDescription>Select an email template to send via the email extension.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
                {loadingTemplates ? (
                    <Skeleton className="h-10 w-full" />
                ) : (
                    <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select an email template..." />
                        </SelectTrigger>
                        <SelectContent>
                            {templates.map(template => (
                                <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>
            <DialogFooter>
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button onClick={handleSendEmail} disabled={isSending || loadingTemplates || !selectedTemplateId}>
                    {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Send Email
                </Button>
            </DialogFooter>
        </DialogContent>
    );
};

export default function UserManagement() {
  const { user: currentUser, canViewAllCampuses, hasPermission } = useAuth();
  const { toast } = useToast();
  const db = getFirebaseFirestore();
  const functions = getFirebaseFunctions();

  const [users, setUsers] = useState<User[]>([]);
  const [ladders, setLadders] = useState<Ladder[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [allCampuses, setAllCampuses] = useState<Campus[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [onsiteCompletions, setOnsiteCompletions] = useState<OnsiteCompletion[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isImportUserOpen, setIsImportUserOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [selectedExportFields, setSelectedExportFields] = useState<string[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [sendingEmailToUser, setSendingEmailToUser] = useState<User | null>(null);
  const [viewingUserProgress, setViewingUserProgress] = useState<UserCourseProgress[]>([]);
  const [viewingUserLadderProgress, setViewingUserLadderProgress] = useState<UserLadderProgress[]>([]);
  const [viewingUserCompletions, setViewingUserCompletions] = useState<Set<string>>(new Set());
  const [isProgressLoading, setIsProgressLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCampus, setSelectedCampus] = useState('all');
  const [filterRoles, setFilterRoles] = useState<string[]>([]);
  const [filterLadders, setFilterLadders] = useState<string[]>([]);
  const [filterBaptism, setFilterBaptism] = useState('all');
  const [filterGraduations, setFilterGraduations] = useState<string[]>([]);
  const [filterTrainingStatuses, setFilterTrainingStatuses] = useState<string[]>([]);
  const [filterCompletedCount, setFilterCompletedCount] = useState('all');

  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage, setUsersPerPage] = useState(10);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  
  const [datePickerDialog, setDatePickerDialog] = useState<{
    isOpen: boolean;
    type: 'baptism' | 'graduation';
    userId: string;
    userName: string;
    status: string | boolean;
  } | null>(null);
  const [selectedDate, setSelectedDate] = useState("");

  const isCurrentUserAdmin = currentUser?.role === 'admin' || currentUser?.role === 'developer';
  const canDeleteUsers = hasPermission('deleteUsersClientSide');
  const canManageUsers = hasPermission('manageUsers');

  const allRoles = useMemo(() => [
      { id: 'developer', name: 'Developer' },
      { id: 'admin', name: 'Admin' },
      { id: 'moderator', name: 'Moderator' },
      { id: 'team', name: 'Team' },
      { id: 'user', name: 'User' },
  ], []);

  const exportFields = useMemo(() => [
    { id: 'firstName', label: 'First Name' },
    { id: 'lastName', label: 'Last Name' },
    { id: 'email', label: 'Email' },
    { id: 'phoneNumber', label: 'Phone Number' },
    { id: 'campus', label: 'Campus' },
    { id: 'hpNumber', label: 'HP Number' },
    { id: 'facilitatorName', label: 'Facilitator Name' },
    { id: 'gender', label: 'Gender' },
    { id: 'ageRange', label: 'Age Range' },
    { id: 'maritalStatus', label: 'Marital Status' },
    { id: 'isBaptized', label: 'Baptism Status' },
    { id: 'baptismDate', label: 'Baptism Date' },
    { id: 'denomination', label: 'Denomination' },
    { id: 'language', label: 'Language' },
    { id: 'locationPreference', label: 'Location Preference' },
    { id: 'role', label: 'Role' },
    { id: 'classLadder', label: 'Membership Ladder' },
    { id: 'charge', label: 'Charge' },
    { id: 'graduationStatus', label: 'Graduation Status' },
    { id: 'graduationDate', label: 'Graduation Date' },
    { id: 'trainingStatus', label: 'Training Status (Filtered)' },
    { id: 'classCount', label: 'Class Count (Filtered)' },
  ], []);

  useEffect(() => {
    setSelectedExportFields(exportFields.map(f => f.id));
  }, [exportFields]);

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

      const enrollmentsSnap = await getDocs(collection(db, 'enrollments'));
      const onsiteSnap = await getDocs(collection(db, 'onsiteCompletions'));

      setEnrollments(enrollmentsSnap.docs.map(d => d.data() as Enrollment));
      setOnsiteCompletions(onsiteSnap.docs.map(d => d.data() as OnsiteCompletion));

      usersList.sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));
      setUsers(usersList);
      setLadders(laddersList);
      setCourses(coursesList);
      setAllCampuses(campusList);

    } catch (error) {
      console.error("Error fetching data: ", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to fetch data." })
    } finally {
      setLoading(false);
    }
  }, [toast, db]);


  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);
  
  const userTrainingStatusMap = useMemo(() => {
    const map = new Map<string, 'Completed' | 'In Progress' | 'Not Started'>();
    users.forEach(user => {
        if (!user.classLadderId) {
            map.set(user.id, 'Not Started');
            return;
        }
        const coursesInLadder = courses.filter(c => c.ladderIds?.includes(user.classLadderId!));
        if (coursesInLadder.length === 0) {
            map.set(user.id, 'Not Started');
            return;
        }
        
        const userEnrollments = enrollments.filter(e => e.userId === user.id);
        const userOnsite = onsiteCompletions.filter(oc => oc.userId === user.id);
        
        const completedIds = new Set([
            ...userEnrollments.filter(e => e.completedAt).map(e => e.courseId),
            ...userOnsite.map(oc => oc.courseId)
        ]);
        
        // Find all languages represented in this ladder
        const languages = Array.from(new Set(coursesInLadder.map(c => c.language).filter(Boolean)));
        
        // Check if all courses are completed in ANY of these languages
        const isLadderCompleted = languages.some(lang => {
            const langCourses = coursesInLadder.filter(c => c.language === lang);
            return langCourses.length > 0 && langCourses.every(c => completedIds.has(c.id));
        });

        if (isLadderCompleted) {
            map.set(user.id, 'Completed');
        } else {
            const hasAnyActivity = userEnrollments.some(e => coursesInLadder.some(c => c.id === e.courseId)) || 
                                   userOnsite.some(oc => coursesInLadder.some(c => c.id === oc.courseId));
            map.set(user.id, hasAnyActivity ? 'In Progress' : 'Not Started');
        }
    });
    return map;
  }, [users, courses, enrollments, onsiteCompletions]);

  const userCompletedCountMap = useMemo(() => {
    const map = new Map<string, number>();
    users.forEach(user => {
        const targetLadderId = filterLadders.length === 1 ? filterLadders[0] : user.classLadderId;
        if (!targetLadderId) {
            map.set(user.id, 0);
            return;
        }
        
        const userEnrollments = enrollments.filter(e => e.userId === user.id);
        const userOnsite = onsiteCompletions.filter(oc => oc.userId === user.id);
        
        const completedIds = new Set([
            ...userEnrollments.filter(e => e.completedAt).map(e => e.courseId),
            ...userOnsite.map(oc => oc.courseId)
        ]);
        
        const coursesInTargetLadder = courses.filter(c => c.ladderIds?.includes(targetLadderId));
        const completedInTargetCount = coursesInTargetLadder.filter(c => completedIds.has(c.id)).length;
        
        map.set(user.id, completedInTargetCount);
    });
    return map;
  }, [users, courses, enrollments, onsiteCompletions, filterLadders]);

  const maxCoursesForFilter = useMemo(() => {
    if (filterLadders.length > 0) {
        const ladderCourses = courses.filter(c => c.ladderIds?.some(id => filterLadders.includes(id)));
        const countsByLang: Record<string, number> = {};
        ladderCourses.forEach(c => {
            const lang = c.language || 'unknown';
            countsByLang[lang] = (countsByLang[lang] || 0) + 1;
        });
        return Math.max(0, ...Object.values(countsByLang));
    }
    
    let globalMax = 0;
    ladders.forEach(l => {
        const ladderCourses = courses.filter(c => c.ladderIds?.includes(l.id));
        const countsByLang: Record<string, number> = {};
        ladderCourses.forEach(c => {
            const lang = c.language || 'unknown';
            countsByLang[lang] = (countsByLang[lang] || 0) + 1;
        });
        const m = Math.max(0, ...Object.values(countsByLang));
        if (m > globalMax) globalMax = m;
    });
    return globalMax || 20; 
  }, [filterLadders, courses, ladders]);

  useEffect(() => {
    if (filterCompletedCount !== 'all') {
        const val = parseInt(filterCompletedCount, 10);
        if (val > maxCoursesForFilter) {
            setFilterCompletedCount('all');
        }
    }
  }, [maxCoursesForFilter, filterCompletedCount]);

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

        const matchesRole = filterRoles.length === 0 || filterRoles.includes(user.role!);
        const matchesLadder = filterLadders.length === 0 || (user.classLadderId && filterLadders.includes(user.classLadderId));
        const matchesBaptism = filterBaptism === 'all' || String(user.isBaptized) === filterBaptism;
        const matchesGraduation = filterGraduations.length === 0 || 
            (user.graduationStatus && filterGraduations.includes(user.graduationStatus)) ||
            (!user.graduationStatus && filterGraduations.includes('Empty'));
        const matchesTrainingStatus = filterTrainingStatuses.length === 0 || filterTrainingStatuses.includes(userTrainingStatusMap.get(user.id)!);
        const matchesCompletedCount = filterCompletedCount === 'all' || (
            (userCompletedCountMap.get(user.id) || 0) >= parseInt(filterCompletedCount, 10)
        );

        return matchesSearch && matchesCampus && matchesRole && matchesLadder && matchesBaptism && matchesGraduation && matchesTrainingStatus && matchesCompletedCount;
    });
}, [users, searchTerm, selectedCampus, currentUser, canViewAllCampuses, allCampuses, filterRoles, filterLadders, filterBaptism, filterGraduations, filterTrainingStatuses, userTrainingStatusMap, filterCompletedCount, userCompletedCountMap]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCampus !== 'all') count++;
    if (filterRoles.length > 0) count++;
    if (filterLadders.length > 0) count++;
    if (filterBaptism !== 'all') count++;
    if (filterGraduations.length > 0) count++;
    if (filterTrainingStatuses.length > 0) count++;
    if (filterCompletedCount !== 'all') count++;
    return count;
  }, [selectedCampus, filterRoles, filterLadders, filterBaptism, filterGraduations, filterTrainingStatuses, filterCompletedCount]);

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
        onsiteSnapshot.docs.forEach(doc => { allCompletedCourseIds.add(doc.data().courseId); });

        const enrolledCourseIds = enrollmentsSnapshot.docs.map(doc => (doc.data() as Enrollment).courseId);

        if (enrolledCourseIds.length === 0 && allCompletedCourseIds.size === 0) {
            setViewingUserProgress([]);
            setViewingUserLadderProgress([]);
            setViewingUserCompletions(new Set());
            setIsProgressLoading(false);
            return;
        }

        const progressQuery = query(collection(db, 'userVideoProgress'), where('userId', '==', user.id));
        const progressSnapshot = await getDocs(progressQuery);
        const progressDocs = progressSnapshot.docs.map(doc => doc.data() as UserProgressType);
        
        const progressByCourse: { [courseId: string]: { completedVideos: Set<string> }} = {};
        progressDocs.forEach(progressDoc => {
            if (!progressByCourse[progressDoc.courseId]) progressByCourse[progressDoc.courseId] = { completedVideos: new Set() };
            if (progressDoc.videoProgress) {
                progressDoc.videoProgress.forEach(vp => { if (vp.completed) progressByCourse[progressDoc.courseId].completedVideos.add(vp.videoId); });
            }
        });
        
        const relevantCourseIds = Array.from(new Set([...enrolledCourseIds, ...Array.from(allCompletedCourseIds)]));
        const courseChunks = chunk(relevantCourseIds, 10);
        const courseSnaps = await Promise.all(
            courseChunks.map(ids => getDocs(query(collection(db, 'courses'), where(documentId(), 'in', ids))))
        );
        const enrolledCourses = courseSnaps.flatMap(s => s.docs.map(d => ({ id: d.id, ...d.data() } as Course)));

        const detailedCourseProgress = enrolledCourses
            .map(course => {
                const totalVideos = course.videos?.length || 0;
                const completedCount = progressByCourse[course.id]?.completedVideos.size || 0;
                
                // Prioritize totalProgress field if available, fallback to manual calculation
                const storedProgress = progressDocs.find(p => p.courseId === course.id)?.totalProgress;
                const totalProgress = storedProgress !== undefined ? storedProgress : (totalVideos > 0 ? Math.round((completedCount / totalVideos) * 100) : 0);
                
                if (totalProgress === 100) allCompletedCourseIds.add(course.id);
                return { courseId: course.id, courseTitle: course.title, totalProgress };
            })
            .sort((a, b) => a.courseTitle.localeCompare(b.courseTitle));

        setViewingUserProgress(detailedCourseProgress);
        setViewingUserCompletions(allCompletedCourseIds);

        const ladderProgressData: UserLadderProgress[] = ladders.map(ladder => {
            const coursesInLadder = courses.filter(c => c.ladderIds?.includes(ladder.id));
            const languages = Array.from(new Set(coursesInLadder.map(c => c.language).filter(Boolean)));
            
            // Find progress for each language and take the max
            let maxProgress = 0;
            let bestTotal = 0;
            let bestCompleted = 0;

            languages.forEach(lang => {
                const langCourses = coursesInLadder.filter(c => c.language === lang);
                const total = langCourses.length;
                const completed = langCourses.filter(c => allCompletedCourseIds.has(c.id)).length;
                const prog = total > 0 ? Math.round((completed / total) * 100) : 0;
                if (prog >= maxProgress) {
                    maxProgress = prog;
                    bestTotal = total;
                    bestCompleted = completed;
                }
            });

            return { ladderId: ladder.id, ladderName: ladder.name, ladderSide: ladder.side, progress: maxProgress, totalCourses: bestTotal, completedCourses: bestCompleted };
        }).filter(lp => lp.totalCourses > 0);

        setViewingUserLadderProgress(ladderProgressData);
    } catch (error) {
        toast({ variant: 'destructive', title: 'Could not fetch user progress.' });
    } finally {
        setViewingUser(user);
        setIsProgressLoading(false);
    }
  }, [toast, ladders, courses, db]);

  useEffect(() => {
    if (viewingUser) fetchUserProgressAndCompletions(viewingUser);
  }, [viewingUser, fetchUserProgressAndCompletions]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    const userDocRef = doc(db, "users", userId);
    try {
        await updateDoc(userDocRef, { role: newRole });
        setUsers(users.map(u => u.id === userId ? { ...u, role: newRole as User['role'] } : u));
        toast({ title: "Success", description: "User role updated successfully." });
    } catch (error) {
        toast({ variant: "destructive", title: "Error", description: "Failed to update user role." });
    }
  };
  
  const handleCampusChange = async (userId: string, campusName: string) => {
    const userDocRef = doc(db, "users", userId);
    try {
        await updateDoc(userDocRef, { campus: campusName });
        setUsers(users.map(u => u.id === userId ? { ...u, campus: campusName } : u));
        toast({ title: "Success", description: "User campus updated successfully." });
    } catch (error) {
        toast({ variant: "destructive", title: "Error", description: "Failed to update user campus." });
    }
  };

  const handleLadderChange = async (userId: string, newLadderId: string) => {
    const userDocRef = doc(db, "users", userId);
    const ladder = ladders.find(l => l.id === newLadderId);
    if (!ladder) return;
    try {
        await updateDoc(userDocRef, { classLadderId: newLadderId, classLadder: ladder.name });
        setUsers(users.map(u => u.id === userId ? { ...u, classLadderId: newLadderId, classLadder: ladder.name } : u));
        toast({ title: "Success", description: "Membership ladder updated successfully." });
    } catch (error) {
         toast({ variant: "destructive", title: "Error", description: "Failed to update membership ladder." });
    }
  };

  const handleBaptismChange = async (userId: string, isBaptized: boolean) => {
    if (isBaptized) {
        const user = users.find(u => u.id === userId);
        setDatePickerDialog({ isOpen: true, type: 'baptism', userId, userName: user?.displayName || 'User', status: isBaptized });
        setSelectedDate("");
    } else {
        const userDocRef = doc(db, "users", userId);
        try {
            await updateDoc(userDocRef, { isBaptized: false, baptismDate: null });
            setUsers(users.map(u => u.id === userId ? { ...u, isBaptized: false, baptismDate: undefined } : u));
            toast({ title: "Success", description: "User baptism status updated." });
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to update baptism status." });
        }
    }
  };

  const handleGraduationStatusChange = async (userId: string, status: string) => {
    if (status === 'Graduated') {
        const user = users.find(u => u.id === userId);
        setDatePickerDialog({ isOpen: true, type: 'graduation', userId, userName: user?.displayName || 'User', status: status });
        setSelectedDate("");
    } else {
        const userDocRef = doc(db, "users", userId);
        try {
            await updateDoc(userDocRef, { graduationStatus: status, graduationDate: null });
            setUsers(users.map(u => u.id === userId ? { ...u, graduationStatus: status, graduationDate: undefined } : u));
            toast({ title: "Success", description: "User graduation status updated." });
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Failed to update graduation status." });
        }
    }
  };
  
  const handleSaveDate = async (skip: boolean = false) => {
    if (!datePickerDialog) return;
    const { userId, type, status } = datePickerDialog;
    const userDocRef = doc(db, "users", userId);
    try {
        const updateData: any = {};
        const dateToSave = skip ? null : selectedDate;
        if (type === 'baptism') {
            updateData.isBaptized = status;
            updateData.baptismDate = dateToSave;
        } else {
            updateData.graduationStatus = status;
            updateData.graduationDate = dateToSave;
        }
        await updateDoc(userDocRef, updateData);
        setUsers(users.map(u => u.id === userId ? { ...u, ...updateData } : u));
        toast({ title: "Success", description: `User ${type} updated.` });
        setDatePickerDialog(null);
    } catch (e) {
        toast({ variant: 'destructive', title: "Update failed" });
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedUserIds.length === 0) return;
    if (!canDeleteUsers) {
        toast({ variant: 'destructive', title: 'Permission Denied', description: 'You do not have permission to delete users.' });
        return;
    }
    try {
        const batch = writeBatch(db);
        selectedUserIds.forEach(userId => { batch.delete(doc(db, 'users', userId)); });
        await batch.commit();
        toast({ title: "Users Deleted", description: `${selectedUserIds.length} user(s) removed.` });
        setSelectedUserIds([]);
        fetchAllData();
    } catch (error: any) {
        toast({ variant: 'destructive', title: `Deletion failed`, description: error.message });
    }
  };

  const handleUnenroll = async (userId: string, courseId: string) => {
      const result = await unenrollUserFromCourse(userId, courseId);
      if (result.success) {
          toast({ title: 'Success', description: result.message });
          if(viewingUser) fetchUserProgressAndCompletions(viewingUser);
      } else {
          toast({ variant: 'destructive', title: 'Error', description: result.message });
      }
  }

  const handleUserAdded = (newUser: User) => {
    setUsers(prevUsers => [newUser, ...prevUsers]);
    setIsAddUserOpen(false);
  }

  const handleUserUpdated = () => { setEditingUser(null); fetchAllData(); }

  const handleUsersImported = async (importedUsers: any[]) => {
      setIsImportUserOpen(false);
      let successCount = 0;
      let errorCount = 0;
      for (const userData of importedUsers) {
          try {
              if (!userData.email || !userData.password || !userData.fullName) throw new Error(`Missing required fields.`);
              const userCredential = await createUserWithEmailAndPassword(secondaryAuth, userData.email, userData.password);
              const user = userCredential.user;
              await updateProfile(user, { displayName: userData.fullName });
              const newUserForDb: Partial<User> = {
                  uid: user.uid, id: user.uid, displayName: userData.fullName, fullName: userData.fullName, email: userData.email, role: 'user', membershipStatus: 'Active', classLadder: userData.membershipLadder || 'New Member', campus: userData.campus, phoneNumber: userData.phoneNumber, hpNumber: userData.hpNumber, facilitatorName: userData.facilitatorName, maritalStatus: userData.maritalStatus, ministry: userData.ministry, charge: userData.charge, createdAt: serverTimestamp()
              };
              await setDoc(doc(db, "users", user.uid), newUserForDb);
              if (secondaryAuth.currentUser?.uid === user.uid) await signOut(secondaryAuth);
              successCount++;
          } catch (error: any) { errorCount++; }
      }
      toast({ title: "Import Complete", description: `${successCount} successful, ${errorCount} failed.` });
      fetchAllData();
  }

  const getUserLadderName = (classLadderId?: string) => {
    const ladder = ladders.find(l => l.id === classLadderId);
    if (!ladder) return 'Not assigned';
    return `${ladder.name} ${ladder.side !== 'none' ? `(${ladder.side})` : ''}`;
  }
  
  const handleRowClick = (user: User) => { setViewingUser(user); };

  const handleActionClick = (e: React.MouseEvent<HTMLButtonElement>, action: () => void) => {
    e.stopPropagation();
    action();
  }

  const viewingUserIndex = viewingUser ? users.findIndex(u => u.id === viewingUser.id) : -1;

  const handlePreviousUser = () => { if (viewingUserIndex > 0) setViewingUser(users[viewingUserIndex - 1]); };
  const handleNextUser = () => { if (viewingUserIndex < users.length - 1) setViewingUser(users[viewingUserIndex + 1]); };

    const handleExportCSV = () => {
        if (filteredUsers.length === 0) { toast({ variant: 'destructive', title: 'No users to export' }); return; }
        if (selectedExportFields.length === 0) { toast({ variant: 'destructive', title: 'No fields selected' }); return; }

        const dataToExport = filteredUsers.map(user => {
            const row: any = {};
            if (selectedExportFields.includes('firstName')) row["First Name"] = user.firstName || user.displayName?.split(' ')[0] || '';
            if (selectedExportFields.includes('lastName')) row["Last Name"] = user.lastName || user.displayName?.split(' ').slice(1).join(' ') || '';
            if (selectedExportFields.includes('email')) row["Mail"] = user.email || '';
            if (selectedExportFields.includes('phoneNumber')) row["Phone"] = user.phoneNumber || '';
            if (selectedExportFields.includes('campus')) row["Campus"] = user.campus || '';
            if (selectedExportFields.includes('hpNumber')) row["HP"] = user.hpNumber || '';
            if (selectedExportFields.includes('facilitatorName')) row["Facilitator"] = user.facilitatorName || '';
            if (selectedExportFields.includes('gender')) row["Gender"] = user.gender || '';
            if (selectedExportFields.includes('ageRange')) row["Age Range"] = user.ageRange || '';
            if (selectedExportFields.includes('maritalStatus')) row["Marital Status"] = user.maritalStatus || '';
            if (selectedExportFields.includes('isBaptized')) row["Baptism Status"] = user.isBaptized ? 'Baptized' : 'Not Baptized';
            if (selectedExportFields.includes('baptismDate')) row["Baptism Date"] = user.baptismDate || '';
            if (selectedExportFields.includes('denomination')) row["Denomination"] = user.denomination || '';
            if (selectedExportFields.includes('language')) row["Language"] = user.language || '';
            if (selectedExportFields.includes('locationPreference')) row["Location Preference"] = user.locationPreference || '';
            if (selectedExportFields.includes('role')) row["Role"] = user.role || 'user';
            if (selectedExportFields.includes('classLadder')) row["Membership Ladder"] = getUserLadderName(user.classLadderId);
            if (selectedExportFields.includes('charge')) row["Charge"] = user.charge || '';
            if (selectedExportFields.includes('graduationStatus')) row["Graduation Status"] = user.graduationStatus || 'Not Started';
            if (selectedExportFields.includes('graduationDate')) row["Graduation Date"] = user.graduationDate || '';
            if (selectedExportFields.includes('trainingStatus')) row["Training Status"] = userTrainingStatusMap.get(user.id) || 'Not Started';
            if (selectedExportFields.includes('classCount')) row["Class Count"] = userCompletedCountMap.get(user.id) || 0;
            return row;
        });

        const csv = Papa.unparse(dataToExport);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `users_export_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        setIsExportDialogOpen(false);
    };
    
    const handleToggleAllOnPage = () => {
        if (selectedUserIds.length === paginatedUsers.length) setSelectedUserIds([]);
        else setSelectedUserIds(paginatedUsers.map(u => u.id));
    };

    const handleToggleUserSelection = (userId: string) => {
        setSelectedUserIds(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
    };
    
    const assignableRoles = useMemo(() => {
        const currentUserRole = currentUser?.role || 'user';
        const roleHierarchy: Record<string, string[]> = {
            developer: ['developer', 'admin', 'moderator', 'team', 'user'],
            admin: ['admin', 'moderator', 'team', 'user'],
            moderator: ['moderator', 'team', 'user'],
            team: ['team', 'user'],
            user: ['user']
        };
        const allowedRoleIds = roleHierarchy[currentUserRole] || ['user'];
        return allRoles.filter(role => allowedRoleIds.includes(role.id));
    }, [currentUser?.role, allRoles]);

    const completedCoursesList = useMemo(() => {
        if (!viewingUser) return [];
        return courses
          .filter(c => viewingUserCompletions.has(c.id))
          .map(c => ({
            courseId: c.id,
            courseTitle: c.title,
            totalProgress: 100,
            ladderIds: c.ladderIds || [],
          }))
          .sort((a, b) => a.courseTitle.localeCompare(b.courseTitle));
    }, [courses, viewingUserCompletions, viewingUser]);

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
                <CardTitle>All Users</CardTitle>
                <CardDescription>Found {filteredUsers.length} users.</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button variant="outline" onClick={() => setIsExportDialogOpen(true)} className="w-full"><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
                <Dialog open={isImportUserOpen} onOpenChange={setIsImportUserOpen}>
                    <DialogTrigger asChild><Button variant="outline" className="w-full"><Upload className="mr-2 h-4 w-4" /> Import CSV</Button></DialogTrigger>
                    <ImportUsersDialog onImport={handleUsersImported} />
                </Dialog>
                <Sheet open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                    <SheetTrigger asChild><Button className="w-full"><Plus className="mr-2 h-4 w-4" /> Add User</Button></SheetTrigger>
                    <SheetContent className="w-full sm:max-w-md p-0">
                        <SheetHeader className="p-6"><SheetTitle>Create User</SheetTitle></SheetHeader>
                        <ScrollArea className="h-[calc(100vh-100px)]"><div className="p-6 pt-0"><AddUserForm onUserAdded={handleUserAdded} ladders={ladders}/></div></ScrollArea>
                    </SheetContent>
                </Sheet>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            
            <Sheet>
                <SheetTrigger asChild>
                    <Button variant="outline" className="relative">
                        <ListFilter className="mr-2 h-4 w-4" />
                        Filters
                        {activeFilterCount > 0 && (
                            <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-[10px] bg-primary">
                                {activeFilterCount}
                            </Badge>
                        )}
                    </Button>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-md">
                    <SheetHeader>
                        <SheetTitle>Filter Users</SheetTitle>
                        <SheetDescription>Refine the user list based on specific criteria.</SheetDescription>
                    </SheetHeader>
                    <ScrollArea className="h-[calc(100vh-120px)]">
                        <div className="space-y-6 py-6 px-1">
                            <div className="space-y-2">
                                <Label>Campus</Label>
                                <Select value={selectedCampus} onValueChange={setSelectedCampus} disabled={!canViewAllCampuses}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All Campuses" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Campuses</SelectItem>
                                        {allCampuses.map(campus => <SelectItem key={campus.id} value={campus.id}>{campus["Campus Name"]}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Roles</Label>
                                <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto bg-background">
                                    {allRoles.map(role => (
                                        <div key={role.id} className="flex items-center space-x-2">
                                            <Checkbox 
                                                id={`role-${role.id}`} 
                                                checked={filterRoles.includes(role.id)}
                                                onCheckedChange={(checked) => {
                                                    setFilterRoles(prev => checked ? [...prev, role.id] : prev.filter(r => r !== role.id));
                                                }}
                                            />
                                            <Label htmlFor={`role-${role.id}`} className="text-sm font-normal cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                                {role.name}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Membership Ladders</Label>
                                <div className="border rounded-md p-3 space-y-2 max-h-60 overflow-y-auto bg-background">
                                    {ladders.map(l => (
                                        <div key={l.id} className="flex items-center space-x-2">
                                            <Checkbox 
                                                id={`ladder-${l.id}`} 
                                                checked={filterLadders.includes(l.id)}
                                                onCheckedChange={(checked) => {
                                                    setFilterLadders(prev => checked ? [...prev, l.id] : prev.filter(id => id !== l.id));
                                                }}
                                            />
                                            <Label htmlFor={`ladder-${l.id}`} className="text-sm font-normal cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                                {l.name} {l.side !== 'none' && `(${l.side})`}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Baptism Status</Label>
                                <Select value={filterBaptism} onValueChange={setFilterBaptism}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        <SelectItem value="true">Baptized</SelectItem>
                                        <SelectItem value="false">Not Baptized</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Graduation Status</Label>
                                <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto bg-background">
                                    {['Not Started', 'In Progress', 'Eligible', 'Graduated', 'Empty'].map(status => (
                                        <div key={status} className="flex items-center space-x-2">
                                            <Checkbox 
                                                id={`grad-${status}`} 
                                                checked={filterGraduations.includes(status)}
                                                onCheckedChange={(checked) => {
                                                    setFilterGraduations(prev => checked ? [...prev, status] : prev.filter(s => s !== status));
                                                }}
                                            />
                                            <Label htmlFor={`grad-${status}`} className="text-sm font-normal cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                                {status === 'Empty' ? 'Empty (Not Set)' : status}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Training Status</Label>
                                <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto bg-background">
                                    {['Not Started', 'In Progress', 'Completed'].map(status => (
                                        <div key={status} className="flex items-center space-x-2">
                                            <Checkbox 
                                                id={`train-${status}`} 
                                                checked={filterTrainingStatuses.includes(status)}
                                                onCheckedChange={(checked) => {
                                                    setFilterTrainingStatuses(prev => checked ? [...prev, status] : prev.filter(s => s !== status));
                                                }}
                                            />
                                            <Label htmlFor={`train-${status}`} className="text-sm font-normal cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                                {status}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Completed Classes Count</Label>
                                <Select value={filterCompletedCount} onValueChange={setFilterCompletedCount}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Any Count" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Any Count</SelectItem>
                                        {Array.from({ length: maxCoursesForFilter }, (_, i) => i + 1).map(n => (
                                            <SelectItem key={n} value={String(n)}>{`>= ${n}`}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-[10px] text-muted-foreground">
                                    {filterLadders.length !== 1 ? "Relative to user's current ladder." : "Relative to selected ladder filter."}
                                </p>
                            </div>
                        </div>
                    </ScrollArea>
                    <SheetFooter>
                        <Button variant="outline" className="w-full" onClick={() => {
                            setSelectedCampus('all');
                            setFilterRoles([]);
                            setFilterLadders([]);
                            setFilterBaptism('all');
                            setFilterGraduations([]);
                            setFilterTrainingStatuses([]);
                            setFilterCompletedCount('all');
                        }}>
                            Reset Filters
                        </Button>
                        <SheetClose asChild>
                            <Button className="w-full">Done</Button>
                        </SheetClose>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            {selectedUserIds.length > 1 && (
                <Dialog open={isMergeDialogOpen} onOpenChange={setIsMergeDialogOpen}>
                    <DialogTrigger asChild><Button variant="outline"><Combine className="mr-2 h-4 w-4" /> Merge ({selectedUserIds.length})</Button></DialogTrigger>
                    {isMergeDialogOpen && <MergeUsersDialog userIds={selectedUserIds} onClose={() => setIsMergeDialogOpen(false)} onMergeComplete={fetchAllData} />}
                </Dialog>
            )}
            {selectedUserIds.length > 0 && (
                <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete ({selectedUserIds.length})</Button></AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will delete {selectedUserIds.length} user(s).</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteSelected}>Delete</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </div>
        <div className="overflow-x-auto">
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead className="w-12"><Checkbox checked={selectedUserIds.length === paginatedUsers.length && paginatedUsers.length > 0} onCheckedChange={handleToggleAllOnPage} /></TableHead>
                <TableHead>User</TableHead>
                <TableHead>Campus</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Membership Ladder</TableHead>
                <TableHead>Baptism</TableHead>
                <TableHead>Graduation</TableHead>
                <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {loading ? (
                    Array.from({ length: 3 }).map((_, index) => (
                        <TableRow key={index}>
                            <TableCell><Skeleton className="h-5 w-5" /></TableCell>
                            <TableCell><div className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-full" /><div className="space-y-1"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-40" /></div></div></TableCell>
                             <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-[120px]" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-[180px]" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-[100px]" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-[140px]" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-8 w-8 rounded-md" /></TableCell>
                        </TableRow>
                    ))
                ) : (
                    paginatedUsers.map((user) => (
                    <TableRow key={user.id} onClick={() => handleRowClick(user)} className="cursor-pointer" data-state={selectedUserIds.includes(user.id) ? "selected" : ""}>
                         <TableCell onClick={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }} onPointerDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}>
                            <Checkbox checked={selectedUserIds.includes(user.id)} onCheckedChange={() => handleToggleUserSelection(user.id)} />
                        </TableCell>
                        <TableCell>
                        <div className="flex items-center gap-3">
                            <Avatar><AvatarImage src={user.photoURL || undefined} /><AvatarFallback>{getInitials(user.displayName)}</AvatarFallback></Avatar>
                            <div><p className="font-medium">{user.displayName} {user.charge && `(${user.charge})`}</p><p className="text-sm text-muted-foreground">{user.email}</p></div>
                        </div>
                        </TableCell>
                         <TableCell onClick={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }} onPointerDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}>
                           {isCurrentUserAdmin ? (
                               <Select value={user.campus} onValueChange={(v) => handleCampusChange(user.id, v)}>
                                   <SelectTrigger className="w-[180px]">
                                       <SelectValue placeholder="Select Campus">
                                           <div className="flex items-center gap-2">
                                               {user.campus === 'All Campuses' && <Globe className="h-3 w-3 text-primary" />}
                                               {user.campus || 'N/A'}
                                           </div>
                                       </SelectValue>
                                   </SelectTrigger>
                                   <SelectContent>
                                       <SelectItem value="All Campuses">
                                           <div className="flex items-center gap-2">
                                               <Globe className="h-3 w-3" />
                                               All Campuses
                                           </div>
                                       </SelectItem>
                                       {allCampuses.filter(c => c["Campus Name"] !== 'All Campuses').map(c => <SelectItem key={c.id} value={c["Campus Name"]}>{c["Campus Name"]}</SelectItem>)}
                                   </SelectContent>
                               </Select>
                           ) : (
                               <Badge variant="outline" className="flex items-center gap-1 w-fit">
                                   {user.campus === 'All Campuses' && <Globe className="h-3 w-3 text-primary" />}
                                   {user.campus || 'N/A'}
                               </Badge>
                           )}
                        </TableCell>
                        <TableCell onClick={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }} onPointerDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}>
                            <Select value={user.role} onValueChange={(v) => handleRoleChange(user.id, v)}>
                                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                                <SelectContent>{assignableRoles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </TableCell>
                        <TableCell onClick={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }} onPointerDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}>
                            <Select value={user.classLadderId} onValueChange={(v) => handleLadderChange(user.id, v)}>
                                <SelectTrigger className="w-[180px]"><SelectValue placeholder={getUserLadderName(user.classLadderId)} /></SelectTrigger>
                                <SelectContent>{ladders.map(l => <SelectItem key={l.id} value={l.id}>{l.name} {l.side !== 'none' && `(${l.side})`}</SelectItem>)}</SelectContent>
                            </Select>
                        </TableCell>
                        <TableCell onClick={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }} onPointerDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}>
                            <Select value={user.isBaptized === undefined || user.isBaptized === null ? "false" : String(user.isBaptized)} onValueChange={(v) => handleBaptismChange(user.id, v === 'true')}>
                                <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="true">Yes</SelectItem><SelectItem value="false">No</SelectItem></SelectContent>
                            </Select>
                        </TableCell>
                        <TableCell onClick={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }} onPointerDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}>
                            <Select value={user.graduationStatus || "Not Started"} onValueChange={(v) => handleGraduationStatusChange(user.id, v)}>
                                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Not Started">Not Started</SelectItem>
                                    <SelectItem value="In Progress">In Progress</SelectItem>
                                    <SelectItem value="Eligible">Eligible</SelectItem>
                                    <SelectItem value="Graduated">Graduated</SelectItem>
                                </SelectContent>
                            </Select>
                        </TableCell>
                        <TableCell className="text-right">
                           <div className="flex justify-end gap-1">
                             {canManageUsers && <Button variant="ghost" size="icon" onClick={(e) => handleActionClick(e, () => setSendingEmailToUser(user))}><Mail className="h-4 w-4" /></Button>}
                             <Button variant="ghost" size="icon" onClick={(e) => handleActionClick(e, () => setViewingUser(user))}><Eye className="h-4 w-4" /></Button>
                            <Button size="icon" className="text-white bg-gradient-to-r from-pink-500 to-orange-400" onClick={(e) => handleActionClick(e, () => setEditingUser(user))}><Edit className="h-4 w-4" /></Button>
                           </div>
                        </TableCell>
                    </TableRow>
                    ))
                )}
            </TableBody>
            </Table>
        </div>
      </CardContent>
       {totalPages > 1 && (
        <CardFooter className="flex justify-end items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><span>Rows</span><Select value={`${usersPerPage}`} onValueChange={v => setUsersPerPage(Number(v))}><SelectTrigger className="w-[70px]"><SelectValue /></SelectTrigger><SelectContent>{[10, 25, 50, 100].map(s => <SelectItem key={s} value={`${s}`}>{s}</SelectItem>)}</SelectContent></Select></div>
            <span className="text-sm">Page {currentPage} of {totalPages}</span>
            <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight className="h-4 w-4" /></Button></div>
        </CardFooter>
      )}
      </Card>
      
      <Dialog open={!!viewingUser} onOpenChange={(o) => !o && setViewingUser(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>User Profile Details</DialogTitle></DialogHeader>
          {viewingUser && (
            <ScrollArea className="max-h-[80vh] pr-6">
              <div className="space-y-8 py-4">
                <div className="flex items-center space-x-4">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={viewingUser.photoURL || undefined} />
                    <AvatarFallback className="text-4xl">{getInitials(viewingUser.displayName)}</AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-bold">{viewingUser.displayName}</h3>
                    <p className="text-muted-foreground">{viewingUser.email}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="secondary" className="capitalize">{viewingUser.role}</Badge>
                      <Badge variant="outline" className="capitalize">{viewingUser.membershipStatus}</Badge>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                  <div className="space-y-1">
                    <p className="font-semibold">Full Details</p>
                    <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                      <span>Gender:</span> <span className="capitalize">{viewingUser.gender || 'N/A'}</span>
                      <span>Age Range:</span> <span>{viewingUser.ageRange || 'N/A'}</span>
                      <span>Phone:</span> <span>{viewingUser.phoneNumber || 'N/A'}</span>
                      <span>Campus:</span> 
                      <span className="flex items-center gap-1">
                        {viewingUser.campus === 'All Campuses' && <Globe className="h-3 w-3 text-primary" />}
                        {viewingUser.campus || 'N/A'}
                      </span>
                      <span>Language:</span> <span>{viewingUser.language || 'N/A'}</span>
                      <span>Marital Status:</span> <span>{viewingUser.maritalStatus || 'N/A'}</span>
                      <span>Charge:</span> <span>{viewingUser.charge || 'N/A'}</span>
                      <span>Ministry:</span> <span>{viewingUser.ministry || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold">Status & Activity</p>
                    <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                      <span>Ladder:</span> <span>{getUserLadderName(viewingUser.classLadderId)}</span>
                      <span>Training Status:</span>
                      <span>
                        {isProgressLoading ? <Loader2 className="h-3 w-3 animate-spin inline" /> : (
                            <Badge variant={(() => {
                                const lp = viewingUserLadderProgress.find(p => p.ladderId === viewingUser.classLadderId);
                                if (!lp || lp.totalCourses === 0) return "outline";
                                if (lp.progress === 100) return "default";
                                if (lp.progress > 0) return "secondary";
                                return "outline";
                            })()} className="text-[10px] h-5 py-0 px-1.5 font-bold uppercase tracking-wider">
                                {(() => {
                                    const lp = viewingUserLadderProgress.find(p => p.ladderId === viewingUser.classLadderId);
                                    if (!lp || lp.totalCourses === 0) return "Not Started";
                                    if (lp.progress === 100) return "Completed";
                                    if (lp.progress > 0) return "In Progress";
                                    return "Not Started";
                                })()}
                            </Badge>
                        )}
                      </span>
                      <span>Baptized:</span> <span>{viewingUser.isBaptized ? 'Yes' : 'No'} {viewingUser.baptismDate && `(${viewingUser.baptismDate})`}</span>
                      <span>Graduation:</span> <span>{viewingUser.graduationStatus || 'Not Started'} {viewingUser.graduationDate && `(${viewingUser.graduationDate})`}</span>
                      <span>HP Group:</span> <span>{viewingUser.isInHpGroup ? 'Yes' : 'No'}</span>
                      {viewingUser.isInHpGroup && (
                        <>
                          <span>HP Number:</span> <span>{viewingUser.hpNumber || 'N/A'}</span>
                          <span>Facilitator:</span> <span>{viewingUser.facilitatorName || 'N/A'}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-lg font-bold flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-500 fill-yellow-400" />
                    Ladder Progress
                  </h4>
                  {isProgressLoading ? <Skeleton className="h-20 w-full" /> : (
                    <div className="grid gap-4">
                      {viewingUserLadderProgress.map(lp => (
                        <div key={lp.ladderId} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{lp.ladderName}</span>
                            <span>{lp.completedCourses} / {lp.totalCourses}</span>
                          </div>
                          <Progress value={lp.progress} className="h-2" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="text-lg font-bold flex items-center gap-2">
                      <Loader2 className="h-5 w-5 text-blue-500" />
                      Enrolled Courses
                    </h4>
                    {isProgressLoading ? <Skeleton className="h-32 w-full" /> : (
                      <div className="space-y-3">
                        {viewingUserProgress.filter(p => !viewingUserCompletions.has(p.courseId)).length > 0 ? (
                          viewingUserProgress.filter(p => !viewingUserCompletions.has(p.courseId)).map(p => (
                            <div key={p.courseId} className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                              <div className="flex-1 mr-4">
                                <p className="text-sm font-medium mb-1 truncate">{p.courseTitle}</p>
                                <div className="flex items-center gap-2">
                                    <Progress value={p.totalProgress} className="h-1" />
                                    <span className="text-[10px] font-bold">{p.totalProgress}%</span>
                                </div>
                              </div>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                                    <UserMinus className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Unenroll User?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will remove "{viewingUser.displayName}" from "{p.courseTitle}" and delete all their progress.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleUnenroll(viewingUser.id, p.courseId)}>Unenroll</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          ))
                        ) : <p className="text-sm text-muted-foreground italic">No active enrollments.</p>}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-lg font-bold flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      Completed Courses
                    </h4>
                    {isProgressLoading ? <Skeleton className="h-32 w-full" /> : (
                      <div className="space-y-2">
                        {completedCoursesList.length > 0 ? (
                          completedCoursesList.map(p => (
                            <div key={p.courseId} className="flex items-center gap-2 p-2 rounded-md bg-green-500/5 text-green-600 dark:text-green-400">
                              <CheckCircle2 className="h-4 w-4 shrink-0" />
                              <span className="text-sm truncate">{p.courseTitle}</span>
                            </div>
                          ))
                        ) : <p className="text-sm text-muted-foreground italic">No completed courses.</p>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2 pt-4 border-t">
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={handlePreviousUser} disabled={viewingUserIndex <= 0}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleNextUser} disabled={viewingUserIndex >= users.length - 1}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1" />
            <div className="flex flex-wrap gap-2 justify-end">
              {viewingUser && (
                <Button asChild variant="outline">
                  <Link href={`/admin/users/${viewingUser.id}`}>
                    <UserIcon className="mr-2 h-4 w-4" /> View Full Profile
                  </Link>
                </Button>
              )}
              {canManageUsers && <Button variant="outline" onClick={() => handleSendResetLink(viewingUser?.email)}>Reset Link</Button>}
              <Button variant="secondary" onClick={() => setViewingUser(null)}>Close</Button>
              <Button onClick={() => { setEditingUser(viewingUser); setViewingUser(null); }}>
                <Edit className="mr-2 h-4 w-4" /> Edit
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!editingUser} onOpenChange={(o) => !o && setEditingUser(null)}>
        <SheetContent className="w-full sm:max-w-md p-0">
          <SheetHeader className="p-6"><SheetTitle>Edit User: {editingUser?.displayName}</SheetTitle></SheetHeader>
          <ScrollArea className="h-[calc(100vh-80px)]"><div className="p-6 pt-0">{editingUser && <EditUserForm userToEdit={editingUser} onUserUpdated={handleUserUpdated} />}</div></ScrollArea>
        </SheetContent>
      </Sheet>
      <Dialog open={!!sendingEmailToUser} onOpenChange={(o) => !o && setSendingEmailToUser(null)}>
        {sendingEmailToUser && <SendEmailDialog user={sendingEmailToUser} onClose={() => setSendingEmailToUser(null)} />}
      </Dialog>
      <Dialog open={!!datePickerDialog} onOpenChange={(o) => !o && setDatePickerDialog(null)}>
        <DialogContent className="sm:max-md">
            <DialogHeader><DialogTitle>Set {datePickerDialog?.type} Date</DialogTitle><DialogDescription>Specify date for {datePickerDialog?.userName}.</DialogDescription></DialogHeader>
            <div className="py-4 space-y-2"><Label>Select Date</Label><Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} /></div>
            <DialogFooter className="gap-2"><Button variant="secondary" onClick={() => setDatePickerDialog(null)}>Cancel</Button><Button variant="outline" onClick={() => handleSaveDate(true)}>Skip Date</Button><Button onClick={() => handleSaveDate(false)} disabled={!selectedDate}>Save Date</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle>Customize CSV Export</DialogTitle>
                <DialogDescription>
                    Select the fields you want to include in the exported file.
                </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 py-4">
                {exportFields.map((field) => (
                    <div key={field.id} className="flex items-center space-x-2">
                        <Checkbox 
                            id={`export-${field.id}`} 
                            checked={selectedExportFields.includes(field.id)}
                            onCheckedChange={(checked) => {
                                if (checked) {
                                    setSelectedExportFields(prev => [...prev, field.id]);
                                } else {
                                    setSelectedExportFields(prev => prev.filter(id => id !== field.id));
                                }
                            }}
                        />
                        <Label htmlFor={`export-${field.id}`} className="text-sm font-normal cursor-pointer leading-none">
                            {field.label}
                        </Label>
                    </div>
                ))}
            </div>
            <DialogFooter className="flex flex-col sm:flex-row justify-between items-center gap-4 border-t pt-4">
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedExportFields(exportFields.map(f => f.id))}>Select All</Button>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedExportFields([])}>Clear All</Button>
                </div>
                <Button onClick={handleExportCSV} disabled={selectedExportFields.length === 0} className="w-full sm:w-auto">
                    <Download className="mr-2 h-4 w-4" />
                    Export {filteredUsers.length} Users
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
