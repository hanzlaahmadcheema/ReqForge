/**
 * Universal JSON Questionnaire Importer, Validator, and Exporter
 *
 * Implements the specification in docs/questionnaire-json-format.md
 * Enables JSON-template driven questionnaire creation without React code changes.
 */

import {
  Questionnaire,
  Section,
  Question,
  QuestionOption,
  StandardQuestionType,
  LegacyQuestionType,
  QuestionType,
  ConditionalRule,
} from '../types';

export interface UserConditionalJson {
  question_id?: string;
  answer?: string | boolean | number | string[];
}

export interface UserQuestionJson {
  question_id?: string;
  id?: string;
  question?: string;
  text?: string;
  label?: string;
  title?: string;
  type?: string;
  required?: boolean;
  short_answer?: string;
  placeholder?: string;
  description?: string;
  helper_text?: string;
  options?: (string | { label?: string; value?: string; [key: string]: unknown })[];
  allow_other?: boolean;
  has_other?: boolean;
  hasOther?: boolean;
  other_placeholder?: string;
  otherPlaceholder?: string;
  allow_none?: boolean;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  min_length?: number;
  max_length?: number;
  true?: string;
  false?: string;
  conditional?: UserConditionalJson;
  [key: string]: unknown;
}

export interface UserSectionJson {
  section_title?: string;
  title?: string;
  section_description?: string;
  description?: string;
  questions?: UserQuestionJson[];
  [key: string]: unknown;
}

export interface UserQuestionnaireTemplateJson {
  questionnaire?: {
    title?: string;
    description?: string;
    sections?: UserSectionJson[];
    [key: string]: unknown;
  };
  // Flat fallback format
  title?: string;
  description?: string;
  sections?: UserSectionJson[];
  [key: string]: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  questionnaire?: Questionnaire;
}

// Supported standard question types (V2 includes email, phone, url)
const SUPPORTED_STANDARD_TYPES: Set<StandardQuestionType> = new Set([
  'text',
  'textarea',
  'email',
  'phone',
  'url',
  'single_choice',
  'multiple_choice',
  'yes_no',
  'number',
  'date',
]);

// Legacy and helper type mappings
const LEGACY_TYPE_MAP: Record<string, StandardQuestionType> = {
  short_text: 'text',
  long_text: 'textarea',
  radio: 'single_choice',
  checkbox: 'multiple_choice',
  tel: 'phone',
};

/**
 * Normalizes question type, resolving legacy aliases.
 * Returns null if the type is invalid or disallowed (e.g. 'rating').
 */
export function normalizeQuestionType(
  rawType: string | undefined
): { type: StandardQuestionType; isLegacy: boolean } | null {
  if (!rawType || typeof rawType !== 'string') return null;
  const clean = rawType.trim().toLowerCase();

  // Explicitly reject rating
  if (clean === 'rating') {
    return null;
  }

  if (SUPPORTED_STANDARD_TYPES.has(clean as StandardQuestionType)) {
    return { type: clean as StandardQuestionType, isLegacy: false };
  }

  if (clean in LEGACY_TYPE_MAP) {
    return {
      type: LEGACY_TYPE_MAP[clean],
      isLegacy: true,
    };
  }

  return null;
}

/**
 * Derives a clean URL-safe value string for an option label.
 */
function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'option'
  );
}

/**
 * Extracts options from dynamic keys (option_1..N, check_1..N) or raw options array.
 * Discards empty string values ("") so blank options are never created.
 */
