import React, { useState } from 'react';
import { CheckCircle2, Edit3, Send, AlertCircle, Building2, User, Phone, FileDown, Check } from 'lucide-react';
import { QuestionnaireSection, QuestionnaireAnswers } from '../types';
import { generateQuestionnairePdf } from '../lib/generatePdf';
import { SectionCompletionChart } from './SectionCompletionChart';

interface ReviewSummaryProps {
  sections: QuestionnaireSection[];
  answers: QuestionnaireAnswers;
  clientCode: string;
  setClientCode: (val: string) => void;
  contactPerson: string;
  setContactPerson: (val: string) => void;
  contactPhone: string;
  setContactPhone: (val: string) => void;
  additionalRequirements: string;
  setAdditionalRequirements: (val: string) => void;
  onJumpToSection: (sectionIndex: number) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  submitError: string | null;
}

export const ReviewSummary: React.FC<ReviewSummaryProps> = ({
  sections,
  answers,
  clientCode,
  setClientCode,
  contactPerson,
  setContactPerson,
  contactPhone,
  setContactPhone,
  additionalRequirements,
  setAdditionalRequirements,
  onJumpToSection,
  onSubmit,
  isSubmitting,
  submitError,
}) => {
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [pdfDownloaded, setPdfDownloaded] = useState(false);

  const handleDownloadPdf = () => {
    setIsPdfGenerating(true);
    try {
      generateQuestionnairePdf({
        clientCode: clientCode || 'Client',
        contactPerson,
        contactPhone,
        additionalRequirements,
        sections,
        answers,
        isSubmitted: false,
      });
      setPdfDownloaded(true);
      setTimeout(() => setPdfDownloaded(false), 3000);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setIsPdfGenerating(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Overview Banner */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-900">
                Ready for Final Submission
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Review your answers below. You can download a PDF copy before submitting to Firestore.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isPdfGenerating}
            className="inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-800 text-xs font-semibold shadow-2xs transition-all shrink-0 active:scale-[0.98] min-h-[44px]"
          >
            {pdfDownloaded ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700">PDF Downloaded!</span>
              </>
            ) : isPdfGenerating ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-stone-300 border-t-stone-700 rounded-full animate-spin" />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4 text-sky-600" />
                <span>Download Formatted PDF</span>
              </>
            )}
          </button>
        </div>

        {/* Client & Contact Header Card */}
        <div className="mt-5 pt-4 border-t border-stone-150 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-stone-400" />
              Client Identifier:
            </label>
            <input
              type="text"
              value={clientCode}
              onChange={(e) => setClientCode(e.target.value)}
              placeholder="e.g. clientIdentifier"
              className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm min-h-[44px] sm:min-h-0 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
            <span className="text-[10px] text-stone-400 mt-0.5 block">
              Firestore document key
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-stone-400" />
              Contact Person (Optional):
            </label>
            <input
              type="text"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="Your name or manager title"
              className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm min-h-[44px] sm:min-h-0 bg-white border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-stone-400" />
              Phone / WhatsApp (Optional):
            </label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="For confirmation updates"
              className="w-full px-3.5 py-2.5 sm:py-2 text-base sm:text-sm min-h-[44px] sm:min-h-0 bg-white border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
          </div>
        </div>
      </div>

      {/* Visual Recharts Progress Chart */}
      <SectionCompletionChart
        sections={sections}
        answers={answers}
        onJumpToSection={onJumpToSection}
      />

      {/* Additional Requirements Textarea */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200/80 shadow-xs">
        <label className="block text-sm font-semibold text-stone-900 mb-1.5">
          Additional Requirements & Special Notes
        </label>
        <p className="text-xs text-stone-500 mb-3">
          Any specific technical requirements, third-party integrations, compliance policies, or project-specific constraints.
        </p>
        <textarea
          rows={3}
          value={additionalRequirements}
          onChange={(e) => setAdditionalRequirements(e.target.value)}
          placeholder="e.g., We require single sign-on integration with our existing identity provider, automated nightly reporting, and compatibility with our internal database systems."
          className="w-full p-3.5 sm:p-3 text-base sm:text-sm rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 text-stone-900 resize-y"
        />
      </div>

      {/* Section by Section Review */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold uppercase tracking-wider text-stone-600">
            Summary by Section ({sections.length} Sections)
          </h3>
          <span className="text-xs text-stone-400 font-medium">
            Tap 'Edit' to change
          </span>
        </div>

        {sections.map((sec, idx) => (
          <div
            key={sec.key}
            className="bg-white rounded-xl p-4 border border-stone-200/80 shadow-xs"
          >
            <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-2.5 mb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-stone-100 text-stone-700 text-xs font-semibold flex items-center justify-center">
                  {sec.order ?? sec.sectionNumber ?? idx + 1}
                </span>
                <h4 className="text-sm font-semibold text-stone-900">
                  {sec.title}
                </h4>
              </div>

              <button
                type="button"
                onClick={() => onJumpToSection(idx)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer min-h-[36px] active:scale-[0.98]"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {sec.questions.map((q) => {
                const ans = answers[q.id];
                let displayVal = 'Not answered';

                if (ans && ans.value !== null && ans.value !== undefined) {
                  if (typeof ans.value === 'boolean') {
                    displayVal = ans.value ? 'Yes' : 'No';
                  } else if (Array.isArray(ans.value)) {
                    displayVal = ans.value.length > 0 ? ans.value.join(', ') : 'None selected';
                  } else {
                    displayVal = String(ans.value);
                  }

                  if (ans.otherText) {
                    displayVal += ` (Other: ${ans.otherText})`;
                  }

                  if (ans.conditionalValue !== undefined && ans.conditionalValue !== null && ans.conditionalValue !== '') {
                    displayVal += ` | Follow-up: ${String(ans.conditionalValue)}`;
                  }
                }

                return (
                  <div key={q.id} className="grid grid-cols-1 sm:grid-cols-3 gap-1">
                    <span className="font-medium text-stone-600 sm:col-span-1 truncate">
                      Q{q.order ?? q.questionNumber ?? ''}. {q.text || q.title}:
                    </span>
                    <span className="text-stone-900 sm:col-span-2 font-normal break-words">
                      {displayVal}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Submit Error Message */}
      {submitError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Submission failed to complete</p>
            <p className="mt-0.5">{submitError}</p>
          </div>
        </div>
      )}

      {/* Action Buttons: Download PDF before submit + Final Submit */}
      <div className="pt-2 space-y-3 pb-safe">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isPdfGenerating}
            className="w-full sm:w-1/2 py-3.5 px-5 rounded-xl bg-white border border-stone-300 hover:bg-stone-50 active:scale-[0.98] text-stone-800 font-semibold text-sm shadow-xs transition-all flex items-center justify-center gap-2 min-h-[48px] cursor-pointer"
          >
            {pdfDownloaded ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700">PDF Downloaded!</span>
              </>
            ) : isPdfGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-stone-400 border-t-stone-800 rounded-full animate-spin" />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4 text-sky-600" />
                <span>Download Formatted PDF</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className="w-full sm:w-1/2 py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px] cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Saving to Firestore...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Submit Questionnaire</span>
              </>
            )}
          </button>
        </div>

        <p className="text-center text-[11px] text-stone-400">
          Responses will be safely stored under Firestore collection <span className="font-mono font-medium text-stone-600">clientResponses</span>
        </p>
      </div>
    </div>
  );
};
