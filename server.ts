import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import {
  generateQuestionSuggestions,
  improveQuestionWording,
  suggestFollowUpQuestion,
  summarizeRequirements,
  extractStructuredRequirements,
  analyzeCompletenessAndGaps,
} from './src/server/geminiService';
import {
  handleGetPublicFormInfo,
  handleVerifyPublicFormPin,
} from './src/server/publicFormsEndpoints';

async function startServer() {
  const app = express();
  const PORT = 3000;
  const HOST = '0.0.0.0';

  app.use(express.json({ limit: '10mb' }));

  // ---------------------------------------------------------------------------
  // PUBLIC FORMS & PIN VERIFICATION ENDPOINTS
  // ---------------------------------------------------------------------------
  app.get('/api/public-forms/:publicId', handleGetPublicFormInfo);
  app.post('/api/public-forms/verify-pin', handleVerifyPublicFormPin);

  // ---------------------------------------------------------------------------
  // HEALTH & STATUS ENDPOINT
  // ---------------------------------------------------------------------------
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      hasApiKey: !!process.env.GEMINI_API_KEY,
      timestamp: new Date().toISOString(),
    });
  });

  // ---------------------------------------------------------------------------
  // AI ENDPOINT: QUESTION SUGGESTIONS
  // ---------------------------------------------------------------------------
  app.post('/api/ai/suggest-questions', async (req, res) => {
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
  });

  // ---------------------------------------------------------------------------
  // AI ENDPOINT: IMPROVE QUESTION WORDING & TYPE
  // ---------------------------------------------------------------------------
  app.post('/api/ai/improve-wording', async (req, res) => {
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
  });

  // ---------------------------------------------------------------------------
  // AI ENDPOINT: SUGGEST CONDITIONAL FOLLOW-UP
  // ---------------------------------------------------------------------------
  app.post('/api/ai/suggest-followup', async (req, res) => {
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
  });

  // ---------------------------------------------------------------------------
  // AI ENDPOINT: SUMMARIZE REQUIREMENTS
  // ---------------------------------------------------------------------------
  app.post('/api/ai/summarize-requirements', async (req, res) => {
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
  });

  // ---------------------------------------------------------------------------
  // AI ENDPOINT: EXTRACT STRUCTURED REQUIREMENTS
  // ---------------------------------------------------------------------------
  app.post('/api/ai/extract-requirements', async (req, res) => {
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
  });

  // ---------------------------------------------------------------------------
  // AI ENDPOINT: COMPLETENESS & GAP ANALYSIS
  // ---------------------------------------------------------------------------
  app.post('/api/ai/gap-analysis', async (req, res) => {
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
  });

  // ---------------------------------------------------------------------------
  // VITE DEV MIDDLEWARE OR PRODUCTION STATIC SERVING
  // ---------------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // SPA fallback: any non-API GET request serves transformed index.html in dev mode
    app.get('*', async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith('/api/')) {
        return next();
      }
      try {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
  });
}

startServer();
