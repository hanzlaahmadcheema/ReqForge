/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AlertCircle, Lock } from 'lucide-react';
import { Questionnaire, QuestionnaireAnswers, Project, Client, AdminRecord } from './types';
import { DEFAULT_QUESTIONNAIRE } from './data/defaultQuestionnaire';
import {
  getQuestionnaire,
  getQuestionnaireVersionSnapshot,
  saveQuestionnaireSubmission,
  saveQuestionnaireDraft,
} from './lib/questionnaireService';
import { getProject, getClient, getProjectByShareToken } from './lib/managementService';
import { subscribeToAdminAuth, signOutAdmin } from './lib/adminAuthService';
import { SuccessView } from './components/SuccessView';
import { AdminPanel } from './components/AdminPanel';
import { AdminPinPrompt } from './components/AdminPinPrompt';
import { QuestionnaireForm } from './components/QuestionnaireForm';

const STORAGE_KEY = 'client_requirements_draft_v1';

const checkIsAdminPath = () => {
  try {
    const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
    const hash = window.location.hash.toLowerCase();
    const search = window.location.search.toLowerCase();
    return (
      path === '/admin' ||
      path.endsWith('/admin') ||
      hash === '#admin' ||
      search.includes('view=admin')
    );
  } catch {
    return false;
  }
};

