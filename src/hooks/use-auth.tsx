
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getFirebaseAuth, getFirebaseFirestore } from '@/lib/firebase';
import { doc, getDoc, onSnapshot, collection, query, where, updateDoc, limit, orderBy, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import type { AppUser, RolePermission, Ladder } from '@/lib/types';
import { usePathname, useRouter } from 'next/navigation';

interface AuthContextType {
  user: AppUser | null;
  /** The actual signed-in admin/developer (never the impersonated one). */
  realUser: AppUser | null;
  loading: boolean;
  isCurrentUserAdmin: boolean;
  canViewAllCampuses: boolean;
  refreshUser: () => void;
  hasPermission: (permission: string) => boolean;
  activePermissions: string[];
  isProfileComplete: boolean;
  checkAndCreateUserDoc: (firebaseUser: FirebaseUser) => Promise<boolean>;
  /** True while impersonating a student */
  isImpersonating: boolean;
  /** Start impersonating a user by their Firestore UID */
  startImpersonation: (targetUid: string) => Promise<void>;
  /** Stop impersonation and return to the real admin view */
  stopImpersonation: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  realUser: null,
  loading: true,
  isCurrentUserAdmin: false,
  canViewAllCampuses: false,
  refreshUser: () => {},
  hasPermission: () => false,
  activePermissions: [],
  isProfileComplete: false,
  checkAndCreateUserDoc: async () => false,
  isImpersonating: false,
  startImpersonation: async () => {},
  stopImpersonation: () => {},
});

const languageMigrationMap: { [key: string]: string } = {
    "Creole": "Haitian; Haitian Creole",
    "French": "French",
    "Spanish": "Spanish; Castilian",
    "English": "English",
};

