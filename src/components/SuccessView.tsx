import React, { useState } from 'react';
import { CheckCircle, Copy, Check, FileDown, RotateCcw, Database, FileText } from 'lucide-react';
import { QuestionnaireAnswers, QuestionnaireSection } from '../types';
import { generateQuestionnairePdf } from '../lib/generatePdf';
import { copyToClipboard } from '../lib/clipboardUtils';

interface SuccessViewProps {
  docId: string;
  masterDocId: string;
  clientCode: string;
  projectName?: string;
  sections: QuestionnaireSection[];
  answers: QuestionnaireAnswers;
  additionalRequirements: string;
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
  onReset,
}) => {
  const [copied, setCopied] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

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
        submissionDocId: docId,
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
    content += `Firestore Document ID: ${docId}\n`;
    content += `Firestore Collection: submissions\n`;
    content += `Submitted At: ${new Date().toLocaleString()}\n\n`;
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
        Questionnaire Submitted!
      </h2>
      <p className="text-sm text-stone-600 mt-2 max-w-md mx-auto">
        Your client requirements answers have been safely saved directly into Firebase Firestore.
      </p>

      {/* Database Record Card */}
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
          <span>Fill Another Form</span>
        </button>
      </div>
    </div>
  );
};
