import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  FileDown,
  FileSpreadsheet,
  FileCode,
  Check,
  X,
  Edit3,
  Filter,
  Save,
  RefreshCw,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Tag,
  Layers,
  Search,
  ExternalLink,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import {
  Submission,
  Section,
  RequirementRecord,
  RequirementsSummary,
  CompletenessGapAnalysis,
  RequirementCategory,
  RequirementPriority,
  RequirementStatus,
  RequirementItemType,
} from '../../types';
import {
  fetchRequirementsSummary,
  fetchStructuredRequirements,
  fetchGapAnalysis,
} from '../../lib/aiService';
import {
  getSubmissionRequirements,
  saveSubmissionRequirements,
  updateRequirementRecord,
  getRequirementsSummary,
  saveRequirementsSummary,
  getGapAnalysis,
  saveGapAnalysis,
} from '../../lib/requirementsService';
import {
  exportRequirementsToPdf,
  exportRequirementsToCsv,
  exportRequirementsToJson,
} from '../../lib/requirementsExport';

interface SubmissionAiRequirementsPanelProps {
  submission: Submission;
  sections: Section[];
}

type PanelView = 'requirements_review' | 'summary_categories' | 'gap_analysis';

const CATEGORY_LABELS: Record<RequirementCategory, string> = {
  business_goals: 'Business Goals & Objectives',
  users_roles: 'Users, Roles & Permissions',
  features: 'Functional Features',
  workflow: 'Workflows & Processes',
  data: 'Data Models & Storage',
  integrations: 'Integrations & APIs',
  reports: 'Reports & Analytics',
  constraints: 'Constraints & Compliance',
  other: 'Other Requirements',
};

export const SubmissionAiRequirementsPanel: React.FC<
  SubmissionAiRequirementsPanelProps
