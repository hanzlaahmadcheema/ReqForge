import { Questionnaire, Section, Question } from '../types';
import { QUESTIONNAIRE_SECTIONS } from './questionnaire';

/**
 * First questionnaire template, converted to generic data.
 * ID: 'beverage_distribution_v1'
 * Version: 1
 * Status: 'published'
 */
export const DEFAULT_QUESTIONNAIRE: Questionnaire = {
  id: 'beverage_distribution_v1',
  title: 'Beverage Distribution & Sales Software Requirements',
  description:
    'Comprehensive requirements gathering questionnaire for wholesale beverage operations, stock management, sales channels, cash balancing, and owner reporting.',
  version: 1,
  status: 'published',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-06T12:00:00.000Z',
  sections: QUESTIONNAIRE_SECTIONS.map((sec, secIdx): Section => {
    const sectionId = sec.key || `sec_${secIdx + 1}`;
    return {
      id: sectionId,
      questionnaireId: 'beverage_distribution_v1',
      title: sec.title,
      description: sec.description,
      order: sec.sectionNumber || secIdx + 1,
      enabled: true,
      iconName: sec.iconName,
      key: sec.key,
      sectionNumber: sec.sectionNumber,
      questions: sec.questions.map((q, qIdx): Question => ({
        ...q,
        id: q.id,
        sectionId,
        text: q.title,
        title: q.title,
        description: q.helperText,
        helperText: q.helperText,
        example: q.example,
        type: q.type,
        required: q.required ?? false,
        order: q.questionNumber || qIdx + 1,
        enabled: true,
        options: q.options,
        hasOther: q.hasOther,
        otherPlaceholder: q.otherPlaceholder,
        placeholder: q.placeholder,
        unit: q.unit,
        conditional: q.conditional,
        conditionalRule: q.conditional
          ? {
              dependsOnQuestionId: q.conditional.showWhenQuestionId,
              operator: 'equals',
              value: q.conditional.showWhenValue,
              followUpQuestion: {
                ...q.conditional.question,
                id: q.conditional.question.id,
                sectionId,
                text: q.conditional.question.title || '',
                title: q.conditional.question.title || '',
                description: q.conditional.question.helperText || '',
                helperText: q.conditional.question.helperText || '',
                type: q.conditional.question.type,
                order: 99,
                enabled: true,
                options: q.conditional.question.options,
                hasOther: q.conditional.question.hasOther,
                otherPlaceholder: q.conditional.question.otherPlaceholder,
                placeholder: q.conditional.question.placeholder,
              },
            }
          : undefined,
      })),
    };
  }),
};

export const DEFAULT_SECTIONS: Section[] = DEFAULT_QUESTIONNAIRE.sections;
