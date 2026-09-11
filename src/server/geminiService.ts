import { GoogleGenAI } from '@google/genai';
import {
  QuestionSuggestion,
  WordingImprovementSuggestion,
  FollowUpSuggestion,
  RequirementsSummary,
  RequirementRecord,
  CompletenessGapAnalysis,
} from '../types';

let genAIClient: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured.');
    }
    genAIClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
}

const MODEL_NAME = 'gemini-3.8-flash';

/**
 * Clean markdown code fences if model wraps JSON
 */
function cleanJsonText(raw: string): string {
  let text = raw.trim();
  if (text.startsWith('```json')) {
    text = text.slice(7);
  } else if (text.startsWith('```')) {
    text = text.slice(3);
  }
  if (text.endsWith('```')) {
    text = text.slice(0, -3);
  }
  return text.trim();
}

/**
 * Generate question suggestions for questionnaire authoring
 */
export async function generateQuestionSuggestions(params: {
  projectName?: string;
  projectDescription?: string;
  clientContext?: string;
  sectionTitle: string;
  sectionDescription?: string;
  existingQuestions?: string[];
  count?: number;
}): Promise<QuestionSuggestion[]> {
  const ai = getGenAI();
  const count = params.count || 3;

  const prompt = `You are an expert enterprise business analyst and technical requirements architect.
Suggest ${count} high-impact, non-redundant questions to add to a client requirements gathering questionnaire.

Context:
- Project Name: ${params.projectName || 'Not specified'}
- Project Description: ${params.projectDescription || 'Not specified'}
- Client Context / Industry: ${params.clientContext || 'Not specified'}
- Target Section Title: ${params.sectionTitle}
- Section Description: ${params.sectionDescription || 'General requirements'}
- Existing Questions already in this section:
${(params.existingQuestions || []).map((q, idx) => `  ${idx + 1}. ${q}`).join('\n') || '  (None yet)'}

Requirements:
- Suggest targeted questions that uncover critical operational, technical, user, or workflow requirements.
- Choose standard question types from: "text", "textarea", "single_choice", "multiple_choice", "yes_no", "number", "date".
- For choice types, provide 3-5 sensible options.
- If appropriate, suggest an optional conditional follow-up question.
- Do NOT repeat existing questions.

Respond ONLY with a JSON array conforming to this schema:
[
  {
    "id": "sug_${Date.now()}_1",
    "text": "Question wording here?",
    "description": "Clear helper text explaining what information is needed",
    "type": "single_choice",
    "required": false,
    "options": [{"value": "opt1", "label": "Option 1"}, {"value": "opt2", "label": "Option 2"}],
    "reasoning": "Why this question is critical for this section",
    "suggestedFollowUp": {
      "triggerValue": "opt1",
      "question": {
        "text": "Follow-up question wording?",
        "type": "text"
      }
    }
  }
]`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.3,
    },
  });

  const parsed = JSON.parse(cleanJsonText(response.text || '[]'));
  return (Array.isArray(parsed) ? parsed : []).map((item, idx) => ({
    id: item.id || `sug_${Date.now()}_${idx}`,
    text: item.text || 'Suggested question',
    description: item.description || '',
    type: item.type || 'text',
    options: Array.isArray(item.options) ? item.options : undefined,
    required: !!item.required,
    reasoning: item.reasoning || '',
    suggestedFollowUp: item.suggestedFollowUp,
  }));
}

/**
 * Suggest better wording and question type for an existing question
 */
export async function improveQuestionWording(params: {
  currentText: string;
  currentDescription?: string;
  currentType?: string;
  sectionTitle?: string;
}): Promise<WordingImprovementSuggestion> {
  const ai = getGenAI();

  const prompt = `You are an expert UX and technical requirements analyst.
Review and improve the wording and structure of the following questionnaire item:

Current Question: "${params.currentText}"
Current Helper Text: "${params.currentDescription || ''}"
Current Question Type: "${params.currentType || 'text'}"
Section Context: "${params.sectionTitle || 'General'}"

Goals:
1. Make the question concise, professional, and unambiguous for clients.
2. Provide a clear helper description that clarifies scope or examples.
3. Recommend the most appropriate question type ("text", "textarea", "single_choice", "multiple_choice", "yes_no", "number", "date").
4. Explain the reasoning behind the improvement.

Respond ONLY with a JSON object:
{
  "originalText": "${params.currentText.replace(/"/g, '\\"')}",
  "improvedText": "Improved, professional question wording",
  "suggestedDescription": "Clarifying instructions or guidance",
  "suggestedType": "single_choice",
  "reasoning": "Explanation of improvements made"
}`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  });

  const parsed = JSON.parse(cleanJsonText(response.text || '{}'));
  return {
    originalText: params.currentText,
    improvedText: parsed.improvedText || params.currentText,
    suggestedDescription: parsed.suggestedDescription || params.currentDescription,
    suggestedType: parsed.suggestedType || (params.currentType as any) || 'text',
    reasoning: parsed.reasoning || 'Refined for professional clarity and precision.',
  };
}

