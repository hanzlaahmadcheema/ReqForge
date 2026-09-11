# Universal JSON Questionnaire Format Specification

This document defines the universal JSON template specification for creating questionnaires without writing any frontend code.

The blank, reusable template is located at:
[`docs/questionnaire-template.json`](file:///home/hanzlaahmad/PersonalProjects/questionnaire/docs/questionnaire-template.json)

---

## 1. Document Hierarchy

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
           ├── short_answer (string, optional)
           ├── option_1 ... option_N (string, optional, for single_choice)
           ├── check_1 ... check_N (string, optional, for multiple_choice)
           ├── true (string, optional, for yes_no)
           ├── false (string, optional, for yes_no)
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
| `question_id` | `string` | **Yes** | Unique identifier for the question across the entire questionnaire (e.g., `q_user_roles`, `pos_integrations`). Backwards-compatible with `id`. |
| `question` | `string` | **Yes** | The question prompt presented to the user. Backwards-compatible with `text` or `label`. |
| `type` | `string` | **Yes** | Input control type (see Section 3). |
| `required` | `boolean` | No | Whether an answer must be provided before submitting (default: `false`). |
| `short_answer` | `string` | No | `text` | Guidance placeholder or format example for short text input (e.g., "e.g., Jane Doe"). Empty string is ignored. |
| `option_1` ... `option_N` | `string` | No | `single_choice` | Selectable radio choices. Populated values become options; empty strings `""` are ignored. |
| `check_1` ... `check_N` | `string` | No | `multiple_choice` | Selectable checkbox choices. Populated values become options; empty strings `""` are ignored. |
| `true` | `string` | No | `yes_no` | Custom label for the positive/affirmative choice (defaults to "Yes"). |
| `false` | `string` | No | `yes_no` | Custom label for the negative choice (defaults to "No"). |
| `conditional` | `object` | No | All types | Conditional display rule (see Section 5). |

---

## 3. Supported Question Types

| Type Name | Accepted Aliases | Input Description | Required Option Keys |
|---|---|---|---|
| `text` | `short_text` | Single-line text input | None (`short_answer` optional placeholder) |
| `textarea` | `long_text` | Multi-line expandable text area | None |
| `single_choice` | `radio` | Single-select radio button list | At least two populated `option_1..N` |
| `multiple_choice` | `checkbox` | Multi-select checkboxes | At least one populated `check_1..N` |
| `yes_no` | — | Two-state toggle / binary choice | Optional `true` and `false` labels |
| `number` | — | Numeric value input | None |
| `date` | — | Date picker input | None |

> [!WARNING]
> **Disallowed Types:**
> The `rating` question type is intentionally not supported and will fail validation during import.

---

## 4. Option Keys & Rules

### 4.1 Single Choice (`option_1` ... `option_N`)
For single-choice questions, provide options using keys matching the pattern `option_1`, `option_2`, ..., `option_N`:

```json
{
  "question_id": "payment_gateway",
  "question": "Which payment gateway do you prefer?",
  "type": "single_choice",
  "option_1": "Stripe",
  "option_2": "PayPal",
  "option_3": "Square",
  "option_4": "",
  "option_5": ""
}
```

- **Dynamic Count:** There is no 5-option limit. You can specify `option_6`, `option_7`, etc.
- **Empty Key Rule:** Any option key with an empty string `""` is discarded and will **not** generate a blank choice.
- **Ordering:** Options are ordered numerically by their index (`1`, `2`, `3`, ...).
- **Internal Mapping:** The importer automatically generates URL-safe values and labels:
  - `"option_1": "Stripe"` $\rightarrow$ `{ "value": "stripe", "label": "Stripe" }`

### 4.2 Multiple Choice (`check_1` ... `check_N`)
For multiple-choice questions, provide choices using keys matching the pattern `check_1`, `check_2`, ..., `check_N`:

```json
{
  "question_id": "features_needed",
  "question": "Which features do you need in the first release?",
  "type": "multiple_choice",
  "check_1": "User Authentication",
  "check_2": "Email Notifications",
  "check_3": "Automated Invoicing",
  "check_4": "",
  "check_5": ""
}
```

- **Dynamic Count:** Can extend to `check_6`, `check_7`, etc.
- **Empty Key Rule:** Any empty string `""` is discarded.

### 4.3 True / False (`true`, `false`)
For `yes_no` questions, provide optional custom labels for affirmative and negative answers:

```json
{
  "question_id": "has_physical_store",
  "question": "Do you operate physical retail stores?",
  "type": "yes_no",
  "true": "Yes, we have retail branches",
  "false": "No, e-commerce only"
}
```

- If `true` or `false` is left empty or omitted, standard labels `"Yes"` and `"No"` are used.

### 4.4 Removing Unused Keys
You are free to delete unused keys completely from your JSON:
```json
{
  "question_id": "company_name",
  "question": "Company Name",
  "type": "text",
  "required": true
}
```
Both deleting unused keys and leaving them as empty strings `""` are valid.

---

## 5. Conditional Questions

To display a question only when a preceding question matches a specific answer, add the `conditional` block:

```json
{
  "question_id": "retail_store_count",
  "question": "How many physical locations do you have?",
  "type": "number",
  "conditional": {
    "question_id": "has_physical_store",
    "answer": "Yes, we have retail branches"
  }
}
```

### Conditional Matching Behavior:
- **`question_id`**: The `question_id` of the referenced dependency question. Must exist in the questionnaire.
- **`answer`**: The expected value or option label that triggers visibility.
  - For `yes_no`: Matches boolean `true`/`false`, affirmative labels (`"yes"`, `"true"`), or custom `true`/`false` labels.
  - For `single_choice`: Matches either the option label or generated option value (case-insensitive).
  - For `multiple_choice`: Question is shown if the selected array contains the expected answer.

---

## 6. Validation Rules

The application validates the JSON template before importing:
1. Root must contain a `questionnaire` object.
2. `questionnaire.title` must be a non-empty string.
3. `questionnaire.sections` must contain at least one valid section.
4. Each section must have a non-empty `section_title` and at least one question.
5. Each question must have a non-empty `question_id`, `question` text, and valid `type`.
6. `type` must be one of the supported types (or valid aliases); `rating` is rejected.
7. All `question_id` values must be unique across the questionnaire.
8. Single-choice questions must have at least two populated options.
9. Multiple-choice questions must have at least one populated option.
10. If `conditional` is defined, its `question_id` must reference an existing question, and cannot reference itself.

Error messages clearly indicate the location and reason, for example:
> `Section 2 ("Integrations") -> Question 3 ("pos_type"): Single choice questions must have at least 2 non-empty options.`
