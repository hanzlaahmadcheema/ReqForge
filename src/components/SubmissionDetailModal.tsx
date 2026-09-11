import React, { useState, useEffect } from 'react';
import {
  X,
  FileDown,
  Building2,
  Calendar,
  Clock,
  User,
  Phone,
  CheckCircle2,
  AlertCircle,
  Check,
  Hash,
  FileText,
  HelpCircle,
  FileSpreadsheet,
  FileCode,
  Archive,
  RotateCcw,
  Trash2,
  Eye,
  CheckCheck,
  Sparkles,
} from 'lucide-react';
import { QuestionnaireSection, StoredSubmission, Questionnaire } from '../types';
import { reconstructAnswersFromSubmission } from '../lib/firebase';
import { generateQuestionnairePdf } from '../lib/generatePdf';
import { exportSubmissionToCsv, exportSubmissionToJson } from '../lib/exportService';
import { getQuestionnaireVersionSnapshot } from '../lib/questionnaireService';
import { SubmissionAiRequirementsPanel } from './management/SubmissionAiRequirementsPanel';

interface SubmissionDetailModalProps {
  submission: StoredSubmission | null;
  isOpen: boolean;
  onClose: () => void;
  sections: QuestionnaireSection[];
  questionnaire?: Questionnaire | null;
  onStatusChange?: (
    submissionId: string,
    newStatus: 'draft' | 'submitted' | 'reviewed' | 'archived'
  ) => Promise<void>;
  onDelete?: (submissionId: string) => Promise<void>;
}

