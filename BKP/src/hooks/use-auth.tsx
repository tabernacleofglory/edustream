
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getFirebaseAuth, getFirebaseFirestore } from '@/lib/firebase';
import { doc, getDoc, onSnapshot, collection, query, where, updateDoc, limit, orderBy, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import type { AppUser, RolePermission, Ladder } from '@/lib/types';
import { usePathname, useRouter } from 'next/navigation';

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  isCurrentUserAdmin: boolean;
  canViewAllCampuses: boolean;
  refreshUser: () => void;
  hasPermission: (permission: string) => boolean;
  isProfileComplete: boolean;
  checkAndCreateUserDoc: (firebaseUser: FirebaseUser) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isCurrentUserAdmin: false,
  canViewAllCampuses: false,
  refreshUser: () => {},
  hasPermission: () => false,
  isProfileComplete: false,
  checkAndCreateUserDoc: async () => false,
});

const languageMigrationMap: { [key: string]: string } = {
    "Creole": "Haitian; Haitian Creole",
    "French": "French",
    "Spanish": "Spanish; Castilian",
    "English": "English",
};

const getDefaultLadderId = async (db: any): Promise<{id: string, name: string} | null> => {
    const laddersRef = collection(db, "courseLevels");
    const q = query(laddersRef, orderBy("order"), limit(1));
    const querySnapshot = await getDocs(q);
    if(!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return { id: doc.id, name: doc.data().name };
    }
    return null;
}

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
  const canViewAllCampuses = isCurrentUserAdmin || user?.campus === 'All Campuses';
  
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

  const checkAndCreateUserDoc = useCallback(async (firebaseUser: FirebaseUser) => {
    const userDocRef = doc(db, "users", firebaseUser.uid);
    const userDoc = await getDoc(userDocRef);
    if (!userDoc.exists()) {
        const defaultLadder = await getDefaultLadderId(db);
        const newUser: AppUser = {
          uid: firebaseUser.uid,
          id: firebaseUser.uid,
          displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0],
          fullName: firebaseUser.displayName || firebaseUser.email?.split('@')[0],
          email: firebaseUser.email,
          photoURL: firebaseUser.photoURL,
          role: 'user',
          charge: 'App User',
          membershipStatus: 'Active',
          classLadderId: defaultLadder?.id || null,
          classLadder: defaultLadder?.name || 'New Member',
        };
        await setDoc(userDocRef, { ...newUser, createdAt: serverTimestamp() });
        return true; // New user created
    }
    return false; // Existing user
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
        await checkAndCreateUserDoc(firebaseUser);
      }
      setLoading(false);
    }, (error) => {
        console.error("Error fetching user document:", error);
        setUser(null);
        setLoading(false);
    });

    return unsubscribeUser;

  }, [db, checkAndCreateUserDoc]);


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

    const authPages = ['/login', '/signup'];
    const isAuthPage = authPages.some(path => pathname.startsWith(path));
    const isHomePage = pathname === '/';
    const isSettingsPage = pathname === '/settings';
    const isAppPage = !isAuthPage && !isHomePage;

    if (user) {
      // If profile is incomplete, force them to the settings page, unless they are already there.
      if (!isProfileComplete && !isSettingsPage) {
        router.push('/settings');
      } 
      // If user is on an auth page (login/signup), redirect to dashboard.
      else if (isAuthPage) {
        router.push('/dashboard');
      }
    } else {
      // If not logged in and trying to access an internal app page, redirect to login.
      if (isAppPage) {
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
    <AuthContext.Provider value={{ user, loading, refreshUser, isCurrentUserAdmin, canViewAllCampuses, hasPermission, isProfileComplete, checkAndCreateUserDoc }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
