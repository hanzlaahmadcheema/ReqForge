import React from 'react';
import { X, Eye, ShieldAlert } from 'lucide-react';
import { Questionnaire } from '../../types';
import { QuestionnaireForm } from '../QuestionnaireForm';

interface QuestionnairePreviewModalProps {
  questionnaire: Questionnaire;
  isOpen: boolean;
  onClose: () => void;
}

export const QuestionnairePreviewModal: React.FC<QuestionnairePreviewModalProps> = ({
  questionnaire,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex flex-col items-center justify-start overflow-y-auto">
      {/* Top Modal Header */}
      <div className="w-full bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-stone-700">
            <Eye className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-stone-900">
                {questionnaire.title || 'Untitled Questionnaire'}
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 uppercase">
                v{questionnaire.version || 1} • {questionnaire.status}
              </span>
            </div>
            <p className="text-[11px] text-stone-500">
              Admin Preview using production client-side form renderer
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition cursor-pointer"
          title="Close preview"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Embedded Client Form Renderer */}
      <div className="w-full max-w-3xl flex-1 bg-stone-50/50">
        <QuestionnaireForm
          questionnaire={questionnaire}
          clientCode="Preview Client Ltd."
          projectName="Interactive Preview Project"
          isPreview={true}
          onClosePreview={onClose}
        />
      </div>
    </div>
  );
};
