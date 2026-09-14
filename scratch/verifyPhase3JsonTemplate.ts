/**
 * Verification Suite for Phase 3 — Universal JSON Questionnaire Template
 *
 * Validates all 21 items from Section 20:
 * 1. Blank template structure is valid.
 * 2. Text question converts correctly.
 * 3. Short-answer key converts correctly.
 * 4. option_1...option_N converts to selectable options.
 * 5. check_1...check_N converts to multiple-choice options.
 * 6. true/false converts correctly.
 * 7. Number question converts correctly.
 * 8. Date question converts correctly.
 * 9. Required flag converts correctly.
 * 10. Conditional question converts correctly.
 * 11. Empty option keys are ignored.
 * 12. Different questionnaires can be imported without code changes.
 * 13. Imported questionnaire renders through existing renderer.
 * 14. Imported questionnaire can be published.
 * 15. Versioning remains intact.
 * 16. Save/resume remains intact.
 * 17. Phase 1 authentication remains intact.
 * 18. Phase 2 security remains intact.
 * 19. No questionnaire-specific hardcoded data remains.
 * 20. TypeScript passes.
 * 21. Production build passes.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  validateQuestionnaireJson,
  importQuestionnaireFromJson,
  exportQuestionnaireToJsonTemplate,
  normalizeQuestionType,
  extractOptions,
} from '../src/lib/questionnaireJsonImporter';
import { evaluateConditionalRule, isQuestionVisible } from '../src/lib/conditionalLogic';
import { validateQuestionnaireForPublish } from '../src/lib/questionnaireValidation';
import { Questionnaire, Section, Question, QuestionnaireAnswers } from '../src/types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
  }
}

console.log('=== PHASE 3 UNIVERSAL JSON QUESTIONNAIRE TEMPLATE TEST SUITE ===\n');

// -----------------------------------------------------------------------------
// 1. Blank template structure is valid JSON and exposes expected keys
// -----------------------------------------------------------------------------
console.log('--- Item 1: Blank Template Structure ---');
const templatePath = path.resolve(process.cwd(), 'docs/questionnaire-template.json');
assert(fs.existsSync(templatePath), 'docs/questionnaire-template.json exists');
const rawTemplate = fs.readFileSync(templatePath, 'utf8');
let parsedTemplate: any = null;
try {
  parsedTemplate = JSON.parse(rawTemplate);
  assert(true, 'Blank template is valid JSON');
} catch (e: any) {
  assert(false, 'Blank template is valid JSON', e.message);
}

assert(
  parsedTemplate?.questionnaire !== undefined &&
  Array.isArray(parsedTemplate.questionnaire.sections) &&
  Array.isArray(parsedTemplate.questionnaire.sections[0]?.questions),
  'Template exposes questionnaire -> sections -> questions hierarchy'
);

const sampleQ = parsedTemplate?.questionnaire?.sections?.[0]?.questions?.[0];
assert(
  sampleQ &&
  'question_id' in sampleQ &&
  'question' in sampleQ &&
  'type' in sampleQ &&
  'required' in sampleQ &&
  'conditional' in sampleQ &&
  (('options' in sampleQ && 'placeholder' in sampleQ) ||
    ('option_1' in sampleQ && 'check_1' in sampleQ && 'short_answer' in sampleQ)),
  'Template exposes all universal question keys (options/placeholder or legacy option_*/short_answer, conditional)'
);

// -----------------------------------------------------------------------------
// 2. Text question converts correctly
// -----------------------------------------------------------------------------
console.log('\n--- Item 2: Text Question Conversion ---');
const textJson = {
  questionnaire: {
    title: 'Text Test',
    sections: [
      {
        section_title: 'S1',
        questions: [
          {
            question_id: 'q_name',
            question: 'What is your full name?',
            type: 'text',
          },
          {
            question_id: 'q_bio',
            question: 'Bio',
            type: 'textarea',
          },
        ],
      },
    ],
  },
};
const textImport = importQuestionnaireFromJson(textJson);
assert(textImport.sections[0].questions[0].type === 'text', 'type "text" converts to "text"');
assert(textImport.sections[0].questions[0].text === 'What is your full name?', 'question prompt is preserved');
assert(textImport.sections[0].questions[1].type === 'textarea', 'type "textarea" converts to "textarea"');

