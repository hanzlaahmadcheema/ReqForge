# Universal JSON Questionnaire Format Specification (V2)

This document defines the universal JSON template specification for creating ReqForge questionnaires without writing any frontend code.

The blank, reusable template is located at:
[`docs/questionnaire-template.json`](file:///home/hanzlaahmad/PersonalProjects/questionnaire/docs/questionnaire-template.json)

---

## 1. Document Hierarchy (V2 Canonical)

```text
questionnaire
 ├── title (string, required)
 ├── description (string, optional)
 ├── quiz (boolean, optional — set true to make this a scored quiz/assessment)
 ├── show_score_on_submit (boolean, optional — quiz only)
 ├── show_correct_answers (boolean, optional — quiz only)
 ├── pass_mark (number 0-100, optional — quiz only)
 └── sections (array of section objects, required)
      ├── section_title (string, required)
      ├── section_description (string, optional)
      └── questions (array of question objects, required)
           ├── question_id (string, required, unique)
           ├── question (string, required)
           ├── type (string, required)
           ├── required (boolean, optional, default: false)
           ├── placeholder (string, optional)
           ├── description (string, optional)
           ├── options (array of strings or {label, value, correct?} objects, for choice types)
           ├── allow_other (boolean, optional, default: false)
           ├── allow_none (boolean, optional, default: false)
           ├── unit (string, optional, for number type)
           ├── min (number, optional, for number type)
           ├── max (number, optional, for number type)
           ├── min_length (number, optional, for text/textarea)
           ├── max_length (number, optional, for text/textarea)
           ├── true (string, optional, for yes_no custom label)
           ├── false (string, optional, for yes_no custom label)
           ├── points (number, optional, quiz only — default 1)
           ├── explanation (string, optional, quiz only — shown after submit)
           ├── correct_answer (boolean, optional, quiz only — for yes_no)
           └── conditional (object, optional)
                ├── question_id (string, required)
                └── answer (string | boolean | number, required)
```

---

## 2. Key Definitions & Rules

### 2.1 Top-Level (`questionnaire`)

| Key | Type | Required | Description |
|---|---|---|---|
| `title` | `string` | **Yes** | The public display title of the questionnaire (e.g., "ERP System Requirements"). |
| `description` | `string` | No | A high-level description or instructions for respondents. Defaults to empty string. |
| `sections` | `array` | **Yes** | Array of section objects. Must contain at least one section. |
| `quiz` | `boolean` | No | Set `true` to make this questionnaire a scored quiz/assessment (see Section 4.5). Non-quiz questionnaires behave exactly as before. |
| `show_score_on_submit` | `boolean` | No | Quiz only. When `true` (default for quizzes), the respondent sees their score right after submitting. |
| `show_correct_answers` | `boolean` | No | Quiz only. When `true` (default for quizzes), the respondent sees per-question correct/incorrect marking and explanations. |
| `pass_mark` | `number` | No | Quiz only. Pass threshold as a percentage (0–100). When set, the result shows Passed/Failed; when omitted, no pass/fail is shown. |
| `submissions_enabled` | `boolean` | No | Whether this form accepts submissions. Defaults to `true` for requirements questionnaires and `false` for quizzes. When `false` on a requirements questionnaire, respondents see "Submissions Closed" and nothing is saved. When `false` on a quiz, the quiz is anonymous (see Section 4.5). The admin's master switch in Submissions can close every form at once regardless of this setting. |

---

### 2.2 Section-Level (`sections[]`)

| Key | Type | Required | Description |
|---|---|---|---|
| `section_title` | `string` | **Yes** | Display title for the section (e.g., "User Roles & Permissions"). Backwards-compatible with `title`. |
| `section_description` | `string` | No | Explanatory note or instructions for the section. Backwards-compatible with `description`. |
| `questions` | `array` | **Yes** | Array of question objects belonging to this section. Must contain at least one question. |

---

### 2.3 Question-Level (`questions[]`)

| Key | Type | Required | Applicable Types | Description |
|---|---|---|---|---|
| `question_id` | `string` | **Yes** | All types | Unique identifier for the question across the entire questionnaire (e.g., `company_name`, `target_users`). Backwards-compatible with `id`. |
| `question` | `string` | **Yes** | All types | The question prompt presented to the user. Backwards-compatible with `text` or `label`. |
| `type` | `string` | **Yes** | All types | Input control type (see Section 3). |
| `required` | `boolean` | No | All types | Whether an answer must be provided before submitting (default: `false`). |
| `placeholder` | `string` | No | `text`, `textarea`, `email`, `phone`, `url`, `number` | Guidance ghost text inside the input field. Backwards-compatible with `short_answer`. |
| `description` | `string` | No | All types | Explanatory helper text displayed below the question title. Backwards-compatible with `helper_text`. |
| `options` | `array` | No | `single_choice`, `multiple_choice` | Canonical array of choice labels or `{ label, value }` objects. |
| `allow_other` | `boolean` | No | `single_choice`, `multiple_choice` | If `true`, renders an interactive "Other (please specify)" option with text field. |
| `allow_none` | `boolean` | No | `multiple_choice` | If `true`, provides a "None of the above" clearing option. |
| `unit` | `string` | No | `number` | Display unit badge (e.g., `"users"`, `"USD"`, `"$"`, `"days"`). |
| `min` | `number` | No | `number` | Minimum numeric constraint. |
| `max` | `number` | No | `number` | Maximum numeric constraint. |
| `min_length` | `number` | No | `text`, `textarea` | Minimum character length constraint. |
| `max_length` | `number` | No | `text`, `textarea` | Maximum character length constraint. |
| `true` | `string` | No | `yes_no` | Custom label for affirmative choice (defaults to `"Yes"`). |
| `false` | `string` | No | `yes_no` | Custom label for negative choice (defaults to `"No"`). |
| `points` | `number` | No | `single_choice`, `multiple_choice`, `yes_no` (quiz only) | Points awarded for a correct answer. Defaults to `1`. Must be `>= 0`. |
| `explanation` | `string` | No | `single_choice`, `multiple_choice`, `yes_no` (quiz only) | Explanation shown to the respondent after submitting. |
| `correct_answer` | `boolean` | No | `yes_no` (quiz only) | The correct answer for a quiz yes/no question (`true` = "Yes" is correct). Required for quiz `yes_no` questions. |
| `conditional` | `object` | No | All types | Conditional display rule (see Section 5). |

---

## 3. Supported Question Types (10 Types)

| Type Name | Accepted Aliases | Input Description | Required Configuration |
|---|---|---|---|
| `text` | `short_text` | Single-line text input | None (`placeholder` optional) |
| `textarea` | `long_text` | Multi-line expandable text area | None (`placeholder` optional) |
| `email` | — | Validated email address input with mail virtual keyboard | None (`placeholder` optional) |
| `phone` | `tel` | Validated phone number input with numeric telephone keypad | None (`placeholder` optional) |
| `url` | — | Validated web URL (e.g. repos, design links, staging) | None (`placeholder` optional) |
| `single_choice` | `radio` | Single-select radio button group | At least 2 options in `options: []` |
| `multiple_choice` | `checkbox` | Multi-select checkboxes | At least 1 option in `options: []` |
| `yes_no` | — | Two-state toggle / binary choice | Optional `true` and `false` labels |
| `number` | — | Numeric value input with unit and min/max bounds | None (`unit`, `min`, `max` optional) |
| `date` | — | Calendar date picker input | None |

> [!WARNING]
> **Disallowed Types:**
> The `rating` question type is intentionally not supported in software requirements discovery and will fail validation during import.

> [!NOTE]
> **Quiz / Assessment Mode:**
> Only `single_choice`, `multiple_choice`, and `yes_no` questions can be scored. Set `"quiz": true` at the questionnaire level (see Section 4.5). All other question types in a quiz are shown but never count toward the score.

---

## 4. Choice Options & Metadata (V2 Canonical)

### 4.1 Single Choice (`options: []`)
For single-choice questions, provide an array of strings:

```json
{
  "question_id": "target_users",
  "question": "Who are the intended primary users?",
  "type": "single_choice",
  "required": true,
  "options": [
    "Internal employees",
    "External customers",
    "Business partners",
    "Both internal and external users"
  ],
  "allow_other": true
}
```

- **Clean Arrays:** Standard JSON arrays replace legacy numbered keys (`option_1..N`).
- **Other Support:** Setting `"allow_other": true` automatically renders a dynamic "Other (please specify)" text field.
- **Slug Generation:** The importer automatically generates URL-safe unique values and labels:
  - `"Internal employees"` $\rightarrow$ `{ "value": "internal_employees", "label": "Internal employees" }`

### 4.2 Multiple Choice (`options: []`)
For multiple-choice questions, provide an array of choices:

```json
{
  "question_id": "integrations",
  "question": "Which integrations are required?",
  "type": "multiple_choice",
  "required": false,
  "options": [
    "Payment Gateway",
    "CRM",
    "Accounting / ERP",
    "Messaging"
  ],
  "allow_other": true
}
```

### 4.3 Yes / No Custom Labels (`true`, `false`)
For `yes_no` questions, provide optional custom labels for affirmative and negative choices:

```json
{
  "question_id": "requires_auth",
  "question": "Does your application require user authentication?",
  "type": "yes_no",
  "true": "Yes, multi-role authentication required",
  "false": "No, public access only"
}
```

If `true` or `false` is omitted, standard labels `"Yes"` and `"No"` are used.

### 4.4 Backward Compatibility with V1 Formats
The importer maintains **100% backward compatibility** with legacy V1 questionnaires. If a historical JSON file contains legacy keys:
- `option_1` ... `option_N` $\rightarrow$ mapped to options array
- `check_1` ... `check_N` $\rightarrow$ mapped to options array
- `short_answer` $\rightarrow$ mapped to `placeholder`
- `radio`, `short_text`, `long_text`, `checkbox` $\rightarrow$ mapped to standard types

Existing stored questionnaires and historical JSON files continue to work without modification.

### 4.5 Quiz / Assessment Mode
Set `"quiz": true` at the questionnaire level to turn a questionnaire into a scored quiz or assessment. The respondent sees their score (earned/total, percentage, and Passed/Failed when a `pass_mark` is set) immediately after submitting, plus per-question correct/incorrect marking and explanations. Drafts are never scored — the score is computed at submit time only.

**Answer modes:** at the start of a quiz the respondent chooses how to begin — either answer the whole form at once and see the score after submitting, or answer one question at a time and see instantly whether each answer is right (with the explanation) before moving to the next. A third choice, **Study mode**, shows every question with its correct answer and explanation before any attempt is made — no answering, no score, just reading through the answer key; from there the respondent can go back and attempt the quiz in either of the other two modes. Study mode is never saved anywhere (not even in the browser's local storage). The choice is theirs; the two attempt modes use the same scoring rules below.

**Anonymity — quizzes are anonymous unless submissions are turned on for them:** by default (`"submissions_enabled": false`, or omitted on a quiz) quiz responses are never saved to the database — no submissions, no drafts, no mirrors. The score is calculated in the respondent's browser only, and the only place anything is kept is that browser's local storage (so a refresh can resume progress). The quiz form says this plainly, so respondents know they are anonymous. Admins do **not** see quiz scores or answers anywhere — there is nothing to list, because nothing was ever sent. When the owner turns submissions **on** for a quiz (per-form "Accept submissions" toggle in the Quizzes list, or `"submissions_enabled": true` in JSON), the quiz submit path saves the attempt to Firestore with its score fields, it appears in admin Submissions with its Quiz Score, and the form's copy changes to say answers and scores are saved — it never claims anonymity while submissions are on. Requirements questionnaires are unaffected by the quiz default: they still save submissions and drafts exactly as before (unless their own toggle is off — see below).

**Progress kept in the browser:** a refresh resumes exactly where the respondent left off — answers, the chosen answer mode, and the current question. In one-at-a-time mode a checked question keeps its correct/incorrect feedback and explanation (the answer stays locked). A finished quiz keeps its score screen on refresh, with a "Take the quiz again" action to start over. Reset (with a confirmation dialog) clears all answers and the saved progress and returns to the mode choice.

**Submission controls (`submissions_enabled` + master switch):** every form has an "Accept submissions" toggle — in the admin's Questionnaires / Quizzes lists (a Submissions On/Off badge that is also a click-to-flip toggle), in the detail view, and in the builder; it can also be set in JSON as `"submissions_enabled": true/false`. Defaults preserve current behaviour: requirements questionnaires accept submissions, quizzes do not (anonymous). A second, global master switch — "Submissions enabled for all forms" at the top of the Submissions view — closes submissions for **every** form at once; when it is on, each form's own setting applies. When a form is closed, respondents see "Submissions Closed — This form is no longer accepting responses" instead of the form, and nothing is saved (the check is re-run at submit time too, so a form closed mid-attempt cannot save). One exception: a quiz whose own toggle is off is not "closed" — it runs anonymously, exactly as before — only the master switch closes a quiz entirely, and then its Study mode stays readable ("Study the answers instead") because study mode never collects anything. The master switch persists in the Firestore `settings/global` document; the Firestore rules for the `settings` collection must be deployed (`firebase deploy --only firestore:rules`) for the switch to save — until then reads fail open (submissions on) and a failed save is shown in the admin instead of pretending it worked.

**Shuffling (attempt modes only):** when an attempt starts, the questions are shuffled across the WHOLE quiz into one flat sequence — not in section order, and section grouping is not shown while attempting. The options inside each question are shuffled too (whole option objects, so the correct answer stays attached to its option), including yes/no, whose two positions may swap. Each new attempt deals a fresh random order. During an attempt a **Shuffle** button re-deals the questions and the options again on demand; answers and checked feedback travel with their questions, so nothing is lost — in one-at-a-time mode the attempt resumes at the first unanswered question in the new order (or stays on the last question when everything is answered). The shuffled order is kept in the browser's local storage with the rest of the progress, so a refresh keeps the same order instead of dealing a new one. Study mode is never shuffled: it keeps the original question order and section grouping so the answer key reads in order.

```json
{
  "questionnaire": {
    "title": "General Knowledge Quiz",
    "quiz": true,
    "show_score_on_submit": true,
    "show_correct_answers": true,
    "pass_mark": 70,
    "submissions_enabled": false,
    "sections": [
      {
        "section_title": "Section 1",
        "questions": [
          {
            "question_id": "q1",
            "question": "What is 2 + 2?",
            "type": "single_choice",
            "required": true,
            "points": 2,
            "options": [
              { "label": "3", "value": "3" },
              { "label": "4", "value": "4", "correct": true },
              { "label": "5", "value": "5" }
            ],
            "explanation": "2 + 2 = 4."
          },
          {
            "question_id": "q2",
            "question": "Is the sky blue?",
            "type": "yes_no",
            "points": 1,
            "correct_answer": true
          }
        ]
      }
    ]
  }
}
```

**Scoring rules:**
- Mark correct options with `"correct": true` on option objects. Plain string options are never correct.
- `single_choice`: exactly one option must be marked correct. `multiple_choice`: at least one option must be marked correct (several allowed — scored **all-or-nothing**: full points only when the selected set exactly matches the correct set).
- `yes_no` questions cannot use option-level `correct` (their options are derived from the `true`/`false` labels), so they use question-level `"correct_answer": true/false`.
- `points` defaults to `1` when omitted. Questions of other types (`text`, `number`, `date`, etc.) are shown but never scored.
- Conditionally-hidden questions (see Section 5) are excluded from the total.
- Quiz questionnaires are excluded from the AI requirements/gap analysis.
- Quizzes live in their own **Quizzes** section in the admin, separate from requirements questionnaires — they never mix in one list.
- Quiz answers are anonymous by default (see above): no database writes of any kind; local storage only. When submissions are turned on for a quiz, answers and scores are saved to Firestore and appear in admin Submissions.

---

## 5. Conditional Questions

To display a question only when a preceding question matches a specific answer, add the `conditional` block:

```json
{
  "question_id": "auth_methods",
  "question": "Which authentication methods should be supported?",
  "type": "multiple_choice",
  "options": [
    "Email & Password",
    "Google Single Sign-On (SSO)",
    "Microsoft Azure AD / SAML",
    "Magic Link / Passwordless"
  ],
  "conditional": {
    "question_id": "requires_auth",
    "answer": "Yes, multi-role authentication required"
  }
}
```

### Conditional Matching Behavior:
- **`question_id`**: The `question_id` of the referenced dependency question. Must exist earlier in the questionnaire.
- **`answer`**: The expected value or option label that triggers visibility:
  - For `yes_no`: Matches boolean `true`/`false`, affirmative labels (`"yes"`, `"true"`), or custom `true`/`false` labels.
  - For `single_choice`: Matches either the option label or generated option value.
  - For `multiple_choice`: Question is shown if the selected array contains the expected answer.

---

## 6. Validation Rules

The application validates the JSON template before importing:
1. Root must contain a `questionnaire` object.
2. `questionnaire.title` must be a non-empty string.
3. `questionnaire.sections` must contain at least one valid section.
4. Each section must have a non-empty `section_title` and at least one question.
5. Each question must have a non-empty `question_id`, `question` text, and valid `type`.
6. `type` must be one of the supported types (`text`, `textarea`, `email`, `phone`, `url`, `single_choice`, `multiple_choice`, `yes_no`, `number`, `date`).
7. All `question_id` values must be unique across the questionnaire.
8. Single-choice questions must have at least two options.
9. Multiple-choice questions must have at least one option.
10. If `conditional` is defined, its `question_id` must reference an existing question, and cannot reference itself.
11. `pass_mark`, when provided, must be a percentage between 0 and 100.
12. `points`, when provided, must be a number `>= 0`.
13. In a quiz (`"quiz": true`), every `single_choice` question must have exactly one option marked `"correct": true`, and every `multiple_choice` question must have at least one option marked `"correct": true`. A quiz question with no correct option fails validation.
14. In a quiz, every `yes_no` question must specify `"correct_answer": true` or `false`.
15. `submissions_enabled`, when provided, must be a boolean. It defaults to `true` for requirements questionnaires and `false` for quizzes. When `false` on a requirements questionnaire, the form is closed ("Submissions Closed") and saves nothing; when `false` on a quiz, the quiz is anonymous. The admin master switch (Submissions view) closes every form at once regardless of this field — only the master switch can close a quiz entirely.

Error messages clearly pinpoint the section, question, and issue:
> `Section 2 ("Technical Scope") -> Question 3 ("pos_type"): Single choice questions require at least 2 options (e.g. "options": ["Option 1", "Option 2"]).`