export default function App() {
  // Admin route detection from URL (/admin)
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(checkIsAdminPath);
  const [currentAdmin, setCurrentAdmin] = useState<AdminRecord | null>(null);
  const [adminAuthLoading, setAdminAuthLoading] = useState<boolean>(true);

  // Dynamic Questionnaire Data State
  const [questionnaire, setQuestionnaire] = useState<Questionnaire>(DEFAULT_QUESTIONNAIRE);

  // Subscribe to verified Firebase admin authentication & allowlist state
  useEffect(() => {
    const unsubscribe = subscribeToAdminAuth((_user, adminRecord, loading) => {
      setCurrentAdmin(adminRecord);
      setAdminAuthLoading(loading);
    });
    return () => unsubscribe();
  }, []);

  // Sync admin route with URL changes
  useEffect(() => {
    const handleUrlChange = () => {
      setIsAdminRoute(checkIsAdminPath());
    };
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  // Fetch questionnaire definition from service / Firestore
  useEffect(() => {
    getQuestionnaire()
      .then((loadedQ) => {
        if (loadedQ) {
          setQuestionnaire(loadedQ);
        }
      })
      .catch((err) => {
        console.warn('Could not load questionnaire from service:', err);
      });
  }, []);

  // Read initial client code from URL query (e.g. ?client=AcmeCorp)
  const [clientCode, setClientCode] = useState<string>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const c = params.get('client');
      return c ? c.trim() : 'Default Client';
    } catch {
      return 'Default Client';
    }
  });

  // Project & Client Context from Share Link (e.g. ?project=proj_xxx&token=st_xxx)
  const [projectId, setProjectId] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [linkSecurityError, setLinkSecurityError] = useState<string | null>(null);
  const [isVerifyingLink, setIsVerifyingLink] = useState<boolean>(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedResult, setSubmittedResult] = useState<{
    docId: string;
    masterDocId: string;
    answers?: QuestionnaireAnswers;
    additionalRequirements?: string;
  } | null>(null);

  // Load and verify project authorization from URL share link
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const rawProj = params.get('project') || params.get('projectId');
      const rawToken = params.get('token');

      // If neither is present, user is at base questionnaire
      if (!rawProj && !rawToken) {
        return;
      }

      // If a project parameter is specified, token is MANDATORY
      if (rawProj && !rawToken) {
        setLinkSecurityError(
          'Access denied. A valid project authorization token is required to access this questionnaire.'
        );
        return;
      }

      const cleanProjId = rawProj ? rawProj.trim() : '';
      const cleanToken = rawToken ? rawToken.trim() : '';

      if (!cleanProjId || !cleanToken) {
        setLinkSecurityError('Access denied. Invalid link parameters.');
        return;
      }

      setProjectId(cleanProjId);
      setShareToken(cleanToken);
      setIsVerifyingLink(true);

      getProjectByShareToken(cleanProjId, cleanToken)
        .then(async (result) => {
          if (!result || !result.project) {
            setLinkSecurityError(
              'This questionnaire link is invalid or has been revoked by the project administrator.'
            );
            return;
          }

          const proj = result.project;
          setActiveProject(proj);
          setClientId(proj.clientId);
          if (result.clientName) {
            setClientCode(result.clientName);
            setActiveClient({
              id: proj.clientId,
              name: result.clientName,
              contactPerson: '',
              contactEmail: '',
              status: 'active',
              createdAt: '',
              updatedAt: '',
            });
          }

          // If project has assigned questionnaire, load its schema (honoring immutable version snapshots)
          const qId = proj.questionnaireId || proj.assignedQuestionnaireId;
          if (qId) {
            const loadedQ = await getQuestionnaire(qId);
            if (loadedQ) {
              if (
                proj.questionnaireVersion &&
                proj.questionnaireVersion !== loadedQ.version
              ) {
                const snapshot = await getQuestionnaireVersionSnapshot(
                  qId,
                  proj.questionnaireVersion
                );
                if (snapshot) {
                  setQuestionnaire({
                    id: loadedQ.id,
                    title: snapshot.title || loadedQ.title,
                    description: snapshot.description || loadedQ.description,
                    version: snapshot.version,
                    status: 'published',
                    sections: snapshot.sections,
                    createdAt: snapshot.createdAt,
                    updatedAt: snapshot.publishedAt,
                  });
                  return;
                }
              }
              setQuestionnaire(loadedQ);
            }
          }
        })
        .catch((err) => {
          console.warn('Error verifying share link:', err);
          setLinkSecurityError(
            'This questionnaire link is invalid or has been revoked by the project administrator.'
          );
        })
        .finally(() => {
          setIsVerifyingLink(false);
        });
    } catch {
      setLinkSecurityError('Invalid request parameters.');
    }
  }, []);

  // Generic Submit handler
  const handleSubmit = async (payload: {
    clientCode: string;
    contactPerson: string;
    contactPhone: string;
    additionalRequirements: string;
    answers: QuestionnaireAnswers;
    existingDraftId?: string;
  }) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await saveQuestionnaireSubmission({
        existingSubmissionId: payload.existingDraftId,
        questionnaireId: questionnaire.id,
        questionnaireVersion: questionnaire.version,
        clientCode: payload.clientCode.trim() || activeClient?.name || clientCode,
        clientId: clientId || activeProject?.clientId || undefined,
        projectId: projectId || activeProject?.id || undefined,
        shareToken: shareToken || activeProject?.shareToken || undefined,
        contactPerson: payload.contactPerson.trim() || null,
        contactPhone: payload.contactPhone.trim() || null,
        additionalRequirements: payload.additionalRequirements.trim(),
        answers: payload.answers,
      });

      setSubmittedResult({
        docId: result.submissionId,
        masterDocId: payload.clientCode.trim() || activeClient?.name || clientCode,
        answers: payload.answers,
        additionalRequirements: payload.additionalRequirements,
      });

      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore
      }
    } catch (err: unknown) {
      console.error('Submission error:', err);
      const msg = err instanceof Error ? err.message : 'Unknown error saving submission';
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
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
    const res = await saveQuestionnaireDraft({
      existingSubmissionId: payload.existingDraftId,
      questionnaireId: questionnaire.id,
      questionnaireVersion: questionnaire.version,
      clientCode: payload.clientCode.trim() || activeClient?.name || clientCode,
      clientId: clientId || activeProject?.clientId || undefined,
      projectId: projectId || activeProject?.id || undefined,
      shareToken: shareToken || activeProject?.shareToken || undefined,
      contactPerson: payload.contactPerson.trim() || null,
      contactPhone: payload.contactPhone.trim() || null,
      additionalRequirements: payload.additionalRequirements.trim(),
      answers: payload.answers,
    });
    return res.submissionId;
  };

  // ---------------------------------------------------------------------------
  // Admin View (URL: /admin, protected by Google Sign-In & /admins/{uid} allowlist)
  // ---------------------------------------------------------------------------
  if (isAdminRoute) {
    if (adminAuthLoading) {
      return (
        <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
          <div className="flex items-center gap-2.5 text-stone-600 text-sm font-medium">
            <div className="w-5 h-5 border-2 border-stone-800 border-t-transparent rounded-full animate-spin" />
            <span>Verifying administrator authorization...</span>
          </div>
        </div>
      );
    }

    if (!currentAdmin) {
      return (
        <AdminPinPrompt
          onSuccess={(admin) => {
            setCurrentAdmin(admin);
          }}
          onCancel={() => {
            try {
              window.history.pushState({}, '', '/');
            } catch {
              // Ignore
            }
            setIsAdminRoute(false);
          }}
        />
      );
    }

    return (
      <AdminPanel
        sections={questionnaire.sections || []}
        defaultClientCode={clientCode !== 'Default Client' ? clientCode : undefined}
        onBackToForm={() => {
          try {
            window.history.pushState({}, '', '/');
          } catch {
            // Ignore
          }
          setIsAdminRoute(false);
        }}
        onLock={async () => {
          await signOutAdmin();
          setCurrentAdmin(null);
        }}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // Confirmation screen after submission
  // ---------------------------------------------------------------------------
  if (submittedResult) {
    return (
      <div className="min-h-screen bg-stone-50 text-stone-900 font-sans pb-12">
        <header className="bg-white border-b border-stone-200 py-3 px-4 shadow-xs">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-stone-900 text-white flex items-center justify-center font-bold text-sm">
                CR
              </div>
              <div>
                <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider block">
                  Requirements Gathering
                </span>
                <span className="text-sm font-bold text-stone-900 leading-tight block">
                  {activeClient?.name || clientCode}
                  {activeProject ? ` • ${activeProject.name}` : ''}
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 mt-6">
          <SuccessView
            docId={submittedResult.docId}
            masterDocId={submittedResult.masterDocId}
            clientCode={activeClient?.name || clientCode}
            projectName={activeProject?.name}
            sections={questionnaire.sections || []}
            answers={submittedResult.answers || {}}
            additionalRequirements={submittedResult.additionalRequirements || ''}
            onReset={() => {
              setSubmittedResult(null);
            }}
          />
        </main>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main Client Questionnaire View (Uses the unified QuestionnaireForm renderer)
  // ---------------------------------------------------------------------------

  // If link is actively being verified with Firestore
  if (isVerifyingLink) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4 text-center">
        <div className="flex items-center gap-2.5 text-stone-600 text-sm font-medium">
          <div className="w-5 h-5 border-2 border-stone-800 border-t-transparent rounded-full animate-spin" />
          <span>Verifying questionnaire authorization...</span>
        </div>
      </div>
    );
  }

  // If share link is missing token, invalid, or revoked, block access immediately without leaking project data
  if (linkSecurityError) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-white p-8 rounded-2xl border border-stone-200 shadow-sm max-w-md w-full space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-800 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-stone-900">Access Restricted</h2>
          <p className="text-xs text-stone-600 leading-relaxed">
            {linkSecurityError}
          </p>
          <p className="text-xs text-stone-500">
            Please make sure you are using the complete link with a valid token provided by your project contact.
          </p>
          <div className="pt-4 border-t border-stone-100">
            <button
              type="button"
              onClick={() => {
                try {
                  window.history.pushState({}, '', '/admin');
                } catch {
                  // Ignore
                }
                setIsAdminRoute(true);
              }}
              className="text-xs text-stone-500 hover:text-stone-900 underline underline-offset-4 cursor-pointer"
            >
              Open Admin Console
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If share link has been revoked by project administrator, prevent access
  if (activeProject && activeProject.shareLinkStatus === 'revoked') {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-white p-8 rounded-2xl border border-stone-200 shadow-sm max-w-md w-full space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-stone-900">Share Link Inactive</h2>
          <p className="text-xs text-stone-600 leading-relaxed">
            This questionnaire link has been deactivated by the project administrator.
          </p>
          <p className="text-xs text-stone-500">
            Form submissions are currently paused. Please reach out to your project contact if you need access.
          </p>
          <div className="pt-4 border-t border-stone-100">
            <button
              type="button"
              onClick={() => {
                try {
                  window.history.pushState({}, '', '/admin');
                } catch {
                  // Ignore
                }
                setIsAdminRoute(true);
              }}
              className="text-xs text-stone-500 hover:text-stone-900 underline underline-offset-4 cursor-pointer"
            >
              Open Admin Console
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans flex flex-col justify-between">
      <QuestionnaireForm
        questionnaire={questionnaire}
        clientCode={activeClient?.name || clientCode}
        projectName={activeProject?.name}
        clientId={clientId || undefined}
        projectId={projectId || undefined}
        shareToken={shareToken || activeProject?.shareToken || undefined}
        onSaveDraft={handleSaveDraft}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        submitError={submitError}
      />

      {/* Footer link to admin console */}
      <footer className="pb-8 pt-4 text-center text-xs text-stone-400">
        <button
          type="button"
          onClick={() => {
            try {
              window.history.pushState({}, '', '/admin');
            } catch {
              // Ignore
            }
            setIsAdminRoute(true);
          }}
          className="hover:text-stone-700 underline underline-offset-4 cursor-pointer transition-colors"
        >
          Open Admin Management Console
        </button>
      </footer>
    </div>
  );
}
