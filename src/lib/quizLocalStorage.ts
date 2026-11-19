/**
 * Anonymous quiz progress — browser localStorage ONLY.
 *
 * Quiz responses must never be written to Firestore (no submissions, no
 * drafts, no mirrors). The only place a quiz attempt lives is the
 * respondent's own browser local storage, so a refresh can resume progress
 * and nothing is ever sent to — or seen by — anyone else. Requirements
 * questionnaires are unaffected: they still save to Firestore as before.
 *
 * Progress is keyed per questionnaire + project so different quizzes (and
 * different projects using the same quiz) never share state.
 */

import type { QuestionnaireAnswers } from '../types';

export type QuizAnswerMode = 'all' | 'one';

export interface QuizProgress {
  answers: QuestionnaireAnswers;
  /** Respondent's chosen answer mode ('all' = whole form, 'one' = one at a time). */
  mode: QuizAnswerMode | null;
  /** Current question index in one-at-a-time mode. */
  oneIndex: number;
  updatedAt: string;
}

const KEY_PREFIX = 'reqforge_quiz_progress_';

/** localStorage key for one quiz attempt. projectId is optional ('general' when absent). */
export function getQuizProgressKey(
  questionnaireId: string,
  projectId?: string | null
): string {
  const cleanQ = (questionnaireId || 'general').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanP = (projectId || 'general').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${KEY_PREFIX}${cleanQ}_${cleanP}`;
}

function safeParse(raw: string | null): QuizProgress | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<QuizProgress>;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      answers:
        parsed.answers && typeof parsed.answers === 'object' ? parsed.answers : {},
      mode: parsed.mode === 'all' || parsed.mode === 'one' ? parsed.mode : null,
      oneIndex:
        typeof parsed.oneIndex === 'number' && parsed.oneIndex >= 0
          ? Math.floor(parsed.oneIndex)
          : 0,
      updatedAt:
        typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** Loads a quiz attempt's progress from this browser only. Returns null when none exists. */
export function loadQuizProgress(key: string): QuizProgress | null {
  try {
    return safeParse(window.localStorage.getItem(key));
  } catch {
    return null;
  }
}

/** Saves a quiz attempt's progress to this browser only. Never touches the network. */
export function saveQuizProgress(key: string, progress: QuizProgress): void {
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({ ...progress, updatedAt: new Date().toISOString() })
    );
  } catch {
    // localStorage full/unavailable (private mode) — progress simply isn't kept.
  }
}

/** Merges a partial update into the stored progress (keeps mode/index when only answers change). */
export function mergeQuizProgress(key: string, partial: Partial<QuizProgress>): void {
  const existing = loadQuizProgress(key) || {
    answers: {},
    mode: null as QuizAnswerMode | null,
    oneIndex: 0,
    updatedAt: new Date().toISOString(),
  };
  saveQuizProgress(key, {
    ...existing,
    ...partial,
    answers: partial.answers ?? existing.answers,
  });
}

/** Deletes a quiz attempt's local progress (called on submit, so the next attempt starts fresh). */
export function clearQuizProgress(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore
  }
}
