/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Lock,
  KeyRound,
  FileQuestion,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  Building2,
  FolderKanban,
  FileText,
  AlertCircle,
  Clock,
  Sparkles,
  LogOut,
} from 'lucide-react';
import {
  PublicFormInfo,
  AuthorizedFormSession,
  Questionnaire,
  QuestionnaireAnswers,
  Submission,
} from '../../types';
import {
  getPublicFormSafeInfo,
  verifyPublicFormPin,
  getFormSession,
  clearFormSession,
} from '../../lib/publicFormService';
import {
  getQuestionnaire,
  getQuestionnaireVersionSnapshot,
  saveQuestionnaireSubmission,
  saveQuestionnaireDraft,
  fetchDraftSubmission,
} from '../../lib/questionnaireService';
import { QuestionnaireForm } from '../QuestionnaireForm';
import { SuccessView } from '../SuccessView';

interface PublicFormPortalProps {
  publicFormId: string;
  onBackToHome: () => void;
  onOpenAdmin: () => void;
}

export const PublicFormPortal: React.FC<PublicFormPortalProps> = ({
  publicFormId,
  onBackToHome,
  onOpenAdmin,
}) => {
  // Safe metadata
  const [formInfo, setFormInfo] = useState<PublicFormInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState<boolean>(true);
  const [infoError, setInfoError] = useState<string | null>(null);

  // Authorization / PIN verification
  const [pin, setPin] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [verifyingPin, setVerifyingPin] = useState<boolean>(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [session, setSession] = useState<AuthorizedFormSession | null>(() => {
    return getFormSession(publicFormId);
  });

  // Questionnaire state
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [loadingQuestionnaire, setLoadingQuestionnaire] = useState<boolean>(false);
  const [questionnaireError, setQuestionnaireError] = useState<string | null>(null);
  const [initialAnswers, setInitialAnswers] = useState<QuestionnaireAnswers>({});
  const [existingDraftId, setExistingDraftId] = useState<string | undefined>(undefined);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedResult, setSubmittedResult] = useState<{
    docId: string;
    masterDocId: string;
    answers?: QuestionnaireAnswers;
    additionalRequirements?: string;
  } | null>(null);

  // 1. Fetch safe public form metadata
  useEffect(() => {
    let isMounted = true;
    setLoadingInfo(true);
    setInfoError(null);

    getPublicFormSafeInfo(publicFormId)
      .then((info) => {
        if (!isMounted) return;
        if (!info) {
          setInfoError('This form identifier is invalid or does not exist.');
        } else {
          setFormInfo(info);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setInfoError('Failed to load form information. Please try again.');
      })
      .finally(() => {
        if (isMounted) setLoadingInfo(false);
      });

    return () => {
      isMounted = false;
    };
  }, [publicFormId]);

  // 2. Load Questionnaire once session is authorized
  useEffect(() => {
    if (!session) return;

    let isMounted = true;
    setLoadingQuestionnaire(true);
    setQuestionnaireError(null);

    async function loadFormQuestionnaire() {
      try {
        const q = await getQuestionnaire(session!.questionnaireId);
        if (!q) {
          if (isMounted) setQuestionnaireError('The assigned questionnaire template was not found.');
          return;
        }

        // If a specific version snapshot was locked
        if (session!.questionnaireVersion && session!.questionnaireVersion !== q.version) {
          const snapshot = await getQuestionnaireVersionSnapshot(
            session!.questionnaireId,
            session!.questionnaireVersion
          );
          if (snapshot && isMounted) {
            setQuestionnaire({
              id: q.id,
              title: snapshot.title || q.title,
              description: snapshot.description || q.description,
              version: snapshot.version,
              status: 'published',
              sections: snapshot.sections,
              createdAt: snapshot.createdAt,
              updatedAt: snapshot.publishedAt,
            });
            return;
          }
        }

        if (isMounted) {
          setQuestionnaire(q);
        }

        // Check for existing draft
        if (session!.projectId && session!.shareToken) {
          try {
            const draft = await fetchDraftSubmission({
              projectId: session!.projectId,
              shareToken: session!.shareToken,
            });
            if (draft && isMounted) {
              setExistingDraftId(draft.id);
              if (draft.answers) {
                setInitialAnswers(draft.answers);
              }
            }
          } catch (draftErr) {
            console.warn('Could not restore draft:', draftErr);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setQuestionnaireError(err.message || 'Error loading questionnaire definition.');
        }
      } finally {
        if (isMounted) {
          setLoadingQuestionnaire(false);
        }
      }
    }

    loadFormQuestionnaire();

    return () => {
      isMounted = false;
    };
  }, [session]);

  // PIN Verification Submit
  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pin.trim();
    if (!cleanPin) {
      setPinError('Please enter your access PIN.');
      return;
    }

    setVerifyingPin(true);
    setPinError(null);

    try {
      const res = await verifyPublicFormPin(publicFormId, cleanPin);
      if (res.success && res.session) {
        setSession(res.session);
      } else {
        setPinError(res.error || 'Incorrect access PIN.');
      }
    } catch (err: any) {
      setPinError(err.message || 'Verification failed. Please try again.');
    } finally {
      setVerifyingPin(false);
    }
  };

  // Draft Save Handler
  const handleSaveDraft = async (payload: {
    clientCode: string;
    contactPerson: string;
    contactPhone: string;
    additionalRequirements: string;
    answers: QuestionnaireAnswers;
    existingDraftId?: string;
  }) => {
    if (!session || !questionnaire) return '';

    const res = await saveQuestionnaireDraft({
      existingSubmissionId: payload.existingDraftId || existingDraftId,
      questionnaireId: session.questionnaireId,
      questionnaireVersion: session.questionnaireVersion || questionnaire.version,
      clientCode: payload.clientCode || session.clientName || 'Client',
      clientId: session.projectId ? undefined : undefined,
      projectId: session.projectId,
      shareToken: session.shareToken,
      contactPerson: payload.contactPerson || null,
      contactPhone: payload.contactPhone || null,
      additionalRequirements: payload.additionalRequirements || '',
      answers: payload.answers,
    });

    if (res?.submissionId) {
      setExistingDraftId(res.submissionId);
      return res.submissionId;
    }
    return '';
  };

  // Submission Handler
  const handleSubmit = async (payload: {
    clientCode: string;
    contactPerson: string;
    contactPhone: string;
    additionalRequirements: string;
    answers: QuestionnaireAnswers;
    existingDraftId?: string;
  }) => {
    if (!session || !questionnaire) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await saveQuestionnaireSubmission({
        existingSubmissionId: payload.existingDraftId || existingDraftId,
        questionnaireId: session.questionnaireId,
        questionnaireVersion: session.questionnaireVersion || questionnaire.version,
        clientCode: payload.clientCode || session.clientName || 'Client',
        projectId: session.projectId,
        shareToken: session.shareToken,
        contactPerson: payload.contactPerson || null,
        contactPhone: payload.contactPhone || null,
        additionalRequirements: payload.additionalRequirements || '',
        answers: payload.answers,
      });

      setSubmittedResult({
        docId: res.submissionId,
        masterDocId: payload.clientCode || session.clientName || 'Client',
        answers: payload.answers,
        additionalRequirements: payload.additionalRequirements,
      });
    } catch (err: any) {
      console.error('Submission failed:', err);
      setSubmitError(err.message || 'Submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLockSession = () => {
    clearFormSession(publicFormId);
    setSession(null);
    setPin('');
    setQuestionnaire(null);
    setSubmittedResult(null);
  };

  // ---------------------------------------------------------------------------
  // 1. Loading Metadata
  // ---------------------------------------------------------------------------
  if (loadingInfo) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-stone-600 text-sm font-medium">
          <div className="w-5 h-5 border-2 border-stone-800 border-t-transparent rounded-full animate-spin" />
          <span>Verifying public form link...</span>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 2. Error / Not Found Metadata
  // ---------------------------------------------------------------------------
  if (infoError || !formInfo) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center mx-auto border border-rose-200/60">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-stone-900">Form Not Available</h2>
          <p className="text-xs text-stone-600 leading-relaxed">
            {infoError || 'This form identifier could not be verified.'}
          </p>
          <div className="pt-4 border-t border-stone-100 flex flex-col gap-2">
            <button
              type="button"
              onClick={onBackToHome}
              className="w-full py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-xs"
            >
              Return to ReqForge Home
            </button>
            <button
              type="button"
              onClick={onOpenAdmin}
              className="w-full py-2 text-xs text-stone-500 hover:text-stone-900 underline underline-offset-4 cursor-pointer"
            >
              Admin Portal
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 3. Inactive / Closed / Revoked Form Status
  // ---------------------------------------------------------------------------
  if (formInfo.status !== 'active') {
    const isRevoked = formInfo.status === 'revoked';
    const isClosed = formInfo.status === 'closed';

    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm max-w-md w-full text-center space-y-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto border ${
              isRevoked
                ? 'bg-rose-50 text-rose-700 border-rose-200/60'
                : isClosed
                ? 'bg-stone-100 text-stone-700 border-stone-200'
                : 'bg-amber-50 text-amber-700 border-amber-200/60'
            }`}
          >
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-stone-900">
            {isRevoked ? 'Access Revoked' : isClosed ? 'Form Closed' : 'Form Temporarily Disabled'}
          </h2>
          <p className="text-xs text-stone-600 leading-relaxed">
            {isRevoked
              ? 'Access to this questionnaire has been revoked by the project administrator.'
              : isClosed
              ? 'This questionnaire is closed and no longer accepting submissions.'
              : 'This questionnaire form has been paused by the project administrator.'}
          </p>
          <p className="text-[11px] text-stone-400">
            Please reach out to your project contact if you have questions.
          </p>
          <div className="pt-4 border-t border-stone-100 flex flex-col gap-2">
            <button
              type="button"
              onClick={onBackToHome}
              className="w-full py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-xs"
            >
              Return to ReqForge Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 4. Submitted Confirmation Screen
  // ---------------------------------------------------------------------------
  if (submittedResult) {
    return (
      <div className="min-h-screen bg-stone-50 text-stone-900 font-sans pb-12">
        <header className="bg-white border-b border-stone-200 py-3 px-4 shadow-xs">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-stone-900 text-white flex items-center justify-center font-bold text-sm">
                RF
              </div>
              <div>
                <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider block">
                  Requirements Intake Submitted
                </span>
                <span className="text-sm font-bold text-stone-900 leading-tight block">
                  {formInfo.title}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLockSession}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Exit</span>
            </button>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 mt-6">
          <SuccessView
            docId={submittedResult.docId}
            masterDocId={submittedResult.masterDocId}
            clientCode={session?.clientName || formInfo.clientName || 'Client'}
            projectName={session?.projectName || formInfo.projectName}
            sections={questionnaire?.sections || []}
            answers={submittedResult.answers || {}}
            additionalRequirements={submittedResult.additionalRequirements || ''}
            onReset={() => {
              // Post-submission editing is prohibited
              handleLockSession();
            }}
          />
        </main>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 5. PIN Prompt View (if not yet authenticated)
  // ---------------------------------------------------------------------------
  if (!session) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col justify-between selection:bg-stone-900 selection:text-white">
        <header className="bg-white/80 backdrop-blur-md border-b border-stone-200 py-3 px-4">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <button
              type="button"
              onClick={onBackToHome}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
            </button>

            <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">
              Client Portal
            </span>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white p-6 sm:p-8 rounded-3xl border border-stone-200 shadow-xl shadow-stone-200/50 space-y-6">
            {/* Header info */}
            <div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center mb-4 border border-amber-200/60">
                <KeyRound className="w-6 h-6" />
              </div>

              <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight leading-snug">
                {formInfo.title}
              </h1>

              {formInfo.projectName && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-600 mt-1">
                  <FolderKanban className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  <span>Project: {formInfo.projectName}</span>
                </div>
              )}

              {formInfo.description && (
                <p className="text-xs text-stone-600 mt-2.5 leading-relaxed">
                  {formInfo.description}
                </p>
              )}
            </div>

            {/* Instructions box */}
            {formInfo.instructions && (
              <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 text-xs text-stone-600 leading-relaxed">
                <div className="font-bold text-stone-800 mb-1 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-stone-500" />
                  <span>Instructions</span>
                </div>
                {formInfo.instructions}
              </div>
            )}

            {/* PIN entry form */}
            <form onSubmit={handleVerifyPin} className="space-y-4 pt-1">
              <div>
                <label
                  htmlFor="pin-input"
                  className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5"
                >
                  Enter Access PIN
                </label>

                <div className="relative">
                  <input
                    id="pin-input"
                    type={showPin ? 'text' : 'password'}
                    value={pin}
                    onChange={(e) => {
                      setPin(e.target.value);
                      if (pinError) setPinError(null);
                    }}
                    placeholder="Enter PIN supplied by administrator"
                    autoFocus
                    className={`w-full pl-3.5 pr-10 py-3 bg-stone-50 focus:bg-white border text-base font-mono tracking-widest text-stone-900 rounded-xl focus:outline-none focus:ring-2 transition-all ${
                      pinError
                        ? 'border-rose-300 focus:ring-rose-500/20'
                        : 'border-stone-300 focus:border-stone-800 focus:ring-stone-900/15'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
                    title={showPin ? 'Hide PIN' : 'Show PIN'}
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {pinError && (
                  <p className="mt-1.5 text-xs text-rose-600 font-medium">
                    {pinError}
                  </p>
                )}
                <p className="mt-1.5 text-[11px] text-stone-400">
                  PIN is verified securely without exposing plain credentials.
                </p>
              </div>

              <button
                type="submit"
                disabled={verifyingPin}
                className="w-full py-3 px-4 bg-stone-900 hover:bg-stone-800 active:bg-stone-950 text-white rounded-xl text-xs sm:text-sm font-bold tracking-wide transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-stone-900/10 active:scale-[0.99] disabled:opacity-50"
              >
                {verifyingPin ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verifying Access PIN...</span>
                  </>
                ) : (
                  <>
                    <span>Unlock Questionnaire</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </main>

        <footer className="py-4 text-center text-xs text-stone-400">
          ReqForge Secure Client Requirements Portal
        </footer>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 6. Loading Questionnaire Definition
  // ---------------------------------------------------------------------------
  if (loadingQuestionnaire || !questionnaire) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4 text-center">
        {questionnaireError ? (
          <div className="bg-white p-8 rounded-2xl border border-stone-200 shadow-sm max-w-md w-full space-y-4">
            <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
            <h3 className="text-base font-bold text-stone-900">Error Loading Questionnaire</h3>
            <p className="text-xs text-stone-600">{questionnaireError}</p>
            <button
              type="button"
              onClick={handleLockSession}
              className="px-4 py-2 bg-stone-900 text-white text-xs font-semibold rounded-xl"
            >
              Back to Verification
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-stone-600 text-sm font-medium">
            <div className="w-5 h-5 border-2 border-stone-800 border-t-transparent rounded-full animate-spin" />
            <span>Loading questionnaire content...</span>
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 7. Full Questionnaire View (Uses generic QuestionnaireForm renderer)
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans flex flex-col justify-between">
      {/* Questionnaire Context Top Banner */}
      <div className="bg-stone-900 text-white py-2 px-4 text-xs font-medium flex items-center justify-between border-b border-stone-800">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="font-bold">{formInfo.title}</span>
          {session.projectName && (
            <span className="text-stone-300 hidden sm:inline">&bull; {session.projectName}</span>
          )}
        </div>
        <button
          type="button"
          onClick={handleLockSession}
          className="inline-flex items-center gap-1 text-stone-400 hover:text-white transition-colors cursor-pointer"
          title="Lock form session"
        >
          <Lock className="w-3 h-3" />
          <span>Lock Form</span>
        </button>
      </div>

      <QuestionnaireForm
        questionnaire={questionnaire}
        clientCode={session.clientName || formInfo.clientName || 'Client'}
        projectName={session.projectName || formInfo.projectName}
        projectId={session.projectId}
        shareToken={session.shareToken}
        initialAnswers={initialAnswers}
        onSaveDraft={handleSaveDraft}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        submitError={submitError}
      />

      {/* Footer */}
      <footer className="pb-8 pt-4 text-center text-xs text-stone-400">
        ReqForge Client Questionnaire &bull; Responses saved securely to encrypted project record
      </footer>
    </div>
  );
};
