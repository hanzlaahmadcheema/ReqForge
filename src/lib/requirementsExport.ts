import { jsPDF } from 'jspdf';
import {
  Submission,
  RequirementRecord,
  RequirementsSummary,
  CompletenessGapAnalysis,
} from '../types';

/**
 * Helper to download content as a file
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

function escapeCsv(field: unknown): string {
  if (field === null || field === undefined) return '""';
  const str = String(field).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Export processed structured requirements to JSON
 */
export function exportRequirementsToJson(
  submission: Submission,
  requirements: RequirementRecord[],
  summary?: RequirementsSummary | null,
  gaps?: CompletenessGapAnalysis | null
): string {
  const payload = {
    exportType: 'requirements_specification',
    exportVersion: '1.0',
    exportedAt: new Date().toISOString(),
    submission: {
      id: submission.id,
      clientCode: submission.clientCode,
      formTitle: submission.formTitle || 'Requirements Specification',
      submittedAt: submission.submittedAtIso || null,
      status: submission.status || 'submitted',
    },
    summary: summary
      ? {
          overview: summary.overview,
          categories: summary.categories,
          adminNotes: summary.adminNotes || null,
        }
      : null,
    completenessAudit: gaps
      ? {
          score: gaps.completenessScore,
          completenessScore: gaps.completenessScore,
          summary: gaps.summary,
          warnings: gaps.warnings,
        }
      : null,
    requirements: requirements.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      category: r.category,
      priority: r.priority,
      status: r.status,
      sourceQuestionId: r.sourceQuestionId || null,
      sourceQuestionText: r.sourceQuestionText || null,
      notes: r.notes || null,
      createdAt: r.createdAt || null,
      updatedAt: r.updatedAt || null,
    })),
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  const cleanClient = (submission.clientCode || 'client').replace(/[^a-zA-Z0-9_-]/g, '_');
  downloadFile(
    jsonStr,
    `Requirements_${cleanClient}_${submission.id}.json`,
    'application/json'
  );
  return jsonStr;
}

/**
 * Export processed structured requirements to CSV
 */
export function exportRequirementsToCsv(
  submission: Submission,
  requirements: RequirementRecord[]
): string {
  const rows: string[] = [];

  // Header row
  rows.push(
    [
      escapeCsv('Requirement ID'),
      escapeCsv('Title'),
      escapeCsv('Category'),
      escapeCsv('Priority'),
      escapeCsv('Status'),
      escapeCsv('Description / Specification'),
      escapeCsv('Source Question ID'),
      escapeCsv('Source Question Text'),
      escapeCsv('Admin Notes'),
    ].join(',')
  );

  requirements.forEach((r) => {
    rows.push(
      [
        escapeCsv(r.id),
        escapeCsv(r.title),
        escapeCsv(r.category.toUpperCase()),
        escapeCsv(r.priority.toUpperCase()),
        escapeCsv(r.status.toUpperCase()),
        escapeCsv(r.description),
        escapeCsv(r.sourceQuestionId || ''),
        escapeCsv(r.sourceQuestionText || ''),
        escapeCsv(r.notes || ''),
      ].join(',')
    );
  });

  const csvContent = '\uFEFF' + rows.join('\r\n');
  const cleanClient = (submission.clientCode || 'client').replace(/[^a-zA-Z0-9_-]/g, '_');
  downloadFile(
    csvContent,
    `Requirements_${cleanClient}_${submission.id}.csv`,
    'text/csv;charset=utf-8;'
  );
  return csvContent;
}

/**
 * Export processed structured requirements to clean, publication-ready PDF
 */
