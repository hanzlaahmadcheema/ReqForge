/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Sparkles,
  Bot,
  FileCode,
  ArrowRight,
  HelpCircle,
  Layers,
  ShieldCheck,
  Terminal,
  CheckCircle2,
  Code2,
} from 'lucide-react';
import {
  REQFORGE_AI_AGENT_PROMPT,
  REQFORGE_CANONICAL_TEMPLATE_JSON,
  SUPPORTED_QUESTION_TYPES,
  WORKFLOW_STEPS,
  WHAT_IS_REQFORGE_JSON,
} from '../../lib/aiWorkflowConstants';

interface AiWorkflowGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'workflow' | 'prompt' | 'template' | 'types' | 'about';
  onOpenImport?: () => void;
}

export const AiWorkflowGuideModal: React.FC<AiWorkflowGuideModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'workflow',
  onOpenImport,
}) => {
  const [activeTab, setActiveTab] = useState<'workflow' | 'prompt' | 'template' | 'types' | 'about'>(initialTab);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState(false);

  // Sync tab if initialTab changes on open
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-4xl w-full border border-stone-200 shadow-2xl flex flex-col max-h-[92dvh] overflow-hidden text-stone-900">
        {/* Mobile drag handle */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center bg-stone-50/50">
          <div className="w-10 h-1 rounded-full bg-stone-300" />
        </div>

        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-stone-900 text-white rounded-xl shadow-xs">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-stone-900 leading-tight">
                  AI Agent & JSON Workflow Guide
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Universal Format
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                AI creates the questions. ReqForge creates the form.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
            title="Close guide"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="px-6 border-b border-stone-200 bg-white flex items-center gap-1 overflow-x-auto no-scrollbar">
          {[
            { id: 'workflow', label: 'How It Works', icon: Bot },
            { id: 'prompt', label: 'Copy AI Prompt', icon: Terminal },
            { id: 'template', label: 'JSON Template', icon: FileCode },
            { id: 'types', label: 'Question Types & Logic', icon: Layers },
            { id: 'about', label: 'What is ReqForge JSON?', icon: HelpCircle },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-3 px-3.5 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'border-stone-900 text-stone-900'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-stone-900' : 'text-stone-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          {/* TAB 1: WORKFLOW */}
          {activeTab === 'workflow' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Highlight Banner */}
              <div className="bg-stone-900 text-white p-5 sm:p-6 rounded-2xl relative overflow-hidden shadow-sm">
                <div className="relative z-10 max-w-2xl">
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">
                    ReqForge AI Philosophy
                  </span>
                  <h4 className="text-xl sm:text-2xl font-black tracking-tight leading-tight">
                    You don't have to manually design every question.
                  </h4>
                  <p className="mt-2 text-xs sm:text-sm text-stone-300 leading-relaxed">
                    Give your preferred AI agent (ChatGPT, Claude, Gemini, Copilot, Cursor) the ReqForge standard format.
                    The agent drafts the questions, you paste the JSON, and ReqForge instantly turns it into a client-ready, PIN-protected form.
                  </p>
                </div>
                <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-stone-800 rounded-full opacity-50 blur-xl pointer-events-none" />
              </div>

              {/* Step-by-step Flow */}
              <div>
                <h5 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">
                  5-Step AI-to-Client Pipeline
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  {WORKFLOW_STEPS.map((step, idx) => (
                    <div
                      key={step.number}
                      className="bg-stone-50 border border-stone-200/80 rounded-xl p-3.5 flex flex-col justify-between relative"
                    >
                      <div>
                        <div className="w-6 h-6 rounded-lg bg-stone-900 text-white font-mono text-[11px] font-bold flex items-center justify-center mb-2 shadow-2xs">
                          {step.number}
                        </div>
                        <h6 className="text-xs font-bold text-stone-900 leading-snug">
                          {step.title}
                        </h6>
                        <p className="text-[11px] text-stone-500 mt-1 leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                      {idx < WORKFLOW_STEPS.length - 1 && (
                        <div className="hidden md:block absolute -right-2 top-1/2 -translate-y-1/2 z-10">
                          <ArrowRight className="w-3.5 h-3.5 text-stone-300" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Multi-Agent Freedom */}
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-stone-100 text-stone-800 flex items-center justify-center shrink-0 border border-stone-200">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <h6 className="text-xs font-bold text-stone-900">
                      Use Any AI Agent — No Vendor Lock-In
                    </h6>
                    <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                      ReqForge is completely model-agnostic. Whether you prompt <strong>Claude 3.7</strong>, <strong>ChatGPT (GPT-4o/o1)</strong>, <strong>Gemini 2.5</strong>, <strong>GitHub Copilot</strong>, or <strong>Cursor</strong>, simply provide the prompt below. The user copies the JSON into ReqForge; no direct API credentials or private conversation access required.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('prompt')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <Terminal className="w-4 h-4 text-stone-300" />
                  <span>View Copyable AI Prompt</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('template')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-stone-50 text-stone-800 border border-stone-300 text-xs font-bold transition cursor-pointer"
                >
                  <FileCode className="w-4 h-4 text-stone-600" />
                  <span>View JSON Template</span>
                </button>
                {onOpenImport && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenImport();
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition cursor-pointer ml-auto shadow-xs"
                  >
                    <span>Paste JSON in ReqForge</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: COPY AI PROMPT */}
          {activeTab === 'prompt' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50 p-4 rounded-xl border border-stone-200">
                <div>
                  <h5 className="text-xs font-bold text-stone-900">
                    Ready-to-Use Agent Instruction Prompt
                  </h5>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Paste this into ChatGPT, Claude, Gemini, or Copilot along with your client's project notes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 shadow-xs ${
                    copiedPrompt
                      ? 'bg-emerald-700 text-white'
                      : 'bg-stone-900 hover:bg-stone-800 text-white'
                  }`}
                >
                  {copiedPrompt ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied Prompt!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy AI Prompt</span>
                    </>
                  )}
                </button>
              </div>

              {/* Prompt Code Block */}
              <div className="relative bg-stone-900 text-stone-100 rounded-xl p-4 font-mono text-xs leading-relaxed max-h-[460px] overflow-y-auto border border-stone-800 selection:bg-stone-700">
                <pre className="whitespace-pre-wrap font-mono text-[11px]">{REQFORGE_AI_AGENT_PROMPT}</pre>
              </div>

              <p className="text-[11px] text-stone-500 italic">
                Tip: When pasting to your AI, replace the last section <code className="font-mono text-stone-700 bg-stone-100 px-1 py-0.5 rounded">[Describe your client's project...]</code> with your client's specific requirements notes or goals.
              </p>
            </div>
          )}

          {/* TAB 3: JSON TEMPLATE */}
          {activeTab === 'template' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50 p-4 rounded-xl border border-stone-200">
                <div>
                  <h5 className="text-xs font-bold text-stone-900">
                    Official Canonical ReqForge JSON Template
                  </h5>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    The schema accepted by the JSON importer, supporting all 7 question types and conditional rules.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyTemplate}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 shadow-xs ${
                    copiedTemplate
                      ? 'bg-emerald-700 text-white'
                      : 'bg-stone-900 hover:bg-stone-800 text-white'
                  }`}
                >
                  {copiedTemplate ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied JSON!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy JSON Template</span>
                    </>
                  )}
                </button>
              </div>

              {/* Template Code Block */}
              <div className="relative bg-stone-900 text-stone-100 rounded-xl p-4 font-mono text-xs leading-relaxed max-h-[460px] overflow-y-auto border border-stone-800 selection:bg-stone-700">
                <pre className="whitespace-pre-wrap font-mono text-[11px]">{REQFORGE_CANONICAL_TEMPLATE_JSON}</pre>
              </div>
            </div>
          )}

          {/* TAB 4: QUESTION TYPES & LOGIC */}
          {activeTab === 'types' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h5 className="text-sm font-bold text-stone-900">
                  7 Supported Question Types
                </h5>
                <p className="text-xs text-stone-500 mt-0.5">
                  ReqForge natively renders each of these inputs. The AI agent should only use these types.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {SUPPORTED_QUESTION_TYPES.map((t) => (
                  <div key={t.type} className="bg-stone-50 p-3.5 rounded-xl border border-stone-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-stone-900">{t.name}</span>
                      <code className="text-[10px] font-mono px-1.5 py-0.5 bg-stone-200/80 rounded text-stone-800 font-bold">
                        type: "{t.type}"
                      </code>
                    </div>
                    <p className="text-[11px] text-stone-600 mb-2 leading-relaxed">
                      {t.description}
                    </p>
                    <div className="text-[10px] text-stone-500 font-mono bg-white p-2 rounded border border-stone-200/80 overflow-x-auto">
                      {t.example}
                    </div>
                  </div>
                ))}
              </div>

              {/* Conditional Questions Section */}
              <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <h6 className="text-xs font-bold text-stone-900">
                    Conditional Follow-Up Questions
                  </h6>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed">
                  Questions can appear dynamically when a prior question matches a specific answer. Add the <code className="font-mono text-stone-800 bg-white px-1 py-0.5 rounded border border-emerald-300">conditional</code> block referencing the target question:
                </p>
                <div className="bg-stone-900 text-stone-100 p-3 rounded-lg font-mono text-[11px] overflow-x-auto">
                  {`"conditional": {
  "question_id": "has_mobile_app",
  "answer": "Yes, iOS and Android apps needed"
}`}
                </div>
                <p className="text-[11px] text-stone-500">
                  Note: The referenced <code className="font-mono">question_id</code> must exist in the questionnaire prior to this question.
                </p>
              </div>
            </div>
          )}

          {/* TAB 5: WHAT IS REQFORGE JSON */}
          {activeTab === 'about' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="bg-stone-50 p-5 rounded-2xl border border-stone-200 space-y-2">
                <h4 className="text-base font-bold text-stone-900">
                  {WHAT_IS_REQFORGE_JSON.title}
                </h4>
                <p className="text-xs text-stone-700 font-medium leading-relaxed">
                  {WHAT_IS_REQFORGE_JSON.summary}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {WHAT_IS_REQFORGE_JSON.whyItMatters.map((item, idx) => (
                  <div key={idx} className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs space-y-1.5">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <h6 className="text-xs font-bold text-stone-900">{item.title}</h6>
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed pl-6">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>

              <div className="bg-stone-100 p-4 rounded-xl border border-stone-200 text-xs text-stone-600 leading-relaxed space-y-1">
                <span className="font-bold text-stone-800 block">Security & Validation Guarantee:</span>
                <p>
                  ReqForge strictly validates all imported JSON structure before any questionnaire is created or stored. You maintain full human agency: inspect questions, preview rendering, re-order sections, or edit fields in the interactive builder before publishing.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-stone-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-stone-50/50">
          <div className="flex items-center gap-2 text-[11px] text-stone-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Standard JSON • Model Agnostic • Client-Ready Rendering</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:text-stone-900 bg-white border border-stone-200 hover:bg-stone-50 transition cursor-pointer min-h-[36px]"
            >
              Close
            </button>
            {onOpenImport && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenImport();
                }}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 transition shadow-xs cursor-pointer min-h-[36px]"
              >
                <span>Import JSON Now</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
