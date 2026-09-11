import { Questionnaire, Question, Section } from '../types';

export interface ValidationError {
  field?: string;
  sectionIndex?: number;
  questionIndex?: number;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validates a questionnaire before allowing publication.
 * Enforces all Section, Question, Option, and Conditional Rule constraints.
 */
export function validateQuestionnaireForPublish(
  questionnaire: Questionnaire
): ValidationResult {
  const errors: ValidationError[] = [];

  // 1. Questionnaire Title check
  if (!questionnaire.title || !questionnaire.title.trim()) {
    errors.push({
      field: 'title',
      message: 'Questionnaire title is required.',
    });
  }

  // 2. Section presence check
  const activeSections = (questionnaire.sections || []).filter(
    (s) => s.enabled !== false
  );
  if (!questionnaire.sections || questionnaire.sections.length === 0) {
    errors.push({
      field: 'sections',
      message: 'Questionnaire must contain at least one section.',
    });
    return { valid: false, errors };
  }

  if (activeSections.length === 0) {
    errors.push({
      field: 'sections',
      message: 'Questionnaire must have at least one enabled active section.',
    });
  }

  // Build lookup of all question IDs in the questionnaire to validate conditional rules
  const allQuestionsMap = new Map<string, Question>();
  questionnaire.sections.forEach((sec) => {
    (sec.questions || []).forEach((q) => {
      if (q.id) {
        allQuestionsMap.set(q.id, q);
      }
    });
  });

  // 3. Section and Question integrity checks
  questionnaire.sections.forEach((section, sIndex) => {
    const sTitle = section.title ? section.title.trim() : '';
    if (!sTitle) {
      errors.push({
        sectionIndex: sIndex,
        field: `sections[${sIndex}].title`,
        message: `Section ${sIndex + 1} has a missing or empty title.`,
      });
    }

    const enabledQuestions = (section.questions || []).filter(
      (q) => q.enabled !== false
    );
    if (!section.questions || section.questions.length === 0) {
      errors.push({
        sectionIndex: sIndex,
        field: `sections[${sIndex}].questions`,
        message: `Section "${sTitle || `Section ${sIndex + 1}`}" must have at least one question.`,
      });
    } else if (section.enabled !== false && enabledQuestions.length === 0) {
      errors.push({
        sectionIndex: sIndex,
        field: `sections[${sIndex}].questions`,
        message: `Section "${sTitle || `Section ${sIndex + 1}`}" has no enabled questions.`,
      });
    }

    (section.questions || []).forEach((question, qIndex) => {
      const qText = (question.text || question.title || '').trim();
      const qDisplayName = qText ? `"${qText.substring(0, 30)}..."` : `Question ${qIndex + 1}`;

      // Missing question prompt
      if (!qText) {
        errors.push({
          sectionIndex: sIndex,
          questionIndex: qIndex,
          message: `In section "${sTitle || `Section ${sIndex + 1}`}", ${qDisplayName} has empty prompt text.`,
        });
      }

      // Choice questions must have at least one option
      if (
        question.type === 'single_choice' ||
        question.type === 'multiple_choice' ||
        (question.type as string) === 'radio' ||
        (question.type as string) === 'checkbox'
      ) {
        if (!question.options || question.options.length === 0) {
          errors.push({
            sectionIndex: sIndex,
            questionIndex: qIndex,
            message: `${qDisplayName} is a choice question but has no options configured.`,
          });
        } else {
          // Verify option values and labels are not empty
          question.options.forEach((opt, optIdx) => {
            const optLabel = opt.label || (opt as any).text;
            if (!optLabel || !optLabel.trim()) {
              errors.push({
                sectionIndex: sIndex,
                questionIndex: qIndex,
                message: `${qDisplayName} option #${optIdx + 1} has an empty label.`,
              });
            }
          });
        }
      }

      // Conditional rule validation
      const rule = question.conditionalRule;
      if (rule) {
        const sourceId = rule.sourceQuestionId || rule.dependsOnQuestionId;
        if (!sourceId) {
          errors.push({
            sectionIndex: sIndex,
            questionIndex: qIndex,
            message: `${qDisplayName} has a display condition with no source question selected.`,
          });
        } else if (sourceId === question.id) {
          errors.push({
            sectionIndex: sIndex,
            questionIndex: qIndex,
            message: `${qDisplayName} cannot depend on itself in conditional rules.`,
          });
        } else if (!allQuestionsMap.has(sourceId)) {
          errors.push({
            sectionIndex: sIndex,
            questionIndex: qIndex,
            message: `${qDisplayName} conditional rule references a question (ID: ${sourceId}) that does not exist.`,
          });
        } else {
          const sourceQuestion = allQuestionsMap.get(sourceId)!;
          // If source question is single_choice / multiple_choice / radio, check that expected value matches an option
          if (
            (sourceQuestion.type === 'single_choice' ||
             sourceQuestion.type === 'multiple_choice' ||
             (sourceQuestion.type as string) === 'radio') &&
            sourceQuestion.options &&
            sourceQuestion.options.length > 0 &&
            rule.operator === 'equals'
          ) {
            const expectedStr = String(rule.value).toLowerCase();
            const optionExists = sourceQuestion.options.some(
              (o) =>
                o.value.toLowerCase() === expectedStr ||
                o.label.toLowerCase() === expectedStr
            );
            if (!optionExists && expectedStr !== 'true' && expectedStr !== 'false') {
              errors.push({
                sectionIndex: sIndex,
                questionIndex: qIndex,
                message: `${qDisplayName} conditional rule checks for value "${rule.value}", which is not one of the options in "${sourceQuestion.text?.substring(0, 30)}".`,
              });
            }
          }
        }
      }
    });
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
