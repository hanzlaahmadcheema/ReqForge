Phase 4 — Generic Management Dashboard & Questionnaire Workflow

Phase 1–3 are approved and must be preserved.

Do NOT modify Phase 1/2 security architecture or Phase 3 JSON architecture unless a real defect is discovered.

Objective

Transform the current application into a completely generic, database-driven Requirements / Questionnaire Management Platform.

There must be NO questionnaire-specific, client-specific, project-specific, Pepsi-specific, demo-specific, or sample-business hardcoded data anywhere in the application.

The application must work with completely different clients, projects, and questionnaires without changing frontend code.

1. First: Full Hardcoded-Data Audit

Before implementing new features:

Audit the entire codebase for:

- hardcoded client names
- hardcoded project names
- hardcoded questionnaire titles
- hardcoded section names
- hardcoded questions
- hardcoded answer options
- hardcoded questionnaire answers
- hardcoded requirements
- hardcoded report data
- hardcoded chart values
- hardcoded counts
- hardcoded IDs
- demo/fake client records
- demo/fake projects
- demo/fake submissions
- business-specific terminology
- questionnaire-specific rendering logic
- fallback questionnaires

Remove or replace them with database-driven data.

Do NOT remove legitimate application UI labels, status values, supported question-type definitions, validation rules, or system configuration.

Do NOT silently replace removed data with another hardcoded example.

2. Admin Dashboard

Create a real admin dashboard containing separate management areas for:

Clients

Admin can:

- create client
- view clients
- edit client
- view client details
- view client's projects
- view questionnaires assigned to client
- view client's submissions

Projects

Admin can:

- create project
- edit project
- view project
- assign client
- assign questionnaire/version
- manage questionnaire assignments
- view project submissions
- generate/manage project share access

Questionnaires

Admin can:

- create questionnaire
- edit questionnaire
- clone questionnaire
- archive questionnaire
- preview questionnaire
- publish questionnaire
- manage versions
- import questionnaire from JSON
- export questionnaire JSON/template

Submissions / Reports

Admin can:

- view submissions
- search
- filter
- sort
- open submission
- review answers
- review extracted requirements
- review analysis
- see submission status
- archive/restore according to existing lifecycle

Permanent submission deletion MUST remain impossible.

3. Questionnaire Ownership / Reuse Model

Do not hardcode questionnaires to clients.

Use this conceptual relationship:

Questionnaire Template
↓
Questionnaire Version
↓
Assignment
↓
Client / Project
↓
Submission

A questionnaire may be reusable.

Admin must be able to:

1. create reusable questionnaire
2. publish a version
3. assign that version to a project/client
4. have the client complete it
5. receive the submission
6. review the resulting report

Also support creating a questionnaire intended specifically for one project/client.

Do not duplicate questionnaire definition unnecessarily just because it is assigned to a project.

4. JSON Questionnaire Creation

Admin must be able to create a questionnaire using the universal JSON format from Phase 3.

Workflow:

Create Questionnaire
↓
JSON Template / JSON Editor
↓
Validate
↓
Preview
↓
Import
↓
Internal Questionnaire Model
↓
Publish/version
↓
Assign to client/project

Use the existing Phase 3 importer.

Do NOT create a second questionnaire format.

Do NOT hardcode questionnaire-specific JSON parsing.

The existing reusable template at:

docs/questionnaire-template.json

and format documentation must remain the canonical JSON vocabulary.

5. Multiple Questionnaires

A project/client may have:

- one questionnaire
- multiple questionnaires
- different questionnaire types

Examples only for architecture testing — do NOT hardcode these into production:

Project A

- Initial Requirements
- Technical Requirements
- Final Review

Project B

- Client Discovery

The UI/database must support arbitrary questionnaire counts and names.

6. Client Submission Flow

Client receives the existing secure share URL.

Client:

1. opens questionnaire
2. completes answers
3. saves draft
4. resumes draft
5. submits questionnaire

Preserve Phase 2 token security exactly.

Do NOT introduce public project reads.

