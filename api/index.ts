import express from 'express';
import {
  generateQuestionSuggestions,
  improveQuestionWording,
  suggestFollowUpQuestion,
  summarizeRequirements,
  extractStructuredRequirements,
  analyzeCompletenessAndGaps,
} from '../src/server/geminiService';

const app = express();
app.use(express.json({ limit: '10mb' }));

// Health endpoint
const handleHealth = (_req: express.Request, res: express.Response) => {
  res.json({
    status: 'ok',
    hasApiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
};

// Route handlers
app.get('/api/health', handleHealth);
app.get('/health', handleHealth);

// Question suggestions
const handleSuggestQuestions = async (req: express.Request, res: express.Response) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      res.status(503).json({
        success: false,
        error: 'GEMINI_API_KEY is not configured on the server. Please check the Secrets panel.',
      });
      return;
    }

    const {
      projectName,
      projectDescription,
      clientContext,
      sectionTitle,
      sectionDescription,
      existingQuestions,
      count,
    } = req.body;

    if (!sectionTitle) {
      res.status(400).json({ success: false, error: 'sectionTitle is required' });
      return;
    }

    const suggestions = await generateQuestionSuggestions({
      projectName,
      projectDescription,
      clientContext,
      sectionTitle,
      sectionDescription,
      existingQuestions,
      count: typeof count === 'number' ? count : 3,
    });

    res.json({ success: true, suggestions });
  } catch (err: unknown) {
    console.error('Error generating question suggestions:', err);
    const message = err instanceof Error ? err.message : 'Unknown AI generation error';
    res.status(500).json({ success: false, error: message });
  }
};
app.post('/api/ai/suggest-questions', handleSuggestQuestions);
app.post('/ai/suggest-questions', handleSuggestQuestions);

// Improve wording
const handleImproveWording = async (req: express.Request, res: express.Response) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      res.status(503).json({
        success: false,
        error: 'GEMINI_API_KEY is not configured on the server.',
      });
      return;
    }

    const { currentText, currentDescription, currentType, sectionTitle } = req.body;
    if (!currentText) {
      res.status(400).json({ success: false, error: 'currentText is required' });
      return;
    }

    const improvement = await improveQuestionWording({
      currentText,
      currentDescription,
      currentType,
      sectionTitle,
    });

    res.json({ success: true, improvement });
  } catch (err: unknown) {
    console.error('Error improving wording:', err);
    const message = err instanceof Error ? err.message : 'Unknown AI wording error';
    res.status(500).json({ success: false, error: message });
  }
};
app.post('/api/ai/improve-wording', handleImproveWording);
app.post('/ai/improve-wording', handleImproveWording);

// Follow-up
const handleSuggestFollowup = async (req: express.Request, res: express.Response) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      res.status(503).json({
        success: false,
        error: 'GEMINI_API_KEY is not configured on the server.',
      });
      return;
    }

    const { parentQuestionText, triggerOptionValue, sectionTitle } = req.body;
    if (!parentQuestionText || !triggerOptionValue) {
      res.status(400).json({
        success: false,
        error: 'parentQuestionText and triggerOptionValue are required',
      });
      return;
    }

    const suggestion = await suggestFollowUpQuestion({
      parentQuestionText,
      triggerOptionValue,
      sectionTitle,
    });

    res.json({ success: true, suggestion });
  } catch (err: unknown) {
    console.error('Error suggesting follow-up:', err);
    const message = err instanceof Error ? err.message : 'Unknown AI follow-up error';
    res.status(500).json({ success: false, error: message });
  }
};
app.post('/api/ai/suggest-followup', handleSuggestFollowup);
app.post('/ai/suggest-followup', handleSuggestFollowup);

// Summarize
const handleSummarizeRequirements = async (req: express.Request, res: express.Response) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      res.status(503).json({
        success: false,
        error: 'GEMINI_API_KEY is not configured on the server.',
      });
      return;
    }

    const { submissionId, formTitle, clientCode, sectionsWithAnswers, additionalNotes } =
      req.body;

    if (!submissionId || !Array.isArray(sectionsWithAnswers)) {
      res.status(400).json({
        success: false,
        error: 'submissionId and sectionsWithAnswers array are required',
      });
      return;
    }

    const summary = await summarizeRequirements({
      submissionId,
      formTitle: formTitle || 'Client Questionnaire',
      clientCode: clientCode || 'Client',
      sectionsWithAnswers,
      additionalNotes,
    });

    res.json({ success: true, summary });
  } catch (err: unknown) {
    console.error('Error summarizing requirements:', err);
    const message = err instanceof Error ? err.message : 'Unknown AI summarization error';
    res.status(500).json({ success: false, error: message });
  }
};
app.post('/api/ai/summarize-requirements', handleSummarizeRequirements);
app.post('/ai/summarize-requirements', handleSummarizeRequirements);

// Extract
const handleExtractRequirements = async (req: express.Request, res: express.Response) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      res.status(503).json({
        success: false,
        error: 'GEMINI_API_KEY is not configured on the server.',
      });
      return;
    }

    const { submissionId, formTitle, clientCode, sectionsWithAnswers } = req.body;

    if (!submissionId || !Array.isArray(sectionsWithAnswers)) {
      res.status(400).json({
        success: false,
        error: 'submissionId and sectionsWithAnswers array are required',
      });
      return;
    }

    const requirements = await extractStructuredRequirements({
      submissionId,
      formTitle: formTitle || 'Client Questionnaire',
      clientCode: clientCode || 'Client',
      sectionsWithAnswers,
    });

    res.json({ success: true, requirements });
  } catch (err: unknown) {
    console.error('Error extracting requirements:', err);
    const message = err instanceof Error ? err.message : 'Unknown AI extraction error';
    res.status(500).json({ success: false, error: message });
  }
};
app.post('/api/ai/extract-requirements', handleExtractRequirements);
app.post('/ai/extract-requirements', handleExtractRequirements);

// Gap analysis
const handleGapAnalysis = async (req: express.Request, res: express.Response) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      res.status(503).json({
        success: false,
        error: 'GEMINI_API_KEY is not configured on the server.',
      });
      return;
    }

    const { submissionId, formTitle, clientCode, sectionsWithAnswers } = req.body;

    if (!submissionId || !Array.isArray(sectionsWithAnswers)) {
      res.status(400).json({
        success: false,
        error: 'submissionId and sectionsWithAnswers array are required',
      });
      return;
    }

    const analysis = await analyzeCompletenessAndGaps({
      submissionId,
      formTitle: formTitle || 'Client Questionnaire',
      clientCode: clientCode || 'Client',
      sectionsWithAnswers,
    });

    res.json({ success: true, analysis });
  } catch (err: unknown) {
    console.error('Error performing gap analysis:', err);
    const message = err instanceof Error ? err.message : 'Unknown AI gap analysis error';
    res.status(500).json({ success: false, error: message });
  }
};
app.post('/api/ai/gap-analysis', handleGapAnalysis);
app.post('/ai/gap-analysis', handleGapAnalysis);

export default app;
