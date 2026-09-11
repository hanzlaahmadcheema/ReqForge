import React, { useState } from 'react';
import {
  FileQuestion,
  Layers,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  ArrowLeft,
  Building2,
  Eye,
  Plus,
  Copy,
  Archive,
  RotateCcw,
  Edit3,
  Search,
  Check,
  AlertTriangle,
  Send,
  FileCode,
} from 'lucide-react';
import { Questionnaire, Project, Client, Section } from '../../types';
import {
  duplicateQuestionnaire,
  archiveQuestionnaire,
  deleteQuestionnaire,
} from '../../lib/questionnaireService';
import { QuestionnaireBuilder } from './QuestionnaireBuilder';
import { QuestionnairePreviewModal } from './QuestionnairePreviewModal';
import { QuestionnaireJsonModal } from './QuestionnaireJsonModal';

interface QuestionnairesViewProps {
  questionnaires: Questionnaire[];
  projects: Project[];
  clients: Client[];
  onSelectProject: (projectId: string) => void;
  onRefresh?: () => Promise<void> | void;
}

export const QuestionnairesView: React.FC<QuestionnairesViewProps> = ({
  questionnaires: initialQuestionnaires,
  projects,
  clients,
  onSelectProject,
  onRefresh,
}) => {
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>(initialQuestionnaires);
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState<Questionnaire | null>(null);
  const [builderQuestionnaire, setBuilderQuestionnaire] = useState<Questionnaire | null>(null);
  const [previewQuestionnaire, setPreviewQuestionnaire] = useState<Questionnaire | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft' | 'archived'>('all');
  const [expandedSectionIds, setExpandedSectionIds] = useState<Record<string, boolean>>({});
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [isJsonModalOpen, setIsJsonModalOpen] = useState<boolean>(false);

  // Sync when prop updates
  React.useEffect(() => {
    setQuestionnaires(initialQuestionnaires);
  }, [initialQuestionnaires]);

  const clientMap = new Map<string, Client>();
  clients.forEach((c) => clientMap.set(c.id, c));

  const toggleSection = (secId: string) => {
    setExpandedSectionIds((prev) => ({
      ...prev,
      [secId]: !prev[secId],
    }));
  };

  // ---------------------------------------------------------------------------
  // BUILDER LAUNCHERS
  // ---------------------------------------------------------------------------
  const handleCreateNew = () => {
    const now = new Date().toISOString();
    const newId = `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const blankQuestionnaire: Questionnaire = {
      id: newId,
      title: 'New Requirements Questionnaire',
      description: 'Comprehensive software development requirements questionnaire.',
      version: 1,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      sections: [
        {
          id: `sec_${Date.now()}_1`,
          questionnaireId: newId,
          title: 'General Project Scope',
          description: 'High-level business objectives, users, and platform targets',
          order: 1,
          enabled: true,
          questions: [
            {
              id: `q_${Date.now()}_1_1`,
              sectionId: `sec_${Date.now()}_1`,
              text: 'What is the primary business goal of this application?',
              description: 'Summarize the core outcome you need this system to achieve.',
              type: 'textarea',
              required: true,
              enabled: true,
              order: 1,
              placeholder: 'Describe the main operational goals...',
            },
            {
              id: `q_${Date.now()}_1_2`,
              sectionId: `sec_${Date.now()}_1`,
              text: 'Target Platforms',
              type: 'multiple_choice',
              required: true,
              enabled: true,
              order: 2,
              options: [
                { label: 'Web Application (Desktop & Mobile Responsive)', value: 'web' },
                { label: 'iOS Native App', value: 'ios' },
                { label: 'Android Native App', value: 'android' },
              ],
            },
          ],
        },
      ],
    };

    setBuilderQuestionnaire(blankQuestionnaire);
  };

  const handleEditInBuilder = (q: Questionnaire) => {
    setBuilderQuestionnaire(q);
  };

  const handleDuplicate = async (q: Questionnaire) => {
    setActionInProgress(q.id);
    try {
      const cloned = await duplicateQuestionnaire(q);
      setQuestionnaires((prev) => [cloned, ...prev]);
      if (onRefresh) await onRefresh();
    } catch (err: any) {
      alert(`Failed to duplicate questionnaire: ${err?.message || err}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleToggleArchive = async (q: Questionnaire) => {
    const shouldArchive = q.status !== 'archived';
    setActionInProgress(q.id);
    try {
      await archiveQuestionnaire(q.id, shouldArchive);
      const newStatus = shouldArchive ? 'archived' : 'draft';
      setQuestionnaires((prev) =>
        prev.map((item) => (item.id === q.id ? { ...item, status: newStatus } : item))
      );
      if (selectedQuestionnaire?.id === q.id) {
        setSelectedQuestionnaire((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
      if (onRefresh) await onRefresh();
    } catch (err: any) {
      alert(`Failed to update status: ${err?.message || err}`);
    } finally {
      setActionInProgress(null);
    }
  };

  // ---------------------------------------------------------------------------
  // IF IN BUILDER MODE: RENDER QUESTIONNAIRE BUILDER
  // ---------------------------------------------------------------------------
  if (builderQuestionnaire) {
    return (
      <QuestionnaireBuilder
        initialQuestionnaire={builderQuestionnaire}
        onBack={() => {
          setBuilderQuestionnaire(null);
          if (onRefresh) onRefresh();
        }}
        onSaved={(saved) => {
          setQuestionnaires((prev) => {
            const exists = prev.some((x) => x.id === saved.id);
            return exists
              ? prev.map((x) => (x.id === saved.id ? saved : x))
              : [saved, ...prev];
          });
          if (selectedQuestionnaire?.id === saved.id) {
            setSelectedQuestionnaire(saved);
          }
          if (onRefresh) onRefresh();
        }}
        onPublished={(published) => {
          setQuestionnaires((prev) => {
            const exists = prev.some((x) => x.id === published.id);
            return exists
              ? prev.map((x) => (x.id === published.id ? published : x))
              : [published, ...prev];
          });
          if (selectedQuestionnaire?.id === published.id) {
            setSelectedQuestionnaire(published);
          }
          if (onRefresh) onRefresh();
        }}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // FILTERED QUESTIONNAIRES
  // ---------------------------------------------------------------------------
  const filteredQuestionnaires = questionnaires.filter((q) => {
    const matchesSearch =
      q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.description && q.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      q.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' || q.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // ---------------------------------------------------------------------------
  // DETAIL VIEW
  // ---------------------------------------------------------------------------
  if (selectedQuestionnaire) {
    const assignedProjects = projects.filter(
      (p) =>
        p.questionnaireId === selectedQuestionnaire.id ||
        p.assignedQuestionnaireId === selectedQuestionnaire.id
    );

    const totalQuestions = (selectedQuestionnaire.sections || []).reduce(
      (acc, s) => acc + (s.questions?.length || 0),
      0
    );

    return (
      <div className="space-y-6 animate-in fade-in duration-150">
        {/* Top Back Navigation & Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSelectedQuestionnaire(null)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-white border border-stone-200 px-3 py-1.5 rounded-lg shadow-2xs cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to All Questionnaires</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPreviewQuestionnaire(selectedQuestionnaire)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-stone-700 bg-white border border-stone-300 hover:bg-stone-50 transition cursor-pointer shadow-2xs"
            >
              <Eye className="w-3.5 h-3.5 text-stone-500" />
              <span>Preview</span>
            </button>

            <button
              type="button"
              onClick={() => handleDuplicate(selectedQuestionnaire)}
              disabled={actionInProgress === selectedQuestionnaire.id}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-stone-700 bg-white border border-stone-300 hover:bg-stone-50 transition cursor-pointer shadow-2xs disabled:opacity-50"
            >
              <Copy className="w-3.5 h-3.5 text-stone-500" />
              <span>Duplicate</span>
            </button>

            <button
              type="button"
              onClick={() => handleEditInBuilder(selectedQuestionnaire)}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 transition shadow-xs cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit in Builder</span>
            </button>
          </div>
        </div>

        {/* Overview Header Card */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-stone-900 text-white flex items-center justify-center font-bold text-lg shadow-xs">
                <FileQuestion className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-black text-stone-900 tracking-tight">
                    {selectedQuestionnaire.title}
                  </h2>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full capitalize ${
                      selectedQuestionnaire.status === 'published'
                        ? 'bg-emerald-100 text-emerald-800'
                        : selectedQuestionnaire.status === 'draft'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-stone-200 text-stone-700'
                    }`}
                  >
                    {selectedQuestionnaire.status}
                  </span>
                  <span className="text-[11px] font-bold px-2 py-0.5 bg-stone-100 text-stone-700 rounded-md">
                    v{selectedQuestionnaire.version}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  ID: <span className="font-mono text-stone-700">{selectedQuestionnaire.id}</span>
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs text-stone-700 bg-stone-50 p-3.5 rounded-xl leading-relaxed">
            {selectedQuestionnaire.description}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
              <span className="text-[11px] text-stone-400 font-semibold uppercase block">
                Sections
              </span>
              <span className="font-bold text-stone-900 text-base mt-0.5 block">
                {selectedQuestionnaire.sections?.length || 0}
              </span>
            </div>
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
              <span className="text-[11px] text-stone-400 font-semibold uppercase block">
                Total Questions
              </span>
              <span className="font-bold text-stone-900 text-base mt-0.5 block">
                {totalQuestions}
              </span>
            </div>
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
              <span className="text-[11px] text-stone-400 font-semibold uppercase block">
                Assigned Projects
              </span>
              <span className="font-bold text-stone-900 text-base mt-0.5 block">
                {assignedProjects.length}
              </span>
            </div>
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-100">
              <span className="text-[11px] text-stone-400 font-semibold uppercase block">
                Builder Versioning
              </span>
              <span className="font-bold text-emerald-800 text-xs mt-0.5 block">
                Immutable Snapshots
              </span>
            </div>
          </div>
        </div>

        {/* Projects Assigned to this Questionnaire */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-2xs space-y-4">
          <div>
            <h3 className="text-base font-bold text-stone-900">
              Projects Using this Questionnaire ({assignedProjects.length})
            </h3>
            <p className="text-xs text-stone-500">
              Projects assigned to collect requirements using this template
            </p>
          </div>

          {assignedProjects.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-stone-200 rounded-xl text-xs text-stone-400">
              No projects currently assigned to this questionnaire.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {assignedProjects.map((p) => {
                const client = clientMap.get(p.clientId);
                return (
                  <div
                    key={p.id}
                    onClick={() => onSelectProject(p.id)}
                    className="p-3.5 rounded-xl border border-stone-200 hover:border-stone-300 bg-stone-50/50 hover:bg-white transition-all flex items-center justify-between gap-3 cursor-pointer group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-stone-900 group-hover:text-black">
                          {p.name}
                        </span>
                        <span className="text-[10px] font-medium px-2 py-0.2 rounded-full bg-stone-200 text-stone-700">
                          {p.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-stone-500 mt-0.5">
                        <Building2 className="w-3 h-3 text-stone-400" />
                        <span>{client?.name || 'Assigned Client'}</span>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-stone-600 group-hover:text-stone-900">
                      Open Project →
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sections and Questions Hierarchy Inspection */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-stone-900">
                Sections & Questions Structure
              </h3>
              <p className="text-xs text-stone-500">
                Live breakdown of sections, questions, types, and logic rules
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleEditInBuilder(selectedQuestionnaire)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-lg transition"
            >
              <Edit3 className="w-3 h-3" />
              <span>Edit Structure in Builder</span>
            </button>
          </div>

          <div className="space-y-3">
            {(selectedQuestionnaire.sections || []).map((sec, sIdx) => {
              const secId = sec.id || `sec_${sIdx}`;
              const isExpanded = !!expandedSectionIds[secId];

              return (
                <div
                  key={secId}
                  className="rounded-xl border border-stone-200 overflow-hidden bg-stone-50/30 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => toggleSection(secId)}
                    className="w-full px-4 py-3 bg-stone-50 hover:bg-stone-100/80 flex items-center justify-between text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-lg bg-stone-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                        {sIdx + 1}
                      </span>
                      <div>
                        <h4 className="font-bold text-xs text-stone-900">{sec.title}</h4>
                        {sec.description && (
                          <p className="text-[11px] text-stone-500">{sec.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-semibold text-stone-500">
                        {sec.questions?.length || 0} Questions
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-stone-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-stone-500" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="p-4 border-t border-stone-200 bg-white space-y-3 divide-y divide-stone-100">
                      {(sec.questions || []).map((q, qIdx) => (
                        <div key={q.id} className="pt-3 first:pt-0 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-stone-900">
                              {qIdx + 1}. {q.text || q.title || q.id}
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-stone-100 text-stone-700">
                                {q.type}
                              </span>
                              {q.required && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                                  Required
                                </span>
                              )}
                            </div>
                          </div>

                          {(q.description || q.helperText) && (
                            <p className="text-[11px] text-stone-500">{q.description || q.helperText}</p>
                          )}

                          {q.options && q.options.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {q.options.map((opt) => (
                                <span
                                  key={opt.value}
                                  className="text-[10px] px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 border border-stone-200"
                                >
                                  {opt.label}
                                </span>
                              ))}
                            </div>
                          )}

                          {(q.conditionalRule || q.conditional) && (
                            <span className="inline-block text-[10px] text-amber-800 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              Conditional Display Rule Applied
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Interactive Preview Modal */}
        {previewQuestionnaire && (
          <QuestionnairePreviewModal
            questionnaire={previewQuestionnaire}
            isOpen={true}
            onClose={() => setPreviewQuestionnaire(null)}
          />
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // QUESTIONNAIRES LIST VIEW
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Header & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">
            Questionnaires Management
          </h2>
          <p className="text-xs text-stone-500">
            Create, customize, version, and publish reusable questionnaire templates
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsJsonModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-stone-50 text-stone-700 border border-stone-300 rounded-xl text-xs font-semibold transition shadow-2xs cursor-pointer"
            title="Import questionnaire from universal JSON template"
          >
            <FileCode className="w-3.5 h-3.5 text-stone-500" />
            <span>Import JSON</span>
          </button>

          <button
            type="button"
            onClick={handleCreateNew}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Questionnaire</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-stone-200 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search questionnaires..."
            className="w-full pl-8 pr-3 py-1.5 text-xs text-stone-900 placeholder:text-stone-400 rounded-lg border border-stone-200 focus:outline-none focus:border-stone-900 bg-stone-50/50 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {(['all', 'published', 'draft', 'archived'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition whitespace-nowrap cursor-pointer ${
                statusFilter === status
                  ? 'bg-stone-900 text-white shadow-2xs'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Questionnaires Table */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs">
        <table className="w-full text-left text-xs text-stone-600">
          <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold uppercase tracking-wider text-[10px]">
            <tr>
              <th className="py-3 px-4">Template Title</th>
              <th className="py-3 px-4">Version</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Sections</th>
              <th className="py-3 px-4">Assigned Projects</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filteredQuestionnaires.map((q) => {
              const assignedCount = projects.filter(
                (p) => p.questionnaireId === q.id || p.assignedQuestionnaireId === q.id
              ).length;
              const totalQ = (q.sections || []).reduce(
                (acc, s) => acc + (s.questions?.length || 0),
                0
              );

              return (
                <tr
                  key={q.id}
                  className="hover:bg-stone-50/70 transition-colors group cursor-pointer"
                  onClick={() => setSelectedQuestionnaire(q)}
                >
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-stone-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                        <FileQuestion className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-stone-900 block group-hover:text-black">
                          {q.title}
                        </span>
                        <span className="text-[11px] text-stone-400 line-clamp-1 max-w-[280px]">
                          {q.description || 'No description provided'}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="py-3.5 px-4 font-mono font-semibold text-stone-800">
                    v{q.version}
                  </td>

                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                        q.status === 'published'
                          ? 'bg-emerald-100 text-emerald-800'
                          : q.status === 'draft'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-stone-200 text-stone-700'
                      }`}
                    >
                      {q.status}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 font-semibold text-stone-800">
                    {q.sections?.length || 0} sections ({totalQ} Qs)
                  </td>

                  <td className="py-3.5 px-4 font-semibold text-stone-800">
                    {assignedCount} projects
                  </td>

                  <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPreviewQuestionnaire(q)}
                        className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition cursor-pointer"
                        title="Preview Questionnaire"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicate(q)}
                        disabled={actionInProgress === q.id}
                        className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition cursor-pointer disabled:opacity-50"
                        title="Duplicate into Draft"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleArchive(q)}
                        disabled={actionInProgress === q.id}
                        className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition cursor-pointer disabled:opacity-50"
                        title={q.status === 'archived' ? 'Unarchive (Draft)' : 'Archive'}
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleEditInBuilder(q)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold transition cursor-pointer ml-1"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Builder</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {filteredQuestionnaires.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-stone-400 text-xs">
                  No questionnaires found matching your criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Interactive Preview Modal */}
      {previewQuestionnaire && (
        <QuestionnairePreviewModal
          questionnaire={previewQuestionnaire}
          isOpen={true}
          onClose={() => setPreviewQuestionnaire(null)}
        />
      )}

      {/* Universal JSON Importer Modal */}
      {isJsonModalOpen && (
        <QuestionnaireJsonModal
          isOpen={isJsonModalOpen}
          mode="import"
          onClose={() => setIsJsonModalOpen(false)}
          onImportSuccess={(imported) => {
            setBuilderQuestionnaire(imported);
          }}
        />
      )}
    </div>
  );
};
