/**
 * Local verification for the quiz batch:
 *  1. separate Quizzes section (admin),
 *  2. respondent answer modes (whole form / one at a time),
 *  3. anonymous quizzes (no Firestore writes; localStorage only),
 *  4. questionnaire dropdown disambiguation,
 *  5. quiz progress-saving gaps fixed: checked state survives refresh,
 *     finished score screen survives refresh, Reset works (in-app confirm).
 *  6. study/review mode (third answer mode: read all correct answers
 *     before attempting; no score, no persistence).
 *  7. shuffling in the two attempt modes (questions shuffled across the
 *     whole quiz + options shuffled inside each question, Shuffle button
 *     re-deals on demand, order persisted in localStorage; study mode and
 *     requirements questionnaires untouched).
 *  8. submission on/off controls: per-form `submissions_enabled` (JSON) /
 *     `submissionsEnabled` toggle (defaults: requirements ON, quizzes OFF),
 *     global master switch (OFF closes everything), closed-form message
 *     on both public flows, quiz-with-submissions-on saves with its score
 *     and shows non-anonymous copy, quiz-with-submissions-off stays
 *     anonymous, requirements regression.
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
  saveQuizProgressState,
  clearCompletedQuizResult,
  mergeQuizProgress,
  clearQuizProgress,
} from '../src/lib/quizLocalStorage';
import { formatQuestionnaireOptionLabel } from '../src/lib/questionnaireService';
import {
  shuffleArray,
  dealQuizShuffle,
  normalizeQuestionOrder,
  normalizeOptionOrder,
  optionValuesForQuestion,
  orderQuestions,
  withShuffledOptions,
} from '../src/lib/quizShuffle';
import {
  importQuestionnaireFromJson,
  exportQuestionnaireToJsonTemplate,
  validateQuestionnaireJson,
} from '../src/lib/questionnaireJsonImporter';
import { validateQuestionnaireForPublish } from '../src/lib/questionnaireValidation';
import {
  defaultSubmissionsEnabled,
  isSubmissionsOpen,
  isFormOpen,
} from '../src/lib/submissionSettings';
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
  saveQuizProgress(key, { answers: allCorrect, mode: 'one', oneIndex: 2, checked: {}, completedResult: null, completedAt: null, updatedAt: '' });
  const loaded = loadQuizProgress(key);
  check('save/load round-trips answers + mode + index', !!loaded && loaded.mode === 'one' && loaded.oneIndex === 2 && loaded.answers.q1?.value === '4');
  check('fresh progress defaults checked empty + no completed result', !!loaded && Object.keys(loaded.checked).length === 0 && loaded.completedResult === null && loaded.completedAt === null);
  mergeQuizProgress(key, { answers: oneWrong });
  const merged = loadQuizProgress(key);
  check('merge updates answers but keeps mode + index', !!merged && merged.mode === 'one' && merged.oneIndex === 2 && merged.answers.q1?.value === '3');
  check('merge keeps checked + completed result when updating answers', (() => {
    const r1 = scoreQuestion(quiz.sections[0].questions[0], { value: '4' });
    const done = scoreQuiz(quiz, allCorrect)!;
    saveQuizProgress(key, { answers: allCorrect, mode: 'one', oneIndex: 1, checked: { q1: r1 }, completedResult: done, completedAt: '2026-11-19T00:00:00.000Z', updatedAt: '' });
    mergeQuizProgress(key, { answers: oneWrong });
    const m = loadQuizProgress(key);
    return !!m && m.checked.q1?.correct === true && m.checked.q1?.earned === 2 && m.completedResult?.earned === 5 && m.completedResult?.passed === true;
  })());
  check('checked-state round-trip: q1 check result survives save/load', (() => {
    const r1 = scoreQuestion(quiz.sections[0].questions[0], { value: '4' });
    saveQuizProgress(key, { answers: allCorrect, mode: 'one', oneIndex: 1, checked: { q1: r1 }, completedResult: null, completedAt: null, updatedAt: '' });
    const l = loadQuizProgress(key);
    return !!l && l.checked.q1?.correct === true && l.checked.q1?.earned === 2 && l.checked.q1?.points === 2 && l.checked.q1?.explanation === '2 + 2 = 4.';
  })());
  check('completed-result round-trip: score + review survive save/load', (() => {
    const done = scoreQuiz(quiz, allCorrect)!;
    saveQuizProgress(key, { answers: allCorrect, mode: 'one', oneIndex: 4, checked: {}, completedResult: done, completedAt: '2026-11-19T00:00:00.000Z', updatedAt: '' });
    const l = loadQuizProgress(key);
    return !!l && l.completedResult?.earned === 5 && l.completedResult?.total === 5 && l.completedResult?.percent === 100 && l.completedResult?.passed === true && l.completedResult?.perQuestion.length === 3 && l.completedAt === '2026-11-19T00:00:00.000Z';
  })());
  check('old-format progress (no checked/completed fields) loads with defaults', (() => {
    store.set(key, JSON.stringify({ answers: allCorrect, mode: 'one', oneIndex: 1, updatedAt: '' }));
    const l = loadQuizProgress(key);
    return !!l && Object.keys(l.checked).length === 0 && l.completedResult === null && l.completedAt === null;
  })());
  check('corrupt checked entries are dropped, valid ones kept', (() => {
    const r1 = scoreQuestion(quiz.sections[0].questions[0], { value: '4' });
    store.set(key, JSON.stringify({ answers: {}, mode: 'one', oneIndex: 0, checked: { q1: r1, q2: 'garbage', q3: { correct: 'yes' } }, completedResult: null, completedAt: null, updatedAt: '' }));
    const l = loadQuizProgress(key);
    return !!l && Object.keys(l.checked).length === 1 && l.checked.q1?.correct === true;
  })());
  check('corrupt completed result loads as null', (() => {
    store.set(key, JSON.stringify({ answers: {}, mode: 'one', oneIndex: 0, checked: {}, completedResult: { earned: 'x', total: 5 }, completedAt: null, updatedAt: '' }));
    const l = loadQuizProgress(key);
    return !!l && l.completedResult === null;
  })());
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
  check('Form quiz submit persists completed result locally (no server write)', form.includes('completedResult: result') && form.includes('saveQuizProgress(quizProgressKey, {'));
  check('Form never calls saveQuestionnaireSubmission', !form.includes('saveQuestionnaireSubmission'));
  check('Form persists quiz progress via localStorage helper', form.includes('saveQuizProgress(quizProgressKey'));
  check('Form has no native window.confirm (in-app reset dialog instead)', !form.includes('window.confirm(') && form.includes('showResetConfirm'));
  // Submission controls changed this: the record card is hidden for
  // ANONYMOUS quizzes (no record exists) but shown for recorded quizzes
  // (submissions on) — see section 12 for the full matrix.
  check('SuccessView hides Firestore record card for anonymous quizzes only', src('src/components/SuccessView.tsx').includes('{(!isQuiz || submissionSaved) && ('));
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
  check('one-at-a-time shows progress (Question N of M)', form.includes('Question ${safeOneIndex + 1} of ${orderedVisibleQuizQuestions.length}'));
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
// 8. Progress-saving gaps fixed (checked state / finished result / Reset)
// ---------------------------------------------------------------------------
console.log('\n[progress-saving gaps]');
{
  const form = src('src/components/QuestionnaireForm.tsx');
  const app = src('src/App.tsx');
  const portal = src('src/components/public/PublicFormPortal.tsx');
  const success = src('src/components/SuccessView.tsx');

  // Gap 1: checked state survives refresh.
  check('checked results kept in a map (restored on load)', form.includes('checkedResults') && form.includes('restoredQuizProgress?.checked'));
  check('check handler records the result in the map', form.includes('setCheckedResults((prev) => ({ ...prev, [oneQuestion.id]: result }))'));
  check('auto-save persists the checked map', form.includes('checked: checkedResults'));
  check('checked answers are locked against later edits', form.includes('checkedResults[questionId]'));
  check('current question check state restored from the map on mount', form.includes('restoredQuizProgress.checked?.[q.id]'));

  // Gap 2: finished result survives refresh; retake clears it.
  check('submit persists the completed result locally', form.includes('completedResult: result'));
  check('App restores a completed quiz result on load', app.includes('loadQuizProgress(') && app.includes('progress?.completedResult'));
  check('Portal restores a completed quiz result on load', portal.includes('loadQuizProgress(') && portal.includes('progress?.completedResult'));
  check('App retake clears the saved quiz result', app.includes('Retake: drop the locally saved score') && app.includes('clearQuizProgress('));
  check('Portal retake clears the saved result without locking the session', portal.includes('Retake: drop the locally saved score') && portal.includes('clearQuizProgress('));
  check('score screen offers "Take the quiz again" for quizzes', success.includes('Take the quiz again'));

  // Gap 3: Reset works in both modes (in-app confirm, clears everything).
  check('Reset opens an in-app confirmation dialog', form.includes('setShowResetConfirm(true)') && form.includes('Reset this {isQuiz ?'));
  check('Reset confirm clears answers + checked map + completed result', form.includes('setCheckedResults({})') && form.includes('setCompletedQuizResult(null)'));
  check('Reset confirm clears local progress', form.includes('handleConfirmClearForm') && form.includes('clearQuizProgress(quizProgressKey)'));
}

// ---------------------------------------------------------------------------
// 9. Mount/restore sequence — finished score screen survives refresh
//    (live bug: the form's mount auto-save overwrote the stored completed
//    result with null before App/Portal's restore effect could read it,
//    because completedQuizResult was never restored into state and child
//    effects run before parent effects. The d4d42132 test only checked the
//    storage round-trip, so it passed while live failed 3x. This section
//    replays the exact save -> mount -> parent-restore sequence with the
//    real storage helpers.)
// ---------------------------------------------------------------------------
console.log('\n[mount/restore sequence: score screen survives refresh]');
{
  const key = getQuizProgressKey('q_test', 'proj_1');
  const done = scoreQuiz(quiz, allCorrect)!;
  const r1 = scoreQuestion(quiz.sections[0].questions[0], { value: '4' });

  // Step 1 — submit, exactly as QuestionnaireForm.handleSubmit does.
  saveQuizProgress(key, {
    answers: allCorrect, mode: 'one', oneIndex: 1,
    checked: { q1: r1 },
    completedResult: done,
    completedAt: '2026-11-19T00:00:00.000Z', updatedAt: '',
  });

  // Step 2 — form mount: lazy init loads the stored progress, state is
  // derived from it (FIXED: completedQuizResult comes from the restore),
  // then the mount auto-save runs exactly as the effect does.
  const restored = loadQuizProgress(key);
  const mountState = {
    answers: restored?.answers ?? {},
    mode: restored?.mode ?? null,
    oneIndex: restored?.oneIndex ?? 0,
    checked: restored?.checked ?? {},
    completedResult: restored?.completedResult ?? null, // <-- the fix (was `null`)
    completedAt: restored?.completedAt ?? null,
  };
  saveQuizProgressState(key, {
    ...mountState,
    completedResult: mountState.completedResult ?? undefined,
    completedAt: mountState.completedAt ?? undefined,
  });
  const afterMount = loadQuizProgress(key);
  check('mount auto-save does not wipe the stored completed result', !!afterMount?.completedResult && afterMount.completedResult.earned === 5 && afterMount.completedResult.passed === true, JSON.stringify(afterMount?.completedResult));
  check('mount auto-save keeps answers + checked feedback', !!afterMount && afterMount.checked.q1?.correct === true && afterMount.answers.q1?.value === '4');

  // Step 3 — parent restore (App/Portal effect): reads the stored progress
  // and decides whether to show the score screen instead of the form.
  const parentRead = loadQuizProgress(key);
  check('parent restore sees the completed result and shows the score screen', !!parentRead?.completedResult && parentRead.completedResult.earned === 5 && parentRead.completedResult.percent === 100);

  // Regression proof: the OLD mount behavior (completedQuizResult
  // unconditionally null + plain overwrite save) wipes the result. This is
  // what the d4d42132 code did — and why live refresh lost the score screen
  // while the round-trip test passed.
  saveQuizProgress(key, {
    answers: allCorrect, mode: 'one', oneIndex: 1,
    checked: { q1: r1 },
    completedResult: done,
    completedAt: '2026-11-19T00:00:00.000Z', updatedAt: '',
  });
  const oldMount = loadQuizProgress(key);
  saveQuizProgress(key, {
    answers: oldMount?.answers ?? {},
    mode: oldMount?.mode ?? null,
    oneIndex: oldMount?.oneIndex ?? 0,
    checked: oldMount?.checked ?? {},
    completedResult: null, // OLD BUG: state always initialized to null
    completedAt: null,
    updatedAt: new Date().toISOString(),
  });
  check('OLD mount behavior wipes the completed result (proves this test guards the bug)', loadQuizProgress(key)?.completedResult === null);

  // Mount with NO completed result (mid-attempt refresh) must not invent one.
  saveQuizProgress(key, {
    answers: allCorrect, mode: 'one', oneIndex: 1,
    checked: { q1: r1 },
    completedResult: null, completedAt: null, updatedAt: '',
  });
  saveQuizProgressState(key, {
    answers: allCorrect, mode: 'one', oneIndex: 1, checked: { q1: r1 },
    completedResult: undefined, completedAt: undefined,
  });
  check('mid-attempt mount does not invent a completed result', loadQuizProgress(key)?.completedResult === null);

  // Retake / mode-pick clearing still works and never resurrects.
  saveQuizProgress(key, { answers: allCorrect, mode: 'one', oneIndex: 1, checked: { q1: r1 }, completedResult: done, completedAt: '2026-11-19T00:00:00.000Z', updatedAt: '' });
  clearCompletedQuizResult(key);
  const afterPick = loadQuizProgress(key);
  check('picking a mode clears only the completed result (answers kept)', !!afterPick && afterPick.completedResult === null && afterPick.completedAt === null && afterPick.answers.q1?.value === '4' && afterPick.mode === 'one');
  check('picking a mode then mounting does not resurrect the result', (() => {
    const r = loadQuizProgress(key);
    saveQuizProgressState(key, { answers: r?.answers ?? {}, mode: r?.mode ?? null, oneIndex: r?.oneIndex ?? 0, checked: r?.checked ?? {}, completedResult: undefined, completedAt: undefined });
    return loadQuizProgress(key)?.completedResult === null;
  })());
  clearQuizProgress(key);
  check('retake clears all progress', loadQuizProgress(key) === null);

  // Static wiring: the component must use the fixed paths.
  const form = src('src/components/QuestionnaireForm.tsx');
  check('form initializes completedQuizResult from restored progress', form.includes('restoredQuizProgress?.completedResult ?? null'));
  check('form auto-save uses the merge-preserve helper', form.includes('saveQuizProgressState(quizProgressKey, {'));
  check('form never overwrites with completedResult: completedQuizResult', !form.includes('completedResult: completedQuizResult,'));
  check('mode pick clears the stored completed result', form.includes('clearCompletedQuizResult(quizProgressKey)'));
}

// ---------------------------------------------------------------------------
// 10. Study/review mode (third answer mode)
// ---------------------------------------------------------------------------
console.log('\n[study mode]');
{
  // Answer-key derivation: what study mode shows comes from the question's
  // own key. scoreQuestion with no answer exposes correctLabels +
  // explanation without implying any attempt was made.
  const q1 = quiz.sections[0].questions[0];
  const q2 = quiz.sections[0].questions[1];
  const q3 = quiz.sections[0].questions[2];
  const q5 = quiz.sections[0].questions[4];
  check('study key: q1 correct label is 4 + explanation shown', (() => {
    const s = scoreQuestion(q1, undefined);
    return s.correctLabels.join(',') === '4' && s.explanation === '2 + 2 = 4.';
  })(), JSON.stringify(scoreQuestion(q1, undefined).correctLabels));
  check('study key: q2 correct label is Yes', scoreQuestion(q2, undefined).correctLabels.join(',') === 'Yes');
  check('study key: multiple-choice q3 correct labels are 2 and 4', (() => {
    const s = scoreQuestion(q3, undefined);
    return s.correctLabels.length === 2 && s.correctLabels.includes('2') && s.correctLabels.includes('4');
  })());
  check('study key: unscored text q5 has no correct label and is not scorable', (() => {
    const s = scoreQuestion(q5, undefined);
    return s.correctLabels.length === 0 && !isScorableQuestion(q5);
  })());

  const form = src('src/components/QuestionnaireForm.tsx');
  const card = src('src/components/QuestionCard.tsx');
  check('mode picker offers study mode', form.includes('Study mode — see all correct answers') && form.includes('handlePickStudyMode'));
  check('mode picker has three options', form.includes('sm:grid-cols-3'));
  check('study view is quiz-only', form.includes('isQuiz && studyMode'));
  check('study view lists every question across all sections', form.includes('QUIZ STUDY MODE') && form.includes('sections.map((sec) =>') && form.includes('studyMode\n'));
  check('study view offers Back to modes + Attempt this quiz', form.includes('Back to modes') && form.includes('Attempt this quiz'));
  check('study view has no submit/score UI', (() => {
    const start = form.indexOf('QUIZ STUDY MODE');
    const end = form.indexOf('VIEW 2: FINAL REVIEW', start);
    const block = form.slice(start, end);
    return (
      !block.includes('handleSubmit') &&
      !block.includes('Submit Quiz') &&
      !block.includes('See my score') &&
      !block.includes('scoreQuiz(')
    );
  })());
  check('study mode is not persisted (no study field in stored progress)', (() => {
    const storage = src('src/lib/quizLocalStorage.ts');
    return (
      storage.includes("export type QuizAnswerMode = 'all' | 'one'") &&
      !storage.includes('studyMode')
    );
  })());
  check('picking study mode writes nothing (no save/clear calls)', (() => {
    const start = form.indexOf('const handlePickStudyMode');
    const end = form.indexOf('const handleExitStudyMode', start);
    const block = form.slice(start, end);
    return (
      !block.includes('saveQuizProgress') &&
      !block.includes('clearQuizProgress') &&
      !block.includes('clearCompletedQuizResult')
    );
  })());
  check('Reset exits study mode', form.includes('setStudyMode(false)'));
  check('QuestionCard supports studyMode prop', card.includes('studyMode?: boolean') && card.includes('showAnswerKey'));
  check('study mode reveals the key from the question itself', card.includes('answerKeyValues') && card.includes('.filter((o) => o.correct === true)'));
  check('study mode shows the question explanation', card.includes('showStudy && question.explanation'));
  check('study mode locks inputs', card.includes("showFeedback || showStudy ? 'pointer-events-none'"));
}

// ---------------------------------------------------------------------------
// 11. Shuffling in the two attempt modes (not study mode, not requirements)
// ---------------------------------------------------------------------------
console.log('\n[shuffle]');
{
  // Two-section fixture: proves the shuffle is flat across the whole quiz,
  // not section by section.
  const twoSectionQuiz: Questionnaire = {
    id: 'q_two',
    title: 'Two Section Quiz',
    description: '',
    version: 1,
    status: 'published',
    quiz: true,
    showScoreOnSubmit: true,
    showCorrectAnswers: true,
    passMark: 60,
    sections: [
      {
        id: 'secA',
        title: 'Section A',
        description: '',
        questions: [
          {
            id: 'a1',
            text: 'A1?',
            type: 'single_choice',
            options: [
              { label: 'A', value: 'a' },
              { label: 'B', value: 'b', correct: true },
              { label: 'C', value: 'c' },
            ],
          },
          {
            id: 'a2',
            text: 'A2?',
            type: 'single_choice',
            options: [
              { label: 'X', value: 'x', correct: true },
              { label: 'Y', value: 'y' },
            ],
          },
        ],
      },
      {
        id: 'secB',
        title: 'Section B',
        description: '',
        questions: [
          {
            id: 'b1',
            text: 'B1?',
            type: 'multiple_choice',
            options: [
              { label: '1', value: '1', correct: true },
              { label: '2', value: '2' },
              { label: '3', value: '3', correct: true },
            ],
          },
          { id: 'b2', text: 'B2?', type: 'yes_no', correctAnswer: false },
        ],
      },
    ],
  };
  const allQs = twoSectionQuiz.sections.flatMap((s) => s.questions);

  // Deterministic Fisher-Yates: random() === 0 always swaps with index 0.
  check('shuffleArray is deterministic with a fixed random source', (() => {
    const out = shuffleArray(['a', 'b', 'c', 'd'], () => 0);
    return JSON.stringify(out) === JSON.stringify(['b', 'c', 'd', 'a']);
  })());
  check('shuffleArray does not mutate its input', (() => {
    const input = ['a', 'b', 'c'];
    const copy = [...input];
    shuffleArray(input, () => 0);
    return JSON.stringify(input) === JSON.stringify(copy);
  })());
  check('shuffleArray with Math.random is a permutation (same set)', (() => {
    const out = shuffleArray(allQs.map((q) => q.id));
    const sorted = [...out].sort();
    return out.length === 4 && JSON.stringify(sorted) === JSON.stringify(['a1', 'a2', 'b1', 'b2']);
  })());

  // dealQuizShuffle: flat across sections + per-question option orders.
  const dealt = dealQuizShuffle(allQs, () => 0);
  check('dealt question order covers all questions across both sections', (() => {
    const sorted = [...dealt.questionOrder].sort();
    return JSON.stringify(sorted) === JSON.stringify(['a1', 'a2', 'b1', 'b2']);
  })(), JSON.stringify(dealt.questionOrder));
  check('dealt question order is not section order', JSON.stringify(dealt.questionOrder) !== JSON.stringify(['a1', 'a2', 'b1', 'b2']), JSON.stringify(dealt.questionOrder));
  check('dealt option orders are permutations of each question options', (() => {
    const a1 = dealt.optionOrder.a1;
    const b1 = dealt.optionOrder.b1;
    return (
      !!a1 && [...a1].sort().join(',') === 'a,b,c' &&
      !!b1 && [...b1].sort().join(',') === '1,2,3'
    );
  })(), JSON.stringify(dealt.optionOrder));
  check('yes_no question gets an option order too (may swap)', (() => {
    const b2 = dealt.optionOrder.b2;
    return !!b2 && [...b2].sort().join(',') === 'false,true';
  })(), JSON.stringify(dealt.optionOrder.b2));
  check('yes_no without options defaults to the true/false pair', (() => {
    const values = optionValuesForQuestion(allQs[3]);
    return JSON.stringify(values) === JSON.stringify(['true', 'false']);
  })());
  check('yes_no display copy can put No first (synthesized pair)', (() => {
    const display = withShuffledOptions(allQs[3], ['false', 'true']);
    return (display.options || []).map((o) => o.value).join(',') === 'false,true' &&
      (display.options || [])[0].label === 'No';
  })());
  check('yes_no display copy keeps default labels when unshuffled', (() => {
    const display = withShuffledOptions(allQs[3], ['true', 'false']);
    return (display.options || []).map((o) => o.label).join(',') === 'Yes,No';
  })());

  // Correct flag travels with its option object through the reorder.
  check('correct flag travels with its option after reordering', (() => {
    const q = allQs[0];
    const display = withShuffledOptions(q, dealt.optionOrder[q.id]);
    const correct = (display.options || []).filter((o) => o.correct === true);
    return correct.length === 1 && correct[0].value === 'b' && correct[0].label === 'B';
  })());
  check('scoring a shuffled display copy gives the same result', (() => {
    const q = allQs[0];
    const display = withShuffledOptions(q, dealt.optionOrder[q.id]);
    const s1 = scoreQuestion(q, { value: 'b' });
    const s2 = scoreQuestion(display, { value: 'b' });
    return s1.correct && s2.correct && s1.earned === s2.earned && s2.correctLabels.join(',') === 'B';
  })());
  check('withShuffledOptions returns the same reference when order matches', (() => {
    const q = allQs[0];
    return withShuffledOptions(q, ['a', 'b', 'c']) === q;
  })());

  // orderQuestions: stored order wins; unlisted questions slot in at the
  // end in canonical order (e.g. a conditionally-hidden question that
  // becomes visible mid-attempt).
  check('orderQuestions applies a stored order', (() => {
    const out = orderQuestions(allQs, ['b2', 'a1', 'b1', 'a2']);
    return out.map((q) => q.id).join(',') === 'b2,a1,b1,a2';
  })());
  check('orderQuestions appends unlisted questions at the end (canonical)', (() => {
    const out = orderQuestions(allQs, ['b1']);
    return out.map((q) => q.id).join(',') === 'b1,a1,a2,b2';
  })());
  check('orderQuestions with no order keeps canonical order', (() => {
    const out = orderQuestions(allQs, null);
    return out.map((q) => q.id).join(',') === 'a1,a2,b1,b2';
  })());

  // Normalization: drops unknown ids/values, appends missing ones.
  check('normalizeQuestionOrder drops unknown ids and appends missing', (() => {
    const out = normalizeQuestionOrder(['b2', 'zzz', 'a1'], ['a1', 'a2', 'b1', 'b2']);
    return JSON.stringify(out) === JSON.stringify(['b2', 'a1', 'a2', 'b1']);
  })());
  check('normalizeOptionOrder drops unknown values and appends missing', (() => {
    const out = normalizeOptionOrder(['c', 'nope', 'a'], optionValuesForQuestion(allQs[0]));
    return JSON.stringify(out) === JSON.stringify(['c', 'a', 'b']);
  })());

  // Persistence: order survives save/load; old-format progress has nulls.
  const key = getQuizProgressKey('q_two', 'proj_1');
  saveQuizProgress(key, {
    answers: { a1: { value: 'b' } }, mode: 'one', oneIndex: 1,
    checked: {}, completedResult: null, completedAt: null,
    questionOrder: dealt.questionOrder, optionOrder: dealt.optionOrder,
    updatedAt: '',
  });
  const loaded = loadQuizProgress(key);
  check('shuffled order round-trips through localStorage', !!loaded &&
    JSON.stringify(loaded.questionOrder) === JSON.stringify(dealt.questionOrder) &&
    JSON.stringify(loaded.optionOrder?.a1) === JSON.stringify(dealt.optionOrder.a1),
  JSON.stringify(loaded?.questionOrder));
  check('old-format progress loads with null shuffle fields', (() => {
    store.set(key, JSON.stringify({ answers: {}, mode: 'one', oneIndex: 0, updatedAt: '' }));
    const l = loadQuizProgress(key);
    return !!l && l.questionOrder === null && l.optionOrder === null;
  })());
  check('merge-preserve save keeps a stored shuffle when state omits it', (() => {
    saveQuizProgress(key, {
      answers: {}, mode: 'one', oneIndex: 0, checked: {}, completedResult: null, completedAt: null,
      questionOrder: dealt.questionOrder, optionOrder: dealt.optionOrder, updatedAt: '',
    });
    saveQuizProgressState(key, {
      answers: { a1: { value: 'b' } }, mode: 'one', oneIndex: 1, checked: {},
      completedResult: undefined, completedAt: undefined,
    });
    const l = loadQuizProgress(key);
    return !!l && JSON.stringify(l.questionOrder) === JSON.stringify(dealt.questionOrder);
  })());

  // Reshuffle keeps answers + checked state (keyed by questionId), and the
  // one-at-a-time resume rule lands on the first unanswered question.
  check('reshuffle keeps answers and checked results (keyed by id)', (() => {
    const r1 = scoreQuestion(allQs[0], { value: 'b' });
    const before = { answers: { a1: { value: 'b' } }, checked: { a1: r1 } };
    const fresh = dealQuizShuffle(allQs, () => 0.9);
    // The respondent's stored answers/checked are untouched by re-dealing:
    // they are maps keyed by questionId, never by position.
    return (
      before.answers.a1.value === 'b' &&
      before.checked.a1.correct === true &&
      JSON.stringify([...fresh.questionOrder].sort()) === JSON.stringify(['a1', 'a2', 'b1', 'b2'])
    );
  })());
  check('resume after reshuffle lands on the first unanswered question', (() => {
    const answers: QuestionnaireAnswers = { a1: { value: 'b' }, b2: { value: false } };
    const order = ['a2', 'b1', 'a1', 'b2'];
    const ordered = orderQuestions(allQs, order);
    const firstUnanswered = ordered.findIndex((q) => {
      const a = answers[q.id];
      return !a || a.value === null || a.value === undefined || a.value === '';
    });
    return firstUnanswered === 0 && ordered[firstUnanswered].id === 'a2';
  })());
  check('resume stays on the last question when everything is answered', (() => {
    const answers: QuestionnaireAnswers = {
      a1: { value: 'b' }, a2: { value: 'x' }, b1: { value: ['1', '3'] }, b2: { value: false },
    };
    const order = ['a2', 'b1', 'a1', 'b2'];
    const ordered = orderQuestions(allQs, order);
    const firstUnanswered = ordered.findIndex((q) => {
      const a = answers[q.id];
      return !a || a.value === null || a.value === undefined || a.value === '';
    });
    const idx = firstUnanswered === -1 ? Math.max(ordered.length - 1, 0) : firstUnanswered;
    return firstUnanswered === -1 && idx === 3 && ordered[idx].id === 'b2';
  })());
  clearQuizProgress(key);

  // Static wiring.
  const form = src('src/components/QuestionnaireForm.tsx');
  const card = src('src/components/QuestionCard.tsx');
  const review = src('src/components/ReviewSummary.tsx');
  check('mode pick deals a fresh shuffle', form.includes('handlePickQuizMode') && form.includes('dealQuizShuffle('));
  check('Shuffle button exists for attempt modes (not study mode)', form.includes('handleShuffle') && form.includes('Shuffle') && form.includes("quizMode !== null && !studyMode"));
  check('Shuffle button re-deals questions and options', (() => {
    const start = form.indexOf('const handleShuffle');
    const end = form.indexOf('const handlePickStudyMode', start);
    const block = form.slice(start, end);
    return block.includes('dealQuizShuffle(') && block.includes('setQuestionOrder(') && block.includes('setOptionOrder(');
  })());
  check('reshuffle resumes at the first unanswered question', form.includes('firstUnanswered') && form.includes('Math.max(ordered.length - 1, 0)'));
  check('sectioned view is requirements-only (quiz attempts are flat)', form.includes('!isReviewStep && currentSection && !isQuiz'));
  check('quiz all-mode view is a flat shuffled list', form.includes("QUIZ 'ALL' VIEW") && form.includes('orderedVisibleQuizQuestions.map((question, idx)'));
  check('one-at-a-time uses the ordered list', form.includes('orderedVisibleQuizQuestions[safeOneIndex]'));
  check('shuffle order is auto-saved with progress', form.includes('questionOrder: questionOrder ?? undefined') && form.includes('optionOrder: optionOrder ?? undefined'));
  check('submit persists the shuffle order', form.includes('questionOrder: questionOrder ?? null'));
  check('Reset clears the shuffle order', form.includes('setQuestionOrder(null)') && form.includes('setOptionOrder(null)'));
  check('study view keeps original order (no shuffle wiring)', (() => {
    const start = form.indexOf('QUIZ STUDY MODE');
    const end = form.indexOf('VIEW 2: FINAL REVIEW', start);
    const block = form.slice(start, end);
    return block.includes('sections.map((sec)') && !block.includes('handleShuffle') && !block.includes('Shuffle');
  })());
  check('review step lists quiz questions flat in shuffled order', form.includes('flatQuestions={isQuiz ? orderedVisibleQuizQuestions : undefined}'));
  check('QuestionCard accepts displayNumber (shuffled position badge)', card.includes('displayNumber?: number') && card.includes('displayNumber ?? question.order'));
  check('QuestionCard orders yes/no buttons by the options list', card.includes('yesNoOrder') && card.includes('noIdx < yesIdx ? [false, true] : [true, false]'));
  check('ReviewSummary supports a flat shuffled summary', review.includes('flatQuestions?: Question[]') && review.includes('Summary ({flatQuestions.length} Questions)'));
  check('ReviewSummary hides the section chart for flat reviews', review.includes('{!flatQuestions && (') && review.includes('SectionCompletionChart'));
  check('non-quiz flow still uses the sectioned view + footer', form.includes('VIEW 1: ACTIVE SECTION QUESTIONS') && form.includes('{!isQuiz && (') && review.includes('Summary by Section'));
}

// ---------------------------------------------------------------------------
// 12. Submission on/off controls
// ---------------------------------------------------------------------------
console.log('\n[submission controls]');
{
  // -- Pure decision logic -------------------------------------------------
  const quizNoSetting: Questionnaire = { ...quiz };
  delete (quizNoSetting as any).submissionsEnabled;
  const quizOn: Questionnaire = { ...quiz, submissionsEnabled: true };
  const quizOff: Questionnaire = { ...quiz, submissionsEnabled: false };
  const reqNoSetting: Questionnaire = { ...nonQuiz };
  delete (reqNoSetting as any).submissionsEnabled;
  const reqOn: Questionnaire = { ...nonQuiz, submissionsEnabled: true };
  const reqOff: Questionnaire = { ...nonQuiz, submissionsEnabled: false };

  check('quiz with no setting defaults to submissions OFF (anonymous)', defaultSubmissionsEnabled(quizNoSetting) === false);
  check('requirements with no setting defaults to submissions ON', defaultSubmissionsEnabled(reqNoSetting) === true);
  check('explicit ON wins over the quiz default', defaultSubmissionsEnabled(quizOn) === true);
  check('explicit OFF wins over the requirements default', defaultSubmissionsEnabled(reqOff) === false);
  check('master OFF overrides per-form ON (requirements)', isSubmissionsOpen(reqOn, false) === false);
  check('master OFF overrides per-form ON (quiz)', isSubmissionsOpen(quizOn, false) === false);
  check('master ON + per-form ON saves (requirements)', isSubmissionsOpen(reqOn, true) === true);
  check('master ON + per-form ON saves (quiz)', isSubmissionsOpen(quizOn, true) === true);
  check('master ON + per-form OFF does not save (requirements)', isSubmissionsOpen(reqOff, true) === false);
  check('master ON + per-form OFF does not save (quiz)', isSubmissionsOpen(quizOff, true) === false);
  check('master OFF closes every form, requirements included', isFormOpen(reqOn, false) === false);
  check('master OFF closes every form, quiz included', isFormOpen(quizOff, false) === false);
  check('per-form OFF closes a requirements form', isFormOpen(reqOff, true) === false);
  check('per-form OFF does NOT close a quiz (anonymous mode stays open)', isFormOpen(quizOff, true) === true && isFormOpen(quizNoSetting, true) === true);
  check('master ON + requirements ON is open', isFormOpen(reqOn, true) === true);

  // -- Importer: submissions_enabled ---------------------------------------
  const quizJsonOn = JSON.parse(JSON.stringify(sampleQuizJson));
  quizJsonOn.questionnaire.submissions_enabled = true;
  const quizJsonOff = JSON.parse(JSON.stringify(sampleQuizJson));
  quizJsonOff.questionnaire.submissions_enabled = false;
  const reqJson: any = {
    questionnaire: {
      title: 'Req Form',
      sections: [{ section_title: 'S', questions: [{ question_id: 'a', question: 'Q?', type: 'text' }] }],
    },
  };
  const reqJsonOff = JSON.parse(JSON.stringify(reqJson));
  reqJsonOff.questionnaire.submissions_enabled = false;
  const badJson = JSON.parse(JSON.stringify(sampleQuizJson));
  badJson.questionnaire.submissions_enabled = 'yes';

  check('importer: explicit submissions_enabled true on a quiz wins', importQuestionnaireFromJson(quizJsonOn).submissionsEnabled === true);
  check('importer: explicit submissions_enabled false on a quiz wins', importQuestionnaireFromJson(quizJsonOff).submissionsEnabled === false);
  check('importer: quiz JSON without the field defaults to OFF', importQuestionnaireFromJson(sampleQuizJson).submissionsEnabled === false);
  check('importer: requirements JSON without the field defaults to ON', importQuestionnaireFromJson(reqJson).submissionsEnabled === true);
  check('importer: explicit false on requirements wins', importQuestionnaireFromJson(reqJsonOff).submissionsEnabled === false);
  check('importer: non-boolean submissions_enabled fails validation', (() => {
    const v = validateQuestionnaireJson(badJson);
    return v.valid === false && (v.errors || []).some((e) => e.includes('submissions_enabled'));
  })());
  check('export round-trip keeps submissions_enabled', (() => {
    const exported = exportQuestionnaireToJsonTemplate(importQuestionnaireFromJson(quizJsonOn));
    return JSON.stringify(exported).includes('submissions_enabled');
  })(), JSON.stringify(exportQuestionnaireToJsonTemplate(importQuestionnaireFromJson(quizJsonOn))).slice(0, 120));

  // -- localStorage: submissionDocId ----------------------------------------
  const skey = getQuizProgressKey('q_test', 'proj_sub');
  saveQuizProgress(skey, { answers: allCorrect, mode: 'one', oneIndex: 1, checked: {}, completedResult: null, completedAt: null, submissionDocId: 'draft_proj_1_abc', updatedAt: '' });
  check('submissionDocId round-trips through localStorage', loadQuizProgress(skey)?.submissionDocId === 'draft_proj_1_abc');
  mergeQuizProgress(skey, { answers: oneWrong });
  check('merge preserves a stored submissionDocId', loadQuizProgress(skey)?.submissionDocId === 'draft_proj_1_abc');
  saveQuizProgressState(skey, { answers: oneWrong, mode: 'one', oneIndex: 1, checked: {} });
  check('auto-save preserves a stored submissionDocId', loadQuizProgress(skey)?.submissionDocId === 'draft_proj_1_abc');
  clearCompletedQuizResult(skey);
  check('clearing the completed result also clears the submissionDocId', loadQuizProgress(skey)?.submissionDocId === null);
  clearQuizProgress(skey);

  // -- Static wiring: service carries the field -----------------------------
  const svc = src('src/lib/questionnaireService.ts');
  check('normalizeQuestionnaireDoc loads submissionsEnabled', svc.includes('submissionsEnabled: data.submissionsEnabled as boolean | undefined'));
  check('publish snapshot carries submissionsEnabled', svc.includes('submissionsEnabled: questionnaire.submissionsEnabled'));
  check('duplicateQuestionnaire carries submissionsEnabled', svc.includes('submissionsEnabled: source.submissionsEnabled'));

  // -- Static wiring: templates ---------------------------------------------
  const tpl = src('src/lib/aiWorkflowConstants.ts');
  check('quiz template sets submissions_enabled: false', tpl.includes('submissions_enabled: false'));
  check('canonical requirements template sets submissions_enabled: true', tpl.includes('submissions_enabled: true'));

  // -- Static wiring: App.tsx (share-link flow) ------------------------------
  const app = src('src/App.tsx');
  check('App loads the master switch with the questionnaire', app.includes('getGlobalSubmissionSettings().then((s)'));
  check('App waits for the master switch before rendering the form', app.includes('globalSubmissionsEnabled === null'));
  check('App closed card: "Submissions Closed" + exact message', app.includes('Submissions Closed') && app.includes('This form is no longer accepting responses.'));
  check('App closed card offers study mode for quizzes', app.includes('Study the answers instead') && app.includes('setStudyOnly(true)'));
  check('App re-checks the setting at submit time', app.includes('const latestGlobal = await getGlobalSubmissionSettings()') && app.includes("setSubmitError('This form is no longer accepting responses.')"));
  check('App anonymous-quiz path only when submissions are off', app.includes('questionnaire?.quiz === true && !submissionsOpen'));
  check('App recorded-quiz path merges the Firestore id into local progress', app.includes('submissionDocId: result.submissionId'));
  check('App passes submissionsOpen + studyOnly to the form', app.includes('submissionsOpen={') && app.includes('studyOnly={studyOnly}'));
  check('App passes submissionSaved to SuccessView', app.includes('submissionSaved={submittedResult.submissionSaved ?? false}'));
  check('App snapshot reconstruction prefers the live setting', app.includes('loadedQ.submissionsEnabled ?? snapshot.submissionsEnabled'));
  check('App restore uses the stored submission id when present', app.includes('progress.submissionDocId ??') && app.includes('submissionSaved: !!progress.submissionDocId'));
  check('App draft save re-checks the setting for requirements forms', app.includes('!isFormOpen(questionnaire, latestGlobal.submissionsEnabled)'));

  // -- Static wiring: PublicFormPortal.tsx (public-form flow) ----------------
  const portal = src('src/components/public/PublicFormPortal.tsx');
  check('Portal loads the master switch with the questionnaire', portal.includes('getGlobalSubmissionSettings().then((s) =>'));
  check('Portal waits for the master switch before rendering the form', portal.includes('globalSubmissionsEnabled === null'));
  check('Portal closed card: "Submissions Closed" + exact message', portal.includes('Submissions Closed') && portal.includes('This form is no longer accepting responses.'));
  check('Portal closed card offers study mode for quizzes', portal.includes('Study the answers instead') && portal.includes('setStudyOnly(true)'));
  check('Portal re-checks the setting at submit time', portal.includes('const latestGlobal = await getGlobalSubmissionSettings()') && portal.includes("setSubmitError('This form is no longer accepting responses.')"));
  check('Portal anonymous-quiz path only when submissions are off', portal.includes('questionnaire.quiz === true && !submissionsOpen'));
  check('Portal recorded-quiz path merges the Firestore id into local progress', portal.includes('submissionDocId: res.submissionId'));
  check('Portal passes submissionsOpen + studyOnly to the form', portal.includes('submissionsOpen={') && portal.includes('studyOnly={studyOnly}'));
  check('Portal passes submissionSaved to SuccessView', portal.includes('submissionSaved={submittedResult.submissionSaved ?? false}'));
  check('Portal snapshot reconstruction prefers the live setting', portal.includes('q.submissionsEnabled ?? snapshot.submissionsEnabled'));
  check('Portal footer copy reflects the real state for quizzes', portal.includes('Your answers and score are saved to the project record when you submit') && portal.includes('Anonymous quiz — nothing you answer is saved or sent anywhere'));

  // -- Static wiring: QuestionnaireForm copy + study-only ---------------------
  const form = src('src/components/QuestionnaireForm.tsx');
  check('Form takes submissionsOpen + studyOnly props', form.includes('submissionsOpen?: boolean') && form.includes('studyOnly?: boolean'));
  check('Form computes quizSavesResponses from the effective setting', form.includes('quizSavesResponses = isQuiz && effectiveSubmissionsOpen'));
  check('Form keeps the anonymous notice when submissions are off', form.includes('Anonymous quiz — nothing is saved') && form.includes('!quizSavesResponses'));
  check('Form shows the recorded notice when submissions are on', form.includes('Responses are recorded') && form.includes('Your answers and score are saved to the project record when you submit'));
  check('Form chip tooltip branches on the real state', form.includes('your submitted answers and score are saved to the project record'));
  check('Form hides Reset / Back to modes / Attempt in study-only mode', (form.match(/!studyOnly && \(/g) || []).length >= 3);
  check('Form persists the completed result only after the parent confirms the submit', (() => {
    const start = form.indexOf('const handleSubmit');
    const block = form.slice(start, start + 6000);
    const onSubmitIdx = block.indexOf('await onSubmit({');
    const gateIdx = block.indexOf('if (ok === false) return;', onSubmitIdx);
    const persistIdx = block.indexOf('setCompletedQuizResult(result);', gateIdx);
    return onSubmitIdx > 0 && gateIdx > onSubmitIdx && persistIdx > gateIdx && block.includes('only AFTER the parent');
  })());
  check('Form onSubmit contract returns false on refusal', form.includes('Promise<boolean | void>') && form.includes('if (ok === false) return;'));
  check('App handleSubmit returns false when the form is closed mid-attempt', app.includes("setSubmitError('This form is no longer accepting responses.');\n        return false;"));
  check('Portal handleSubmit returns false when the form is closed mid-attempt', portal.includes("setSubmitError('This form is no longer accepting responses.');\n        return false;"));
  check('App + Portal handleSubmit return true on success', app.includes('return true;') && portal.includes('return true;'));
  check('Form passes quizSavesResponses to ReviewSummary', form.includes('quizSavesResponses={quizSavesResponses}'));

  // -- Static wiring: ReviewSummary + SuccessView copy ------------------------
  const review = src('src/components/ReviewSummary.tsx');
  check('ReviewSummary takes quizSavesResponses', review.includes('quizSavesResponses?: boolean'));
  check('ReviewSummary review copy branches on the real state', review.includes('Your answers and score will be saved to the project record when you submit.') && review.includes('Anonymous quiz — nothing is saved or sent anywhere.'));
  const success = src('src/components/SuccessView.tsx');
  check('SuccessView takes submissionSaved', success.includes('submissionSaved?: boolean'));
  check('SuccessView shows the record card for recorded quizzes', success.includes('(!isQuiz || submissionSaved) && ('));
  check('SuccessView recorded-quiz copy says answers + score are saved', success.includes('Your answers and score have been saved to the project record.'));
  check('SuccessView anonymous-quiz copy is unchanged', success.includes('this quiz is completely anonymous'));

  // -- Static wiring: admin per-form toggle -----------------------------------
  const qview = src('src/components/management/QuestionnairesView.tsx');
  check('Questionnaires list has a Submissions column', qview.includes('<th className="py-3 px-4">Submissions</th>'));
  check('Submissions badge is a click-to-flip toggle', qview.includes('handleToggleSubmissions') && qview.includes('Submissions on — click to turn off'));
  check('Detail view has an Accept submissions switch', qview.includes('Accept submissions') && qview.includes('role="switch"'));
  check('Blank quiz defaults to submissions OFF', qview.includes('submissionsEnabled: false'));
  check('Blank requirements form defaults to submissions ON', qview.includes('submissionsEnabled: true'));
  check('JSON import forces the type default when the field is omitted', qview.includes('submissionsEnabled: imported.submissionsEnabled ?? false') && qview.includes('submissionsEnabled: imported.submissionsEnabled ?? true'));

  // -- Static wiring: builder ---------------------------------------------------
  const builder = src('src/components/management/QuestionnaireBuilder.tsx');
  check('Builder has an Accept submissions checkbox', builder.includes('Accept submissions') && builder.includes('defaultSubmissionsEnabled(questionnaire)'));
  check('Builder quiz toggle follows the type default when never set explicitly', builder.includes('submissionsEnabled: !e.target.checked'));

  // -- Static wiring: master switch in Submissions ------------------------------
  const subs = src('src/components/management/SubmissionsView.tsx');
  check('Submissions view has the master switch card', subs.includes('Submissions enabled for all forms'));
  check('Master switch loads + saves the global setting', subs.includes('getGlobalSubmissionSettings()') && subs.includes('setGlobalSubmissionSettings(next)'));
  check('Master switch reverts on save failure and shows the error', subs.includes('setGlobalEnabled(!next)') && subs.includes('Could not save the master switch'));

  // -- Static wiring: Firestore rules + docs --------------------------------------
  const rules = src('firestore.rules');
  check('Firestore rules allow public get on /settings', rules.includes('match /settings/{settingId}') && rules.includes('allow get: if isValidId(settingId);'));
  check('Firestore rules restrict /settings writes to admins', rules.includes('allow create, update: if isValidId(settingId) && isAdmin();'));
  check('Firestore rules forbid /settings list + delete', rules.includes('allow list: if false;') && rules.includes('allow delete: if false;'));
  const docs = src('docs/questionnaire-json-format.md');
  check('Docs document submissions_enabled + the master switch', docs.includes('submissions_enabled') && docs.includes('master switch'));
}

// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) {
  console.log('Failures:', failures.join(', '));
  process.exit(1);
}
