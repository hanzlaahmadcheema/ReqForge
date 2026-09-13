/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AlertCircle, Lock } from 'lucide-react';
import { Questionnaire, QuestionnaireAnswers, Project, Client, AdminRecord } from './types';
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
import { GuestHomePage } from './components/public/GuestHomePage';
import { PublicFormPortal } from './components/public/PublicFormPortal';

const STORAGE_KEY = 'client_requirements_draft_v1';

export type AppRoute =
  | { type: 'admin' }
  | { type: 'publicForm'; publicFormId: string }
  | { type: 'projectShare' }
  | { type: 'home' };

export const parseCurrentRoute = (): AppRoute => {
  try {
    const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
    const hash = window.location.hash.toLowerCase();
    const search = window.location.search;
    const params = new URLSearchParams(search);

    // 1. Admin route
    if (
      pathname === '/admin' ||
      pathname.endsWith('/admin') ||
      hash === '#admin' ||
      params.get('view') === 'admin'
    ) {
      return { type: 'admin' };
    }

    // 2. Public Form route: /form/:publicId or ?form=:publicId
    if (pathname.startsWith('/form/')) {
      const publicId = pathname.slice('/form/'.length).split('/')[0];
      if (publicId) {
        return { type: 'publicForm', publicFormId: publicId };
      }
    }
    const formParam = params.get('form');
    if (formParam) {
      return { type: 'publicForm', publicFormId: formParam.trim() };
    }

    // 3. Phase 2 Direct Project Share Link: ?project=...&token=...
    const hasProject = params.get('project') || params.get('projectId');
    if (hasProject) {
      return { type: 'projectShare' };
    }

    // 4. Default Guest Home Page: /
    return { type: 'home' };
  } catch {
    return { type: 'home' };
  }
};

