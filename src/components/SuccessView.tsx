import React, { useState } from 'react';
import { CheckCircle, CheckCircle2, XCircle, Copy, Check, FileDown, RotateCcw, Database, FileText, Trophy } from 'lucide-react';
import { QuestionnaireAnswers, QuestionnaireSection, Questionnaire } from '../types';
import { generateQuestionnairePdf } from '../lib/generatePdf';
import { copyToClipboard } from '../lib/clipboardUtils';
import type { QuizResult } from '../lib/quizScoring';

interface SuccessViewProps {
  docId: string;
  masterDocId: string;
  clientCode: string;
  projectName?: string;
  sections: QuestionnaireSection[];
  answers: QuestionnaireAnswers;
  additionalRequirements: string;
  quizResult?: QuizResult | null;
  questionnaire?: Questionnaire | null;
  onReset: () => void;
}

export const SuccessView: React.FC<SuccessViewProps> = ({
  docId,
  masterDocId,
  clientCode,
  projectName,
  sections,
  answers,
  additionalRequirements,
  quizResult = null,
  questionnaire = null,
  onReset,
}) => {
  const [copied, setCopied] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

  // Quiz display rules: the respondent sees the score right after submitting
  // unless the questionnaire explicitly hides it.
  const isQuiz = !!quizResult;
  const showScore = isQuiz && questionnaire?.showScoreOnSubmit !== false;
  const showAnswers = isQuiz && questionnaire?.showCorrectAnswers !== false;

  const handleDownloadPdf = () => {
    setIsPdfGenerating(true);
    try {
      generateQuestionnairePdf({
        clientCode: clientCode || 'Default Client',
        projectName: projectName,
        sections,
        answers,
        additionalRequirements,
        isSubmitted: true,
        // Anonymous quiz: there is no stored record, so no document ID.
        submissionDocId: isQuiz ? undefined : docId,
        quizResult: quizResult || undefined,
      });
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setIsPdfGenerating(false);
    }
  };

  const handleCopyDocId = async () => {
    const success = await copyToClipboard(docId);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadReceipt = () => {
    let content = `=====================================================\n`;
    content += `CLIENT REQUIREMENTS QUESTIONNAIRE - SUBMISSION RECEIPT\n`;
    content += `=====================================================\n\n`;
    content += `Client Identifier: ${clientCode}\n`;
    if (projectName) {
      content += `Project: ${projectName}\n`;
    }
    if (quizResult) {
      // Anonymous quiz: no record exists anywhere — say so explicitly.
      content += `Anonymous quiz — no record was saved. Score calculated in your browser only.\n`;
    } else {
      content += `Firestore Document ID: ${docId}\n`;
      content += `Firestore Collection: submissions\n`;
    }
    content += `Submitted At: ${new Date().toLocaleString()}\n\n`;

    if (quizResult) {
      content += `-----------------------------------------------------\n`;
      content += `QUIZ SCORE\n`;
      content += `-----------------------------------------------------\n\n`;
      content += `Score: ${quizResult.earned} / ${quizResult.total} (${quizResult.percent}%)\n`;
      if (quizResult.passMark !== undefined) {
        content += `Pass Mark: ${quizResult.passMark}% — ${quizResult.passed ? 'PASSED' : 'FAILED'}\n`;
      }
      content += `\n`;
      quizResult.perQuestion.forEach((pq, idx) => {
        content += `  Q${idx + 1}. ${pq.questionText}\n`;
        content += `    Your answer: ${pq.userLabel ?? 'Not answered'}\n`;
        content += `    Correct answer: ${pq.correctLabels.join(', ') || '—'}\n`;
        content += `    Result: ${pq.correct ? 'Correct' : 'Incorrect'} (${pq.earned}/${pq.points} pts)\n`;
        if (pq.explanation) content += `    Explanation: ${pq.explanation}\n`;
        content += `\n`;
      });
    }
    content += `-----------------------------------------------------\n`;
    content += `SUBMITTED ANSWERS\n`;
    content += `-----------------------------------------------------\n\n`;

    sections.forEach((sec) => {
      content += `[Section ${sec.sectionNumber}: ${sec.title}]\n`;
      sec.questions.forEach((q) => {
        const a = answers[q.id];
        let valStr = 'Not answered';
        if (a && a.value !== null && a.value !== undefined) {
          if (Array.isArray(a.value)) {
            valStr = a.value.join(', ');
          } else {
            valStr = String(a.value);
          }
          if (a.otherText) valStr += ` (Other: ${a.otherText})`;
          if (a.conditionalValue) valStr += ` | Follow-up: ${String(a.conditionalValue)}`;
        }
        content += `  Q${q.questionNumber}. ${q.title}\n    Answer: ${valStr}\n\n`;
      });
    });

    if (additionalRequirements) {
      content += `[Additional Requirements & Notes]\n  ${additionalRequirements}\n\n`;
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${clientCode}_questionnaire_receipt.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-xl mx-auto py-8 px-4 text-center animate-in fade-in zoom-in-95 duration-300">
      <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-xs">
        <CheckCircle className="w-10 h-10" />
      </div>

      <h2 className="text-2xl font-bold text-stone-900 tracking-tight">
        {isQuiz ? 'Quiz Submitted!' : 'Questionnaire Submitted!'}
      </h2>
      <p className="text-sm text-stone-600 mt-2 max-w-md mx-auto">
        {isQuiz
          ? 'Your score was calculated in this browser only. Nothing was saved or sent anywhere — this quiz is completely anonymous.'
          : 'Your client requirements answers have been safely saved directly into Firebase Firestore.'}
      </p>

      {/* Quiz Score Banner */}
      {showScore && quizResult && (
        <div
          className={`mt-6 rounded-2xl p-5 border text-left shadow-xs ${
            quizResult.passMark !== undefined && !quizResult.passed
              ? 'bg-rose-50 border-rose-200'
              : 'bg-emerald-50 border-emerald-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                quizResult.passMark !== undefined && !quizResult.passed
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              <Trophy className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
                Your Score
              </p>
              <p className="text-2xl font-black text-stone-900 tabular-nums leading-tight">
                {quizResult.earned} / {quizResult.total}
                <span className="text-base font-bold text-stone-500 ml-2">
                  ({quizResult.percent}%)
                </span>
              </p>
            </div>
            {quizResult.passMark !== undefined && (
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border shrink-0 ${
                  quizResult.passed
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-rose-600 text-white border-rose-600'
                }`}
              >
                {quizResult.passed ? 'Passed' : 'Failed'}
              </span>
            )}
          </div>
          {quizResult.passMark !== undefined && (
            <p className="text-xs text-stone-600 mt-2">
              Pass mark: {quizResult.passMark}%
            </p>
          )}
        </div>
      )}

      {/* Database Record Card — not shown for anonymous quizzes: there is no
          stored record to point at. */}
      {!isQuiz && (
      <div className="mt-6 bg-white rounded-2xl p-5 border border-stone-200 shadow-xs text-left">
        <div className="flex items-center gap-2 pb-3 border-b border-stone-150">
          <Database className="w-4 h-4 text-sky-600" />
          <span className="text-xs font-bold uppercase tracking-wider text-stone-700">
            Firestore Record Details
          </span>
        </div>

        <div className="space-y-3 mt-3 text-xs">
          <div>
            <span className="text-stone-400 block font-mono">Collection</span>
            <span className="text-stone-800 font-semibold font-mono text-sm">
              clientResponses
            </span>
          </div>

          <div>
            <span className="text-stone-400 block font-mono">Submission Document ID</span>
            <div className="flex items-center justify-between gap-2 mt-0.5 bg-stone-50 p-2 rounded-lg border border-stone-200">
              <span className="font-mono text-stone-900 font-medium truncate">
                {docId}
              </span>
              <button
                type="button"
                onClick={handleCopyDocId}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-stone-700 hover:bg-stone-100 shrink-0 font-sans min-h-[38px] sm:min-h-0 cursor-pointer active:scale-[0.98]"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div>
            <span className="text-stone-400 block font-mono">Client ID</span>
            <span className="text-stone-800 font-medium">{clientCode}</span>
          </div>

          <div>
            <span className="text-stone-400 block font-mono">Status</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              Stored in Cloud Firestore
            </span>
          </div>
        </div>
      </div>
      )}

      {/* Quiz Per-Question Review */}
      {showAnswers && quizResult && quizResult.perQuestion.length > 0 && (
        <div className="mt-6 bg-white rounded-2xl p-5 border border-stone-200 shadow-xs text-left">
          <div className="flex items-center gap-2 pb-3 border-b border-stone-150">
            <CheckCircle2 className="w-4 h-4 text-sky-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-stone-700">
              Answer Review
            </span>
          </div>

          <div className="space-y-3 mt-3">
            {quizResult.perQuestion.map((pq, idx) => (
              <div
                key={pq.questionId}
                className={`p-3.5 rounded-xl border ${
                  pq.correct
                    ? 'bg-emerald-50/60 border-emerald-200'
                    : 'bg-rose-50/60 border-rose-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  {pq.correct ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-stone-900 leading-snug">
                      Q{idx + 1}. {pq.questionText}
                    </p>
                    <p className="text-xs text-stone-600 mt-1">
                      Your answer:{' '}
                      <span className="font-semibold text-stone-900">
                        {pq.userLabel ?? 'Not answered'}
                      </span>
                    </p>
                    {!pq.correct && (
                      <p className="text-xs text-stone-600 mt-0.5">
                        Correct answer:{' '}
                        <span className="font-semibold text-emerald-800">
                          {pq.correctLabels.join(', ') || '—'}
                        </span>
                      </p>
                    )}
                    {pq.explanation && (
                      <p className="text-xs text-stone-500 mt-1.5 bg-white/70 border border-stone-200/70 rounded-lg px-2.5 py-1.5 leading-relaxed">
                        {pq.explanation}
                      </p>
                    )}
                  </div>
                  <span className="text-[11px] font-bold text-stone-500 tabular-nums shrink-0">
                    {pq.earned}/{pq.points} pts
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 pb-safe sm:pb-0">
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={isPdfGenerating}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-sky-600 hover:bg-sky-700 active:scale-[0.98] text-white font-semibold text-sm transition-all shadow-xs min-h-[48px] cursor-pointer"
        >
          {isPdfGenerating ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Generating PDF...</span>
            </>
          ) : (
            <>
              <FileDown className="w-4 h-4" />
              <span>Download Formatted PDF</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleDownloadReceipt}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-stone-900 hover:bg-stone-800 active:scale-[0.98] text-white font-medium text-sm transition-all shadow-xs min-h-[48px] cursor-pointer"
        >
          <FileText className="w-4 h-4" />
          <span>Receipt (.txt)</span>
        </button>

        <button
          type="button"
          onClick={onReset}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-white border border-stone-200 hover:bg-stone-50 active:scale-[0.98] text-stone-700 font-medium text-sm transition-all min-h-[48px] cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>{isQuiz ? 'Take the quiz again' : 'Fill Another Form'}</span>
        </button>
      </div>
    </div>
  );
};
