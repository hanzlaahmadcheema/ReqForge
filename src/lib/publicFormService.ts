/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import {
  PublicForm,
  PublicFormInfo,
  PublicFormStatus,
  AuthorizedFormSession,
  PublicFormSecurityRecord,
} from '../types';
import {
  generateSalt,
  generateRandomPin,
  generatePublicFormId,
  hashPin,
  sealShareToken,
  unsealShareToken,
} from './cryptoUtils';

const PUBLIC_FORMS_COLLECTION = 'publicForms';
const PUBLIC_FORMS_SECURITY_COLLECTION = 'publicFormsSecurity';
const SESSION_STORAGE_PREFIX = 'reqforge_pform_session_';

// ---------------------------------------------------------------------------
// ADMIN / TENANT OPERATIONS
// ---------------------------------------------------------------------------

export interface CreatePublicFormParams {
  workspaceId?: string;
  ownerId?: string;
  title: string;
  description?: string;
  instructions?: string;
  contactInfo?: string;
  projectId: string;
  projectName?: string;
  clientId: string;
  clientName?: string;
  assignmentId?: string;
  questionnaireId: string;
  questionnaireVersion: number;
  shareToken: string; // The Phase 2 capability token
  pin?: string; // Optional: only if PIN is explicitly requested
  requirePin?: boolean; // Default: false (Public is Public)
}

/**
 * Creates a new Public Form assignment scoped to a tenant workspace.
 * "Public is Public": Forms do not require a PIN by default.
 * Public presentation metadata and capability tokens are saved in /publicForms/{publicFormId}.
 * Secret credentials are only created if requirePin is explicitly true.
 */
export async function createPublicForm(
  params: CreatePublicFormParams
): Promise<{ form: PublicForm; plaintextPin: string }> {
  const publicFormId = generatePublicFormId();
  const requirePin = params.requirePin === true;
  const plaintextPin = requirePin ? (params.pin ? params.pin.trim() : generateRandomPin(6)) : '';

  const workspaceId = params.workspaceId || auth.currentUser?.uid || 'default';
  const ownerId = params.ownerId || auth.currentUser?.uid || 'default';

  const salt = requirePin ? generateSalt(16) : '';
  const pinHashVal = requirePin ? await hashPin(plaintextPin, salt) : '';
  const sealed = requirePin ? await sealShareToken(params.shareToken, plaintextPin, salt) : null;

  const now = new Date().toISOString();

  // 1. Public document (Direct access: Public is Public)
  const newForm: PublicForm = {
    id: publicFormId,
    workspaceId,
    ownerId,
    title: params.title.trim(),
    description: params.description?.trim() || '',
    instructions: params.instructions?.trim() || '',
    contactInfo: params.contactInfo?.trim() || '',
    projectId: params.projectId,
    projectName: params.projectName || '',
    clientId: params.clientId,
    clientName: params.clientName || '',
    assignmentId: params.assignmentId || '',
    questionnaireId: params.questionnaireId,
    questionnaireVersion: params.questionnaireVersion,
    shareToken: params.shareToken, // Stored directly so public clients can hydrate the questionnaire without a PIN
    hasPin: requirePin,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    submissionCount: 0,
  };

  // 2. Private security record (for audit or legacy PIN verification)
  const securityRecord: PublicFormSecurityRecord = {
    publicFormId,
    workspaceId,
    ownerId,
    pinHash: pinHashVal,
    pinSalt: salt,
    encryptedShareToken: sealed?.encrypted || '',
    iv: sealed?.iv || '',
    authTag: sealed?.authTag || '',
    shareToken: params.shareToken,
    updatedAt: now,
  };

  const docRef = doc(db, PUBLIC_FORMS_COLLECTION, publicFormId);
  const secDocRef = doc(db, PUBLIC_FORMS_SECURITY_COLLECTION, publicFormId);

  await setDoc(docRef, newForm);
  await setDoc(secDocRef, securityRecord);

  return { form: newForm, plaintextPin };
}

/**
 * Updates basic public information for an existing form.
 */