export default function App() {
  const [route, setRoute] = useState<AppRoute>(parseCurrentRoute);
  const [currentAdmin, setCurrentAdmin] = useState<AdminRecord | null>(null);
  const [adminAuthLoading, setAdminAuthLoading] = useState<boolean>(true);

  const navigateTo = (path: string, newRoute: AppRoute) => {
    try {
      window.history.pushState({}, '', path);
    } catch {
      // Ignore
    }
    setRoute(newRoute);
  };

  // Dynamic Questionnaire Data State (pure database-driven, null until loaded)
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [isQuestionnaireLoading, setIsQuestionnaireLoading] = useState<boolean>(true);

  // Subscribe to verified Firebase admin authentication & allowlist state
  useEffect(() => {
    const unsubscribe = subscribeToAdminAuth((_user, adminRecord, loading) => {
      setCurrentAdmin(adminRecord);
      setAdminAuthLoading(loading);
    });
    return () => unsubscribe();
  }, []);

  // Sync route with browser history URL changes
  useEffect(() => {
    const handleUrlChange = () => {
      setRoute(parseCurrentRoute());
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
    const params = new URLSearchParams(window.location.search);
    const hasProject = params.get('project') || params.get('projectId');
    // If arriving via share link, the link-verification effect handles loading the specific project questionnaire
    if (!hasProject) {
      getQuestionnaire()
        .then((loadedQ) => {
          if (loadedQ) {
            setQuestionnaire(loadedQ);
          }
        })
        .catch((err) => {
          console.warn('Could not load questionnaire from service:', err);
        })
        .finally(() => {
          setIsQuestionnaireLoading(false);
        });
    }
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
      const rawQuestionnaireId = params.get('questionnaire');

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

          // Determine target questionnaire: URL override, matching assignment, or project primary
          let targetQId = rawQuestionnaireId?.trim();
          let targetQVer = proj.questionnaireVersion;

          if (targetQId && proj.assignedQuestionnaires) {
            const match = proj.assignedQuestionnaires.find(
              (a) => a.questionnaireId === targetQId
            );
            if (match) {
              targetQVer = match.questionnaireVersion;
            }
          } else if (!targetQId) {
            targetQId =
              proj.questionnaireId ||
              proj.assignedQuestionnaireId ||
              proj.assignedQuestionnaires?.[0]?.questionnaireId;
          }

          if (targetQId) {
            const loadedQ = await getQuestionnaire(targetQId);
            if (loadedQ) {
              if (targetQVer && targetQVer !== loadedQ.version) {
                const snapshot = await getQuestionnaireVersionSnapshot(
                  targetQId,
                  targetQVer
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
          setIsQuestionnaireLoading(false);
        });
    } catch {
      setLinkSecurityError('Invalid request parameters.');
      setIsQuestionnaireLoading(false);
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
      const qId = questionnaire?.id || 'general';
      const qVer = questionnaire?.version || 1;

      const result = await saveQuestionnaireSubmission({
        existingSubmissionId: payload.existingDraftId,
        questionnaireId: qId,
        questionnaireVersion: qVer,
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
    const qId = questionnaire?.id || 'general';
    const qVer = questionnaire?.version || 1;

    const res = await saveQuestionnaireDraft({
      existingSubmissionId: payload.existingDraftId,
      questionnaireId: qId,
      questionnaireVersion: qVer,
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
  if (route.type === 'admin') {
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
            navigateTo('/', { type: 'home' });
          }}
        />
      );
    }

    return (
      <AdminPanel
        sections={questionnaire?.sections || []}
        defaultClientCode={clientCode !== 'Default Client' ? clientCode : undefined}
        onBackToForm={() => {
          navigateTo('/', { type: 'home' });
        }}
        onLock={async () => {
          await signOutAdmin();
          setCurrentAdmin(null);
        }}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // Public Form Portal (URL: /form/:publicId or ?form=:publicId)
  // ---------------------------------------------------------------------------
  if (route.type === 'publicForm') {
    return (
      <PublicFormPortal
        publicFormId={route.publicFormId}
        onBackToHome={() => navigateTo('/', { type: 'home' })}
        onOpenAdmin={() => navigateTo('/admin', { type: 'admin' })}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // Public Guest Home Page (URL: /)
  // ---------------------------------------------------------------------------
  if (route.type === 'home') {
    return (
      <GuestHomePage
        onAccessForm={(formId) =>
          navigateTo(`/form/${formId}`, { type: 'publicForm', publicFormId: formId })
        }
        onOpenAdmin={() => navigateTo('/admin', { type: 'admin' })}
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
            sections={questionnaire?.sections || []}
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
  if (isVerifyingLink || (isQuestionnaireLoading && (projectId || window.location.search.includes('project')))) {
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
                navigateTo('/admin', { type: 'admin' });
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
                navigateTo('/admin', { type: 'admin' });
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

  // If questionnaire is loading (generic root view)
  if (isQuestionnaireLoading) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4 text-center">
        <div className="flex items-center gap-2.5 text-stone-600 text-sm font-medium">
          <div className="w-5 h-5 border-2 border-stone-800 border-t-transparent rounded-full animate-spin" />
          <span>Loading requirements questionnaire...</span>
        </div>
      </div>
    );
  }

  // If zero questionnaires exist in Firestore or none is published
  if (!questionnaire) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-white p-8 rounded-2xl border border-stone-200 shadow-sm max-w-md w-full space-y-4">
          <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-700 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-stone-900">Requirements Platform</h2>
          <p className="text-xs text-stone-600 leading-relaxed">
            No questionnaire template is currently published for public access.
          </p>
          <p className="text-xs text-stone-500">
            To create, import, or publish questionnaires, open the Admin Console.
          </p>
          <div className="pt-4 border-t border-stone-100 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => {
                navigateTo('/admin', { type: 'admin' });
              }}
              className="px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors shadow-xs"
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
            navigateTo('/admin', { type: 'admin' });
          }}
          className="hover:text-stone-700 underline underline-offset-4 cursor-pointer transition-colors"
        >
          Open Admin Management Console
        </button>
      </footer>
    </div>
  );
}