export function extractOptions(
  questionJson: UserQuestionJson,
  type: StandardQuestionType
): QuestionOption[] {
  const options: QuestionOption[] = [];
  const usedValues = new Set<string>();

  const addOption = (label: string, customValue?: string) => {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) return;

    let baseValue = (customValue && customValue.trim()) ? slugify(customValue.trim()) : slugify(trimmedLabel);
    let uniqueValue = baseValue;
    let counter = 1;
    while (usedValues.has(uniqueValue)) {
      uniqueValue = `${baseValue}_${counter++}`;
    }
    usedValues.add(uniqueValue);

    options.push({
      value: uniqueValue,
      label: trimmedLabel,
    });
  };

  // 1. Canonical V2 Format: Array of options (strings or objects with label/value)
  if ((type === 'single_choice' || type === 'multiple_choice') && Array.isArray(questionJson.options)) {
    for (const opt of questionJson.options) {
      if (typeof opt === 'string' && opt.trim().length > 0) {
        addOption(opt);
      } else if (opt && typeof opt === 'object') {
        const lbl = String((opt as any).label || (opt as any).text || '').trim();
        const val = typeof (opt as any).value === 'string' ? String((opt as any).value).trim() : undefined;
        if (lbl) {
          addOption(lbl, val);
        }
      }
    }
  }

  // 2. V1 Backward Compatibility: Single Choice option_1 ... option_N
  if (type === 'single_choice' && options.length === 0) {
    const numberedKeys = Object.keys(questionJson)
      .filter((k) => /^option_(\d+)$/i.test(k))
      .sort((a, b) => {
        const numA = parseInt(a.replace(/[^0-9]/g, ''), 10);
        const numB = parseInt(b.replace(/[^0-9]/g, ''), 10);
        return numA - numB;
      });

    for (const key of numberedKeys) {
      const val = questionJson[key];
      if (typeof val === 'string' && val.trim().length > 0) {
        addOption(val);
      }
    }
  }

  // 3. V1 Backward Compatibility: Multiple Choice check_1 ... check_N (with option_1..N fallback)
  if (type === 'multiple_choice' && options.length === 0) {
    const checkKeys = Object.keys(questionJson)
      .filter((k) => /^check_(\d+)$/i.test(k))
      .sort((a, b) => {
        const numA = parseInt(a.replace(/[^0-9]/g, ''), 10);
        const numB = parseInt(b.replace(/[^0-9]/g, ''), 10);
        return numA - numB;
      });

    if (checkKeys.length > 0) {
      for (const key of checkKeys) {
        const val = questionJson[key];
        if (typeof val === 'string' && val.trim().length > 0) {
          addOption(val);
        }
      }
    } else {
      // Fallback: check option_1..N for checkboxes if user used option_ keys
      const optionKeys = Object.keys(questionJson)
        .filter((k) => /^option_(\d+)$/i.test(k))
        .sort((a, b) => {
          const numA = parseInt(a.replace(/[^0-9]/g, ''), 10);
          const numB = parseInt(b.replace(/[^0-9]/g, ''), 10);
          return numA - numB;
        });
      for (const key of optionKeys) {
        const val = questionJson[key];
        if (typeof val === 'string' && val.trim().length > 0) {
          addOption(val);
        }
      }
    }
  }

  // 4. Yes/No binary options (supports custom true/false labels or defaults to Yes/No)
  if (type === 'yes_no') {
    const trueLabel =
      typeof questionJson.true === 'string' && questionJson.true.trim().length > 0
        ? questionJson.true.trim()
        : 'Yes';
    const falseLabel =
      typeof questionJson.false === 'string' && questionJson.false.trim().length > 0
        ? questionJson.false.trim()
        : 'No';

    options.push({ value: 'yes', label: trueLabel });
    options.push({ value: 'no', label: falseLabel });
    return options;
  }

  return options;
}

/**
 * Validates a parsed user-facing questionnaire JSON template.
 * Identifies exact section and question locations for any errors.
 */
