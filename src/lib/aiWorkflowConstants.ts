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
        section_title: "1. Project Overview & Stakeholders",
        section_description: "General background and strategic business goals for this software initiative.",
        questions: [
          {
            question_id: "company_name",
            question: "What is your organization or company name?",
            type: "text",
            required: true,
            placeholder: "e.g., Acme Innovations Ltd."
          },
          {
            "question_id": "contact_email",
            "question": "What is the primary contact email for project notifications?",
            "type": "email",
            "required": true,
            "placeholder": "lead@company.com"
          },
          {
            "question_id": "existing_app_url",
            "question": "What is the URL of your existing product or website (if any)?",
            "type": "url",
            "required": false,
            "placeholder": "https://company.com"
          },
          {
            question_id: "primary_goal",
            question: "What is the primary business problem this application needs to solve?",
            type: "textarea",
            required: true,
            placeholder: "Describe the core challenge, current manual processes, and expected impact..."
          },
          {
            question_id: "target_users",
            question: "Who are the intended primary users?",
            type: "single_choice",
            required: true,
            options: [
              "Internal employees",
              "External customers",
              "Business partners",
              "Both internal and external users"
            ]
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
            options: [
              "Email & Password",
              "Google Single Sign-On (SSO)",
              "Microsoft Azure AD / SAML",
              "Magic Link / Passwordless"
            ],
            allow_other: true,
            conditional: {
              question_id: "requires_auth",
              answer: "Yes, multi-role authentication required"
            }
          },
          {
            question_id: "integrations",
            question: "Which integrations are required?",
            type: "multiple_choice",
            required: false,
            options: [
              "Payment Gateway",
              "CRM",
              "Accounting / ERP",
              "Messaging"
            ],
            allow_other: true
          },
          {
            question_id: "estimated_daily_users",
            question: "Estimated number of active daily users expected at launch:",
            type: "number",
            required: false,
            unit: "users",
            min: 1,
            placeholder: "500"
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
 * Canonical V2 Specification
 */
export const REQFORGE_AI_AGENT_PROMPT = `You are an expert Software Requirements Engineer creating a client questionnaire for ReqForge.

TASK:
Create a structured requirements-gathering questionnaire for a client project.
Determine what essential information must be collected, organize into logical sections, and output ONLY valid ReqForge JSON (V2 Canonical Format).

RULES:
1. OUTPUT FORMAT: Respond with ONLY a single, valid JSON object starting with {"questionnaire": ...}. Do NOT wrap in markdown explanation or conversational intro/outro text.
2. V2 CANONICAL SPECIFICATION:
   - Use "options": ["Choice A", "Choice B"] for choices. NEVER use numbered keys like option_1 or check_1.
   - Use "placeholder": "..." for input ghost text (not short_answer).
3. SUPPORTED QUESTION TYPES (Use ONLY these 10 types, never invent others):
   - "text": Single-line text. Supports optional "placeholder", "min_length", "max_length".
   - "textarea": Multi-line text for detailed answers. Supports optional "placeholder", "min_length", "max_length".
   - "email": Validated email address input. Supports optional "placeholder".
   - "phone": Validated telephone input. Supports optional "placeholder".
   - "url": Validated web URL (e.g. repo, staging, designs). Supports optional "placeholder".
   - "number": Numeric value input. Supports optional "placeholder", "unit" (e.g. "$", "users", "days"), "min", "max", "step".
   - "date": Calendar date picker.
   - "single_choice": Radio button single-select from "options": ["A", "B", ...] (minimum 2 options). Supports optional "allow_other": true.
   - "multiple_choice": Checkbox multi-select from "options": ["A", "B", ...] (minimum 1 option). Supports optional "allow_other": true, "allow_none": true.
   - "yes_no": Binary toggle. Optional "true" and "false" keys for custom labels (e.g. "true": "Yes, cloud", "false": "No, on-prem").
   DO NOT use "rating", "file_upload", or any unsupported type.
4. STRUCTURE & IDS:
   - Structure: {"questionnaire": { "title": "...", "description": "...", "sections": [...] }}
   - Each section must have "section_title", optional "section_description", and a "questions" array with at least one question.
   - Every question must have a unique, lowercase snake_case "question_id" (e.g., "company_name", "target_users", "has_sso").
   - Optional helper guidance can be added to any question with "description": "...".
5. CONDITIONAL FOLLOW-UP QUESTIONS:
   - To make a question appear conditionally based on a previous answer, add:
     "conditional": { "question_id": "<preceding_question_id>", "answer": "<exact_answer_or_option_label>" }
   - Ensure the referenced question_id exists BEFORE this question.
6. GENERIC & PROFESSIONAL:
   - Do not make hardcoded domain assumptions; tailor the questions to the project described below.
   - Mark critical questions as "required": true, and optional questions as "required": false.

CANONICAL V2 JSON FORMAT EXAMPLE TO FOLLOW:
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
    keys: '"placeholder": "Placeholder hint", "min_length": 2',
    example: '{"question_id": "company_name", "question": "Company Name", "type": "text", "required": true, "placeholder": "e.g. Acme Corp"}'
  },
  {
    type: 'textarea',
    name: 'Long Answer',
    description: 'Multi-line expandable textarea for detailed descriptions, business rules, or notes.',
    keys: '"placeholder": "...", "min_length": 20',
    example: '{"question_id": "business_problem", "question": "Describe the main problem to solve", "type": "textarea", "required": true}'
  },
  {
    type: 'email',
    name: 'Email Address',
    description: 'Validated email input ensuring proper address formatting with mail virtual keyboard.',
    keys: '"placeholder": "lead@company.com"',
    example: '{"question_id": "contact_email", "question": "Primary Contact Email", "type": "email", "required": true, "placeholder": "lead@company.com"}'
  },
  {
    type: 'phone',
    name: 'Phone Number',
    description: 'Validated telephone input with telephone keypad on mobile devices.',
    keys: '"placeholder": "+1 (555) 000-0000"',
    example: '{"question_id": "contact_phone", "question": "Direct Phone Number", "type": "phone", "required": false, "placeholder": "+1 (555) 234-5678"}'
  },
  {
    type: 'url',
    name: 'Web URL',
    description: 'Validated web URL for existing sites, repositories, Figma boards, or staging servers.',
    keys: '"placeholder": "https://..."',
    example: '{"question_id": "existing_site", "question": "Existing Website URL", "type": "url", "required": false, "placeholder": "https://company.com"}'
  },
  {
    type: 'single_choice',
    name: 'Single Choice (Radio)',
    description: 'Single-select radio buttons where respondent selects exactly one option from an array.',
    keys: '"options": ["Choice 1", "Choice 2"], "allow_other": true',
    example: '{"question_id": "hosting", "question": "Hosting preference?", "type": "single_choice", "required": true, "options": ["Cloud", "On-Premise"], "allow_other": true}'
  },
  {
    type: 'multiple_choice',
    name: 'Multiple Choice (Checkboxes)',
    description: 'Multi-select checkboxes where respondent can select one or more choices from an array.',
    keys: '"options": ["Choice 1", "Choice 2"], "allow_other": true, "allow_none": true',
    example: '{"question_id": "integrations", "question": "Which integrations are required?", "type": "multiple_choice", "required": false, "options": ["Payment Gateway", "CRM", "Accounting / ERP", "Messaging"], "allow_other": true}'
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
    description: 'Validated numeric values with optional unit label, min/max bounds, and step increment.',
    keys: '"unit": "users", "min": 1, "max": 50000, "placeholder": "0"',
    example: '{"question_id": "user_count", "question": "Expected daily active users?", "type": "number", "unit": "users", "min": 1, "placeholder": "500"}'
  },
  {
    type: 'date',
    name: 'Date Picker',
    description: 'Calendar date picker for project launch targets, milestones, or deadlines.',
    keys: 'No option keys required',
    example: '{"question_id": "launch_deadline", "question": "Target launch date?", "type": "date", "required": false}'
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
    description: 'Give ChatGPT, Claude, Gemini, or Copilot the ReqForge prompt & canonical V2 JSON template.'
  },
  {
    number: '3',
    title: 'Copy & Paste JSON',
    description: 'Copy the agent-generated JSON directly into ReqForge. Validated in real-time.'
  },
  {
    number: '4',
    title: 'Instant Client-Ready Form',
    description: 'ReqForge automatically generates the beautiful, responsive, client-ready questionnaire.'
  },
  {
    number: '5',
    title: 'Share & Collect Specs',
    description: 'Send the link directly to your client. Submissions become structured engineering specs.'
  }
];

export const WHAT_IS_REQFORGE_JSON = {
  title: 'What is ReqForge JSON?',
  subtitle: 'A universal, vendor-neutral questionnaire definition format (V2).',
  summary: 'ReqForge JSON tells the platform everything it needs to render a dynamic, validated client form without writing frontend code. It defines sections, questions, input types, clean options arrays, requirements, metadata, and conditional branching logic.',
  whyItMatters: [
    {
      title: 'AI Agent Compatible (V2)',
      description: 'Any modern AI assistant (ChatGPT, Claude, Gemini, Copilot, Cursor) can generate ready-to-use questionnaires using standard options arrays in seconds.'
    },
    {
      title: 'Zero Code Changes',
      description: 'No new React components, forms, or deployments needed. Paste your JSON and the questionnaire is live instantly.'
    },
    {
      title: 'Built-in Conditional Logic',
      description: 'Questions can dynamically appear based on answers to prior questions using the clean "conditional" block.'
    },
    {
      title: 'Full Data Portability & Backward Compatibility',
      description: 'Export existing questionnaires to JSON anytime, version them in Git, share across projects, and import both modern V2 and legacy V1 formats seamlessly.'
    }
  ]
};
