import { ConditionalRule, QuestionnaireAnswers, Question } from '../types';

/**
 * Evaluates whether a conditional rule evaluates to true based on the provided answers.
 */
export function evaluateConditionalRule(
  rule: ConditionalRule | undefined,
  answers: QuestionnaireAnswers
): boolean {
  if (!rule) return true;

  const sourceId = rule.sourceQuestionId || rule.dependsOnQuestionId;
  if (!sourceId) return true;

  const answer = answers[sourceId];
  const currentValue = answer?.value;
  const targetValue = rule.value !== undefined ? rule.value : (rule as any).targetValue;
  const operator = rule.operator || 'equals';

  // Helper for case-insensitive and type-lenient comparisons
  const normalize = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    return String(val).trim().toLowerCase();
  };

  switch (operator) {
    case 'equals': {
      if (typeof targetValue === 'boolean') {
        if (typeof currentValue === 'boolean') return currentValue === targetValue;
        if (typeof currentValue === 'string') {
          return normalize(currentValue) === (targetValue ? 'true' : 'false') ||
                 normalize(currentValue) === (targetValue ? 'yes' : 'no');
        }
        return false;
      }

      if (Array.isArray(targetValue)) {
        if (Array.isArray(currentValue)) {
          return targetValue.some((tv) =>
            currentValue.some((cv) => normalize(cv) === normalize(tv))
          );
        }
        return targetValue.some((tv) => normalize(tv) === normalize(currentValue));
      }

      if (Array.isArray(currentValue)) {
        return currentValue.some((cv) => normalize(cv) === normalize(targetValue));
      }

      return normalize(currentValue) === normalize(targetValue);
    }

    case 'not_equals': {
      return !evaluateConditionalRule({ ...rule, operator: 'equals' }, answers);
    }

    case 'contains': {
      if (Array.isArray(currentValue)) {
        return currentValue.some((cv) =>
          normalize(cv).includes(normalize(targetValue))
        );
      }
      return normalize(currentValue).includes(normalize(targetValue));
    }

    case 'greater_than': {
      const numCurrent = Number(currentValue);
      const numTarget = Number(targetValue);
      if (isNaN(numCurrent) || isNaN(numTarget)) return false;
      return numCurrent > numTarget;
    }

    case 'less_than': {
      const numCurrent = Number(currentValue);
      const numTarget = Number(targetValue);
      if (isNaN(numCurrent) || isNaN(numTarget)) return false;
      return numCurrent < numTarget;
    }

    default:
      return true;
  }
}

/**
 * Checks whether a question should be visible to the user.
 * A question is hidden if it is disabled or its conditional rule evaluates to false.
 */
export function isQuestionVisible(
  question: Question,
  answers: QuestionnaireAnswers
): boolean {
  if (question.enabled === false) {
    return false;
  }

  // Check generic conditionalRule
  if (question.conditionalRule) {
    return evaluateConditionalRule(question.conditionalRule, answers);
  }

  // Check legacy conditional config
  if (question.conditional) {
    const legacyRule: ConditionalRule = {
      dependsOnQuestionId: question.conditional.showWhenQuestionId,
      operator: 'equals',
      value: question.conditional.showWhenValue,
    };
    return evaluateConditionalRule(legacyRule, answers);
  }

  return true;
}
