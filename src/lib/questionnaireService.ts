import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  getDocs,
  collection,
  query,
  where,
  limit,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import {
  Questionnaire,
  Section,
  Submission,
  QuestionnaireAnswers,
  QuestionnaireVersionSnapshot,
} from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: true,
      tenantId: null,
      providerInfo: [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Sanitizes an object by removing undefined values so Firestore does not reject it
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
    cleanObj[key] = value !== undefined ? sanitizeForFirestore(value) : null;
  }
  return cleanObj as unknown as T;
}

/**
 * Seeds the default questionnaire into Firestore if it doesn't already exist
 */
export async function seedQuestionnaireIfMissing(
  questionnaire: Questionnaire
): Promise<void> {
  const qPath = `questionnaires/${questionnaire.id}`;
  try {
    const qDocRef = doc(db, 'questionnaires', questionnaire.id);
    const existingSnap = await getDoc(qDocRef);

    if (!existingSnap.exists()) {
      // 1. Save main questionnaire document with embedded sections
      const qData = sanitizeForFirestore({
        id: questionnaire.id,
        title: questionnaire.title,
        description: questionnaire.description,
        version: questionnaire.version,
        status: questionnaire.status,
        sections: questionnaire.sections,
        createdAt: questionnaire.createdAt || new Date().toISOString(),
        updatedAt: questionnaire.updatedAt || new Date().toISOString(),
        sectionCount: questionnaire.sections.length,
      });
      await setDoc(qDocRef, qData);

      // 2. Also save sections and questions as data in subcollections
      for (const sec of questionnaire.sections) {
        const secDocRef = doc(db, 'questionnaires', questionnaire.id, 'sections', sec.id);
        const secData = sanitizeForFirestore({
          id: sec.id,
          questionnaireId: questionnaire.id,
          title: sec.title,
          description: sec.description,
          order: sec.order,
          enabled: sec.enabled,
          iconName: sec.iconName || null,
          questionCount: sec.questions.length,
        });
        await setDoc(secDocRef, secData);

        for (const q of sec.questions) {
          const qDocRef = doc(
            db,
            'questionnaires',
            questionnaire.id,
            'sections',
            sec.id,
            'questions',
            q.id
          );
          const questionData = sanitizeForFirestore({
            id: q.id,
            sectionId: sec.id,
            text: q.text,
            description: q.description || null,
            example: q.example || null,
            type: q.type,
            required: q.required ?? false,
            order: q.order,
            enabled: q.enabled,
            options: q.options || null,
            hasOther: q.hasOther ?? false,
            otherPlaceholder: q.otherPlaceholder || null,
            placeholder: q.placeholder || null,
            unit: q.unit || null,
            conditionalRule: q.conditionalRule || null,
          });
          await setDoc(qDocRef, questionData);
        }
      }
    }
  } catch (err) {
    console.warn('Note: Questionnaire seed to Firestore encountered an issue (using local template):', err);
  }
}

/**
 * Maps a raw Firestore questionnaire document to the app's Questionnaire
 * shape. Single place where the loader picks fields — if a field is not
 * listed here it never reaches the form, the scorer, or the admin. (The quiz
 * flags were missing here, which is why scoring silently returned null on
 * every public share-link submission.)
 */
export function normalizeQuestionnaireDoc(
  questionnaireId: string,
  data: Record<string, unknown>,
  sections: Section[]
): Questionnaire {
  return {
    id: questionnaireId,
    title: (data.title as string) || 'Untitled Questionnaire',
    description: (data.description as string) || '',
    version: Number(data.version) || 1,
    status: (data.status as Questionnaire['status']) || 'published',
    sections,
    clientId: data.clientId as string | undefined,
    projectId: data.projectId as string | undefined,
    isReusable: (data.isReusable as boolean) ?? true,
    createdAt: data.createdAt as string | undefined,
    updatedAt: data.updatedAt as string | undefined,
    // Quiz / assessment flags — scoreQuiz gates on `quiz === true`, so
    // these must survive the load or scoring silently returns null.
    quiz: (data.quiz as boolean) ?? false,
    showScoreOnSubmit: data.showScoreOnSubmit as boolean | undefined,
    showCorrectAnswers: data.showCorrectAnswers as boolean | undefined,
    passMark: data.passMark as number | undefined,
    // Submission control — without this the public flows could never tell
    // a closed form from an open one (default: on for requirements, off
    // for quizzes — see submissionSettings.defaultSubmissionsEnabled).
    submissionsEnabled: data.submissionsEnabled as boolean | undefined,
  };
}

