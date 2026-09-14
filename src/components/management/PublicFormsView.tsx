/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Link2,
  Plus,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Lock,
  KeyRound,
  RefreshCw,
  Search,
  Filter,
  Eye,
  EyeOff,
  FolderKanban,
  Users,
  FileQuestion,
  FileCheck2,
  AlertCircle,
  X,
  Sparkles,
  Ban,
  CheckCircle2,
} from 'lucide-react';
import {
  PublicForm,
  PublicFormStatus,
  Project,
  Client,
  Questionnaire,
  Submission,
} from '../../types';
import { CreatePublicFormParams } from '../../lib/publicFormService';
import { copyToClipboard } from '../../lib/clipboardUtils';

interface PublicFormsViewProps {
  publicForms: PublicForm[];
  questionnaires: Questionnaire[];
  projects: Project[];
  clients: Client[];
  submissions: Submission[];
  onCreateForm: (params: CreatePublicFormParams) => Promise<{ form: PublicForm; plaintextPin: string }>;
  onUpdateStatus: (id: string, status: PublicFormStatus) => Promise<void>;
  onUpdatePin?: (id: string, newPin?: string) => Promise<{ plaintextPin: string }>;
  onRefresh?: () => void;
}

export const PublicFormsView: React.FC<PublicFormsViewProps> = ({
  publicForms,
  questionnaires,
  projects,
  clients,
  submissions,
  onCreateForm,
  onUpdateStatus,
  onUpdatePin,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PublicFormStatus>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createdFormInfo, setCreatedFormInfo] = useState<{
    formTitle: string;
    publicUrl: string;
  } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Form Creation Field State
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newInstructions, setNewInstructions] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedQuestionnaireId, setSelectedQuestionnaireId] = useState<string>('');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Filter public forms
  const filteredForms = publicForms.filter((f) => {
    if (statusFilter !== 'all' && f.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = f.title.toLowerCase().includes(q);
      const matchId = f.id.toLowerCase().includes(q);
      const matchProject = (f.projectName || '').toLowerCase().includes(q);
      const matchClient = (f.clientName || '').toLowerCase().includes(q);
      if (!matchTitle && !matchId && !matchProject && !matchClient) return false;
    }
    return true;
  });

  const handleCopyLink = async (formId: string) => {
    const url = `${window.location.origin}/form/${formId}`;
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopiedId(formId);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  const handleOpenCreateModal = () => {
    // Pre-populate sensible defaults
    const firstQ = questionnaires.find((q) => q.status === 'published') || questionnaires[0];
    const firstP = projects.find((p) => p.status === 'active') || projects[0];

    setSelectedQuestionnaireId(firstQ ? firstQ.id : '');
    setSelectedProjectId(firstP ? firstP.id : '');
    setNewTitle(firstP ? `${firstP.name} Requirements Intake` : 'Client Requirements Intake');
    setNewDescription('Please complete this requirements gathering form to help us understand your specifications.');
    setNewInstructions('Fill in responses for each section. You can save a draft at any time and return using the form link.');
    setCreateError(null);
    setShowCreateModal(true);
  };

  const handleProjectSelectChange = (projId: string) => {
    setSelectedProjectId(projId);
    const proj = projects.find((p) => p.id === projId);
    if (proj) {
      setNewTitle(`${proj.name} Requirements Intake`);
      if (proj.questionnaireId) {
        setSelectedQuestionnaireId(proj.questionnaireId);
      }
    }
  };

  const handleExecuteCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setCreateError('Please provide a form title.');
      return;
    }
    if (!selectedProjectId) {
      setCreateError('Please select an active project to bind this form.');
      return;
    }
    if (!selectedQuestionnaireId) {
      setCreateError('Please select a questionnaire template.');
      return;
    }

    const proj = projects.find((p) => p.id === selectedProjectId);
    if (!proj) {
      setCreateError('Selected project does not exist.');
      return;
    }

    const q = questionnaires.find((item) => item.id === selectedQuestionnaireId);
    if (!q) {
      setCreateError('Selected questionnaire does not exist.');
      return;
    }

    const client = clients.find((c) => c.id === proj.clientId);

    setIsSubmittingCreate(true);
    setCreateError(null);

    try {
      const shareToken = proj.shareToken || `st_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;

      const result = await onCreateForm({
        title: newTitle.trim(),
        description: newDescription.trim(),
        instructions: newInstructions.trim(),
        projectId: proj.id,
        projectName: proj.name,
        clientId: proj.clientId,
        clientName: client?.name || proj.clientId,
        questionnaireId: q.id,
        questionnaireVersion: q.version || 1,
        shareToken: shareToken,
        requirePin: false,
      });

      setShowCreateModal(false);
      const origin = window.location.origin;
      setCreatedFormInfo({
        formTitle: result.form.title,
        publicUrl: `${origin}/form/${result.form.id}`,
      });
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create public form.');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner and Quick Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-stone-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-stone-900 text-white shadow-xs">
              <Link2 className="w-4 h-4" />
            </span>
            <h2 className="text-base sm:text-lg font-black text-stone-900 tracking-tight">
              Public Client Forms
            </h2>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Create direct public form links for clients. Clients can access and complete questionnaires directly without administrative credentials or accounts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="p-2.5 text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors cursor-pointer"
              title="Refresh forms"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-stone-900/10 active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Public Form</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, Form ID, project, or client..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-stone-200 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-800 text-stone-900 placeholder:text-stone-400"
          />
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Filter className="w-3.5 h-3.5 text-stone-400" />
          <span className="text-xs text-stone-500 font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-white border border-stone-200 text-xs font-medium text-stone-700 py-1.5 px-2.5 rounded-xl focus:outline-none focus:border-stone-800"
          >
            <option value="all">All Statuses ({publicForms.length})</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
            <option value="closed">Closed</option>
            <option value="revoked">Revoked</option>
          </select>
        </div>
      </div>

      {/* Forms List Table / Cards */}
      {filteredForms.length === 0 ? (
        <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-500 flex items-center justify-center mx-auto">
            <Link2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-stone-900">No Public Forms Found</h3>
          <p className="text-xs text-stone-500 max-w-md mx-auto">
            {searchQuery || statusFilter !== 'all'
              ? 'No public forms match your search and filter criteria.'
              : 'Create your first PIN-protected form link to share with clients for requirements gathering.'}
          </p>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-stone-800 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Public Form</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredForms.map((form) => {
            const isCopied = copiedId === form.id;
            const project = projects.find((p) => p.id === form.projectId);
            const client = clients.find((c) => c.id === form.clientId);
            const questionnaire = questionnaires.find((q) => q.id === form.questionnaireId);
            const subCount = submissions.filter((s) => s.projectId === form.projectId).length;

            return (
              <div
                key={form.id}
                className="bg-white rounded-3xl border border-stone-200/90 p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col lg:flex-row lg:items-center justify-between gap-5"
              >
                {/* Left side details */}
                <div className="space-y-2.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-stone-100 text-stone-800 border border-stone-200">
                      {form.id}
                    </span>

                    {/* Status badge */}
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                        form.status === 'active'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : form.status === 'disabled'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : form.status === 'closed'
                          ? 'bg-stone-100 text-stone-700 border-stone-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      {form.status}
                    </span>

                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      <span>Public Access</span>
                    </span>

                    <span className="text-[11px] text-stone-400">
                      Created {new Date(form.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-stone-900 tracking-tight">
                      {form.title}
                    </h3>
                    {form.description && (
                      <p className="text-xs text-stone-500 line-clamp-1 mt-0.5">
                        {form.description}
                      </p>
                    )}
                  </div>

                  {/* Association metadata */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-600">
                    <div className="flex items-center gap-1.5">
                      <FolderKanban className="w-3.5 h-3.5 text-stone-400" />
                      <span className="font-semibold text-stone-800">Project:</span>
                      <span>{form.projectName || project?.name || 'Unassigned'}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-stone-400" />
                      <span className="font-semibold text-stone-800">Client:</span>
                      <span>{form.clientName || client?.name || 'General'}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <FileQuestion className="w-3.5 h-3.5 text-stone-400" />
                      <span className="font-semibold text-stone-800">Template:</span>
                      <span>
                        {questionnaire?.title || form.questionnaireId} (v{form.questionnaireVersion})
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <FileCheck2 className="w-3.5 h-3.5 text-stone-400" />
                      <span className="font-semibold text-stone-800">Submissions:</span>
                      <span>{subCount}</span>
                    </div>
                  </div>
                </div>

                {/* Right side action buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-3 lg:pt-0 border-t lg:border-t-0 border-stone-100 shrink-0">
                  {/* Copy Public Link */}
                  <button
                    type="button"
                    onClick={() => handleCopyLink(form.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                      isCopied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
                    }`}
                    title="Copy public guest link"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopied ? 'Copied!' : 'Copy Link'}</span>
                  </button>

                  {/* Test Form in new tab */}
                  <a
                    href={`/form/${form.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
                    title="Open public form in new tab"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>

                  {/* Status Dropdown */}
                  <select
                    value={form.status}
                    onChange={(e) => onUpdateStatus(form.id, e.target.value as PublicFormStatus)}
                    className="bg-stone-50 border border-stone-200 text-xs font-semibold text-stone-800 py-2 px-2.5 rounded-xl cursor-pointer focus:outline-none focus:border-stone-800"
                    title="Change form status"
                  >
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                    <option value="closed">Closed</option>
                    <option value="revoked">Revoked</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* 1. Modal: Create Public Form                                        */}
      {/* ------------------------------------------------------------------- */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-stone-200 p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-stone-900 text-white flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900">
                    Create Public Form Link
                  </h3>
                  <p className="text-xs text-stone-500">
                    Generate a direct questionnaire URL for your client
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-stone-400 hover:text-stone-700 p-1.5 rounded-xl hover:bg-stone-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteCreate} className="space-y-4">
              {createError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Public Form Title *
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Acme Corp Requirements Gathering"
                  className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-stone-800"
                  required
                />
              </div>

              {/* Project & Client Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Select Project *
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => handleProjectSelectChange(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:border-stone-800"
                    required
                  >
                    <option value="" disabled>-- Select Project --</option>
                    {projects.map((p) => {
                      const client = clients.find((c) => c.id === p.clientId);
                      return (
                        <option key={p.id} value={p.id}>
                          {p.name} ({client?.name || 'No Client'})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Questionnaire Template Selection */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Questionnaire Template *
                  </label>
                  <select
                    value={selectedQuestionnaireId}
                    onChange={(e) => setSelectedQuestionnaireId(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:border-stone-800"
                    required
                  >
                    <option value="" disabled>-- Select Questionnaire --</option>
                    {questionnaires.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.title} (v{q.version})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Description / Welcome Note
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={2}
                  placeholder="Short note explaining the questionnaire purpose to the client"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-stone-800"
                />
              </div>

              {/* Instructions */}
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                  Client Instructions
                </label>
                <textarea
                  value={newInstructions}
                  onChange={(e) => setNewInstructions(e.target.value)}
                  rows={2}
                  placeholder="e.g. Please complete by Friday. You can save drafts at any time."
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:border-stone-800"
                />
              </div>

              {/* Modal buttons */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 active:bg-stone-950 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-stone-900/10 active:scale-[0.98] cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingCreate ? 'Creating Form...' : 'Create Form Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* 2. Modal: Display Created Public Form Link                          */}
      {/* ------------------------------------------------------------------- */}
      {createdFormInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-stone-200 p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-200/60">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-stone-900">
                Public Form Created!
              </h3>
              <p className="text-xs text-stone-500">
                Share this link with your client. They can open and complete the questionnaire directly without needing a PIN or account.
              </p>
            </div>

            {/* Credential Box */}
            <div className="space-y-4 bg-stone-50 p-4 rounded-2xl border border-stone-200">
              {/* Form Title */}
              <div>
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                  Form Title
                </span>
                <span className="text-xs font-bold text-stone-800">
                  {createdFormInfo.formTitle}
                </span>
              </div>

              {/* Public Link */}
              <div>
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                  Public Guest Link
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="text"
                    readOnly
                    value={createdFormInfo.publicUrl}
                    className="flex-1 px-2.5 py-1.5 bg-white border border-stone-200 text-xs font-mono rounded-lg text-stone-700 select-all"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await copyToClipboard(createdFormInfo.publicUrl);
                      if (ok) {
                        setLinkCopied(true);
                        setTimeout(() => setLinkCopied(false), 2000);
                      }
                    }}
                    className="px-2.5 py-1.5 bg-stone-900 text-white rounded-lg text-xs font-semibold cursor-pointer shrink-0"
                  >
                    {linkCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setCreatedFormInfo(null);
                  setLinkCopied(false);
                }}
                className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-stone-900/10 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
