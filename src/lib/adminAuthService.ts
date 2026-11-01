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
  EmailAuthProvider,
  linkWithCredential,
  linkWithPopup,
  unlink,
  updatePassword,
  onAuthStateChanged,
  type User,
  type AuthCredential,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { AdminRecord, Workspace, UserAuthProviders } from '../types';
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

// ---------------------------------------------------------------------------
// MULTI-PROVIDER ACCOUNT LINKING & CREDENTIAL MANAGEMENT
// ---------------------------------------------------------------------------

/**
 * Returns structured information about the user's linked authentication providers.
 */
export function getUserAuthProviders(user: User | null): UserAuthProviders {
  if (!user) {
    return {
      hasGoogle: false,
      hasPassword: false,
      googleEmail: null,
      email: null,
      providers: [],
    };
  }

  const providers = user.providerData.map((p) => p.providerId);
  const googleProvider = user.providerData.find((p) => p.providerId === 'google.com');

  return {
    hasGoogle: providers.includes('google.com'),
    hasPassword: providers.includes('password'),
    googleEmail: googleProvider?.email || null,
    email: user.email,
    providers,
  };
}

/**
 * Synchronizes the user's active auth providers into the Firestore /users/{uid} document.
 */
export async function syncUserProfileProviders(user: User): Promise<void> {
  try {
    const userDocRef = doc(db, 'users', user.uid);
    const providers = user.providerData.map((p) => p.providerId);
    await setDoc(
      userDocRef,
      {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email?.split('@')[0] || 'User',
        providers,
        hasGoogle: providers.includes('google.com'),
        hasPassword: providers.includes('password'),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Could not sync user profile providers to Firestore:', err);
  }
}

/**
 * Sets or updates the password for the currently authenticated user.
 * - If the user has only Google linked (no 'password' provider), links EmailAuthProvider credential.
 * - If the user already has 'password' provider, updates their existing password.
 */
export async function setPasswordForCurrentUser(password: string): Promise<User> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No user is currently authenticated.');
  }
  if (!user.email) {
    throw new Error('A verified email address is required to set an account password.');
  }
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  const hasPasswordProvider = user.providerData.some((p) => p.providerId === 'password');

  if (hasPasswordProvider) {
    // User already has email/password linked; update password
    await updatePassword(user, password);
  } else {
    // User does not have password linked (e.g. signed up with Google); link credential
    const credential = EmailAuthProvider.credential(user.email, password);
    await linkWithCredential(user, credential);
  }

  // Reload current user to reflect updated providerData
  await user.reload();
  const refreshedUser = auth.currentUser || user;

  // Sync to Firestore user profile
  await syncUserProfileProviders(refreshedUser);

  return refreshedUser;
}

/**
 * Attaches/links a Google account to the currently authenticated user
 * (e.g. for users who originally registered with email and password).
 */
export async function linkGoogleToCurrentUser(): Promise<User> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No user is currently authenticated.');
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await linkWithPopup(user, provider);
  const updatedUser = result.user;

  await updatedUser.reload();
  const refreshedUser = auth.currentUser || updatedUser;

  // Sync to Firestore user profile
  await syncUserProfileProviders(refreshedUser);

  return refreshedUser;
}

/**
 * Disconnects a sign-in provider (e.g. unlinks Google or Password),
 * enforcing that at least one sign-in provider remains active.
 */
export async function unlinkProviderFromCurrentUser(providerId: string): Promise<User> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No user is currently authenticated.');
  }

  if (user.providerData.length <= 1) {
    throw new Error('You cannot disconnect your only sign-in method.');
  }

  const updatedUser = await unlink(user, providerId);
  await updatedUser.reload();
  const refreshedUser = auth.currentUser || updatedUser;

  await syncUserProfileProviders(refreshedUser);

  return refreshedUser;
}

/**
 * Links a pending Google credential to an existing email/password account
 * when a user clicks 'Continue with Google' on an email that already exists.
 */
export async function linkGoogleWithPasswordOnSignIn(
  email: string,
  password: string,
  pendingCredential: AuthCredential
): Promise<{
  user: User;
  workspace: Workspace;
  adminRecord: AdminRecord | null;
}> {
  // Sign in with email and password first
  const userCred = await signInWithEmailAndPassword(auth, email.trim(), password);
  let user = userCred.user;

  // Link the pending Google credential
  try {
    const linkResult = await linkWithCredential(user, pendingCredential);
    user = linkResult.user;
    await user.reload();
    user = auth.currentUser || user;
  } catch (linkErr) {
    console.warn('Failed to link pending Google credential:', linkErr);
  }

  const workspace = await getOrCreateUserWorkspace(user);
  const adminRecord = await verifyAdminUser(user.uid);

  if (adminRecord && adminRecord.enabled) {
    saveStoredAdminSession(adminRecord);
  }

  await syncUserProfileProviders(user);

  return { user, workspace, adminRecord };
}

/**
 * Updates the display name on the Firebase Auth user and Firestore documents.
 */
export async function updateUserDisplayName(displayName: string): Promise<User> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No user is currently authenticated.');
  }

  const trimmed = displayName.trim();
  await updateProfile(user, { displayName: trimmed });
  await user.reload();
  const refreshedUser = auth.currentUser || user;

  // Update in Firestore users collection
  try {
    const userDocRef = doc(db, 'users', user.uid);
    await setDoc(
      userDocRef,
      {
        displayName: trimmed,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Could not update user display name in Firestore:', err);
  }

  return refreshedUser;
}
