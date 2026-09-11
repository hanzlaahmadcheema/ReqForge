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
} from 'lucide-react';
import { Questionnaire } from '../../types';
import {
  validateQuestionnaireJson,
  importQuestionnaireFromJson,
  exportQuestionnaireToJsonTemplate,
} from '../../lib/questionnaireJsonImporter';

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
  const [copied, setCopied] = useState<boolean>(false);
  const [dragOver, setDragOver] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleTextChange = (value: string) => {
    setJsonText(value);
    setValidationErrors([]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonText(content);
      setValidationErrors([]);
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
    };
    reader.readAsText(file);
  };

  const handleValidateAndImport = () => {
    try {
      const parsed = JSON.parse(jsonText);
      const res = validateQuestionnaireJson(parsed);
      if (!res.valid || !res.questionnaire) {
        setValidationErrors(res.errors);
        return;
      }

      if (onImportSuccess) {
        onImportSuccess(res.questionnaire);
      }
      onClose();
    } catch (err: any) {
      setValidationErrors([`JSON Syntax Error: ${err.message || String(err)}`]);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
    const blank = {
      questionnaire: {
        title: 'New Customer Intake Questionnaire',
        description: 'Universal intake form for new business onboarding.',
        sections: [
          {
            section_title: 'Company Information',
            section_description: 'Basic business background',
            questions: [
              {
                question_id: 'q_business_name',
                question: 'What is your company name?',
                type: 'text',
                required: true,
                short_answer: 'e.g., Acme Logistics',
              },
              {
                question_id: 'q_business_type',
                question: 'What is your organization model?',
                type: 'single_choice',
                required: true,
                option_1: 'B2B Wholesale',
                option_2: 'Direct-to-Consumer',
                option_3: 'Hybrid Enterprise',
              },
              {
                question_id: 'q_features',
                question: 'Which services are needed?',
                type: 'multiple_choice',
                required: true,
                check_1: 'Inventory Tracking',
                check_2: 'Online Payment Gateway',
                check_3: 'Automated Delivery Dispatch',
              },
              {
                question_id: 'q_custom_domain',
                question: 'Do you require a dedicated domain?',
                type: 'yes_no',
                required: false,
                true: 'Yes, custom branded domain',
                false: 'No, standard subdomain',
              },
              {
                question_id: 'q_domain_name',
                question: 'What is your custom domain name?',
                type: 'text',
                required: false,
                short_answer: 'e.g., portal.mycompany.com',
                conditional: {
                  question_id: 'q_custom_domain',
                  answer: 'Yes, custom branded domain',
                },
              },
            ],
          },
        ],
      },
    };
    setJsonText(JSON.stringify(blank, null, 2));
    setValidationErrors([]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-3xl w-full border border-stone-200 shadow-2xl flex flex-col max-h-[92dvh] overflow-hidden">
        {/* Mobile drag handle */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center bg-stone-50/50">
          <div className="w-10 h-1 rounded-full bg-stone-300" />
        </div>

        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-stone-900 text-white rounded-xl shadow-2xs">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">
                {mode === 'import' ? 'Import Questionnaire from JSON' : 'Export Questionnaire JSON'}
              </h3>
              <p className="text-xs text-stone-500">
                {mode === 'import'
                  ? 'Paste or upload a questionnaire JSON template based on docs/questionnaire-template.json'
                  : 'Universal JSON template format ready to share, version, or edit'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

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
              className={`border-2 border-dashed rounded-xl p-4 text-center transition ${
                dragOver
                  ? 'border-stone-900 bg-stone-50'
                  : 'border-stone-200 hover:border-stone-300'
              }`}
            >
              <div className="flex items-center justify-center gap-3">
                <Upload className="w-5 h-5 text-stone-400" />
                <span className="text-xs text-stone-600 font-medium">
                  Drag & drop your <span className="font-mono text-stone-800">.json</span> file here, or{' '}
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
                <span className="text-stone-300">|</span>
                <button
                  type="button"
                  onClick={loadBlankTemplate}
                  className="text-xs text-sky-700 hover:text-sky-800 font-semibold underline cursor-pointer"
                >
                  Load Starter Sample
                </button>
              </div>
            </div>
          )}

          {/* Validation error display */}
          {validationErrors.length > 0 && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-1 text-xs text-rose-900">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>JSON Validation Failed ({validationErrors.length} issues):</span>
              </div>
              <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-rose-800 max-h-36 overflow-y-auto">
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
              placeholder="Paste valid questionnaire JSON here..."
              rows={16}
              className="w-full font-mono text-base sm:text-xs p-4 bg-stone-900 text-stone-100 rounded-xl border border-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400 leading-relaxed resize-none selection:bg-stone-700"
              spellCheck={false}
            />
            {jsonText && (
              <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-stone-800 text-stone-200 hover:bg-stone-700 border border-stone-700 flex items-center gap-1 transition"
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
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-stone-800 text-stone-200 hover:bg-stone-700 border border-stone-700 flex items-center gap-1 transition"
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
          <span className="text-[11px] text-stone-400 text-center sm:text-left">
            Compliant with <span className="font-mono">docs/questionnaire-json-format.md</span>
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:text-stone-900 bg-white border border-stone-200 hover:bg-stone-50 transition cursor-pointer min-h-[44px] sm:min-h-0 active:scale-[0.98]"
            >
              Close
            </button>

            {mode === 'import' && (
              <button
                type="button"
                onClick={handleValidateAndImport}
                disabled={!jsonText.trim()}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 transition shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] sm:min-h-0 active:scale-[0.98]"
              >
                <span>Validate & Import</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