/**
 * Suggest conditional follow-up question
 */
export async function suggestFollowUpQuestion(params: {
  parentQuestionText: string;
  triggerOptionValue: string;
  sectionTitle?: string;
}): Promise<FollowUpSuggestion> {
  const ai = getGenAI();

  const prompt = `You are a requirements gathering expert.
For the question: "${params.parentQuestionText}"
When the client selects or answers: "${params.triggerOptionValue}"

Suggest a single logical conditional follow-up question to elicit necessary technical or operational details.

Respond ONLY with a JSON object:
{
  "triggerValue": "${params.triggerOptionValue}",
  "questionText": "Follow-up question text",
  "questionType": "textarea",
  "options": [],
  "reasoning": "Why this follow-up detail is necessary"
}`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  });

  const parsed = JSON.parse(cleanJsonText(response.text || '{}'));
  return {
    triggerValue: params.triggerOptionValue,
    questionText: parsed.questionText || 'Please provide additional details:',
    questionType: parsed.questionType || 'textarea',
    options: parsed.options,
    reasoning: parsed.reasoning || '',
  };
}

/**
 * Summarize submitted requirements grouped into structured categories
 */
export async function summarizeRequirements(params: {
  submissionId: string;
  formTitle: string;
  clientCode: string;
  sectionsWithAnswers: {
    title: string;
    items: {
      questionId: string;
      questionText: string;
      answerText: string;
    }[];
  }[];
  additionalNotes?: string;
}): Promise<RequirementsSummary> {
  const ai = getGenAI();

  const prompt = `You are a Principal Technical Solutions Architect reviewing a client's completed requirements questionnaire.
Generate a structured, professional requirements summary.

Form Title: ${params.formTitle}
Client Identifier: ${params.clientCode}
Additional Client Notes: ${params.additionalNotes || 'None'}

Client Responses:
${params.sectionsWithAnswers
  .map(
    (sec) => `## Section: ${sec.title}
${sec.items.map((it) => `- [Q: ${it.questionText}] -> Answer: ${it.answerText || '(Unanswered)'}`).join('\n')}`
  )
  .join('\n\n')}

INSTRUCTIONS:
1. Provide a concise executive overview (2-3 sentences).
2. Group the findings into these exact 8 categories:
   - "business_goals" (Label: Business Goals & Objectives)
   - "users_roles" (Label: Users, Roles & Permissions)
   - "features" (Label: Core Functional Features)
   - "workflow" (Label: Workflows & Business Processes)
   - "data" (Label: Data Models, Storage & Retention)
   - "integrations" (Label: Third-Party Integrations & APIs)
   - "reports" (Label: Reporting, Analytics & Exports)
   - "constraints" (Label: Technical Constraints & Compliance)

3. For EVERY item in every category, strictly classify its type as:
   - "explicit": Direct fact or requirement explicitly stated by the client in an answer.
   - "inferred": Logical architectural consequence or likely implied need.
   - "missing": Critical information that was not answered or is currently ambiguous.

DO NOT silently invent false statements. Be objective, rigorous, and grounded in the provided answers.

Respond ONLY with a valid JSON object matching:
{
  "overview": "Executive summary overview text...",
  "categories": [
    {
      "category": "business_goals",
      "label": "Business Goals & Objectives",
      "items": [
        {
          "id": "bg_1",
          "text": "Requirement summary item text",
          "type": "explicit"
        }
      ]
    }
  ]
}`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  });

  const parsed = JSON.parse(cleanJsonText(response.text || '{}'));
  return {
    submissionId: params.submissionId,
    generatedAt: new Date().toISOString(),
    overview: parsed.overview || 'Requirements summary based on client questionnaire responses.',
    categories: Array.isArray(parsed.categories) ? parsed.categories : [],
  };
}

/**
 * Extract structured requirement records from submission answers
 */
