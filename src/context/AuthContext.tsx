import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, SUPER_ADMIN_EMAIL, handleFirestoreError, OperationType } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc, collection, query, where } from 'firebase/firestore';
import { PlatformSettings, User } from '../types';

const DEFAULT_SETTINGS: PlatformSettings = {
  requireStudentApproval: true,
  requireOrganizerApproval: true,
  requireCanteenApproval: true,
  platformUpiId: 'campusconnect@upi',
  supportEmail: 'yugalofficial63@gmail.com',
};

interface AuthContextType {
  user: User | null;
  firebaseUser: import('firebase/auth').User | null;
  loading: boolean;
  isAdmin: boolean;
  isOrganizer: boolean;
  isCanteen: boolean;
  isStudent: boolean;
  isApproved: boolean;
  unreadNotifications: number;
  platformSettings: PlatformSettings;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  firebaseUser: null,
  loading: true,
  isAdmin: false,
  isOrganizer: false,
  isCanteen: false,
  isStudent: false,
  isApproved: false,
  unreadNotifications: 0,
  platformSettings: DEFAULT_SETTINGS,
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<import('firebase/auth').User | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'platform'),
      (snap) => {
        if (snap.exists()) {
          setPlatformSettings({ ...DEFAULT_SETTINGS, ...(snap.data() as Partial<PlatformSettings>) });
        }
      },
      () => {
        // Fallback silently to defaults if settings doc doesn't exist yet
      }
    );
    return () => unsubSettings();
  }, []);

  useEffect(() => {
    let unsubUserDoc: (() => void) | null = null;
    let unsubNotifs: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (unsubUserDoc) {
        unsubUserDoc();
        unsubUserDoc = null;
      }
      if (unsubNotifs) {
        unsubNotifs();
        unsubNotifs = null;
      }

      setFirebaseUser(fbUser);

      if (fbUser) {
        const isSuperAdmin = fbUser.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
        const userRef = doc(db, 'users', fbUser.uid);

        unsubUserDoc = onSnapshot(
          userRef,
          async (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data() as User;
              // Ensure Super Admin always holds admin role & approved status
              if (isSuperAdmin && (data.role !== 'admin' || data.status !== 'approved')) {
                try {
                  await setDoc(
                    userRef,
                    { ...data, role: 'admin', status: 'approved', updatedAt: new Date().toISOString() },
                    { merge: true }
                  );
                } catch (err) {
                  console.error('Super Admin elevation error:', err);
                }
              }
              setUser({ ...data, uid: fbUser.uid });
            } else if (isSuperAdmin) {
              const superAdminProfile: User = {
                uid: fbUser.uid,
                name: fbUser.displayName || 'Super Admin',
                email: fbUser.email || SUPER_ADMIN_EMAIL,
                role: 'admin',
                status: 'approved',
                interests: [],
                points: 0,
                badges: ['Super Admin'],
                followedSocieties: [],
                photoURL: fbUser.photoURL || '',
                createdAt: new Date().toISOString(),
              };
              try {
                await setDoc(userRef, superAdminProfile);
                setUser(superAdminProfile);
              } catch (err) {
                handleFirestoreError(err, OperationType.CREATE, `users/${fbUser.uid}`);
              }
            } else {
              // User is authenticated via Firebase Auth (e.g. brand-new Google login) without profile doc yet
              setUser(null);
            }
            setLoading(false);
          },
          (err) => {
            console.error('User profile listener error:', err);
            setLoading(false);
          }
        );

        const notifQ = query(
          collection(db, 'notifications'),
          where('userId', '==', fbUser.uid)
        );
        unsubNotifs = onSnapshot(
          notifQ,
          (snap) => setUnreadNotifications(snap.docs.filter((d) => !d.data().read).length),
          () => setUnreadNotifications(0)
        );
      } else {
        setUser(null);
        setUnreadNotifications(0);
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubUserDoc) unsubUserDoc();
      if (unsubNotifs) unsubNotifs();
    };
  }, []);

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  const isAdmin =
    user?.role === 'admin' ||
    firebaseUser?.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  const isApproved = isAdmin || user?.status === 'approved';

  const value: AuthContextType = {
    user,
    firebaseUser,
    loading,
    isAdmin,
    isOrganizer: user?.role === 'organizer',
    isCanteen: user?.role === 'canteen',
    isStudent: user?.role === 'student',
    isApproved,
    unreadNotifications,
    platformSettings,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
