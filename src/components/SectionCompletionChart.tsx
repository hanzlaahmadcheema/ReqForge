import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { QuestionnaireSection, QuestionnaireAnswers } from '../types';

interface SectionCompletionChartProps {
  sections: QuestionnaireSection[];
  answers: QuestionnaireAnswers;
  onJumpToSection: (sectionIndex: number) => void;
}

export const SectionCompletionChart: React.FC<SectionCompletionChartProps> = ({
  sections,
  answers,
  onJumpToSection,
}) => {
  // Compute section completion status
  const sectionStats = sections.map((sec, index) => {
    const totalQ = sec.questions.length;
    const answeredQ = sec.questions.filter((q) => {
      const ans = answers[q.id];
      if (!ans || ans.value === null || ans.value === undefined) return false;
      if (Array.isArray(ans.value)) return ans.value.length > 0;
      if (typeof ans.value === 'string') return ans.value.trim().length > 0;
      return true;
    }).length;

    const isComplete = answeredQ === totalQ;
    const percent = totalQ > 0 ? Math.round((answeredQ / totalQ) * 100) : 100;

    return {
      index,
      key: sec.key || sec.id,
      sectionNumber: sec.order ?? sec.sectionNumber ?? index + 1,
      title: sec.title,
      totalQ,
      answeredQ,
      isComplete,
      percent,
    };
  });

  const totalSections = sections.length;
  const completedSections = sectionStats.filter((s) => s.isComplete).length;
  const incompleteSections = sectionStats.filter((s) => !s.isComplete);
  const completionPercentage = totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0;

  // Donut chart data
  const pieData = [
    {
      name: 'Completed Sections',
      value: completedSections,
      color: '#059669', // emerald-600
    },
    {
      name: 'Remaining Sections',
      value: Math.max(0, totalSections - completedSections),
      color: '#e2e8f0', // slate-200
    },
  ];

  return (
    <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-xs">
      <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-stone-100">
        <div>
          <h3 className="text-sm font-bold text-stone-900 tracking-tight">
            Questionnaire Completion Progress
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Breakdown of all {totalSections} questionnaire sections
          </p>
        </div>
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
            completionPercentage === 100
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
              : 'bg-amber-50 text-amber-700 border border-amber-200/60'
          }`}
        >
          {completionPercentage === 100 ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>All {totalSections} Complete</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>{incompleteSections.length} Pending</span>
            </>
          )}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Recharts Donut Chart */}
        <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                formatter={(val: number, name: string) => [`${val} section(s)`, name]}
                contentStyle={{
                  backgroundColor: '#0f172a',
                  color: '#fff',
                  borderRadius: '8px',
                  fontSize: '12px',
                  padding: '6px 10px',
                  border: 'none',
                }}
                itemStyle={{ color: '#fff' }}
              />
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={44}
                outerRadius={62}
                startAngle={90}
                endAngle={-270}
                paddingAngle={completedSections > 0 && incompleteSections.length > 0 ? 3 : 0}
                dataKey="value"
                stroke="none"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* Central Percentage Typography */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-black text-stone-900 leading-none">
              {completionPercentage}%
            </span>
            <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mt-1">
              Sections
            </span>
          </div>
        </div>

        {/* Metric Details & Breakdown */}
        <div className="flex-1 w-full space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/60">
              <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide block">
                Sections Finished
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl font-bold text-stone-900">
                  {completedSections}
                </span>
                <span className="text-xs text-stone-500 font-medium">
                  / {totalSections}
                </span>
              </div>
            </div>

            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/60">
              <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide block">
                Total Questions Answered
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl font-bold text-stone-900">
                  {sectionStats.reduce((acc, s) => acc + s.answeredQ, 0)}
                </span>
                <span className="text-xs text-stone-500 font-medium">
                  / {sectionStats.reduce((acc, s) => acc + s.totalQ, 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Incomplete Sections list if any */}
          {incompleteSections.length > 0 ? (
            <div className="pt-1">
              <span className="text-xs font-semibold text-amber-800 block mb-1.5">
                Sections with unanswered questions:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {incompleteSections.map((sec) => (
                  <button
                    key={sec.key}
                    type="button"
                    onClick={() => onJumpToSection(sec.index)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 px-2 py-1 rounded-lg transition-colors group"
                  >
                    <span>Sec {sec.sectionNumber}: {sec.title}</span>
                    <span className="text-amber-600 font-normal">({sec.answeredQ}/{sec.totalQ})</span>
                    <ArrowRight className="w-3 h-3 text-amber-500 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-xs text-stone-600 flex items-center gap-1.5 py-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                All {totalSections} sections are fully answered and ready to be compiled or submitted.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