export function validateQuestionnaireJson(rawInput: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!rawInput || typeof rawInput !== 'object') {
    return {
      valid: false,
      errors: ['Invalid JSON format: Root must be a JSON object.'],
      warnings: [],
    };
  }

  const root = rawInput as UserQuestionnaireTemplateJson;
  const qData = root.questionnaire || root;

  // 1. Questionnaire Title
  const title = typeof qData.title === 'string' ? qData.title.trim() : '';
  if (!title) {
    errors.push('Questionnaire title is required and cannot be empty.');
  }

  const description =
    typeof qData.description === 'string' ? qData.description.trim() : '';

  // 2. Sections
  const rawSections = qData.sections;
  if (!rawSections || !Array.isArray(rawSections)) {
    errors.push('Questionnaire must contain a "sections" array.');
    return { valid: false, errors, warnings };
  }

  if (rawSections.length === 0) {
    errors.push('Questionnaire must contain at least one section.');
    return { valid: false, errors, warnings };
  }

  const seenQuestionIds = new Set<string>();
  const allQuestionIds = new Set<string>();
  const normalizedSections: Section[] = [];

  // First pass: collect all declared question IDs to validate conditional dependencies
  rawSections.forEach((sec, sIdx) => {
    if (sec && typeof sec === 'object' && Array.isArray(sec.questions)) {
      sec.questions.forEach((q) => {
        if (q && typeof q === 'object') {
          const qId = q.question_id || q.id;
          if (typeof qId === 'string' && qId.trim()) {
            allQuestionIds.add(qId.trim());
          }
        }
      });
    }
  });

  // Second pass: full validation and normalization
  rawSections.forEach((sec, sIdx) => {
    const sNum = sIdx + 1;
    if (!sec || typeof sec !== 'object') {
      errors.push(`Section ${sNum}: Must be a valid section object.`);
      return;
    }

    const secTitle =
      typeof sec.section_title === 'string'
        ? sec.section_title.trim()
        : typeof sec.title === 'string'
        ? sec.title.trim()
        : '';

    if (!secTitle) {
      errors.push(`Section ${sNum}: "section_title" is required.`);
    }

    const secDescription =
      typeof sec.section_description === 'string'
        ? sec.section_description.trim()
        : typeof sec.description === 'string'
        ? sec.description.trim()
        : '';

    const rawQuestions = sec.questions;
    if (!rawQuestions || !Array.isArray(rawQuestions)) {
      errors.push(`Section ${sNum} ("${secTitle || `Section ${sNum}`}"): Must contain a "questions" array.`);
      return;
    }

    if (rawQuestions.length === 0) {
      errors.push(`Section ${sNum} ("${secTitle || `Section ${sNum}`}"): Must contain at least one question.`);
      return;
    }

    const normalizedQuestions: Question[] = [];

    rawQuestions.forEach((q, qIdx) => {
      const qNum = qIdx + 1;
      const qLoc = `Section ${sNum} -> Question ${qNum}`;

      if (!q || typeof q !== 'object') {
        errors.push(`${qLoc}: Must be a valid question object.`);
        return;
      }

      // Question ID
      const qIdRaw = q.question_id || q.id;
      const qId = typeof qIdRaw === 'string' ? qIdRaw.trim() : '';
      if (!qId) {
        errors.push(`${qLoc}: "question_id" is required.`);
      } else if (seenQuestionIds.has(qId)) {
        errors.push(`${qLoc}: Duplicate question_id "${qId}" detected. All question IDs must be unique.`);
      } else {
        seenQuestionIds.add(qId);
      }

      // Question Text
      const qTextRaw = q.question || q.text || q.label || q.title;
      const qText = typeof qTextRaw === 'string' ? qTextRaw.trim() : '';
      if (!qText) {
        errors.push(`${qLoc} ("${qId || `Q${qNum}`}"): "question" text is required.`);
      }

      // Type Check
      const rawType = q.type;
      const normalizedTypeObj = normalizeQuestionType(typeof rawType === 'string' ? rawType : undefined);
      if (!normalizedTypeObj) {
        if (typeof rawType === 'string' && rawType.trim().toLowerCase() === 'rating') {
          errors.push(`${qLoc} ("${qId || `Q${qNum}`}"): Type "rating" is not supported.`);
        } else {
          errors.push(
            `${qLoc} ("${qId || `Q${qNum}`}"): Type "${rawType || 'undefined'}" is not supported. Valid types: text, textarea, email, phone, url, single_choice, multiple_choice, yes_no, number, date.`
          );
        }
        return;
      }

      const qType = normalizedTypeObj.type;

      // Extract options & validate counts
      const options = extractOptions(q, qType);
      if (qType === 'single_choice' && options.length < 2) {
        errors.push(
          `${qLoc} ("${qId || `Q${qNum}`}"): Single choice questions require at least 2 options (e.g. "options": ["Option 1", "Option 2"]).`
        );
      }

      if (qType === 'multiple_choice' && options.length < 1) {
        errors.push(
          `${qLoc} ("${qId || `Q${qNum}`}"): Multiple choice questions require at least 1 option (e.g. "options": ["Option 1", "Option 2"]).`
        );
      }

      // Placeholder handling (canonical V2 "placeholder", legacy "short_answer")
      let placeholder: string | undefined = undefined;
      if (typeof q.placeholder === 'string' && q.placeholder.trim().length > 0) {
        placeholder = q.placeholder.trim();
      } else if (typeof q.short_answer === 'string' && q.short_answer.trim().length > 0) {
        placeholder = q.short_answer.trim();
      }

      // Helper / Description
      const helperText =
        typeof q.description === 'string' && q.description.trim().length > 0
          ? q.description.trim()
          : typeof q.helper_text === 'string' && q.helper_text.trim().length > 0
          ? q.helper_text.trim()
          : undefined;

      // V2 Metadata & Constraints
      const hasOther = Boolean(q.allow_other || q.has_other || q.hasOther);
      const otherPlaceholder =
        typeof q.other_placeholder === 'string' && q.other_placeholder.trim().length > 0
          ? q.other_placeholder.trim()
          : typeof q.otherPlaceholder === 'string' && q.otherPlaceholder.trim().length > 0
          ? q.otherPlaceholder.trim()
          : undefined;
      const allowNone = Boolean(q.allow_none || q.allowNone);
      const unit = typeof q.unit === 'string' && q.unit.trim().length > 0 ? q.unit.trim() : undefined;
      const min = typeof q.min === 'number' ? q.min : undefined;
      const max = typeof q.max === 'number' ? q.max : undefined;
      const step = typeof q.step === 'number' ? q.step : undefined;
      const minLength =
        typeof q.min_length === 'number'
          ? q.min_length
          : typeof q.minLength === 'number'
          ? q.minLength
          : undefined;
      const maxLength =
        typeof q.max_length === 'number'
          ? q.max_length
          : typeof q.maxLength === 'number'
          ? q.maxLength
          : undefined;

      // Conditional Logic
      let conditionalRule: ConditionalRule | undefined = undefined;
      if (q.conditional && typeof q.conditional === 'object') {
        const condId =
          typeof q.conditional.question_id === 'string'
            ? q.conditional.question_id.trim()
            : '';
        const condAnswer = q.conditional.answer;

        if (!condId) {
          errors.push(
            `${qLoc} ("${qId || `Q${qNum}`}"): "conditional.question_id" is required when conditional is specified.`
          );
        } else if (condId === qId) {
          errors.push(
            `${qLoc} ("${qId || `Q${qNum}`}"): Conditional rule cannot reference itself ("${condId}").`
          );
        } else if (!allQuestionIds.has(condId)) {
          errors.push(
            `${qLoc} ("${qId || `Q${qNum}`}"): Conditional references non-existent question_id "${condId}".`
          );
        } else if (condAnswer === undefined || condAnswer === null || condAnswer === '') {
          errors.push(
            `${qLoc} ("${qId || `Q${qNum}`}"): "conditional.answer" must be specified.`
          );
        } else {
          conditionalRule = {
            dependsOnQuestionId: condId,
            operator: 'equals',
            value: condAnswer,
          };
        }
      }

      normalizedQuestions.push({
        id: qId,
        sectionId: `sec_${sNum}`,
        text: qText,
        type: qType,
        required: Boolean(q.required),
        enabled: true,
        order: qNum,
        placeholder,
        description: helperText,
        options: options.length > 0 ? options : undefined,
        hasOther,
        otherPlaceholder,
        allowNone,
        unit,
        min,
        max,
        step,
        minLength,
        maxLength,
        conditionalRule,
      });
    });

    normalizedSections.push({
      id: `sec_${sNum}`,
      title: secTitle,
      description: secDescription,
      order: sNum,
      enabled: true,
      questions: normalizedQuestions,
    });
  });

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  const now = new Date().toISOString();
  const questionnaire: Questionnaire = {
    id: `q_imported_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    title,
    description,
    version: 1,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    sections: normalizedSections,
  };

  return {
    valid: true,
    errors: [],
    warnings,
    questionnaire,
  };
}

/**
 * Parses and imports a JSON string or object into an internal Questionnaire.
 * Throws an Error with detailed validation messages if validation fails.
 */
export function importQuestionnaireFromJson(input: string | object): Questionnaire {
  let parsed: unknown;
  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input);
    } catch (err: any) {
      throw new Error(`Invalid JSON syntax: ${err.message || String(err)}`);
    }
  } else {
    parsed = input;
  }

  const result = validateQuestionnaireJson(parsed);
  if (!result.valid || !result.questionnaire) {
    const message = result.errors.join('\n');
    throw new Error(`Questionnaire Validation Failed:\n${message}`);
  }

  return result.questionnaire;
}

/**
 * Exports an internal Questionnaire into the user-facing Universal JSON Template format.
 * Enables round-trip editing and template generation from existing questionnaires.
 */
export function exportQuestionnaireToJsonTemplate(
  questionnaire: Questionnaire
): UserQuestionnaireTemplateJson {
  const sections: UserSectionJson[] = (questionnaire.sections || []).map((sec) => {
    const questions: UserQuestionJson[] = (sec.questions || []).map((q) => {
      const qJson: UserQuestionJson = {
        question_id: q.id,
        question: q.text || q.title || '',
        type: q.type,
        required: Boolean(q.required),
      };

      if (q.placeholder) {
        qJson.placeholder = q.placeholder;
      }

      if (q.description || q.helperText) {
        qJson.description = q.description || q.helperText;
      }

      if ((q.type === 'single_choice' || q.type === 'multiple_choice') && q.options && q.options.length > 0) {
        qJson.options = q.options.map((opt) => opt.label);
      }

      if (q.hasOther) {
        qJson.allow_other = true;
        if (q.otherPlaceholder) {
          qJson.other_placeholder = q.otherPlaceholder;
        }
      }

      if (q.allowNone) {
        qJson.allow_none = true;
      }

      if (q.unit) {
        qJson.unit = q.unit;
      }

      if (typeof q.min === 'number') qJson.min = q.min;
      if (typeof q.max === 'number') qJson.max = q.max;
      if (typeof q.minLength === 'number') qJson.min_length = q.minLength;
      if (typeof q.maxLength === 'number') qJson.max_length = q.maxLength;

      if (q.type === 'yes_no') {
        const trueOpt = q.options?.find((o) => o.value === 'yes' || o.value === 'true');
        const falseOpt = q.options?.find((o) => o.value === 'no' || o.value === 'false');
        qJson.true = trueOpt?.label || 'Yes';
        qJson.false = falseOpt?.label || 'No';
      }

      if (q.conditionalRule) {
        qJson.conditional = {
          question_id:
            q.conditionalRule.dependsOnQuestionId ||
            q.conditionalRule.sourceQuestionId ||
            '',
          answer: q.conditionalRule.value,
        };
      }

      return qJson;
    });

    return {
      section_title: sec.title,
      section_description: sec.description,
      questions,
    };
  });

  return {
    questionnaire: {
      title: questionnaire.title,
      description: questionnaire.description,
      sections,
    },
  };
}
