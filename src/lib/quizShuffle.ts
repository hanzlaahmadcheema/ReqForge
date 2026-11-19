/**
 * Quiz shuffling — attempt modes only (never study mode, never requirements
 * questionnaires).
 *
 * When a quiz attempt starts, the questions are shuffled across the WHOLE
 * quiz into one flat sequence (no section order, no section grouping), and
 * the options inside each question are shuffled too, so the correct
 * answer's position is never predictable. Each new attempt deals a fresh
 * random order, and the respondent can re-shuffle on demand with the
 * Shuffle button.
 *
 * Shuffling is stored as ORDERS, not as rearranged data: a permutation of
 * question ids (`questionOrder`) and, per question, a permutation of option
 * values (`optionOrder`). The questionnaire itself is never mutated, and
 * answers / checked feedback stay keyed by questionId, so they travel with
 * their questions through any reshuffle. The orders live in the browser's
 * localStorage progress (see quizLocalStorage) so a refresh keeps the same
 * shuffled order instead of dealing a new one.
 */

import type { Question, QuestionOption } from '../types';

export interface QuizShuffle {
  /** Permutation of ALL question ids in the quiz (flat, across sections). */
  questionOrder: string[];
  /** Per question id: permutation of that question's option values. */
  optionOrder: Record<string, string[]>;
}

/** Fisher-Yates shuffle. Returns a new array; the input is never mutated. */
export function shuffleArray<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Canonical option values for a question. Yes/no questions often carry no
 * options array (their labels default to Yes/No), so the pair itself is
 * the canonical order — this is what lets a shuffled yes/no question swap
 * its two positions. Custom yes/no options are used as-is when present.
 */
export function optionValuesForQuestion(question: Question): string[] {
  if (question.type === 'yes_no') {
    return question.options && question.options.length > 1
      ? question.options.map((o) => o.value)
      : ['true', 'false'];
  }
  return (question.options || []).map((o) => o.value);
}

/**
 * Deals a fresh random order for an attempt: every question id in the quiz
 * (flat, across all sections) shuffled, plus a shuffled option-value order
 * for every question with more than one option (single/multiple choice,
 * and yes_no — its two options may swap too). Option objects are shuffled
 * as whole values (label + value + correct travel together); the correct
 * flag is never separated from its option.
 */
export function dealQuizShuffle(
  questions: readonly Question[],
  random: () => number = Math.random
): QuizShuffle {
  const questionOrder = shuffleArray(
    questions.map((q) => q.id),
    random
  );
  const optionOrder: Record<string, string[]> = {};
  for (const q of questions) {
    const values = optionValuesForQuestion(q);
    if (values.length > 1) {
      optionOrder[q.id] = shuffleArray(values, random);
    }
  }
  return { questionOrder, optionOrder };
}

/**
 * Normalizes a stored question order against the current quiz: drops ids
 * that no longer exist (and duplicates), and appends any missing ids in
 * canonical order so a question added after the order was dealt still
 * appears. Returns the full canonical order when nothing usable was stored.
 */
export function normalizeQuestionOrder(
  order: readonly string[] | null | undefined,
  allIds: readonly string[]
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of order ?? []) {
    if (allIds.includes(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  for (const id of allIds) {
    if (!seen.has(id)) out.push(id);
  }
  return out;
}

/**
 * Normalizes a stored per-question option order against the question's
 * current option values: drops values that no longer exist (and
 * duplicates), appends missing values in canonical order. Returns the
 * canonical option order when nothing usable was stored.
 */
export function normalizeOptionOrder(
  order: readonly string[] | null | undefined,
  values: readonly string[]
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of order ?? []) {
    if (values.includes(value) && !seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
  }
  for (const value of values) {
    if (!seen.has(value)) out.push(value);
  }
  return out;
}

/**
 * Orders a list of questions by a stored id order. Questions not present
 * in the order keep their relative (canonical) order at the end, so a
 * conditionally-hidden question that becomes visible mid-attempt slots in
 * instead of disappearing. With no order, returns the list unchanged.
 */
export function orderQuestions<T extends { id: string }>(
  questions: readonly T[],
  order: readonly string[] | null | undefined
): T[] {
  if (!order || order.length === 0) return [...questions];
  const index = new Map(order.map((id, i) => [id, i]));
  const fallback = Number.MAX_SAFE_INTEGER;
  return [...questions].sort(
    (a, b) => (index.get(a.id) ?? fallback) - (index.get(b.id) ?? fallback)
  );
}

/**
 * Returns a display copy of a question with its options reordered per the
 * stored option order. Whole option objects travel together (label, value,
 * correct flag, description), so the answer key stays attached to the right
 * option. Returns the original question (same reference) when there is no
 * order or the order already matches, to keep rendering stable.
 *
 * Yes/no questions with no options array get the Yes/No pair synthesized
 * in the stored order, so a shuffled yes/no question can render No first;
 * the labels are the card's defaults and scoring uses correctAnswer, not
 * options, so nothing else changes.
 */
export function withShuffledOptions(
  question: Question,
  order: readonly string[] | null | undefined
): Question {
  if (!order || order.length === 0) return question;
  const index = new Map(order.map((value, i) => [value, i]));
  const fallback = Number.MAX_SAFE_INTEGER;
  if (question.type === 'yes_no' && (!question.options || question.options.length === 0)) {
    const pair: QuestionOption[] = [
      { label: 'Yes', value: 'true' },
      { label: 'No', value: 'false' },
    ];
    const sorted = [...pair].sort(
      (a, b) => (index.get(a.value) ?? fallback) - (index.get(b.value) ?? fallback)
    );
    return { ...question, options: sorted };
  }
  if (!question.options) return question;
  const sorted = [...question.options].sort(
    (a, b) => (index.get(a.value) ?? fallback) - (index.get(b.value) ?? fallback)
  );
  if (sorted.every((opt, i) => opt === question.options![i])) return question;
  return { ...question, options: sorted };
}
