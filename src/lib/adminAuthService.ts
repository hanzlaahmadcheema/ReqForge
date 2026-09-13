/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { AdminRecord, Workspace } from '../types';
import { getOrCreateUserWorkspace } from './workspaceService';

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
 * Register a new user with Email and Password.
 * Automatically provisions exactly one workspace for the new user.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  displayName?: string
): Promise<{
  user: User;
  workspace: Workspace;
  adminRecord: AdminRecord | null;
}> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const user = cred.user;

  if (displayName && displayName.trim()) {
    try {
      await updateProfile(user, { displayName: displayName.trim() });
    } catch (err) {
      console.warn('Could not set displayName on user profile:', err);
    }
  }

  const workspace = await getOrCreateUserWorkspace(user);
  const adminRecord = await verifyAdminUser(user.uid);

  if (adminRecord && adminRecord.enabled) {
    saveStoredAdminSession(adminRecord);
  }

  return { user, workspace, adminRecord };
}

/**
 * Authenticate existing user with Email and Password.
 * Automatically resolves their single workspace.
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<{
  user: User;
  workspace: Workspace;
  adminRecord: AdminRecord | null;
}> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  const user = cred.user;

  const workspace = await getOrCreateUserWorkspace(user);
  const adminRecord = await verifyAdminUser(user.uid);

  if (adminRecord && adminRecord.enabled) {
    saveStoredAdminSession(adminRecord);
  }

  return { user, workspace, adminRecord };
}

/**
 * Sign in user using Google Authentication provider.
 * Automatically resolves or provisions their single workspace.
 */
export async function signInWithGoogle(): Promise<{
  user: User;
  workspace: Workspace;
  adminRecord: AdminRecord | null;
}> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  const workspace = await getOrCreateUserWorkspace(user);
  const adminRecord = await verifyAdminUser(user.uid);

  if (adminRecord && adminRecord.enabled) {
    saveStoredAdminSession(adminRecord);
  } else {
    clearStoredAdminSession();
  }

  return { user, workspace, adminRecord };
}

/**
 * Legacy alias for Google sign in
 */
export async function signInAdminWithGoogle(): Promise<{
  user: User;
  adminRecord: AdminRecord | null;
  workspace?: Workspace;
}> {
  const res = await signInWithGoogle();
  return { user: res.user, adminRecord: res.adminRecord, workspace: res.workspace };
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
 * Signs out the currently authenticated user and clears local session cache.
 */
export async function signOutAdmin(): Promise<void> {
  clearStoredAdminSession();
  try {
    await signOut(auth);
  } catch {
    // Best-effort signout
  }
}

export const signOutUser = signOutAdmin;

/**
 * Multi-Tenant Auth Subscription:
 * Subscribes to Firebase Auth state changes, resolves the user's workspace,
 * and checks admin status.
 */
export function subscribeToAuth(
  callback: (
    user: User | null,
    workspace: Workspace | null,
    adminRecord: AdminRecord | null,
    loading: boolean
  ) => void
): () => void {
  return onAuthStateChanged(auth, async (user) => {
    if (!user || user.isAnonymous) {
      clearStoredAdminSession();
      callback(null, null, null, false);
      return;
    }

    try {
      // 1. Resolve or create user's workspace
      const workspace = await getOrCreateUserWorkspace(user);

      // 2. Check for optional super-admin allowlist record
      const adminRecord = await verifyAdminUser(user.uid);
      if (adminRecord && adminRecord.enabled) {
        saveStoredAdminSession(adminRecord);
      } else {
        clearStoredAdminSession();
      }

      callback(user, workspace, adminRecord, false);
    } catch (err) {
      console.error('Failed to resolve workspace/admin on auth state change:', err);
      callback(user, null, null, false);
    }
  });
}

/**
 * Backward compatibility wrapper for Phase 1-5 callers
 */
export function subscribeToAdminAuth(
  callback: (user: User | null, adminRecord: AdminRecord | null, loading: boolean) => void
): () => void {
  return subscribeToAuth((user, _workspace, adminRecord, loading) => {
    callback(user, adminRecord, loading);
  });
}
