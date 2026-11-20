import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  FolderKanban,
  RotateCcw,
  Layers,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Send,
  Eye,
  X,
  AlertCircle,
  Save,
  Check,
  FileEdit,
  ShieldCheck,
  ListChecks,
  ListOrdered,
  BookOpen,
  Shuffle,
} from 'lucide-react';
import { Questionnaire, Section, Question, AnswerValue, QuestionnaireAnswers } from '../types';
import { QuestionCard } from './QuestionCard';
import { ProgressBar } from './ProgressBar';
import { SectionDrawer } from './SectionDrawer';
import { ReviewSummary } from './ReviewSummary';
import { isQuestionVisible } from '../lib/conditionalLogic';
import { saveQuestionnaireDraft, fetchDraftSubmission } from '../lib/questionnaireService';
import {
  scoreQuiz,
  scoreQuestion,
  isScorableQuestion,
  type QuizResult,
  type QuizQuestionResult,
} from '../lib/quizScoring';
import {
  getQuizProgressKey,
  loadQuizProgress,
  saveQuizProgress,
  saveQuizProgressState,
  clearCompletedQuizResult,
  clearQuizProgress,
  type QuizAnswerMode,
  type QuizProgress,
} from '../lib/quizLocalStorage';
import {
  dealQuizShuffle,
  normalizeQuestionOrder,
  normalizeOptionOrder,
  optionValuesForQuestion,
  orderQuestions,
  withShuffledOptions,
} from '../lib/quizShuffle';
import { defaultSubmissionsEnabled } from '../lib/submissionSettings';

/**
 * The questions of an attempt, in the order the respondent answers them:
 * currently-visible questions (conditional gates re-evaluated against the
 * answers so far), ordered by the attempt's stored shuffle and with each
 * question's options reordered per its stored option order. Attempt modes
 * show ONE flat shuffled sequence across the whole quiz — no section
 * grouping. Questions not present in a stored order (e.g. newly visible
 * conditional questions) slot in at the end in canonical order.
 */
function orderedVisibleQuestions(
  questionnaire: Questionnaire,
  answers: QuestionnaireAnswers,
  questionOrder: readonly string[] | null,
  optionOrder: Record<string, string[]> | null
): Question[] {
  const sections = (questionnaire.sections || []).filter((s) => s.enabled !== false);
  const visible = sections.flatMap((sec) =>
    (sec.questions || []).filter((q) => isQuestionVisible(q, answers))
  );
  return orderQuestions(visible, questionOrder).map((q) =>
    withShuffledOptions(q, optionOrder?.[q.id] ?? null)
  );
}

interface QuestionnaireFormProps {
  questionnaire: Questionnaire;
  clientCode?: string;
  projectName?: string;
  clientId?: string;
  projectId?: string;
  shareToken?: string;
  initialAnswers?: QuestionnaireAnswers;
  isPreview?: boolean;
  onSaveDraft?: (payload: {
    clientCode: string;
    contactPerson: string;
    contactPhone: string;
    additionalRequirements: string;
    answers: QuestionnaireAnswers;
    existingDraftId?: string;
  }) => Promise<string>;
  /**
   * Outcome: `true` (or void) means the submit went through — the form may
   * show the score screen. `false` means the parent refused or failed the
   * save (e.g. submissions were closed mid-attempt): the form must NOT show
   * a score screen for an attempt that was never recorded, and the parent
   * surfaces the reason via `submitError`.
   */
  onSubmit?: (payload: {
    clientCode: string;
    contactPerson: string;
    contactPhone: string;
    additionalRequirements: string;
    answers: QuestionnaireAnswers;
    existingDraftId?: string;
  }) => Promise<boolean | void>;
  onClosePreview?: () => void;
  isSubmitting?: boolean;
  submitError?: string | null;
  /**
   * Effective submission setting for this form (master switch AND per-form
   * toggle, as computed by the parent from the live questionnaire + the
   * global setting). When absent, the per-form default applies (on for
   * requirements questionnaires, off for quizzes) — this is what preview
   * mode uses. When false, the parent shows the closed message instead of
   * this form, except in study-only mode.
   */
  submissionsOpen?: boolean;
  /**
   * Study-only mode: the parent shows the form only to read the answer key
   * (used when submissions are closed for a quiz). The mode picker and all
   * attempt controls are hidden; only the study view renders.
   */
  studyOnly?: boolean;
}

