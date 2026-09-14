/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  FileCode,
  Upload,
  Download,
  Copy,
  Check,
  AlertTriangle,
  FileText,
  ArrowRight,
  Sparkles,
  Bot,
  Terminal,
  Eye,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import { Questionnaire } from '../../types';
import {
  validateQuestionnaireJson,
  exportQuestionnaireToJsonTemplate,
} from '../../lib/questionnaireJsonImporter';
import {
  REQFORGE_AI_AGENT_PROMPT,
  REQFORGE_CANONICAL_TEMPLATE_JSON,
} from '../../lib/aiWorkflowConstants';
import { AiWorkflowGuideModal } from '../common/AiWorkflowGuideModal';
import { QuestionnairePreviewModal } from './QuestionnairePreviewModal';

interface QuestionnaireJsonModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'import' | 'export';
  initialQuestionnaire?: Questionnaire | null;
  onImportSuccess?: (questionnaire: Questionnaire) => void;
}

export const QuestionnaireJsonModal: React.FC<QuestionnaireJsonModalProps> = ({
  isOpen,
  onClose,
  mode,
  initialQuestionnaire,
  onImportSuccess,
}) => {
  const [jsonText, setJsonText] = useState<string>(() => {
    if (mode === 'export' && initialQuestionnaire) {
      try {
        const exported = exportQuestionnaireToJsonTemplate(initialQuestionnaire);
        return JSON.stringify(exported, null, 2);
      } catch (e) {
        return '';
      }
    }
    return '';
  });

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationSuccess, setValidationSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);
  const [copiedTemplate, setCopiedTemplate] = useState<boolean>(false);
  const [dragOver, setDragOver] = useState<boolean>(false);

  // Guide and preview modal states
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [previewQuestionnaire, setPreviewQuestionnaire] = useState<Questionnaire | null>(null);

  if (!isOpen) return null;

  const handleTextChange = (value: string) => {
    setJsonText(value);
    setValidationErrors([]);
    setValidationSuccess(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonText(content);
      setValidationErrors([]);
      setValidationSuccess(null);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonText(content);
      setValidationErrors([]);
      setValidationSuccess(null);
    };
    reader.readAsText(file);
  };

  const parseAndValidate = (): Questionnaire | null => {
    try {
      const parsed = JSON.parse(jsonText);
      const res = validateQuestionnaireJson(parsed);
      if (!res.valid || !res.questionnaire) {
        setValidationErrors(res.errors);
        setValidationSuccess(null);
        return null;
      }
      setValidationErrors([]);
      const qCount = res.questionnaire.sections.reduce(
        (acc, s) => acc + (s.questions?.length || 0),
        0
      );
      setValidationSuccess(
        `Valid ReqForge JSON! "${res.questionnaire.title}" (${res.questionnaire.sections.length} sections, ${qCount} questions)`
      );
      return res.questionnaire;
    } catch (err: any) {
      setValidationErrors([`JSON Syntax Error: ${err.message || String(err)}`]);
      setValidationSuccess(null);
      return null;
    }
  };

  const handleValidateOnly = () => {
    parseAndValidate();
  };

  const handlePreview = () => {
    const validated = parseAndValidate();
    if (validated) {
      setPreviewQuestionnaire(validated);
    }
  };

  const handleCreateQuestionnaire = () => {
    const validated = parseAndValidate();
    if (!validated) return;

    if (onImportSuccess) {
      onImportSuccess(validated);
    }
    onClose();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(REQFORGE_AI_AGENT_PROMPT);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2200);
  };

  const handleCopyTemplate = () => {
    navigator.clipboard.writeText(REQFORGE_CANONICAL_TEMPLATE_JSON);
    setCopiedTemplate(true);
    setTimeout(() => setCopiedTemplate(false), 2200);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${
      initialQuestionnaire?.title
        ? initialQuestionnaire.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')
        : 'questionnaire'
    }_template.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const loadBlankTemplate = () => {
    setJsonText(REQFORGE_CANONICAL_TEMPLATE_JSON);
    setValidationErrors([]);
    setValidationSuccess(null);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150">
        <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-4xl w-full border border-stone-200 shadow-2xl flex flex-col max-h-[94dvh] overflow-hidden">
          {/* Mobile drag handle */}
          <div className="sm:hidden pt-3 pb-1 flex justify-center bg-stone-50/50">
            <div className="w-10 h-1 rounded-full bg-stone-300" />
          </div>

          {/* Header */}
          <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-stone-900 text-white rounded-xl shadow-xs">
                {mode === 'import' ? (
                  <Sparkles className="w-5 h-5 text-amber-300" />
                ) : (
                  <FileCode className="w-5 h-5 text-stone-200" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900 leading-tight">
                  {mode === 'import' ? 'Build with AI-Generated JSON' : 'Export Questionnaire JSON'}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5 max-w-xl">
                  {mode === 'import'
                    ? 'Ask your AI agent to create a client questionnaire using the ReqForge format. Paste the generated JSON here and ReqForge will automatically build the form.'
                    : 'Universal JSON template format ready to share, version, or edit.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Top Quick Actions Toolbar (Import Mode) */}
          {mode === 'import' && (
            <div className="px-6 py-3 bg-stone-100/70 border-b border-stone-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer ${
                    copiedPrompt
                      ? 'bg-emerald-700 text-white'
                      : 'bg-stone-900 hover:bg-stone-800 text-white'
                  }`}
                  title="Copy ready-to-use prompt for ChatGPT, Claude, Gemini, Copilot"
                >
                  {copiedPrompt ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied AI Prompt!</span>
                    </>
                  ) : (
                    <>
                      <Terminal className="w-3.5 h-3.5 text-amber-300" />
                      <span>Copy AI Prompt</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleCopyTemplate}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 transition shadow-2xs cursor-pointer ${
                    copiedTemplate ? 'border-emerald-500 text-emerald-700' : ''
                  }`}
                  title="Copy blank universal JSON template"
                >
                  {copiedTemplate ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-bold">Copied Template!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-stone-500" />
                      <span>Copy JSON Template</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsGuideOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-200/70 transition cursor-pointer"
                  title="View JSON structure guide and question types"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-stone-500" />
                  <span>View JSON Format Guide</span>
                </button>
              </div>

              <button
                type="button"
                onClick={loadBlankTemplate}
                className="text-xs text-stone-600 hover:text-stone-950 font-semibold underline cursor-pointer ml-auto"
              >
                Load Starter Template
              </button>
            </div>
          )}

          {/* Content Body */}
          <div className="p-6 flex-1 overflow-y-auto space-y-4">
            {mode === 'import' && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-3.5 text-center transition ${
                  dragOver
                    ? 'border-stone-900 bg-stone-50'
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <div className="flex items-center justify-center gap-3">
                  <Upload className="w-4 h-4 text-stone-400" />
                  <span className="text-xs text-stone-600 font-medium">
                    Drag & drop your <span className="font-mono text-stone-800 font-bold">.json</span> file here, or{' '}
                    <label className="text-stone-900 font-bold underline cursor-pointer hover:text-stone-700">
                      browse
                      <input
                        type="file"
                        accept=".json,application/json"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </span>
                </div>
              </div>
            )}

            {/* Validation Success Notification */}
            {validationSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900 font-medium animate-in fade-in">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{validationSuccess}</span>
                </div>
                <button
                  type="button"
                  onClick={handlePreview}
                  className="inline-flex items-center gap-1 font-bold text-emerald-800 hover:underline cursor-pointer ml-2"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview Form</span>
                </button>
              </div>
            )}

            {/* Validation Error Display */}
            {validationErrors.length > 0 && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-1 text-xs text-rose-900 animate-in fade-in">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>JSON Validation Failed ({validationErrors.length} issue{validationErrors.length > 1 ? 's' : ''}):</span>
                </div>
                <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-rose-800 max-h-36 overflow-y-auto font-mono">
                  {validationErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Code Textarea */}
            <div className="relative">
              <textarea
                value={jsonText}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder={
                  mode === 'import'
                    ? 'Paste AI-generated questionnaire JSON here (from ChatGPT, Claude, Gemini, etc.)...'
                    : 'Questionnaire JSON...'
                }
                rows={16}
                className="w-full font-mono text-base sm:text-xs p-4 bg-stone-900 text-stone-100 rounded-xl border border-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400 leading-relaxed resize-none selection:bg-stone-700"
                spellCheck={false}
              />
              {jsonText && (
                <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-stone-800 text-stone-200 hover:bg-stone-700 border border-stone-700 flex items-center gap-1 transition cursor-pointer"
                    title="Copy to clipboard"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                  {mode === 'export' && (
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-stone-800 text-stone-200 hover:bg-stone-700 border border-stone-700 flex items-center gap-1 transition cursor-pointer"
                      title="Download .json file"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-3.5 pb-safe sm:pb-3.5 border-t border-stone-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-stone-50/50">
            <span className="text-[11px] text-stone-500 text-center sm:text-left">
              Compliant with <span className="font-mono font-semibold">docs/questionnaire-json-format.md</span>
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:text-stone-900 bg-white border border-stone-200 hover:bg-stone-50 transition cursor-pointer min-h-[40px] sm:min-h-0 active:scale-[0.98]"
              >
                Close
              </button>

              {mode === 'import' && (
                <>
                  <button
                    type="button"
                    onClick={handleValidateOnly}
                    disabled={!jsonText.trim()}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-[40px] sm:min-h-0"
                  >
                    <span>Validate</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePreview}
                    disabled={!jsonText.trim()}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-stone-800 bg-white hover:bg-stone-50 border border-stone-300 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-[40px] sm:min-h-0"
                  >
                    <Eye className="w-3.5 h-3.5 text-stone-600" />
                    <span>Preview</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCreateQuestionnaire}
                    disabled={!jsonText.trim()}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 transition shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-[40px] sm:min-h-0 active:scale-[0.98]"
                  >
                    <span>Create Questionnaire</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Guide Modal */}
      <AiWorkflowGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        initialTab="prompt"
      />

      {/* Preview Modal */}
      {previewQuestionnaire && (
        <QuestionnairePreviewModal
          questionnaire={previewQuestionnaire}
          isOpen={true}
          onClose={() => setPreviewQuestionnaire(null)}
        />
      )}
    </>
  );
};
