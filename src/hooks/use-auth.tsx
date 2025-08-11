
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getFirebaseAuth, getFirebaseFirestore } from '@/lib/firebase';
import { doc, getDoc, onSnapshot, collection, query, where } from 'firebase/firestore';
import type { User as AppUser, RolePermission } from '@/lib/types';
import { usePathname, useRouter } from 'next/navigation'; // Import useRouter

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

  const fetchUserDocument = useCallback(async (firebaseUser: FirebaseUser) => {
    const userDocRef = doc(db, "users", firebaseUser.uid);
    try {
      const docSnapshot = await getDoc(userDocRef);
      if (docSnapshot.exists()) {
        const userData = docSnapshot.data() as Omit<AppUser, 'uid'>;
        
        const authUser: AppUser = {
          uid: firebaseUser.uid,
          id: firebaseUser.uid,
          ...userData,
          displayName: userData.fullName || firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          classLadderId: userData.classLadderId,
        };
        setUser(authUser);

        if (authUser.role) {
          const permissionsSnapshot = await getDoc(doc(db, "rolePermissions", authUser.role));
          setUserPermissions(permissionsSnapshot.exists() ? permissionsSnapshot.data()?.permissions || [] : []);
        } else {
          setUserPermissions([]);
        }
      } else {
         const defaultUser: AppUser = { 
            uid: firebaseUser.uid, 
            id: firebaseUser.uid,
            displayName: firebaseUser.displayName,
            email: firebaseUser.email,
            role: 'user', 
            membershipStatus: 'free',
            fullName: firebaseUser.displayName || 'New User'
         };
         setUser(defaultUser);
         setUserPermissions([]);
      }
    } catch (error) {
      console.error("Error fetching user document:", error);
      setUser(null);
    } finally {
        setLoading(false); // Set loading to false only after all user data is fetched
    }
  }, [db]);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        setLoading(true); // Start loading when auth state changes
        if (firebaseUser) {
            fetchUserDocument(firebaseUser);
        } else {
            setUser(null);
            setUserPermissions([]);
            setLoading(false); // Stop loading if no user
        }
    });

    return () => unsubscribe();
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

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, isCurrentUserAdmin, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