Do NOT trust clientId/projectId/submissionId as authorization.

Do NOT weaken Firestore rules.

Preserve:

draft → submitted → reviewed → archived

Permanent deletion remains blocked.

7. Admin Review / Report

After submission, admin must be able to open a submission and see a clear report containing:

- client
- project
- questionnaire
- questionnaire version
- submission status
- submission date
- answers
- additional requirements
- extracted requirements where available
- AI analysis where available
- completeness/gap information where available

Everything must be generated from the actual submission/questionnaire data.

No fixed report content.

8. Dashboard Statistics

Any dashboard statistics must be calculated from actual Firestore data.

Examples:

- total clients
- total projects
- active questionnaires
- pending submissions
- submitted submissions
- reviewed submissions
- archived submissions

Do NOT hardcode numbers.

If there is no data, show an appropriate empty state.

9. Generic Empty States

The application must behave correctly with:

- zero clients
- zero projects
- zero questionnaires
- zero submissions

Show useful empty states and actions such as:

"Create your first client"

"Create your first project"

"Create questionnaire"

Do not populate the database with fake records.

10. Architecture

Preserve:

Builder → Internal Questionnaire Model
JSON → Internal Questionnaire Model
↓
Existing Renderer
↓
Submission

Management layer:

Client
↓
Project
↓
Questionnaire Assignment
↓
Questionnaire Version
↓
Client Submission
↓
Admin Review / Report

11. Versioning

Preserve Phase 3 immutable questionnaire snapshots.

A project assigned to version 1 must continue using version 1 even if the questionnaire later publishes version 2.

Historical submissions must continue rendering against their original questionnaire version.

Regression-test:

publish v1
→ assign project
→ submit
→ publish v2
→ verify old assignment/submission remains v1

12. Security

Do NOT weaken:

- admin Google authentication
- admin allowlist
- share-token requirement
- token-scoped project access
- submission isolation
- draft-only client creation
- post-submit client lock
- immutable submission identity fields
- permanent deletion prohibition

Audit all new reads/writes against Firestore rules.

13. Data Model

Before changing the database schema, inspect the existing Phase 1–3 model and reuse existing entities wherever possible.

Do NOT introduce unnecessary backend services or duplicate collections.

Only add collections/fields that are genuinely required for:

- questionnaire assignment
- reusable questionnaire management
- client/project management
- admin reporting

Explain any schema changes before implementing them if they affect the existing architecture.

14. UI

Admin dashboard should be organized around:

- Dashboard
- Clients
- Projects
- Questionnaires
- Submissions / Reports

Use existing components/styles where appropriate.

Keep the UI generic.

No Pepsi/business-specific branding or terminology.

15. Tests

Create/extend tests for:

- no hardcoded questionnaire data
- no demo client/project/submission data
- client CRUD
- project CRUD
- questionnaire CRUD
- questionnaire assignment
- multiple questionnaires
- JSON questionnaire creation
- JSON validation
- JSON preview/import
- publish/versioning
- client submission
- draft/resume
- admin submission review
- report rendering
- empty states
- dashboard statistics
- Phase 1 regression
- Phase 2 security regression
- Phase 3 JSON regression

Run:

npx tsc --noEmit

production build

all relevant test suites.

16. Important

Do not assume previous agent reports are correct.

Inspect actual code.

Do not rewrite working Phase 1–3 systems unnecessarily.

Do not create mock/demo data to make the dashboard look populated.

Do not hardcode questionnaire structures.

Do not create separate frontend rendering logic for different questionnaires.

Everything must flow through the generic questionnaire model.

17. Deliverable

At the end report:

1. hardcoded data removed
2. files changed
3. dashboard areas created
4. client management
5. project management
6. questionnaire management
7. questionnaire assignment model
8. JSON creation workflow
9. client submission workflow
10. admin report/review workflow
11. database/schema changes
12. security changes
13. tests and results
14. TypeScript result
15. production build result
16. regressions checked
17. remaining limitations

Commit all Phase 4 changes with a clear commit message.

STOP after Phase 4. Do not begin another phase.