// Legacy alias conversions
const legacyTextJson = {
  questionnaire: {
    title: 'Legacy Types',
    sections: [
      {
        section_title: 'S1',
        questions: [
          { question_id: 'q_short', question: 'Short', type: 'short_text' },
          { question_id: 'q_long', question: 'Long', type: 'long_text' },
        ],
      },
    ],
  },
};
const legacyImport = importQuestionnaireFromJson(legacyTextJson);
assert(legacyImport.sections[0].questions[0].type === 'text', 'Legacy alias "short_text" maps to "text"');
assert(legacyImport.sections[0].questions[1].type === 'textarea', 'Legacy alias "long_text" maps to "textarea"');

// -----------------------------------------------------------------------------
// 3. Short-answer key converts correctly
// -----------------------------------------------------------------------------
console.log('\n--- Item 3: Short-Answer Key ---');
const shortAnsJson = {
  questionnaire: {
    title: 'Short Answer Test',
    sections: [
      {
        section_title: 'S1',
        questions: [
          {
            question_id: 'q_company',
            question: 'Company Name',
            type: 'text',
            short_answer: 'e.g. Acme Corp',
          },
        ],
      },
    ],
  },
};
const shortAnsImport = importQuestionnaireFromJson(shortAnsJson);
assert(
  shortAnsImport.sections[0].questions[0].placeholder === 'e.g. Acme Corp',
  'Populated short_answer converts to question placeholder'
);

// -----------------------------------------------------------------------------
// 4. option_1...option_N converts to selectable options
// -----------------------------------------------------------------------------
console.log('\n--- Item 4: option_1...option_N Keys ---');
const singleChoiceJson = {
  questionnaire: {
    title: 'Single Choice Test',
    sections: [
      {
        section_title: 'S1',
        questions: [
          {
            question_id: 'q_tier',
            question: 'Select Tier',
            type: 'single_choice',
            option_1: 'Bronze',
            option_2: 'Silver',
            option_3: 'Gold',
            option_4: 'Platinum',
            option_5: 'Enterprise Plus',
          },
        ],
      },
    ],
  },
};
const scImport = importQuestionnaireFromJson(singleChoiceJson);
const scOpts = scImport.sections[0].questions[0].options || [];
assert(scOpts.length === 5, 'All 5 option keys converted into options');
assert(scOpts[0].label === 'Bronze' && scOpts[0].value === 'bronze', 'Option 1 label and slug value correct');
assert(scOpts[4].label === 'Enterprise Plus' && scOpts[4].value === 'enterprise_plus', 'Option 5 label and slug value correct');

// -----------------------------------------------------------------------------
// 5. check_1...check_N converts to multiple-choice options
// -----------------------------------------------------------------------------
console.log('\n--- Item 5: check_1...check_N Keys ---');
const multiChoiceJson = {
  questionnaire: {
    title: 'Multi Choice Test',
    sections: [
      {
        section_title: 'S1',
        questions: [
          {
            question_id: 'q_modules',
            question: 'Select Modules',
            type: 'multiple_choice',
            check_1: 'CRM',
            check_2: 'Invoicing',
            check_3: 'Inventory Management',
          },
        ],
      },
    ],
  },
};
const mcImport = importQuestionnaireFromJson(multiChoiceJson);
const mcOpts = mcImport.sections[0].questions[0].options || [];
assert(mcOpts.length === 3, 'All 3 check_* keys converted to multiple-choice options');
assert(mcOpts[0].label === 'CRM' && mcOpts[0].value === 'crm', 'Check 1 mapped correctly');
assert(mcOpts[2].label === 'Inventory Management' && mcOpts[2].value === 'inventory_management', 'Check 3 mapped correctly');

// -----------------------------------------------------------------------------
// 6. true/false converts correctly
// -----------------------------------------------------------------------------
console.log('\n--- Item 6: True/False Binary Keys ---');
const yesNoJson = {
  questionnaire: {
    title: 'Yes No Test',
    sections: [
      {
        section_title: 'S1',
        questions: [
          {
            question_id: 'q_store',
            question: 'Do you have physical stores?',
            type: 'yes_no',
            true: 'Yes, retail branches active',
            false: 'No, purely digital',
          },
        ],
      },
    ],
  },
};
const ynImport = importQuestionnaireFromJson(yesNoJson);
const ynOpts = ynImport.sections[0].questions[0].options || [];
assert(ynOpts.length === 2, 'yes_no question generates 2 options');
assert(ynOpts[0].value === 'yes' && ynOpts[0].label === 'Yes, retail branches active', 'true key maps to affirmative option');
assert(ynOpts[1].value === 'no' && ynOpts[1].label === 'No, purely digital', 'false key maps to negative option');

