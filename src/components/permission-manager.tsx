

"use client";

import { useState, useEffect, useMemo } from 'react';
import { getFirebaseFirestore } from '@/lib/firebase';
import { collection, getDocs, doc, setDoc, query, orderBy, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import type { Permission, RolePermission } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Lock } from 'lucide-react';
import { Separator } from './ui/separator';

const ALL_PERMISSIONS: Permission[] = [
    // Student-facing pages
    { id: 'viewDashboard', name: 'View Dashboard', description: 'Can view their own student dashboard.' },
    { id: 'viewCoursesPage', name: 'View All Courses Page', description: 'Can view the main /courses page.' },
    { id: 'viewLivePage', name: 'View Live Events Page', description: 'Can view the page listing live events.' },
    { id: 'viewMusicPage', name: 'View Music Player Page', description: 'Can access the music library page.' },
    { id: 'viewCommunityPage', name: 'View Community Page', description: 'Can view the community feed.' },
    { id: 'viewDocumentationPage', name: 'View Documentation Page', description: 'Can view the public documentation.' },

    // Admin Panel Access
    { id: 'viewAdminDashboard', name: 'View Admin Panel', description: 'Gives access to the /admin section.' },
    { id: 'viewAnalytics', name: 'View Analytics', description: 'Can view the analytics dashboard.' },
    { id: 'viewUserManagement', name: 'View User Management', description: 'Can view the user list, ladders, speakers, and promotion requests.' },
    { id: 'viewCourseManagement', name: 'View Course Management', description: 'Can view the main course management page.' },
    { id: 'viewContentLibraries', name: 'View Content Libraries', description: 'Can view all content library pages (videos, images, etc.).' },
    { id: 'viewCampusManagement', name: 'View Campus Management', description: 'Can view the campus management page.'},
    { id: 'viewLiveManagement', name: 'View Live Management', description: 'Can view the live event scheduling page.' },
    { id: 'viewDeveloperTools', name: 'View Developer Tools', description: 'Gives access to the developer tools section.' },
    { id: 'viewPermissionsPage', name: 'View Permissions Page', description: 'Can view this permissions page.' },
    
    // Action-based permissions
    { id: 'addCourses', name: 'Add Courses', description: 'Can access the form to add new courses.' },
    { id: 'manageCourses', name: 'Manage Courses', description: 'Can create, edit, and delete courses.' },
    { id: 'manageQuizzes', name: 'Manage Quizzes', description: 'Can create, edit, and delete quizzes.' },
    { id: 'manageUsers', name: 'Manage Users', description: 'Can add, edit, and delete users.' },
    { id: 'manageContent', name: 'Manage Content', description: 'Can upload and manage all content (videos, images, etc.).' },
    { id: 'manageLinks', name: 'Manage Nav Links', description: 'Can add/remove header navigation links.' },
    { id: 'managePermissions', name: 'Manage Permissions', description: 'Can edit role permissions on this page.' },
    { id: 'manageCampus', name: 'Manage Campus', description: 'Can add, edit, and delete campus locations.'},
    { id: 'manageLive', name: 'Manage Live Events', description: 'Can create, schedule, and start live events.' },
    { id: 'participateInLiveEvents', name: 'Participate In Live Events', description: 'Allows user to be a speaker/participant in a live event.' },
    { id: 'managePromotions', name: 'Manage Promotions', description: 'Can approve or reject user promotion requests.' },
    { id: 'manageHpRequests', name: 'Manage HP Requests', description: 'Can view and manage HP placement requests.' },
    { id: 'manageCommunity', name: 'Manage Community', description: 'Can pin or delete any post in the community feed.' },
    { id: 'useVideoTranscoder', name: 'Use Video Transcoder', description: 'Can enable adaptive streaming transcoding during video upload.' },
    { id: 'allowRightClick', name: 'Allow Right-Click', description: 'Allows right-clicking anywhere in the app to prevent simple content saving.' },
    { id: 'downloadContent', name: 'Download Content', description: 'Allows downloading videos and other course materials.' },
    { id: 'developer', name: 'Developer Access', description: 'Full access to all platform features. (Grant with caution)' },
];

