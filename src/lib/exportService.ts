import { Submission, Questionnaire, QuestionnaireAnswers } from '../types';
import { reconstructAnswersFromSubmission } from './firebase';

/**
 * Helper to download a string or blob as a file in the browser
 */
function downloadFile(content: string, filename: string, mimeType: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Safely format an answer value for display or CSV/JSON
 */
function formatAnswerDisplay(val: unknown): string {
  if (val === null || val === undefined || val === '') return 'N/A';
  if (Array.isArray(val)) return val.join('; ');
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
}

/**
 * Escapes fields for standard CSV (RFC 4180)
 */
function escapeCsv(field: unknown): string {
  if (field === null || field === undefined) return '""';
  const str = String(field).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Exports complete submission data as structured JSON file
 */
export function exportSubmissionToJson(
  submission: Submission,
  questionnaire?: Questionnaire | null
): string {
  const answers = reconstructAnswersFromSubmission(submission);

  // Map answers dynamically using questionnaire schema if available
  const structuredSections = (questionnaire?.sections || []).map((sec) => {
    return {
      sectionId: sec.id,
      sectionTitle: sec.title,
      questions: (sec.questions || []).map((q) => {
        const ans = answers[q.id];
        return {
          questionId: q.id,
          questionText: q.text || q.title || q.id,
          type: q.type,
          answeredValue: ans ? ans.value : null,
          formattedAnswer: ans ? formatAnswerDisplay(ans.value) : 'Not Answered',
          otherText: ans?.otherText || null,
          conditionalAnswer: ans?.conditionalValue ?? null,
        };
      }),
    };
  });

  const exportPayload = {
    exportVersion: '1.0',
    exportedAt: new Date().toISOString(),
    submission: {
      id: submission.id,
      status: submission.status || 'submitted',
      clientCode: submission.clientCode,
      clientId: submission.clientId || null,
      projectId: submission.projectId || null,
      questionnaireId: submission.questionnaireId || questionnaire?.id || 'default',
      questionnaireVersion: submission.questionnaireVersion || questionnaire?.version || 1,
      contactPerson: submission.contactPerson || null,
      contactPhone: submission.contactPhone || null,
      additionalRequirements: submission.additionalRequirements || null,
      submittedAtIso: submission.submittedAtIso || null,
      reviewedAt: submission.reviewedAt || null,
      createdAt: submission.createdAt || null,
      updatedAt: submission.updatedAt || null,
    },
    sections: structuredSections.length > 0 ? structuredSections : undefined,
    rawAnswers: answers,
  };

  const jsonString = JSON.stringify(exportPayload, null, 2);
  const cleanName = (submission.clientCode || 'submission').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${cleanName}_${submission.id}.json`;

  downloadFile(jsonString, filename, 'application/json');
  return jsonString;
}

/**
 * Exports submission answers as clean, structured CSV
 */
export function exportSubmissionToCsv(
  submission: Submission,
  questionnaire?: Questionnaire | null
): string {
  const answers = reconstructAnswersFromSubmission(submission);
  const rows: string[] = [];

  // Optional top header comment with questionnaire metadata
  if (questionnaire?.title) {
    rows.push([
      escapeCsv(`Questionnaire: ${questionnaire.title} (v${questionnaire.version || 1})`),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(''),
    ].join(','));
  }

  // Header row
  rows.push([
    escapeCsv('Section Title'),
    escapeCsv('Question ID'),
    escapeCsv('Question Text'),
    escapeCsv('Type'),
    escapeCsv('Answer Value'),
    escapeCsv('Notes / Other Input'),
  ].join(','));

  if (questionnaire?.sections && questionnaire.sections.length > 0) {
    // Dynamic iteration through questionnaire sections
    questionnaire.sections.forEach((sec) => {
      (sec.questions || []).forEach((q) => {
        const ans = answers[q.id];
        const displayVal = ans ? formatAnswerDisplay(ans.value) : 'N/A';
        const otherVal = ans?.otherText ? `Other: ${ans.otherText}` : '';

        rows.push([
          escapeCsv(sec.title),
          escapeCsv(q.id),
          escapeCsv(q.text || q.title || q.id),
          escapeCsv(q.type),
          escapeCsv(displayVal),
          escapeCsv(otherVal),
        ].join(','));
      });
    });
  } else {
    // Fallback if questionnaire is not passed: output from answers map
    Object.entries(answers).forEach(([qId, ans]) => {
      const displayVal = formatAnswerDisplay(ans.value);
      const otherVal = ans.otherText ? `Other: ${ans.otherText}` : '';

      rows.push([
        escapeCsv('General'),
        escapeCsv(qId),
        escapeCsv(qId),
        escapeCsv('custom'),
        escapeCsv(displayVal),
        escapeCsv(otherVal),
      ].join(','));
    });
  }

  // Also include general requirements row if present
  if (submission.additionalRequirements) {
    rows.push([
      escapeCsv('Requirements Summary'),
      escapeCsv('additionalRequirements'),
      escapeCsv('Additional Notes & Special Requirements'),
      escapeCsv('textarea'),
      escapeCsv(submission.additionalRequirements),
      escapeCsv(''),
    ].join(','));
  }

  const csvContent = '\uFEFF' + rows.join('\r\n'); // Add BOM for Excel UTF-8
  const cleanName = (submission.clientCode || 'submission').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${cleanName}_${submission.id}.csv`;

  downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
  return csvContent;
}