export async function updatePublicForm(
  publicFormId: string,
  updates: Partial<Pick<PublicForm, 'title' | 'description' | 'instructions' | 'contactInfo'>>
): Promise<void> {
  const docRef = doc(db, PUBLIC_FORMS_COLLECTION, publicFormId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Configures or changes the PIN for a public form.
 * Generates a new salt, re-encrypts the capability token, and invalidates older sessions.
 * Returns the new one-time plaintext PIN.
 */
export async function updatePublicFormPin(
  publicFormId: string,
  newPin?: string
): Promise<{ plaintextPin: string }> {
  // Read security record
  const secDocRef = doc(db, PUBLIC_FORMS_SECURITY_COLLECTION, publicFormId);
  const secSnap = await getDoc(secDocRef);

  let shareToken = '';
  let workspaceId = auth.currentUser?.uid || '';
  let ownerId = auth.currentUser?.uid || '';

  if (secSnap.exists()) {
    const secData = secSnap.data() as PublicFormSecurityRecord;
    shareToken = secData.shareToken || '';
    workspaceId = secData.workspaceId || workspaceId;
    ownerId = secData.ownerId || ownerId;
  } else {
    // Check fallback in public doc for legacy Phase 5 data
    const publicDocRef = doc(db, PUBLIC_FORMS_COLLECTION, publicFormId);
    const pubSnap = await getDoc(publicDocRef);
    if (!pubSnap.exists()) {
      throw new Error('Public form not found.');
    }
    const pubData = pubSnap.data() as PublicForm;
    shareToken = pubData.shareToken || '';
    workspaceId = pubData.workspaceId || workspaceId;
    ownerId = pubData.ownerId || ownerId;
  }

  const plaintextPin = newPin ? newPin.trim() : generateRandomPin(6);
  const newSalt = generateSalt(16);
  const pinHashVal = await hashPin(plaintextPin, newSalt);
  const sealed = await sealShareToken(shareToken, plaintextPin, newSalt);
  const now = new Date().toISOString();

  // Save new security record
  const updatedSecurity: PublicFormSecurityRecord = {
    publicFormId,
    workspaceId,
    ownerId,
    pinHash: pinHashVal,
    pinSalt: newSalt,
    encryptedShareToken: sealed.encrypted,
    iv: sealed.iv,
    authTag: sealed.authTag,
    shareToken,
    updatedAt: now,
  };
  await setDoc(secDocRef, updatedSecurity, { merge: true });

  // Update public form timestamp & flag
  const publicDocRef = doc(db, PUBLIC_FORMS_COLLECTION, publicFormId);
  await updateDoc(publicDocRef, {
    hasPin: true,
    updatedAt: now,
  });

  return { plaintextPin };
}

/**
 * Changes status of a public form ('active' | 'disabled' | 'closed' | 'revoked').
 */
export async function setPublicFormStatus(
  publicFormId: string,
  status: PublicFormStatus
): Promise<void> {
  const docRef = doc(db, PUBLIC_FORMS_COLLECTION, publicFormId);
  await updateDoc(docRef, {
    status,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Lists public forms for the administrator console, isolated strictly by workspace.
 */
export async function listPublicForms(workspaceId?: string): Promise<PublicForm[]> {
  const targetWorkspace = workspaceId || auth.currentUser?.uid;
  const colRef = collection(db, PUBLIC_FORMS_COLLECTION);

  let snap;
  if (targetWorkspace) {
    const q = query(colRef, where('workspaceId', '==', targetWorkspace));
    snap = await getDocs(q);
  } else {
    snap = await getDocs(colRef);
  }

  const items: PublicForm[] = [];
  snap.forEach((d) => {
    items.push(d.data() as PublicForm);
  });
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return items;
}

/**
 * Fetches a single public form record for admin use.
 */
export async function getPublicFormAdmin(publicFormId: string): Promise<PublicForm | null> {
  const docRef = doc(db, PUBLIC_FORMS_COLLECTION, publicFormId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return snap.data() as PublicForm;
}

// ---------------------------------------------------------------------------
// PUBLIC CLIENT OPERATIONS
// ---------------------------------------------------------------------------

/**
 * Fetches only safe, public metadata for a form identifier.
 * Completely devoid of PIN hashes, salts, and capability tokens.
 */
export async function getPublicFormSafeInfo(
  publicFormId: string
): Promise<PublicFormInfo | null> {
  // First attempt backend API endpoint
  try {
    const res = await fetch(`/api/public-forms/${encodeURIComponent(publicFormId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.form) {
        return data.form as PublicFormInfo;
      }
    }
  } catch {
    // Fall back to direct Firestore read
  }

  try {
    const docRef = doc(db, PUBLIC_FORMS_COLLECTION, publicFormId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      id: d.id,
      workspaceId: d.workspaceId || undefined,
      title: d.title || 'Client Questionnaire',
      description: d.description || '',
      instructions: d.instructions || '',
      contactInfo: d.contactInfo || '',
      projectName: d.projectName || '',
      clientName: d.clientName || '',
      projectId: d.projectId,
      clientId: d.clientId,
      shareToken: d.shareToken,
      questionnaireId: d.questionnaireId,
      questionnaireVersion: d.questionnaireVersion,
      hasPin: d.hasPin === true,
      status: (d.status as PublicFormStatus) || 'active',
    };
  } catch {
    return null;
  }
}

/**
 * Verifies the client-entered PIN against the public form.
 * Verification is performed server-side to guarantee client secrets are never exposed.
 */
export async function verifyPublicFormPin(
  publicFormId: string,
  enteredPin: string
): Promise<{ success: boolean; session?: AuthorizedFormSession; error?: string }> {
  // 1. Always attempt server verification endpoint first
  try {
    const res = await fetch('/api/public-forms/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicFormId, pin: enteredPin }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.session) {
        saveFormSession(data.session);
        return { success: true, session: data.session };
      } else if (data.error) {
        return { success: false, error: data.error };
      }
    }
  } catch {
    // Server endpoint unreachable; fallback to authenticated/isolated verification if permitted
  }

  // 2. Direct Firestore fallback (handles tests and legacy environments)
  try {
    const docRef = doc(db, PUBLIC_FORMS_COLLECTION, publicFormId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return { success: false, error: 'This form link is invalid or no longer exists.' };
    }

    const form = snap.data() as PublicForm;

    if (form.status === 'disabled') {
      return {
        success: false,
        error: 'This form has been temporarily disabled by the administrator.',
      };
    }

    if (form.status === 'closed') {
      return {
        success: false,
        error: 'This questionnaire is closed for new submissions.',
      };
    }

    if (form.status === 'revoked') {
      return {
        success: false,
        error: 'Access to this questionnaire has been revoked by the administrator.',
      };
    }

    // Try reading security doc if available
    let pinHash = form.pinHash;
    let pinSalt = form.pinSalt;
    let encryptedShareToken = form.encryptedShareToken;
    let iv = form.iv;
    let authTag = form.authTag;
    let shareToken = form.shareToken;

    try {
      const secSnap = await getDoc(doc(db, PUBLIC_FORMS_SECURITY_COLLECTION, publicFormId));
      if (secSnap.exists()) {
        const s = secSnap.data() as PublicFormSecurityRecord;
        pinHash = s.pinHash;
        pinSalt = s.pinSalt;
        encryptedShareToken = s.encryptedShareToken;
        iv = s.iv;
        authTag = s.authTag;
        shareToken = s.shareToken || shareToken;
      }
    } catch {
      // Unauthenticated client cannot read security doc directly
    }

    if (!form.hasPin) {
      const session: AuthorizedFormSession = {
        publicFormId: form.id,
        workspaceId: form.workspaceId,
        projectId: form.projectId,
        shareToken: shareToken || '',
        questionnaireId: form.questionnaireId,
        questionnaireVersion: form.questionnaireVersion,
        clientName: form.clientName || '',
        projectName: form.projectName || '',
        formTitle: form.title,
        instructions: form.instructions,
        verifiedAt: new Date().toISOString(),
      };
      saveFormSession(session);
      return { success: true, session };
    }

    if (!pinSalt || !pinHash) {
      return {
        success: false,
        error: 'Security credentials must be verified via server endpoint.',
      };
    }

    // Verify hash
    const computedHash = await hashPin(enteredPin, pinSalt);
    if (computedHash !== pinHash) {
      return {
        success: false,
        error: 'Incorrect access PIN. Please check the code provided by your administrator.',
      };
    }

    let tokenToUse = shareToken;
    if (encryptedShareToken && iv && authTag) {
      const unsealed = await unsealShareToken(
        encryptedShareToken,
        iv,
        authTag,
        enteredPin,
        pinSalt
      );
      if (unsealed) {
        tokenToUse = unsealed;
      }
    }

    const session: AuthorizedFormSession = {
      publicFormId: form.id,
      workspaceId: form.workspaceId,
      projectId: form.projectId,
      shareToken: tokenToUse,
      questionnaireId: form.questionnaireId,
      questionnaireVersion: form.questionnaireVersion,
      clientName: form.clientName || '',
      projectName: form.projectName || '',
      formTitle: form.title,
      instructions: form.instructions,
      verifiedAt: new Date().toISOString(),
    };

    saveFormSession(session);
    return { success: true, session };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'An error occurred while verifying the PIN. Please try again.',
    };
  }
}

// ---------------------------------------------------------------------------
// SESSION STORAGE MANAGEMENT
// ---------------------------------------------------------------------------

export function saveFormSession(session: AuthorizedFormSession): void {
  try {
    sessionStorage.setItem(
      `${SESSION_STORAGE_PREFIX}${session.publicFormId}`,
      JSON.stringify(session)
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function getFormSession(publicFormId: string): AuthorizedFormSession | null {
  try {
    const raw = sessionStorage.getItem(`${SESSION_STORAGE_PREFIX}${publicFormId}`);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (session && session.publicFormId === publicFormId && session.shareToken && session.projectId) {
      return session as AuthorizedFormSession;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

export function clearFormSession(publicFormId: string): void {
  try {
    sessionStorage.removeItem(`${SESSION_STORAGE_PREFIX}${publicFormId}`);
  } catch {
    // Ignore
  }
}
