import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Layers,
  Plus,
  Check,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  GitBranch,
  Wand2,
  RefreshCw,
  Sliders,
  CheckSquare,
  Square,
  ChevronDown,
} from 'lucide-react';
import {
  Section,
  Question,
  QuestionSuggestion,
  WordingImprovementSuggestion,
  FollowUpSuggestion,
  StandardQuestionType,
} from '../../types';
import {
  fetchQuestionSuggestions,
  fetchWordingImprovement,
  fetchFollowUpSuggestion,
} from '../../lib/aiService';

interface AiQuestionnaireAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  sections: Section[];
  activeSectionIndex: number;
  initialQuestionnaireTitle?: string;
  initialQuestionnaireDescription?: string;
  onAddQuestions: (sectionIndex: number, questions: Question[]) => void;
  onUpdateQuestion: (
    sectionIndex: number,
    questionIndex: number,
    updates: Partial<Question>
  ) => void;
  targetQuestionToImprove?: {
    sectionIndex: number;
    questionIndex: number;
    question: Question;
  } | null;
}

type AssistantTab = 'suggest_new' | 'improve_wording' | 'suggest_followup';

export const AiQuestionnaireAssistantModal: React.FC<AiQuestionnaireAssistantModalProps> = ({
  isOpen,
  onClose,
  sections,
  activeSectionIndex,
  initialQuestionnaireTitle = '',
  initialQuestionnaireDescription = '',
  onAddQuestions,
  onUpdateQuestion,
  targetQuestionToImprove = null,
}) => {
  const [activeTab, setActiveTab] = useState<AssistantTab>(
    targetQuestionToImprove ? 'improve_wording' : 'suggest_new'
  );

  // Context Inputs
  const [projectName, setProjectName] = useState(initialQuestionnaireTitle);
  const [projectDescription, setProjectDescription] = useState(initialQuestionnaireDescription);
  const [clientContext, setClientContext] = useState('');
  const [targetSectionIdx, setTargetSectionIdx] = useState<number>(activeSectionIndex);

  // Suggest New Questions State
  const [suggestions, setSuggestions] = useState<QuestionSuggestion[]>([]);
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<Set<string>>(new Set());
  const [editedSuggestions, setEditedSuggestions] = useState<Record<string, QuestionSuggestion>>({});

  // Improve Wording State
  const [selectedQuestionForWording, setSelectedQuestionForWording] = useState<{
    sectionIndex: number;
    questionIndex: number;
  }>({
    sectionIndex: targetQuestionToImprove?.sectionIndex ?? activeSectionIndex,
    questionIndex: targetQuestionToImprove?.questionIndex ?? 0,
  });
  const [wordingImprovement, setWordingImprovement] = useState<WordingImprovementSuggestion | null>(
    null
  );

  // Suggest Follow-up State
  const [selectedQuestionForFollowUp, setSelectedQuestionForFollowUp] = useState<{
    sectionIndex: number;
    questionIndex: number;
  }>({
    sectionIndex: activeSectionIndex,
    questionIndex: 0,
  });
  const [selectedTriggerOption, setSelectedTriggerOption] = useState<string>('yes');
  const [followUpSuggestion, setFollowUpSuggestion] = useState<FollowUpSuggestion | null>(null);

  // General Status
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentActiveSection = sections[targetSectionIdx] || sections[0];

  // Helper for question list in current section
  const activeQuestions = currentActiveSection?.questions || [];

  // ---------------------------------------------------------------------------
  // ACTION: GENERATE NEW QUESTIONS
  // ---------------------------------------------------------------------------
  const handleGenerateSuggestions = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const existingQuestionTexts = (currentActiveSection?.questions || []).map(
        (q) => q.text || q.title || ''
      );

      const res = await fetchQuestionSuggestions({
        projectName,
        projectDescription,
        clientContext,
        sectionTitle: currentActiveSection?.title || 'Requirements Section',
        sectionDescription: currentActiveSection?.description,
        existingQuestions: existingQuestionTexts,
        count: 4,
      });

      setSuggestions(res);
      // Select all by default for easy review
      setSelectedSuggestionIds(new Set(res.map((s) => s.id)));
      const initialMap: Record<string, QuestionSuggestion> = {};
      res.forEach((s) => {
        initialMap[s.id] = { ...s };
      });
      setEditedSuggestions(initialMap);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Failed to generate question suggestions. Verify your Gemini API key.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelectSuggestion = (id: string) => {
    setSelectedSuggestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApplySelectedQuestions = () => {
    const questionsToAdd: Question[] = [];

    suggestions.forEach((sug) => {
      if (!selectedSuggestionIds.has(sug.id)) return;

      const edited = editedSuggestions[sug.id] || sug;
      const newQuestionId = `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const newQ: Question = {
        id: newQuestionId,
        text: edited.text,
        description: edited.description,
        type: edited.type,
        required: edited.required,
        enabled: true,
        order: (currentActiveSection?.questions?.length || 0) + questionsToAdd.length + 1,
        options: edited.options?.map((opt) => ({
          value: opt.value,
          label: opt.label,
        })),
      };

      if (edited.suggestedFollowUp) {
        newQ.conditionalRule = {
          operator: 'equals',
          value: edited.suggestedFollowUp.triggerValue,
          followUpQuestion: {
            id: `fu_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            text: edited.suggestedFollowUp.question.text,
            type: edited.suggestedFollowUp.question.type,
            required: false,
            enabled: true,
          },
        };
      }

      questionsToAdd.push(newQ);
    });

    if (questionsToAdd.length > 0) {
      onAddQuestions(targetSectionIdx, questionsToAdd);
      setSuccessMessage(`Successfully added ${questionsToAdd.length} question(s) to "${currentActiveSection?.title}".`);
      setSuggestions([]);
      setSelectedSuggestionIds(new Set());
    }
  };

  // ---------------------------------------------------------------------------
  // ACTION: IMPROVE WORDING
  // ---------------------------------------------------------------------------
  const targetQuestion =
    sections[selectedQuestionForWording.sectionIndex]?.questions?.[
      selectedQuestionForWording.questionIndex
    ];

  const handleAnalyzeWording = async () => {
    if (!targetQuestion) return;

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setWordingImprovement(null);

    try {
      const res = await fetchWordingImprovement({
        currentText: targetQuestion.text || targetQuestion.title || '',
        currentDescription: targetQuestion.description || targetQuestion.helperText,
        currentType: targetQuestion.type,
        sectionTitle: sections[selectedQuestionForWording.sectionIndex]?.title,
      });

      setWordingImprovement(res);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to analyze wording.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyWordingImprovement = () => {
    if (!wordingImprovement || !targetQuestion) return;

    onUpdateQuestion(
      selectedQuestionForWording.sectionIndex,
      selectedQuestionForWording.questionIndex,
      {
        text: wordingImprovement.improvedText,
        description: wordingImprovement.suggestedDescription,
        type: wordingImprovement.suggestedType || targetQuestion.type,
      }
    );

    setSuccessMessage('Successfully updated question wording and structure.');
    setWordingImprovement(null);
  };

  // ---------------------------------------------------------------------------
  // ACTION: SUGGEST FOLLOW-UP
  // ---------------------------------------------------------------------------
  const targetFollowUpQuestion =
    sections[selectedQuestionForFollowUp.sectionIndex]?.questions?.[
      selectedQuestionForFollowUp.questionIndex
    ];

  const handleAnalyzeFollowUp = async () => {
    if (!targetFollowUpQuestion) return;

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setFollowUpSuggestion(null);

    try {
      const res = await fetchFollowUpSuggestion({
        parentQuestionText: targetFollowUpQuestion.text || targetFollowUpQuestion.title || '',
        triggerOptionValue: selectedTriggerOption,
        sectionTitle: sections[selectedQuestionForFollowUp.sectionIndex]?.title,
      });

      setFollowUpSuggestion(res);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to generate follow-up question.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyFollowUp = () => {
    if (!followUpSuggestion || !targetFollowUpQuestion) return;

    onUpdateQuestion(
      selectedQuestionForFollowUp.sectionIndex,
      selectedQuestionForFollowUp.questionIndex,
      {
        conditionalRule: {
          operator: 'equals',
          value: followUpSuggestion.triggerValue,
          followUpQuestion: {
            id: `fu_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            text: followUpSuggestion.questionText,
            type: followUpSuggestion.questionType,
            options: followUpSuggestion.options,
            required: false,
            enabled: true,
          },
        },
      }
    );

    setSuccessMessage('Successfully attached conditional follow-up question.');
    setFollowUpSuggestion(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-stone-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50/75 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-stone-900 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-stone-900">
                AI Questionnaire Assistant
              </h2>
              <p className="text-xs text-stone-500">
                Authoring assistance for question generation, wording refinement, and conditional rules.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200/50 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-stone-200 bg-stone-100/70 px-4 sm:px-6 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('suggest_new');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'suggest_new'
                ? 'border-stone-900 text-stone-900 bg-white'
                : 'border-transparent text-stone-500 hover:text-stone-900'
            }`}
          >
            <Plus className="w-3.5 h-3.5 text-stone-700" />
            <span>Suggest Questions</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('improve_wording');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'improve_wording'
                ? 'border-stone-900 text-stone-900 bg-white'
                : 'border-transparent text-stone-500 hover:text-stone-900'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5 text-stone-700" />
            <span>Improve Wording & Type</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('suggest_followup');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'suggest_followup'
                ? 'border-stone-900 text-stone-900 bg-white'
                : 'border-transparent text-stone-500 hover:text-stone-900'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5 text-stone-700" />
            <span>Suggest Follow-up</span>
          </button>
        </div>

        {/* Status Alerts */}
        {errorMessage && (
          <div className="mx-4 mt-3 bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mx-4 mt-3 bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* TAB 1: SUGGEST NEW QUESTIONS */}
          {activeTab === 'suggest_new' && (
            <div className="space-y-4">
              {/* Context Formulation Card */}
              <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200 space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  Target Context & Questionnaire Parameters
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Project Name
                    </label>
                    <input
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="e.g. Healthcare Patient Portal"
                      className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 bg-white focus:outline-none focus:border-stone-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Target Section
                    </label>
                    <select
                      value={targetSectionIdx}
                      onChange={(e) => setTargetSectionIdx(Number(e.target.value))}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 bg-white focus:outline-none focus:border-stone-900"
                    >
                      {sections.map((sec, idx) => (
                        <option key={sec.id || idx} value={idx}>
                          Section {idx + 1}: {sec.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Client Context / Industry Scope (Optional)
                    </label>
                    <input
                      type="text"
                      value={clientContext}
                      onChange={(e) => setClientContext(e.target.value)}
                      placeholder="e.g. Multi-location hospital system, HIPAA compliance required"
                      className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 bg-white focus:outline-none focus:border-stone-900"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleGenerateSuggestions}
                    disabled={isLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-50 transition cursor-pointer shadow-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isLoading ? 'Generating Questions...' : 'Generate Suggestions'}</span>
                  </button>
                </div>
              </div>

              {/* Suggestions List & Review */}
              {suggestions.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                      AI Generated Suggestions ({suggestions.length})
                    </h3>
                    <span className="text-[11px] text-stone-500">
                      Review, edit, and select questions before adding to section
                    </span>
                  </div>

                  <div className="space-y-3">
                    {suggestions.map((sug) => {
                      const isSelected = selectedSuggestionIds.has(sug.id);
                      const current = editedSuggestions[sug.id] || sug;

                      return (
                        <div
                          key={sug.id}
                          className={`rounded-2xl p-4 border transition-all ${
                            isSelected
                              ? 'bg-stone-50/90 border-stone-800 shadow-xs'
                              : 'bg-white border-stone-200 opacity-60'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={() => toggleSelectSuggestion(sug.id)}
                              className="mt-0.5 text-stone-900 cursor-pointer"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-stone-900" />
                              ) : (
                                <Square className="w-4 h-4 text-stone-400" />
                              )}
                            </button>

                            <div className="flex-1 space-y-2">
                              {/* Header Badges */}
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] font-mono font-bold bg-stone-200 text-stone-700 px-2 py-0.5 rounded">
                                  Type: {current.type}
                                </span>
                                <span className="text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded">
                                  {sug.reasoning}
                                </span>
                              </div>

                              {/* Editable Question Text */}
                              <input
                                type="text"
                                value={current.text}
                                onChange={(e) => {
                                  const text = e.target.value;
                                  setEditedSuggestions((prev) => ({
                                    ...prev,
                                    [sug.id]: { ...current, text },
                                  }));
                                }}
                                className="w-full text-xs font-bold text-stone-900 px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white focus:outline-none focus:border-stone-900"
                              />

                              {/* Helper description */}
                              <input
                                type="text"
                                value={current.description}
                                onChange={(e) => {
                                  const description = e.target.value;
                                  setEditedSuggestions((prev) => ({
                                    ...prev,
                                    [sug.id]: { ...current, description },
                                  }));
                                }}
                                placeholder="Description / helper guidance"
                                className="w-full text-[11px] text-stone-600 px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white focus:outline-none focus:border-stone-900"
                              />

                              {/* Options preview for choice questions */}
                              {current.options && current.options.length > 0 && (
                                <div className="text-[11px] text-stone-500 bg-white p-2 rounded-lg border border-stone-100">
                                  <span className="font-semibold block text-[10px] uppercase text-stone-400 mb-1">
                                    Suggested Choices:
                                  </span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {current.options.map((opt, i) => (
                                      <span
                                        key={i}
                                        className="bg-stone-100 text-stone-700 px-2 py-0.5 rounded text-[10px]"
                                      >
                                        {opt.label}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Follow up preview */}
                              {current.suggestedFollowUp && (
                                <div className="text-[11px] text-indigo-900 bg-indigo-50/70 p-2 rounded-lg border border-indigo-100 flex items-center gap-1.5">
                                  <GitBranch className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                  <span>
                                    Follow-up if &quot;{current.suggestedFollowUp.triggerValue}&quot;: {current.suggestedFollowUp.question.text}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add action */}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-stone-500">
                      {selectedSuggestionIds.size} of {suggestions.length} question(s) selected
                    </span>

                    <button
                      type="button"
                      onClick={handleApplySelectedQuestions}
                      disabled={selectedSuggestionIds.size === 0}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-40 transition cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Selected to Section</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: IMPROVE WORDING & TYPE */}
          {activeTab === 'improve_wording' && (
            <div className="space-y-4">
              {/* Question selector */}
              <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200 space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  Select Question to Analyze
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Section
                    </label>
                    <select
                      value={selectedQuestionForWording.sectionIndex}
                      onChange={(e) =>
                        setSelectedQuestionForWording({
                          sectionIndex: Number(e.target.value),
                          questionIndex: 0,
                        })
                      }
                      className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 bg-white focus:outline-none focus:border-stone-900"
                    >
                      {sections.map((sec, idx) => (
                        <option key={sec.id || idx} value={idx}>
                          Section {idx + 1}: {sec.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Question
                    </label>
                    <select
                      value={selectedQuestionForWording.questionIndex}
                      onChange={(e) =>
                        setSelectedQuestionForWording((prev) => ({
                          ...prev,
                          questionIndex: Number(e.target.value),
                        }))
                      }
                      className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 bg-white focus:outline-none focus:border-stone-900"
                    >
                      {(
                        sections[selectedQuestionForWording.sectionIndex]?.questions || []
                      ).map((q, idx) => (
                        <option key={q.id || idx} value={idx}>
                          Q{idx + 1}: {(q.text || q.title || 'Untitled').slice(0, 45)}...
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {targetQuestion && (
                  <div className="bg-white p-3 rounded-xl border border-stone-200 text-xs space-y-1 mt-2">
                    <span className="text-[10px] uppercase font-bold text-stone-400">Current Definition:</span>
                    <p className="font-semibold text-stone-900">{targetQuestion.text || targetQuestion.title}</p>
                    <p className="text-stone-500">{targetQuestion.description || 'No description provided.'}</p>
                    <span className="inline-block text-[10px] font-mono bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded">
                      Type: {targetQuestion.type}
                    </span>
                  </div>
                )}

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleAnalyzeWording}
                    disabled={isLoading || !targetQuestion}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-50 transition cursor-pointer shadow-xs"
                  >
                    <Wand2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isLoading ? 'Analyzing Wording...' : 'Suggest Better Wording & Type'}</span>
                  </button>
                </div>
              </div>

              {/* Improved Wording Card */}
              {wordingImprovement && (
                <div className="bg-white rounded-2xl p-5 border border-stone-300 shadow-sm space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800">
                      Refined Question Proposal
                    </h3>
                    <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
                      Recommended Type: {wordingImprovement.suggestedType}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <span className="text-[11px] font-semibold text-stone-500 block mb-0.5">
                        Proposed Question Text:
                      </span>
                      <p className="text-sm font-bold text-stone-900 bg-stone-50 p-2.5 rounded-xl border border-stone-200">
                        {wordingImprovement.improvedText}
                      </p>
                    </div>

                    {wordingImprovement.suggestedDescription && (
                      <div>
                        <span className="text-[11px] font-semibold text-stone-500 block mb-0.5">
                          Clarifying Description:
                        </span>
                        <p className="text-xs text-stone-700 bg-stone-50 p-2 rounded-xl border border-stone-200">
                          {wordingImprovement.suggestedDescription}
                        </p>
                      </div>
                    )}

                    <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200/80 text-xs text-amber-950">
                      <span className="font-bold block mb-0.5">Reasoning:</span>
                      <p>{wordingImprovement.reasoning}</p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleApplyWordingImprovement}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 transition cursor-pointer shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Apply Improvement to Question</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SUGGEST CONDITIONAL FOLLOW-UP */}
          {activeTab === 'suggest_followup' && (
            <div className="space-y-4">
              <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200 space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  Select Parent Question & Trigger Value
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Parent Question
                    </label>
                    <select
                      value={selectedQuestionForFollowUp.questionIndex}
                      onChange={(e) =>
                        setSelectedQuestionForFollowUp((prev) => ({
                          ...prev,
                          questionIndex: Number(e.target.value),
                        }))
                      }
                      className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 bg-white focus:outline-none focus:border-stone-900"
                    >
                      {(
                        sections[selectedQuestionForFollowUp.sectionIndex]?.questions || []
                      ).map((q, idx) => (
                        <option key={q.id || idx} value={idx}>
                          Q{idx + 1}: {(q.text || q.title || 'Untitled').slice(0, 45)}...
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Trigger Value / Choice
                    </label>
                    {targetFollowUpQuestion?.options && targetFollowUpQuestion.options.length > 0 ? (
                      <select
                        value={selectedTriggerOption}
                        onChange={(e) => setSelectedTriggerOption(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 bg-white focus:outline-none focus:border-stone-900"
                      >
                        {targetFollowUpQuestion.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label} ({opt.value})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={selectedTriggerOption}
                        onChange={(e) => setSelectedTriggerOption(e.target.value)}
                        placeholder="e.g. yes or opt_1"
                        className="w-full text-xs px-3 py-2 rounded-xl border border-stone-200 bg-white focus:outline-none focus:border-stone-900"
                      />
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleAnalyzeFollowUp}
                    disabled={isLoading || !targetFollowUpQuestion}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-50 transition cursor-pointer shadow-xs"
                  >
                    <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{isLoading ? 'Generating Follow-up...' : 'Suggest Conditional Follow-up'}</span>
                  </button>
                </div>
              </div>

              {/* Follow-up Suggestion Result */}
              {followUpSuggestion && (
                <div className="bg-white rounded-2xl p-5 border border-stone-300 shadow-sm space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800">
                      Conditional Follow-Up Question
                    </h3>
                    <span className="text-[10px] font-mono font-bold bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded">
                      Trigger: {followUpSuggestion.triggerValue}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <span className="text-[11px] font-semibold text-stone-500 block mb-0.5">
                        Follow-up Question Text:
                      </span>
                      <p className="text-sm font-bold text-stone-900 bg-stone-50 p-2.5 rounded-xl border border-stone-200">
                        {followUpSuggestion.questionText}
                      </p>
                    </div>

                    <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-200/80 text-xs text-indigo-950">
                      <span className="font-bold block mb-0.5">Reasoning:</span>
                      <p>{followUpSuggestion.reasoning}</p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleApplyFollowUp}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 transition cursor-pointer shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Attach as Conditional Rule</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-stone-200 bg-stone-50/75 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
            <HelpCircle className="w-3.5 h-3.5 text-stone-400" />
            <span>AI suggestions are advisory. Admin action is required to insert or update.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-bold text-stone-700 hover:bg-stone-200 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
