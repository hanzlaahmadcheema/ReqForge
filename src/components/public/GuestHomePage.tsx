/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  KeyRound,
  FileCheck2,
  ArrowRight,
  Sparkles,
  Lock,
  Layers,
  FileSpreadsheet,
  Cpu,
  HelpCircle,
  ExternalLink,
  Copy,
  Check,
  Bot,
  FileCode,
  Terminal,
  CheckCircle2,
  Code2,
} from 'lucide-react';
import { AiWorkflowGuideModal } from '../common/AiWorkflowGuideModal';
import {
  REQFORGE_AI_AGENT_PROMPT,
  REQFORGE_CANONICAL_TEMPLATE_JSON,
  SUPPORTED_QUESTION_TYPES,
} from '../../lib/aiWorkflowConstants';
import { copyToClipboard } from '../../lib/clipboardUtils';

interface GuestHomePageProps {
  onAccessForm: (formIdOrCode: string) => void;
  onOpenAdmin: () => void;
}

export const GuestHomePage: React.FC<GuestHomePageProps> = ({
  onAccessForm,
  onOpenAdmin,
}) => {
  const [formInput, setFormInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  // Guide modal state
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [guideTab, setGuideTab] = useState<'workflow' | 'prompt' | 'template' | 'types' | 'about'>('workflow');

  // Inline copy states
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = formInput.trim();
    if (!clean) {
      setInputError('Please enter a valid Form Identifier or Link.');
      return;
    }

    // Support entering either a raw public ID (e.g. "pub_xyz123") or full URL ("/form/pub_xyz123" or "?form=pub_xyz123")
    let extractedId = clean;
    try {
      if (clean.includes('/form/')) {
        extractedId = clean.split('/form/')[1].split(/[?#]/)[0];
      } else if (clean.includes('form=')) {
        const params = new URLSearchParams(clean.includes('?') ? clean.split('?')[1] : clean);
        extractedId = params.get('form') || clean;
      }
    } catch {
      extractedId = clean;
    }

    extractedId = extractedId.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!extractedId) {
      setInputError('Could not recognize a valid Form Identifier.');
      return;
    }

    setInputError(null);
    onAccessForm(extractedId);
  };

  const handleCopyPrompt = async () => {
    const success = await copyToClipboard(REQFORGE_AI_AGENT_PROMPT);
    if (success) {
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2200);
    }
  };

  const handleCopyTemplate = async () => {
    const success = await copyToClipboard(REQFORGE_CANONICAL_TEMPLATE_JSON);
    if (success) {
      setCopiedTemplate(true);
      setTimeout(() => setCopiedTemplate(false), 2200);
    }
  };

  const openGuideWithTab = (tab: 'workflow' | 'prompt' | 'template' | 'types' | 'about') => {
    setGuideTab(tab);
    setIsGuideOpen(true);
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans flex flex-col selection:bg-stone-900 selection:text-white">
      {/* Top Navigation */}
      <header className="bg-white/80 backdrop-blur-md border-b border-stone-200/80 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-stone-900 text-white flex items-center justify-center font-black text-sm shadow-xs tracking-wider">
              RF
            </div>
            <div>
              <span className="font-extrabold text-stone-900 tracking-tight text-base sm:text-lg block leading-tight">
                ReqForge
              </span>
              <span className="text-[10px] text-stone-500 font-medium tracking-wide uppercase block">
                Requirements Engineering Platform
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => openGuideWithTab('workflow')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-stone-700 hover:text-stone-950 hover:bg-stone-100 rounded-xl transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-stone-600" />
              <span className="hidden sm:inline">AI Workflow Guide</span>
              <span className="sm:hidden">Guide</span>
            </button>

            <button
              type="button"
              onClick={onOpenAdmin}
              className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 rounded-xl transition-all cursor-pointer shadow-2xs active:scale-[0.98]"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Admin Portal</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center">
        <section className="w-full max-w-4xl mx-auto px-4 pt-14 sm:pt-20 pb-12 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stone-100 text-stone-800 border border-stone-300/80 text-xs font-semibold mb-6 shadow-2xs animate-in fade-in slide-in-from-bottom-2 duration-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Secure Client Requirements Intake</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-stone-950 tracking-tight leading-[1.15] max-w-2xl mx-auto">
            Structured Requirements for Complex Software Projects
          </h1>

          <p className="mt-4 sm:mt-6 text-sm sm:text-base text-stone-600 max-w-xl mx-auto leading-relaxed">
            Access your assigned project questionnaire using the form link or identifier provided by your project administrator.
          </p>

          {/* Form Access Card */}
          <div className="mt-10 max-w-md mx-auto bg-white p-6 sm:p-8 rounded-3xl border border-stone-200/90 shadow-xl shadow-stone-200/50 text-left">
            <div className="flex items-center gap-2.5 pb-4 border-b border-stone-100">
              <div className="w-8 h-8 rounded-xl bg-stone-100 text-stone-800 flex items-center justify-center border border-stone-200">
                <FileCheck2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-stone-900 leading-tight">
                  Access Questionnaire Form
                </h2>
                <p className="text-[11px] text-stone-500">
                  Enter your Form Identifier to access the questionnaire
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="form-id-input"
                  className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5"
                >
                  Form Identifier or Link
                </label>
                <div className="relative">
                  <input
                    id="form-id-input"
                    type="text"
                    value={formInput}
                    onChange={(e) => {
                      setFormInput(e.target.value);
                      if (inputError) setInputError(null);
                    }}
                    placeholder="e.g. pub_a8f9c1 or full link"
                    className={`w-full px-3.5 py-2.5 bg-stone-50 hover:bg-stone-50/80 focus:bg-white border text-sm rounded-xl font-mono text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 transition-all ${
                      inputError
                        ? 'border-rose-300 focus:ring-rose-500/20'
                        : 'border-stone-300 focus:border-stone-800 focus:ring-stone-900/15'
                    }`}
                  />
                </div>
                {inputError && (
                  <p className="mt-1.5 text-xs text-rose-600 font-medium">
                    {inputError}
                  </p>
                )}
                <p className="mt-1.5 text-[11px] text-stone-400">
                  Access the client form directly without requiring an account.
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 bg-stone-900 hover:bg-stone-800 active:bg-stone-950 text-white rounded-xl text-xs sm:text-sm font-bold tracking-wide transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-stone-900/10 active:scale-[0.99]"
              >
                <span>Continue to Form</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </section>

        {/* PROMINENT AI-AGENT WORKFLOW PROMOTION SECTION */}
        <section className="w-full max-w-5xl mx-auto px-4 py-16 border-t border-stone-200/80">
          <div className="bg-white text-stone-900 rounded-3xl p-6 sm:p-10 border border-stone-200/90 shadow-xl shadow-stone-200/50 relative overflow-hidden">
            {/* Ambient background subtle lighting */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-stone-100/50 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-stone-100/40 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 w-full">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stone-100 text-stone-800 border border-stone-300/80 text-xs font-semibold mb-4 shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>AI Creates the Questions • ReqForge Creates the Form</span>
              </div>

              <h2 className="text-2xl sm:text-4xl font-black text-stone-950 tracking-tight leading-tight">
                Turn AI-Generated Questions Into Client-Ready Forms
              </h2>

              <p className="mt-4 text-xs sm:text-sm text-stone-600 leading-relaxed max-w-2xl">
                Your AI agent can help you figure out what questions to ask your client.
                Give the agent the ReqForge JSON format, ask it to create the questionnaire, then paste the generated JSON into ReqForge.
                ReqForge automatically turns it into a structured, professional questionnaire.
              </p>

              {/* Visual Workflow Diagram */}
              <div className="mt-8 p-4 sm:p-6 bg-stone-50/90 border border-stone-200/90 rounded-2xl">
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 sm:gap-2 items-center text-center">
                  <div className="p-3.5 rounded-xl bg-white border border-stone-200/90 shadow-2xs">
                    <Bot className="w-5 h-5 text-stone-800 mx-auto mb-1.5" />
                    <span className="text-[10px] font-mono font-bold text-stone-400 block uppercase">Step 1</span>
                    <span className="text-xs font-bold block text-stone-900 mt-0.5">AI Agent</span>
                    <span className="text-[10px] text-stone-500 leading-tight block mt-0.5">"Create requirements questions"</span>
                  </div>

                  <div className="flex justify-center text-stone-400">
                    <ArrowRight className="w-4 h-4 rotate-90 sm:rotate-0" />
                  </div>

                  <div className="p-3.5 rounded-xl bg-white border border-stone-200/90 shadow-2xs">
                    <FileCode className="w-5 h-5 text-stone-800 mx-auto mb-1.5" />
                    <span className="text-[10px] font-mono font-bold text-stone-400 block uppercase">Step 2</span>
                    <span className="text-xs font-bold block text-stone-900 mt-0.5">ReqForge JSON</span>
                    <span className="text-[10px] text-stone-500 leading-tight block mt-0.5">Copy generated JSON</span>
                  </div>

                  <div className="flex justify-center text-stone-400">
                    <ArrowRight className="w-4 h-4 rotate-90 sm:rotate-0" />
                  </div>

                  <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 shadow-2xs">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto mb-1.5" />
                    <span className="text-[10px] font-mono font-bold text-emerald-700 block uppercase">Step 3</span>
                    <span className="text-xs font-bold block text-stone-900 mt-0.5">Client-Ready Form</span>
                    <span className="text-[10px] text-emerald-800/80 leading-tight block mt-0.5">Client answers client-ready form directly</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer active:scale-[0.98] ${
                    copiedPrompt
                      ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                      : 'bg-stone-900 hover:bg-stone-800 active:bg-stone-950 text-white shadow-stone-900/10'
                  }`}
                >
                  {copiedPrompt ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Copied AI Prompt!</span>
                    </>
                  ) : (
                    <>
                      <Terminal className="w-4 h-4 text-stone-300" />
                      <span>Copy AI Prompt</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleCopyTemplate}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer border active:scale-[0.98] ${
                    copiedTemplate
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-white hover:bg-stone-50 border-stone-300 text-stone-800 shadow-2xs'
                  }`}
                >
                  {copiedTemplate ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Copied Template!</span>
                    </>
                  ) : (
                    <>
                      <FileCode className="w-4 h-4 text-stone-500" />
                      <span>Get JSON Template</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => openGuideWithTab('workflow')}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-stone-700 hover:text-stone-950 hover:bg-stone-100 transition cursor-pointer"
                >
                  <span>See How It Works</span>
                  <ArrowRight className="w-3.5 h-3.5 text-stone-500" />
                </button>
              </div>

              {/* Supported Question Capabilities Grid */}
              <div className="mt-8 pt-6 border-t border-stone-200/80">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                    Full Support for Existing Questionnaire Capabilities
                  </span>
                  <button
                    type="button"
                    onClick={() => openGuideWithTab('types')}
                    className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold cursor-pointer"
                  >
                    View Type Specifications &rarr;
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-left">
                  {[
                    { label: 'Short answers', tag: 'text' },
                    { label: 'Long answers', tag: 'textarea' },
                    { label: 'Single-choice options', tag: 'single_choice' },
                    { label: 'Multiple-choice checks', tag: 'multiple_choice' },
                    { label: 'Yes / No questions', tag: 'yes_no' },
                    { label: 'Number values', tag: 'number' },
                    { label: 'Date pickers', tag: 'date' },
                    { label: 'Conditional follow-ups', tag: 'conditional' },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/80 text-xs text-stone-800 flex items-center justify-between hover:border-stone-300 transition-colors shadow-2xs"
                    >
                      <span className="font-medium text-[11px] text-stone-700">{item.label}</span>
                      <code className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-stone-200/70 text-stone-700 font-semibold">
                        {item.tag}
                      </code>
                    </div>
                  ))}
                </div>
              </div>

              {/* Transparency Notice */}
              <p className="mt-4 text-[11px] text-stone-500 leading-relaxed">
                Compatible with <strong className="font-semibold text-stone-800">ChatGPT, Claude, Gemini, Copilot, Cursor</strong>, and custom AI agents.
                ReqForge does not read your private chats or require external API keys. You copy the JSON, and ReqForge validates it before publishing.
              </p>
            </div>
          </div>
        </section>

        {/* Platform Capabilities Overview */}
        <section className="w-full max-w-5xl mx-auto px-4 py-16 border-t border-stone-200/80">
          <div className="text-center max-w-xl mx-auto mb-12">
            <h3 className="text-xl font-black text-stone-900 tracking-tight">
              Enterprise Requirements Lifecycle
            </h3>
            <p className="text-xs text-stone-500 mt-2">
              Engineered for clarity, cryptographic security, and automated requirements analysis.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-800 flex items-center justify-center mb-4 border border-stone-200">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-stone-900">
                Direct Scoped Public Access
              </h4>
              <p className="text-xs text-stone-600 mt-2 leading-relaxed">
                Forms are isolated by project and workspace with direct, seamless access. Clients can complete questionnaires without needing an account.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-800 flex items-center justify-center mb-4 border border-stone-200">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-stone-900">
                Drafts & Immutable Submissions
              </h4>
              <p className="text-xs text-stone-600 mt-2 leading-relaxed">
                Save work-in-progress across sessions with automatic draft restoration. Once submitted, responses are archived immutably.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white p-6 rounded-2xl border border-stone-200/80 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-800 flex items-center justify-center mb-4 border border-stone-200">
                <Cpu className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-stone-900">
                AI Requirements Extraction
              </h4>
              <p className="text-xs text-stone-600 mt-2 leading-relaxed">
                Convert qualitative answers into structured specifications, automated gap analyses, and exportable engineering artifacts.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-stone-200 py-8 px-4 text-center">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-stone-800">ReqForge</span>
            <span>&bull;</span>
            <span>Structured Requirements Engineering Platform</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => openGuideWithTab('about')}
              className="text-stone-600 hover:text-stone-950 font-semibold underline underline-offset-4 cursor-pointer transition-colors"
            >
              What is ReqForge JSON?
            </button>
            <button
              type="button"
              onClick={onOpenAdmin}
              className="text-stone-600 hover:text-stone-950 font-semibold underline underline-offset-4 cursor-pointer transition-colors"
            >
              Administrator Console
            </button>
          </div>
        </div>
      </footer>

      {/* AI Workflow & JSON Guide Modal */}
      <AiWorkflowGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        initialTab={guideTab}
        onOpenImport={onOpenAdmin}
      />
    </div>
  );
};
