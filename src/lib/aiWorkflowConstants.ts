/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Canonical ReqForge JSON Template & AI Agent Prompt Utilities
 * Phase 7: AI-Agent JSON Workflow Promotion & UX
 *
 * Source of truth: docs/questionnaire-template.json & docs/questionnaire-json-format.md
 */

export const REQFORGE_CANONICAL_TEMPLATE = {
  questionnaire: {
    title: "Client Software Requirements Questionnaire",
    description: "Please complete this questionnaire to help our engineering team understand your project requirements, scope, and technical constraints.",
    sections: [
      {
        section_title: "1. Project Overview & Objectives",
        section_description: "General background and strategic business goals for this software initiative.",
        questions: [
          {
            question_id: "company_name",
            question: "What is your organization or company name?",
            type: "text",
            required: true,
            short_answer: "e.g., Acme Innovations Ltd."
          },
          {
            question_id: "primary_goal",
            question: "What is the primary business problem this application needs to solve?",
            type: "textarea",
            required: true
          },
          {
            question_id: "target_users",
            question: "Who are the intended primary users of this system?",
            type: "single_choice",
            required: true,
            option_1: "Internal employees / staff only",
            option_2: "External customers / B2C consumers",
            option_3: "Business partners / B2B clients",
            option_4: "Hybrid (both internal and external users)"
          }
        ]
      },
      {
        section_title: "2. Technical Scope & Integrations",
        section_description: "Technical preferences, third-party systems, and architecture requirements.",
        questions: [
          {
            question_id: "requires_auth",
            question: "Does your application require user authentication & role-based access control?",
            type: "yes_no",
            required: true,
            true: "Yes, multi-role authentication required",
            false: "No, public access or handled externally"
          },
          {
            question_id: "auth_methods",
            question: "Which authentication methods should be supported?",
            type: "multiple_choice",
            required: false,
            check_1: "Email & Password",
            check_2: "Google Single Sign-On (SSO)",
            check_3: "Microsoft Azure AD / SAML",
            check_4: "Magic Link / Passwordless",
            conditional: {
              question_id: "requires_auth",
              answer: "Yes, multi-role authentication required"
            }
          },
          {
            question_id: "third_party_integrations",
            question: "Select all third-party systems that must be integrated:",
            type: "multiple_choice",
            required: false,
            check_1: "Payment Gateway (Stripe, PayPal, Adyen)",
            check_2: "CRM (Salesforce, HubSpot)",
            check_3: "Accounting / ERP (QuickBooks, NetSuite)",
            check_4: "Messaging (Twilio, SendGrid, Slack)"
          },
          {
            question_id: "estimated_daily_users",
            question: "Estimated number of active daily users expected at launch:",
            type: "number",
            required: false
          },
          {
            question_id: "target_delivery_date",
            question: "What is your target launch deadline for Phase 1 MVP?",
            type: "date",
            required: false
          }
        ]
      }
    ]
  }
};

export const REQFORGE_CANONICAL_TEMPLATE_JSON = JSON.stringify(REQFORGE_CANONICAL_TEMPLATE, null, 2);

/**
 * Universal AI Prompt for any LLM (ChatGPT, Claude, Gemini, Copilot, Cursor, etc.)
 */
export const REQFORGE_AI_AGENT_PROMPT = `You are an expert Software Requirements Engineer creating a client questionnaire for ReqForge.

TASK:
Create a structured requirements-gathering questionnaire for a client project.
Determine what essential information must be collected from the client, organize the questions into logical sections, and output ONLY valid ReqForge JSON following the exact specification below.

RULES:
1. OUTPUT FORMAT: Respond with ONLY a single, valid JSON object starting with {"questionnaire": ...}. Do NOT wrap in markdown explanation or add conversational intro/outro text.
2. SUPPORTED QUESTION TYPES (Use ONLY these 7 types, never invent others):
   - "text": Single-line short answer. Optional "short_answer" key for placeholder hint.
   - "textarea": Multi-line detailed explanation.
   - "single_choice": Radio button selection. Provide choices using "option_1", "option_2", ..., "option_N" (minimum 2 options).
   - "multiple_choice": Checkbox multi-select. Provide choices using "check_1", "check_2", ..., "check_N" (minimum 1 option).
   - "yes_no": Binary toggle. Optional "true" and "false" keys for custom labels (e.g. "true": "Yes, cloud hosted", "false": "No, on-premise").
   - "number": Numeric value input.
   - "date": Date picker input.
   DO NOT use "rating", "slider", "file_upload", or any unsupported type.
3. STRUCTURE:
   - "questionnaire": { "title": "...", "description": "...", "sections": [...] }
   - Each section must have "section_title", optional "section_description", and a "questions" array with at least one question.
4. QUESTION IDENTIFIERS:
   - Every question must have a unique "question_id" (e.g., "company_name", "target_audience", "has_sso").
5. CONDITIONAL FOLLOW-UP QUESTIONS:
   - To make a question appear conditionally based on a previous answer, add:
     "conditional": { "question_id": "<preceding_question_id>", "answer": "<exact_answer_or_option_label>" }
   - Ensure the referenced question_id exists BEFORE this question.
6. QUALITY:
   - Mark genuinely critical questions as "required": true, and optional questions as "required": false.
   - Keep questions clear, professional, and directly relevant to software scoping.

CANONICAL JSON FORMAT EXAMPLE TO FOLLOW:
${REQFORGE_CANONICAL_TEMPLATE_JSON}

---
PROJECT DESCRIPTION (Provide details for your client's project below):
[Describe your client's project, industry, goals, or constraints here]
`;

