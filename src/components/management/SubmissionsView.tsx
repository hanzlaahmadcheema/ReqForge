import React, { useState, useMemo } from 'react';
import {
  FileCheck2,
  Search,
  Building2,
  FolderKanban,
  FileQuestion,
  Calendar,
  FileDown,
  Eye,
  Trash2,
  Check,
  Filter,
  ArrowUpDown,
  FileSpreadsheet,
  FileCode,
  Archive,
  RotateCcw,
  CheckCheck,
} from 'lucide-react';
import { Submission, Client, Project, Questionnaire, QuestionnaireSection } from '../../types';
import { SubmissionDetailModal } from '../SubmissionDetailModal';
import { reconstructAnswersFromSubmission } from '../../lib/firebase';
import { generateQuestionnairePdf } from '../../lib/generatePdf';
import { exportSubmissionToCsv, exportSubmissionToJson } from '../../lib/exportService';

interface SubmissionsViewProps {
  submissions: Submission[];
  clients: Client[];
  projects: Project[];
  questionnaires: Questionnaire[];
  sections: QuestionnaireSection[];
  onDeleteSubmission: (id: string, clientCode: string) => Promise<void>;
  onStatusChange?: (
    id: string,
    status: 'draft' | 'submitted' | 'reviewed' | 'archived'
  ) => Promise<void>;
}