const ALL_ROLES = ['admin', 'moderator', 'user'];


export default function PermissionManager() {
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<{[role: string]: string[]}>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { user, hasPermission } = useAuth(); 
  const db = getFirebaseFirestore();
  
  const canManagePermissions = hasPermission('managePermissions');

  useEffect(() => {
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const rolesList = ALL_ROLES;
            
            const filteredRoles = rolesList.filter(r => r.toLowerCase() !== 'developer');
            setRoles(['developer', ...filteredRoles]);

            const permissionsSnapshot = await getDocs(collection(db, 'rolePermissions'));
            const permissionsData: {[role: string]: string[]} = {};
            permissionsSnapshot.forEach(doc => {
                const data = doc.data() as RolePermission;
                permissionsData[data.role] = data.permissions;
            });
            
            rolesList.forEach(role => {
                if (!permissionsData[role]) {
                    permissionsData[role] = [];
                }
            });
            permissionsData['developer'] = ALL_PERMISSIONS.map(p => p.id);


            setPermissions(permissionsData);
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Failed to load permissions data.' });
        } finally {
            setIsLoading(false);
        }
    };

    if (canManagePermissions) {
        fetchData();
    } else {
        setIsLoading(false);
    }
  }, [toast, canManagePermissions, db]);

  const handlePermissionChange = (role: string, permissionId: string, checked: boolean) => {
    setPermissions(prev => {
        const newPermissions = { ...prev };
        const rolePermissions = newPermissions[role] ? [...newPermissions[role]] : [];
        if (checked) {
            if (!rolePermissions.includes(permissionId)) {
                rolePermissions.push(permissionId);
            }
        } else {
            const index = rolePermissions.indexOf(permissionId);
            if (index > -1) {
                rolePermissions.splice(index, 1);
            }
        }
        newPermissions[role] = rolePermissions;
        return newPermissions;
    });
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
        const batch = Object.entries(permissions).map(([role, perms]) => {
            if (role === 'developer') return null; 
            const docRef = doc(db, 'rolePermissions', role);
            return setDoc(docRef, { role, permissions: perms });
        });

        await Promise.all(batch.filter(Boolean));
        toast({ title: 'Permissions saved successfully!' });
    } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Failed to save permissions.' });
    } finally {
        setIsSaving(false);
    }
  }

  if (!canManagePermissions) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Access Denied</CardTitle>
                <CardDescription>
                    You do not have the required permissions to view or manage role permissions.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Alert variant="destructive">
                    <Lock className="h-4 w-4" />
                    <AlertTitle>Permission Required</AlertTitle>
                    <AlertDescription>
                        This section requires the 'Manage Permissions' permission. Please contact a site administrator if you believe you should have access.
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Role Permissions</CardTitle>
        <CardDescription>
          Assign permissions to roles. The Developer role has all permissions by default and cannot be changed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead>Permission</TableHead>
                {roles.map(role => (
                    <TableHead key={role} className="text-center capitalize">{role}</TableHead>
                ))}
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                     Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                            {roles.map(role => (
                                <TableCell key={role} className="text-center"><Skeleton className="h-5 w-5 mx-auto" /></TableCell>
                            ))}
                        </TableRow>
                    ))
                ) : (
                    ALL_PERMISSIONS.map(permission => (
                        <TableRow key={permission.id}>
                        <TableCell>
                            <div className="font-medium">{permission.name}</div>
                            <div className="text-xs text-muted-foreground">{permission.description}</div>
                        </TableCell>
                        {roles.map(role => (
                            <TableCell key={role} className="text-center">
                            <Checkbox
                                checked={permissions[role]?.includes(permission.id) || role === 'developer'}
                                onCheckedChange={(checked) => handlePermissionChange(role, permission.id, !!checked)}
                                disabled={role === 'developer'}
                            />
                            </TableCell>
                        ))}
                        </TableRow>
                    ))
                )}
            </TableBody>
            </Table>
        </div>
        <div className="mt-6 flex justify-end">
            <Button onClick={handleSaveChanges} disabled={isSaving || isLoading}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}
