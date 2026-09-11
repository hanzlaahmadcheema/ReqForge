import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  collection,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import firebaseConfigData from '../../firebase-applet-config.json';
import { QuestionnaireAnswers, StoredSubmission } from '../types';

const firebaseConfig = {
  apiKey: firebaseConfigData.apiKey,
  authDomain: firebaseConfigData.authDomain,
  projectId: firebaseConfigData.projectId,
  storageBucket: firebaseConfigData.storageBucket,
  messagingSenderId: firebaseConfigData.messagingSenderId,
  appId: firebaseConfigData.appId,
};

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase Auth
export const auth = getAuth(app);

// Initialize Firestore with specific databaseId if provided and force long-polling
// to prevent WebChannel connection drops/unavailable errors in proxy & sandbox environments
const firestoreDbId = firebaseConfigData.firestoreDatabaseId;
let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      experimentalForceLongPolling: true,
    },
    firestoreDbId && firestoreDbId !== '(default)' ? firestoreDbId : undefined
  );
} catch {
  firestoreInstance = firestoreDbId && firestoreDbId !== '(default)'
    ? getFirestore(app, firestoreDbId)
    : getFirestore(app);
}

export const db: Firestore = firestoreInstance;

export interface SubmissionPayload {
  clientCode: string;
  formId?: string;
  formTitle?: string;
  contactPerson?: string | null;
  contactPhone?: string | null;
  usersCount: Record<string, unknown>;
  articleInformation: Record<string, unknown>;
  stockUnits: Record<string, unknown>;
  stockIn: Record<string, unknown>;
  stockOut: Record<string, unknown>;
  damage: Record<string, unknown>;
  returns: Record<string, unknown>;
  prices: Record<string, unknown>;
  expenses: Record<string, unknown>;
  dailyCheck: Record<string, unknown>;
  cashBalance: Record<string, unknown>;
  profit: Record<string, unknown>;
  ownerAccess: Record<string, unknown>;
  corrections: Record<string, unknown>;
  reports: Record<string, unknown>;
  additionalRequirements: string;
  submittedAt: unknown;
  submittedAtIso: string;
  answers: Record<string, unknown>;
  rawAnswers?: QuestionnaireAnswers;
  isMasterDoc?: boolean;
  submissionDocId?: string;
}

/**
 * Recursively removes `undefined` properties or converts them so Firestore setDoc does not throw
 * "Function setDoc() called with invalid data. Unsupported field value: undefined"
 */
function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) {
    return null as unknown as T;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  const cleanObj: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (value !== undefined) {
      cleanObj[key] = sanitizeForFirestore(value);
    } else {
      cleanObj[key] = null;
    }
  }
  return cleanObj as unknown as T;
}

/**
 * Saves the completed client questionnaire response to Firestore
 * Creates a timestamped document (e.g. clientIdentifier_2026_09_06_1625)
 * and also updates the master client document for immediate lookup.
 */
export async function saveClientResponse(
  clientCode: string,
  payload: Omit<SubmissionPayload, 'submittedAt' | 'submittedAtIso'>
): Promise<{ docId: string; masterDocId: string }> {
  const cleanClientCode = (clientCode.trim() || 'default_client').replace(/[^a-zA-Z0-9_-]/g, '_');
  
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  const dateStr = `${year}_${month}_${day}`;
  const timeStr = `${hours}${minutes}${seconds}`;
  const timestampedDocId = `${cleanClientCode}_${dateStr}_${timeStr}`;
  const masterDocId = cleanClientCode;

  const baseData: SubmissionPayload = {
    ...payload,
    clientCode: cleanClientCode,
    formId: payload.formId || 'default_questionnaire',
    formTitle: payload.formTitle || 'Requirements Questionnaire',
    contactPerson: payload.contactPerson ?? null,
    contactPhone: payload.contactPhone ?? null,
    additionalRequirements: payload.additionalRequirements ?? '',
    submittedAt: serverTimestamp(),
    submittedAtIso: now.toISOString(),
    submissionDocId: timestampedDocId,
  };

  // 1. Write historical timestamped submission (isMasterDoc: false)
  const historicalData = sanitizeForFirestore({
    ...baseData,
    isMasterDoc: false,
  });
  const timestampedDocRef = doc(db, 'clientResponses', timestampedDocId);
  await setDoc(timestampedDocRef, historicalData);

  // 2. Also update the direct client master doc (isMasterDoc: true)
  const masterData = sanitizeForFirestore({
    ...baseData,
    isMasterDoc: true,
  });
  const masterDocRef = doc(db, 'clientResponses', masterDocId);
  await setDoc(masterDocRef, masterData);

  return {
    docId: timestampedDocId,
    masterDocId,
  };
}

