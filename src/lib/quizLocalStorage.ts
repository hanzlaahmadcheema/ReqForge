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
import type { QuizQuestionResult, QuizResult } from './quizScoring';

export type QuizAnswerMode = 'all' | 'one';

export interface QuizProgress {
  answers: QuestionnaireAnswers;
  /** Respondent's chosen answer mode ('all' = whole form, 'one' = one at a time). */
  mode: QuizAnswerMode | null;
  /** Current question index in one-at-a-time mode. */
  oneIndex: number;
  /**
   * Per-question instant-check results in one-at-a-time mode
   * (questionId -> check result). Restored on refresh so a checked
   * question still shows its correct/incorrect feedback and explanation
   * instead of offering "Check answer" again.
   */
  checked: Record<string, QuizQuestionResult>;
  /**
   * Completed attempt: the final score + per-question review. Set at
   * submit time and restored on refresh so the score screen survives a
   * reload. Null while the attempt is still in progress. Cleared by
   * retake / Reset.
   */
  completedResult: QuizResult | null;
  /** When the attempt was completed (ISO timestamp), or null if in progress. */
  completedAt: string | null;
  /**
   * Shuffled order for this attempt (attempt modes only; study mode keeps
   * the original order and never stores these). `questionOrder` is a
   * permutation of ALL question ids in the quiz (flat, across sections);
   * `optionOrder` maps questionId -> permutation of that question's option
   * values. Persisted so a refresh keeps the SAME shuffled order instead
   * of dealing a new one. A fresh attempt (mode pick / retake / Reset)
   * deals a fresh shuffle. Null for progress saved before shuffling
   * existed (old format) — the form deals a fresh order on restore.
   */
  questionOrder?: string[] | null;
  optionOrder?: Record<string, string[]> | null;
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

function safeParseChecked(raw: unknown): Record<string, QuizQuestionResult> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, QuizQuestionResult> = {};
  for (const [questionId, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (
      typeof questionId === 'string' &&
      entry &&
      typeof entry === 'object' &&
      typeof (entry as { questionId?: unknown }).questionId === 'string' &&
      typeof (entry as { correct?: unknown }).correct === 'boolean' &&
      typeof (entry as { earned?: unknown }).earned === 'number' &&
      typeof (entry as { points?: unknown }).points === 'number'
    ) {
      out[questionId] = entry as QuizQuestionResult;
    }
  }
  return out;
}

function safeParseCompletedResult(raw: unknown): QuizResult | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Partial<QuizResult>;
  if (
    typeof r.earned !== 'number' ||
    typeof r.total !== 'number' ||
    typeof r.percent !== 'number' ||
    typeof r.passed !== 'boolean' ||
    !Array.isArray(r.perQuestion)
  ) {
    return null;
  }
  return {
    earned: r.earned,
    total: r.total,
    percent: r.percent,
    passed: r.passed,
    passMark: typeof r.passMark === 'number' ? r.passMark : undefined,
    perQuestion: (r.perQuestion as unknown[]).filter(
      (pq): pq is QuizQuestionResult =>
        !!pq &&
        typeof pq === 'object' &&
        typeof (pq as { questionId?: unknown }).questionId === 'string' &&
        typeof (pq as { correct?: unknown }).correct === 'boolean'
    ) as QuizQuestionResult[],
  };
}

function safeParseStringArray(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const out = raw.filter((v): v is string => typeof v === 'string');
  return out.length > 0 ? out : null;
}

function safeParseOptionOrder(raw: unknown): Record<string, string[]> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: Record<string, string[]> = {};
  for (const [questionId, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof questionId !== 'string' || !Array.isArray(entry)) continue;
    const values = entry.filter((v): v is string => typeof v === 'string');
    if (values.length > 0) out[questionId] = values;
  }
  return Object.keys(out).length > 0 ? out : null;
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
      // Older stored progress has no checked/completed fields — default them.
      checked: safeParseChecked(parsed.checked),
      completedResult: safeParseCompletedResult(parsed.completedResult),
      completedAt:
        typeof parsed.completedAt === 'string' ? parsed.completedAt : null,
      // Older stored progress has no shuffle fields — default them to null
      // (the form deals a fresh order when restoring such progress).
      questionOrder: safeParseStringArray(parsed.questionOrder),
      optionOrder: safeParseOptionOrder(parsed.optionOrder),
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
    checked: {} as Record<string, QuizQuestionResult>,
    completedResult: null as QuizResult | null,
    completedAt: null as string | null,
    questionOrder: null as string[] | null,
    optionOrder: null as Record<string, string[]> | null,
    updatedAt: new Date().toISOString(),
  };
  saveQuizProgress(key, {
    ...existing,
    ...partial,
    answers: partial.answers ?? existing.answers,
    checked: partial.checked ?? existing.checked,
  });
}

/**
 * In-progress state for the form's auto-save effect. `completedResult` is
 * the result of the CURRENT attempt only: pass it when one exists, leave it
 * null/undefined otherwise — a stored completed result is NEVER discarded
 * here. Clearing a completed result is done explicitly via
 * clearCompletedQuizResult / clearQuizProgress, never by saving null.
 * `questionOrder` / `optionOrder` behave the same way: a stored shuffle is
 * never discarded by an auto-save that omits them.
 */
export interface QuizProgressState {
  answers: QuestionnaireAnswers;
  mode: QuizAnswerMode | null;
  oneIndex: number;
  checked: Record<string, QuizQuestionResult>;
  completedResult?: QuizResult | null;
  completedAt?: string | null;
  questionOrder?: string[] | null;
  optionOrder?: Record<string, string[]> | null;
}

/**
 * Saves in-progress quiz state without ever discarding a stored completed
 * result. This matters because the form's auto-save effect runs on mount —
 * and React runs child effects before the parent (App / PublicFormPortal)
 * restore effect that reads the stored score. A plain overwrite with
 * completedResult: null on mount would wipe the finished score screen
 * before the parent ever gets to restore it (the live bug: after a refresh
 * the quiz resumed at the last answered question instead of the score
 * screen, even though the result had been saved correctly at submit time).
 */
export function saveQuizProgressState(key: string, state: QuizProgressState): void {
  const existing = loadQuizProgress(key);
  saveQuizProgress(key, {
    answers: state.answers,
    mode: state.mode,
    oneIndex: state.oneIndex,
    checked: state.checked,
    completedResult: state.completedResult ?? existing?.completedResult ?? null,
    completedAt: state.completedResult
      ? state.completedAt ?? new Date().toISOString()
      : existing?.completedAt ?? null,
    questionOrder: state.questionOrder ?? existing?.questionOrder ?? null,
    optionOrder: state.optionOrder ?? existing?.optionOrder ?? null,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Drops only the completed score from stored progress (respondent picks an
 * answer mode to start a fresh attempt). Answers/mode/index/checked are
 * kept, so this never disturbs an in-progress attempt.
 */
export function clearCompletedQuizResult(key: string): void {
  const existing = loadQuizProgress(key);
  if (!existing) return;
  saveQuizProgress(key, { ...existing, completedResult: null, completedAt: null });
}

/** Deletes a quiz attempt's local progress (called on retake / Reset, so the next attempt starts fresh). */
export function clearQuizProgress(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore
  }
}
