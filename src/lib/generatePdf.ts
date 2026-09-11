import { jsPDF } from 'jspdf';
import { QuestionnaireSection, QuestionnaireAnswers } from '../types';

export interface GeneratePdfOptions {
  clientCode: string;
  projectName?: string;
  formTitle?: string;
  contactPerson?: string;
  contactPhone?: string;
  additionalRequirements?: string;
  sections: QuestionnaireSection[];
  answers: QuestionnaireAnswers;
  isSubmitted?: boolean;
  submissionDocId?: string;
}

export function generateQuestionnairePdf(options: GeneratePdfOptions): void {
  const {
    clientCode,
    projectName,
    formTitle = 'Requirements Specification',
    contactPerson,
    contactPhone,
    additionalRequirements,
    sections,
    answers,
    isSubmitted = false,
    submissionDocId,
  } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm
  let y = 16;

  // Helper to check for page break
  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 18) {
      doc.addPage();
      y = 16;
      drawRunningHeader();
    }
  };

  const drawRunningHeader = () => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text('Client Requirements Questionnaire', margin, 10);
    const headerRight = projectName ? `${clientCode} | ${projectName}` : `Client: ${clientCode}`;
    doc.text(headerRight, pageWidth - margin, 10, { align: 'right' });
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(margin, 12, pageWidth - margin, 12);
  };

  // 1. Cover / Top Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('CLIENT REQUIREMENTS QUESTIONNAIRE', margin + 6, y + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225); // slate-300
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  doc.text(`${formTitle}  |  Date: ${dateStr}`, margin + 6, y + 16);

  y += 28;

  // 2. Client Metadata Box
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, 20, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text('Client ID:', margin + 4, y + 6);
  doc.text('Contact Person:', margin + 60, y + 6);
  doc.text('Phone / WhatsApp:', margin + 122, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(clientCode || 'Unspecified', margin + 4, y + 13);
  doc.setFont('helvetica', 'normal');
  doc.text(contactPerson || 'Not specified', margin + 60, y + 13);
  doc.text(contactPhone || 'Not specified', margin + 122, y + 13);

  if (submissionDocId) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Firestore Doc ID: ${submissionDocId}`, margin + 4, y + 18);
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(16, 149, 193);
    doc.text(`Pre-Submission Draft  |  Ready for Firestore Storing`, margin + 4, y + 18);
  }

  y += 25;

  // 3. Render each section
  sections.forEach((section, sIdx) => {
    checkPageBreak(22);

    // Section Header Bar
    doc.setFillColor(241, 245, 249); // slate-100
    doc.roundedRect(margin, y, contentWidth, 7, 1, 1, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59); // slate-800
    const secNum = section.order ?? section.sectionNumber ?? sIdx + 1;
    doc.text(
      `SECTION ${secNum}: ${section.title.toUpperCase()}`,
      margin + 3,
      y + 5
    );

    y += 10;

    // Questions inside this section
    section.questions.forEach((q) => {
      const ans = answers[q.id];
      let valueText = 'Not answered';

      if (ans && ans.value !== null && ans.value !== undefined && ans.value !== '') {
        if (typeof ans.value === 'boolean') {
          valueText = ans.value ? 'Yes' : 'No';
        } else if (Array.isArray(ans.value)) {
          if (ans.value.length === 0) {
            valueText = 'None selected';
          } else {
            // Translate option values into readable labels if found
            const labels = ans.value.map((val) => {
              const opt = q.options?.find((o) => o.value === val);
              return opt ? opt.label : val;
            });
            valueText = labels.join('; ');
          }
        } else {
          const opt = q.options?.find((o) => o.value === ans.value);
          valueText = opt ? opt.label : String(ans.value);
        }

        if (ans.otherText) {
          valueText += ` [Other / Detail: ${ans.otherText}]`;
        }
      }

      // Format Question text
      const qNum = q.order ?? q.questionNumber ?? '';
      const qText = q.text || q.title || '';
      const questionTitle = `Q${qNum}. ${qText}`;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      const splitQuestion = doc.splitTextToSize(questionTitle, contentWidth - 4);

      // Format Answer text
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      const splitAnswer = doc.splitTextToSize(`Answer: ${valueText}`, contentWidth - 8);

      let followUpHeight = 0;
      let splitFollowUp: string[] = [];
      if (
        ans &&
        ans.conditionalValue !== undefined &&
        ans.conditionalValue !== null &&
        ans.conditionalValue !== ''
      ) {
        const followUpTitle =
          q.conditionalRule?.followUpQuestion?.text ||
          q.conditionalRule?.followUpQuestion?.title ||
          q.conditional?.question?.title ||
          'Follow-up';
        let followUpVal = String(ans.conditionalValue);
        if (typeof ans.conditionalValue === 'boolean') {
          followUpVal = ans.conditionalValue ? 'Yes' : 'No';
        } else if (Array.isArray(ans.conditionalValue)) {
          followUpVal = ans.conditionalValue.join('; ');
        }
        if (ans.conditionalOtherText) {
          followUpVal += ` (${ans.conditionalOtherText})`;
        }
        const followUpText = `  * Follow-up (${followUpTitle}): ${followUpVal}`;
        splitFollowUp = doc.splitTextToSize(followUpText, contentWidth - 10);
        followUpHeight = splitFollowUp.length * 3.5;
      }

      const totalBlockHeight = (splitQuestion.length + splitAnswer.length) * 4 + followUpHeight + 4;
      checkPageBreak(totalBlockHeight);

      // Print Question
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text(splitQuestion, margin + 2, y);
      y += splitQuestion.length * 4;

      // Print Answer with slight indent
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(splitAnswer, margin + 4, y);
      y += splitAnswer.length * 4;

      // Print Follow-up if any
      if (splitFollowUp.length > 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(3, 105, 161); // sky-700
        doc.text(splitFollowUp, margin + 6, y);
        y += splitFollowUp.length * 3.5;
      }

      y += 2.5; // spacing between questions
    });

    y += 3; // spacing between sections
  });

  // 4. Additional Requirements & Notes Section
  if (additionalRequirements && additionalRequirements.trim().length > 0) {
    checkPageBreak(30);

    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin, y, contentWidth, 7, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.text('ADDITIONAL REQUIREMENTS & HARDWARE SPECIFICATIONS', margin + 3, y + 5);

    y += 11;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    const splitNotes = doc.splitTextToSize(additionalRequirements.trim(), contentWidth - 6);
    checkPageBreak(splitNotes.length * 4 + 4);
    doc.text(splitNotes, margin + 3, y);
    y += splitNotes.length * 4 + 6;
  }

  // 5. Add Running Footers and Page Numbers across all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(
      `Confidential Client Requirements  *  ${clientCode}`,
      margin,
      pageHeight - 7
    );
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth - margin,
      pageHeight - 7,
      { align: 'right' }
    );
  }

  // 6. Save the PDF file
  const cleanCode = (clientCode || 'client').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${cleanCode}_requirements_questionnaire.pdf`;
  if (typeof window !== 'undefined') {
    doc.save(filename);
  }
}
