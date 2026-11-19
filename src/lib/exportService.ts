import { Submission, Questionnaire, QuestionnaireAnswers } from '../types';
import { reconstructAnswersFromSubmission } from './firebase';
import { scoreQuiz } from './quizScoring';

/**
 * Builds the quiz-score block for exports. Prefers the score recomputed from
 * the questionnaire + answers; falls back to the score stored on the submission.
 */
function buildQuizScoreBlock(
  submission: Submission,
  questionnaire: Questionnaire | null | undefined,
  answers: QuestionnaireAnswers
) {
  const quizResult =
    questionnaire?.quiz === true ? scoreQuiz(questionnaire, answers) : null;
  if (quizResult) {
    return {
      earned: quizResult.earned,
      total: quizResult.total,
      percent: quizResult.percent,
      passed: quizResult.passed,
      passMark: quizResult.passMark ?? null,
      perQuestion: quizResult.perQuestion.map((pq) => ({
        questionId: pq.questionId,
        questionText: pq.questionText,
        correct: pq.correct,
        earned: pq.earned,
        points: pq.points,
        correctLabels: pq.correctLabels,
        userLabel: pq.userLabel,
        explanation: pq.explanation || null,
      })),
    };
  }
  if (
    typeof submission.scoreEarned === 'number' &&
    typeof submission.scoreTotal === 'number'
  ) {
    return {
      earned: submission.scoreEarned,
      total: submission.scoreTotal,
      percent:
        typeof submission.scorePercent === 'number' ? submission.scorePercent : null,
      passed: typeof submission.passed === 'boolean' ? submission.passed : null,
      passMark: null,
      perQuestion: [],
    };
  }
  return null;
}

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

  const quizScoreBlock = buildQuizScoreBlock(submission, questionnaire, answers);

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
    // Quiz score block (only present for quiz questionnaires)
    quizScore: quizScoreBlock || undefined,
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
  const quizResult =
    questionnaire?.quiz === true ? scoreQuiz(questionnaire, answers) : null;

  // Optional top header comment with questionnaire metadata
  if (questionnaire?.title) {
    rows.push([
      escapeCsv(`Questionnaire: ${questionnaire.title} (v${questionnaire.version || 1})`),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(''),
      ...(quizResult ? [escapeCsv(''), escapeCsv('')] : []),
    ].join(','));
  }

  // Header row (quiz questionnaires get two extra columns)
  rows.push([
    escapeCsv('Section Title'),
    escapeCsv('Question ID'),
    escapeCsv('Question Text'),
    escapeCsv('Type'),
    escapeCsv('Answer Value'),
    escapeCsv('Notes / Other Input'),
    ...(quizResult ? [escapeCsv('Correct?'), escapeCsv('Points Earned')] : []),
  ].join(','));

  // Quiz score summary row (only for quiz questionnaires)
  if (quizResult) {
    const passText =
      quizResult.passMark !== undefined
        ? ` — ${quizResult.passed ? 'Passed' : 'Failed'} (pass mark ${quizResult.passMark}%)`
        : '';
    rows.push([
      escapeCsv('QUIZ SCORE'),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(`Score: ${quizResult.earned}/${quizResult.total} (${quizResult.percent}%)${passText}`),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(''),
    ].join(','));
  }

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
          ...(quizResult
            ? (() => {
                const pq = quizResult.perQuestion.find((r) => r.questionId === q.id);
                return [
                  escapeCsv(pq ? (pq.correct ? 'Correct' : 'Incorrect') : '—'),
                  escapeCsv(pq ? `${pq.earned}/${pq.points}` : '—'),
                ];
              })()
            : []),
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