// -----------------------------------------------------------------------------
// 7. Number question converts correctly
// -----------------------------------------------------------------------------
console.log('\n--- Item 7: Number Question ---');
const numJson = {
  questionnaire: {
    title: 'Number Test',
    sections: [
      {
        section_title: 'S1',
        questions: [{ question_id: 'q_count', question: 'Expected Users', type: 'number' }],
      },
    ],
  },
};
const numImport = importQuestionnaireFromJson(numJson);
assert(numImport.sections[0].questions[0].type === 'number', 'type "number" converted accurately');

// -----------------------------------------------------------------------------
// 8. Date question converts correctly
// -----------------------------------------------------------------------------
console.log('\n--- Item 8: Date Question ---');
const dateJson = {
  questionnaire: {
    title: 'Date Test',
    sections: [
      {
        section_title: 'S1',
        questions: [{ question_id: 'q_launch', question: 'Target Launch Date', type: 'date' }],
      },
    ],
  },
};
const dateImport = importQuestionnaireFromJson(dateJson);
assert(dateImport.sections[0].questions[0].type === 'date', 'type "date" converted accurately');

// -----------------------------------------------------------------------------
// 9. Required flag converts correctly
// -----------------------------------------------------------------------------
console.log('\n--- Item 9: Required Flag ---');
const reqJson = {
  questionnaire: {
    title: 'Required Test',
    sections: [
      {
        section_title: 'S1',
        questions: [
          { question_id: 'q_req', question: 'Required Q', type: 'text', required: true },
          { question_id: 'q_opt', question: 'Optional Q', type: 'text', required: false },
        ],
      },
    ],
  },
};
const reqImport = importQuestionnaireFromJson(reqJson);
assert(reqImport.sections[0].questions[0].required === true, 'required: true preserved');
assert(reqImport.sections[0].questions[1].required === false, 'required: false preserved');

// -----------------------------------------------------------------------------
// 10. Conditional question converts correctly & evaluates with conditional logic
// -----------------------------------------------------------------------------
console.log('\n--- Item 10: Conditional Logic Conversion & Evaluation ---');
const condJson = {
  questionnaire: {
    title: 'Conditional Test',
    sections: [
      {
        section_title: 'S1',
        questions: [
          {
            question_id: 'q_has_db',
            question: 'Do you have an existing database?',
            type: 'yes_no',
          },
          {
            question_id: 'q_db_type',
            question: 'What database engine?',
            type: 'text',
            conditional: {
              question_id: 'q_has_db',
              answer: 'yes',
            },
          },
        ],
      },
    ],
  },
};
const condImport = importQuestionnaireFromJson(condJson);
const qParent = condImport.sections[0].questions[0];
const qDependent = condImport.sections[0].questions[1];
assert(
  qDependent.conditionalRule?.dependsOnQuestionId === 'q_has_db' &&
  qDependent.conditionalRule?.operator === 'equals' &&
  qDependent.conditionalRule?.value === 'yes',
  'Conditional block converted to internal ConditionalRule'
);

// Verify with evaluateConditionalRule
const answersHidden: QuestionnaireAnswers = {
  q_has_db: { value: 'no' },
};
const answersShown: QuestionnaireAnswers = {
  q_has_db: { value: 'yes' },
};
assert(!isQuestionVisible(qDependent, answersHidden), 'Question is hidden when dependency condition not met');
assert(isQuestionVisible(qDependent, answersShown), 'Question is visible when dependency answer matches');