/**
 * Label for a questionnaire in an admin <select>. Includes the version and
 * the creation date so identically-titled questionnaires (e.g. two
 * "General Knowledge Quiz (v1)" entries) can be told apart at a glance.
 */
export function formatQuestionnaireOptionLabel(q: {
  title: string;
  version?: number;
  createdAt?: string;
}): string {
  const created = q.createdAt ? new Date(q.createdAt) : null;
  const datePart =
    created && !Number.isNaN(created.getTime())
      ? created.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : 'no date';
  return `${q.title} (v${q.version ?? 1} · ${datePart})`;
}

/**
 * Loads a questionnaire definition by ID or fetches the active published questionnaire.
 * Returns null if not found in Firestore.
 */
export async function getQuestionnaire(
  questionnaireId?: string
): Promise<Questionnaire | null> {
  try {
    if (questionnaireId && questionnaireId.trim()) {
      const cleanId = questionnaireId.trim();
      const qDocRef = doc(db, 'questionnaires', cleanId);
      const snap = await getDoc(qDocRef);

      if (snap.exists()) {
        const data = snap.data();

        // If full sections are embedded on the questionnaire document
        if (data.sections && Array.isArray(data.sections) && data.sections.length > 0) {
          return normalizeQuestionnaireDoc(cleanId, data, data.sections);
        }

        // Try to read sections subcollection
        const secColRef = collection(db, 'questionnaires', cleanId, 'sections');
        const secSnap = await getDocs(secColRef);

        if (!secSnap.empty) {
          const sectionsList = [];
          for (const secDoc of secSnap.docs) {
            const secData = secDoc.data();
            const qColRef = collection(
              db,
              'questionnaires',
              cleanId,
              'sections',
              secDoc.id,
              'questions'
            );
            const qSnap = await getDocs(qColRef);
            const questionsList = qSnap.docs.map((qd) => qd.data());
            questionsList.sort((a, b) => (a.order || 0) - (b.order || 0));

            sectionsList.push({
              id: secDoc.id,
              questionnaireId: cleanId,
              title: secData.title || '',
              description: secData.description || '',
              order: secData.order || 0,
              enabled: secData.enabled ?? true,
              iconName: secData.iconName,
              questions: questionsList as any,
            });
          }
          sectionsList.sort((a, b) => a.order - b.order);

          return normalizeQuestionnaireDoc(cleanId, data, sectionsList);
        }
      }
      return null;
    }

    // If no ID specified, query the first published questionnaire
    const qCol = collection(db, 'questionnaires');
    const qSnap = await getDocs(query(qCol, where('status', '==', 'published'), limit(1)));
    if (!qSnap.empty) {
      return getQuestionnaire(qSnap.docs[0].id);
    }

    // Fallback: query any questionnaire if none are published
    const anySnap = await getDocs(query(qCol, limit(1)));
    if (!anySnap.empty) {
      return getQuestionnaire(anySnap.docs[0].id);
    }
  } catch (err) {
    console.warn('Error fetching questionnaire from Firestore:', err);
  }

  return null;
}

/**
 * Saves or updates a questionnaire document (Draft or general update).
 * Does not overwrite published version history.
 */
export async function saveQuestionnaire(
  questionnaire: Questionnaire
): Promise<Questionnaire> {
  const now = new Date().toISOString();
  const docRef = doc(db, 'questionnaires', questionnaire.id);
  const wsId = questionnaire.workspaceId || auth.currentUser?.uid || undefined;

  const payload: Questionnaire = {
    ...questionnaire,
    workspaceId: wsId,
    ownerId: questionnaire.ownerId || wsId,
    version: questionnaire.version || 1,
    status: questionnaire.status || 'draft',
    createdAt: questionnaire.createdAt || now,
    updatedAt: now,
  };

  try {
    await setDoc(docRef, sanitizeForFirestore(payload));
  } catch (err) {
    console.error(`Error saving questionnaire ${questionnaire.id}:`, err);
    throw err;
  }

  return payload;
}

/**
 * Publishes a questionnaire.
 * - Enforces immutability of historical versions: creates an immutable snapshot in /questionnaires/{id}/versions/v{prevVersion}
 * - Increments the version number if already previously published
 * - Updates questionnaire status to 'published'
 */
