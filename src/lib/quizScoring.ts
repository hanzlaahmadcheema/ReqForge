/**
 * Quiz / Assessment scoring (pure functions, no side effects).
 *
 * A questionnaire is a quiz when `questionnaire.quiz === true`. Scoring rules:
 * - Only questions with an answer key are scorable: single_choice / multiple_choice
 *   questions with at least one option marked `correct: true`, and yes_no questions
 *   with a boolean `correctAnswer`.
 * - multiple_choice is all-or-nothing: full points only when the selected set
 *   exactly matches the set of correct options.
 * - Conditionally-hidden questions are excluded from the total.
 * - `points` defaults to 1 when omitted; `passMark` is a percentage (0-100).
 */

import { Questionnaire, QuestionnaireAnswers, Question } from '../types';
import { isQuestionVisible } from './conditionalLogic';

export interface QuizQuestionResult {
  questionId: string;
  questionText: string;
  /** True when the respondent's answer matches the answer key. */
  correct: boolean;
  /** Points earned for this question (0 when incorrect or unanswered). */
  earned: number;
  /** Points the question is worth. */
  points: number;
  /** Labels of the correct option(s). Empty for unscored questions. */
  correctLabels: string[];
  /** Values of the correct option(s) (for single/multiple choice). */
  correctValues: string[];
  /** Human-readable label of the respondent's answer, or null when unanswered. */
  userLabel: string | null;
  /** Explanation configured on the question (shown after submit). */
  explanation?: string;
}

export interface QuizResult {
  earned: number;
  total: number;
  /** Rounded whole-number percentage (0-100). */
  percent: number;
  /** True when percent >= passMark. True when no pass mark is configured. */
  passed: boolean;
  passMark?: number;
  perQuestion: QuizQuestionResult[];
}

/** Points a question is worth (default 1; negative values are treated as 0). */
export function getQuestionPoints(question: Question): number {
  return typeof question.points === 'number' && question.points >= 0
    ? question.points
    : 1;
}

/** Whether a question carries an answer key and can be scored. */
export function isScorableQuestion(question: Question): boolean {
  if (question.type === 'yes_no') {
    return typeof question.correctAnswer === 'boolean';
  }
  if (question.type === 'single_choice' || question.type === 'multiple_choice') {
    return (question.options || []).some((o) => o.correct === true);
  }
  return false;
}

function correctOptionValues(question: Question): string[] {
  return (question.options || [])
    .filter((o) => o.correct === true)
    .map((o) => o.value);
}

function optionLabel(question: Question, value: string): string {
  const opt = (question.options || []).find((o) => o.value === value);
  return opt ? opt.label : value;
}

function yesNoLabel(question: Question, value: boolean): string {
  const wanted = value ? ['yes', 'true'] : ['no', 'false'];
  const opt = (question.options || []).find((o) => wanted.includes(o.value));
  return opt ? opt.label : value ? 'Yes' : 'No';
}

/** Human-readable label for a stored answer value, or null when unanswered. */
export function formatUserAnswerLabel(
  question: Question,
  value: unknown
): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (question.type === 'yes_no') {
    if (typeof value === 'boolean') return yesNoLabel(question, value);
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return value.map((v) => optionLabel(question, String(v))).join(', ');
  }
  if (typeof value === 'string') {
    return optionLabel(question, value);
  }
  return String(value);
}

/**
 * Scores a single question. Returns earned points (0 when incorrect/unanswered)
 * and the display data for the result review.
 */
export function scoreQuestion(
  question: Question,
  answer: { value?: unknown } | undefined
): Omit<QuizQuestionResult, 'questionText' | 'explanation'> & {
  questionText: string;
  explanation?: string;
} {
  const points = getQuestionPoints(question);
  const value = answer?.value;
  let correct = false;

  if (question.type === 'yes_no') {
    correct = typeof value === 'boolean' && value === question.correctAnswer;
  } else if (question.type === 'single_choice') {
    const correctValues = correctOptionValues(question);
    correct =
      typeof value === 'string' &&
      correctValues.length === 1 &&
      value === correctValues[0];
  } else if (question.type === 'multiple_choice') {
    const correctValues = correctOptionValues(question);
    if (Array.isArray(value)) {
      const selected = new Set(value.map(String));
      const expected = new Set(correctValues.map(String));
      correct =
        selected.size === expected.size &&
        [...expected].every((v) => selected.has(v));
    }
  }

  const correctLabels =
    question.type === 'yes_no'
      ? [yesNoLabel(question, question.correctAnswer === true)]
      : correctOptionValues(question).map((v) => optionLabel(question, v));

  return {
    questionId: question.id,
    questionText: question.text || question.title || question.id,
    correct,
    earned: correct ? points : 0,
    points,
    correctLabels,
    correctValues:
      question.type === 'yes_no' ? [] : correctOptionValues(question),
    userLabel: formatUserAnswerLabel(question, value),
    explanation: question.explanation,
  };
}

/**
 * Scores a full quiz submission. Returns null when the questionnaire is not
 * a quiz. Conditionally-hidden and unscored questions never count toward
 * the total.
 */
export function scoreQuiz(
  questionnaire: Questionnaire,
  answers: QuestionnaireAnswers
): QuizResult | null {
  if (!questionnaire || questionnaire.quiz !== true) return null;

  const perQuestion: QuizQuestionResult[] = [];
  let total = 0;
  let earned = 0;

  for (const section of questionnaire.sections || []) {
    for (const question of section.questions || []) {
      if (!isQuestionVisible(question, answers)) continue;
      if (!isScorableQuestion(question)) continue;
      const result = scoreQuestion(question, answers[question.id]);
      perQuestion.push(result);
      total += result.points;
      earned += result.earned;
    }
  }

  const percent = total > 0 ? Math.round((earned / total) * 100) : 0;
  const passMark =
    typeof questionnaire.passMark === 'number' &&
    questionnaire.passMark >= 0 &&
    questionnaire.passMark <= 100
      ? questionnaire.passMark
      : undefined;

  return {
    earned,
    total,
    percent,
    passed: passMark === undefined ? true : percent >= passMark,
    passMark,
    perQuestion,
  };
}
