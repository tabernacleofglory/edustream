
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getFirebaseAuth, getFirebaseFirestore } from '@/lib/firebase';
import { doc, getDoc, onSnapshot, collection, query, where } from 'firebase/firestore';
import type { User as AppUser, RolePermission } from '@/lib/types';
import { usePathname, useRouter } from 'next/navigation';

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  isCurrentUserAdmin: boolean;
  refreshUser: () => void;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isCurrentUserAdmin: false,
  refreshUser: () => {},
  hasPermission: () => false,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const auth = getFirebaseAuth();
  const db = getFirebaseFirestore();
  const router = useRouter(); 
  const pathname = usePathname();
  const isCurrentUserAdmin = user?.role === 'admin' || user?.role === 'developer';

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
        const authUser: AppUser = {
          uid: firebaseUser.uid,
          id: firebaseUser.uid,
          ...userData,
          displayName: userData.fullName || firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        };
        setUser(authUser);

        if (authUser.role) {
          const permissionsDocRef = doc(db, "rolePermissions", authUser.role);
          const permissionsSnapshot = await getDoc(permissionsDocRef);
          if (permissionsSnapshot.exists()) {
              setUserPermissions(permissionsSnapshot.data()?.permissions || []);
          } else {
              setUserPermissions([]);
          }
        } else {
          setUserPermissions([]);
        }
      } else {
        // The user doc might not exist yet if the Cloud Function is still running.
        // We set a temporary user object and permissions will be updated when the doc is created.
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
    if (!loading && user && (pathname === '/login' || pathname === '/signup')) {
        router.push('/dashboard');
    }
  }, [user, loading, pathname, router]);


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
    <AuthContext.Provider value={{ user, loading, refreshUser, isCurrentUserAdmin, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