export async function publishQuestionnaire(
  questionnaire: Questionnaire
): Promise<Questionnaire> {
  const now = new Date().toISOString();
  const currentVersion = questionnaire.version || 1;
  const isAlreadyPublished = questionnaire.status === 'published';
  const newVersion = isAlreadyPublished ? currentVersion + 1 : currentVersion;
  const wsId = questionnaire.workspaceId || auth.currentUser?.uid || undefined;

  // 1. Snapshot historical version before publishing
  try {
    const versionDocRef = doc(
      db,
      'questionnaires',
      questionnaire.id,
      'versions',
      `v${currentVersion}`
    );
    await setDoc(
      versionDocRef,
      sanitizeForFirestore({
        id: `v${currentVersion}`,
        questionnaireId: questionnaire.id,
        version: currentVersion,
        title: questionnaire.title,
        description: questionnaire.description,
        sections: questionnaire.sections,
        status: 'published',
        publishedAt: now,
        createdAt: questionnaire.createdAt || now,
        // Quiz flags: a version snapshot must keep quiz mode or a
        // version-pinned public form would silently stop scoring.
        quiz: questionnaire.quiz ?? false,
        showScoreOnSubmit: questionnaire.showScoreOnSubmit,
        showCorrectAnswers: questionnaire.showCorrectAnswers,
        passMark: questionnaire.passMark,
        // Submission control as of publish time.
        submissionsEnabled: questionnaire.submissionsEnabled,
      })
    );
  } catch (err) {
    console.warn('Note: Version snapshot preservation:', err);
  }

  // 2. Save updated published questionnaire
  const publishedPayload: Questionnaire = {
    ...questionnaire,
    workspaceId: wsId,
    ownerId: questionnaire.ownerId || wsId,
    version: newVersion,
    status: 'published',
    createdAt: questionnaire.createdAt || now,
    updatedAt: now,
  };

  const docRef = doc(db, 'questionnaires', questionnaire.id);
  await setDoc(docRef, sanitizeForFirestore(publishedPayload));

  return publishedPayload;
}

/**
 * Fetches an immutable published version snapshot of a questionnaire.
 */
export async function getQuestionnaireVersionSnapshot(
  questionnaireId: string,
  version: number
): Promise<QuestionnaireVersionSnapshot | null> {
  try {
    const vDocRef = doc(db, 'questionnaires', questionnaireId, 'versions', `v${version}`);
    const vSnap = await getDoc(vDocRef);
    if (vSnap.exists()) {
      return vSnap.data() as QuestionnaireVersionSnapshot;
    }
  } catch (err) {
    console.warn(`Could not load snapshot for ${questionnaireId} v${version}:`, err);
  }
  return null;
}

/**
 * Lists all immutable published version snapshots for a questionnaire.
 */
export async function listQuestionnaireVersions(
  questionnaireId: string
): Promise<QuestionnaireVersionSnapshot[]> {
  try {
    const vColRef = collection(db, 'questionnaires', questionnaireId, 'versions');
    const snap = await getDocs(vColRef);
    const versions: QuestionnaireVersionSnapshot[] = [];
    snap.forEach((d) => {
      versions.push(d.data() as QuestionnaireVersionSnapshot);
    });
    return versions.sort((a, b) => b.version - a.version);
  } catch (err) {
    console.warn(`Could not list versions for ${questionnaireId}:`, err);
    return [];
  }
}

/**
 * Clones/Duplicates a questionnaire into an independent new Draft questionnaire.
 * Generates fresh unique IDs for all sections and questions and updates internal conditional links.
 */
