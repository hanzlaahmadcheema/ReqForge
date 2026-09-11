import React, { useState, useMemo } from 'react';
import {
  FolderKanban,
  Plus,
  Search,
  Building2,
  Share2,
  Edit2,
  Archive,
  RotateCcw,
  Eye,
  ArrowLeft,
  FileCheck2,
  FileQuestion,
  FileDown,
  X,
  ExternalLink,
  Check,
} from 'lucide-react';
import { Project, Client, Questionnaire, Submission } from '../../types';

interface ProjectsViewProps {
  projects: Project[];
  clients: Client[];
  questionnaires: Questionnaire[];
  submissions: Submission[];
  onCreateProject: (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateProject: (id: string, data: Partial<Omit<Project, 'id' | 'createdAt'>>) => Promise<void>;
  onArchiveProject: (id: string, archive: boolean) => Promise<void>;
  onAssignQuestionnaire: (projectId: string, questionnaireId: string) => Promise<void>;
  onOpenShareLink: (project: Project) => void;
  onViewSubmission: (sub: Submission) => void;
  onDownloadPdf: (sub: Submission) => void;
  initialSelectedProjectId?: string | null;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  clients,
  questionnaires,
  submissions,
  onCreateProject,
  onUpdateProject,
  onArchiveProject,
  onAssignQuestionnaire,
  onOpenShareLink,
  onViewSubmission,
  onDownloadPdf,
  initialSelectedProjectId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [clientFilter, setClientFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'archived'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name_asc'>('newest');

  const [selectedProject, setSelectedProject] = useState<Project | null>(() => {
    if (initialSelectedProjectId) {
      return projects.find((p) => p.id === initialSelectedProjectId) || null;
    }
    return null;
  });

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Form states
  const [formClientId, setFormClientId] = useState('');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formQuestionnaireId, setFormQuestionnaireId] = useState('');
  const [formStatus, setFormStatus] = useState<'active' | 'archived' | 'completed'>('active');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Client map
  const clientMap = new Map<string, Client>();
  clients.forEach((c) => clientMap.set(c.id, c));

  // Questionnaire map
  const questionnaireMap = new Map<string, Questionnaire>();
  questionnaires.forEach((q) => questionnaireMap.set(q.id, q));

  // Open Create
  const handleOpenCreate = () => {
    setFormClientId(clients[0]?.id || '');
    setFormName('');
    setFormDescription('');
    setFormQuestionnaireId(questionnaires[0]?.id || '');
    setFormStatus('active');
    setIsCreateModalOpen(true);
  };

  // Open Edit
  const handleOpenEdit = (project: Project) => {
    setEditingProject(project);
    setFormClientId(project.clientId);
    setFormName(project.name);
    setFormDescription(project.description || '');
    setFormQuestionnaireId(project.questionnaireId || project.assignedQuestionnaireId || questionnaires[0]?.id || '');
    setFormStatus(project.status);
  };

  // Submit form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formClientId) return;

    setFormSubmitting(true);
    try {
      if (editingProject) {
        await onUpdateProject(editingProject.id, {
          clientId: formClientId,
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          questionnaireId: formQuestionnaireId || undefined,
          assignedQuestionnaireId: formQuestionnaireId || undefined,
          status: formStatus,
        });

        if (selectedProject && selectedProject.id === editingProject.id) {
          setSelectedProject({
            ...selectedProject,
            clientId: formClientId,
            name: formName.trim(),
            description: formDescription.trim() || undefined,
            questionnaireId: formQuestionnaireId || undefined,
            assignedQuestionnaireId: formQuestionnaireId || undefined,
            status: formStatus,
            updatedAt: new Date().toISOString(),
          });
        }
        setEditingProject(null);
      } else {
        await onCreateProject({
          clientId: formClientId,
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          questionnaireId: formQuestionnaireId || undefined,
          assignedQuestionnaireId: formQuestionnaireId || undefined,
          status: formStatus,
        });
        setIsCreateModalOpen(false);
      }
    } catch (err) {
      console.error('Error saving project:', err);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Assign Questionnaire handler directly from Project detail view
  const handleQuickAssignQuestionnaire = async (qId: string) => {
    if (!selectedProject) return;
    try {
      await onAssignQuestionnaire(selectedProject.id, qId);
      setSelectedProject({
        ...selectedProject,
        questionnaireId: qId,
        assignedQuestionnaireId: qId,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to assign questionnaire:', err);
    }
  };

  // Filtered projects
  const filteredProjects = useMemo(() => {
    const list = projects.filter((p) => {
      if (clientFilter !== 'ALL' && p.clientId !== clientFilter) return false;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchDesc = (p.description || '').toLowerCase().includes(q);
        const client = clientMap.get(p.clientId);
        const matchClient = (client?.name || '').toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchClient) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
      return 0;
    });
    return list;
  }, [projects, clientFilter, statusFilter, searchQuery, sortBy, clientMap]);

  // Project Details View
  if (selectedProject) {
    const client = clientMap.get(selectedProject.clientId);
    const assignedQ = questionnaireMap.get(
      selectedProject.questionnaireId || selectedProject.assignedQuestionnaireId || ''
    );
    const projectSubmissions = submissions.filter(
      (s) =>
        s.projectId === selectedProject.id ||
        (s.clientId === selectedProject.clientId && s.clientCode === client?.name)
    );

    const shareUrl = `${window.location.origin}/?projectId=${selectedProject.id}`;

    return (
      <div className="space-y-6 animate-in fade-in duration-150">
        {/* Navigation & Breadcrumb */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSelectedProject(null)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Projects</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenEdit(selectedProject)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-50 text-xs font-semibold text-stone-700 cursor-pointer transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Project</span>
            </button>
            <button
              type="button"
              onClick={() => onArchiveProject(selectedProject.id, selectedProject.status !== 'archived')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-50 text-xs font-semibold text-stone-700 cursor-pointer transition-colors"
            >
              {selectedProject.status === 'archived' ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Unarchive</span>
                </>
              ) : (
                <>
                  <Archive className="w-3.5 h-3.5 text-amber-600" />
                  <span>Archive</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Project Header Overview */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" />
                  {client?.name || 'Assigned Client'}
                </span>
                <span className="text-stone-300">•</span>
                <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-stone-100 text-stone-700 capitalize">
                  {selectedProject.status}
                </span>
              </div>
              <h2 className="text-2xl font-black text-stone-900 tracking-tight mt-1">{selectedProject.name}</h2>
              <p className="text-xs text-stone-500 mt-1">
                Project ID: <span className="font-mono text-stone-700">{selectedProject.id}</span>
              </p>
            </div>

            <button
              type="button"
              onClick={() => onOpenShareLink(selectedProject)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold shadow-xs cursor-pointer transition-colors shrink-0"
            >
              <Share2 className="w-4 h-4" />
              <span>Generate Share Link</span>
            </button>
          </div>

          {selectedProject.description && (
            <p className="text-xs text-stone-700 bg-stone-50 p-3.5 rounded-xl leading-relaxed">
              {selectedProject.description}
            </p>
          )}

          {/* Share Link Banner */}
          <div className="p-4 rounded-xl bg-stone-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                Client Questionnaire Link
              </span>
              <span className="text-xs font-mono text-stone-200 select-all break-all block">
                {shareUrl}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onOpenShareLink(selectedProject)}
                className="px-3 py-1.5 rounded-lg bg-white text-stone-900 hover:bg-stone-100 text-xs font-bold cursor-pointer"
              >
                Copy Link
              </button>
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 cursor-pointer"
                title="Test Client Form"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Assigned Questionnaire Relationship Box */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-stone-100 text-stone-800">
                <FileQuestion className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-stone-900">Assigned Requirements Questionnaire</h3>
                <p className="text-xs text-stone-500">The template sent to client when opening this project's link</p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-xs text-stone-900">
                  {assignedQ?.title || 'Generic Requirements Questionnaire'}
                </h4>
                <span className="text-[10px] font-bold px-2 py-0.2 bg-emerald-100 text-emerald-800 rounded-full">
                  v{assignedQ?.version || 1} • {assignedQ?.status || 'published'}
                </span>
              </div>
              <p className="text-[11px] text-stone-500 mt-1 line-clamp-1">
                {assignedQ?.description || 'Specifications questionnaire template'}
              </p>
              <span className="text-[10px] text-stone-400 mt-1 block">
                {assignedQ?.sections?.length || 15} Sections • Decoupled Schema
              </span>
            </div>

            {/* Quick Questionnaire Assignment Select */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-semibold text-stone-600">Switch:</span>
              <select
                value={selectedProject.questionnaireId || selectedProject.assignedQuestionnaireId || ''}
                onChange={(e) => handleQuickAssignQuestionnaire(e.target.value)}
                className="px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-900/10"
              >
                {questionnaires.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.title} (v{q.version})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Project Submissions Section */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-2xs space-y-4">
          <div>
            <h3 className="text-base font-bold text-stone-900">Project Submissions ({projectSubmissions.length})</h3>
            <p className="text-xs text-stone-500">Answers submitted by client for {selectedProject.name}</p>
          </div>

          {projectSubmissions.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-stone-200 rounded-xl text-xs text-stone-400 space-y-1">
              <FileCheck2 className="w-8 h-8 mx-auto text-stone-300" />
              <p>No submissions recorded for this project yet.</p>
              <p className="text-[11px] text-stone-400">
                Share the client link above with your client to gather requirements.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-stone-100 border border-stone-200 rounded-xl overflow-hidden">
              {projectSubmissions.map((sub) => {
                const date = new Date(sub.submittedAtIso).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });
                return (
                  <div key={sub.id} className="p-4 flex items-center justify-between gap-4 hover:bg-stone-50/60 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-stone-900">{sub.id}</span>
                        <span className="text-[10px] font-bold px-2 py-0.2 bg-emerald-100 text-emerald-800 rounded-full">
                          {sub.status || 'submitted'}
                        </span>
                      </div>
                      <span className="text-xs text-stone-400 mt-0.5 block">
                        Submitted on {date} {sub.contactPerson ? `by ${sub.contactPerson}` : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onViewSubmission(sub)}
                        className="px-3 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-100 text-xs font-semibold text-stone-700 cursor-pointer"
                      >
                        Inspect Answers
                      </button>
                      <button
                        type="button"
                        onClick={() => onDownloadPdf(sub)}
                        className="p-1.5 rounded-lg border border-stone-300 hover:bg-stone-100 text-stone-600 hover:text-stone-900 cursor-pointer"
                        title="Download PDF"
                      >
                        <FileDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Projects Directory List View
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">Projects Management</h2>
          <p className="text-xs text-stone-500">Manage client software projects, questionnaires, and client share links</p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      {/* Filter and Search bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-stone-200 shadow-2xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search projects by name, description, or client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-transparent text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Client Filter Dropdown */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-stone-400 text-[11px] font-semibold uppercase">Client:</span>
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-semibold text-stone-800 focus:outline-none"
            >
              <option value="ALL">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort selector */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-stone-400 text-[11px] font-semibold uppercase">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-semibold text-stone-800 focus:outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name_asc">Name (A-Z)</option>
            </select>
          </div>

          {/* Status filter buttons */}
          <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl">
            {(['all', 'active', 'completed', 'archived'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                  statusFilter === st
                    ? 'bg-white text-stone-900 shadow-2xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Projects Grid / Table */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs">
        {filteredProjects.length === 0 ? (
          <div className="text-center py-16 text-xs text-stone-400 space-y-2">
            <FolderKanban className="w-10 h-10 mx-auto text-stone-300" />
            <p>No projects found matching your criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-600">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Project Name</th>
                  <th className="py-3 px-4">Client Organization</th>
                  <th className="py-3 px-4">Assigned Questionnaire</th>
                  <th className="py-3 px-4">Share Link</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Submissions</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredProjects.map((project) => {
                  const client = clientMap.get(project.clientId);
                  const assignedQ = questionnaireMap.get(
                    project.questionnaireId || project.assignedQuestionnaireId || ''
                  );
                  const projectSubsCount = submissions.filter((s) => s.projectId === project.id).length;
                  const isRevoked = project.shareLinkStatus === 'revoked';

                  return (
                    <tr
                      key={project.id}
                      className="hover:bg-stone-50/70 transition-colors group cursor-pointer"
                      onClick={() => setSelectedProject(project)}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-stone-100 group-hover:bg-stone-900 group-hover:text-white text-stone-700 flex items-center justify-center font-bold transition-colors shrink-0">
                            <FolderKanban className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-stone-900 block group-hover:text-black">
                              {project.name}
                            </span>
                            <span className="text-[11px] text-stone-400 truncate max-w-[200px] block">
                              {project.description || project.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-medium text-stone-800">
                          <Building2 className="w-3.5 h-3.5 text-stone-400" />
                          <span>{client?.name || 'Unknown Client'}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-medium text-stone-800 block">
                          {assignedQ?.title || 'Generic Requirements'}
                        </span>
                        <span className="text-[10px] text-stone-400">
                          v{assignedQ?.version || 1}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            isRevoked
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {isRevoked ? 'Revoked' : 'Active'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                            project.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : project.status === 'completed'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-stone-200 text-stone-700'
                          }`}
                        >
                          {project.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-stone-800">
                        {projectSubsCount}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div
                          className="inline-flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => onOpenShareLink(project)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white font-semibold cursor-pointer shadow-2xs text-[11px]"
                            title="Generate Share Link"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            <span>Share</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedProject(project)}
                            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 cursor-pointer"
                            title="View Project Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(project)}
                            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 cursor-pointer"
                            title="Edit Project"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Create or Edit Project */}
      {(isCreateModalOpen || editingProject) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50">
              <h3 className="text-sm font-bold text-stone-900">
                {editingProject ? 'Edit Project' : 'Create New Project'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setEditingProject(null);
                }}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-stone-700 block mb-1">
                  Client Organization <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formClientId}
                  onChange={(e) => setFormClientId(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Website, Inventory System, Mobile App"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Scope or overview of the project..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">Assign Questionnaire</label>
                <select
                  value={formQuestionnaireId}
                  onChange={(e) => setFormQuestionnaireId(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                >
                  {questionnaires.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.title} (v{q.version})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">Status</label>
                <select
                  value={formStatus}
                  onChange={(e) =>
                    setFormStatus(e.target.value as 'active' | 'archived' | 'completed')
                  }
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setEditingProject(null);
                  }}
                  className="px-3.5 py-2 text-stone-600 hover:bg-stone-100 rounded-xl font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting || !formName.trim() || !formClientId}
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white rounded-xl font-bold transition-colors cursor-pointer shadow-xs"
                >
                  {formSubmitting ? 'Saving...' : editingProject ? 'Save Changes' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
