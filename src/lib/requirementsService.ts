import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  RequirementRecord,
  RequirementsSummary,
  CompletenessGapAnalysis,
  RequirementStatus,
  RequirementPriority,
  RequirementCategory,
} from '../types';

/**
 * Fetch all extracted requirement records for a submission
 */
export async function getSubmissionRequirements(
  submissionId: string
): Promise<RequirementRecord[]> {
  try {
    const reqRef = collection(db, 'submissions', submissionId, 'requirements');
    const q = query(reqRef, orderBy('createdAt', 'asc'));
    const snap = await getDocs(q);

    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as RequirementRecord[];
  } catch (err) {
    console.warn(`Could not load requirements for submission ${submissionId}:`, err);
    return [];
  }
}

/**
 * Save or batch-save extracted requirements
 */
export async function saveSubmissionRequirements(
  submissionId: string,
  requirements: RequirementRecord[]
): Promise<void> {
  const reqRef = collection(db, 'submissions', submissionId, 'requirements');

  for (const req of requirements) {
    const reqDoc = doc(reqRef, req.id);
    await setDoc(
      reqDoc,
      {
        ...req,
        sourceSubmissionId: submissionId,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }
}

/**
 * Update a single requirement record's status, priority, or notes
 */
export async function updateRequirementRecord(
  submissionId: string,
  requirementId: string,
  updates: Partial<RequirementRecord>
): Promise<void> {
  const reqDoc = doc(db, 'submissions', submissionId, 'requirements', requirementId);
  await updateDoc(reqDoc, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Delete a single requirement record
 */
export async function deleteRequirementRecord(
  submissionId: string,
  requirementId: string
): Promise<void> {
  const reqDoc = doc(db, 'submissions', submissionId, 'requirements', requirementId);
  await deleteDoc(reqDoc);
}

/**
 * Save or update the AI requirements summary
 */
export async function saveRequirementsSummary(
  submissionId: string,
  summary: RequirementsSummary
): Promise<void> {
  const summaryDoc = doc(db, 'submissions', submissionId, 'analysis', 'summary');
  await setDoc(
    summaryDoc,
    {
      ...summary,
      submissionId,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

/**
 * Fetch the AI requirements summary if previously saved
 */
export async function getRequirementsSummary(
  submissionId: string
): Promise<RequirementsSummary | null> {
  try {
    const summaryDoc = doc(db, 'submissions', submissionId, 'analysis', 'summary');
    const snap = await getDoc(summaryDoc);
    if (!snap.exists()) return null;
    return snap.data() as RequirementsSummary;
  } catch (err) {
    console.warn(`Could not load summary for submission ${submissionId}:`, err);
    return null;
  }
}

/**
 * Save or update completeness gap analysis
 */
export async function saveGapAnalysis(
  submissionId: string,
  analysis: CompletenessGapAnalysis
): Promise<void> {
  const gapDoc = doc(db, 'submissions', submissionId, 'analysis', 'gaps');
  await setDoc(
    gapDoc,
    {
      ...analysis,
      submissionId,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

/**
 * Fetch completeness gap analysis if previously saved
 */
export async function getGapAnalysis(
  submissionId: string
): Promise<CompletenessGapAnalysis | null> {
  try {
    const gapDoc = doc(db, 'submissions', submissionId, 'analysis', 'gaps');
    const snap = await getDoc(gapDoc);
    if (!snap.exists()) return null;
    return snap.data() as CompletenessGapAnalysis;
  } catch (err) {
    console.warn(`Could not load gap analysis for submission ${submissionId}:`, err);
    return null;
  }
}