export const SubmissionDetailModal: React.FC<SubmissionDetailModalProps> = ({
  submission,
  isOpen,
  onClose,
  sections,
  questionnaire,
  onStatusChange,
  onDelete,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<number>(0);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [snapshotSections, setSnapshotSections] = useState<QuestionnaireSection[] | null>(null);
  const [mainViewMode, setMainViewMode] = useState<'responses' | 'ai_intelligence'>('responses');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (
      submission &&
      submission.questionnaireVersion &&
      questionnaire &&
      submission.questionnaireVersion !== questionnaire.version
    ) {
      getQuestionnaireVersionSnapshot(
        questionnaire.id,
        submission.questionnaireVersion
      ).then((snap) => {
        if (snap?.sections && snap.sections.length > 0) {
          setSnapshotSections(snap.sections);
        } else {
          setSnapshotSections(null);
        }
      });
    } else {
      setSnapshotSections(null);
    }
  }, [submission, questionnaire]);

  if (!isOpen || !submission) return null;

  const activeSections = snapshotSections || sections;
  const answers = reconstructAnswersFromSubmission(submission);
  const currentStatus = submission.status || 'submitted';

  // Format date and time
  const formattedDate = (() => {
    try {
      const dateStr = submission.submittedAtIso || (submission.createdAt as string) || new Date().toISOString();
      const d = new Date(dateStr);
      return {
        date: d.toLocaleDateString(undefined, {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
        time: d.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
    } catch {
      return { date: submission.submittedAtIso || 'Recent', time: '' };
    }
  })();

  // Calculate answered count
  let totalQuestions = 0;
  let answeredQuestions = 0;
  activeSections.forEach((sec) => {
    (sec.questions || []).forEach((q) => {
      totalQuestions++;
      const ans = answers[q.id];
      if (ans && ans.value !== null && ans.value !== undefined) {
        if (Array.isArray(ans.value)) {
          if (ans.value.length > 0) answeredQuestions++;
        } else if (typeof ans.value === 'string') {
          if (ans.value.trim().length > 0) answeredQuestions++;
        } else {
          answeredQuestions++;
        }
      }
    });
  });

  const handleDownloadPdf = () => {
    try {
      setDownloading(true);
      generateQuestionnairePdf({
        clientCode: submission.clientCode,
        contactPerson: submission.contactPerson || undefined,
        contactPhone: submission.contactPhone || undefined,
        additionalRequirements: submission.additionalRequirements || undefined,
        sections: activeSections,
        answers,
        isSubmitted: currentStatus !== 'draft',
        submissionDocId: submission.submissionDocId || submission.id,
      });

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handleStatusTransition = async (
    nextStatus: 'draft' | 'submitted' | 'reviewed' | 'archived'
  ) => {
    if (!onStatusChange) return;
    setIsUpdatingStatus(true);
    try {
      await onStatusChange(submission.id, nextStatus);
    } catch (err) {
      console.error('Failed changing submission status:', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsUpdatingStatus(true);
    try {
      await onDelete(submission.id);
      onClose();
    } catch (err) {
      console.error('Failed deleting submission:', err);
    } finally {
      setIsUpdatingStatus(false);
      setShowDeleteConfirm(false);
    }
  };

  const currentSection = activeSections[activeTab] || activeSections[0];

  const effectiveQuestionnaire: Questionnaire = snapshotSections
    ? {
        ...(questionnaire || {
          id: submission.questionnaireId || '',
          title: submission.formTitle || 'Questionnaire',
          description: '',
          version: submission.questionnaireVersion || 1,
          status: 'published' as const,
          sections: activeSections,
        }),
        sections: activeSections,
        version: submission.questionnaireVersion || questionnaire?.version || 1,
      }
    : questionnaire || {
        id: submission.questionnaireId || '',
        title: submission.formTitle || 'Questionnaire',
        description: '',
        version: submission.questionnaireVersion || 1,
        status: 'published' as const,
        sections: activeSections,
      };

  return (
    <div
      id="submission-detail-modal"
      className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-stone-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="p-4 sm:p-6 border-b border-stone-200 bg-stone-50/75 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  {submission.clientCode}
                </span>

                {/* Status Badge */}
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    currentStatus === 'reviewed'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : currentStatus === 'archived'
                      ? 'bg-stone-100 text-stone-600 border-stone-300'
                      : currentStatus === 'draft'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-sky-50 text-sky-800 border-sky-200'
                  }`}
                >
                  {currentStatus === 'reviewed' && <CheckCheck className="w-3 h-3 text-emerald-600" />}
                  {currentStatus === 'archived' && <Archive className="w-3 h-3 text-stone-500" />}
                  {currentStatus === 'draft' && <Eye className="w-3 h-3 text-amber-600" />}
                  {currentStatus === 'submitted' && <CheckCircle2 className="w-3 h-3 text-sky-600" />}
                  <span className="capitalize">{currentStatus}</span>
                </span>

                {submission.questionnaireVersion && (
                  <span className="text-[11px] font-semibold text-stone-600 bg-stone-100 border border-stone-200 px-2 py-0.5 rounded">
                    v{submission.questionnaireVersion}
                  </span>
                )}

                <span className="inline-flex items-center gap-1 text-xs text-stone-400 font-mono bg-stone-100 px-2 py-0.5 rounded">
                  <Hash className="w-3 h-3 text-stone-400" />
                  {submission.id}
                </span>
              </div>

              <h2 className="text-lg sm:text-xl font-bold text-stone-900">
                {submission.formTitle || questionnaire?.title || 'System Specifications Questionnaire'}
              </h2>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-600 pt-0.5">
                <span className="flex items-center gap-1 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-stone-400" />
                  {formattedDate.date}
                </span>
                {formattedDate.time && (
                  <span className="flex items-center gap-1 font-medium">
                    <Clock className="w-3.5 h-3.5 text-stone-400" />
                    {formattedDate.time}
                  </span>
                )}
                <span className="flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  {answeredQuestions} / {totalQuestions} answered
                </span>
              </div>
            </div>

            {/* Header Right: Export Menu & Close */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-stone-200 shadow-xs">
                {/* PDF */}
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={downloading}
                  title="Download PDF report"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-stone-900 hover:bg-stone-800 text-white transition-colors cursor-pointer disabled:opacity-50"
                >
                  {downloadSuccess ? (
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                  ) : (
                    <FileDown className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">PDF</span>
                </button>

                {/* CSV */}
                <button
                  type="button"
                  onClick={() => exportSubmissionToCsv(submission, effectiveQuestionnaire)}
                  title="Export answers to CSV spreadsheet"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">CSV</span>
                </button>

                {/* JSON */}
                <button
                  type="button"
                  onClick={() => exportSubmissionToJson(submission, effectiveQuestionnaire)}
                  title="Export raw JSON schema & answers"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  <FileCode className="w-3.5 h-3.5 text-blue-600" />
                  <span className="hidden sm:inline">JSON</span>
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-200/70 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Workflow Action Bar for Admins */}
          {onStatusChange && (
            <div className="mt-3.5 pt-3 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3 bg-white/60 p-2.5 rounded-xl border">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-stone-500">Workflow Status:</span>
                <span className="text-xs font-bold text-stone-800 capitalize">{currentStatus}</span>
              </div>

              <div className="flex items-center gap-2">
                {currentStatus === 'draft' && (
                  <button
                    type="button"
                    disabled={isUpdatingStatus}
                    onClick={() => handleStatusTransition('submitted')}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-xs transition-colors cursor-pointer"
                  >
                    Mark as Submitted
                  </button>
                )}

                {currentStatus === 'submitted' && (
                  <button
                    type="button"
                    disabled={isUpdatingStatus}
                    onClick={() => handleStatusTransition('reviewed')}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
                  >
                    Mark as Reviewed
                  </button>
                )}

                {currentStatus === 'reviewed' && (
                  <>
                    <button
                      type="button"
                      disabled={isUpdatingStatus}
                      onClick={() => handleStatusTransition('submitted')}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-600 hover:bg-stone-100 border border-stone-200 transition-colors cursor-pointer"
                    >
                      Revert to Submitted
                    </button>
                    <button
                      type="button"
                      disabled={isUpdatingStatus}
                      onClick={() => handleStatusTransition('archived')}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Archive className="w-3.5 h-3.5 text-stone-500" />
                      Archive
                    </button>
                  </>
                )}

                {currentStatus === 'archived' && (
                  <button
                    type="button"
                    disabled={isUpdatingStatus}
                    onClick={() => handleStatusTransition('reviewed')}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-900 hover:bg-stone-800 text-white shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restore
                  </button>
                )}

                {onDelete && (
                  <button
                    type="button"
                    disabled={isUpdatingStatus}
                    onClick={() => setShowDeleteConfirm(true)}
                    className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer ml-1"
                    title="Delete submission"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Delete Confirmation Alert */}
          {showDeleteConfirm && (
            <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-900 animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Are you sure you want to permanently delete this submission record?</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-2.5 py-1 text-stone-600 hover:bg-rose-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg cursor-pointer"
                >
                  Yes, Delete
                </button>
              </div>
            </div>
          )}

          {/* Client Contact Details */}
          {(submission.contactPerson || submission.contactPhone || submission.additionalRequirements) && (
            <div className="mt-3 pt-3 border-t border-stone-200/80 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
              {submission.contactPerson && (
                <div className="flex items-center gap-2 text-stone-700">
                  <User className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  <span className="text-stone-500">Contact:</span>
                  <span className="font-semibold text-stone-900">{submission.contactPerson}</span>
                </div>
              )}
              {submission.contactPhone && (
                <div className="flex items-center gap-2 text-stone-700">
                  <Phone className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  <span className="text-stone-500">Phone/WhatsApp:</span>
                  <span className="font-semibold text-stone-900">{submission.contactPhone}</span>
                </div>
              )}
              {submission.additionalRequirements && (
                <div className="col-span-1 sm:col-span-2 md:col-span-3 bg-amber-50/70 border border-amber-200/80 p-2.5 rounded-xl text-amber-950 flex items-start gap-2">
                  <FileText className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-[11px] uppercase tracking-wider text-amber-900">
                      Additional Requirements Note:
                    </span>
                    <p className="text-xs mt-0.5 leading-relaxed whitespace-pre-wrap">
                      {submission.additionalRequirements}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Main View Mode Selector (Client Responses vs AI Intelligence) */}
        <div className="bg-stone-100/90 border-b border-stone-200 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 p-1 bg-stone-200/80 rounded-xl">
            <button
              type="button"
              onClick={() => setMainViewMode('responses')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                mainViewMode === 'responses'
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Client Responses</span>
            </button>

            <button
              type="button"
              onClick={() => setMainViewMode('ai_intelligence')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                mainViewMode === 'ai_intelligence'
                  ? 'bg-stone-900 text-white shadow-2xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>AI Requirements & Intelligence</span>
              <span className="text-[10px] bg-amber-400 text-stone-950 px-1.5 py-0.2 rounded font-black">
                Phase 5
              </span>
            </button>
          </div>

          <div className="text-[11px] text-stone-500 hidden sm:block">
            {mainViewMode === 'responses'
              ? `${answeredQuestions} of ${totalQuestions} questions answered`
              : 'Assisted synthesis, structured requirements, & gap audit'}
          </div>
        </div>

        {mainViewMode === 'ai_intelligence' ? (
          <SubmissionAiRequirementsPanel
            submission={submission}
            sections={activeSections}
          />
        ) : (
          <>
            {/* Section Tabs Header */}
            <div className="border-b border-stone-200 bg-stone-100/70 px-4 sm:px-6 overflow-x-auto flex gap-1 scrollbar-none shrink-0">
          {activeSections.map((sec, idx) => {
            const secQuestions = sec.questions || [];
            const secAnswered = secQuestions.filter((q) => {
              const ans = answers[q.id];
              if (!ans || ans.value === null || ans.value === undefined) return false;
              if (Array.isArray(ans.value)) return ans.value.length > 0;
              if (typeof ans.value === 'string') return ans.value.trim().length > 0;
              return true;
            }).length;

            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveTab(idx)}
                className={`px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
                  activeTab === idx
                    ? 'border-stone-900 text-stone-900 bg-white'
                    : 'border-transparent text-stone-500 hover:text-stone-800 hover:bg-stone-50'
                }`}
              >
                <span>{sec.title}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    secAnswered === secQuestions.length && secQuestions.length > 0
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-stone-200 text-stone-600'
                  }`}
                >
                  {secAnswered}/{secQuestions.length}
                </span>
              </button>
            );
          })}
        </div>

        {/* Section Questions Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {currentSection && (
            <div className="space-y-4">
              <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200/80">
                <h3 className="font-bold text-stone-900 text-sm">{currentSection.title}</h3>
                {currentSection.description && (
                  <p className="text-xs text-stone-600 mt-1">{currentSection.description}</p>
                )}
              </div>

              <div className="space-y-3">
                {(currentSection.questions || []).map((q, qIndex) => {
                  const ans = answers[q.id];
                  const hasAnswer =
                    ans &&
                    ans.value !== null &&
                    ans.value !== undefined &&
                    (Array.isArray(ans.value) ? ans.value.length > 0 : String(ans.value).trim().length > 0);

                  return (
                    <div
                      key={q.id}
                      className={`p-4 rounded-xl border transition-colors ${
                        hasAnswer
                          ? 'bg-white border-stone-200'
                          : 'bg-stone-50/50 border-dashed border-stone-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block">
                            Question {qIndex + 1} • {q.type.replace('_', ' ')}
                          </span>
                          <h4 className="text-sm font-semibold text-stone-900">{q.text || q.title || q.id}</h4>
                          {q.description && (
                            <p className="text-xs text-stone-500">{q.description}</p>
                          )}
                        </div>

                        {hasAnswer ? (
                          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Answered
                          </span>
                        ) : (
                          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-stone-400 bg-stone-100 px-2 py-0.5 rounded">
                            <HelpCircle className="w-3 h-3" />
                            Not Answered
                          </span>
                        )}
                      </div>

                      {/* Display Answer Value */}
                      <div className="mt-3 pt-3 border-t border-stone-100">
                        {hasAnswer ? (
                          <div className="space-y-1.5">
                            <div className="text-xs font-semibold text-stone-500">Response:</div>
                            {Array.isArray(ans.value) ? (
                              <div className="flex flex-wrap gap-1.5">
                                {ans.value.map((v, i) => (
                                  <span
                                    key={i}
                                    className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-800 text-xs font-medium border border-stone-200"
                                  >
                                    {String(v)}
                                  </span>
                                ))}
                              </div>
                            ) : typeof ans.value === 'boolean' ? (
                              <span
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold inline-block ${
                                  ans.value
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : 'bg-stone-100 text-stone-700 border border-stone-200'
                                }`}
                              >
                                {ans.value ? 'Yes' : 'No'}
                              </span>
                            ) : (
                              <p className="text-xs text-stone-900 bg-stone-50 p-2.5 rounded-lg border border-stone-200/80 font-medium whitespace-pre-wrap">
                                {String(ans.value)}
                              </p>
                            )}

                            {ans.otherText && (
                              <div className="mt-1 text-xs text-stone-600 bg-amber-50/70 p-2 rounded-lg border border-amber-200/70">
                                <span className="font-semibold text-amber-900">Other Specified: </span>
                                {ans.otherText}
                              </div>
                            )}

                            {ans.conditionalValue !== undefined && ans.conditionalValue !== null && (
                              <div className="mt-1 text-xs text-stone-600 bg-blue-50/70 p-2 rounded-lg border border-blue-200/70">
                                <span className="font-semibold text-blue-900">Follow-up Response: </span>
                                {String(ans.conditionalValue)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-stone-400 italic">No answer provided</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-stone-500">
            <span>Section {activeTab + 1} of {sections.length}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={activeTab === 0}
              onClick={() => setActiveTab((prev) => Math.max(0, prev - 1))}
              className="px-3 py-1.5 text-xs font-semibold text-stone-700 bg-white border border-stone-200 rounded-xl hover:bg-stone-100 disabled:opacity-40 transition-colors cursor-pointer"
            >
              Previous Section
            </button>
            <button
              type="button"
              disabled={activeTab === sections.length - 1}
              onClick={() => setActiveTab((prev) => Math.min(sections.length - 1, prev + 1))}
              className="px-3 py-1.5 text-xs font-semibold text-stone-700 bg-white border border-stone-200 rounded-xl hover:bg-stone-100 disabled:opacity-40 transition-colors cursor-pointer"
            >
              Next Section
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-stone-900 rounded-xl hover:bg-stone-800 transition-colors cursor-pointer ml-2"
            >
              Close
            </button>
          </div>
        </div>
      </>
    )}
  </div>
</div>
  );
};