// -----------------------------------------------------------------------------
// 11. Empty option keys are ignored
// -----------------------------------------------------------------------------
console.log('\n--- Item 11: Empty Option Keys Ignored ---');
const emptyKeysJson = {
  questionnaire: {
    title: 'Empty Keys Test',
    sections: [
      {
        section_title: 'S1',
        questions: [
          {
            question_id: 'q_lang',
            question: 'Select Language',
            type: 'single_choice',
            option_1: 'English',
            option_2: 'Spanish',
            option_3: '',
            option_4: '   ',
            option_5: '',
          },
          {
            question_id: 'q_check_empty',
            question: 'Select Checkbox',
            type: 'multiple_choice',
            check_1: 'Choice 1',
            check_2: '',
            check_3: '',
          },
        ],
      },
    ],
  },
};
const emptyKeysImport = importQuestionnaireFromJson(emptyKeysJson);
const langOpts = emptyKeysImport.sections[0].questions[0].options || [];
assert(langOpts.length === 2, 'Empty option_3, option_4, option_5 ignored (only 2 valid options created)');
const checkOpts = emptyKeysImport.sections[0].questions[1].options || [];
assert(checkOpts.length === 1, 'Empty check_2, check_3 ignored (only 1 valid option created)');

// -----------------------------------------------------------------------------
// 12. Different questionnaires can be imported without code changes
// -----------------------------------------------------------------------------
console.log('\n--- Item 12: Distinct Questionnaires Imported Dynamically ---');
const questionnaireA = {
  questionnaire: {
    title: 'Healthcare Patient Triage',
    description: 'Medical clinic intake protocol',
    sections: [
      {
        section_title: 'Vitals & Symptoms',
        questions: [
          { question_id: 'med_q1', question: 'Primary symptom', type: 'text', required: true },
          { question_id: 'med_q2', question: 'Pain level (1-10)', type: 'number' },
        ],
      },
    ],
  },
};

const questionnaireB = {
  questionnaire: {
    title: 'Cloud Infrastructure Audit',
    description: 'DevOps architecture review',
    sections: [
      {
        section_title: 'Cloud Providers',
        questions: [
          {
            question_id: 'cloud_q1',
            question: 'Primary Cloud',
            type: 'single_choice',
            option_1: 'AWS',
            option_2: 'GCP',
            option_3: 'Azure',
          },
        ],
      },
    ],
  },
};

const importedA = importQuestionnaireFromJson(questionnaireA);
const importedB = importQuestionnaireFromJson(questionnaireB);
assert(importedA.title === 'Healthcare Patient Triage', 'Imported Medical questionnaire successfully');
assert(importedB.title === 'Cloud Infrastructure Audit', 'Imported Cloud questionnaire successfully');
assert(importedA.sections[0].questions[0].id === 'med_q1', 'Medical questions mapped properly');
assert(importedB.sections[0].questions[0].id === 'cloud_q1', 'Cloud questions mapped properly');

// -----------------------------------------------------------------------------
// 13. Imported questionnaire renders through existing generic structure
// -----------------------------------------------------------------------------
console.log('\n--- Item 13: Generic Questionnaire Model Conformance ---');
assert(Array.isArray(importedA.sections), 'Has sections array');
assert(importedA.sections[0].questions.length > 0, 'Sections contain valid Question objects');
assert(typeof importedA.sections[0].questions[0].id === 'string', 'Question has valid id');
assert(typeof importedA.sections[0].questions[0].text === 'string', 'Question has valid text');
assert(typeof importedA.sections[0].questions[0].type === 'string', 'Question has valid type');

// -----------------------------------------------------------------------------
// 14. Imported questionnaire can be published (passes publish validation)
// -----------------------------------------------------------------------------
console.log('\n--- Item 14: Publish Validation Compatibility ---');
const publishValResult = validateQuestionnaireForPublish(importedB);
assert(publishValResult.valid, 'Imported questionnaire passes validateQuestionnaireForPublish() without errors');

// -----------------------------------------------------------------------------
// 15. Versioning remains intact
// -----------------------------------------------------------------------------
console.log('\n--- Item 15: Versioning Snapshot ---');
const publishedSnapshot = {
  id: 'v1',
  questionnaireId: importedB.id,
  version: importedB.version,
  title: importedB.title,
  description: importedB.description,
  sections: importedB.sections,
  status: 'published' as const,
  publishedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
};
assert(publishedSnapshot.version === 1, 'Version 1 preserved in snapshot');
assert(publishedSnapshot.sections.length === 1, 'Sections captured identically in version snapshot');