export async function duplicateQuestionnaire(
  source: Questionnaire
): Promise<Questionnaire> {
  const newId = `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const wsId = source.workspaceId || auth.currentUser?.uid || undefined;

  // Create mapping of old question IDs to new question IDs
  const idMap = new Map<string, string>();
  source.sections.forEach((s, sIdx) => {
    (s.questions || []).forEach((q, qIdx) => {
      const newQId = `q_${Date.now()}_s${sIdx + 1}_${qIdx + 1}`;
      idMap.set(q.id, newQId);
    });
  });

  const newSections = source.sections.map((sec, sIdx) => {
    const newSecId = `sec_${Date.now()}_${sIdx + 1}`;
    const newQuestions = (sec.questions || []).map((q, qIdx) => {
      const newQId = idMap.get(q.id) || `q_${Date.now()}_${sIdx + 1}_${qIdx + 1}`;
      let updatedConditionalRule = q.conditionalRule;

      if (q.conditionalRule) {
        const oldSourceId = q.conditionalRule.sourceQuestionId || q.conditionalRule.dependsOnQuestionId;
        const mappedSourceId = oldSourceId ? idMap.get(oldSourceId) || oldSourceId : undefined;
        updatedConditionalRule = {
          ...q.conditionalRule,
          sourceQuestionId: mappedSourceId,
          dependsOnQuestionId: mappedSourceId,
        };
      }

      return {
        ...q,
        id: newQId,
        sectionId: newSecId,
        conditionalRule: updatedConditionalRule,
        options: q.options ? q.options.map((o) => ({ ...o })) : undefined,
      };
    });

    return {
      ...sec,
      id: newSecId,
      questionnaireId: newId,
      questions: newQuestions,
    };
  });

  const duplicated: Questionnaire = {
    id: newId,
    workspaceId: wsId,
    ownerId: source.ownerId || wsId,
    title: `Copy of ${source.title}`,
    description: source.description || '',
    version: 1,
    status: 'draft',
    sections: newSections,
    createdAt: now,
    updatedAt: now,
    // Quiz flags: a duplicated quiz stays a quiz.
    quiz: source.quiz ?? false,
    showScoreOnSubmit: source.showScoreOnSubmit,
    showCorrectAnswers: source.showCorrectAnswers,
    passMark: source.passMark,
    // Submission control: a duplicate keeps the source's setting.
    submissionsEnabled: source.submissionsEnabled,
  };

  const docRef = doc(db, 'questionnaires', newId);
  await setDoc(docRef, sanitizeForFirestore(duplicated));

  return duplicated;
}

/**
 * Archives or unarchives a questionnaire.
 */
export async function archiveQuestionnaire(
  id: string,
  archive = true
): Promise<void> {
  const docRef = doc(db, 'questionnaires', id);
  await setDoc(
    docRef,
    sanitizeForFirestore({
      status: archive ? 'archived' : 'draft',
      updatedAt: new Date().toISOString(),
    }),
    { merge: true }
  );
}

/**
 * Deletes a questionnaire.
 */
export async function deleteQuestionnaire(id: string): Promise<void> {
  const docRef = doc(db, 'questionnaires', id);
  await deleteDoc(docRef);
}

export interface SaveSubmissionParams {
  existingSubmissionId?: string;
  workspaceId?: string;
  ownerId?: string;
  questionnaireId: string;
  questionnaireVersion: number;
  clientCode: string;
  clientId?: string;
  projectId?: string;
  shareToken?: string;
  contactPerson?: string | null;
  contactPhone?: string | null;
  additionalRequirements?: string;
  answers: QuestionnaireAnswers;
  /** Quiz score computed at submit time (only for quiz questionnaires). */
  quizScore?: {
    earned: number;
    total: number;
    percent: number;
    passed: boolean;
  } | null;
}

/**
 * Computes a secure, unpredictable draft identifier tied strictly to the project
 * and its authenticated share token. Prevents guessing, enumeration, and cross-project access.
 */
export function computeSecureDraftId(projectId: string, shareToken: string): string {
  const cleanProj = projectId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanToken = shareToken.trim();
  // Deterministic hash with high avalanche effect
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < cleanToken.length; i++) {
    const ch = cleanToken.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const tokenHash = (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  return `draft_${cleanProj}_${tokenHash}`;
}

/**
 * A submission document that is already 'submitted' must never be reused as
 * the target of a new draft or a new submission. Draft IDs are deterministic
 * per (projectId, shareToken), so without this guard every re-attempt on the
 * same share link silently overwrites the previous submission. Returns a fresh
 * unique ID when the given one already holds a submitted record; otherwise
 * returns the original ID unchanged (draft-resume keeps working).
 */
async function ensureFreshSubmissionId(
  submissionId: string,
  fallbackId: string
): Promise<string> {
  try {
    const snap = await getDoc(doc(db, 'submissions', submissionId));
    if (snap.exists() && (snap.data() as Submission).status === 'submitted') {
      return fallbackId;
    }
  } catch {
    // If the check fails, keep the original ID — never block a save on it.
  }
  return submissionId;
}

/**
 * Saves or updates a client's work-in-progress as a Draft.
 * Preserves the questionnaireVersion, linked to clientId + projectId + questionnaireId.
 * Does NOT create duplicate records if existingSubmissionId is provided or active draft is found.
 */
export async function saveQuestionnaireDraft(
  params: SaveSubmissionParams
): Promise<{ submissionId: string }> {
  const {
    existingSubmissionId,
    workspaceId,
    ownerId,
    questionnaireId,
    questionnaireVersion,
    clientCode,
    clientId,
    projectId,
    shareToken,
    contactPerson,
    contactPhone,
    additionalRequirements,
    answers,
  } = params;

  const cleanClient = (clientCode.trim() || 'DefaultClient').replace(/[^a-zA-Z0-9_-]/g, '_');
  const now = new Date().toISOString();
  const wsId = workspaceId || auth.currentUser?.uid || undefined;
  const ownId = ownerId || wsId || undefined;

  // Compute secure draft ID if projectId and shareToken are provided
  let submissionId = existingSubmissionId;
  if (!submissionId) {
    if (projectId && shareToken && shareToken.trim()) {
      submissionId = computeSecureDraftId(projectId, shareToken);
    } else {
      submissionId = `draft_${projectId ? projectId.replace(/[^a-zA-Z0-9_-]/g, '_') : cleanClient}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    }
  }

  // A re-attempt on the same share link re-derives the same deterministic draft
  // ID; if that document already holds a submitted record, start a fresh draft
  // instead of overwriting it.
  submissionId = await ensureFreshSubmissionId(
    submissionId,
    `draft_${cleanClient}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`
  );

  const draftPayload: Submission = {
    id: submissionId,
    workspaceId: wsId,
    ownerId: ownId,
    questionnaireId,
    questionnaireVersion,
    clientId: clientId || null as any,
    clientCode: cleanClient,
    projectId: projectId || null as any,
    contactPerson: contactPerson ?? null,
    contactPhone: contactPhone ?? null,
    additionalRequirements: additionalRequirements ?? '',
    status: 'draft',
    submittedAtIso: now,
    submittedAt: null,
    createdAt: now,
    updatedAt: now,
    answers,
    rawAnswers: answers,
    shareToken: shareToken || '',
  };

  const cleanData = sanitizeForFirestore(draftPayload);

  // 1. Save to isolated token drafts path: /projects/{projectId}/tokens/{shareToken}/drafts/current
  if (projectId && shareToken && shareToken.trim()) {
    try {
      const tokenDraftRef = doc(
        db,
        'projects',
        projectId.trim(),
        'tokens',
        shareToken.trim(),
        'drafts',
        'current'
      );
      await setDoc(tokenDraftRef, cleanData, { merge: true });
    } catch (err) {
      console.warn('Failed writing to token draft path:', err);
    }
  }

  // 2. Save to primary /submissions collection
  try {
    const subDocRef = doc(db, 'submissions', submissionId);
    await setDoc(subDocRef, cleanData, { merge: true });
  } catch (err) {
    console.error('Failed writing draft to /submissions:', err);
  }

  // 3. Mirror to legacy /clientResponses for compatibility
  try {
    const legacyDocRef = doc(db, 'clientResponses', submissionId);
    await setDoc(
      legacyDocRef,
      {
        ...cleanData,
        isMasterDoc: false,
        submissionDocId: submissionId,
        formId: questionnaireId,
        formTitle: 'Requirements Questionnaire',
      },
      { merge: true }
    );
  } catch (err) {
    console.error('Failed writing draft to /clientResponses:', err);
  }

  return { submissionId };
}

