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

const ADMIN_SESSION_STORAGE_KEY = 'reqforge_admin_auth_session';

export function getStoredAdminSession(): AdminRecord | null {
  try {
    const raw = sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data && data.enabled && data.role === 'admin' && data.uid) {
      return data as AdminRecord;
    }
  } catch {
    // Ignore storage parse errors
  }
  return null;
}

export function saveStoredAdminSession(admin: AdminRecord): void {
  try {
    sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(admin));
  } catch {
    // Ignore storage errors
  }
}

export function clearStoredAdminSession(): void {
  try {
    sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Sign in administrator strictly using Google Authentication provider.
 * Anonymous authentication or synthetic admin bypass is strictly prohibited.
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
  if (adminRecord && adminRecord.enabled) {
    saveStoredAdminSession(adminRecord);
  } else {
    clearStoredAdminSession();
  }
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
  clearStoredAdminSession();
  try {
    await signOut(auth);
  } catch {
    // Best-effort signout
  }
}

/**
 * Subscribes to Firebase Auth state changes and automatically verifies
 * whether the current authenticated user has an active admin record in `/admins/{uid}`.
 * Strictly requires a non-anonymous Firebase Auth user session.
 */
export function subscribeToAdminAuth(
  callback: (user: User | null, adminRecord: AdminRecord | null, loading: boolean) => void
): () => void {
  return onAuthStateChanged(auth, async (user) => {
    if (!user || user.isAnonymous) {
      clearStoredAdminSession();
      callback(null, null, false);
      return;
    }

    try {
      const adminRecord = await verifyAdminUser(user.uid);
      if (adminRecord && adminRecord.enabled) {
        saveStoredAdminSession(adminRecord);
        callback(user, adminRecord, false);
      } else {
        clearStoredAdminSession();
        callback(user, null, false);
      }
    } catch (err) {
      console.warn('Failed to verify admin status on auth state change:', err);
      clearStoredAdminSession();
      callback(user, null, false);
    }
  });
}