export async function extractStructuredRequirements(params: {
  submissionId: string;
  formTitle: string;
  clientCode: string;
  sectionsWithAnswers: {
    title: string;
    items: {
      questionId: string;
      questionText: string;
      answerText: string;
    }[];
  }[];
}): Promise<RequirementRecord[]> {
  const ai = getGenAI();

  const prompt = `You are a Senior Business Analyst.
Analyze the following client submission answers and extract discrete, actionable requirement records.

Form Title: ${params.formTitle}
Client: ${params.clientCode}

Client Responses:
${params.sectionsWithAnswers
  .map(
    (sec) => `## ${sec.title}
${sec.items.map((it) => `- ID: ${it.questionId} | Question: "${it.questionText}" | Client Answer: "${it.answerText || '(Unanswered)'}"`).join('\n')}`
  )
  .join('\n\n')}

RULES:
1. Extract atomic, structured requirement records.
2. Ground each requirement directly in a client's answer. Do NOT invent unsolicited features.
3. Category must be one of:
   "business_goals", "users_roles", "features", "workflow", "data", "integrations", "reports", "constraints", "other"
4. Priority must be: "high", "medium", or "low".
5. Set status to "pending" for every extracted requirement.
6. Provide sourceQuestionId and sourceQuestionText for traceability.

Respond ONLY with a JSON array of requirements:
[
  {
    "id": "req_1",
    "title": "Short descriptive requirement title",
    "description": "Detailed specification of the requirement as derived from client answer",
    "category": "features",
    "priority": "high",
    "sourceQuestionId": "question_id_here",
    "sourceQuestionText": "exact question text",
    "sourceSubmissionId": "${params.submissionId}",
    "status": "pending",
    "notes": "Contextual notes or observation"
  }
]`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  });

  const parsed = JSON.parse(cleanJsonText(response.text || '[]'));
  return (Array.isArray(parsed) ? parsed : []).map((item, idx) => ({
    id: item.id || `req_${Date.now()}_${idx + 1}`,
    title: item.title || `Requirement ${idx + 1}`,
    description: item.description || '',
    category: item.category || 'other',
    priority: item.priority || 'medium',
    sourceQuestionId: item.sourceQuestionId,
    sourceQuestionText: item.sourceQuestionText,
    sourceSubmissionId: params.submissionId,
    status: 'pending',
    notes: item.notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

/**
 * Perform completeness and gap analysis on submission answers
 */
export async function analyzeCompletenessAndGaps(params: {
  submissionId: string;
  formTitle: string;
  clientCode: string;
  sectionsWithAnswers: {
    title: string;
    items: {
      questionId: string;
      questionText: string;
      required: boolean;
      answerText: string;
    }[];
  }[];
}): Promise<CompletenessGapAnalysis> {
  const ai = getGenAI();

  const prompt = `You are a Quality Assurance and Business Analysis Auditor.
Evaluate the completeness, clarity, and consistency of the following questionnaire responses.

Form: ${params.formTitle}
Client: ${params.clientCode}

Responses:
${params.sectionsWithAnswers
  .map(
    (sec) => `## ${sec.title}
${sec.items.map((it) => `- ID: ${it.questionId} | Required: ${it.required} | Q: "${it.questionText}" | A: "${it.answerText || '(NO ANSWER)'}"`).join('\n')}`
  )
  .join('\n\n')}

CRITICAL AUDIT TASKS:
1. Identify unanswered required information.
2. Identify ambiguous answers (e.g. "maybe", "not sure", overly brief answers lacking critical context).
3. Identify conflicting answers across different questions.
4. Identify potentially missing requirements (e.g. requesting payments without specifying gateway or currencies).
5. Identify unclear business rules or workflow edge cases.
6. Calculate an estimated completeness score (0 to 100).
7. Format findings as advisory warnings (NOT as automatic facts).

Type must be one of:
"unanswered_required", "ambiguous_answer", "conflicting_answers", "missing_requirement", "unclear_rule"

Severity must be: "high", "medium", or "low".

Respond ONLY with a valid JSON object:
{
  "completenessScore": 85,
  "summary": "Brief overall evaluation of the submission quality and completeness.",
  "warnings": [
    {
      "id": "gap_1",
      "type": "unanswered_required",
      "title": "Short title of the warning",
      "description": "Explanation of what is missing or ambiguous",
      "severity": "high",
      "relatedQuestionId": "id_if_applicable",
      "relatedQuestionText": "question text"
    }
  ]
}`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  });

  const parsed = JSON.parse(cleanJsonText(response.text || '{}'));
  return {
    submissionId: params.submissionId,
    analyzedAt: new Date().toISOString(),
    completenessScore: typeof parsed.completenessScore === 'number' ? parsed.completenessScore : 70,
    summary: parsed.summary || 'Completeness audit completed.',
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
  };
}