export const QuestionnaireForm: React.FC<QuestionnaireFormProps> = ({
  questionnaire,
  clientCode: initialClientCode = 'Default Client',
  projectName,
  clientId,
  projectId,
  shareToken,
  initialAnswers = {},
  isPreview = false,
  onSaveDraft,
  onSubmit,
  onClosePreview,
  isSubmitting = false,
  submitError = null,
  submissionsOpen,
  studyOnly = false,
}) => {
  const [clientCode, setClientCode] = useState<string>(initialClientCode);
  const [contactPerson, setContactPerson] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>('');
  const [additionalRequirements, setAdditionalRequirements] = useState<string>('');
  // Quiz-only state. Quizzes are anonymous by default: progress lives in
  // this browser's local storage only and is never sent to any server, so a
  // refresh can resume an attempt. Requirements questionnaires are
  // unaffected (their drafts still live in Firestore).
  const isQuiz = questionnaire.quiz === true;
  // Effective submission setting for this form. The parent (App / portal)
  // passes the live value (master switch AND per-form toggle); preview mode
  // falls back to the per-form default. When true for a quiz, the attempt
  // IS saved to Firestore with its score — and every piece of copy below
  // must say so instead of claiming anonymity.
  const effectiveSubmissionsOpen =
    submissionsOpen ?? defaultSubmissionsEnabled(questionnaire);
  const quizSavesResponses = isQuiz && effectiveSubmissionsOpen;
  const quizProgressKey = getQuizProgressKey(questionnaire.id, projectId);
  // Restored once, on mount, so the lazy initializers below read it exactly once.
  const [restoredQuizProgress] = useState<QuizProgress | null>(() =>
    isQuiz && !isPreview ? loadQuizProgress(quizProgressKey) : null
  );

  // Shuffled order for this attempt (attempt modes only): a permutation of
  // ALL question ids in the quiz (flat, across sections) + a shuffled
  // option-value order per question. Restored from local storage so a
  // refresh keeps the SAME shuffled order; a fresh attempt deals a fresh
  // shuffle (see handlePickQuizMode / handleShuffle). Study mode never
  // uses these — it keeps the original order and section grouping.
  const initialShuffle = (() => {
    const empty = {
      questionOrder: null as string[] | null,
      optionOrder: null as Record<string, string[]> | null,
    };
    if (!isQuiz || isPreview || !restoredQuizProgress) return empty;
    const allQuestions = (questionnaire.sections || []).flatMap(
      (sec) => sec.questions || []
    );
    if (!restoredQuizProgress.questionOrder?.length) {
      // Progress saved before shuffling existed: deal a fresh order for
      // the resumed attempt instead of falling back to section order.
      return dealQuizShuffle(allQuestions);
    }
    const questionOrder = normalizeQuestionOrder(
      restoredQuizProgress.questionOrder,
      allQuestions.map((q) => q.id)
    );
    const optionOrder: Record<string, string[]> = {};
    for (const q of allQuestions) {
      const values = optionValuesForQuestion(q);
      if (values.length <= 1) continue;
      optionOrder[q.id] = normalizeOptionOrder(
        restoredQuizProgress.optionOrder?.[q.id] ?? null,
        values
      );
    }
    return { questionOrder, optionOrder };
  })();
  const [questionOrder, setQuestionOrder] = useState<string[] | null>(
    initialShuffle.questionOrder
  );
  const [optionOrder, setOptionOrder] = useState<Record<string, string[]> | null>(
    initialShuffle.optionOrder
  );

  const [answers, setAnswers] = useState<QuestionnaireAnswers>(
    restoredQuizProgress?.answers ?? initialAnswers
  );
  const [currentSectionIndex, setCurrentSectionIndex] = useState<number>(0);
  const [isSectionDrawerOpen, setIsSectionDrawerOpen] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});
  const [previewSubmitted, setPreviewSubmitted] = useState<boolean>(false);
  // Quiz result shown in preview mode after a simulated submit (score computed then)
  const [previewQuizResult, setPreviewQuizResult] = useState<QuizResult | null>(null);

  // Answer mode chosen by the respondent at the start of a quiz:
  // 'all' = answer everything, then see the score; 'one' = one question at
  // a time with instant feedback. Null = not chosen yet (mode picker shows).
  const [quizMode, setQuizMode] = useState<QuizAnswerMode | null>(
    restoredQuizProgress?.mode ?? null
  );
  // Study/review mode: a third choice on the mode picker — the respondent
  // reads every question with its correct answer and explanation shown,
  // before attempting. It is NOT an attempt mode: it is kept out of
  // QuizAnswerMode and out of local storage on purpose (nothing about
  // study mode needs persisting), so a refresh simply returns to the mode
  // picker (or the finished score screen, when one exists). In study-only
  // mode (parent shows the form only to read the answer key because
  // submissions are closed) study mode starts on and the picker never shows.
  const [studyMode, setStudyMode] = useState<boolean>(studyOnly);
  // One-at-a-time mode state: current question index, whether it was checked,
  // and its per-question result.
  const [oneIndex, setOneIndex] = useState<number>(restoredQuizProgress?.oneIndex ?? 0);
  // Per-question instant-check results (questionId -> check result). Restored
  // from local storage so a refresh keeps the feedback instead of offering
  // "Check answer" again for a question that was already checked.
  const [checkedResults, setCheckedResults] = useState<Record<string, QuizQuestionResult>>(
    restoredQuizProgress?.checked ?? {}
  );
  // The current question's check state, restored from the checked map above.
  // Computed once on mount: the question at the restored index may already
  // have been checked before a refresh.
  const initialOneCheck = (() => {
    if (!isQuiz || !restoredQuizProgress) return { checked: false, result: null as QuizQuestionResult | null };
    const restoredAnswers = restoredQuizProgress.answers ?? {};
    // The restored index refers to the SHUFFLED order, so the visible list
    // here must be the ordered one — otherwise a refresh would restore the
    // check state of the wrong question.
    const visible = orderedVisibleQuestions(
      questionnaire,
      restoredAnswers,
      initialShuffle.questionOrder,
      initialShuffle.optionOrder
    );
    if (visible.length === 0) return { checked: false, result: null as QuizQuestionResult | null };
    const idx = Math.min(restoredQuizProgress.oneIndex ?? 0, visible.length - 1);
    const q = visible[idx];
    const res = q ? restoredQuizProgress.checked?.[q.id] ?? null : null;
    return { checked: !!res, result: res };
  })();
  const [oneChecked, setOneChecked] = useState<boolean>(initialOneCheck.checked);
  const [oneResult, setOneResult] = useState<QuizQuestionResult | null>(initialOneCheck.result);
  const [oneHint, setOneHint] = useState<string | null>(null);
  // Completed quiz result (score + review) for this attempt. Set at submit
  // time and persisted to local storage so a refresh restores the score
  // screen instead of dropping back to the mode picker. Restored from the
  // saved progress on mount, like answers/mode/index/checked: initializing
  // this to null unconditionally meant the mount auto-save overwrote the
  // stored result with null before App/Portal's restore effect could read
  // it (child effects run before parent effects), so a refresh always lost
  // the score screen even though submit had saved it correctly.
  const [completedQuizResult, setCompletedQuizResult] = useState<QuizResult | null>(
    restoredQuizProgress?.completedResult ?? null
  );
  // In-app Reset confirmation dialog (a native window.confirm is silently
  // dismissed by automated browsers, which made Reset look broken).
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);

  // Draft persistence state
  const [draftId, setDraftId] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);
  const [draftSaveSuccess, setDraftSaveSuccess] = useState<boolean>(false);
  const [resumedDraftNotice, setResumedDraftNotice] = useState<string | null>(null);

  // Active enabled sections
  const sections: Section[] = (questionnaire.sections || []).filter(
    (s) => s.enabled !== false
  );

  const isReviewStep = currentSectionIndex >= sections.length;
  const currentSection = sections[currentSectionIndex] as Section | undefined;

  // Scroll to top on section step change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentSectionIndex]);

  // Check and restore draft submission on mount
  useEffect(() => {
    if (isPreview) return;
    if (isQuiz) {
      // Quiz progress was already restored from this browser's local
      // storage above (anonymous or recorded — the notice must not claim
      // nothing is saved when submissions are on for this quiz).
      if (restoredQuizProgress && Object.keys(restoredQuizProgress.answers || {}).length > 0) {
        setResumedDraftNotice(
          quizSavesResponses
            ? 'Your previous progress on this quiz was restored from this browser only.'
            : 'Your previous progress on this quiz was restored from this browser only. Nothing was sent to or saved on any server.'
        );
      }
      return;
    }
    let isMounted = true;

    const checkExistingDraft = async () => {
      try {
        const found = await fetchDraftSubmission({
          projectId,
          shareToken,
          clientId,
          questionnaireId: questionnaire.id,
          clientCode: initialClientCode,
        });

        if (found && isMounted) {
          const loadedAnswers = found.answers || found.rawAnswers;
          if (loadedAnswers && Object.keys(loadedAnswers).length > 0) {
            setAnswers(loadedAnswers);
          }
          if (found.contactPerson) setContactPerson(found.contactPerson);
          if (found.contactPhone) setContactPhone(found.contactPhone);
          if (found.additionalRequirements) {
            setAdditionalRequirements(found.additionalRequirements);
          }
          setDraftId(found.id);

          const timeString = found.updatedAt || found.createdAt;
          const formatted = timeString
            ? new Date(String(timeString)).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : 'earlier session';
          setResumedDraftNotice(
            `Resumed your saved draft from ${formatted}. All answers have been restored.`
          );
        }
      } catch (err) {
        console.warn('Could not check for existing draft:', err);
      }
    };

    checkExistingDraft();
    return () => {
      isMounted = false;
    };
  }, [projectId, clientId, questionnaire.id, initialClientCode, isPreview, isQuiz, restoredQuizProgress, quizSavesResponses]);

  // Quiz progress auto-save: local storage only, never the server.
  // Persists answers, mode, index, per-question check results and the
  // completed score, so a refresh resumes exactly where the respondent left
  // off — including a finished score screen.
  //
  // Uses the merge-preserve save: this effect runs on mount, before the
  // parent (App / PublicFormPortal) restore effect reads the stored score,
  // so it must never overwrite a stored completed result with null.
  useEffect(() => {
    if (!isQuiz || isPreview) return;
    saveQuizProgressState(quizProgressKey, {
      answers,
      mode: quizMode,
      oneIndex,
      checked: checkedResults,
      completedResult: completedQuizResult ?? undefined,
      completedAt: completedQuizResult ? new Date().toISOString() : undefined,
      questionOrder: questionOrder ?? undefined,
      optionOrder: optionOrder ?? undefined,
    });
  }, [answers, quizMode, oneIndex, checkedResults, completedQuizResult, questionOrder, optionOrder, isQuiz, isPreview, quizProgressKey]);

  // Manual Draft Save Handler
  const handleSaveDraft = async () => {
    if (isPreview) {
      alert('Draft saving is disabled in preview mode.');
      return;
    }
    if (isQuiz) {
      // Anonymous quiz: a "draft" lives in this browser only — nothing is
      // written to Firestore (the buttons that call this are hidden for
      // quizzes; this is a guard for any other caller). Merge-preserve save:
      // must never overwrite a stored completed result with null.
      saveQuizProgressState(quizProgressKey, {
        answers,
        mode: quizMode,
        oneIndex,
        checked: checkedResults,
        completedResult: completedQuizResult ?? undefined,
        completedAt: completedQuizResult ? new Date().toISOString() : undefined,
        questionOrder: questionOrder ?? undefined,
        optionOrder: optionOrder ?? undefined,
      });
      setDraftSaveSuccess(true);
      setTimeout(() => setDraftSaveSuccess(false), 3000);
      return;
    }
    setIsSavingDraft(true);
    setDraftSaveSuccess(false);

    try {
      let savedId: string | undefined = draftId || undefined;
      if (onSaveDraft) {
        savedId = await onSaveDraft({
          clientCode,
          contactPerson,
          contactPhone,
          additionalRequirements,
          answers,
          existingDraftId: draftId || undefined,
        });
      } else {
        const res = await saveQuestionnaireDraft({
          existingSubmissionId: draftId || undefined,
          questionnaireId: questionnaire.id,
          questionnaireVersion: questionnaire.version,
          clientCode,
          clientId,
          projectId,
          shareToken,
          contactPerson: contactPerson || null,
          contactPhone: contactPhone || null,
          additionalRequirements,
          answers,
        });
        savedId = res.submissionId;
      }

      if (savedId) {
        setDraftId(savedId);
      }
      setDraftSaveSuccess(true);
      setTimeout(() => setDraftSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving draft:', err);
      alert('Failed to save draft. Please check your connection.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleAnswerChange = (questionId: string, answer: AnswerValue) => {
    // In one-at-a-time mode a checked question is locked: its answer cannot
    // be changed after the instant feedback was shown, or the stored check
    // result would no longer match the answer.
    if (isQuiz && quizMode === 'one' && checkedResults[questionId]) return;

    setAnswers((prev) => ({
      ...prev,
      [questionId]: answer,
    }));

    if (validationErrors[questionId]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    }
  };

  const isQuestionAnswered = (questionId: string): boolean => {
    const a = answers[questionId];
    if (!a || a.value === null || a.value === undefined || a.value === '') return false;
    if (Array.isArray(a.value)) return a.value.length > 0;
    if (typeof a.value === 'string') return a.value.trim().length > 0;
    return true;
  };

  // Check section completion taking into account visible questions
  const getSectionCompletion = (sec: Section) => {
    const visibleQuestions = (sec.questions || []).filter((q) =>
      isQuestionVisible(q, answers)
    );
    const requiredQuestions = visibleQuestions.filter((q) => q.required);
    const answeredCount = visibleQuestions.filter((q) => isQuestionAnswered(q.id)).length;
    const requiredAnsweredCount = requiredQuestions.filter((q) =>
      isQuestionAnswered(q.id)
    ).length;

    const isComplete =
      requiredQuestions.length > 0
        ? requiredAnsweredCount === requiredQuestions.length
        : answeredCount > 0;

    return {
      answeredCount,
      totalCount: visibleQuestions.length,
      isComplete,
    };
  };

  // Validate current section before moving forward
  const validateCurrentSection = (): boolean => {
    if (!currentSection) return true;

    const newErrors: Record<string, boolean> = {};
    let hasError = false;

    const visibleQuestions = (currentSection.questions || []).filter((q) =>
      isQuestionVisible(q, answers)
    );

    for (const q of visibleQuestions) {
      if (q.required && !isQuestionAnswered(q.id)) {
        newErrors[q.id] = true;
        hasError = true;
      }
    }

    setValidationErrors(newErrors);

    if (hasError) {
      // Find first question with error and scroll to it
      const firstErrorId = Object.keys(newErrors)[0];
      const el = document.getElementById(`question-card-${firstErrorId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return false;
    }

    return true;
  };

  const handleNextSection = () => {
    if (!validateCurrentSection()) return;
    if (currentSectionIndex < sections.length) {
      setCurrentSectionIndex((prev) => prev + 1);
    }
  };

  const handlePrevSection = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex((prev) => prev - 1);
    }
  };

  const handleJumpToSection = (index: number) => {
    setCurrentSectionIndex(index);
    setIsSectionDrawerOpen(false);
  };

  const handleClearForm = () => {
    // Opens the in-app confirmation dialog (see the modal at the bottom of
    // this component). A native window.confirm is silently dismissed by
    // automated browsers, which made Reset look broken.
    setShowResetConfirm(true);
  };

  const handleConfirmClearForm = () => {
    setShowResetConfirm(false);
    setAnswers({});
    setValidationErrors({});
    setAdditionalRequirements('');
    setCurrentSectionIndex(0);
    setPreviewQuizResult(null);
    if (isQuiz) {
      // Start the quiz over from the mode choice; drop local progress too —
      // answers, per-question check results and any completed score.
      clearQuizProgress(quizProgressKey);
      setQuizMode(null);
      setStudyMode(false);
      setQuestionOrder(null);
      setOptionOrder(null);
      setOneIndex(0);
      setOneChecked(false);
      setOneResult(null);
      setOneHint(null);
      setCheckedResults({});
      setCompletedQuizResult(null);
    }
  };

  const handleSubmit = async () => {
    if (isPreview) {
      // Simulated submit: score the quiz locally so the admin can preview results
      setPreviewQuizResult(scoreQuiz(questionnaire, answers));
      setPreviewSubmitted(true);
      return;
    }

    if (isQuiz) {
      // A submitted quiz attempt is done: persist the completed result
      // (score + per-question review) in this browser's local storage so a
      // refresh restores the score screen instead of dropping back to the
      // mode picker. For an anonymous quiz the score is computed, never
      // stored on any server. The result is persisted only AFTER the parent
      // confirms the submit went through — persisting it first would restore
      // a score screen for an attempt that was never saved (e.g. submissions
      // were closed mid-attempt: the parent returns false and the form stays
      // on the review step with the submit error). Retake / Reset clears it
      // again (see handleConfirmClearForm).
      const result = scoreQuiz(questionnaire, answers);
      let ok: boolean | void = true;
      if (onSubmit) {
        ok = await onSubmit({
          clientCode,
          contactPerson,
          contactPhone,
          additionalRequirements,
          answers,
          existingDraftId: draftId || undefined,
        });
      }
      if (ok === false) return;
      setCompletedQuizResult(result);
      saveQuizProgress(quizProgressKey, {
        answers,
        mode: quizMode,
        oneIndex,
        checked: checkedResults,
        completedResult: result,
        completedAt: new Date().toISOString(),
        questionOrder: questionOrder ?? null,
        optionOrder: optionOrder ?? null,
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    if (onSubmit) {
      await onSubmit({
        clientCode,
        contactPerson,
        contactPhone,
        additionalRequirements,
        answers,
        existingDraftId: draftId || undefined,
      });
    }
  };

  // ---------------------------------------------------------------------------
  // One question at a time (quiz mode 'one')
  // ---------------------------------------------------------------------------
  // Flat list of currently-visible questions, in order across all sections.
  // Visibility re-evaluates as answers change, so a conditionally-hidden
  // question never appears here (and never counts toward the score).
  const visibleQuizQuestions: Question[] = isQuiz
    ? sections.flatMap((sec) => (sec.questions || []).filter((q) => isQuestionVisible(q, answers)))
    : [];
  // Attempt order: the same visible questions, reordered by this attempt's
  // stored shuffle (questions shuffled across the whole quiz, options
  // shuffled inside each question). Both attempt modes answer this one
  // flat sequence — section grouping is not shown while attempting.
  const orderedVisibleQuizQuestions: Question[] = isQuiz
    ? orderedVisibleQuestions(questionnaire, answers, questionOrder, optionOrder)
    : [];
  // Study mode lists every question in the quiz (all sections), regardless
  // of conditional visibility — there is no attempt in progress for the
  // gates to depend on, so the count must not use the filtered list above.
  const studyQuestionCount = sections.reduce(
    (acc, sec) => acc + (sec.questions || []).length,
    0
  );
  const safeOneIndex = Math.min(oneIndex, Math.max(orderedVisibleQuizQuestions.length - 1, 0));
  const oneQuestion = orderedVisibleQuizQuestions[safeOneIndex] as Question | undefined;
  const isLastOneQuestion = safeOneIndex >= orderedVisibleQuizQuestions.length - 1;

  // Check the current question instantly: lock the answer and show
  // correct/incorrect + explanation right away. The check result is kept in
  // the checked map so a refresh restores the feedback for this question.
  const handleOneCheck = () => {
    if (!oneQuestion) return;
    if (!isQuestionAnswered(oneQuestion.id)) {
      setOneHint('Choose an answer first, then check it.');
      return;
    }
    setOneHint(null);
    const result = scoreQuestion(oneQuestion, answers[oneQuestion.id]);
    setOneResult(result);
    setOneChecked(true);
    setCheckedResults((prev) => ({ ...prev, [oneQuestion.id]: result }));
  };

  // Move on: next question, or submit for the final score on the last one.
  const handleOneNext = () => {
    if (!oneQuestion) return;
    if (!oneChecked && oneQuestion.required && !isQuestionAnswered(oneQuestion.id)) {
      setOneHint('This question is required — answer it to continue.');
      return;
    }
    setOneHint(null);
    if (isLastOneQuestion) {
      void handleSubmit();
      return;
    }
    setOneIndex((prev) => prev + 1);
    setOneChecked(false);
    setOneResult(null);
  };

  const handlePickQuizMode = (mode: QuizAnswerMode) => {
    // Picking a mode starts a fresh attempt: drop any previously completed
    // score (state + storage) so it can never resurface on a later refresh.
    // The merge-preserve auto-save would otherwise keep a stale stored
    // result alive after this. In-progress answers/checked state are kept.
    // Every new attempt deals a FRESH random order — questions shuffled
    // across the whole quiz, options shuffled inside each question.
    setCompletedQuizResult(null);
    clearCompletedQuizResult(quizProgressKey);
    setStudyMode(false);
    const fresh = dealQuizShuffle(
      sections.flatMap((sec) => sec.questions || [])
    );
    setQuestionOrder(fresh.questionOrder);
    setOptionOrder(fresh.optionOrder);
    setQuizMode(mode);
    setOneIndex(0);
    setOneChecked(false);
    setOneResult(null);
    setOneHint(null);
    setCurrentSectionIndex(0);
  };

  // Re-shuffle on demand, mid-attempt (both attempt modes): questions AND
  // options are dealt again. Answers and checked feedback are keyed by
  // questionId, so they travel with their questions — nothing is lost.
  // One-at-a-time resumes at the first unanswered question in the new
  // order (or stays on the last question when everything is answered),
  // with that question's checked feedback restored from the checked map.
  const handleShuffle = () => {
    if (!isQuiz || quizMode === null || studyMode) return;
    const fresh = dealQuizShuffle(
      sections.flatMap((sec) => sec.questions || [])
    );
    setQuestionOrder(fresh.questionOrder);
    setOptionOrder(fresh.optionOrder);
    if (quizMode === 'one') {
      const ordered = orderQuestions(visibleQuizQuestions, fresh.questionOrder);
      const firstUnanswered = ordered.findIndex((q) => !isQuestionAnswered(q.id));
      const idx =
        firstUnanswered === -1 ? Math.max(ordered.length - 1, 0) : firstUnanswered;
      setOneIndex(idx);
      const q = ordered[idx] as Question | undefined;
      const res = q ? checkedResults[q.id] ?? null : null;
      setOneChecked(!!res);
      setOneResult(res);
      setOneHint(null);
    }
  };

  // Study mode: read the answer key, don't attempt. Nothing is persisted
  // and no completed score is touched — picking an attempt mode afterwards
  // still starts a fresh attempt (see handlePickQuizMode).
  const handlePickStudyMode = () => {
    setStudyMode(true);
    setCurrentSectionIndex(0);
  };

  // Back to the mode picker from study mode (to attempt, or to leave).
  const handleExitStudyMode = () => {
    setStudyMode(false);
  };

  // Validate the whole flat quiz before going to the review step: every
  // visible required question must be answered (mirrors the per-section
  // validation of the sectioned flow).
  const validateAllQuizQuestions = (): boolean => {
    const newErrors: Record<string, boolean> = {};
    let hasError = false;
    for (const q of orderedVisibleQuizQuestions) {
      if (q.required && !isQuestionAnswered(q.id)) {
        newErrors[q.id] = true;
        hasError = true;
      }
    }
    setValidationErrors(newErrors);
    if (hasError) {
      const firstErrorId = Object.keys(newErrors)[0];
      const el = document.getElementById(`question-card-${firstErrorId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return false;
    }
    return true;
  };

  // Flat 'all' quiz view: go to the final review step.
  const handleQuizReview = () => {
    if (!validateAllQuizQuestions()) return;
    setCurrentSectionIndex(sections.length);
  };

  // Calculate overall form progress
  const totalVisibleQuestions = sections.reduce((acc, sec) => {
    const visible = (sec.questions || []).filter((q) => isQuestionVisible(q, answers));
    return acc + visible.length;
  }, 0);

  const totalAnsweredQuestions = sections.reduce((acc, sec) => {
    const visible = (sec.questions || []).filter((q) => isQuestionVisible(q, answers));
    return acc + visible.filter((q) => isQuestionAnswered(q.id)).length;
  }, 0);

  const overallProgressPercentage =
    totalVisibleQuestions > 0
      ? Math.round((totalAnsweredQuestions / totalVisibleQuestions) * 100)
      : 0;

  return (
    <div className="w-full flex flex-col min-h-[calc(100vh-60px)] pb-28">
      {/* PREVIEW BANNER */}
      {isPreview && (
        <aside aria-label="Preview banner" className="bg-stone-900 text-white px-4 py-2.5 text-xs flex items-center justify-between shadow-md sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <span className="bg-amber-400 text-stone-950 text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wide">
              Preview Mode
            </span>
            <span className="font-medium text-stone-200">
              Interactive test of {questionnaire.title} (v{questionnaire.version}) — Submissions are simulated.
            </span>
          </div>
          {onClosePreview && (
            <button
              type="button"
              onClick={onClosePreview}
              className="inline-flex items-center gap-1 text-stone-300 hover:text-white px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Exit Preview</span>
            </button>
          )}
        </aside>
      )}

      {/* STICKY TOP PROGRESS BAR */}
      <nav aria-label="Questionnaire navigation and progress" className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-stone-200/80 shadow-2xs pt-safe">
        <div className="max-w-2xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            {!isQuiz && !studyMode && (
              <button
                type="button"
                onClick={() => setIsSectionDrawerOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 px-2.5 sm:px-3 py-1.5 rounded-xl transition-all cursor-pointer min-h-[36px] active:scale-[0.98]"
              >
                <Layers className="w-3.5 h-3.5 text-stone-600 shrink-0" />
                <span>Sections</span>
              </button>
            )}

            {/* Mobile section badge */}
            <span className="text-[11px] font-semibold text-stone-500 bg-stone-100/70 px-2 py-1 rounded-lg tabular-nums inline-block sm:hidden truncate">
              {isQuiz && studyMode
                ? 'Study mode'
                : isQuiz && quizMode === null
                ? 'Quiz'
                : isQuiz && quizMode === 'one'
                ? `${safeOneIndex + 1}/${orderedVisibleQuizQuestions.length}`
                : isQuiz && quizMode === 'all'
                ? 'Quiz'
                : !isReviewStep && currentSection
                ? `${currentSectionIndex + 1}/${sections.length}`
                : 'Review'}
            </span>

            {/* Desktop section label */}
            <span className="text-xs text-stone-600 font-medium hidden sm:inline truncate max-w-xs">
              {isQuiz && studyMode
                ? 'Study mode — all correct answers'
                : isQuiz && quizMode === null
                ? 'Choose how to begin'
                : isQuiz && quizMode === 'one'
                ? `Question ${safeOneIndex + 1} of ${orderedVisibleQuizQuestions.length}`
                : isQuiz && quizMode === 'all'
                ? `Quiz · ${totalVisibleQuestions} question${totalVisibleQuestions === 1 ? '' : 's'}`
                : !isReviewStep && currentSection
                ? `Section ${currentSectionIndex + 1} of ${sections.length}: ${currentSection.title}`
                : 'Final Review & Submission'}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isQuiz && (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200"
                title={
                  quizSavesResponses
                    ? 'Your progress is kept in this browser; your submitted answers and score are saved to the project record'
                    : 'Quiz progress is kept in this browser only — nothing is sent to a server'
                }
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Saved in this browser</span>
                <span className="sm:hidden">Private</span>
              </span>
            )}

            {/* Shuffle — attempt modes only (never study mode): deals the
                questions and the options again, on demand. Answers travel
                with their questions, so nothing is lost by reshuffling. */}
            {isQuiz && quizMode !== null && !studyMode && (
              <button
                type="button"
                onClick={handleShuffle}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 border border-stone-200 transition-all cursor-pointer min-h-[36px] active:scale-[0.98]"
                title="Shuffle the questions and the options again"
              >
                <Shuffle className="w-3.5 h-3.5 shrink-0" />
                <span>Shuffle</span>
              </button>
            )}

            {!isPreview && !isQuiz && (
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isSavingDraft}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[36px] active:scale-[0.98] ${
                  draftSaveSuccess
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-700 active:bg-stone-300'
                }`}
                title="Save current answers as draft to resume anytime"
              >
                {draftSaveSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 text-stone-600 shrink-0" />
                    <span>{isSavingDraft ? 'Saving...' : 'Save Draft'}</span>
                  </>
                )}
              </button>
            )}

            <span className="text-xs font-black text-stone-900 tabular-nums">
              {overallProgressPercentage}%
            </span>
          </div>
        </div>

        {/* Linear progress meter */}
        <div className="w-full bg-stone-100 h-1">
          <div
            className="bg-stone-900 h-1 transition-all duration-300 ease-out"
            style={{ width: `${overallProgressPercentage}%` }}
          />
        </div>
      </nav>

      {/* SECTION DRAWER NAVIGATION */}
      <SectionDrawer
        isOpen={isSectionDrawerOpen}
        onClose={() => setIsSectionDrawerOpen(false)}
        sections={sections}
        currentIndex={currentSectionIndex}
        onSelectSection={handleJumpToSection}
        answers={answers}
      />

      {/* MAIN FORM CONTAINER */}
      <main className="max-w-2xl md:max-w-3xl w-full mx-auto px-4 sm:px-6 md:px-8 py-6 flex-1">
        {/* Resumed Draft Notice */}
        {resumedDraftNotice && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-3.5 flex items-start justify-between gap-3 text-xs animate-in fade-in duration-200">
            <div className="flex items-start gap-2.5">
              <div className="p-1 rounded-lg bg-emerald-100 text-emerald-700 shrink-0 mt-0.5">
                <FileEdit className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-emerald-950">Work in Progress Restored</p>
                <p className="text-emerald-800 mt-0.5 leading-relaxed">{resumedDraftNotice}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setResumedDraftNotice(null)}
              className="text-emerald-600 hover:text-emerald-900 p-1 rounded-md hover:bg-emerald-100 transition-colors cursor-pointer shrink-0"
              title="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Quiz notice — shown on every quiz so the respondent can see,
            before answering anything, whether anything leaves this browser.
            The copy must match the real setting: when submissions are ON for
            this quiz, answers ARE saved — never claim anonymity then. */}
        {isQuiz && !quizSavesResponses && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl p-3.5 flex items-start gap-2.5 text-xs">
            <div className="p-1 rounded-lg bg-emerald-100 text-emerald-700 shrink-0 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-emerald-950">Anonymous quiz — nothing is saved</p>
              <p className="text-emerald-800 mt-0.5 leading-relaxed">
                Your answers are never sent to or stored on any server, and no one can see them.
                Your score is calculated in this browser only, and your progress is kept only in
                this browser&apos;s local storage.
              </p>
            </div>
          </div>
        )}

        {isQuiz && quizSavesResponses && (
          <div className="mb-4 bg-sky-50 border border-sky-200 text-sky-900 rounded-xl p-3.5 flex items-start gap-2.5 text-xs">
            <div className="p-1 rounded-lg bg-sky-100 text-sky-700 shrink-0 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-sky-950">Responses are recorded</p>
              <p className="text-sky-800 mt-0.5 leading-relaxed">
                Your answers and score are saved to the project record when you submit, and the
                administrator can see them. Your progress is also kept in this browser&apos;s
                local storage while you work through the quiz.
              </p>
            </div>
          </div>
        )}

        {/* Header Badges */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 px-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-stone-600 bg-white px-2.5 py-1 rounded-lg border border-stone-200">
              <Building2 className="w-3.5 h-3.5 text-stone-400" />
              <span>Client:</span>
              <span className="font-semibold text-stone-900">{clientCode}</span>
            </div>

            {projectName && (
              <div className="flex items-center gap-1.5 text-xs text-stone-800 bg-white px-2.5 py-1 rounded-lg border border-stone-200">
                <FolderKanban className="w-3.5 h-3.5 text-stone-500" />
                <span>Project:</span>
                <span className="font-bold text-stone-900">{projectName}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Reset is hidden in study-only mode: clearing would drop the
                respondent back to the mode picker, whose attempt modes are
                closed for this form. */}
            {!studyOnly && (
              <button
                type="button"
                onClick={handleClearForm}
                className="text-[11px] text-stone-400 hover:text-stone-700 transition-colors inline-flex items-center gap-1 cursor-pointer"
                title="Clear all inputs"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* VIEW 1: ACTIVE SECTION QUESTIONS (requirements questionnaires
            only). Quiz attempts never use sections — they answer one flat
            shuffled sequence (see the quiz 'all' view below). */}
        {!isReviewStep && currentSection && !isQuiz && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Section Description Card */}
            <div className="bg-white rounded-xl p-4 border border-stone-200/80 shadow-xs">
              <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Section {currentSection.order ?? currentSectionIndex + 1} of {sections.length}
              </p>
              <h1 className="text-lg font-bold text-stone-900 mt-0.5">
                {currentSection.title}
              </h1>
              {currentSection.description && (
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  {currentSection.description}
                </p>
              )}
            </div>

            {/* Questions in Section (reactive to conditional logic!) */}
            <div className="space-y-3.5">
              {(currentSection.questions || [])
                .filter((question) => isQuestionVisible(question, answers))
                .map((question) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    answer={answers[question.id]}
                    onChange={handleAnswerChange}
                    showError={!!validationErrors[question.id]}
                    quizResult={
                      previewQuizResult?.perQuestion.find(
                        (r) => r.questionId === question.id
                      ) || null
                    }
                    showQuizFeedback={!!previewQuizResult}
                  />
                ))}

              {(currentSection.questions || []).filter((q) =>
                isQuestionVisible(q, answers)
              ).length === 0 && (
                <div className="text-center py-8 bg-white rounded-xl border border-dashed border-stone-200 text-xs text-stone-400">
                  No questions currently available in this section.
                </div>
              )}
            </div>
          </div>
        )}

        {/* QUIZ 'ALL' VIEW: one flat shuffled sequence across the whole
            quiz — no section grouping. Every visible question on one page,
            in this attempt's shuffled order with shuffled options; answers
            are keyed by questionId, so reshuffling never loses them. */}
        {isQuiz && quizMode === 'all' && !isReviewStep && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="text-xs font-bold text-stone-700 tabular-nums">
                {totalAnsweredQuestions} of {totalVisibleQuestions} answered
              </span>
              <button
                type="button"
                onClick={handleShuffle}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-500 hover:text-stone-900 underline underline-offset-4 cursor-pointer shrink-0"
                title="Shuffle the questions and the options again"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Shuffle questions</span>
              </button>
            </div>

            <div className="space-y-3.5">
              {orderedVisibleQuizQuestions.map((question, idx) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  answer={answers[question.id]}
                  onChange={handleAnswerChange}
                  showError={!!validationErrors[question.id]}
                  quizResult={
                    previewQuizResult?.perQuestion.find(
                      (r) => r.questionId === question.id
                    ) || null
                  }
                  showQuizFeedback={!!previewQuizResult}
                  displayNumber={idx + 1}
                />
              ))}

              {orderedVisibleQuizQuestions.length === 0 && (
                <div className="text-center py-8 bg-white rounded-xl border border-dashed border-stone-200 text-xs text-stone-400">
                  No questions currently available in this quiz.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end pt-1">
              <button
                type="button"
                onClick={handleQuizReview}
                className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 active:bg-stone-950 shadow-xs transition-all cursor-pointer min-h-[44px] active:scale-[0.98]"
              >
                <span>Review & Submit</span>
                <ChevronRight className="w-4 h-4 shrink-0" />
              </button>
            </div>
          </div>
        )}

        {/* QUIZ MODE PICKER: the respondent chooses, at the start of the quiz,
            how to begin — answer the whole form at once, one question at a
            time, or study mode to read all correct answers first. */}
        {isQuiz && quizMode === null && !studyMode && !isReviewStep && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl p-5 border border-stone-200/80 shadow-xs">
              <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Choose how to begin
              </p>
              <h1 className="text-lg font-bold text-stone-900 mt-0.5">
                {questionnaire.title}
              </h1>
              {questionnaire.description && (
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  {questionnaire.description}
                </p>
              )}
              <p className="text-xs text-stone-500 mt-2">
                {visibleQuizQuestions.length} question{visibleQuizQuestions.length === 1 ? '' : 's'}
                {questionnaire.passMark !== undefined
                  ? ` · Pass mark ${questionnaire.passMark}%`
                  : ''}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => handlePickQuizMode('all')}
                className="text-left bg-white rounded-2xl p-5 border-2 border-stone-200 hover:border-stone-900 transition-all cursor-pointer active:scale-[0.99] shadow-xs"
              >
                <div className="w-10 h-10 rounded-xl bg-stone-900 text-white flex items-center justify-center mb-3">
                  <ListChecks className="w-5 h-5" />
                </div>
                <p className="text-sm font-bold text-stone-900">Answer all, then see your score</p>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  Go through every question first, review your answers, then submit once to see
                  your score.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handlePickQuizMode('one')}
                className="text-left bg-white rounded-2xl p-5 border-2 border-stone-200 hover:border-stone-900 transition-all cursor-pointer active:scale-[0.99] shadow-xs"
              >
                <div className="w-10 h-10 rounded-xl bg-stone-900 text-white flex items-center justify-center mb-3">
                  <ListOrdered className="w-5 h-5" />
                </div>
                <p className="text-sm font-bold text-stone-900">One question at a time</p>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  Answer one question, check it instantly to see if it&apos;s right, then move
                  to the next.
                </p>
              </button>

              <button
                type="button"
                onClick={handlePickStudyMode}
                className="text-left bg-white rounded-2xl p-5 border-2 border-stone-200 hover:border-stone-900 transition-all cursor-pointer active:scale-[0.99] shadow-xs"
              >
                <div className="w-10 h-10 rounded-xl bg-stone-900 text-white flex items-center justify-center mb-3">
                  <BookOpen className="w-5 h-5" />
                </div>
                <p className="text-sm font-bold text-stone-900">Study mode — see all correct answers</p>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  Read through every question with the correct answer and explanation shown, before
                  you attempt the quiz. No score — just study.
                </p>
              </button>
            </div>
          </div>
        )}

        {/* QUIZ ONE-AT-A-TIME VIEW: a single question, checked instantly. */}
        {isQuiz && quizMode === 'one' && !isReviewStep && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-stone-700 tabular-nums">
                Question {safeOneIndex + 1} of {orderedVisibleQuizQuestions.length}
              </span>
              <button
                type="button"
                onClick={() => handlePickQuizMode('all')}
                className="text-[11px] font-semibold text-stone-500 hover:text-stone-900 underline underline-offset-4 cursor-pointer"
              >
                Answer all at once instead
              </button>
            </div>

            <div className="w-full bg-stone-200 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-stone-900 h-1.5 transition-all duration-300 ease-out"
                style={{
                  width: `${
                    orderedVisibleQuizQuestions.length > 0
                      ? ((safeOneIndex + 1) / orderedVisibleQuizQuestions.length) * 100
                      : 0
                  }%`,
                }}
              />
            </div>

            {oneQuestion ? (
              <>
                <QuestionCard
                  key={oneQuestion.id}
                  question={oneQuestion}
                  answer={answers[oneQuestion.id]}
                  onChange={handleAnswerChange}
                  showError={!!validationErrors[oneQuestion.id]}
                  quizResult={oneChecked ? oneResult : null}
                  showQuizFeedback={oneChecked}
                  displayNumber={safeOneIndex + 1}
                />

                {oneHint && (
                  <p className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
                    {oneHint}
                  </p>
                )}

                <div className="flex items-center justify-end gap-2">
                  {!oneChecked && isScorableQuestion(oneQuestion) ? (
                    <button
                      type="button"
                      onClick={handleOneCheck}
                      className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 active:bg-stone-950 shadow-xs transition-all cursor-pointer min-h-[44px] active:scale-[0.98]"
                    >
                      <Check className="w-4 h-4 shrink-0" />
                      <span>Check answer</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleOneNext}
                      className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 active:bg-stone-950 shadow-xs transition-all cursor-pointer min-h-[44px] active:scale-[0.98]"
                    >
                      <span>{isLastOneQuestion ? 'See my score' : 'Next question'}</span>
                      <ChevronRight className="w-4 h-4 shrink-0" />
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-8 bg-white rounded-xl border border-dashed border-stone-200 text-xs text-stone-400">
                No questions currently available in this quiz.
              </div>
            )}
          </div>
        )}

        {/* QUIZ STUDY MODE: read-only review of the whole answer key. Every
            question in every section is listed with its correct answer
            marked and its explanation shown; questions with no answer key
            (text, textarea, ...) render as-is with no marking. No answering,
            no Check/Submit buttons, no score — and nothing is persisted
            (study mode is kept out of local storage on purpose). */}
        {isQuiz && studyMode && !isReviewStep && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="text-xs font-bold text-stone-700">
                Study mode — all correct answers ({studyQuestionCount} question
                {studyQuestionCount === 1 ? '' : 's'})
              </span>
              {/* In study-only mode there is no mode picker to go back to —
                  the attempt modes are closed for this form. */}
              {!studyOnly && (
                <button
                  type="button"
                  onClick={handleExitStudyMode}
                  className="text-[11px] font-semibold text-stone-500 hover:text-stone-900 underline underline-offset-4 cursor-pointer shrink-0"
                >
                  Back to modes
                </button>
              )}
            </div>

            <p className="text-xs text-stone-500 px-1 leading-relaxed">
              Read through every question with the correct answer marked and the explanation
              shown. Nothing is scored or saved — when you&apos;re ready, go back and attempt
              the quiz.
            </p>

            {sections.map((sec) => (
              <div key={sec.id} className="space-y-3.5">
                {sections.length > 1 && (
                  <p className="text-xs font-bold uppercase tracking-wider text-stone-500 px-1 pt-2">
                    {sec.title}
                  </p>
                )}
                {(sec.questions || []).map((question) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    answer={undefined}
                    onChange={() => {}}
                    studyMode
                  />
                ))}
              </div>
            ))}

            {sections.length === 0 && (
              <div className="text-center py-8 bg-white rounded-xl border border-dashed border-stone-200 text-xs text-stone-400">
                No questions currently available in this quiz.
              </div>
            )}

            {!studyOnly && (
              <div className="flex items-center justify-center pt-2">
                <button
                  type="button"
                  onClick={handleExitStudyMode}
                  className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 active:bg-stone-950 shadow-xs transition-all cursor-pointer min-h-[44px] active:scale-[0.98]"
                >
                  <span>Attempt this quiz</span>
                  <ChevronRight className="w-4 h-4 shrink-0" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: FINAL REVIEW & SUBMISSION — for quizzes the summary is
            the same flat shuffled list (no section grouping); Edit jumps
            back to the flat question list. */}
        {isReviewStep && (
          <ReviewSummary
            sections={sections}
            answers={answers}
            clientCode={clientCode}
            setClientCode={setClientCode}
            contactPerson={contactPerson}
            setContactPerson={setContactPerson}
            contactPhone={contactPhone}
            setContactPhone={setContactPhone}
            additionalRequirements={additionalRequirements}
            setAdditionalRequirements={setAdditionalRequirements}
            onJumpToSection={isQuiz ? () => setCurrentSectionIndex(0) : handleJumpToSection}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            submitError={submitError}
            isQuiz={isQuiz}
            quizSavesResponses={quizSavesResponses}
            flatQuestions={isQuiz ? orderedVisibleQuizQuestions : undefined}
          />
        )}
      </main>

      {/* PREVIEW SIMULATED SUBMISSION SUCCESS MODAL */}
      {previewSubmitted && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-stone-900">
              Preview Submission Simulated
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              All questions, required validations, and conditional display rules executed as expected.{' '}
              {isQuiz
                ? quizSavesResponses
                  ? 'In live mode, this quiz saves answers and scores to the project record.'
                  : 'In live mode, quiz answers are never saved anywhere — scoring happens in the respondent\u2019s browser only.'
                : 'In live client mode, this submission records directly into Firestore.'}
            </p>
            {previewQuizResult && (
              <div
                className={`rounded-xl p-3.5 border text-left ${
                  previewQuizResult.passMark !== undefined && !previewQuizResult.passed
                    ? 'bg-rose-50 border-rose-200'
                    : 'bg-emerald-50 border-emerald-200'
                }`}
              >
                <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                  Quiz Score (Preview)
                </p>
                <p className="text-xl font-black text-stone-900 tabular-nums">
                  {previewQuizResult.earned} / {previewQuizResult.total}
                  <span className="text-sm font-bold text-stone-500 ml-2">
                    ({previewQuizResult.percent}%)
                  </span>
                  {previewQuizResult.passMark !== undefined && (
                    <span
                      className={`ml-2 text-xs font-bold px-2 py-0.5 rounded-full ${
                        previewQuizResult.passed
                          ? 'bg-emerald-600 text-white'
                          : 'bg-rose-600 text-white'
                      }`}
                    >
                      {previewQuizResult.passed ? 'Passed' : 'Failed'}
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-stone-500 mt-1">
                  Close this dialog to review each question with correct/incorrect marking.
                </p>
              </div>
            )}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPreviewSubmitted(false)}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Continue Testing
              </button>
              {onClosePreview && (
                <button
                  type="button"
                  onClick={onClosePreview}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  Exit Preview
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STICKY BOTTOM ACTION BAR — requirements questionnaires only.
          Quiz attempt modes carry their own buttons (flat 'all' view has
          Review & Submit; one-at-a-time has Check/Next; the review step's
          submit lives inside ReviewSummary). */}
      {!isQuiz && (
      <footer className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-md border-t border-stone-200/90 py-2.5 px-3 sm:px-4 pb-safe shadow-lg">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handlePrevSection}
              disabled={currentSectionIndex === 0}
              className={`inline-flex items-center justify-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl text-xs font-bold transition-all min-h-[44px] ${
                currentSectionIndex === 0
                  ? 'opacity-30 cursor-not-allowed text-stone-400 bg-stone-100'
                  : 'text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 cursor-pointer active:scale-[0.98]'
              }`}
            >
              <ChevronLeft className="w-4 h-4 shrink-0" />
              <span>Previous</span>
            </button>

            {!isPreview && !isQuiz && (
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isSavingDraft}
                className={`inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer min-h-[44px] active:scale-[0.98] ${
                  draftSaveSuccess
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-700 active:bg-stone-300'
                }`}
                title="Save work as draft to resume later"
              >
                {draftSaveSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    <span className="hidden sm:inline">Saved</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                    <span className="hidden sm:inline">{isSavingDraft ? 'Saving...' : 'Save Draft'}</span>
                  </>
                )}
              </button>
            )}
          </div>

          {!isReviewStep ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setCurrentSectionIndex(sections.length)}
                className="hidden sm:inline-flex items-center gap-1 px-3 py-2.5 rounded-xl text-xs font-medium text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition-colors cursor-pointer min-h-[44px]"
              >
                <span>Review</span>
              </button>

              <button
                type="button"
                onClick={handleNextSection}
                className="inline-flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 active:bg-stone-950 shadow-xs transition-all cursor-pointer min-h-[44px] active:scale-[0.98]"
              >
                <span>
                  {currentSectionIndex === sections.length - 1
                    ? 'Review & Submit'
                    : 'Next Section'}
                </span>
                <ChevronRight className="w-4 h-4 shrink-0" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 active:bg-stone-950 shadow-sm transition-all cursor-pointer disabled:opacity-50 min-h-[44px] active:scale-[0.98]"
            >
              {isSubmitting ? (
                <span>Submitting...</span>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 shrink-0" />
                  <span>{isQuiz ? 'Submit Quiz & See Score' : 'Submit Requirements'}</span>
                </>
              )}
            </button>
          )}
        </div>
      </footer>
      )}
      {/* RESET CONFIRMATION DIALOG — in-app (not window.confirm, which
          automated browsers dismiss silently). Clears every answer and all
          saved progress for this quiz, and returns to the mode picker. */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-stone-200 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-black text-stone-900 text-center">
              Reset this {isQuiz ? 'quiz' : 'form'}?
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed text-center">
              {isQuiz
                ? 'This clears all your answers, your checked feedback and your saved score, and takes you back to the start. Your progress kept in this browser will be deleted.'
                : 'This clears all the answers in this form.'}
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition cursor-pointer min-h-[44px]"
              >
                Keep my answers
              </button>
              <button
                type="button"
                onClick={handleConfirmClearForm}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition cursor-pointer min-h-[44px]"
              >
                Clear everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
