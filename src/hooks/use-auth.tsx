

"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getFirebaseAuth, getFirebaseFirestore } from '@/lib/firebase';
import { doc, getDoc, onSnapshot, collection, query, where, updateDoc, limit, orderBy, getDocs } from 'firebase/firestore';
import type { User as AppUser, RolePermission, Ladder } from '@/lib/types';
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

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [defaultLadder, setDefaultLadder] = useState<Ladder | null>(null);
  const auth = getFirebaseAuth();
  const db = getFirebaseFirestore();
  const router = useRouter(); 
  const pathname = usePathname();
  const isCurrentUserAdmin = user?.role === 'admin' || user?.role === 'developer';
  
  const isProfileComplete = !!user?.firstName && !!user?.lastName && !!user.email && !!user.language && !!user.phoneNumber && !!user.campus && !!user.hpNumber && !!user.classLadderId && !!user.charge && !!user.role && !!user.facilitatorName;

  useEffect(() => {
    const fetchDefaultLadder = async () => {
        try {
            const laddersRef = collection(db, "courseLevels");
            // First, try to find the "New Member" ladder specifically.
            const q = query(laddersRef, where("name", "==", "New Member"), limit(1));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const ladderDoc = querySnapshot.docs[0];
                setDefaultLadder({ id: ladderDoc.id, ...ladderDoc.data() } as Ladder);
            } else {
                // If "New Member" doesn't exist, fall back to the ladder with the lowest order.
                const fallbackQuery = query(laddersRef, orderBy("order"), limit(1));
                const fallbackSnapshot = await getDocs(fallbackQuery);
                if(!fallbackSnapshot.empty) {
                    const ladderDoc = fallbackSnapshot.docs[0];
                    setDefaultLadder({ id: ladderDoc.id, ...ladderDoc.data() } as Ladder);
                }
            }
        } catch (e) {
            console.error("Could not fetch default ladder for auth provider.", e);
        }
    };
    fetchDefaultLadder();
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
        
        // --- Start of Backfill Logic ---
        const updatesToApply: Partial<AppUser> = {};
        if (!userData.uid || !userData.id) {
            updatesToApply.uid = firebaseUser.uid;
            updatesToApply.id = firebaseUser.uid;
        }
        if (!userData.role) {
            updatesToApply.role = 'user';
        }
        if (!userData.charge) {
            updatesToApply.charge = 'App User';
        }
        if (!userData.classLadderId && defaultLadder) {
            updatesToApply.classLadderId = defaultLadder.id;
            updatesToApply.classLadder = defaultLadder.name;
        }
        if (Object.keys(updatesToApply).length > 0) {
            try {
                await updateDoc(userDocRef, updatesToApply);
            } catch (e) {
                console.error("Failed to backfill user data:", e);
            }
        }
        // --- End of Backfill Logic ---

        const finalUserData = { ...userData, ...updatesToApply };

        const authUser: AppUser = {
          uid: firebaseUser.uid,
          id: firebaseUser.uid,
          ...finalUserData,
          displayName: finalUserData.fullName || firebaseUser.displayName,
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

  }, [db, defaultLadder]);


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
    if (loading) return;

    // Unauthenticated user on protected page -> redirect to login
    if (!user && pathname !== '/login' && pathname !== '/signup' && pathname !== '/') {
        router.push('/login');
        return;
    }
    
    // Authenticated user with incomplete profile on any page other than settings -> redirect to settings
    if (user && !isProfileComplete && pathname !== '/settings') {
        router.push('/settings');
        return;
    }
    
    // Authenticated user on login/signup page -> redirect to dashboard
    if (user && (pathname === '/login' || pathname === '/signup')) {
        router.push('/dashboard');
        return;
    }
  }, [user, loading, pathname, router, isProfileComplete]);


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
