import React from 'react';
import {
  Users,
  FolderKanban,
  FileQuestion,
  FileCheck2,
  Clock,
  ArrowUpRight,
  Plus,
  Share2,
  Building2,
  ExternalLink,
  FileDown,
} from 'lucide-react';
import { Client, Project, Questionnaire, Submission } from '../../types';

interface DashboardViewProps {
  clients: Client[];
  projects: Project[];
  questionnaires: Questionnaire[];
  submissions: Submission[];
  onNavigateTab: (tab: 'clients' | 'projects' | 'questionnaires' | 'submissions') => void;
  onOpenNewClient: () => void;
  onOpenNewProject: () => void;
  onOpenShareLink: (project: Project) => void;
  onViewSubmission: (sub: Submission) => void;
  onDownloadPdf: (sub: Submission) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  clients,
  projects,
  questionnaires,
  submissions,
  onNavigateTab,
  onOpenNewClient,
  onOpenNewProject,
  onOpenShareLink,
  onViewSubmission,
  onDownloadPdf,
}) => {
  const activeProjects = projects.filter((p) => p.status === 'active');
  const pendingSubmissions = submissions.filter((s) => s.status === 'draft');
  const completedSubmissions = submissions.filter((s) => s.status !== 'draft');

  // Client lookup map
  const clientMap = new Map<string, Client>();
  clients.forEach((c) => clientMap.set(c.id, c));

  const projectMap = new Map<string, Project>();
  projects.forEach((p) => projectMap.set(p.id, p));

  const recentProjects = projects.slice(0, 5);
  const recentSubmissions = submissions.slice(0, 5);

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* Metrics Row (2-column on mobile, 5-column on desktop) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-4">
        {/* Metric 1: Total Clients */}
        <div
          onClick={() => onNavigateTab('clients')}
          className="bg-white p-3.5 sm:p-5 rounded-2xl border border-stone-200/90 shadow-2xs hover:border-stone-400/80 transition-all cursor-pointer group active:scale-[0.98]"
        >
          <div className="flex items-center justify-between text-stone-500 mb-2 sm:mb-3">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-stone-500">Clients</span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-stone-100 group-hover:bg-stone-900 group-hover:text-white transition-colors">
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black text-stone-900 tabular-nums">{clients.length}</span>
            <span className="text-[10px] sm:text-xs text-stone-400 font-medium tabular-nums">
              {clients.filter((c) => c.status === 'active').length} active
            </span>
          </div>
        </div>

        {/* Metric 2: Active Projects */}
        <div
          onClick={() => onNavigateTab('projects')}
          className="bg-white p-3.5 sm:p-5 rounded-2xl border border-stone-200/90 shadow-2xs hover:border-stone-400/80 transition-all cursor-pointer group active:scale-[0.98]"
        >
          <div className="flex items-center justify-between text-stone-500 mb-2 sm:mb-3">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-stone-500">Projects</span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-stone-100 group-hover:bg-stone-900 group-hover:text-white transition-colors">
              <FolderKanban className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black text-stone-900 tabular-nums">{activeProjects.length}</span>
            <span className="text-[10px] sm:text-xs text-stone-400 font-medium tabular-nums">{projects.length} total</span>
          </div>
        </div>

        {/* Metric 3: Questionnaires */}
        <div
          onClick={() => onNavigateTab('questionnaires')}
          className="bg-white p-3.5 sm:p-5 rounded-2xl border border-stone-200/90 shadow-2xs hover:border-stone-400/80 transition-all cursor-pointer group active:scale-[0.98]"
        >
          <div className="flex items-center justify-between text-stone-500 mb-2 sm:mb-3">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-stone-500">Templates</span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-stone-100 group-hover:bg-stone-900 group-hover:text-white transition-colors">
              <FileQuestion className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black text-stone-900 tabular-nums">{questionnaires.length}</span>
            <span className="text-[10px] sm:text-xs text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full font-bold tabular-nums">
              {questionnaires.filter((q) => q.status === 'published').length} pub
            </span>
          </div>
        </div>

        {/* Metric 4: Incomplete / Draft Submissions */}
        <div
          onClick={() => onNavigateTab('submissions')}
          className="bg-white p-3.5 sm:p-5 rounded-2xl border border-stone-200/90 shadow-2xs hover:border-stone-400/80 transition-all cursor-pointer group active:scale-[0.98]"
        >
          <div className="flex items-center justify-between text-stone-500 mb-2 sm:mb-3">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-stone-500">In Progress</span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-stone-100 group-hover:bg-stone-900 group-hover:text-white transition-colors">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black text-stone-900 tabular-nums">{pendingSubmissions.length}</span>
            <span className="text-[10px] sm:text-xs text-stone-400 font-medium tabular-nums">drafts</span>
          </div>
        </div>

        {/* Metric 5: Completed Submissions (Full width on 2-column mobile) */}
        <div
          onClick={() => onNavigateTab('submissions')}
          className="col-span-2 sm:col-span-1 bg-white p-3.5 sm:p-5 rounded-2xl border border-stone-200/90 shadow-2xs hover:border-stone-400/80 transition-all cursor-pointer group active:scale-[0.98]"
        >
          <div className="flex items-center justify-between text-stone-500 mb-2 sm:mb-3">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-stone-500">Verified Submissions</span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-50 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <FileCheck2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-black text-emerald-800 tabular-nums">{completedSubmissions.length}</span>
            <span className="text-[10px] sm:text-xs text-emerald-600 font-bold tabular-nums">ready</span>
          </div>
        </div>
      </div>

      {/* Zero data onboarding banner */}
      {clients.length === 0 && projects.length === 0 && questionnaires.length === 0 && (
        <div className="bg-white rounded-2xl border-2 border-dashed border-stone-300 p-8 text-center space-y-4 shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-800 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-stone-900">Welcome to your Requirements Platform</h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              The platform is completely database-driven with zero pre-populated demo records. Get started by creating your first client or questionnaire template.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onOpenNewClient}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Create your first client</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('questionnaires')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-stone-300 hover:bg-stone-50 text-stone-800 text-xs font-bold transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create questionnaire</span>
            </button>
          </div>
        </div>
      )}

      {/* Quick Actions & System Hierarchy */}
      <div className="bg-gradient-to-r from-stone-900 to-stone-800 rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1 max-w-xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white/10 text-white text-[11px] font-semibold tracking-wide">
            <span>Management Architecture</span>
          </div>
          <h2 className="text-lg font-bold tracking-tight">Clients → Projects → Questionnaires → Submissions</h2>
          <p className="text-xs text-stone-300 leading-relaxed">
            Organize clients, bind customized projects to dynamic questionnaires, generate instant client-facing links, and inspect submitted requirements.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenNewClient}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white text-stone-900 hover:bg-stone-100 text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>New Client</span>
          </button>
          <button
            type="button"
            onClick={onOpenNewProject}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-stone-700 hover:bg-stone-600 text-white text-xs font-bold transition-colors cursor-pointer border border-stone-600"
          >
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* Dual Columns: Recent Projects & Recent Submissions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Column 1: Projects & Share Links */}
        <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-stone-900">Projects with Active Questionnaires</h3>
              <p className="text-xs text-stone-500">Quickly copy client questionnaire links</p>
            </div>
            <button
              onClick={() => onNavigateTab('projects')}
              className="text-xs font-semibold text-stone-600 hover:text-stone-900 inline-flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {recentProjects.length === 0 ? (
              <div className="text-center py-8 text-xs text-stone-400">No projects found. Create one to get started.</div>
            ) : (
              recentProjects.map((project) => {
                const client = clientMap.get(project.clientId);
                return (
                  <div
                    key={project.id}
                    className="p-3.5 rounded-xl border border-stone-100 hover:border-stone-300/80 bg-stone-50/50 hover:bg-white transition-all flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-stone-900 truncate block">{project.name}</span>
                        <span className="text-[10px] font-medium px-2 py-0.2 rounded-full bg-stone-200/80 text-stone-700">
                          {project.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-stone-500 mt-0.5 truncate">
                        <Building2 className="w-3 h-3 text-stone-400 shrink-0" />
                        <span className="truncate">{client?.name || 'Assigned Client'}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenShareLink(project)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shrink-0 cursor-pointer shadow-2xs transition-colors"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share Link</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Column 2: Recent Submissions */}
        <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-stone-900">Recent Requirements Submissions</h3>
              <p className="text-xs text-stone-500">Latest completed client forms</p>
            </div>
            <button
              onClick={() => onNavigateTab('submissions')}
              className="text-xs font-semibold text-stone-600 hover:text-stone-900 inline-flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {recentSubmissions.length === 0 ? (
              <div className="text-center py-8 text-xs text-stone-400">No submissions recorded yet.</div>
            ) : (
              recentSubmissions.map((sub) => {
                const date = new Date(sub.submittedAtIso).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });
                const project = sub.projectId ? projectMap.get(sub.projectId) : undefined;

                return (
                  <div
                    key={sub.id}
                    className="p-3.5 rounded-xl border border-stone-100 hover:border-stone-300/80 bg-stone-50/50 hover:bg-white transition-all flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-stone-900 truncate block">
                          {sub.clientCode || 'Client Submission'}
                        </span>
                        {project && (
                          <span className="text-[10px] px-1.5 py-0.2 bg-blue-50 text-blue-700 font-medium rounded">
                            {project.name}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-stone-400 block mt-0.5">Submitted on {date}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onViewSubmission(sub)}
                        className="px-2.5 py-1.5 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-100 text-xs font-semibold cursor-pointer transition-colors"
                      >
                        Inspect
                      </button>
                      <button
                        type="button"
                        onClick={() => onDownloadPdf(sub)}
                        className="p-1.5 rounded-lg border border-stone-200 text-stone-600 hover:text-stone-900 hover:bg-stone-100 cursor-pointer transition-colors"
                        title="Download PDF"
                      >
                        <FileDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