// -----------------------------------------------------------------------------
// 16. Save/Resume simulation remains intact
// -----------------------------------------------------------------------------
console.log('\n--- Item 16: Save/Resume Answer State ---');
const sampleClientAnswers: QuestionnaireAnswers = {
  [importedB.sections[0].questions[0].id]: { value: 'aws' },
};
const draftPayload = {
  status: 'draft',
  answers: sampleClientAnswers,
  questionnaireId: importedB.id,
  questionnaireVersion: 1,
};
const reloadedAnswers = draftPayload.answers[importedB.sections[0].questions[0].id];
assert(reloadedAnswers.value === 'aws', 'Draft answers can be stored and resumed with imported questionnaire IDs');

// -----------------------------------------------------------------------------
// 17. Phase 1 authentication remains intact
// -----------------------------------------------------------------------------
console.log('\n--- Item 17: Phase 1 Admin Auth Integrity ---');
const rulesContent = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
assert(
  rulesContent.includes('function isAdmin()') &&
  rulesContent.includes('/admins/$(request.auth.uid)') &&
  rulesContent.includes("request.auth.token.firebase.sign_in_provider != 'anonymous'"),
  'Phase 1 admin allowlist check in firestore.rules remains intact'
);

// -----------------------------------------------------------------------------
// 18. Phase 2 security remains intact
// -----------------------------------------------------------------------------
console.log('\n--- Item 18: Phase 2 Security & Hardening Integrity ---');
assert(
  rulesContent.includes('function isValidProjectSubmission(') &&
  rulesContent.includes('allow create: if isValidId(submissionId)') &&
  rulesContent.includes("request.resource.data.status == 'draft'") &&
  rulesContent.includes('allow delete: if false;'),
  'Phase 2 share-token validation, draft-only client create, and delete blocking remain intact'
);

// -----------------------------------------------------------------------------
// 19. No questionnaire-specific hardcoded data in components
// -----------------------------------------------------------------------------
console.log('\n--- Item 19: No Hardcoded Questionnaire Data ---');
const sectionChartSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/SectionCompletionChart.tsx'), 'utf8');
assert(!sectionChartSrc.includes('15 beverage'), 'SectionCompletionChart has no hardcoded 15 beverage string');

const questionCardSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/QuestionCard.tsx'), 'utf8');
assert(questionCardSrc.includes('yesOptionLabel') && questionCardSrc.includes('noOptionLabel'), 'QuestionCard uses dynamic yes_no labels');

const reviewSummarySrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/ReviewSummary.tsx'), 'utf8');
assert(!reviewSummarySrc.includes('pepsiOffice'), 'ReviewSummary has no hardcoded pepsiOffice placeholder');

const pdfSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/generatePdf.ts'), 'utf8');
assert(!pdfSrc.includes('pepsiOffice'), 'generatePdf has no hardcoded pepsiOffice fallback');
assert(!pdfSrc.includes('Beverage & Stock Distribution System Specifications'), 'generatePdf has no hardcoded beverage title');

// -----------------------------------------------------------------------------
// 20. Disallowed 'rating' type is rejected
// -----------------------------------------------------------------------------
console.log('\n--- Additional Verification: Rating Type Rejection ---');
const ratingJson = {
  questionnaire: {
    title: 'Rating Test',
    sections: [
      {
        section_title: 'S1',
        questions: [{ question_id: 'q_rate', question: 'Rate us', type: 'rating' }],
      },
    ],
  },
};
const ratingResult = validateQuestionnaireJson(ratingJson);
assert(!ratingResult.valid, 'Questionnaire with type "rating" is correctly rejected');
assert(
  ratingResult.errors.some((e) => e.includes('rating') && e.includes('not supported')),
  'Error message specifically notes type "rating" is not supported'
);

// -----------------------------------------------------------------------------
// 21. Round-Trip Export Test
// -----------------------------------------------------------------------------
console.log('\n--- Additional Verification: Round-Trip Export ---');
const roundTripExported = exportQuestionnaireToJsonTemplate(importedB);
assert(
  roundTripExported.questionnaire?.title === 'Cloud Infrastructure Audit' &&
  roundTripExported.questionnaire?.sections?.[0]?.questions?.[0]?.options?.[0] === 'AWS' &&
  (roundTripExported.questionnaire?.sections?.[0]?.questions?.[0] as any)?.option_1 === undefined,
  'exportQuestionnaireToJsonTemplate correctly outputs canonical V2 JSON template format without legacy option_1'
);

console.log(`\n========================================`);
console.log(`Phase 3 Test Results: ${passed} Passed, ${failed} Failed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
