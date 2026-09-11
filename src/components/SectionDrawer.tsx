import React from 'react';
import { X, CheckCircle2, ChevronRight, Layers } from 'lucide-react';
import { QuestionnaireSection, QuestionnaireAnswers } from '../types';

interface SectionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sections: QuestionnaireSection[];
  currentSectionIndex: number;
  onSelectSection: (index: number) => void;
  answers: QuestionnaireAnswers;
}

export const SectionDrawer: React.FC<SectionDrawerProps> = ({
  isOpen,
  onClose,
  sections,
  currentSectionIndex,
  onSelectSection,
  answers,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="relative z-10 w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85dvh] sm:max-h-[80dvh] overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Mobile Pull Handle Indicator */}
        <div className="pt-2.5 pb-1 flex justify-center sm:hidden">
          <div className="w-10 h-1 bg-stone-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-200/80">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-stone-700" />
            <h2 className="text-base font-bold text-stone-900 tracking-tight">
              All {sections.length} Sections
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
            aria-label="Close sections list"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List of sections */}
        <div className="p-3 overflow-y-auto space-y-1.5 flex-1 divide-y divide-stone-100">
          {sections.map((sec, idx) => {
            const isCurrent = idx === currentSectionIndex;
            // Check if section questions are answered
            const allAnswered = sec.questions.every((q) => {
              const ans = answers[q.id];
              if (!ans || ans.value === null || ans.value === undefined) return false;
              if (Array.isArray(ans.value)) return ans.value.length > 0;
              if (typeof ans.value === 'string') return ans.value.trim().length > 0;
              return true;
            });

            return (
              <button
                key={sec.key}
                type="button"
                onClick={() => {
                  onSelectSection(idx);
                  onClose();
                }}
                className={`w-full text-left flex items-center justify-between p-3.5 rounded-xl transition-all cursor-pointer min-h-[50px] active:scale-[0.99] ${
                  isCurrent
                    ? 'bg-sky-50/90 border border-sky-300 text-sky-950 font-bold shadow-2xs'
                    : 'hover:bg-stone-50 text-stone-700'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 tabular-nums ${
                      allAnswered
                        ? 'bg-emerald-100 text-emerald-700'
                        : isCurrent
                        ? 'bg-sky-600 text-white'
                        : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    {allAnswered ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      sec.sectionNumber
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm truncate font-semibold text-stone-900">
                      {sec.title}
                    </p>
                    <p className="text-xs text-stone-500 truncate tabular-nums">
                      {sec.questions.length} questions
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-1.5">
                  {allAnswered && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Done
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-stone-400" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer with Safe Area */}
        <div className="p-3 pb-safe bg-stone-50 border-t border-stone-200 text-center">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 px-4 rounded-xl text-sm font-bold text-stone-700 bg-white border border-stone-200 hover:bg-stone-100 transition-colors cursor-pointer min-h-[44px] active:scale-[0.98]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