/**
 * Searches for an existing draft submission for an authorized share-link session (projectId + shareToken).
 * Rejects unauthenticated requests and prevents enumeration across projects or clients.
 */
export async function fetchDraftSubmission(params: {
  projectId?: string | null;
  shareToken?: string | null;
  clientId?: string | null;
  questionnaireId?: string | null;
  clientCode?: string | null;
}): Promise<Submission | null> {
  const { projectId, shareToken } = params;

  try {
    // Only fetch draft if both project ID and authorized share token are supplied
    if (projectId && shareToken && shareToken.trim()) {
      const cleanProj = projectId.trim();
      const cleanToken = shareToken.trim();

      // 1. Check isolated token drafts subcollection
      try {
        const tokenDraftRef = doc(db, 'projects', cleanProj, 'tokens', cleanToken, 'drafts', 'current');
        const tokenDraftSnap = await getDoc(tokenDraftRef);
        if (tokenDraftSnap.exists()) {
          const d = tokenDraftSnap.data() as Submission;
          if (d.status === 'draft') {
            return d;
          }
        }
      } catch {
        // Fall through to primary check
      }

      // 2. Check primary submissions if accessible
      try {
        const secureDraftId = computeSecureDraftId(cleanProj, cleanToken);
        const directDraftRef = doc(db, 'submissions', secureDraftId);
        const snap = await getDoc(directDraftRef);
        if (snap.exists()) {
          const data = snap.data() as Submission;
          if (data.status === 'draft' && data.projectId === cleanProj) {
            return data;
          }
        }
      } catch {
        // Fall through
      }
    }
  } catch (err) {
    console.warn('Error fetching draft submission from Firestore:', err);
  }

  return null;
}

