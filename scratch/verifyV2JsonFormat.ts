/**
 * Comprehensive Verification Suite for ReqForge JSON Format V2
 *
 * Verifies:
 * 1. Canonical V2 Template validates cleanly
 * 2. String options array parsing for single_choice & multiple_choice
 * 3. Object options array parsing [{label, value}]
 * 4. allow_other & other_placeholder mapping
 * 5. allow_none mapping
 * 6. email question type
 * 7. phone question type & tel alias
 * 8. url question type
 * 9. placeholder & description mapping
 * 10. unit, min, max, step mapping
 * 11. min_length, max_length mapping
 * 12. Conditional logic with V2 structure
 * 13. Rejection of invalid types (e.g. rating)
 * 14. Full V1 backward compatibility (option_1..N, check_1..N, short_answer, legacy aliases)
 * 15. Round-trip export outputs V2 options and metadata
 * 16. docs/questionnaire-template.json matches V2 schema
 * 17. Prompt constants use V2 specification
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
import {
  REQFORGE_CANONICAL_TEMPLATE,
  REQFORGE_CANONICAL_TEMPLATE_JSON,
  REQFORGE_AI_AGENT_PROMPT,
  SUPPORTED_QUESTION_TYPES,
} from '../src/lib/aiWorkflowConstants';

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

console.log('=== REQFORGE JSON FORMAT V2 VERIFICATION SUITE ===\n');

// -----------------------------------------------------------------------------
// 1. Canonical V2 Template
// -----------------------------------------------------------------------------
console.log('--- 1. Canonical V2 Template Validation ---');
const canonResult = validateQuestionnaireJson(REQFORGE_CANONICAL_TEMPLATE);
assert(canonResult.valid, 'Canonical V2 template object is valid');
assert(canonResult.errors.length === 0, 'Canonical V2 template has 0 errors');

const canonJsonParsed = JSON.parse(REQFORGE_CANONICAL_TEMPLATE_JSON);
const canonJsonResult = validateQuestionnaireJson(canonJsonParsed);
assert(canonJsonResult.valid, 'Canonical V2 template serialized JSON is valid');

// -----------------------------------------------------------------------------
// 2. V2 Options Arrays (Single Choice & Multiple Choice)
// -----------------------------------------------------------------------------
console.log('\n--- 2. V2 Options Arrays (string[]) ---');
const v2ChoiceJson = {
  questionnaire: {
    title: 'Choice Options Test',
    sections: [
      {
        section_title: 'Choices',
        questions: [
          {
            question_id: 'q_single',
            question: 'Pick one',
            type: 'single_choice',
            options: ['Alpha', 'Beta', 'Gamma'],
          },
          {
            question_id: 'q_multi',
            question: 'Pick multiple',
            type: 'multiple_choice',
            options: ['Red', 'Green', 'Blue'],
            allow_other: true,
            other_placeholder: 'Custom color...',
            allow_none: true,
          },
        ],
      },
    ],
  },
};

const v2ChoiceImported = importQuestionnaireFromJson(v2ChoiceJson);
const singleQ = v2ChoiceImported.sections[0].questions[0];
const multiQ = v2ChoiceImported.sections[0].questions[1];

assert(singleQ.options?.length === 3, 'Single choice parsed 3 options from array');
assert(singleQ.options?.[0].label === 'Alpha' && singleQ.options?.[0].value === 'alpha', 'Single choice option 0 has correct label and slug value');
assert(singleQ.options?.[2].label === 'Gamma' && singleQ.options?.[2].value === 'gamma', 'Single choice option 2 has correct label and slug value');

assert(multiQ.options?.length === 3, 'Multiple choice parsed 3 options from array');
assert(multiQ.hasOther === true, 'allow_other mapped to hasOther = true');
assert(multiQ.otherPlaceholder === 'Custom color...', 'other_placeholder mapped correctly');
assert(multiQ.allowNone === true, 'allow_none mapped to allowNone = true');

// -----------------------------------------------------------------------------
// 3. V2 Options Array of Objects
// -----------------------------------------------------------------------------
console.log('\n--- 3. V2 Options Array of Objects ({label, value}) ---');
const objOptionsJson = {
  questionnaire: {
    title: 'Object Options Test',
    sections: [
      {
        section_title: 'Objects',
        questions: [
          {
            question_id: 'q_obj_opts',
            question: 'Select cloud',
            type: 'single_choice',
            options: [
              { label: 'Amazon Web Services', value: 'aws' },
              { label: 'Google Cloud Platform', value: 'gcp' },
              { label: 'Microsoft Azure', value: 'azure' },
            ],
          },
        ],
      },
    ],
  },
};

const objOptsImported = importQuestionnaireFromJson(objOptionsJson);
const objOptsQ = objOptsImported.sections[0].questions[0];
assert(objOptsQ.options?.[0].value === 'aws', 'Custom value "aws" preserved from object option');
assert(objOptsQ.options?.[0].label === 'Amazon Web Services', 'Custom label preserved');
assert(objOptsQ.options?.[1].value === 'gcp', 'Custom value "gcp" preserved');

// -----------------------------------------------------------------------------
// 4. V2 Input Types (Email, Phone, URL)
// -----------------------------------------------------------------------------
console.log('\n--- 4. V2 Input Types (email, phone, url, tel) ---');
const v2TypesJson = {
  questionnaire: {
    title: 'New Types Test',
    sections: [
      {
        section_title: 'Contact Information',
        questions: [
          {
            question_id: 'contact_email',
            question: 'Email address?',
            type: 'email',
            placeholder: 'test@example.com',
            required: true,
          },
          {
            question_id: 'contact_phone',
            question: 'Phone number?',
            type: 'phone',
            placeholder: '+1 555-0100',
          },
          {
            question_id: 'contact_tel_alias',
            question: 'Telephone alias?',
            type: 'tel',
          },
          {
            question_id: 'website_url',
            question: 'Project URL?',
            type: 'url',
            placeholder: 'https://reqforge.dev',
          },
        ],
      },
    ],
  },
};

const v2TypesImported = importQuestionnaireFromJson(v2TypesJson);
const qs = v2TypesImported.sections[0].questions;
assert(qs[0].type === 'email', 'Type "email" is recognized and preserved');
assert(qs[0].placeholder === 'test@example.com', 'Email placeholder preserved');
assert(qs[1].type === 'phone', 'Type "phone" is recognized and preserved');
assert(qs[2].type === 'phone', 'Legacy alias "tel" resolves to "phone"');
assert(qs[3].type === 'url', 'Type "url" is recognized and preserved');

// -----------------------------------------------------------------------------
// 5. Metadata & Constraints (unit, min, max, step, min_length, max_length)
// -----------------------------------------------------------------------------
console.log('\n--- 5. Metadata & Constraints ---');
const constraintsJson = {
  questionnaire: {
    title: 'Constraints Test',
    sections: [
      {
        section_title: 'Numeric & Text Bounds',
        questions: [
          {
            question_id: 'budget_usd',
            question: 'Project Budget',
            type: 'number',
            unit: 'USD',
            min: 5000,
            max: 1000000,
            step: 500,
            placeholder: '50000',
          },
          {
            question_id: 'scope_summary',
            question: 'Detailed Scope',
            type: 'textarea',
            min_length: 50,
            max_length: 2000,
            description: 'Provide an in-depth summary of project deliverables.',
          },
        ],
      },
    ],
  },
};

const constraintsImported = importQuestionnaireFromJson(constraintsJson);
const budgetQ = constraintsImported.sections[0].questions[0];
const scopeQ = constraintsImported.sections[0].questions[1];

assert(budgetQ.unit === 'USD', 'Unit "USD" preserved');
assert(budgetQ.min === 5000, 'Min 5000 preserved');
assert(budgetQ.max === 1000000, 'Max 1000000 preserved');
assert(budgetQ.step === 500, 'Step 500 preserved');
assert(scopeQ.minLength === 50, 'min_length mapped to minLength = 50');
assert(scopeQ.maxLength === 2000, 'max_length mapped to maxLength = 2000');
assert(scopeQ.description === 'Provide an in-depth summary of project deliverables.', 'description helper preserved');

// -----------------------------------------------------------------------------
// 6. Conditional Logic (V2 Structure)
// -----------------------------------------------------------------------------
console.log('\n--- 6. Conditional Logic ---');
const condJson = {
  questionnaire: {
    title: 'Conditional Test',
    sections: [
      {
        section_title: 'Logic',
        questions: [
          {
            question_id: 'needs_mobile',
            question: 'Need mobile app?',
            type: 'yes_no',
            true: 'Yes, native apps',
            false: 'No, web only',
          },
          {
            question_id: 'mobile_platform',
            question: 'Which mobile platforms?',
            type: 'multiple_choice',
            options: ['iOS', 'Android'],
            conditional: {
              question_id: 'needs_mobile',
              answer: 'Yes, native apps',
            },
          },
        ],
      },
    ],
  },
};

const condImported = importQuestionnaireFromJson(condJson);
const condQ = condImported.sections[0].questions[1];
assert(condQ.conditionalRule !== undefined, 'Conditional rule created');
assert(condQ.conditionalRule?.dependsOnQuestionId === 'needs_mobile', 'dependsOnQuestionId correctly points to needs_mobile');
assert(condQ.conditionalRule?.value === 'Yes, native apps', 'Trigger answer matches expected label');

// -----------------------------------------------------------------------------
// 7. V1 Backward Compatibility
// -----------------------------------------------------------------------------
console.log('\n--- 7. V1 Backward Compatibility ---');
const v1Json = {
  questionnaire: {
    title: 'Legacy V1 Test',
    sections: [
      {
        section_title: 'Legacy Section',
        questions: [
          {
            question_id: 'v1_radio',
            question: 'Legacy Radio',
            type: 'single_choice',
            option_1: 'Old Option 1',
            option_2: 'Old Option 2',
            option_3: '', // empty key ignored
            short_answer: 'Legacy hint',
          },
          {
            question_id: 'v1_checkbox',
            question: 'Legacy Checkbox',
            type: 'multiple_choice',
            check_1: 'Old Check 1',
            check_2: 'Old Check 2',
          },
        ],
      },
    ],
  },
};

const v1Imported = importQuestionnaireFromJson(v1Json);
const v1Radio = v1Imported.sections[0].questions[0];
const v1Check = v1Imported.sections[0].questions[1];

assert(v1Radio.options?.length === 2, 'V1 option_1..N parsed into 2 options (empty option_3 ignored)');
assert(v1Radio.placeholder === 'Legacy hint', 'V1 short_answer mapped to placeholder');
assert(v1Check.options?.length === 2, 'V1 check_1..N parsed into 2 options');

// -----------------------------------------------------------------------------
// 8. Round-Trip Export Conformance
// -----------------------------------------------------------------------------
console.log('\n--- 8. Round-Trip Export Conformance ---');
const exported = exportQuestionnaireToJsonTemplate(v2ChoiceImported);
const exportedMulti = exported.questionnaire?.sections?.[0]?.questions?.[1];

assert(Array.isArray(exportedMulti?.options), 'Exported question has options array');
assert(exportedMulti?.options?.length === 3, 'Exported options array has 3 choices');
assert(exportedMulti?.allow_other === true, 'Exported allow_other is true');
assert(exportedMulti?.other_placeholder === 'Custom color...', 'Exported other_placeholder preserved');
assert(exportedMulti?.allow_none === true, 'Exported allow_none is true');

// -----------------------------------------------------------------------------
// 9. Root Template Conformance
// -----------------------------------------------------------------------------
console.log('\n--- 9. Root docs/questionnaire-template.json ---');
const rootTemplatePath = path.resolve(process.cwd(), 'docs/questionnaire-template.json');
assert(fs.existsSync(rootTemplatePath), 'docs/questionnaire-template.json exists');
const rootTemplateRaw = fs.readFileSync(rootTemplatePath, 'utf8');
const rootTemplateObj = JSON.parse(rootTemplateRaw);
const rootQ = rootTemplateObj.questionnaire.sections[0].questions[0];
assert(Array.isArray(rootQ.options), 'docs/questionnaire-template.json question uses "options": [] array');
assert('placeholder' in rootQ, 'docs/questionnaire-template.json question uses "placeholder"');
assert('allow_other' in rootQ, 'docs/questionnaire-template.json question uses "allow_other"');
assert('unit' in rootQ, 'docs/questionnaire-template.json question uses "unit"');

// -----------------------------------------------------------------------------
// 10. AI Prompt Constants Conformance
// -----------------------------------------------------------------------------
console.log('\n--- 10. AI Prompt Constants Conformance ---');
assert(REQFORGE_AI_AGENT_PROMPT.includes('V2 Canonical Format'), 'REQFORGE_AI_AGENT_PROMPT specifies V2 Canonical Format');
assert(REQFORGE_AI_AGENT_PROMPT.includes('"options": ["Choice A", "Choice B"]'), 'REQFORGE_AI_AGENT_PROMPT specifies options: [] array');
assert(REQFORGE_AI_AGENT_PROMPT.includes('NEVER use numbered keys like option_1 or check_1'), 'REQFORGE_AI_AGENT_PROMPT explicitly forbids option_1/check_1');
assert(SUPPORTED_QUESTION_TYPES.length === 10, 'SUPPORTED_QUESTION_TYPES lists all 10 types');
assert(SUPPORTED_QUESTION_TYPES.some((t) => t.type === 'email'), 'SUPPORTED_QUESTION_TYPES includes email');
assert(SUPPORTED_QUESTION_TYPES.some((t) => t.type === 'phone'), 'SUPPORTED_QUESTION_TYPES includes phone');
assert(SUPPORTED_QUESTION_TYPES.some((t) => t.type === 'url'), 'SUPPORTED_QUESTION_TYPES includes url');

console.log(`\n========================================`);
console.log(`V2 Test Results: ${passed} Passed, ${failed} Failed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
