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
} from 'lucide-react';

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

          <div className="flex items-center gap-3">
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
        <section className="w-full max-w-4xl mx-auto px-4 pt-16 sm:pt-24 pb-12 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stone-100 text-stone-800 border border-stone-300/80 text-xs font-semibold mb-6 shadow-2xs animate-in fade-in slide-in-from-bottom-2 duration-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Secure Client Requirements Intake</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-stone-950 tracking-tight leading-[1.15] max-w-2xl mx-auto">
            Structured Requirements for Complex Software Projects
          </h1>

          <p className="mt-4 sm:mt-6 text-sm sm:text-base text-stone-600 max-w-xl mx-auto leading-relaxed">
            Access your assigned project questionnaire using the secure identifier and PIN provided by your project administrator.
          </p>

          {/* Form Access Card */}
          <div className="mt-10 max-w-md mx-auto bg-white p-6 sm:p-8 rounded-3xl border border-stone-200/90 shadow-xl shadow-stone-200/50 text-left">
            <div className="flex items-center gap-2.5 pb-4 border-b border-stone-100">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center border border-amber-200/60">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-stone-900 leading-tight">
                  Access Questionnaire Form
                </h2>
                <p className="text-[11px] text-stone-500">
                  Enter your Form Identifier to proceed to PIN verification
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
                  You will be prompted for your secure access PIN on the next screen.
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
                PIN-Protected Scoped Access
              </h4>
              <p className="text-xs text-stone-600 mt-2 leading-relaxed">
                Forms are isolated by project with salted, server-verified PINs. Plaintext credentials are never exposed publicly.
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
              onClick={onOpenAdmin}
              className="text-stone-600 hover:text-stone-950 font-semibold underline underline-offset-4 cursor-pointer transition-colors"
            >
              Administrator Console
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