/**
 * Saves a completed questionnaire submission as an independent data entity.
 * If existingSubmissionId is provided (e.g. from a resumed draft), transitions that exact
 * document to 'submitted' so no duplicate records are created!
 */
export async function saveQuestionnaireSubmission(
  params: SaveSubmissionParams
): Promise<{ submissionId: string; docId: string }> {
  const {
    existingSubmissionId,
    workspaceId,
    ownerId,
    questionnaireId,
    questionnaireVersion,
    clientCode,
    clientId,
    projectId,
    shareToken,
    contactPerson,
    contactPhone,
    additionalRequirements,
    answers,
  } = params;

  const quizScore = params.quizScore || null;

  const cleanClient = (clientCode.trim() || 'DefaultClient').replace(/[^a-zA-Z0-9_-]/g, '_');
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const timestampStr = `${year}_${month}_${day}_${hours}${minutes}${seconds}`;
  const wsId = workspaceId || auth.currentUser?.uid || undefined;
  const ownId = ownerId || wsId || undefined;

  // If transitioning from an existing draft, keep that exact ID; otherwise use secure draft ID or generate new timestamped ID
  let submissionId = existingSubmissionId;
  if (!submissionId && projectId && shareToken && shareToken.trim()) {
    submissionId = computeSecureDraftId(projectId, shareToken);
  }
  if (!submissionId) {
    submissionId = `${cleanClient}_${timestampStr}`;
  }

  // A re-attempt on the same share link re-derives the same deterministic draft
  // ID; if that document already holds a submitted record, use a fresh ID so
  // each attempt is its own record instead of overwriting the previous one.
  submissionId = await ensureFreshSubmissionId(
    submissionId,
    `${cleanClient}_${timestampStr}_${Math.random().toString(36).substring(2, 7)}`
  );

  const submissionPayload: Submission = {
    id: submissionId,
    workspaceId: wsId,
    ownerId: ownId,
    questionnaireId,
    questionnaireVersion,
    clientId: clientId || null as any,
    clientCode: cleanClient,
    projectId: projectId || null as any,
    contactPerson: contactPerson ?? null,
    contactPhone: contactPhone ?? null,
    additionalRequirements: additionalRequirements ?? '',
    status: 'submitted',
    submittedAtIso: now.toISOString(),
    submittedAt: serverTimestamp(),
    updatedAt: now.toISOString(),
    answers, // stored strictly by question ID!
    rawAnswers: answers,
    shareToken: shareToken || '',
    // Quiz score (only present for quiz questionnaires; computed at submit time)
    ...(quizScore
      ? {
          scoreEarned: quizScore.earned,
          scoreTotal: quizScore.total,
          scorePercent: quizScore.percent,
          passed: quizScore.passed,
        }
      : {}),
  };

  const cleanData = sanitizeForFirestore(submissionPayload);

  // 0. If no existing submission ID was provided (direct submit without saving draft first),
  // establish the legitimate document lifecycle first: CREATE requires status == 'draft'.
  if (!existingSubmissionId) {
    const initialDraftData = {
      ...cleanData,
      status: 'draft',
      submittedAt: null,
      submittedAtIso: null,
    };
    try {
      const subDocRef = doc(db, 'submissions', submissionId);
      await setDoc(subDocRef, initialDraftData, { merge: true });
    } catch (e) {
      console.warn('Initial draft creation for /submissions:', e);
    }
    try {
      const qSubDocRef = doc(db, 'questionnaires', questionnaireId, 'submissions', submissionId);
      await setDoc(qSubDocRef, initialDraftData, { merge: true });
    } catch (e) {
      console.warn('Initial draft creation for /questionnaires/.../submissions:', e);
    }
    try {
      const legacyDocRef = doc(db, 'clientResponses', submissionId);
      await setDoc(legacyDocRef, {
        ...initialDraftData,
        isMasterDoc: false,
        submissionDocId: submissionId,
        formId: questionnaireId,
        formTitle: 'Requirements Questionnaire',
      }, { merge: true });
    } catch (e) {
      console.warn('Initial draft creation for /clientResponses:', e);
    }
  }

  // 1. Save / transition to submitted in primary /submissions collection
  try {
    const subDocRef = doc(db, 'submissions', submissionId);
    await setDoc(subDocRef, cleanData);
  } catch (err) {
    console.error('Failed writing to /submissions:', err);
  }

  // 2. Clear / mark draft as submitted in isolated token drafts path
  if (projectId && shareToken && shareToken.trim()) {
    try {
      const tokenDraftRef = doc(
        db,
        'projects',
        projectId.trim(),
        'tokens',
        shareToken.trim(),
        'drafts',
        'current'
      );
      await setDoc(tokenDraftRef, { status: 'submitted', updatedAt: now.toISOString() }, { merge: true });
    } catch (err) {
      console.warn('Failed updating token draft status:', err);
    }
  }

  // 3. Save to /questionnaires/{id}/submissions/{id} subcollection
  try {
    const qSubDocRef = doc(db, 'questionnaires', questionnaireId, 'submissions', submissionId);
    await setDoc(qSubDocRef, cleanData);
  } catch (err) {
    console.error(`Failed writing to /questionnaires/${questionnaireId}/submissions:`, err);
  }

  // 4. Mirror to legacy /clientResponses collection for backward-compatible admin viewer
  try {
    const legacyDocRef = doc(db, 'clientResponses', submissionId);
    await setDoc(legacyDocRef, {
      ...cleanData,
      isMasterDoc: false,
      submissionDocId: submissionId,
      formId: questionnaireId,
      formTitle: 'Requirements Questionnaire',
    });

    const masterDocRef = doc(db, 'clientResponses', cleanClient);
    await setDoc(masterDocRef, {
      ...cleanData,
      isMasterDoc: true,
      submissionDocId: submissionId,
      formId: questionnaireId,
      formTitle: 'Requirements Questionnaire',
    });
  } catch (err) {
    console.error('Failed writing to /clientResponses:', err);
  }

  return {
    submissionId,
    docId: submissionId,
  };
}

