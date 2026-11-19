/**
 * Local verification for the quiz batch:
 *  1. separate Quizzes section (admin),
 *  2. respondent answer modes (whole form / one at a time),
 *  3. anonymous quizzes (no Firestore writes; localStorage only),
 *  4. questionnaire dropdown disambiguation.
 *
 * Pure-logic + static source checks. No network, no Firestore, no live site.
 * Run: npx tsx scripts/verify-quiz-batch.ts
 */
import { readFileSync } from 'node:fs';
import { scoreQuiz, scoreQuestion, isScorableQuestion } from '../src/lib/quizScoring';
import {
  getQuizProgressKey,
  loadQuizProgress,
  saveQuizProgress,
  mergeQuizProgress,
  clearQuizProgress,
} from '../src/lib/quizLocalStorage';
import { formatQuestionnaireOptionLabel } from '../src/lib/questionnaireService';
import {
  importQuestionnaireFromJson,
  exportQuestionnaireToJsonTemplate,
  validateQuestionnaireJson,
} from '../src/lib/questionnaireJsonImporter';
import { validateQuestionnaireForPublish } from '../src/lib/questionnaireValidation';
import type { Questionnaire, QuestionnaireAnswers } from '../src/types';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail = ''): void {
  if (cond) {
    passed++;
    console.log(`  PASS ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function src(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf-8');
}

// Minimal localStorage mock (node has none; the lib only uses window.localStorage).
const store = new Map<string, string>();
(globalThis as any).window = {
  localStorage: {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const sampleQuizJson = {
  questionnaire: {
    title: 'General Knowledge Quiz',
    quiz: true,
    show_score_on_submit: true,
    show_correct_answers: true,
    pass_mark: 70,
    sections: [
      {
        section_title: 'Section 1',
        questions: [
          {
            question_id: 'q1',
            question: 'What is 2 + 2?',
            type: 'single_choice',
            required: true,
            points: 2,
            options: [
              { label: '3', value: '3' },
              { label: '4', value: '4', correct: true },
              { label: '5', value: '5' },
            ],
            explanation: '2 + 2 = 4.',
          },
          {
            question_id: 'q2',
            question: 'Is the sky blue?',
            type: 'yes_no',
            points: 1,
            correct_answer: true,
          },
        ],
      },
    ],
  },
};

const quiz: Questionnaire = {
  id: 'q_test',
  title: 'General Knowledge Quiz',
  description: '',
  version: 1,
  status: 'published',
  quiz: true,
  showScoreOnSubmit: true,
  showCorrectAnswers: true,
  passMark: 70,
  sections: [
    {
      id: 'sec1',
      title: 'Section 1',
      description: '',
      questions: [
        {
          id: 'q1',
          text: 'What is 2 + 2?',
          type: 'single_choice',
          required: true,
          points: 2,
          explanation: '2 + 2 = 4.',
          options: [
            { label: '3', value: '3' },
            { label: '4', value: '4', correct: true },
            { label: '5', value: '5' },
          ],
        },
        {
          id: 'q2',
          text: 'Is the sky blue?',
          type: 'yes_no',
          points: 1,
          correctAnswer: true,
        },
        {
          id: 'q3',
          text: 'Pick the even numbers.',
          type: 'multiple_choice',
          points: 2,
          options: [
            { label: '2', value: '2', correct: true },
            { label: '3', value: '3' },
            { label: '4', value: '4', correct: true },
          ],
        },
        {
          id: 'q4',
          text: 'Hidden follow-up: why?',
          type: 'text',
          conditionalRule: {
            dependsOnQuestionId: 'q2',
            operator: 'equals',
            value: false,
          },
        },
        { id: 'q5', text: 'Any comments?', type: 'text' },
      ],
    },
  ],
};

const nonQuiz: Questionnaire = { ...quiz, quiz: false, id: 'q_req' };

const allCorrect: QuestionnaireAnswers = {
  q1: { value: '4' },
  q2: { value: true },
  q3: { value: ['2', '4'] },
};
const oneWrong: QuestionnaireAnswers = {
  q1: { value: '3' },
  q2: { value: true },
  q3: { value: ['2', '4'] },
};
const partialMc: QuestionnaireAnswers = {
  q1: { value: '4' },
  q2: { value: true },
  q3: { value: ['2'] }, // partial multiple-choice: all-or-nothing => 0
};

// ---------------------------------------------------------------------------
// 1. Scorer (settled behavior preserved)
// ---------------------------------------------------------------------------
console.log('\n[scorer]');
{
  const r = scoreQuiz(quiz, allCorrect);
  check('all-correct scores 5/5 (100%), Passed', r !== null && r.earned === 5 && r.total === 5 && r.percent === 100 && r.passed === true, JSON.stringify(r));
  const w = scoreQuiz(quiz, oneWrong);
  check('wrong q1 scores 3/5 (60%), Failed', w !== null && w.earned === 3 && w.total === 5 && w.percent === 60 && w.passed === false, JSON.stringify(w));
  const p = scoreQuiz(quiz, partialMc);
  check('partial multiple-choice is all-or-nothing (0 pts for q3)', p !== null && p.earned === 3 && p.perQuestion.find((x) => x.questionId === 'q3')?.earned === 0, JSON.stringify(p));
  check('non-quiz questionnaire scores null', scoreQuiz(nonQuiz, allCorrect) === null);
  check('conditionally-hidden q4 excluded from total', r !== null && !r.perQuestion.some((x) => x.questionId === 'q4'));
  check('unscored text q5 excluded from total', r !== null && !r.perQuestion.some((x) => x.questionId === 'q5'));
  check('per-question check: q1 correct with explanation', (() => {
    const s = scoreQuestion(quiz.sections[0].questions[0], { value: '4' });
    return s.correct && s.earned === 2 && s.explanation === '2 + 2 = 4.';
  })());
  check('per-question check: q1 wrong shows correct label 4', (() => {
    const s = scoreQuestion(quiz.sections[0].questions[0], { value: '3' });
    return !s.correct && s.earned === 0 && s.correctLabels.join(',') === '4';
  })());
  check('isScorableQuestion: text question is not scorable', !isScorableQuestion(quiz.sections[0].questions[4]));
  check('isScorableQuestion: single_choice with key is scorable', isScorableQuestion(quiz.sections[0].questions[0]));
}

// ---------------------------------------------------------------------------
// 2. localStorage progress helpers
// ---------------------------------------------------------------------------
console.log('\n[quizLocalStorage]');
{
  const key = getQuizProgressKey('q_test', 'proj_1');
  check('key contains questionnaire + project ids', key.includes('q_test') && key.includes('proj_1'), key);
  check('key sanitizes unsafe chars', getQuizProgressKey('q a/b', 'p:x') === 'reqforge_quiz_progress_q_a_b_p_x');
  check('load of missing key returns null', loadQuizProgress(key) === null);
  saveQuizProgress(key, { answers: allCorrect, mode: 'one', oneIndex: 2, updatedAt: '' });
  const loaded = loadQuizProgress(key);
  check('save/load round-trips answers + mode + index', !!loaded && loaded.mode === 'one' && loaded.oneIndex === 2 && loaded.answers.q1?.value === '4');
  mergeQuizProgress(key, { answers: oneWrong });
  const merged = loadQuizProgress(key);
  check('merge updates answers but keeps mode + index', !!merged && merged.mode === 'one' && merged.oneIndex === 2 && merged.answers.q1?.value === '3');
  clearQuizProgress(key);
  check('clear removes progress', loadQuizProgress(key) === null);
  store.set(key, '{not json');
  check('corrupt stored JSON loads as null', loadQuizProgress(key) === null);
  store.delete(key);
}

// ---------------------------------------------------------------------------
// 3. Importer / validation round-trip
// ---------------------------------------------------------------------------
console.log('\n[importer]');
{
  const imported = importQuestionnaireFromJson(sampleQuizJson);
  check('sample quiz JSON imports with quiz=true', imported.quiz === true);
  check('imported quiz keeps passMark 70 + display flags', imported.passMark === 70 && imported.showScoreOnSubmit === true && imported.showCorrectAnswers === true);
  check('imported q1 carries correct option + points + explanation', (() => {
    const q = imported.sections[0].questions[0];
    return q.points === 2 && q.explanation === '2 + 2 = 4.' && q.options?.some((o) => o.value === '4' && o.correct === true) === true;
  })());
  check('imported quiz scores 3/3 on all-correct', (() => {
    const r = scoreQuiz(imported, { q1: { value: '4' }, q2: { value: true } });
    return r !== null && r.earned === 3 && r.total === 3 && r.passed === true;
  })());
  const exported = exportQuestionnaireToJsonTemplate(imported);
  check('export round-trip keeps quiz flag', JSON.stringify(exported).includes('"quiz": true') || JSON.stringify(exported).includes('"quiz":true'));
  const plain = importQuestionnaireFromJson({ questionnaire: { title: 'Req', sections: [{ section_title: 'S', questions: [{ question_id: 'a', question: 'Q?', type: 'text' }] }] } });
  check('non-quiz JSON imports without quiz flag', plain.quiz !== true);
  const badQuiz = JSON.parse(JSON.stringify(sampleQuizJson));
  badQuiz.questionnaire.sections[0].questions[0].options.forEach((o: any) => delete o.correct);
  const v = validateQuestionnaireJson(badQuiz);
  check('quiz question with no correct option fails validation', v.valid === false, JSON.stringify(v.errors?.slice(0, 1)));
  const pub = validateQuestionnaireForPublish(imported);
  check('imported sample quiz passes publish validation', pub.valid === true, JSON.stringify(pub.errors?.slice(0, 2)));
}

// ---------------------------------------------------------------------------
// 4. Static audit — no Firestore writes on any quiz path
// ---------------------------------------------------------------------------
console.log('\n[static audit: anonymity]');
{
  const app = src('src/App.tsx');
  const portal = src('src/components/public/PublicFormPortal.tsx');
  const form = src('src/components/QuestionnaireForm.tsx');

  function guardBeforeSave(code: string, fnName: string, saveFn: string): boolean {
    const fnIdx = code.indexOf(fnName);
    if (fnIdx < 0) return false;
    const body = code.slice(fnIdx);
    // Earliest quiz guard in this function (either `?.` or direct access).
    const candidates = [
      body.indexOf('questionnaire?.quiz === true'),
      body.indexOf('questionnaire.quiz === true'),
    ].filter((i) => i >= 0);
    if (candidates.length === 0) return false;
    const guard = Math.min(...candidates);
    // The guard block must end with a return before any Firestore write.
    const ret = body.indexOf('return', guard);
    const save = body.indexOf(saveFn, guard);
    return guard >= 0 && ret > guard && save > ret;
  }

  check('App handleSubmit: quiz branch returns before saveQuestionnaireSubmission', guardBeforeSave(app, 'const handleSubmit', 'saveQuestionnaireSubmission('));
  check('App handleSubmit: non-quiz path still saves (regression)', app.includes('saveQuestionnaireSubmission({'));
  check('App handleSaveDraft: quiz branch returns before saveQuestionnaireDraft', guardBeforeSave(app, 'const handleSaveDraft', 'saveQuestionnaireDraft('));
  check('Portal handleSubmit: quiz branch returns before saveQuestionnaireSubmission', guardBeforeSave(portal, 'const handleSubmit', 'saveQuestionnaireSubmission('));
  check('Portal handleSaveDraft: quiz branch returns before saveQuestionnaireDraft', guardBeforeSave(portal, 'const handleSaveDraft', 'saveQuestionnaireDraft('));
  check('Portal skips server draft restore for quizzes', portal.includes('if (!q.quiz && session!.projectId'));
  check('Form draft-restore effect skips Firestore for quizzes', form.includes('if (isQuiz) {') && form.indexOf('if (isQuiz) {') < form.indexOf('fetchDraftSubmission('));
  check('Form quiz submit clears local progress (no server write)', form.includes('clearQuizProgress(quizProgressKey)') && form.includes('if (isQuiz) {'));
  check('Form never calls saveQuestionnaireSubmission', !form.includes('saveQuestionnaireSubmission'));
  check('Form persists quiz progress via localStorage helper', form.includes('saveQuizProgress(quizProgressKey'));
  check('SuccessView hides Firestore record card for quizzes', src('src/components/SuccessView.tsx').includes('{!isQuiz && ('));
  check('SuccessView quiz copy says anonymous, not saved', src('src/components/SuccessView.tsx').includes('completely anonymous'));
  check('ReviewSummary has quiz mode (no contact fields / Firestore copy)', src('src/components/ReviewSummary.tsx').includes('isQuiz') && src('src/components/ReviewSummary.tsx').includes('Submit Quiz & See Score'));
}

// ---------------------------------------------------------------------------
// 5. Answer modes present in the form
// ---------------------------------------------------------------------------
console.log('\n[answer modes]');
{
  const form = src('src/components/QuestionnaireForm.tsx');
  check('mode picker offers whole-form option', form.includes('Answer all, then see your score'));
  check('mode picker offers one-at-a-time option', form.includes('One question at a time'));
  check('one-at-a-time has Check answer button', form.includes('Check answer'));
  check('one-at-a-time ends with See my score', form.includes('See my score'));
  check('one-at-a-time shows progress (Question N of M)', form.includes('Question ${safeOneIndex + 1} of ${visibleQuizQuestions.length}'));
  check('privacy note visible on quiz form', form.includes('Anonymous quiz — nothing is saved'));
  check('one-at-a-time uses per-question scorer', form.includes('scoreQuestion(oneQuestion'));
  check('one-at-a-time locks after check (feedback flag)', form.includes('showQuizFeedback={oneChecked}'));
  check('mode choice persisted in local progress', form.includes('mode: quizMode'));
}

// ---------------------------------------------------------------------------
// 6. Separation (admin)
// ---------------------------------------------------------------------------
console.log('\n[separation]');
{
  const panel = src('src/components/AdminPanel.tsx');
  const view = src('src/components/management/QuestionnairesView.tsx');
  check('AdminPanel has a Quizzes tab', panel.includes("'quizzes'") && panel.includes("label: 'Quizzes'"));
  check('AdminPanel renders QuizzesView variant="quizzes"', panel.includes('variant="quizzes"'));
  check('AdminPanel questionnaires tab excludes quizzes', panel.includes('requirementQuestionnaires'));
  check('QuestionnairesView accepts a variant prop', view.includes("variant?: 'questionnaires' | 'quizzes'"));
  check('QuestionnairesView filters list by variant', view.includes('matchesVariant'));
  check('Quizzes section creates blank quizzes in quiz mode', view.includes("title: 'New Quiz'") && view.includes('quiz: true,'));
  check('Quizzes JSON import forces quiz mode', view.includes('quiz: true,') && view.includes('showScoreOnSubmit: imported.showScoreOnSubmit ?? true'));
  check('Quizzes section copies the quiz template, not the canonical one', view.includes('REQFORGE_QUIZ_TEMPLATE_JSON'));
}

// ---------------------------------------------------------------------------
// 7. Dropdown disambiguation
// ---------------------------------------------------------------------------
console.log('\n[dropdown labels]');
{
  check('same title + different dates => different labels', (() => {
    const a = formatQuestionnaireOptionLabel({ title: 'General Knowledge Quiz', version: 1, createdAt: '2026-11-19T10:00:00.000Z' });
    const b = formatQuestionnaireOptionLabel({ title: 'General Knowledge Quiz', version: 1, createdAt: '2026-11-18T10:00:00.000Z' });
    return a !== b && a.includes('19 Nov 2026') && b.includes('18 Nov 2026');
  })());
  check('label carries title + version + date', formatQuestionnaireOptionLabel({ title: 'Q', version: 2, createdAt: '2026-01-05T00:00:00.000Z' }) === 'Q (v2 · 5 Jan 2026)');
  check('missing date degrades gracefully', formatQuestionnaireOptionLabel({ title: 'Q', version: 1 }).includes('no date'));
  for (const f of ['src/components/management/ProjectsView.tsx', 'src/components/management/PublicFormsView.tsx', 'src/components/management/SubmissionsView.tsx']) {
    const code = src(f);
    check(`${f}: no bare title/version options remain`, !code.includes('{q.title} (v{q.version})'));
    check(`${f}: uses formatQuestionnaireOptionLabel`, code.includes('formatQuestionnaireOptionLabel(q)'));
  }
}

// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) {
  console.log('Failures:', failures.join(', '));
  process.exit(1);
}
