import React from 'react';
import { ListFilter, Check } from 'lucide-react';

interface ProgressBarProps {
  currentSectionIndex: number; // 0 to 14
  totalSections: number; // 15
  answeredQuestionsCount: number;
  totalQuestionsCount: number;
  onOpenSectionsList: () => void;
  sectionTitle: string;
  showDraftSaved?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  currentSectionIndex,
  totalSections,
  answeredQuestionsCount,
  totalQuestionsCount,
  onOpenSectionsList,
  sectionTitle,
  showDraftSaved = false,
}) => {
  const percentComplete = Math.round((answeredQuestionsCount / totalQuestionsCount) * 100);
  const sectionProgressPercent = Math.round(((currentSectionIndex + 1) / totalSections) * 100);

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200 px-4 py-3 shadow-xs">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-stone-100 text-stone-700 tracking-wide">
                Section {currentSectionIndex + 1} of {totalSections}
              </span>
              <span className="text-xs text-stone-500 font-medium">
                {answeredQuestionsCount}/{totalQuestionsCount} answered
              </span>

              {/* Toast status indicator for auto-save */}
              {showDraftSaved && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full transition-all duration-300 animate-in fade-in"
                  role="status"
                  aria-live="polite"
                >
                  <Check className="w-3 h-3 text-emerald-600 stroke-[2.5]" />
                  <span>Draft saved</span>
                </span>
              )}
            </div>
            <h1 className="text-sm font-semibold text-stone-900 truncate mt-0.5">
              {sectionTitle}
            </h1>
          </div>

          <button
            type="button"
            onClick={onOpenSectionsList}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 rounded-lg transition-colors shrink-0"
            aria-label="View all sections"
          >
            <ListFilter className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sections</span>
          </button>
        </div>

        {/* Multi-tier progress bar */}
        <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden flex">
          <div
            className="bg-sky-600 h-full rounded-full transition-all duration-300 ease-out"
            style={{ width: `${percentComplete}%` }}
            role="progressbar"
            aria-valuenow={percentComplete}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>
    </header>
  );
};