/**
 * Updates submission status (e.g. mark reviewed, archive, restore).
 * Admin-only operation enforced server-side.
 */
export async function updateSubmissionStatus(
  submissionId: string,
  status: 'draft' | 'submitted' | 'reviewed' | 'archived',
  questionnaireId?: string
): Promise<void> {
  const now = new Date().toISOString();
  const updateData: Record<string, unknown> = {
    status,
    updatedAt: now,
  };

  if (status === 'reviewed') {
    updateData.reviewedAt = now;
  }

  const cleanUpdate = sanitizeForFirestore(updateData);

  // 1. Primary /submissions
  try {
    const subDocRef = doc(db, 'submissions', submissionId);
    await setDoc(subDocRef, cleanUpdate, { merge: true });
  } catch (err) {
    console.error('Failed updating status in /submissions:', err);
    throw err;
  }

  // 2. Subcollection if questionnaireId provided
  if (questionnaireId) {
    try {
      const qSubDocRef = doc(db, 'questionnaires', questionnaireId, 'submissions', submissionId);
      await setDoc(qSubDocRef, cleanUpdate, { merge: true });
    } catch {
      // Best-effort mirror
    }
  }

  // 3. Legacy /clientResponses
  try {
    const legacyDocRef = doc(db, 'clientResponses', submissionId);
    await setDoc(legacyDocRef, cleanUpdate, { merge: true });
  } catch {
    // Best-effort mirror
  }
}

/**
 * Deletes a submission.
 */
export async function deleteSubmission(
  _submissionId: string,
  _questionnaireId?: string
): Promise<void> {
  // Permanent deletion of submissions is strictly prohibited by security policy.
  // Submissions follow the lifecycle: draft -> submitted -> reviewed -> archived
  throw new Error('Permanent deletion of submissions is not permitted. Please use the archive status instead.');
}
