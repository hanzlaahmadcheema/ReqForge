/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from './firebase';
import { Workspace, UserProfile, Questionnaire } from '../types';
import { seedQuestionnaireIfMissing } from './questionnaireService';

const WORKSPACES_COLLECTION = 'workspaces';
const USERS_COLLECTION = 'users';

/**
 * Resolves or automatically creates the single workspace for the registered user.
 * Product decision: 1 registered user = exactly 1 workspace (workspaceId === user.uid).
 */
export async function getOrCreateUserWorkspace(user: User): Promise<Workspace> {
  const workspaceId = user.uid;
  const wsDocRef = doc(db, WORKSPACES_COLLECTION, workspaceId);

  try {
    const snap = await getDoc(wsDocRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        id: workspaceId,
        name: data.name || `${user.displayName || user.email?.split('@')[0] || 'My'}'s Workspace`,
        ownerId: user.uid,
        ownerEmail: data.ownerEmail || user.email || '',
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
    }
  } catch (err) {
    console.warn('Could not read existing workspace, creating new one:', err);
  }

  // Create new workspace document strictly bound to user.uid
  const now = new Date().toISOString();
  const displayName = user.displayName || user.email?.split('@')[0] || 'User';
  const defaultWorkspaceName = `${displayName}'s Workspace`;

  const newWorkspace: Workspace = {
    id: workspaceId,
    name: defaultWorkspaceName,
    ownerId: user.uid,
    ownerEmail: user.email || '',
    createdAt: now,
    updatedAt: now,
  };

  try {
    await setDoc(wsDocRef, newWorkspace, { merge: true });
  } catch (err) {
    console.error('Failed to create workspace document:', err);
    throw err;
  }

  // Also maintain user profile document for quick reference
  try {
    const userDocRef = doc(db, USERS_COLLECTION, user.uid);
    const profile: Record<string, any> = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || user.email?.split('@')[0] || 'User',
      workspaceId,
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(userDocRef, profile, { merge: true });
  } catch (err) {
    console.warn('Could not save user profile record:', err);
  }

  return newWorkspace;
}

/**
 * Fetches an existing workspace by ID. Enforces ownership through Firestore rules.
 */
export async function getWorkspace(workspaceId: string): Promise<Workspace | null> {
  const wsDocRef = doc(db, WORKSPACES_COLLECTION, workspaceId);
  const snap = await getDoc(wsDocRef);
  if (!snap.exists()) return null;
  return snap.data() as Workspace;
}

/**
 * Updates the display name of a workspace.
 */
export async function updateWorkspaceName(workspaceId: string, name: string): Promise<void> {
  const wsDocRef = doc(db, WORKSPACES_COLLECTION, workspaceId);
  await updateDoc(wsDocRef, {
    name: name.trim(),
    updatedAt: new Date().toISOString(),
  });
}