const IMPERSONATION_KEY = 'edu_impersonating_uid';

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
  const [realUser, setRealUser] = useState<AppUser | null>(null);
  const [impersonatedUser, setImpersonatedUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [realUserPermissions, setRealUserPermissions] = useState<string[]>([]);
  const [impersonatedPermissions, setImpersonatedPermissions] = useState<string[]>([]);
  const [validLanguages, setValidLanguages] = useState<string[]>([]);
  const auth = getFirebaseAuth();
  const db = getFirebaseFirestore();
  const router = useRouter(); 
  const pathname = usePathname();

  // The "active" user: impersonated student when active, otherwise the real admin
  const user = impersonatedUser ?? realUser;
  const isImpersonating = !!impersonatedUser;

  // When impersonating, reflect the impersonated user's permissions and status
  const activeUser = impersonatedUser || realUser;
  const isCurrentUserAdmin = (impersonatedUser || realUser)?.role === 'admin' || (impersonatedUser || realUser)?.role === 'developer';
  const canViewAllCampuses = isCurrentUserAdmin || (impersonatedUser || realUser)?.campus === 'All Campuses';
  
  // Profile completion is checked against the ACTIVE impersonated user
  const isProfileComplete = !!activeUser?.isInHpGroup && !!activeUser?.language && validLanguages.includes(activeUser?.language || '') && !!activeUser?.locationPreference;

  useEffect(() => {
    const fetchValidLanguages = async () => {
        // Try session cache first for faster init
        if (typeof window !== 'undefined') {
            const cached = sessionStorage.getItem('edu_valid_langs');
            if (cached) setValidLanguages(JSON.parse(cached));
        }

        try {
            const langQuery = query(collection(db, 'languages'), where('status', '==', 'published'));
            const langSnapshot = await getDocs(langQuery);
            const langNames = langSnapshot.docs.map(doc => doc.data().name as string);
            setValidLanguages(langNames);
            sessionStorage.setItem('edu_valid_langs', JSON.stringify(langNames));
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
        setRealUser(null);
        setRealUserPermissions([]);
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
                userData.language = newLanguage;
            }
        }
        
        const authUser: AppUser = {
          uid: firebaseUser.uid,
          id: firebaseUser.uid,
          ...userData,
          displayName: userData.fullName || firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        };

        const role = authUser.role || 'user';
        
        // Parallelize state updates
        setRealUser(authUser);

        // Permissions caching
        const permCacheKey = `edu_perms_${role}`;
        const cachedPerms = sessionStorage.getItem(permCacheKey);
        
        if (cachedPerms) {
            setRealUserPermissions(JSON.parse(cachedPerms));
        } else {
            const permissionsDocRef = doc(db, "rolePermissions", role);
            const permissionsSnapshot = await getDoc(permissionsDocRef);
            if (permissionsSnapshot.exists()) {
                const perms = permissionsSnapshot.data()?.permissions || [];
                setRealUserPermissions(perms);
                sessionStorage.setItem(permCacheKey, JSON.stringify(perms));
            } else {
                setRealUserPermissions([]);
            }
        }
      } else {
        await checkAndCreateUserDoc(firebaseUser);
      }
      setLoading(false);
    }, (error) => {
        console.error("Error fetching user document:", error);
        setRealUser(null);
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

  // Restore impersonation from sessionStorage after page reloads
  useEffect(() => {
    if (!realUser || loading) return;
    const canImpersonate = realUser.role === 'admin' || realUser.role === 'developer';
    if (!canImpersonate) return;

    const savedUid = sessionStorage.getItem(IMPERSONATION_KEY);
    if (savedUid && !impersonatedUser) {
      // Silently restore
      (async () => {
        try {
          const snap = await getDoc(doc(db, "users", savedUid));
          if (snap.exists()) {
            setImpersonatedUser({ id: snap.id, uid: snap.id, ...snap.data() } as AppUser);
          } else {
            sessionStorage.removeItem(IMPERSONATION_KEY);
          }
        } catch {
          sessionStorage.removeItem(IMPERSONATION_KEY);
        }
      })();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realUser?.uid, loading]);

  // Fetch impersonated user permissions
  useEffect(() => {
    if (impersonatedUser) {
      const fetchImpersonatedPermissions = async () => {
        const role = impersonatedUser.role || 'user';
        const permissionsDocRef = doc(db, "rolePermissions", role);
        const permissionsSnapshot = await getDoc(permissionsDocRef);
        if (permissionsSnapshot.exists()) {
          setImpersonatedPermissions(permissionsSnapshot.data()?.permissions || []);
        } else {
          setImpersonatedPermissions([]);
        }
      };
      fetchImpersonatedPermissions();
    } else {
      setImpersonatedPermissions([]);
    }
  }, [db, impersonatedUser]);

  const startImpersonation = useCallback(async (targetUid: string) => {
    if (!realUser) return;
    const canImpersonate = realUser.role === 'admin' || realUser.role === 'developer';
    if (!canImpersonate) return;

    const snap = await getDoc(doc(db, "users", targetUid));
    if (!snap.exists()) throw new Error("User not found");

    const targetUser: AppUser = { id: snap.id, uid: snap.id, ...snap.data() } as AppUser;
    setImpersonatedUser(targetUser);
    sessionStorage.setItem(IMPERSONATION_KEY, targetUid);
    router.push('/dashboard');
  }, [realUser, db, router]);

  const stopImpersonation = useCallback(() => {
    setImpersonatedUser(null);
    sessionStorage.removeItem(IMPERSONATION_KEY);
    router.push('/admin/users');
  }, [router]);

  const refreshUser = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (currentUser) {
        setLoading(true);
        await currentUser.reload();
        await fetchUserDocument(currentUser);
    }
  }, [auth, fetchUserDocument]);

  useEffect(() => {
    // When impersonating, the active user is already authenticated.
    // Skip auth guards to avoid redirecting the admin away.
    if (loading || validLanguages.length === 0 || isImpersonating) return;

    const authPages = ['/login', '/signup'];
    const isAuthPage = authPages.some(path => pathname.startsWith(path));
    const isHomePage = pathname === '/';
    const isExternalPage = pathname.startsWith('/external');
    const isSettingsPage = pathname === '/settings';
    const isAppPage = !isAuthPage && !isHomePage && !isExternalPage;

    if (realUser) {
      if (!isProfileComplete && !isSettingsPage) {
        router.push('/settings');
      } else if (isAuthPage) {
        router.push('/dashboard');
      }
    } else {
      if (isAppPage) {
        router.push('/login');
      }
    }
  }, [realUser, loading, pathname, router, isProfileComplete, validLanguages, isImpersonating]);


  const hasPermission = useCallback((permission: string) => {
    // If impersonating, we check permissions against the impersonated student's role
    if (isImpersonating) {
      if (impersonatedUser?.role === 'developer') return true;
      return impersonatedPermissions.includes(permission);
    }
    
    // Otherwise check against the real admin user
    if(realUser?.role === 'developer') return true;
    return realUserPermissions.includes(permission);
  }, [isImpersonating, impersonatedUser, impersonatedPermissions, realUser, realUserPermissions]);

  const activePermissions = isImpersonating ? impersonatedPermissions : realUserPermissions;

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
    <AuthContext.Provider value={{ user, realUser, loading, refreshUser, isCurrentUserAdmin, canViewAllCampuses, hasPermission, activePermissions, isProfileComplete, checkAndCreateUserDoc, isImpersonating, startImpersonation, stopImpersonation }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
