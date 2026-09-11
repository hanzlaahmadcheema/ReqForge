import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  FileQuestion,
  FileCheck2,
  ArrowLeft,
  LogOut,
  RefreshCw,
  Plus,
  Share2,
} from 'lucide-react';
import {
  Client,
  Project,
  Questionnaire,
  Submission,
  QuestionnaireSection,
} from '../types';
import {
  fetchClients,
  createClient,
  updateClient,
  archiveClient,
  fetchProjects,
  createProject,
  updateProject,
  archiveProject,
  assignQuestionnaireToProject,
  fetchQuestionnaires,
  fetchSubmissions,
  deleteSubmission,
} from '../lib/managementService';
import { updateSubmissionStatus } from '../lib/questionnaireService';
import { DashboardView } from './management/DashboardView';
import { ClientsView } from './management/ClientsView';
import { ProjectsView } from './management/ProjectsView';
import { QuestionnairesView } from './management/QuestionnairesView';
import { SubmissionsView } from './management/SubmissionsView';
import { ShareLinkModal } from './management/ShareLinkModal';
import { SubmissionDetailModal } from './SubmissionDetailModal';
import { generateQuestionnairePdf } from '../lib/generatePdf';
import { reconstructAnswersFromSubmission } from '../lib/firebase';

interface AdminPanelProps {
  sections: QuestionnaireSection[];
  onBackToForm: () => void;
  onLock?: () => void;
  defaultClientCode?: string;
  defaultTab?: 'dashboard' | 'clients' | 'projects' | 'questionnaires' | 'submissions';
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  sections,
  onBackToForm,
  onLock,
  defaultTab = 'dashboard',
}) => {
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'clients' | 'projects' | 'questionnaires' | 'submissions'
  >(defaultTab);

  // Data state
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Modals & Inspection states
  const [shareLinkProject, setShareLinkProject] = useState<Project | null>(null);
  const [inspectSubmission, setInspectSubmission] = useState<Submission | null>(null);
  const [selectedProjectIdForNav, setSelectedProjectIdForNav] = useState<string | null>(null);

  // Quick action trigger states
  const [triggerNewClient, setTriggerNewClient] = useState<boolean>(false);
  const [triggerNewProjectClientId, setTriggerNewProjectClientId] = useState<string | null>(null);

  // Load all data
  const loadAllData = async () => {
    try {
      setError(null);
      const [fetchedClients, fetchedProjects, fetchedQuestionnaires, fetchedSubmissions] =
        await Promise.all([
          fetchClients(),
          fetchProjects(),
          fetchQuestionnaires(),
          fetchSubmissions(),
        ]);

      setClients(fetchedClients);
      setProjects(fetchedProjects);
      setQuestionnaires(fetchedQuestionnaires);
      setSubmissions(fetchedSubmissions);
    } catch (err: unknown) {
      console.error('Error loading management data:', err);
      const msg = err instanceof Error ? err.message : 'Failed to load management layer data';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadAllData();
  };

  // Client Operations
  const handleCreateClient = async (data: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newClient = await createClient(data);
    setClients((prev) => [newClient, ...prev]);
  };

  const handleUpdateClient = async (
    id: string,
    data: Partial<Omit<Client, 'id' | 'createdAt'>>
  ) => {
    await updateClient(id, data);
    setClients((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...data, updatedAt: new Date().toISOString() } : c))
    );
  };

  const handleArchiveClient = async (id: string, archive: boolean) => {
    await archiveClient(id, archive);
    setClients((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, status: archive ? 'archived' : 'active', updatedAt: new Date().toISOString() }
          : c
      )
    );
  };

  // Project Operations
  const handleCreateProject = async (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newProj = await createProject(data);
    setProjects((prev) => [newProj, ...prev]);
  };

  const handleUpdateProject = async (
    id: string,
    data: Partial<Omit<Project, 'id' | 'createdAt'>>
  ) => {
    await updateProject(id, data);
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p))
    );
  };

  const handleArchiveProject = async (id: string, archive: boolean) => {
    await archiveProject(id, archive);
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, status: archive ? 'archived' : 'active', updatedAt: new Date().toISOString() }
          : p
      )
    );
  };

  const handleAssignQuestionnaire = async (projectId: string, questionnaireId: string) => {
    await assignQuestionnaireToProject(projectId, questionnaireId);
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? {
              ...p,
              questionnaireId,
              assignedQuestionnaireId: questionnaireId,
              updatedAt: new Date().toISOString(),
            }
          : p
      )
    );
  };

  // Submission Operations
  const handleStatusChange = async (
    id: string,
    newStatus: 'draft' | 'submitted' | 'reviewed' | 'archived'
  ) => {
    await updateSubmissionStatus(id, newStatus);
    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              status: newStatus,
              reviewedAt: newStatus === 'reviewed' ? new Date().toISOString() : s.reviewedAt,
              updatedAt: new Date().toISOString(),
            }
          : s
      )
    );
    if (inspectSubmission?.id === id) {
      setInspectSubmission({
        ...inspectSubmission,
        status: newStatus,
        reviewedAt: newStatus === 'reviewed' ? new Date().toISOString() : inspectSubmission.reviewedAt,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  const handleDeleteSubmission = async (id: string) => {
    await deleteSubmission(id);
    setSubmissions((prev) => prev.filter((s) => s.id !== id));
    if (inspectSubmission?.id === id) {
      setInspectSubmission(null);
    }
  };

  // PDF Export helper
  const handleDownloadPdf = (sub: Submission) => {
    try {
      const answers = reconstructAnswersFromSubmission(sub);
      const project = sub.projectId ? projects.find((p) => p.id === sub.projectId) : undefined;

      generateQuestionnairePdf({
        clientCode: sub.clientCode,
        projectName: project?.name,
        contactPerson: sub.contactPerson || undefined,
        contactPhone: sub.contactPhone || undefined,
        additionalRequirements: sub.additionalRequirements || undefined,
        sections,
        answers,
        isSubmitted: true,
        submissionDocId: sub.submissionDocId || sub.id,
      });
    } catch (err) {
      console.error('Error generating PDF:', err);
    }
  };

  interface NavTabItem {
    id: 'dashboard' | 'clients' | 'projects' | 'questionnaires' | 'submissions';
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }

  const navTabs: NavTabItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'clients', label: 'Clients', icon: Users, count: clients.length },
    { id: 'projects', label: 'Projects', icon: FolderKanban, count: projects.length },
    { id: 'questionnaires', label: 'Questionnaires', icon: FileQuestion, count: questionnaires.length },
    { id: 'submissions', label: 'Submissions', icon: FileCheck2, count: submissions.length },
  ];

  return (
    <div id="admin-management-panel" className="min-h-screen bg-stone-100/90 text-stone-900 pb-16">
      {/* Top Sticky Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand and Status */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToForm}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Form</span>
            </button>
            <div className="h-5 w-px bg-stone-200 hidden sm:block" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-stone-900 tracking-tight">
                  Requirements Management Layer
                </h1>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Firestore Connected
                </span>
              </div>
              <p className="text-xs text-stone-500 hidden sm:block">
                Manage Clients, Projects, Questionnaires, and Submissions
              </p>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {onLock && (
              <button
                type="button"
                onClick={onLock}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg cursor-pointer transition-colors"
                title="Sign out of admin console"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            )}
          </div>
        </div>

        {/* Primary Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 overflow-x-auto border-t border-stone-100">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'border-stone-900 text-stone-900'
                    : 'border-transparent text-stone-500 hover:text-stone-800 hover:border-stone-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                      isActive ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-stone-400 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-stone-500" />
            <span className="text-xs font-semibold">Loading management data from Firestore...</span>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">
            <strong>Error loading data:</strong> {error}
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardView
                clients={clients}
                projects={projects}
                questionnaires={questionnaires}
                submissions={submissions}
                onNavigateTab={(tab) => setActiveTab(tab)}
                onOpenNewClient={() => setActiveTab('clients')}
                onOpenNewProject={() => setActiveTab('projects')}
                onOpenShareLink={(project) => setShareLinkProject(project)}
                onViewSubmission={(sub) => setInspectSubmission(sub)}
                onDownloadPdf={handleDownloadPdf}
              />
            )}

            {activeTab === 'clients' && (
              <ClientsView
                clients={clients}
                projects={projects}
                submissions={submissions}
                onCreateClient={handleCreateClient}
                onUpdateClient={handleUpdateClient}
                onArchiveClient={handleArchiveClient}
                onCreateProjectForClient={(clientId) => {
                  setActiveTab('projects');
                }}
                onOpenShareLink={(project) => setShareLinkProject(project)}
                onViewSubmission={(sub) => setInspectSubmission(sub)}
                onDownloadPdf={handleDownloadPdf}
              />
            )}

            {activeTab === 'projects' && (
              <ProjectsView
                projects={projects}
                clients={clients}
                questionnaires={questionnaires}
                submissions={submissions}
                onCreateProject={handleCreateProject}
                onUpdateProject={handleUpdateProject}
                onArchiveProject={handleArchiveProject}
                onAssignQuestionnaire={handleAssignQuestionnaire}
                onOpenShareLink={(project) => setShareLinkProject(project)}
                onViewSubmission={(sub) => setInspectSubmission(sub)}
                onDownloadPdf={handleDownloadPdf}
                initialSelectedProjectId={selectedProjectIdForNav}
              />
            )}

            {activeTab === 'questionnaires' && (
              <QuestionnairesView
                questionnaires={questionnaires}
                projects={projects}
                clients={clients}
                onRefresh={loadAllData}
                onSelectProject={(projectId) => {
                  setSelectedProjectIdForNav(projectId);
                  setActiveTab('projects');
                }}
              />
            )}

            {activeTab === 'submissions' && (
              <SubmissionsView
                submissions={submissions}
                clients={clients}
                projects={projects}
                questionnaires={questionnaires}
                sections={sections}
                onDeleteSubmission={handleDeleteSubmission}
                onStatusChange={handleStatusChange}
              />
            )}
          </>
        )}
      </main>

      {/* Share Link Modal */}
      {shareLinkProject && (
        <ShareLinkModal
          project={shareLinkProject}
          client={clients.find((c) => c.id === shareLinkProject.clientId)}
          onClose={() => setShareLinkProject(null)}
          onProjectUpdated={(updated) => {
            setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            setShareLinkProject(updated);
          }}
        />
      )}

      {/* Full Answers Inspection Modal */}
      {inspectSubmission && (
        <SubmissionDetailModal
          submission={inspectSubmission}
          isOpen={true}
          onClose={() => setInspectSubmission(null)}
          sections={sections}
          questionnaire={questionnaires.find(
            (q) => q.id === (inspectSubmission.questionnaireId || inspectSubmission.formId)
          )}
          onStatusChange={handleStatusChange}
          onDelete={async (id) => {
            await handleDeleteSubmission(id);
          }}
        />
      )}
    </div>
  );
};
