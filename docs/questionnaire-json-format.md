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
           ├── options (array of strings or {label, value} objects, for choice types)
           ├── allow_other (boolean, optional, default: false)
           ├── allow_none (boolean, optional, default: false)
           ├── unit (string, optional, for number type)
           ├── min (number, optional, for number type)
           ├── max (number, optional, for number type)
           ├── min_length (number, optional, for text/textarea)
           ├── max_length (number, optional, for text/textarea)
           ├── true (string, optional, for yes_no custom label)
           ├── false (string, optional, for yes_no custom label)
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

Error messages clearly pinpoint the section, question, and issue:
> `Section 2 ("Technical Scope") -> Question 3 ("pos_type"): Single choice questions require at least 2 options (e.g. "options": ["Option 1", "Option 2"]).`