export interface QuestionTypeInfo {
  type: string;
  name: string;
  description: string;
  keys: string;
  example: string;
}

export const SUPPORTED_QUESTION_TYPES: QuestionTypeInfo[] = [
  {
    type: 'text',
    name: 'Short Answer',
    description: 'Single-line text input for names, titles, domains, or short identifiers.',
    keys: '"short_answer": "Placeholder hint"',
    example: '{"question_id": "company_name", "question": "Company Name", "type": "text", "required": true, "short_answer": "e.g. Acme Corp"}'
  },
  {
    type: 'textarea',
    name: 'Long Answer',
    description: 'Multi-line expandable textarea for detailed descriptions, business rules, or notes.',
    keys: 'No option keys required',
    example: '{"question_id": "business_problem", "question": "Describe the main problem to solve", "type": "textarea", "required": true}'
  },
  {
    type: 'single_choice',
    name: 'Single Choice (Radio)',
    description: 'Single-select radio buttons where respondent selects exactly one option.',
    keys: '"option_1": "...", "option_2": "...", ...',
    example: '{"question_id": "hosting", "question": "Hosting preference?", "type": "single_choice", "option_1": "Cloud", "option_2": "On-Premise"}'
  },
  {
    type: 'multiple_choice',
    name: 'Multiple Choice (Checkboxes)',
    description: 'Multi-select checkboxes where respondent can select one or more choices.',
    keys: '"check_1": "...", "check_2": "...", ...',
    example: '{"question_id": "features", "question": "Features required?", "type": "multiple_choice", "check_1": "Auth", "check_2": "Billing"}'
  },
  {
    type: 'yes_no',
    name: 'Yes / No Binary Toggle',
    description: 'Two-state decision with optional custom affirmative/negative labels.',
    keys: '"true": "Yes label", "false": "No label" (optional)',
    example: '{"question_id": "has_mobile", "question": "Need mobile app?", "type": "yes_no", "true": "Yes, native iOS/Android", "false": "Web only"}'
  },
  {
    type: 'number',
    name: 'Number Input',
    description: 'Validated numeric values for user counts, budget figures, or quantities.',
    keys: 'No option keys required',
    example: '{"question_id": "user_count", "question": "Expected daily active users?", "type": "number"}'
  },
  {
    type: 'date',
    name: 'Date Picker',
    description: 'Calendar date picker for project launch targets, milestones, or deadlines.',
    keys: 'No option keys required',
    example: '{"question_id": "launch_deadline", "question": "Target launch date?", "type": "date"}'
  }
];

export const WORKFLOW_STEPS = [
  {
    number: '1',
    title: 'Gather Client Context',
    description: 'Note your client\'s industry, high-level business goals, and rough project scope.'
  },
  {
    number: '2',
    title: 'Prompt Your AI Agent',
    description: 'Give ChatGPT, Claude, Gemini, or Copilot the ReqForge prompt & canonical JSON template.'
  },
  {
    number: '3',
    title: 'Copy & Paste JSON',
    description: 'Copy the agent-generated JSON directly into ReqForge. Validated in real-time.'
  },
  {
    number: '4',
    title: 'Instant Client-Ready Form',
    description: 'ReqForge automatically generates the beautiful, responsive, PIN-secured questionnaire.'
  },
  {
    number: '5',
    title: 'Share & Collect Specs',
    description: 'Send the link and PIN to your client. Submissions become structured engineering specs.'
  }
];

export const WHAT_IS_REQFORGE_JSON = {
  title: 'What is ReqForge JSON?',
  subtitle: 'A universal, vendor-neutral questionnaire definition format.',
  summary: 'ReqForge JSON tells the platform everything it needs to render a dynamic, validated client form without writing frontend code. It defines sections, questions, input types, choice options, requirements, and conditional branching logic.',
  whyItMatters: [
    {
      title: 'AI Agent Compatible',
      description: 'Any modern AI assistant (ChatGPT, Claude, Gemini, Copilot, Cursor) can generate ready-to-use questionnaires in seconds when provided with the ReqForge format.'
    },
    {
      title: 'Zero Code Changes',
      description: 'No new React components, forms, or deployments needed. Paste your JSON and the questionnaire is live instantly.'
    },
    {
      title: 'Built-in Conditional Logic',
      description: 'Questions can dynamically appear based on answers to prior questions using the "conditional" block.'
    },
    {
      title: 'Full Data Portability',
      description: 'Export existing questionnaires to JSON anytime, version them in Git, share across projects, or modify them in any text editor.'
    }
  ]
};