> = ({ submission, sections }) => {
  const [activeView, setActiveView] = useState<PanelView>('requirements_review');

  // Stored state
  const [requirements, setRequirements] = useState<RequirementRecord[]>([]);
  const [summary, setSummary] = useState<RequirementsSummary | null>(null);
  const [gapAnalysis, setGapAnalysis] = useState<CompletenessGapAnalysis | null>(null);

  // Loading & Generation state
  const [isLoadingStored, setIsLoadingStored] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationStep, setGenerationStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters for requirements table
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Editing requirement modal / inline state
  const [editingRequirement, setEditingRequirement] =
    useState<RequirementRecord | null>(null);

  // Admin notes on summary
  const [adminSummaryNotes, setAdminSummaryNotes] = useState<string>('');
  const [isSavingNotes, setIsSavingNotes] = useState<boolean>(false);

  // Load existing analysis from Firestore on mount
  const loadExistingData = useCallback(async () => {
    setIsLoadingStored(true);
    setErrorMessage(null);
    try {
      const [existingReqs, existingSummary, existingGaps] = await Promise.all([
        getSubmissionRequirements(submission.id),
        getRequirementsSummary(submission.id),
        getGapAnalysis(submission.id),
      ]);

      setRequirements(existingReqs);
      setSummary(existingSummary);
      if (existingSummary?.adminNotes) {
        setAdminSummaryNotes(existingSummary.adminNotes);
      }
      setGapAnalysis(existingGaps);
    } catch (err) {
      console.warn('Error loading requirements data:', err);
    } finally {
      setIsLoadingStored(false);
    }
  }, [submission.id]);

  useEffect(() => {
    loadExistingData();
  }, [loadExistingData]);

  // ---------------------------------------------------------------------------
  // GENERATE AI INTELLIGENCE & REQUIREMENTS (EXPLICIT USER ACTION)
  // ---------------------------------------------------------------------------
  const handleGenerateIntelligence = async () => {
    setIsGenerating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // 1. Structured Requirements Extraction
      setGenerationStep('Extracting structured requirements from answers...');
      const extractedReqs = await fetchStructuredRequirements(submission, sections);

      // Save to Firestore
      await saveSubmissionRequirements(submission.id, extractedReqs);
      setRequirements(extractedReqs);

      // 2. Requirements Summary by Category
      setGenerationStep('Synthesizing categorized requirements summary...');
      const generatedSummary = await fetchRequirementsSummary(submission, sections);
      await saveRequirementsSummary(submission.id, generatedSummary);
      setSummary(generatedSummary);
      if (generatedSummary.adminNotes) {
        setAdminSummaryNotes(generatedSummary.adminNotes);
      }

      // 3. Completeness & Gap Audit
      setGenerationStep('Auditing response completeness and detecting potential gaps...');
      const auditResult = await fetchGapAnalysis(submission, sections);
      await saveGapAnalysis(submission.id, auditResult);
      setGapAnalysis(auditResult);

      setSuccessMessage(
        `Analysis complete: Extracted ${extractedReqs.length} requirement(s) and completed audit.`
      );
    } catch (err) {
      console.error('AI Analysis failed:', err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Failed to run AI requirements analysis. Please verify your GEMINI_API_KEY.'
      );
    } finally {
      setIsGenerating(false);
      setGenerationStep('');
    }
  };

  // ---------------------------------------------------------------------------
  // REQUIREMENT RECORD ACTIONS
  // ---------------------------------------------------------------------------
  const handleUpdateStatus = async (
    reqId: string,
    newStatus: RequirementStatus
  ) => {
    try {
      await updateRequirementRecord(submission.id, reqId, { status: newStatus });
      setRequirements((prev) =>
        prev.map((r) => (r.id === reqId ? { ...r, status: newStatus } : r))
      );
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleUpdatePriority = async (
    reqId: string,
    newPriority: RequirementPriority
  ) => {
    try {
      await updateRequirementRecord(submission.id, reqId, {
        priority: newPriority,
      });
      setRequirements((prev) =>
        prev.map((r) => (r.id === reqId ? { ...r, priority: newPriority } : r))
      );
    } catch (err) {
      console.error('Failed to update priority:', err);
    }
  };

  const handleSaveEditedRequirement = async () => {
    if (!editingRequirement) return;

    try {
      await updateRequirementRecord(submission.id, editingRequirement.id, {
        title: editingRequirement.title,
        description: editingRequirement.description,
        category: editingRequirement.category,
        priority: editingRequirement.priority,
        status: editingRequirement.status,
        notes: editingRequirement.notes,
      });

      setRequirements((prev) =>
        prev.map((r) =>
          r.id === editingRequirement.id ? { ...editingRequirement } : r
        )
      );
      setEditingRequirement(null);
    } catch (err) {
      console.error('Failed to save edited requirement:', err);
    }
  };

  const handleSaveAdminSummaryNotes = async () => {
    if (!summary) return;
    setIsSavingNotes(true);
    try {
      const updatedSummary = { ...summary, adminNotes: adminSummaryNotes };
      await saveRequirementsSummary(submission.id, updatedSummary);
      setSummary(updatedSummary);
      setSuccessMessage('Admin notes saved successfully.');
    } catch (err) {
      console.error('Failed to save notes:', err);
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Filtered Requirements
  const filteredRequirements = requirements.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchTitle = r.title.toLowerCase().includes(query);
      const matchDesc = r.description.toLowerCase().includes(query);
      const matchSource = (r.sourceQuestionText || '').toLowerCase().includes(query);
      if (!matchTitle && !matchDesc && !matchSource) return false;
    }
    return true;
  });

  const acceptedCount = requirements.filter((r) => r.status === 'accepted').length;
  const pendingCount = requirements.filter((r) => r.status === 'pending').length;
  const rejectedCount = requirements.filter((r) => r.status === 'rejected').length;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-stone-50/50">
      {/* 1. TOP CONTROLS & EXPORT BAR */}
      <div className="bg-white border-b border-stone-200 px-4 sm:px-6 py-3 shrink-0 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-stone-900 text-white flex items-center justify-center shadow-xs">
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-stone-900">
                Requirements Intelligence & Extraction
              </h3>
              <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">
                Phase 5
              </span>
            </div>
            <p className="text-[11px] text-stone-500">
              Assisted analysis, structured requirements extraction, and gap verification.
            </p>
          </div>
        </div>

        {/* Action buttons: Generate & Exports */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleGenerateIntelligence}
            disabled={isGenerating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-50 transition cursor-pointer shadow-xs"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span>{generationStep || 'Analyzing...'}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>{requirements.length > 0 ? 'Re-run Analysis' : 'Run AI Analysis'}</span>
              </>
            )}
          </button>

          {/* Export Processed Requirements */}
          <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200">
            <button
              type="button"
              onClick={() =>
                exportRequirementsToPdf(submission, requirements, summary, gapAnalysis)
              }
              title="Export requirements report to PDF"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-stone-700 hover:bg-white hover:shadow-2xs transition cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5 text-stone-600" />
              <span>PDF</span>
            </button>

            <button
              type="button"
              onClick={() => exportRequirementsToCsv(submission, requirements)}
              title="Export requirements table to CSV"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-stone-700 hover:bg-white hover:shadow-2xs transition cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-stone-600" />
              <span>CSV</span>
            </button>

            <button
              type="button"
              onClick={() =>
                exportRequirementsToJson(submission, requirements, summary, gapAnalysis)
              }
              title="Export full requirements schema to JSON"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-stone-700 hover:bg-white hover:shadow-2xs transition cursor-pointer"
            >
              <FileCode className="w-3.5 h-3.5 text-stone-600" />
              <span>JSON</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. SUB-VIEW TABS */}
      <div className="bg-stone-100/80 border-b border-stone-200 px-4 sm:px-6 flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setActiveView('requirements_review')}
          className={`px-3 py-2.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
            activeView === 'requirements_review'
              ? 'border-stone-900 text-stone-900 bg-white shadow-2xs'
              : 'border-transparent text-stone-600 hover:text-stone-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-stone-600" />
          <span>Extracted Requirements ({requirements.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveView('summary_categories')}
          className={`px-3 py-2.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
            activeView === 'summary_categories'
              ? 'border-stone-900 text-stone-900 bg-white shadow-2xs'
              : 'border-transparent text-stone-600 hover:text-stone-900'
          }`}
        >
          <Tag className="w-3.5 h-3.5 text-stone-600" />
          <span>Requirements Summary</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveView('gap_analysis')}
          className={`px-3 py-2.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
            activeView === 'gap_analysis'
              ? 'border-stone-900 text-stone-900 bg-white shadow-2xs'
              : 'border-transparent text-stone-600 hover:text-stone-900'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          <span>Completeness & Gaps {gapAnalysis ? `(${gapAnalysis.warnings.length})` : ''}</span>
        </button>
      </div>

      {/* Status Notifications */}
      {errorMessage && (
        <div className="mx-4 sm:mx-6 mt-3 bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="mx-4 sm:mx-6 mt-3 bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* 3. MAIN CONTENT CONTAINER */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {isLoadingStored ? (
          <div className="text-center py-16 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin text-stone-400 mx-auto" />
            <p className="text-xs text-stone-500 font-semibold">Loading requirements analysis...</p>
          </div>
        ) : requirements.length === 0 && !summary && !gapAnalysis ? (
          /* Empty state */
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-stone-300 p-8 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-stone-800">
              No Requirements Extracted Yet
            </h4>
            <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
              Click &quot;Run AI Analysis&quot; above to synthesize the client&apos;s responses into structured, reviewable requirement records and completeness warnings.
            </p>
            <button
              type="button"
              onClick={handleGenerateIntelligence}
              disabled={isGenerating}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 transition cursor-pointer shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Run AI Analysis</span>
            </button>
          </div>
        ) : (
          <>
            {/* VIEW 1: STRUCTURED REQUIREMENTS REVIEW */}
            {activeView === 'requirements_review' && (
              <div className="space-y-4">
                {/* Stats & Status Filters */}
                <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-stone-600">Review Status:</span>
                      <span className="bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-200">
                        {acceptedCount} Accepted
                      </span>
                      <span className="bg-amber-50 text-amber-800 font-bold px-2 py-0.5 rounded border border-amber-200">
                        {pendingCount} Pending
                      </span>
                      <span className="bg-rose-50 text-rose-800 font-bold px-2 py-0.5 rounded border border-rose-200">
                        {rejectedCount} Rejected
                      </span>
                    </div>

                    <div className="text-[11px] text-stone-500">
                      Original client answers remain strictly untouched.
                    </div>
                  </div>

                  {/* Filter Toolbar */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-stone-100">
                    {/* Search */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search requirements..."
                        className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-stone-200 focus:outline-none focus:border-stone-900"
                      />
                    </div>

                    {/* Status filter */}
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="text-xs px-3 py-1.5 rounded-xl border border-stone-200 bg-white focus:outline-none focus:border-stone-900"
                    >
                      <option value="all">All Statuses</option>
                      <option value="pending">Pending Review</option>
                      <option value="accepted">Accepted</option>
                      <option value="rejected">Rejected</option>
                    </select>

                    {/* Category filter */}
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="text-xs px-3 py-1.5 rounded-xl border border-stone-200 bg-white focus:outline-none focus:border-stone-900"
                    >
                      <option value="all">All Categories</option>
                      {Object.entries(CATEGORY_LABELS).map(([cat, label]) => (
                        <option key={cat} value={cat}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* List of Requirement Cards */}
                <div className="space-y-3">
                  {filteredRequirements.length === 0 ? (
                    <div className="bg-white rounded-2xl p-6 text-center text-xs text-stone-500 border border-stone-200">
                      No requirements match the current filters.
                    </div>
                  ) : (
                    filteredRequirements.map((req, idx) => (
                      <div
                        key={req.id}
                        className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all shadow-2xs space-y-3 ${
                          req.status === 'accepted'
                            ? 'border-emerald-200/80 bg-emerald-50/10'
                            : req.status === 'rejected'
                            ? 'border-stone-200 opacity-60'
                            : 'border-stone-200'
                        }`}
                      >
                        {/* Card Header Row */}
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] font-mono font-bold bg-stone-100 text-stone-700 px-2 py-0.5 rounded">
                                #{idx + 1}
                              </span>

                              {/* Category Badge */}
                              <span className="text-[10px] font-bold bg-stone-900 text-white px-2 py-0.5 rounded">
                                {CATEGORY_LABELS[req.category] || req.category}
                              </span>

                              {/* Priority Badge */}
                              <select
                                value={req.priority}
                                onChange={(e) =>
                                  handleUpdatePriority(
                                    req.id,
                                    e.target.value as RequirementPriority
                                  )
                                }
                                className={`text-[10px] font-bold uppercase rounded px-2 py-0.5 border cursor-pointer ${
                                  req.priority === 'high'
                                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                                    : req.priority === 'medium'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-stone-100 text-stone-600 border-stone-200'
                                }`}
                              >
                                <option value="high">High Priority</option>
                                <option value="medium">Medium Priority</option>
                                <option value="low">Low Priority</option>
                              </select>

                              {/* Status Badge */}
                              <span
                                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                  req.status === 'accepted'
                                    ? 'bg-emerald-100 text-emerald-900'
                                    : req.status === 'rejected'
                                    ? 'bg-rose-100 text-rose-900'
                                    : 'bg-amber-100 text-amber-900'
                                }`}
                              >
                                {req.status}
                              </span>
                            </div>

                            <h4 className="text-sm font-bold text-stone-900">
                              {req.title}
                            </h4>
                          </div>

                          {/* Quick Review Actions: Accept / Reject / Edit */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(req.id, 'accepted')}
                              disabled={req.status === 'accepted'}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                req.status === 'accepted'
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-stone-100 hover:bg-emerald-50 text-stone-700 hover:text-emerald-800'
                              }`}
                              title="Accept requirement"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Accept</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(req.id, 'rejected')}
                              disabled={req.status === 'rejected'}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                req.status === 'rejected'
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-stone-100 hover:bg-rose-50 text-stone-700 hover:text-rose-800'
                              }`}
                              title="Reject requirement"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setEditingRequirement(req)}
                              className="p-1 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition cursor-pointer"
                              title="Edit requirement details"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-xs text-stone-700 leading-relaxed">
                          {req.description}
                        </p>

                        {/* Source Traceability & Admin Notes */}
                        <div className="space-y-1.5 pt-2 border-t border-stone-100 text-[11px]">
                          {req.sourceQuestionText && (
                            <div className="text-stone-500 flex items-start gap-1">
                              <span className="font-semibold shrink-0">Source:</span>
                              <span className="italic truncate">&quot;{req.sourceQuestionText}&quot;</span>
                            </div>
                          )}

                          {req.notes && (
                            <div className="text-amber-900 bg-amber-50/70 p-2 rounded-lg border border-amber-100">
                              <span className="font-semibold block text-[10px] uppercase">Notes:</span>
                              <span>{req.notes}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* VIEW 2: CATEGORIZED REQUIREMENTS SUMMARY */}
            {activeView === 'summary_categories' && (
              <div className="space-y-4">
                {summary ? (
                  <>
                    {/* Executive Overview */}
                    <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                        Executive Overview
                      </span>
                      <p className="text-xs sm:text-sm text-stone-800 leading-relaxed">
                        {summary.overview}
                      </p>
                    </div>

                    {/* Categories Matrix */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {summary.categories.map((catGroup) => (
                        <div
                          key={catGroup.category}
                          className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 shadow-2xs space-y-3"
                        >
                          <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                            <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                              {catGroup.label || CATEGORY_LABELS[catGroup.category]}
                            </h4>
                            <span className="text-[10px] font-bold bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">
                              {catGroup.items?.length || 0}
                            </span>
                          </div>

                          <div className="space-y-2">
                            {catGroup.items && catGroup.items.length > 0 ? (
                              catGroup.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="text-xs p-2.5 rounded-xl border border-stone-100 bg-stone-50/70 space-y-1"
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span
                                      className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${
                                        item.type === 'explicit'
                                          ? 'bg-blue-100 text-blue-900'
                                          : item.type === 'inferred'
                                          ? 'bg-purple-100 text-purple-900'
                                          : 'bg-amber-100 text-amber-900'
                                      }`}
                                    >
                                      {item.type === 'explicit'
                                        ? 'Explicit Fact'
                                        : item.type === 'inferred'
                                        ? 'Inferred / Possible'
                                        : 'Missing Information'}
                                    </span>
                                  </div>
                                  <p className="text-stone-800 leading-relaxed">
                                    {item.text}
                                  </p>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-stone-400 italic">
                                No specific requirements identified in this category.
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Admin Editable Summary Notes */}
                    <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-stone-700">
                          Admin Synthesis Notes
                        </span>
                        <button
                          type="button"
                          onClick={handleSaveAdminSummaryNotes}
                          disabled={isSavingNotes}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 transition cursor-pointer"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{isSavingNotes ? 'Saving...' : 'Save Notes'}</span>
                        </button>
                      </div>
                      <textarea
                        value={adminSummaryNotes}
                        onChange={(e) => setAdminSummaryNotes(e.target.value)}
                        rows={3}
                        placeholder="Add your own commentary, client caveats, or team notes..."
                        className="w-full text-xs text-stone-700 p-3 rounded-xl border border-stone-200 focus:outline-none focus:border-stone-900 resize-y"
                      />
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 bg-white rounded-2xl border border-stone-200 text-xs text-stone-500">
                    No summary generated yet. Click &quot;Run AI Analysis&quot; above.
                  </div>
                )}
              </div>
            )}

            {/* VIEW 3: COMPLETENESS & GAP AUDIT */}
            {activeView === 'gap_analysis' && (
              <div className="space-y-4">
                {gapAnalysis ? (
                  <>
                    {/* Score Banner */}
                    <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                            Completeness Audit
                          </span>
                          <h4 className="text-base font-bold text-stone-900">
                            Questionnaire Quality & Gap Verification
                          </h4>
                          <p className="text-xs text-stone-600 max-w-xl leading-relaxed">
                            {gapAnalysis.summary}
                          </p>
                        </div>

                        {/* Score Indicator */}
                        <div className="text-center bg-stone-50 p-3.5 rounded-2xl border border-stone-200 min-w-[120px]">
                          <span className="text-2xl font-black text-stone-900">
                            {gapAnalysis.completenessScore}%
                          </span>
                          <span className="block text-[10px] font-bold uppercase text-stone-500 mt-0.5">
                            Completeness
                          </span>
                        </div>
                      </div>

                      {/* Advisory Disclaimer */}
                      <div className="flex items-center gap-2 text-[11px] text-amber-900 bg-amber-50 p-2.5 rounded-xl border border-amber-200/80">
                        <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          Notice: AI completeness warnings are informational guidance for admin review, not automatic facts.
                        </span>
                      </div>
                    </div>

                    {/* Warnings List */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                        Audit Warnings & Observations ({gapAnalysis.warnings.length})
                      </h4>

                      {gapAnalysis.warnings.length === 0 ? (
                        <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-200 text-center text-xs text-emerald-900 space-y-1">
                          <ShieldCheck className="w-6 h-6 text-emerald-600 mx-auto" />
                          <p className="font-bold">No gaps or conflicts identified.</p>
                          <p className="text-emerald-700">
                            The client provided comprehensive and consistent responses across all required sections.
                          </p>
                        </div>
                      ) : (
                        gapAnalysis.warnings.map((warn) => (
                          <div
                            key={warn.id}
                            className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 shadow-2xs space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                    warn.severity === 'high'
                                      ? 'bg-rose-100 text-rose-900'
                                      : warn.severity === 'medium'
                                      ? 'bg-amber-100 text-amber-900'
                                      : 'bg-stone-100 text-stone-700'
                                  }`}
                                >
                                  {warn.severity} Severity
                                </span>
                                <span className="text-[10px] font-mono text-stone-500">
                                  {warn.type.replace(/_/g, ' ')}
                                </span>
                              </div>
                            </div>

                            <h5 className="text-xs font-bold text-stone-900">
                              {warn.title}
                            </h5>
                            <p className="text-xs text-stone-700 leading-relaxed">
                              {warn.description}
                            </p>

                            {warn.relatedQuestionText && (
                              <div className="text-[11px] text-stone-500 italic pt-1 border-t border-stone-100">
                                Related to: &quot;{warn.relatedQuestionText}&quot;
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 bg-white rounded-2xl border border-stone-200 text-xs text-stone-500">
                    No gap analysis generated yet. Click &quot;Run AI Analysis&quot; above.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* 4. EDIT REQUIREMENT MODAL */}
      {editingRequirement && (
        <div
          className="fixed inset-0 z-60 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={() => setEditingRequirement(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-stone-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-900">
                Edit Extracted Requirement
              </h3>
              <button
                type="button"
                onClick={() => setEditingRequirement(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={editingRequirement.title}
                  onChange={(e) =>
                    setEditingRequirement({
                      ...editingRequirement,
                      title: e.target.value,
                    })
                  }
                  className="w-full text-xs font-semibold px-3 py-2 rounded-xl border border-stone-200 focus:outline-none focus:border-stone-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Category
                  </label>
                  <select
                    value={editingRequirement.category}
                    onChange={(e) =>
                      setEditingRequirement({
                        ...editingRequirement,
                        category: e.target.value as RequirementCategory,
                      })
                    }
                    className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 focus:outline-none focus:border-stone-900"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([cat, label]) => (
                      <option key={cat} value={cat}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={editingRequirement.priority}
                    onChange={(e) =>
                      setEditingRequirement({
                        ...editingRequirement,
                        priority: e.target.value as RequirementPriority,
                      })
                    }
                    className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 focus:outline-none focus:border-stone-900"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Description / Specification
                </label>
                <textarea
                  value={editingRequirement.description}
                  onChange={(e) =>
                    setEditingRequirement({
                      ...editingRequirement,
                      description: e.target.value,
                    })
                  }
                  rows={4}
                  className="w-full text-xs text-stone-700 p-3 rounded-xl border border-stone-200 focus:outline-none focus:border-stone-900 resize-y"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Admin Notes
                </label>
                <input
                  type="text"
                  value={editingRequirement.notes || ''}
                  onChange={(e) =>
                    setEditingRequirement({
                      ...editingRequirement,
                      notes: e.target.value,
                    })
                  }
                  placeholder="Optional internal notes..."
                  className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 focus:outline-none focus:border-stone-900"
                />
              </div>
            </div>

            <div className="p-4 border-t border-stone-200 bg-stone-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingRequirement(null)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditedRequirement}
                className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 transition cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
