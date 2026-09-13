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
import { db } from './firebase';
import {
  PublicForm,
  PublicFormInfo,
  PublicFormStatus,
  AuthorizedFormSession,
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
const SESSION_STORAGE_PREFIX = 'reqforge_pform_session_';

// ---------------------------------------------------------------------------
// ADMIN OPERATIONS
// ---------------------------------------------------------------------------

export interface CreatePublicFormParams {
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
  pin?: string; // If omitted, PIN can be auto-generated or left unprotected
  requirePin?: boolean; // Default: true
}

/**
 * Creates a new PIN-protected Public Form assignment.
 * Returns the created form and the one-time plaintext PIN for the admin.
 */
export async function createPublicForm(
  params: CreatePublicFormParams
): Promise<{ form: PublicForm; plaintextPin: string }> {
  const publicFormId = generatePublicFormId();
  const requirePin = params.requirePin !== false;
  const plaintextPin = params.pin ? params.pin.trim() : generateRandomPin(6);

  const salt = generateSalt(16);
  const pinHashVal = requirePin ? await hashPin(plaintextPin, salt) : '';
  const sealed = await sealShareToken(params.shareToken, plaintextPin, salt);

  const now = new Date().toISOString();

  const newForm: PublicForm = {
    id: publicFormId,
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
    shareToken: params.shareToken,
    pinHash: pinHashVal,
    pinSalt: salt,
    encryptedShareToken: sealed.encrypted,
    iv: sealed.iv,
    authTag: sealed.authTag,
    hasPin: requirePin,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    submissionCount: 0,
  };

  const docRef = doc(db, PUBLIC_FORMS_COLLECTION, publicFormId);
  await setDoc(docRef, newForm);

  return { form: newForm, plaintextPin: requirePin ? plaintextPin : '' };
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
  const docRef = doc(db, PUBLIC_FORMS_COLLECTION, publicFormId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    throw new Error('Public form not found.');
  }

  const form = snap.data() as PublicForm;
  const plaintextPin = newPin ? newPin.trim() : generateRandomPin(6);
  const newSalt = generateSalt(16);
  const pinHashVal = await hashPin(plaintextPin, newSalt);
  const sealed = await sealShareToken(form.shareToken, plaintextPin, newSalt);

  await updateDoc(docRef, {
    pinHash: pinHashVal,
    pinSalt: newSalt,
    encryptedShareToken: sealed.encrypted,
    iv: sealed.iv,
    authTag: sealed.authTag,
    hasPin: true,
    updatedAt: new Date().toISOString(),
  });

  return { plaintextPin };
}

/**
 * Changes status of a public form ('active' | 'disabled' | 'revoked').
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
 * Lists all public forms for the administrator console.
 */
export async function listPublicForms(): Promise<PublicForm[]> {
  const colRef = collection(db, PUBLIC_FORMS_COLLECTION);
  const snap = await getDocs(colRef);
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
 * Strips all internal secrets, capability tokens, and hashes.
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
      title: d.title || 'Client Questionnaire',
      description: d.description || '',
      instructions: d.instructions || '',
      contactInfo: d.contactInfo || '',
      projectName: d.projectName || '',
      clientName: d.clientName || '',
      hasPin: d.hasPin !== false,
      status: (d.status as PublicFormStatus) || 'active',
    };
  } catch {
    return null;
  }
}

/**
 * Verifies the client-entered PIN against the public form.
 * If valid and status is 'active', returns the authorized session with the capability token.
 */
export async function verifyPublicFormPin(
  publicFormId: string,
  enteredPin: string
): Promise<{ success: boolean; session?: AuthorizedFormSession; error?: string }> {
  // 1. Try server verification endpoint first
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
    // Fall back to direct Firestore cryptographic verification
  }

  // 2. Direct cryptographic verification fallback
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

    if (!form.hasPin) {
      const session: AuthorizedFormSession = {
        publicFormId: form.id,
        projectId: form.projectId,
        shareToken: form.shareToken,
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

    // Verify hash
    const computedHash = await hashPin(enteredPin, form.pinSalt);
    if (computedHash !== form.pinHash) {
      return {
        success: false,
        error: 'Incorrect access PIN. Please check the code provided by your administrator.',
      };
    }

    // If encrypted share token is present, unseal it; otherwise use stored shareToken
    let tokenToUse = form.shareToken;
    if (form.encryptedShareToken && form.iv && form.authTag) {
      const unsealed = await unsealShareToken(
        form.encryptedShareToken,
        form.iv,
        form.authTag,
        enteredPin,
        form.pinSalt
      );
      if (unsealed) {
        tokenToUse = unsealed;
      }
    }

    const session: AuthorizedFormSession = {
      publicFormId: form.id,
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
