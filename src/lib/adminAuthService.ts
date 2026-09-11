import {
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { AdminRecord } from '../types';

/**
 * Sign in administrator using Google Authentication provider.
 * Anonymous authentication is strictly prohibited for administrative access.
 */
export async function signInAdminWithGoogle(): Promise<{
  user: User;
  adminRecord: AdminRecord | null;
}> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  // Immediately verify against server-side allowlist /admins/{uid}
  const adminRecord = await verifyAdminUser(user.uid);
  return { user, adminRecord };
}

/**
 * Verifies if a given authenticated user UID corresponds to an active, enabled
 * administrator record in Firestore `/admins/{uid}`.
 */
export async function verifyAdminUser(uid: string): Promise<AdminRecord | null> {
  try {
    const adminDocRef = doc(db, 'admins', uid);
    const snap = await getDoc(adminDocRef);

    if (snap.exists()) {
      const data = snap.data();
      if (data.enabled === true && data.role === 'admin') {
        return {
          uid,
          email: data.email || '',
          role: 'admin',
          enabled: true,
          displayName: data.displayName || null,
          photoURL: data.photoURL || null,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };
      }
    }
  } catch (err) {
    console.warn('Admin allowlist verification error:', err);
  }
  return null;
}

/**
 * Signs out the currently authenticated administrator.
 */
export async function signOutAdmin(): Promise<void> {
  await signOut(auth);
}

/**
 * Subscribes to Firebase Auth state changes and automatically verifies
 * whether the current authenticated user has an active admin record in `/admins/{uid}`.
 */
export function subscribeToAdminAuth(
  callback: (user: User | null, adminRecord: AdminRecord | null, loading: boolean) => void
): () => void {
  return onAuthStateChanged(auth, async (user) => {
    if (!user || user.isAnonymous) {
      callback(user, null, false);
      return;
    }

    try {
      const adminRecord = await verifyAdminUser(user.uid);
      callback(user, adminRecord, false);
    } catch {
      callback(user, null, false);
    }
  });
}
