
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getFirebaseAuth, getFirebaseFirestore } from '@/lib/firebase';
import { doc, getDoc, onSnapshot, collection, query, where, updateDoc, limit, orderBy, getDocs } from 'firebase/firestore';
import type { AppUser, RolePermission, Ladder } from '@/lib/types';
import { usePathname, useRouter } from 'next/navigation';

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  isCurrentUserAdmin: boolean;
  refreshUser: () => void;
  hasPermission: (permission: string) => boolean;
  isProfileComplete: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isCurrentUserAdmin: false,
  refreshUser: () => {},
  hasPermission: () => false,
  isProfileComplete: false,
});

const languageMigrationMap: { [key: string]: string } = {
    "Creole": "Haitian; Haitian Creole",
    "French": "French",
    "Spanish": "Spanish; Castilian",
    "English": "English",
};


export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [validLanguages, setValidLanguages] = useState<string[]>([]);
  const auth = getFirebaseAuth();
  const db = getFirebaseFirestore();
  const router = useRouter(); 
  const pathname = usePathname();
  const isCurrentUserAdmin = user?.role === 'admin' || user?.role === 'developer';
  
  const isProfileComplete = !!user?.isInHpGroup && !!user?.language && validLanguages.includes(user.language) && !!user?.locationPreference;

  useEffect(() => {
    const fetchValidLanguages = async () => {
        try {
            const langQuery = query(collection(db, 'languages'), where('status', '==', 'published'));
            const langSnapshot = await getDocs(langQuery);
            const langNames = langSnapshot.docs.map(doc => doc.data().name as string);
            setValidLanguages(langNames);
        } catch (e) {
            console.error("Could not fetch valid languages for auth check.", e);
        }
    };
    fetchValidLanguages();
  }, [db]);


  const fetchUserDocument = useCallback(async (firebaseUser: FirebaseUser | null) => {
    if (!firebaseUser) {
        setUser(null);
        setUserPermissions([]);
        setLoading(false);
        return;
    }

    const userDocRef = doc(db, "users", firebaseUser.uid);
    const unsubscribeUser = onSnapshot(userDocRef, async (docSnapshot) => {
      if (docSnapshot.exists()) {
        const userData = docSnapshot.data() as Omit<AppUser, 'uid'>;

        // One-time language migration logic
        if (userData.language && languageMigrationMap[userData.language]) {
            const newLanguage = languageMigrationMap[userData.language];
            if (userData.language !== newLanguage) {
                await updateDoc(userDocRef, { language: newLanguage });
                userData.language = newLanguage; // Update locally to prevent re-triggering
            }
        }
        
        const authUser: AppUser = {
          uid: firebaseUser.uid,
          id: firebaseUser.uid,
          ...userData,
          displayName: userData.fullName || firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        };
        setUser(authUser);

        const role = authUser.role || 'user';
        const permissionsDocRef = doc(db, "rolePermissions", role);
        const permissionsSnapshot = await getDoc(permissionsDocRef);
        if (permissionsSnapshot.exists()) {
            setUserPermissions(permissionsSnapshot.data()?.permissions || []);
        } else {
            setUserPermissions([]);
        }
      } else {
        const tempUser: AppUser = { 
          uid: firebaseUser.uid, 
          id: firebaseUser.uid,
          displayName: firebaseUser.displayName,
          email: firebaseUser.email,
          role: 'user', 
          membershipStatus: 'Active',
        };
        setUser(tempUser);
        setUserPermissions([]);
      }
      setLoading(false);
    }, (error) => {
        console.error("Error fetching user document:", error);
        setUser(null);
        setLoading(false);
    });

    return unsubscribeUser;

  }, [db]);


  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
        setLoading(true);
        const unsubscribeFirestore = fetchUserDocument(firebaseUser);
        
        return () => {
            if(unsubscribeFirestore) {
                unsubscribeFirestore.then(unsub => unsub()).catch(console.error);
            }
        };
    });

    return () => unsubscribeAuth();
  }, [auth, fetchUserDocument]);

  const refreshUser = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (currentUser) {
        setLoading(true);
        await currentUser.reload();
        await fetchUserDocument(currentUser);
    }
  }, [auth, fetchUserDocument]);

  useEffect(() => {
    if (loading || validLanguages.length === 0) return;

    const publicPaths = ['/login', '/signup'];
    const isPublicPage = publicPaths.some(path => pathname.startsWith(path)) || pathname === '/';
    const isSettingsPage = pathname === '/settings';

    if (user) {
      if (!isProfileComplete && !isSettingsPage) {
        router.push('/settings');
      } else if (isPublicPage) {
        router.push('/dashboard');
      }
    } else {
      if (!isPublicPage) {
        router.push('/login');
      }
    }
  }, [user, loading, pathname, router, isProfileComplete, validLanguages]);


  const hasPermission = useCallback((permission: string) => {
    if(user?.role === 'developer') return true;
    return userPermissions.includes(permission);
  }, [user, userPermissions]);

  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      if (!hasPermission('allowRightClick')) {
        event.preventDefault();
      }
    };
    if (!loading) {
      document.addEventListener('contextmenu', handleContextMenu);
    }
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [loading, hasPermission]);


  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, isCurrentUserAdmin, hasPermission, isProfileComplete }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
