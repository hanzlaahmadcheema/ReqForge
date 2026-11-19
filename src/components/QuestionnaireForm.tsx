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
  clearQuizProgress,
  type QuizAnswerMode,
  type QuizProgress,
} from '../lib/quizLocalStorage';

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
  onSubmit?: (payload: {
    clientCode: string;
    contactPerson: string;
    contactPhone: string;
    additionalRequirements: string;
    answers: QuestionnaireAnswers;
    existingDraftId?: string;
  }) => Promise<void>;
  onClosePreview?: () => void;
  isSubmitting?: boolean;
  submitError?: string | null;
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
}) => {
  const [clientCode, setClientCode] = useState<string>(initialClientCode);
  const [contactPerson, setContactPerson] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>('');
  const [additionalRequirements, setAdditionalRequirements] = useState<string>('');
  // Quiz-only state. Quizzes are fully anonymous: progress lives in this
  // browser's local storage only and is never sent to any server, so a
  // refresh can resume an attempt. Requirements questionnaires are
  // unaffected (their drafts still live in Firestore).
  const isQuiz = questionnaire.quiz === true;
  const quizProgressKey = getQuizProgressKey(questionnaire.id, projectId);
  // Restored once, on mount, so the lazy initializers below read it exactly once.
  const [restoredQuizProgress] = useState<QuizProgress | null>(() =>
    isQuiz && !isPreview ? loadQuizProgress(quizProgressKey) : null
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
  // One-at-a-time mode state: current question index, whether it was checked,
  // and its per-question result.
  const [oneIndex, setOneIndex] = useState<number>(restoredQuizProgress?.oneIndex ?? 0);
  const [oneChecked, setOneChecked] = useState<boolean>(false);
  const [oneResult, setOneResult] = useState<QuizQuestionResult | null>(null);
  const [oneHint, setOneHint] = useState<string | null>(null);

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
      // Anonymous quiz: no server draft exists to restore — progress was
      // already restored from this browser's local storage above.
      if (restoredQuizProgress && Object.keys(restoredQuizProgress.answers || {}).length > 0) {
        setResumedDraftNotice(
          'Your previous progress on this quiz was restored from this browser only. Nothing was sent to or saved on any server.'
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
  }, [projectId, clientId, questionnaire.id, initialClientCode, isPreview, isQuiz, restoredQuizProgress]);

  // Quiz progress auto-save: local storage only, never the server.
  useEffect(() => {
    if (!isQuiz || isPreview) return;
    saveQuizProgress(quizProgressKey, {
      answers,
      mode: quizMode,
      oneIndex,
      updatedAt: new Date().toISOString(),
    });
  }, [answers, quizMode, oneIndex, isQuiz, isPreview, quizProgressKey]);

  // Manual Draft Save Handler
  const handleSaveDraft = async () => {
    if (isPreview) {
      alert('Draft saving is disabled in preview mode.');
      return;
    }
    if (isQuiz) {
      // Anonymous quiz: a "draft" lives in this browser only — nothing is
      // written to Firestore (the buttons that call this are hidden for
      // quizzes; this is a guard for any other caller).
      saveQuizProgress(quizProgressKey, {
        answers,
        mode: quizMode,
        oneIndex,
        updatedAt: new Date().toISOString(),
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
    if (window.confirm('Reset all answers in this form?')) {
      setAnswers({});
      setValidationErrors({});
      setAdditionalRequirements('');
      setCurrentSectionIndex(0);
      setPreviewQuizResult(null);
      if (isQuiz) {
        // Start the quiz over from the mode choice; drop local progress too.
        clearQuizProgress(quizProgressKey);
        setQuizMode(null);
        setOneIndex(0);
        setOneChecked(false);
        setOneResult(null);
        setOneHint(null);
      }
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
      // A submitted quiz attempt is done: clear local progress so the next
      // attempt starts fresh. The score is computed, never stored.
      clearQuizProgress(quizProgressKey);
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
  const safeOneIndex = Math.min(oneIndex, Math.max(visibleQuizQuestions.length - 1, 0));
  const oneQuestion = visibleQuizQuestions[safeOneIndex] as Question | undefined;
  const isLastOneQuestion = safeOneIndex >= visibleQuizQuestions.length - 1;

  // Check the current question instantly: lock the answer and show
  // correct/incorrect + explanation right away.
  const handleOneCheck = () => {
    if (!oneQuestion) return;
    if (!isQuestionAnswered(oneQuestion.id)) {
      setOneHint('Choose an answer first, then check it.');
      return;
    }
    setOneHint(null);
    setOneResult(scoreQuestion(oneQuestion, answers[oneQuestion.id]));
    setOneChecked(true);
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
    setQuizMode(mode);
    setOneIndex(0);
    setOneChecked(false);
    setOneResult(null);
    setOneHint(null);
    setCurrentSectionIndex(0);
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
            {(!isQuiz || quizMode === 'all') && (
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
              {isQuiz && quizMode === null
                ? 'Quiz'
                : isQuiz && quizMode === 'one'
                ? `${safeOneIndex + 1}/${visibleQuizQuestions.length}`
                : !isReviewStep && currentSection
                ? `${currentSectionIndex + 1}/${sections.length}`
                : 'Review'}
            </span>

            {/* Desktop section label */}
            <span className="text-xs text-stone-600 font-medium hidden sm:inline truncate max-w-xs">
              {isQuiz && quizMode === null
                ? 'Choose how to answer'
                : isQuiz && quizMode === 'one'
                ? `Question ${safeOneIndex + 1} of ${visibleQuizQuestions.length}`
                : !isReviewStep && currentSection
                ? `Section ${currentSectionIndex + 1} of ${sections.length}: ${currentSection.title}`
                : 'Final Review & Submission'}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isQuiz && (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200"
                title="Quiz progress is kept in this browser only — nothing is sent to a server"
              >
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Saved in this browser</span>
                <span className="sm:hidden">Private</span>
              </span>
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

        {/* Anonymous Quiz Notice — shown on every quiz so the respondent can
            see, before answering anything, that nothing leaves this browser. */}
        {isQuiz && (
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
            <button
              type="button"
              onClick={handleClearForm}
              className="text-[11px] text-stone-400 hover:text-stone-700 transition-colors inline-flex items-center gap-1 cursor-pointer"
              title="Clear all inputs"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* VIEW 1: ACTIVE SECTION QUESTIONS (whole-form mode; also the only
            view for non-quiz questionnaires) */}
        {!isReviewStep && currentSection && (!isQuiz || quizMode === 'all') && (
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

        {/* QUIZ MODE PICKER: the respondent chooses, at the start of the quiz,
            how to answer — the whole form at once, or one question at a time. */}
        {isQuiz && quizMode === null && !isReviewStep && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl p-5 border border-stone-200/80 shadow-xs">
              <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
                How do you want to answer?
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            </div>
          </div>
        )}

        {/* QUIZ ONE-AT-A-TIME VIEW: a single question, checked instantly. */}
        {isQuiz && quizMode === 'one' && !isReviewStep && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-stone-700 tabular-nums">
                Question {safeOneIndex + 1} of {visibleQuizQuestions.length}
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
                    visibleQuizQuestions.length > 0
                      ? ((safeOneIndex + 1) / visibleQuizQuestions.length) * 100
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

        {/* VIEW 2: FINAL REVIEW & SUBMISSION */}
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
            onJumpToSection={handleJumpToSection}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            submitError={submitError}
            isQuiz={isQuiz}
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
                ? 'In live mode, quiz answers are never saved anywhere — scoring happens in the respondent\u2019s browser only.'
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

      {/* STICKY BOTTOM ACTION BAR — hidden on the quiz mode picker and in
          one-at-a-time mode, which carry their own buttons. */}
      {!(isQuiz && quizMode !== 'all') && (
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
    </div>
  );
};
