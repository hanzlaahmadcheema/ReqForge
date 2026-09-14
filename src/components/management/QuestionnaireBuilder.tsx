import React, { useState } from 'react';
import {
  ArrowLeft,
  Save,
  Send,
  Eye,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Check,
  AlertTriangle,
  Layers,
  HelpCircle,
  Settings2,
  GitBranch,
  ListPlus,
  Sliders,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  FileCode,
} from 'lucide-react';
import {
  Questionnaire,
  Section,
  Question,
  QuestionOption,
  QuestionType,
  ConditionalRule,
  ConditionalOperator,
} from '../../types';
import { validateQuestionnaireForPublish } from '../../lib/questionnaireValidation';
import { saveQuestionnaire, publishQuestionnaire } from '../../lib/questionnaireService';
import { QuestionnairePreviewModal } from './QuestionnairePreviewModal';
import { AiQuestionnaireAssistantModal } from './AiQuestionnaireAssistantModal';
import { QuestionnaireJsonModal } from './QuestionnaireJsonModal';

interface QuestionnaireBuilderProps {
  initialQuestionnaire: Questionnaire;
  onBack: () => void;
  onSaved?: (saved: Questionnaire) => void;
  onPublished?: (published: Questionnaire) => void;
}

export const QuestionnaireBuilder: React.FC<QuestionnaireBuilderProps> = ({
  initialQuestionnaire,
  onBack,
  onSaved,
  onPublished,
}) => {
  const [questionnaire, setQuestionnaire] = useState<Questionnaire>(initialQuestionnaire);
  const [selectedSectionIndex, setSelectedSectionIndex] = useState<number>(0);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState<boolean>(false);
  const [targetQuestionForAi, setTargetQuestionForAi] = useState<{
    sectionIndex: number;
    questionIndex: number;
    question: Question;
  } | null>(null);
  const [jsonModalMode, setJsonModalMode] = useState<'import' | 'export' | null>(null);

  // Active section helper
  const sections = questionnaire.sections || [];
  const activeSection = sections[selectedSectionIndex] as Section | undefined;

  // AI Assistant Handlers
  const handleAddQuestionsFromAi = (sectionIndex: number, newQuestions: Question[]) => {
    setQuestionnaire((prev) => {
      const nextSections = [...prev.sections];
      const sec = nextSections[sectionIndex];
      if (!sec) return prev;
      const existing = sec.questions || [];
      nextSections[sectionIndex] = {
        ...sec,
        questions: [...existing, ...newQuestions],
      };
      return { ...prev, sections: nextSections };
    });
  };

  const handleUpdateQuestionFromAi = (
    sectionIndex: number,
    questionIndex: number,
    updates: Partial<Question>
  ) => {
    setQuestionnaire((prev) => {
      const nextSections = [...prev.sections];
      const sec = nextSections[sectionIndex];
      if (!sec) return prev;
      const questions = [...(sec.questions || [])];
      if (!questions[questionIndex]) return prev;
      questions[questionIndex] = { ...questions[questionIndex], ...updates };
      nextSections[sectionIndex] = { ...sec, questions };
      return { ...prev, sections: nextSections };
    });
  };

  // Flattened list of all questions across all sections (for conditional logic source selection)
  const allQuestions = sections.flatMap((sec, sIdx) =>
    (sec.questions || []).map((q, qIdx) => ({
      ...q,
      sectionIndex: sIdx,
      sectionTitle: sec.title || `Section ${sIdx + 1}`,
      displayLabel: `[${sec.title || `Sec ${sIdx + 1}`}] ${q.text || q.title || `Q${qIdx + 1}`}`,
    }))
  );

  // ---------------------------------------------------------------------------
  // QUESTIONNAIRE METADATA HANDLERS
  // ---------------------------------------------------------------------------
  const updateTitle = (title: string) => {
    setQuestionnaire((prev) => ({ ...prev, title }));
  };

  const updateDescription = (description: string) => {
    setQuestionnaire((prev) => ({ ...prev, description }));
  };

  // ---------------------------------------------------------------------------
  // SECTION BUILDER HANDLERS
  // ---------------------------------------------------------------------------
  const addSection = () => {
    const newSectionIndex = sections.length + 1;
    const newSec: Section = {
      id: `sec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      questionnaireId: questionnaire.id,
      title: `New Section ${newSectionIndex}`,
      description: '',
      order: newSectionIndex,
      enabled: true,
      questions: [
        {
          id: `q_${Date.now()}_1`,
          text: 'First question',
          type: 'text',
          required: false,
          enabled: true,
          order: 1,
        },
      ],
    };

    setQuestionnaire((prev) => ({
      ...prev,
      sections: [...prev.sections, newSec],
    }));
    setSelectedSectionIndex(sections.length);
  };

  const updateSectionTitle = (index: number, title: string) => {
    setQuestionnaire((prev) => {
      const nextSections = [...prev.sections];
      nextSections[index] = { ...nextSections[index], title };
      return { ...prev, sections: nextSections };
    });
  };

  const updateSectionDescription = (index: number, description: string) => {
    setQuestionnaire((prev) => {
      const nextSections = [...prev.sections];
      nextSections[index] = { ...nextSections[index], description };
      return { ...prev, sections: nextSections };
    });
  };

  const toggleSectionEnabled = (index: number) => {
    setQuestionnaire((prev) => {
      const nextSections = [...prev.sections];
      const currentVal = nextSections[index].enabled ?? true;
      nextSections[index] = { ...nextSections[index], enabled: !currentVal };
      return { ...prev, sections: nextSections };
    });
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    setQuestionnaire((prev) => {
      const nextSections = [...prev.sections];
      const temp = nextSections[index];
      nextSections[index] = nextSections[targetIndex];
      nextSections[targetIndex] = temp;

      // Re-assign order numbers
      nextSections.forEach((s, idx) => {
        s.order = idx + 1;
      });

      return { ...prev, sections: nextSections };
    });

    setSelectedSectionIndex(targetIndex);
  };

  const deleteSection = (index: number) => {
    if (sections.length <= 1) {
      alert('A questionnaire must have at least one section.');
      return;
    }

    if (!window.confirm(`Delete section "${sections[index].title || `Section ${index + 1}`}"?`)) {
      return;
    }

    setQuestionnaire((prev) => {
      const nextSections = prev.sections.filter((_, idx) => idx !== index);
      nextSections.forEach((s, idx) => {
        s.order = idx + 1;
      });
      return { ...prev, sections: nextSections };
    });

    setSelectedSectionIndex((prev) => Math.max(0, prev - 1));
  };

  // ---------------------------------------------------------------------------
  // QUESTION BUILDER HANDLERS
  // ---------------------------------------------------------------------------
  const addQuestion = () => {
    if (!activeSection) return;

    const newQOrder = (activeSection.questions || []).length + 1;
    const newQuestion: Question = {
      id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sectionId: activeSection.id,
      text: '',
      type: 'text',
      required: false,
      enabled: true,
      order: newQOrder,
    };

    setQuestionnaire((prev) => {
      const nextSections = [...prev.sections];
      const currentQuestions = nextSections[selectedSectionIndex].questions || [];
      nextSections[selectedSectionIndex] = {
        ...nextSections[selectedSectionIndex],
        questions: [...currentQuestions, newQuestion],
      };
      return { ...prev, sections: nextSections };
    });
  };

  const updateQuestion = (qIndex: number, updates: Partial<Question>) => {
    setQuestionnaire((prev) => {
      const nextSections = [...prev.sections];
      const currentQuestions = [...(nextSections[selectedSectionIndex].questions || [])];
      currentQuestions[qIndex] = { ...currentQuestions[qIndex], ...updates };
      nextSections[selectedSectionIndex] = {
        ...nextSections[selectedSectionIndex],
        questions: currentQuestions,
      };
      return { ...prev, sections: nextSections };
    });
  };

  const moveQuestion = (qIndex: number, direction: 'up' | 'down') => {
    if (!activeSection) return;
    const currentQuestions = activeSection.questions || [];
    const targetIndex = direction === 'up' ? qIndex - 1 : qIndex + 1;
    if (targetIndex < 0 || targetIndex >= currentQuestions.length) return;

    setQuestionnaire((prev) => {
      const nextSections = [...prev.sections];
      const nextQ = [...(nextSections[selectedSectionIndex].questions || [])];
      const temp = nextQ[qIndex];
      nextQ[qIndex] = nextQ[targetIndex];
      nextQ[targetIndex] = temp;

      nextQ.forEach((q, idx) => {
        q.order = idx + 1;
      });

      nextSections[selectedSectionIndex] = {
        ...nextSections[selectedSectionIndex],
        questions: nextQ,
      };
      return { ...prev, sections: nextSections };
    });
  };

  const deleteQuestion = (qIndex: number) => {
    if (!activeSection) return;
    const q = activeSection.questions[qIndex];
    if (!window.confirm(`Delete question "${q.text || `Question ${qIndex + 1}`}"?`)) {
      return;
    }

    setQuestionnaire((prev) => {
      const nextSections = [...prev.sections];
      const nextQ = (nextSections[selectedSectionIndex].questions || []).filter(
        (_, idx) => idx !== qIndex
      );
      nextQ.forEach((item, idx) => {
        item.order = idx + 1;
      });

      nextSections[selectedSectionIndex] = {
        ...nextSections[selectedSectionIndex],
        questions: nextQ,
      };
      return { ...prev, sections: nextSections };
    });
  };

  // ---------------------------------------------------------------------------
  // OPTIONS BUILDER (CHOICE QUESTIONS)
  // ---------------------------------------------------------------------------
  const addOption = (qIndex: number) => {
    if (!activeSection) return;
    const currentQ = activeSection.questions[qIndex];
    const existingOptions = currentQ.options || [];
    const nextIdx = existingOptions.length + 1;
    const newOption: QuestionOption = {
      label: `Option ${nextIdx}`,
      value: `option_${nextIdx}`,
    };

    updateQuestion(qIndex, {
      options: [...existingOptions, newOption],
    });
  };

  const updateOption = (qIndex: number, optIndex: number, updates: Partial<QuestionOption>) => {
    if (!activeSection) return;
    const currentQ = activeSection.questions[qIndex];
    const nextOptions = [...(currentQ.options || [])];
    nextOptions[optIndex] = { ...nextOptions[optIndex], ...updates };

    // Auto-sync value if value is untouched or simple slug
    if (updates.label && (!nextOptions[optIndex].value || nextOptions[optIndex].value.startsWith('option_'))) {
      nextOptions[optIndex].value = updates.label.toLowerCase().replace(/[^a-z0-9]/g, '_');
    }

    updateQuestion(qIndex, { options: nextOptions });
  };

  const deleteOption = (qIndex: number, optIndex: number) => {
    if (!activeSection) return;
    const currentQ = activeSection.questions[qIndex];
    const nextOptions = (currentQ.options || []).filter((_, idx) => idx !== optIndex);
    updateQuestion(qIndex, { options: nextOptions });
  };

  // ---------------------------------------------------------------------------
  // CONDITIONAL LOGIC BUILDER
  // ---------------------------------------------------------------------------
  const toggleConditionalRule = (qIndex: number) => {
    if (!activeSection) return;
    const currentQ = activeSection.questions[qIndex];
    if (currentQ.conditionalRule) {
      // Remove rule
      updateQuestion(qIndex, { conditionalRule: undefined });
    } else {
      // Find default candidate source question (first question not equal to this)
      const candidate = allQuestions.find((q) => q.id !== currentQ.id);
      const defaultRule: ConditionalRule = {
        sourceQuestionId: candidate ? candidate.id : '',
        dependsOnQuestionId: candidate ? candidate.id : '',
        operator: 'equals',
        value: candidate?.type === 'yes_no' ? true : candidate?.options?.[0]?.value || 'Yes',
      };
      updateQuestion(qIndex, { conditionalRule: defaultRule });
    }
  };

  const updateConditionalRule = (qIndex: number, updates: Partial<ConditionalRule>) => {
    if (!activeSection) return;
    const currentQ = activeSection.questions[qIndex];
    const currentRule = currentQ.conditionalRule;
    if (!currentRule) return;

    const newRule: ConditionalRule = {
      ...currentRule,
      ...updates,
    };
    if (updates.sourceQuestionId) {
      newRule.dependsOnQuestionId = updates.sourceQuestionId;
    }

    updateQuestion(qIndex, { conditionalRule: newRule });
  };

  // ---------------------------------------------------------------------------
  // SAVE & PUBLISH HANDLERS
  // ---------------------------------------------------------------------------
  const handleSaveDraft = async () => {
    setIsSaving(true);
    setStatusMessage(null);
    setValidationErrors([]);

    try {
      const saved = await saveQuestionnaire(questionnaire);
      setQuestionnaire(saved);
      setStatusMessage({ type: 'success', text: 'Draft saved successfully.' });
      if (onSaved) onSaved(saved);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Failed to save draft: ${err?.message || 'Unknown error'}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    setStatusMessage(null);

    // Validate questionnaire
    const result = validateQuestionnaireForPublish(questionnaire);
    if (!result.valid) {
      setValidationErrors(result.errors.map((e) => e.message));
      setStatusMessage({
        type: 'error',
        text: `Cannot publish: please resolve ${result.errors.length} validation issues.`,
      });
      setIsPublishing(false);
      return;
    }

    setValidationErrors([]);

    try {
      const published = await publishQuestionnaire(questionnaire);
      setQuestionnaire(published);
      setStatusMessage({
        type: 'success',
        text: `Questionnaire published as Version ${published.version}. Historical snapshot preserved.`,
      });
      if (onPublished) onPublished(published);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Publication failed: ${err?.message || 'Unknown error'}`,
      });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-stone-50 flex flex-col">
      {/* 1. TOP HEADER & ACTION BAR */}
      <header className="sticky top-0 z-30 bg-white border-b border-stone-200 px-4 py-3 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                  Questionnaire Builder
                </span>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    questionnaire.status === 'published'
                      ? 'bg-emerald-100 text-emerald-800'
                      : questionnaire.status === 'archived'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {questionnaire.status}
                </span>
                <span className="text-xs font-bold text-stone-500">
                  v{questionnaire.version || 1}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setJsonModalMode('import')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 transition cursor-pointer"
              title="Build questionnaire using AI-generated JSON"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Build with AI (JSON)</span>
            </button>

            <button
              type="button"
              onClick={() => setJsonModalMode('export')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 transition cursor-pointer"
              title="Export current questionnaire as JSON template"
            >
              <FileCode className="w-3.5 h-3.5 text-stone-600" />
              <span>Export JSON</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPreviewOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 transition cursor-pointer"
              title="Preview with client form renderer"
            >
              <Eye className="w-3.5 h-3.5 text-stone-500" />
              <span>Preview</span>
            </button>

            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-stone-800 bg-white border border-stone-300 hover:bg-stone-50 transition cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5 text-stone-600" />
              <span>{isSaving ? 'Saving...' : 'Save Draft'}</span>
            </button>

            <button
              type="button"
              onClick={handlePublish}
              disabled={isPublishing}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isPublishing ? 'Publishing...' : 'Publish'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* FEEDBACK NOTIFICATION & VALIDATION ERRORS BANNER */}
      <div className="max-w-7xl w-full mx-auto px-4 pt-3 space-y-2">
        {statusMessage && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center justify-between ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border border-rose-200 text-rose-900'
            }`}
          >
            <span>{statusMessage.text}</span>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-stone-400 hover:text-stone-700 text-sm ml-3"
            >
              x
            </button>
          </div>
        )}

        {validationErrors.length > 0 && (
          <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl space-y-1.5 text-xs text-rose-900">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Validation Errors (Must be resolved before publishing):</span>
            </div>
            <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-rose-800">
              {validationErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 2. QUESTIONNAIRE TITLE & DESCRIPTION HEADER BLOCK */}
      <div className="max-w-7xl w-full mx-auto px-4 py-3">
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 shadow-xs space-y-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-1">
              Questionnaire Title
            </label>
            <input
              type="text"
              value={questionnaire.title}
              onChange={(e) => updateTitle(e.target.value)}
              placeholder="e.g., Enterprise Web Application Requirements"
              className="w-full text-base sm:text-lg font-bold text-stone-900 px-3 py-2 rounded-xl border border-stone-200 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-1">
              Description / Instructions for Clients
            </label>
            <textarea
              value={questionnaire.description}
              onChange={(e) => updateDescription(e.target.value)}
              rows={2}
              placeholder="Instructions or scope overview presented to clients..."
              className="w-full text-xs text-stone-700 px-3 py-2 rounded-xl border border-stone-200 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 focus:outline-none resize-y"
            />
          </div>
        </div>
      </div>

      {/* 3. SPLIT MAIN WORKSPACE: SECTIONS LIST (LEFT) & QUESTION EDITOR (RIGHT) */}
      <div className="max-w-7xl w-full mx-auto px-4 pb-12 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT COLUMN: SECTIONS NAVIGATION */}
        <aside className="lg:col-span-4 space-y-3">
          <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs space-y-3 sticky top-20">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-stone-500" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                  Sections ({sections.length})
                </h2>
              </div>
              <button
                type="button"
                onClick={addSection}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 transition cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Section</span>
              </button>
            </div>

            {/* Sections List */}
            <div className="space-y-1.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {sections.map((sec, idx) => {
                const isSelected = idx === selectedSectionIndex;
                const isSecEnabled = sec.enabled !== false;
                const qCount = (sec.questions || []).length;

                return (
                  <div
                    key={sec.id || idx}
                    onClick={() => setSelectedSectionIndex(idx)}
                    className={`group rounded-xl p-3 border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                        : 'bg-stone-50/70 hover:bg-stone-100/80 border-stone-200/80 text-stone-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                              isSelected
                                ? 'bg-stone-800 text-stone-300'
                                : 'bg-stone-200 text-stone-600'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <span
                            className={`text-xs font-bold truncate block ${
                              isSelected ? 'text-white' : 'text-stone-900'
                            } ${!isSecEnabled ? 'line-through opacity-60' : ''}`}
                          >
                            {sec.title || `Section ${idx + 1}`}
                          </span>
                        </div>
                        <p
                          className={`text-[11px] truncate mt-0.5 ${
                            isSelected ? 'text-stone-400' : 'text-stone-500'
                          }`}
                        >
                          {qCount} {qCount === 1 ? 'question' : 'questions'}
                          {!isSecEnabled && ' • Disabled'}
                        </p>
                      </div>

                      {/* Section order & delete quick buttons */}
                      <div
                        className="flex items-center gap-0.5 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveSection(idx, 'up')}
                          className={`p-1 rounded hover:bg-stone-200/50 transition disabled:opacity-20 ${
                            isSelected ? 'hover:bg-stone-800 text-stone-300' : 'text-stone-500'
                          }`}
                          title="Move section up"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === sections.length - 1}
                          onClick={() => moveSection(idx, 'down')}
                          className={`p-1 rounded hover:bg-stone-200/50 transition disabled:opacity-20 ${
                            isSelected ? 'hover:bg-stone-800 text-stone-300' : 'text-stone-500'
                          }`}
                          title="Move section down"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSection(idx)}
                          className={`p-1 rounded hover:bg-rose-100 hover:text-rose-700 transition ${
                            isSelected ? 'hover:bg-rose-900 text-stone-400' : 'text-stone-400'
                          }`}
                          title="Delete section"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* RIGHT COLUMN: SECTION & QUESTIONS EDITOR */}
        <main className="lg:col-span-8 space-y-4">
          {activeSection ? (
            <>
              {/* Active Section Settings Card */}
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                      Section Settings
                    </span>
                    <h3 className="text-sm font-bold text-stone-900">
                      Section {selectedSectionIndex + 1} of {sections.length}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleSectionEnabled(selectedSectionIndex)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        activeSection.enabled !== false
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-stone-100 text-stone-600 border border-stone-200'
                      }`}
                    >
                      {activeSection.enabled !== false ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Enabled</span>
                        </>
                      ) : (
                        <span>Disabled</span>
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                      Section Header Title *
                    </label>
                    <input
                      type="text"
                      value={activeSection.title}
                      onChange={(e) => updateSectionTitle(selectedSectionIndex, e.target.value)}
                      placeholder="e.g., General Information & Scope"
                      className="w-full text-sm font-semibold text-stone-900 px-3 py-2 rounded-xl border border-stone-200 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                      Section Instructions / Description (Optional)
                    </label>
                    <textarea
                      value={activeSection.description || ''}
                      onChange={(e) =>
                        updateSectionDescription(selectedSectionIndex, e.target.value)
                      }
                      rows={2}
                      placeholder="Helper text explaining this section to clients..."
                      className="w-full text-xs text-stone-700 px-3 py-2 rounded-xl border border-stone-200 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 focus:outline-none resize-y"
                    />
                  </div>
                </div>
              </div>

              {/* Questions Container in Active Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-600">
                      Questions in this section ({activeSection.questions?.length || 0})
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTargetQuestionForAi(null);
                        setIsAiAssistantOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-stone-800 bg-stone-100 hover:bg-stone-200 border border-stone-200 transition cursor-pointer shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>AI Assistant</span>
                    </button>

                    <button
                      type="button"
                      onClick={addQuestion}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 transition cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Question</span>
                    </button>
                  </div>
                </div>

                {/* List of Questions */}
                {(activeSection.questions || []).map((question, qIdx) => {
                  const isChoice =
                    question.type === 'single_choice' ||
                    question.type === 'multiple_choice' ||
                    (question.type as string) === 'radio' ||
                    (question.type as string) === 'checkbox';

                  const hasRule = !!question.conditionalRule;

                  return (
                    <div
                      key={question.id || qIdx}
                      className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 shadow-xs space-y-3.5 transition hover:border-stone-300"
                    >
                      {/* Question Top Row Controls */}
                      <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-stone-100 text-stone-700 font-mono text-xs font-bold flex items-center justify-center border border-stone-200">
                            {qIdx + 1}
                          </span>
                          <span className="text-xs font-bold text-stone-700">
                            Question #{qIdx + 1}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Required toggle */}
                          <label className="flex items-center gap-1 text-[11px] font-semibold text-stone-600 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={!!question.required}
                              onChange={(e) =>
                                updateQuestion(qIdx, { required: e.target.checked })
                              }
                              className="rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                            />
                            <span>Required</span>
                          </label>

                          {/* Enable/Disable toggle */}
                          <label className="flex items-center gap-1 text-[11px] font-semibold text-stone-600 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={question.enabled !== false}
                              onChange={(e) =>
                                updateQuestion(qIdx, { enabled: e.target.checked })
                              }
                              className="rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                            />
                            <span>Active</span>
                          </label>

                          {/* Reorder Buttons */}
                          <button
                            type="button"
                            disabled={qIdx === 0}
                            onClick={() => moveQuestion(qIdx, 'up')}
                            className="p-1 rounded text-stone-500 hover:bg-stone-100 transition disabled:opacity-20"
                            title="Move question up"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={qIdx === (activeSection.questions || []).length - 1}
                            onClick={() => moveQuestion(qIdx, 'down')}
                            className="p-1 rounded text-stone-500 hover:bg-stone-100 transition disabled:opacity-20"
                            title="Move question down"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>

                          {/* AI Refine Question */}
                          <button
                            type="button"
                            onClick={() => {
                              setTargetQuestionForAi({
                                sectionIndex: selectedSectionIndex,
                                questionIndex: qIdx,
                                question,
                              });
                              setIsAiAssistantOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-200 transition cursor-pointer"
                            title="Improve wording, type, or follow-ups with AI"
                          >
                            <Sparkles className="w-3 h-3 text-amber-500" />
                            <span>AI Refine</span>
                          </button>

                          {/* Delete Question */}
                          <button
                            type="button"
                            onClick={() => deleteQuestion(qIdx)}
                            className="p-1 rounded text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Delete question"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Question Text and Type Row */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2">
                          <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                            Question Prompt *
                          </label>
                          <input
                            type="text"
                            value={question.text || question.title || ''}
                            onChange={(e) =>
                              updateQuestion(qIdx, {
                                text: e.target.value,
                                title: e.target.value,
                              })
                            }
                            placeholder="e.g., How many active concurrent users are expected?"
                            className="w-full text-xs font-semibold text-stone-900 px-3 py-2 rounded-xl border border-stone-200 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                            Question Type
                          </label>
                          <select
                            value={question.type}
                            onChange={(e) => {
                              const newType = e.target.value as QuestionType;
                              const defaultOpts =
                                newType === 'single_choice' || newType === 'multiple_choice'
                                  ? question.options && question.options.length > 0
                                    ? question.options
                                    : [
                                        { label: 'Option 1', value: 'opt_1' },
                                        { label: 'Option 2', value: 'opt_2' },
                                      ]
                                  : undefined;
                              updateQuestion(qIdx, {
                                type: newType,
                                options: defaultOpts,
                              });
                            }}
                            className="w-full text-xs text-stone-900 px-3 py-2 rounded-xl border border-stone-200 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 focus:outline-none bg-white font-medium"
                          >
                            <option value="text">Text (Short input)</option>
                            <option value="textarea">Textarea (Long response)</option>
                            <option value="single_choice">Single Choice (Radio)</option>
                            <option value="multiple_choice">Multiple Choice (Checkboxes)</option>
                            <option value="yes_no">Yes / No</option>
                            <option value="number">Number</option>
                            <option value="date">Date</option>
                          </select>
                        </div>
                      </div>

                      {/* Helper description & guidance */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                            Help Text / Guidance (Optional)
                          </label>
                          <input
                            type="text"
                            value={question.description || question.helperText || ''}
                            onChange={(e) =>
                              updateQuestion(qIdx, {
                                description: e.target.value,
                                helperText: e.target.value,
                              })
                            }
                            placeholder="Helpful guidance for the client answering..."
                            className="w-full text-xs text-stone-700 px-3 py-1.5 rounded-lg border border-stone-200 focus:border-stone-900 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                            Placeholder / Unit (Optional)
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={question.placeholder || ''}
                              onChange={(e) =>
                                updateQuestion(qIdx, { placeholder: e.target.value })
                              }
                              placeholder="Placeholder text..."
                              className="flex-1 text-xs text-stone-700 px-3 py-1.5 rounded-lg border border-stone-200 focus:border-stone-900 focus:outline-none"
                            />
                            {question.type === 'number' && (
                              <input
                                type="text"
                                value={question.unit || ''}
                                onChange={(e) =>
                                  updateQuestion(qIdx, { unit: e.target.value })
                                }
                                placeholder="Unit (e.g. users, $)"
                                className="w-24 text-xs text-stone-700 px-3 py-1.5 rounded-lg border border-stone-200 focus:border-stone-900 focus:outline-none"
                              />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* OPTIONS BUILDER (IF CHOICE QUESTION) */}
                      {isChoice && (
                        <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
                              <ListPlus className="w-3.5 h-3.5 text-stone-500" />
                              <span>Options for Choice</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => addOption(qIdx)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-900 bg-white border border-stone-300 hover:bg-stone-100 px-2 py-1 rounded-md transition cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add Option</span>
                            </button>
                          </div>

                          <div className="space-y-1.5">
                            {(question.options || []).map((opt, optIdx) => (
                              <div
                                key={optIdx}
                                className="flex items-center gap-2 bg-white p-1.5 px-2 rounded-lg border border-stone-200"
                              >
                                <span className="text-[10px] font-mono text-stone-400 w-4 text-center">
                                  {optIdx + 1}
                                </span>
                                <input
                                  type="text"
                                  value={opt.label}
                                  onChange={(e) =>
                                    updateOption(qIdx, optIdx, { label: e.target.value })
                                  }
                                  placeholder="Option Label"
                                  className="flex-1 text-xs text-stone-800 px-2 py-1 border border-stone-100 rounded focus:border-stone-900 focus:outline-none font-medium"
                                />
                                <input
                                  type="text"
                                  value={opt.value}
                                  onChange={(e) =>
                                    updateOption(qIdx, optIdx, { value: e.target.value })
                                  }
                                  placeholder="Value"
                                  className="w-28 text-[11px] font-mono text-stone-500 px-2 py-1 border border-stone-100 rounded focus:border-stone-900 focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => deleteOption(qIdx, optIdx)}
                                  className="text-stone-400 hover:text-rose-600 p-1"
                                  title="Delete option"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ))}

                            {(!question.options || question.options.length === 0) && (
                              <p className="text-[11px] text-rose-600 italic">
                                At least one option is required for choice questions.
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* CONDITIONAL LOGIC BUILDER */}
                      <div className="pt-1 border-t border-stone-150">
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => toggleConditionalRule(qIdx)}
                            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg transition cursor-pointer ${
                              hasRule
                                ? 'bg-amber-50 text-amber-900 border border-amber-300'
                                : 'text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200'
                            }`}
                          >
                            <GitBranch className="w-3.5 h-3.5 text-amber-600" />
                            <span>
                              {hasRule
                                ? 'Conditional Rule Active'
                                : '+ Add Conditional Display Rule'}
                            </span>
                          </button>

                          {hasRule && (
                            <button
                              type="button"
                              onClick={() => toggleConditionalRule(qIdx)}
                              className="text-[11px] text-stone-400 hover:text-rose-600"
                            >
                              Remove Rule
                            </button>
                          )}
                        </div>

                        {/* Expandable Conditional Rule Controls */}
                        {hasRule && question.conditionalRule && (
                          <div className="mt-2.5 bg-amber-50/60 p-3 rounded-xl border border-amber-200/80 space-y-2.5 animate-in fade-in duration-150">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                              <span>Show this question ONLY when:</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                              {/* 1. Source Question */}
                              <div>
                                <label className="block text-[10px] font-bold text-amber-900 uppercase mb-0.5">
                                  Source Question
                                </label>
                                <select
                                  value={
                                    question.conditionalRule.sourceQuestionId ||
                                    question.conditionalRule.dependsOnQuestionId ||
                                    ''
                                  }
                                  onChange={(e) =>
                                    updateConditionalRule(qIdx, {
                                      sourceQuestionId: e.target.value,
                                    })
                                  }
                                  className="w-full text-xs text-stone-900 px-2 py-1.5 rounded-lg border border-amber-300 bg-white focus:outline-none"
                                >
                                  <option value="">-- Select Source Question --</option>
                                  {allQuestions
                                    .filter((candidate) => candidate.id !== question.id)
                                    .map((candidate) => (
                                      <option key={candidate.id} value={candidate.id}>
                                        {candidate.displayLabel}
                                      </option>
                                    ))}
                                </select>
                              </div>

                              {/* 2. Operator */}
                              <div>
                                <label className="block text-[10px] font-bold text-amber-900 uppercase mb-0.5">
                                  Condition
                                </label>
                                <select
                                  value={question.conditionalRule.operator}
                                  onChange={(e) =>
                                    updateConditionalRule(qIdx, {
                                      operator: e.target.value as ConditionalOperator,
                                    })
                                  }
                                  className="w-full text-xs text-stone-900 px-2 py-1.5 rounded-lg border border-amber-300 bg-white focus:outline-none"
                                >
                                  <option value="equals">Equals (Exact match)</option>
                                  <option value="not_equals">Does Not Equal</option>
                                  <option value="contains">Contains (Sub-string or tag)</option>
                                  <option value="greater_than">Greater Than (&gt;)</option>
                                  <option value="less_than">Less Than (&lt;)</option>
                                </select>
                              </div>

                              {/* 3. Expected Answer Value */}
                              <div>
                                <label className="block text-[10px] font-bold text-amber-900 uppercase mb-0.5">
                                  Expected Value
                                </label>
                                {(() => {
                                  const sourceId =
                                    question.conditionalRule.sourceQuestionId ||
                                    question.conditionalRule.dependsOnQuestionId;
                                  const sourceQ = allQuestions.find((q) => q.id === sourceId);

                                  if (sourceQ?.type === 'yes_no') {
                                    return (
                                      <select
                                        value={String(question.conditionalRule.value)}
                                        onChange={(e) =>
                                          updateConditionalRule(qIdx, {
                                            value: e.target.value === 'true',
                                          })
                                        }
                                        className="w-full text-xs text-stone-900 px-2 py-1.5 rounded-lg border border-amber-300 bg-white focus:outline-none"
                                      >
                                        <option value="true">Yes</option>
                                        <option value="false">No</option>
                                      </select>
                                    );
                                  }

                                  if (
                                    sourceQ &&
                                    (sourceQ.type === 'single_choice' ||
                                      sourceQ.type === 'multiple_choice' ||
                                      (sourceQ.type as string) === 'radio') &&
                                    sourceQ.options &&
                                    sourceQ.options.length > 0
                                  ) {
                                    return (
                                      <select
                                        value={String(question.conditionalRule.value)}
                                        onChange={(e) =>
                                          updateConditionalRule(qIdx, {
                                            value: e.target.value,
                                          })
                                        }
                                        className="w-full text-xs text-stone-900 px-2 py-1.5 rounded-lg border border-amber-300 bg-white focus:outline-none"
                                      >
                                        {sourceQ.options.map((opt) => (
                                          <option key={opt.value} value={opt.value}>
                                            {opt.label} ({opt.value})
                                          </option>
                                        ))}
                                      </select>
                                    );
                                  }

                                  return (
                                    <input
                                      type="text"
                                      value={String(question.conditionalRule.value ?? '')}
                                      onChange={(e) =>
                                        updateConditionalRule(qIdx, {
                                          value: e.target.value,
                                        })
                                      }
                                      placeholder="Value..."
                                      className="w-full text-xs text-stone-900 px-2 py-1.5 rounded-lg border border-amber-300 bg-white focus:outline-none"
                                    />
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {(!activeSection.questions || activeSection.questions.length === 0) && (
                  <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-stone-300 p-6 space-y-2">
                    <p className="text-xs font-semibold text-stone-600">
                      No questions in this section yet.
                    </p>
                    <button
                      type="button"
                      onClick={addQuestion}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add First Question</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-16 bg-white rounded-2xl border border-stone-200 p-6 text-stone-500 text-xs">
              No section selected. Click a section on the left or add a new section.
            </div>
          )}
        </main>
      </div>

      {/* 4. PREVIEW MODAL (REUSING CLIENT FORM RENDERER) */}
      <QuestionnairePreviewModal
        questionnaire={questionnaire}
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
      />

      {/* 5. AI QUESTIONNAIRE ASSISTANT MODAL */}
      {isAiAssistantOpen && (
        <AiQuestionnaireAssistantModal
          isOpen={isAiAssistantOpen}
          onClose={() => {
            setIsAiAssistantOpen(false);
            setTargetQuestionForAi(null);
          }}
          sections={sections}
          activeSectionIndex={selectedSectionIndex}
          initialQuestionnaireTitle={questionnaire.title}
          initialQuestionnaireDescription={questionnaire.description}
          onAddQuestions={handleAddQuestionsFromAi}
          onUpdateQuestion={handleUpdateQuestionFromAi}
          targetQuestionToImprove={targetQuestionForAi}
        />
      )}

      {/* 6. UNIVERSAL JSON IMPORT / EXPORT MODAL */}
      {jsonModalMode && (
        <QuestionnaireJsonModal
          isOpen={true}
          mode={jsonModalMode}
          initialQuestionnaire={questionnaire}
          onClose={() => setJsonModalMode(null)}
          onImportSuccess={(imported) => {
            setQuestionnaire(imported);
            setSelectedSectionIndex(0);
            setStatusMessage({
              type: 'success',
              text: `Successfully imported "${imported.title}" from JSON template!`,
            });
          }}
        />
      )}
    </div>
  );
};