/**
 * Reconstructs a full QuestionnaireAnswers map from a stored Firestore document,
 * ensuring compatibility with past submissions or newly structured ones.
 */
export function reconstructAnswersFromSubmission(data: Record<string, unknown>): QuestionnaireAnswers {
  const result: QuestionnaireAnswers = {};

  if (data.rawAnswers && typeof data.rawAnswers === 'object') {
    return data.rawAnswers as QuestionnaireAnswers;
  }

  // Section keys used in the questionnaire
  const sectionKeys = [
    'usersCount',
    'articleInformation',
    'stockUnits',
    'stockIn',
    'stockOut',
    'damage',
    'returns',
    'prices',
    'expenses',
    'dailyCheck',
    'cashBalance',
    'profit',
    'ownerAccess',
    'corrections',
    'reports',
  ];

  for (const sKey of sectionKeys) {
    const secObj = data[sKey];
    if (secObj && typeof secObj === 'object') {
      for (const [qId, qData] of Object.entries(secObj as Record<string, unknown>)) {
        if (qData && typeof qData === 'object') {
          const item = qData as Record<string, unknown>;
          result[qId] = {
            value: (item.value as string | number | boolean | string[] | null) ?? null,
            otherText: item.otherText ? String(item.otherText) : undefined,
            conditionalValue: (item.conditionalValue as string | number | boolean | string[] | null) ?? undefined,
            conditionalOtherText: item.conditionalOtherText ? String(item.conditionalOtherText) : undefined,
          };
        }
      }
    }
  }

  // Fallback to top-level answers map if any questions were missed
  if (data.answers && typeof data.answers === 'object') {
    for (const [qId, val] of Object.entries(data.answers as Record<string, unknown>)) {
      if (!result[qId]) {
        if (val && typeof val === 'object' && 'value' in val) {
          const item = val as Record<string, unknown>;
          result[qId] = {
            value: (item.value as string | number | boolean | string[] | null) ?? null,
            otherText: item.otherText ? String(item.otherText) : undefined,
            conditionalValue: (item.conditionalValue as string | number | boolean | string[] | null) ?? undefined,
            conditionalOtherText: item.conditionalOtherText ? String(item.conditionalOtherText) : undefined,
          };
        } else {
          result[qId] = {
            value: val as string | number | boolean | string[] | null,
          };
        }
      }
    }
  }

  return result;
}

/**
 * Fetches all client submissions stored in Firestore collection 'clientResponses'
 */
export async function fetchClientSubmissions(): Promise<StoredSubmission[]> {
  const colRef = collection(db, 'clientResponses');
  const snapshot = await getDocs(colRef);
  const items: StoredSubmission[] = [];

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const docId = docSnap.id;
    const clientCode = String(data.clientCode || docId);
    const submittedAtIso = String(
      data.submittedAtIso ||
      (data.submittedAt?.toDate ? data.submittedAt.toDate().toISOString() : new Date().toISOString())
    );

    // Identify if doc is the master record or historical submission
    const isMasterDoc = data.isMasterDoc ?? (docId === clientCode);

    items.push({
      ...data,
      id: docId,
      clientCode,
      formId: data.formId ? String(data.formId) : 'default_questionnaire',
      formTitle: data.formTitle ? String(data.formTitle) : 'Requirements Questionnaire',
      contactPerson: data.contactPerson ? String(data.contactPerson) : null,
      contactPhone: data.contactPhone ? String(data.contactPhone) : null,
      additionalRequirements: data.additionalRequirements ? String(data.additionalRequirements) : '',
      submittedAtIso,
      submittedAt: data.submittedAt,
      isMasterDoc,
      submissionDocId: data.submissionDocId ? String(data.submissionDocId) : docId,
      answers: (data.answers as Record<string, unknown>) || {},
      rawAnswers: (data.rawAnswers as QuestionnaireAnswers) || undefined,
    });
  });

  // Sort newest first
  items.sort((a, b) => {
    const timeA = new Date(a.submittedAtIso).getTime() || 0;
    const timeB = new Date(b.submittedAtIso).getTime() || 0;
    return timeB - timeA;
  });

  return items;
}

/**
 * Deletes a single submission from Firestore
 * DISABLED: Permanent deletion is prohibited by locked policy.
 */
export async function deleteClientSubmission(_docId: string): Promise<void> {
  throw new Error('Permanent deletion of submissions is not permitted. Please use the archive status instead.');
}
