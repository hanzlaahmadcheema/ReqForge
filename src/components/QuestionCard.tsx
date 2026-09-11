import React from 'react';
import { Check, Info, HelpCircle } from 'lucide-react';
import { Question, AnswerValue } from '../types';

interface QuestionCardProps {
  question: Question;
  answer: AnswerValue | undefined;
  onChange: (questionId: string, answer: AnswerValue) => void;
  showError?: boolean;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  answer,
  onChange,
  showError = false,
}) => {
  const currentValue = answer?.value;
  const currentOtherText = answer?.otherText || '';
  const currentConditionalValue = answer?.conditionalValue;
  const currentConditionalOtherText = answer?.conditionalOtherText || '';

  const handleValueChange = (val: string | number | boolean | string[] | null) => {
    onChange(question.id, {
      value: val,
      otherText: currentOtherText,
      conditionalValue: currentConditionalValue,
      conditionalOtherText: currentConditionalOtherText,
    });
  };

  const handleOtherTextChange = (text: string) => {
    onChange(question.id, {
      value: currentValue ?? null,
      otherText: text,
      conditionalValue: currentConditionalValue,
      conditionalOtherText: currentConditionalOtherText,
    });
  };

  const handleConditionalValueChange = (val: string | number | boolean | string[] | null) => {
    onChange(question.id, {
      value: currentValue ?? null,
      otherText: currentOtherText,
      conditionalValue: val,
      conditionalOtherText: currentConditionalOtherText,
    });
  };

  const handleCheckboxToggle = (optionValue: string) => {
    const list = Array.isArray(currentValue) ? [...currentValue] : [];
    const index = list.indexOf(optionValue);
    if (index > -1) {
      list.splice(index, 1);
    } else {
      list.push(optionValue);
    }
    handleValueChange(list);
  };

  // Resolve conditional rule whether in new generic format or legacy format
  const conditional = question.conditionalRule || (question.conditional ? {
    dependsOnQuestionId: question.conditional.showWhenQuestionId,
    operator: 'equals' as const,
    value: question.conditional.showWhenValue,
    followUpQuestion: question.conditional.question,
  } : undefined);

  // Check if conditional question should be shown
  let isConditionalActive = false;
  if (conditional) {
    const targetVal = conditional.value;
    const operator = conditional.operator || 'equals';

    if (operator === 'equals') {
      if (typeof targetVal === 'boolean') {
        isConditionalActive = currentValue === targetVal;
      } else if (Array.isArray(targetVal)) {
        if (Array.isArray(currentValue)) {
          isConditionalActive = targetVal.some((v) => currentValue.includes(v));
        } else {
          isConditionalActive = targetVal.includes(String(currentValue));
        }
      } else {
        if (Array.isArray(currentValue)) {
          isConditionalActive = currentValue.includes(targetVal);
        } else {
          isConditionalActive = currentValue === targetVal;
        }
      }
    } else if (operator === 'contains') {
      if (Array.isArray(currentValue)) {
        isConditionalActive = currentValue.includes(String(targetVal));
      } else {
        isConditionalActive = String(currentValue).includes(String(targetVal));
      }
    } else if (operator === 'not_equals') {
      isConditionalActive = currentValue !== targetVal;
    }
  }

  const questionTitle = question.text || question.title || '';
  const questionDescription = question.description || question.helperText;
  const questionNumber = question.order ?? question.questionNumber ?? 1;

  // Normalized type flags
  const isYesNo = question.type === 'yes_no';
  const isSingleChoice = question.type === 'single_choice' || question.type === 'radio';
  const isMultipleChoice = question.type === 'multiple_choice' || question.type === 'checkbox';
  const isText = question.type === 'text' || question.type === 'short_text';
  const isTextarea = question.type === 'textarea' || question.type === 'long_text';
  const isNumber = question.type === 'number';
  const isDate = question.type === 'date';

  // Dynamic labels for yes/no or custom true/false choices
  const yesOptionLabel =
    question.options?.find((o) => o.value === 'true' || o.value === 'yes')?.label ||
    question.options?.[0]?.label ||
    'Yes';
  const noOptionLabel =
    question.options?.find((o) => o.value === 'false' || o.value === 'no')?.label ||
    question.options?.[1]?.label ||
    'No';

  return (
    <div
      id={`question-card-${question.id}`}
      className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all duration-200 ${
        showError
          ? 'border-rose-400 ring-2 ring-rose-100 shadow-sm'
          : 'border-stone-200/80 shadow-2xs hover:border-stone-300'
      }`}
    >
      {/* Question Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex items-center justify-center w-7 h-7 rounded-xl bg-stone-100 text-stone-700 font-bold text-xs shrink-0 mt-0.5 border border-stone-200 tabular-nums shadow-2xs">
          {questionNumber}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base sm:text-base font-bold text-stone-900 leading-snug tracking-tight text-balance">
            {questionTitle}
            {question.required && (
              <span className="text-rose-500 ml-1 font-bold" title="Required">
                *
              </span>
            )}
          </h2>

          {questionDescription && (
            <p className="text-xs sm:text-sm text-stone-500 mt-1 leading-relaxed">
              {questionDescription}
            </p>
          )}

          {question.example && (
            <div className="mt-2 flex items-start gap-1.5 p-2.5 rounded-xl bg-stone-50 text-stone-600 text-xs border border-stone-200/70">
              <Info className="w-3.5 h-3.5 text-stone-400 mt-0.5 shrink-0" />
              <span className="leading-relaxed">{question.example}</span>
            </div>
          )}
        </div>
      </div>

      {/* Inputs based on type */}
      <div className="mt-3.5 pl-0 sm:pl-10 space-y-2.5">
        {/* 1. YES / NO TYPE */}
        {isYesNo && (
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleValueChange(true)}
              className={`flex items-center justify-center gap-2 py-3 px-3 sm:px-4 rounded-xl border text-sm font-semibold transition-all min-h-[48px] cursor-pointer active:scale-[0.98] ${
                currentValue === true
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-950 ring-2 ring-emerald-500/20 shadow-xs'
                  : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50 active:bg-stone-100'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full flex items-center justify-center border shrink-0 transition-colors ${
                  currentValue === true
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-stone-300'
                }`}
              >
                {currentValue === true && <Check className="w-2.5 h-2.5" />}
              </div>
              <span className="truncate">{yesOptionLabel}</span>
            </button>

            <button
              type="button"
              onClick={() => handleValueChange(false)}
              className={`flex items-center justify-center gap-2 py-3 px-3 sm:px-4 rounded-xl border text-sm font-semibold transition-all min-h-[48px] cursor-pointer active:scale-[0.98] ${
                currentValue === false
                  ? 'bg-stone-100 border-stone-600 text-stone-950 ring-2 ring-stone-400/20 shadow-xs'
                  : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50 active:bg-stone-100'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full flex items-center justify-center border shrink-0 transition-colors ${
                  currentValue === false
                    ? 'border-stone-700 bg-stone-700 text-white'
                    : 'border-stone-300'
                }`}
              >
                {currentValue === false && <Check className="w-2.5 h-2.5" />}
              </div>
              <span className="truncate">{noOptionLabel}</span>
            </button>
          </div>
        )}

        {/* 2. SINGLE CHOICE (RADIO) */}
        {isSingleChoice && question.options && (
          <div className="space-y-2">
            {question.options.map((opt) => {
              const isSelected = currentValue === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleValueChange(opt.value)}
                  className={`w-full text-left flex items-start gap-3 p-3.5 rounded-xl border text-sm transition-all min-h-[48px] cursor-pointer active:scale-[0.99] ${
                    isSelected
                      ? 'bg-sky-50/90 border-sky-500 text-sky-950 font-semibold ring-2 ring-sky-500/20 shadow-xs'
                      : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50 hover:border-stone-300 active:bg-stone-100'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center border shrink-0 mt-0.5 transition-colors ${
                      isSelected
                        ? 'border-sky-600 bg-sky-600 text-white'
                        : 'border-stone-300 bg-white'
                    }`}
                  >
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block leading-snug">{opt.label}</span>
                    {opt.description && (
                      <span className="text-xs text-stone-500 mt-1 block leading-relaxed font-normal">
                        {opt.description}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}

            {/* Optional 'Other' field */}
            {question.hasOther && (
              <div className="pt-1">
                <input
                  type="text"
                  value={currentOtherText}
                  onChange={(e) => handleOtherTextChange(e.target.value)}
                  placeholder={question.otherPlaceholder || 'Other details (specify if needed)'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 text-base sm:text-sm text-stone-900 focus:bg-white focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all min-h-[44px]"
                />
              </div>
            )}
          </div>
        )}

        {/* 3. MULTIPLE CHOICE (CHECKBOX) */}
        {isMultipleChoice && question.options && (
          <div className="space-y-2">
            {question.options.map((opt) => {
              const isChecked =
                Array.isArray(currentValue) && currentValue.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleCheckboxToggle(opt.value)}
                  className={`w-full text-left flex items-start gap-3 p-3.5 rounded-xl border text-sm transition-all min-h-[48px] cursor-pointer active:scale-[0.99] ${
                    isChecked
                      ? 'bg-sky-50/90 border-sky-500 text-sky-950 font-semibold ring-2 ring-sky-500/20 shadow-xs'
                      : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50 hover:border-stone-300 active:bg-stone-100'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 mt-0.5 transition-colors ${
                      isChecked
                        ? 'border-sky-600 bg-sky-600 text-white'
                        : 'border-stone-300 bg-white'
                    }`}
                  >
                    {isChecked && <Check className="w-2.5 h-2.5" />}
                  </div>
                  <span className="flex-1 font-medium leading-snug">{opt.label}</span>
                </button>
              );
            })}

            {/* Optional 'Other' field */}
            {question.hasOther && (
              <div className="pt-1">
                <input
                  type="text"
                  value={currentOtherText}
                  onChange={(e) => handleOtherTextChange(e.target.value)}
                  placeholder={question.otherPlaceholder || 'Other details (specify if needed)'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 text-base sm:text-sm text-stone-900 focus:bg-white focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all min-h-[44px]"
                />
              </div>
            )}
          </div>
        )}

        {/* 4. TEXT (SHORT) */}
        {isText && (
          <div>
            <input
              type="text"
              value={typeof currentValue === 'string' ? currentValue : ''}
              onChange={(e) => handleValueChange(e.target.value)}
              placeholder={question.placeholder || 'Type your answer here...'}
              className="w-full px-3.5 py-3 rounded-xl border border-stone-200 bg-white text-base sm:text-sm text-stone-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all min-h-[48px] shadow-2xs"
            />
          </div>
        )}

        {/* 5. NUMBER */}
        {isNumber && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={currentValue !== null && currentValue !== undefined ? String(currentValue) : ''}
              onChange={(e) => handleValueChange(e.target.value ? Number(e.target.value) : '')}
              placeholder={question.placeholder || '0'}
              className="w-full sm:w-44 px-3.5 py-3 rounded-xl border border-stone-200 bg-white text-base sm:text-sm text-stone-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all min-h-[48px] tabular-nums shadow-2xs"
            />
            {question.unit && (
              <span className="text-sm font-semibold text-stone-500 shrink-0">{question.unit}</span>
            )}
          </div>
        )}

        {/* 6. DATE */}
        {isDate && (
          <div>
            <input
              type="date"
              value={typeof currentValue === 'string' ? currentValue : ''}
              onChange={(e) => handleValueChange(e.target.value)}
              className="w-full sm:w-auto px-3.5 py-3 rounded-xl border border-stone-200 bg-white text-base sm:text-sm text-stone-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all min-h-[48px] shadow-2xs tabular-nums cursor-pointer"
            />
          </div>
        )}

        {/* 7. TEXTAREA (LONG TEXT) */}
        {isTextarea && (
          <div>
            <textarea
              rows={3}
              value={typeof currentValue === 'string' ? currentValue : ''}
              onChange={(e) => handleValueChange(e.target.value)}
              placeholder={question.placeholder || 'Type detailed notes or explanation here...'}
              className="w-full p-3.5 rounded-xl border border-stone-200 bg-white text-base sm:text-sm text-stone-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all resize-y min-h-[100px] shadow-2xs leading-relaxed"
            />
          </div>
        )}

        {/* ERROR MESSAGE IF REQUIRED & UNANSWERED */}
        {showError && (
          <p className="text-xs text-rose-600 font-semibold pt-1 flex items-center gap-1.5 animate-in fade-in duration-150">
            <HelpCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Please answer this required question to proceed.</span>
          </p>
        )}

        {/* CONDITIONAL SUB-QUESTION */}
        {isConditionalActive && conditional && conditional.followUpQuestion && (
          <div className="mt-3 p-3.5 bg-stone-50/80 rounded-xl border border-stone-200/90 space-y-2.5 transition-all">
            <div className="flex items-start gap-2">
              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 tracking-wider uppercase mt-0.5">
                Follow-up
              </span>
              <p className="text-xs font-semibold text-stone-800 leading-snug">
                {conditional.followUpQuestion.text || conditional.followUpQuestion.title}
              </p>
            </div>

            {(conditional.followUpQuestion.description || conditional.followUpQuestion.helperText) && (
              <p className="text-xs text-stone-500">
                {conditional.followUpQuestion.description || conditional.followUpQuestion.helperText}
              </p>
            )}

            {/* Sub-question: YES/NO */}
            {conditional.followUpQuestion.type === 'yes_no' && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleConditionalValueChange(true)}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all min-h-[44px] cursor-pointer active:scale-[0.98] ${
                    currentConditionalValue === true
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold'
                      : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => handleConditionalValueChange(false)}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all min-h-[44px] cursor-pointer active:scale-[0.98] ${
                    currentConditionalValue === false
                      ? 'bg-stone-200 border-stone-500 text-stone-950 font-bold'
                      : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  No
                </button>
              </div>
            )}

            {/* Sub-question: TEXT / SHORT TEXT */}
            {(conditional.followUpQuestion.type === 'text' || conditional.followUpQuestion.type === 'short_text') && (
              <input
                type="text"
                value={typeof currentConditionalValue === 'string' ? currentConditionalValue : ''}
                onChange={(e) => handleConditionalValueChange(e.target.value)}
                placeholder={conditional.followUpQuestion.placeholder || 'Type here...'}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 bg-white text-base sm:text-xs text-stone-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 min-h-[44px]"
              />
            )}

            {/* Sub-question: TEXTAREA / LONG TEXT */}
            {(conditional.followUpQuestion.type === 'textarea' || conditional.followUpQuestion.type === 'long_text') && (
              <textarea
                rows={2}
                value={typeof currentConditionalValue === 'string' ? currentConditionalValue : ''}
                onChange={(e) => handleConditionalValueChange(e.target.value)}
                placeholder={conditional.followUpQuestion.placeholder || 'Type here...'}
                className="w-full p-3 rounded-xl border border-stone-200 bg-white text-base sm:text-xs text-stone-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 resize-y min-h-[70px]"
              />
            )}

            {/* Sub-question: SINGLE CHOICE (RADIO) */}
            {(conditional.followUpQuestion.type === 'single_choice' || conditional.followUpQuestion.type === 'radio') &&
              conditional.followUpQuestion.options && (
                <div className="space-y-1.5 pt-1">
                  {conditional.followUpQuestion.options.map((subOpt) => {
                    const isSelected = currentConditionalValue === subOpt.value;
                    return (
                      <button
                        key={subOpt.value}
                        type="button"
                        onClick={() => handleConditionalValueChange(subOpt.value)}
                        className={`w-full text-left flex items-center gap-2.5 p-2.5 rounded-xl border text-xs transition-all min-h-[44px] cursor-pointer active:scale-[0.99] ${
                          isSelected
                            ? 'bg-sky-50 border-sky-500 text-sky-950 font-bold'
                            : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border shrink-0 ${
                            isSelected
                              ? 'border-sky-600 bg-sky-600 text-white'
                              : 'border-stone-300'
                          }`}
                        >
                          {isSelected && <Check className="w-2 h-2" />}
                        </div>
                        <span>{subOpt.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

            {/* Sub-question: MULTIPLE CHOICE (CHECKBOX) */}
            {(conditional.followUpQuestion.type === 'multiple_choice' || conditional.followUpQuestion.type === 'checkbox') &&
              conditional.followUpQuestion.options && (
                <div className="space-y-1.5 pt-1">
                  {conditional.followUpQuestion.options.map((subOpt) => {
                    const isChecked =
                      Array.isArray(currentConditionalValue) &&
                      currentConditionalValue.includes(subOpt.value);
                    return (
                      <button
                        key={subOpt.value}
                        type="button"
                        onClick={() => {
                          const list = Array.isArray(currentConditionalValue)
                            ? [...currentConditionalValue]
                            : [];
                          const idx = list.indexOf(subOpt.value);
                          if (idx > -1) list.splice(idx, 1);
                          else list.push(subOpt.value);
                          handleConditionalValueChange(list);
                        }}
                        className={`w-full text-left flex items-center gap-2.5 p-2.5 rounded-xl border text-xs transition-all min-h-[44px] cursor-pointer active:scale-[0.99] ${
                          isChecked
                            ? 'bg-sky-50 border-sky-500 text-sky-950 font-bold'
                            : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-100'
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded flex items-center justify-center border shrink-0 ${
                            isChecked
                              ? 'border-sky-600 bg-sky-600 text-white'
                              : 'border-stone-300'
                          }`}
                        >
                          {isChecked && <Check className="w-2 h-2" />}
                        </div>
                        <span>{subOpt.label}</span>
                      </button>
                    );
                  })}

                  {conditional.followUpQuestion.hasOther && (
                    <input
                      type="text"
                      value={currentConditionalOtherText}
                      onChange={(e) => {
                        onChange(question.id, {
                          value: currentValue ?? null,
                          otherText: currentOtherText,
                          conditionalValue: currentConditionalValue,
                          conditionalOtherText: e.target.value,
                        });
                      }}
                      placeholder={
                        conditional.followUpQuestion.otherPlaceholder ||
                        'Other details (specify if needed)'
                      }
                      className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-base sm:text-xs text-stone-900 focus:border-sky-500 focus:outline-none min-h-[44px]"
                    />
                  )}
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
};