export function exportRequirementsToPdf(
  submission: Submission,
  requirements: RequirementRecord[],
  summary?: RequirementsSummary | null,
  gaps?: CompletenessGapAnalysis | null
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 16;

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 16) {
      doc.addPage();
      y = 16;
      drawHeader();
    }
  };

  const drawHeader = () => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text('Requirements Specification & Intelligence Report', margin, 10);
    doc.text(`Client: ${submission.clientCode}`, pageWidth - margin, 10, { align: 'right' });
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(margin, 12, pageWidth - margin, 12);
  };

  drawHeader();

  // Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(25, 25, 25);
  doc.text('Requirements Specification Report', margin, y + 6);
  y += 12;

  // Metadata Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 20, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(70, 70, 70);
  doc.text(`Client Code: ${submission.clientCode}`, margin + 4, y + 6);
  doc.text(`Submission ID: ${submission.id}`, margin + 4, y + 11);
  doc.text(`Status: ${(submission.status || 'submitted').toUpperCase()}`, margin + 4, y + 16);

  doc.text(
    `Export Date: ${new Date().toLocaleDateString('en-US', { dateStyle: 'medium' })}`,
    margin + contentWidth / 2,
    y + 6
  );
  doc.text(
    `Requirements Count: ${requirements.length}`,
    margin + contentWidth / 2,
    y + 11
  );
  if (gaps?.completenessScore !== undefined) {
    doc.text(
      `Completeness Score: ${gaps.completenessScore}%`,
      margin + contentWidth / 2,
      y + 16
    );
  }
  y += 26;

  // Overview / Executive Summary Section
  if (summary?.overview) {
    checkPageBreak(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text('Executive Summary', margin, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    const overviewLines = doc.splitTextToSize(summary.overview, contentWidth);
    doc.text(overviewLines, margin, y);
    y += overviewLines.length * 4.5 + 6;
  }

  // Completeness Audit & Warnings Section
  if (gaps && gaps.warnings && gaps.warnings.length > 0) {
    checkPageBreak(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(180, 83, 9); // Amber
    doc.text(`Completeness Audit & Gap Warnings (${gaps.warnings.length})`, margin, y);
    y += 5;

    gaps.warnings.forEach((warn, idx) => {
      checkPageBreak(18);
      doc.setFillColor(254, 252, 232);
      doc.setDrawColor(254, 240, 138);
      doc.roundedRect(margin, y, contentWidth, 14, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(146, 64, 14);
      doc.text(`[${warn.severity.toUpperCase()}] ${warn.title}`, margin + 3, y + 4.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(113, 63, 18);
      const descLines = doc.splitTextToSize(warn.description, contentWidth - 8);
      doc.text(descLines.slice(0, 2), margin + 3, y + 9);
      y += 17;
    });
    y += 4;
  }

  // Extracted Requirements Table / Blocks
  checkPageBreak(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text(`Structured Requirements Specification (${requirements.length})`, margin, y);
  y += 6;

  if (requirements.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('No structured requirements have been extracted yet.', margin, y);
    y += 10;
  } else {
    requirements.forEach((req, idx) => {
      checkPageBreak(28);

      // Card Background
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, y, contentWidth, 24, 1.5, 1.5, 'FD');

      // Title & Priority Pill
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      const titleText = `${idx + 1}. ${req.title}`;
      doc.text(titleText, margin + 3, y + 5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(70, 70, 70);
      const badgeText = `[${req.category.toUpperCase()}] • [${req.priority.toUpperCase()}] • [${req.status.toUpperCase()}]`;
      doc.text(badgeText, pageWidth - margin - 3, y + 5, { align: 'right' });

      // Description
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      const descLines = doc.splitTextToSize(req.description, contentWidth - 6);
      doc.text(descLines.slice(0, 2), margin + 3, y + 10.5);

      // Source question
      if (req.sourceQuestionText) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        const srcText = `Source: "${req.sourceQuestionText.slice(0, 85)}..."`;
        doc.text(srcText, margin + 3, y + 19);
      }

      y += 27;
    });
  }

  // Page Numbers
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(
      `Page ${p} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }

  const cleanClient = (submission.clientCode || 'client').replace(/[^a-zA-Z0-9_-]/g, '_');
  if (typeof window !== 'undefined') {
    doc.save(`Requirements_${cleanClient}_${submission.id}.pdf`);
  }
}