export const SubmissionsView: React.FC<SubmissionsViewProps> = ({
  submissions,
  clients,
  projects,
  questionnaires,
  sections,
  onDeleteSubmission,
  onStatusChange,
}) => {
  // Filters
  const [selectedClientId, setSelectedClientId] = useState<string>('ALL');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');
  const [selectedQuestionnaireId, setSelectedQuestionnaireId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'client_asc'>('newest');

  // Modals & action states
  const [activeSubmission, setActiveSubmission] = useState<Submission | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadSuccessId, setDownloadSuccessId] = useState<string | null>(null);

  // Lookup maps
  const clientMap = useMemo(() => {
    const map = new Map<string, Client>();
    clients.forEach((c) => map.set(c.id, c));
    return map;
  }, [clients]);

  const projectMap = useMemo(() => {
    const map = new Map<string, Project>();
    projects.forEach((p) => map.set(p.id, p));
    return map;
  }, [projects]);

  const questionnaireMap = useMemo(() => {
    const map = new Map<string, Questionnaire>();
    questionnaires.forEach((q) => map.set(q.id, q));
    return map;
  }, [questionnaires]);

  // Filtered & Sorted submissions
  const filteredSubmissions = useMemo(() => {
    const result = submissions.filter((sub) => {
      // Client filter
      if (selectedClientId !== 'ALL') {
        const client = clientMap.get(selectedClientId);
        const matchesId = sub.clientId === selectedClientId;
        const matchesCode = client && sub.clientCode?.toLowerCase() === client.name?.toLowerCase();
        if (!matchesId && !matchesCode) return false;
      }

      // Project filter
      if (selectedProjectId !== 'ALL' && sub.projectId !== selectedProjectId) {
        return false;
      }

      // Questionnaire filter
      if (selectedQuestionnaireId !== 'ALL') {
        const qId = sub.questionnaireId || sub.formId;
        if (qId !== selectedQuestionnaireId) return false;
      }

      // Status filter
      if (selectedStatus !== 'ALL') {
        const st = sub.status || 'submitted';
        if (st !== selectedStatus) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const clientName = (sub.clientCode || '').toLowerCase();
        const proj = sub.projectId ? projectMap.get(sub.projectId) : undefined;
        const projName = (proj?.name || '').toLowerCase();
        const contact = (sub.contactPerson || '').toLowerCase();
        const phone = (sub.contactPhone || '').toLowerCase();
        const notes = (sub.additionalRequirements || '').toLowerCase();
        const id = sub.id.toLowerCase();

        if (
          !clientName.includes(q) &&
          !projName.includes(q) &&
          !contact.includes(q) &&
          !phone.includes(q) &&
          !notes.includes(q) &&
          !id.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      const timeA = new Date(a.submittedAtIso || (a.createdAt as string) || 0).getTime();
      const timeB = new Date(b.submittedAtIso || (b.createdAt as string) || 0).getTime();

      if (sortBy === 'newest') return timeB - timeA;
      if (sortBy === 'oldest') return timeA - timeB;
      if (sortBy === 'client_asc') {
        return (a.clientCode || '').localeCompare(b.clientCode || '');
      }
      return 0;
    });

    return result;
  }, [
    submissions,
    selectedClientId,
    selectedProjectId,
    selectedQuestionnaireId,
    selectedStatus,
    searchQuery,
    sortBy,
    clientMap,
    projectMap,
  ]);

  // Format date helper
  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return { full: iso, time: '' };
      return {
        full: d.toLocaleDateString(undefined, {
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
      return { full: iso, time: '' };
    }
  };

  // PDF Download handler
  const handleDownloadPdf = (sub: Submission) => {
    try {
      setDownloadingId(sub.id);
      const answers = reconstructAnswersFromSubmission(sub);
      const project = sub.projectId ? projectMap.get(sub.projectId) : undefined;

      generateQuestionnairePdf({
        clientCode: sub.clientCode,
        projectName: project?.name,
        contactPerson: sub.contactPerson || undefined,
        contactPhone: sub.contactPhone || undefined,
        additionalRequirements: sub.additionalRequirements || undefined,
        sections,
        answers,
        isSubmitted: sub.status !== 'draft',
        submissionDocId: sub.submissionDocId || sub.id,
      });

      setDownloadSuccessId(sub.id);
      setTimeout(() => setDownloadSuccessId(null), 2500);
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (sub: Submission) => {
    const confirm = window.confirm(
      `Delete submission record "${sub.id}" for ${sub.clientCode}? This cannot be undone.`
    );
    if (!confirm) return;
    try {
      await onDeleteSubmission(sub.id, sub.clientCode);
    } catch (err) {
      console.error('Error deleting submission:', err);
      alert('Failed to delete submission record.');
    }
  };

  const handleStatusUpdate = async (
    submissionId: string,
    status: 'draft' | 'submitted' | 'reviewed' | 'archived'
  ) => {
    if (!onStatusChange) return;
    await onStatusChange(submissionId, status);
    // Also sync active modal state if open
    if (activeSubmission && activeSubmission.id === submissionId) {
      setActiveSubmission({
        ...activeSubmission,
        status,
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">Submissions Management</h2>
          <p className="text-xs text-stone-500">
            Inspect completed questionnaires, review workflow progress, and export to PDF, CSV, or JSON
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1 bg-stone-100 text-stone-700 rounded-lg">
            Showing {filteredSubmissions.length} of {submissions.length} Submissions
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs space-y-3">
        {/* Search input and Sort */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search submissions by client, project, contact person, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <ArrowUpDown className="w-3.5 h-3.5 text-stone-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full sm:w-auto px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 focus:outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="client_asc">Client Name (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Filters row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1 border-t border-stone-100">
          {/* Client Filter */}
          <div>
            <label className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block mb-1">
              Client
            </label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-semibold text-stone-800 focus:outline-none"
            >
              <option value="ALL">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Project Filter */}
          <div>
            <label className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block mb-1">
              Project
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-semibold text-stone-800 focus:outline-none"
            >
              <option value="ALL">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Questionnaire Filter */}
          <div>
            <label className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block mb-1">
              Questionnaire
            </label>
            <select
              value={selectedQuestionnaireId}
              onChange={(e) => setSelectedQuestionnaireId(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-semibold text-stone-800 focus:outline-none"
            >
              <option value="ALL">All Questionnaires</option>
              {questionnaires.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title} (v{q.version})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block mb-1">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-semibold text-stone-800 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="submitted">Submitted</option>
              <option value="reviewed">Reviewed</option>
              <option value="draft">Draft / In Progress</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
      </div>

      {/* Submissions Table */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs">
        {filteredSubmissions.length === 0 ? (
          <div className="text-center py-16 text-xs text-stone-400 space-y-2">
            <FileCheck2 className="w-10 h-10 mx-auto text-stone-300" />
            <p className="text-stone-600 font-semibold text-sm">No submissions found</p>
            <p className="text-stone-400">Try adjusting your filters, search term, or create a share link for clients.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-600">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Client Organization</th>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Questionnaire</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredSubmissions.map((sub) => {
                  const client = sub.clientId ? clientMap.get(sub.clientId) : undefined;
                  const project = sub.projectId ? projectMap.get(sub.projectId) : undefined;
                  const q = questionnaireMap.get(sub.questionnaireId || sub.formId || '');
                  const dateInfo = formatDate(sub.submittedAtIso || (sub.createdAt as string) || '');
                  const currentSt = sub.status || 'submitted';

                  const isDownloading = downloadingId === sub.id;
                  const isSuccess = downloadSuccessId === sub.id;

                  return (
                    <tr
                      key={sub.id}
                      className="hover:bg-stone-50/70 transition-colors group cursor-pointer"
                      onClick={() => setActiveSubmission(sub)}
                    >
                      {/* Client */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <Building2 className="w-4 h-4 text-stone-400 shrink-0" />
                          <div>
                            <span className="font-bold text-stone-900 block group-hover:text-black">
                              {client?.name || sub.clientCode || 'Client'}
                            </span>
                            {sub.contactPerson && (
                              <span className="text-[11px] text-stone-400 block">
                                {sub.contactPerson}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Project */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <FolderKanban className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span className="font-semibold text-stone-800">
                            {project?.name || 'General Requirements'}
                          </span>
                        </div>
                      </td>

                      {/* Questionnaire */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <FileQuestion className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <div>
                            <span className="font-medium text-stone-800 block">
                              {q?.title || sub.formTitle || 'Requirements Questionnaire'}
                            </span>
                            <span className="text-[10px] text-stone-400">
                              v{sub.questionnaireVersion || q?.version || 1}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full capitalize border ${
                            currentSt === 'reviewed'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : currentSt === 'archived'
                              ? 'bg-stone-100 text-stone-600 border-stone-200'
                              : currentSt === 'draft'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-sky-50 text-sky-800 border-sky-200'
                          }`}
                        >
                          {currentSt === 'reviewed' && <CheckCheck className="w-3 h-3 text-emerald-600" />}
                          {currentSt === 'archived' && <Archive className="w-3 h-3 text-stone-500" />}
                          {currentSt}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4">
                        <div>
                          <span className="font-semibold text-stone-800 block">{dateInfo.full}</span>
                          <span className="text-[10px] text-stone-400 block">{dateInfo.time}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div
                          className="inline-flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => setActiveSubmission(sub)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-100 text-stone-700 font-semibold cursor-pointer text-[11px]"
                            title="Inspect Full Answers"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect</span>
                          </button>

                          {/* Export CSV */}
                          <button
                            type="button"
                            onClick={() => exportSubmissionToCsv(sub, q)}
                            className="p-1.5 rounded-lg border border-stone-200 text-stone-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                            title="Export CSV"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                          </button>

                          {/* Export JSON */}
                          <button
                            type="button"
                            onClick={() => exportSubmissionToJson(sub, q)}
                            className="p-1.5 rounded-lg border border-stone-200 text-stone-600 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                            title="Export JSON"
                          >
                            <FileCode className="w-3.5 h-3.5" />
                          </button>

                          {/* Export PDF */}
                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(sub)}
                            disabled={isDownloading}
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                              isSuccess
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'border-stone-300 text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                            }`}
                            title="Export PDF"
                          >
                            {isSuccess ? <Check className="w-3.5 h-3.5" /> : <FileDown className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(sub)}
                            className="p-1.5 rounded-lg border border-stone-200 text-stone-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 cursor-pointer transition-colors"
                            title="Delete submission"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* Detail Modal */}
      {activeSubmission && (
        <SubmissionDetailModal
          submission={activeSubmission}
          isOpen={true}
          onClose={() => setActiveSubmission(null)}
          sections={sections}
          questionnaire={questionnaireMap.get(activeSubmission.questionnaireId || activeSubmission.formId || '')}
          onStatusChange={handleStatusUpdate}
          onDelete={async (id) => {
            await onDeleteSubmission(id, activeSubmission.clientCode);
            setActiveSubmission(null);
          }}
        />
      )}
    </div>
  );
};
