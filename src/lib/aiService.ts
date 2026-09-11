import {
  QuestionSuggestion,
  WordingImprovementSuggestion,
  FollowUpSuggestion,
  RequirementsSummary,
  RequirementRecord,
  CompletenessGapAnalysis,
  Section,
  Submission,
  QuestionnaireAnswers,
} from '../types';

interface ApiResponse<T> {
  success: boolean;
  error?: string;
  [key: string]: unknown;
}

/**
 * Request AI question suggestions for a section
 */
export async function fetchQuestionSuggestions(params: {
  projectName?: string;
  projectDescription?: string;
  clientContext?: string;
  sectionTitle: string;
  sectionDescription?: string;
  existingQuestions?: string[];
  count?: number;
}): Promise<QuestionSuggestion[]> {
  const res = await fetch('/api/ai/suggest-questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = (await res.json()) as ApiResponse<unknown> & {
    suggestions?: QuestionSuggestion[];
  };
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Failed to fetch question suggestions (Status: ${res.status})`);
  }

  return data.suggestions || [];
}

/**
 * Request AI wording and question type improvement for a question
 */
export async function fetchWordingImprovement(params: {
  currentText: string;
  currentDescription?: string;
  currentType?: string;
  sectionTitle?: string;
}): Promise<WordingImprovementSuggestion> {
  const res = await fetch('/api/ai/improve-wording', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = (await res.json()) as ApiResponse<unknown> & {
    improvement?: WordingImprovementSuggestion;
  };
  if (!res.ok || !data.success || !data.improvement) {
    throw new Error(data.error || `Failed to improve question wording (Status: ${res.status})`);
  }

  return data.improvement;
}

/**
 * Request AI follow-up suggestion for an option
 */
export async function fetchFollowUpSuggestion(params: {
  parentQuestionText: string;
  triggerOptionValue: string;
  sectionTitle?: string;
}): Promise<FollowUpSuggestion> {
  const res = await fetch('/api/ai/suggest-followup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = (await res.json()) as ApiResponse<unknown> & {
    suggestion?: FollowUpSuggestion;
  };
  if (!res.ok || !data.success || !data.suggestion) {
    throw new Error(data.error || `Failed to suggest follow-up (Status: ${res.status})`);
  }

  return data.suggestion;
}

/**
 * Helper to prepare submission answers into a structured format for AI analysis
 */
export function formatSectionsWithAnswersForAi(
  sections: Section[],
  answers: QuestionnaireAnswers | Record<string, unknown>
): {
  title: string;
  items: {
    questionId: string;
    questionText: string;
    required: boolean;
    answerText: string;
  }[];
}[] {
  return sections.map((sec) => {
    const items = (sec.questions || []).map((q) => {
      const qText = q.text || q.title || 'Untitled question';
      const ansObj = (answers as Record<string, any>)?.[q.id];

      let answerText = '';
      if (ansObj !== undefined && ansObj !== null) {
        if (typeof ansObj === 'object' && 'value' in ansObj) {
          const val = ansObj.value;
          if (Array.isArray(val)) {
            answerText = val.join(', ');
          } else if (typeof val === 'boolean') {
            answerText = val ? 'Yes' : 'No';
          } else if (val !== null && val !== undefined) {
            answerText = String(val);
          }
          if (ansObj.otherText) {
            answerText += ` (Other: ${ansObj.otherText})`;
          }
        } else if (Array.isArray(ansObj)) {
          answerText = ansObj.join(', ');
        } else if (typeof ansObj === 'boolean') {
          answerText = ansObj ? 'Yes' : 'No';
        } else {
          answerText = String(ansObj);
        }
      }

      return {
        questionId: q.id,
        questionText: qText,
        required: !!q.required,
        answerText: answerText.trim(),
      };
    });

    return {
      title: sec.title || 'General Section',
      items,
    };
  });
}

/**
 * Request AI requirements summary for a submission
 */
export async function fetchRequirementsSummary(
  submission: Submission,
  sections: Section[]
): Promise<RequirementsSummary> {
  const sectionsWithAnswers = formatSectionsWithAnswersForAi(
    sections,
    submission.rawAnswers || submission.answers || {}
  );

  const res = await fetch('/api/ai/summarize-requirements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      submissionId: submission.id,
      formTitle: submission.formTitle || 'System Requirements Questionnaire',
      clientCode: submission.clientCode,
      sectionsWithAnswers,
      additionalNotes: submission.additionalRequirements,
    }),
  });

  const data = (await res.json()) as ApiResponse<unknown> & {
    summary?: RequirementsSummary;
  };
  if (!res.ok || !data.success || !data.summary) {
    throw new Error(data.error || `Failed to summarize requirements (Status: ${res.status})`);
  }

  return data.summary;
}

/**
 * Request AI structured requirements extraction
 */
export async function fetchStructuredRequirements(
  submission: Submission,
  sections: Section[]
): Promise<RequirementRecord[]> {
  const sectionsWithAnswers = formatSectionsWithAnswersForAi(
    sections,
    submission.rawAnswers || submission.answers || {}
  );

  const res = await fetch('/api/ai/extract-requirements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      submissionId: submission.id,
      formTitle: submission.formTitle || 'System Requirements Questionnaire',
      clientCode: submission.clientCode,
      sectionsWithAnswers,
    }),
  });

  const data = (await res.json()) as ApiResponse<unknown> & {
    requirements?: RequirementRecord[];
  };
  if (!res.ok || !data.success || !data.requirements) {
    throw new Error(data.error || `Failed to extract requirements (Status: ${res.status})`);
  }

  return data.requirements;
}

/**
 * Request AI completeness and gap check
 */
export async function fetchGapAnalysis(
  submission: Submission,
  sections: Section[]
): Promise<CompletenessGapAnalysis> {
  const sectionsWithAnswers = formatSectionsWithAnswersForAi(
    sections,
    submission.rawAnswers || submission.answers || {}
  );

  const res = await fetch('/api/ai/gap-analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      submissionId: submission.id,
      formTitle: submission.formTitle || 'System Requirements Questionnaire',
      clientCode: submission.clientCode,
      sectionsWithAnswers,
    }),
  });

  const data = (await res.json()) as ApiResponse<unknown> & {
    analysis?: CompletenessGapAnalysis;
  };
  if (!res.ok || !data.success || !data.analysis) {
    throw new Error(data.error || `Failed to perform gap analysis (Status: ${res.status})`);
  }

  return data.analysis;
}
