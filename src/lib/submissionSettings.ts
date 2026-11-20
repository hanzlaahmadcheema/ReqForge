/**
 * Submission on/off controls.
 *
 * Two levels, both admin-controlled:
 *  1. Per-form — `Questionnaire.submissionsEnabled` (JSON: `submissions_enabled`).
 *     Explicit value wins; when absent the default follows the form type:
 *     requirements questionnaires default ON, quizzes default OFF (anonymous).
 *  2. Global master switch — the `settings/global` Firestore document.
 *     When the master is OFF, NO form accepts submissions, whatever its
 *     per-form setting says. When ON, per-form settings apply.
 *
 * The master document is read by unauthenticated public flows (share links
 * and public forms), so `firestore.rules` allows public `get` on
 * /settings/{id} and admin-only writes. If the rules have not been deployed
 * yet, the read fails and this module fails OPEN (master ON) so existing
 * forms keep working exactly as before; the admin write then surfaces its
 * error in the UI instead of pretending it saved.
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import type { Questionnaire } from '../types';

const SETTINGS_DOC_ID = 'global';

export interface GlobalSubmissionSettings {
  /** Master switch. Absent document / read failure => true (fail open). */
  submissionsEnabled: boolean;
  updatedAt?: string;
}

/**
 * Per-form default. An explicit `submissionsEnabled` field always wins;
 * otherwise requirements questionnaires accept submissions and quizzes do
 * not (quizzes stay anonymous unless the owner turns submissions on).
 */
export function defaultSubmissionsEnabled(
  q: Pick<Questionnaire, 'quiz' | 'submissionsEnabled'>
): boolean {
  if (typeof q.submissionsEnabled === 'boolean') return q.submissionsEnabled;
  return q.quiz !== true;
}

/**
 * Effective setting for one form: the master switch overrides everything.
 * This answers "does this form SAVE responses?" — used by the submit
 * paths and by every piece of privacy copy.
 */
export function isSubmissionsOpen(
  q: Pick<Questionnaire, 'quiz' | 'submissionsEnabled'>,
  globalEnabled: boolean
): boolean {
  return globalEnabled && defaultSubmissionsEnabled(q);
}

/**
 * Whether the form is open to respondents at all. The master switch closes
 * EVERYTHING. A per-form OFF closes a requirements questionnaire, but a
 * quiz falls back to its anonymous mode (attemptable, nothing saved) — a
 * quiz's default IS off, so treating per-form OFF as "closed" would shut
 * every existing quiz, including live exam-prep quizzes, the moment this
 * shipped. The only way to close a quiz entirely is the master switch.
 */
export function isFormOpen(
  q: Pick<Questionnaire, 'quiz' | 'submissionsEnabled'>,
  globalEnabled: boolean
): boolean {
  if (!globalEnabled) return false;
  if (q.quiz === true) return true;
  return defaultSubmissionsEnabled(q);
}

/** Reads the master switch. Fails open (ON) on any error, including the Firestore rules for /settings not being deployed yet. */
export async function getGlobalSubmissionSettings(): Promise<GlobalSubmissionSettings> {
  try {
    const snap = await getDoc(doc(db, 'settings', SETTINGS_DOC_ID));
    if (snap.exists()) {
      const data = snap.data();
      return {
        submissionsEnabled: data.submissionsEnabled !== false,
        updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
      };
    }
  } catch (err) {
    console.warn(
      'Could not read global submission settings (treating submissions as enabled):',
      err
    );
  }
  return { submissionsEnabled: true };
}

/** Flips the master switch (admin only, enforced by Firestore rules). */
export async function setGlobalSubmissionSettings(enabled: boolean): Promise<void> {
  const wsId = auth.currentUser?.uid || undefined;
  await setDoc(
    doc(db, 'settings', SETTINGS_DOC_ID),
    {
      submissionsEnabled: enabled,
      ...(wsId ? { workspaceId: wsId } : {}),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}
