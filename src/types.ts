/**
 * Generic Client Requirements & Questionnaire Management System
 * Core Data Models & Type Definitions
 */

export type StandardQuestionType =
  | 'text'
  | 'textarea'
  | 'single_choice'
  | 'multiple_choice'
  | 'yes_no'
  | 'number'
  | 'date';

// Backward compatibility with legacy types
export type LegacyQuestionType =
  | 'radio'
  | 'checkbox'
  | 'short_text'
  | 'long_text';

export type QuestionType = StandardQuestionType | LegacyQuestionType;

export interface QuestionOption {
  value: string;
  label: string;
  description?: string;
}

export type ConditionalOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'greater_than'
  | 'less_than';

export interface ConditionalRule {
  sourceQuestionId?: string;
  dependsOnQuestionId?: string;
  operator: ConditionalOperator;
  value: string | string[] | boolean | number;
  targetQuestionId?: string;
  followUpQuestion?: Question;
}

// Backward-compatible alias for legacy code
export interface ConditionalConfig {
  showWhenQuestionId: string;
  showWhenValue: string | string[] | boolean;
  question: Question;
}

export interface Question {
  id: string; // Generic unique ID, e.g. 'q_users_count', 'question_1'
  sectionId?: string;
  text?: string; // The question wording
  title?: string; // Backwards-compatible alias for text
  description?: string; // Helper explanation
  helperText?: string; // Backwards-compatible alias for description
  example?: string; // Guidance example
  type: QuestionType;
  required?: boolean;
  order?: number;
  enabled?: boolean;
  options?: QuestionOption[];
  hasOther?: boolean;
  otherPlaceholder?: string;
  placeholder?: string;
  unit?: string;
  conditionalRule?: ConditionalRule;
  conditional?: ConditionalConfig; // Backwards-compatible alias
  sectionKey?: string; // Backwards-compatible legacy key
  questionNumber?: number; // Backwards-compatible order alias
}

export interface Section {
  id?: string; // e.g. 'sec_users_access'
  questionnaireId?: string;
  title: string;
  description: string;
  order?: number;
  enabled?: boolean;
  iconName?: string;
  questions: Question[];
  // Backwards compatibility aliases
  key?: string;
  sectionNumber?: number;
}

// Type alias for legacy component references
export type QuestionnaireSection = Section;

export interface Questionnaire {
  id: string;
  workspaceId?: string;
  ownerId?: string;
  title: string;
  description: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  sections: Section[];
  clientId?: string; // Optional: specific client assignment
  projectId?: string; // Optional: specific project assignment
  isReusable?: boolean; // Default true: reusable template
  createdAt?: string;
  updatedAt?: string;
}

export interface QuestionnaireVersionSnapshot {
  id: string; // e.g. "v1", "v2"
  questionnaireId: string;
  version: number;
  title: string;
  description: string;
  sections: Section[];
  status: 'published';
  publishedAt: string;
  createdAt: string;
}

export interface AnswerValue {
  value: string | number | boolean | string[] | null;
  otherText?: string;
  conditionalValue?: string | number | boolean | string[] | null;
  conditionalOtherText?: string;
}

export type QuestionnaireAnswers = Record<string, AnswerValue>;

export interface Client {
  id: string;
  workspaceId?: string;
  ownerId?: string;
  name: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface ProjectQuestionnaireAssignment {
  id: string;
  questionnaireId: string;
  questionnaireVersion: number;
  title?: string;
  shareToken?: string;
  shareLinkStatus?: 'active' | 'revoked';
  assignedAt: string;
  status?: 'pending' | 'submitted' | 'reviewed';
}

export interface Project {
  id: string;
  workspaceId?: string;
  ownerId?: string;
  clientId: string;
  name: string;
  description?: string;
  questionnaireId?: string;
  assignedQuestionnaireId?: string;
  questionnaireVersion?: number;
  assignedQuestionnaires?: ProjectQuestionnaireAssignment[];
  shareLinkStatus?: 'active' | 'revoked';
  shareToken?: string;
  status: 'active' | 'archived' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface Submission {
  id: string;
  workspaceId?: string;
  ownerId?: string;
  questionnaireId?: string;
  questionnaireVersion?: number;
  clientId?: string;
  clientCode: string;
  projectId?: string;
  contactPerson?: string | null;
  contactPhone?: string | null;
  additionalRequirements?: string;
  status?: 'draft' | 'submitted' | 'reviewed' | 'archived';
  submittedAtIso: string;
  submittedAt?: unknown;
  reviewedAt?: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
  answers: Record<string, unknown>;
  rawAnswers?: QuestionnaireAnswers;
  formId?: string;
  formTitle?: string;
  isMasterDoc?: boolean;
  submissionDocId?: string;
  [key: string]: unknown;
}

// Legacy StoredSubmission alias
export type StoredSubmission = Submission;

// ---------------------------------------------------------------------------
// PHASE 5: INTELLIGENCE & REQUIREMENTS ENGINEERING TYPES
// ---------------------------------------------------------------------------

export type RequirementCategory =
  | 'business_goals'
  | 'users_roles'
  | 'features'
  | 'workflow'
  | 'data'
  | 'integrations'
  | 'reports'
  | 'constraints'
  | 'other';

export type RequirementPriority = 'high' | 'medium' | 'low';

export type RequirementStatus = 'pending' | 'accepted' | 'rejected';

export interface RequirementRecord {
  id: string;
  title: string;
  description: string;
  category: RequirementCategory;
  priority: RequirementPriority;
  sourceQuestionId?: string;
  sourceQuestionText?: string;
  sourceSubmissionId: string;
  status: RequirementStatus;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type RequirementItemType = 'explicit' | 'inferred' | 'missing';

export interface RequirementsSummaryItem {
  id: string;
  text: string;
  type: RequirementItemType;
  sourceQuestionId?: string;
}

export interface RequirementsSummaryCategory {
  category: RequirementCategory;
  label: string;
  items: RequirementsSummaryItem[];
}

export interface RequirementsSummary {
  id?: string;
  submissionId: string;
  generatedAt: string;
  overview: string;
  categories: RequirementsSummaryCategory[];
  adminNotes?: string;
}

export type GapWarningType =
  | 'unanswered_required'
  | 'ambiguous_answer'
  | 'conflicting_answers'
  | 'missing_requirement'
  | 'unclear_rule';

export interface GapWarning {
  id: string;
  type: GapWarningType;
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  relatedQuestionId?: string;
  relatedQuestionText?: string;
}

export interface CompletenessGapAnalysis {
  id?: string;
  submissionId: string;
  analyzedAt: string;
  completenessScore: number; // 0 to 100
  summary: string;
  warnings: GapWarning[];
}

export interface QuestionSuggestion {
  id: string;
  text: string;
  description: string;
  type: StandardQuestionType;
  options?: { value: string; label: string }[];
  required: boolean;
  reasoning: string;
  suggestedFollowUp?: {
    triggerValue: string;
    question: {
      text: string;
      type: StandardQuestionType;
      options?: { value: string; label: string }[];
    };
  };
}

export interface WordingImprovementSuggestion {
  originalText: string;
  improvedText: string;
  suggestedDescription?: string;
  suggestedType?: StandardQuestionType;
  reasoning: string;
}

export interface FollowUpSuggestion {
  triggerValue: string;
  questionText: string;
  questionType: StandardQuestionType;
  options?: { value: string; label: string }[];
  reasoning: string;
}

// ---------------------------------------------------------------------------
// ADMIN ALLOWLIST DATA MODEL
// ---------------------------------------------------------------------------

export interface AdminRecord {
  uid: string;
  email: string;
  role: 'admin';
  enabled: boolean;
  displayName?: string | null;
  photoURL?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// PHASE 5: PUBLIC FORMS & PIN ACCESS TYPES
// ---------------------------------------------------------------------------

export type PublicFormStatus = 'active' | 'disabled' | 'closed' | 'revoked';

export interface PublicForm {
  id: string; // Public identifier, e.g. "pub_a8f9c1"
  workspaceId?: string;
  ownerId?: string;
  title: string; // Form title, e.g. "Acme Corp Inventory Requirements"
  description?: string; // High-level description for client
  instructions?: string; // Completion instructions
  contactInfo?: string; // Optional support email/phone
  projectId: string; // Project binding
  projectName?: string;
  clientId: string; // Client binding
  clientName?: string;
  assignmentId?: string; // Assignment binding
  questionnaireId: string; // Questionnaire binding
  questionnaireVersion: number;
  shareToken: string; // Capability share-token matching /projects/{projectId}/tokens/{shareToken}
  pinHash?: string; // Salted cryptographic hash of PIN (isolated in security doc)
  pinSalt?: string; // Unique cryptographic salt for this form
  encryptedShareToken?: string; // AES-256 encrypted capability token
  iv?: string; // Initialization vector for token encryption
  authTag?: string; // Authentication tag for AES-256-GCM
  hasPin: boolean; // Whether PIN authentication is enforced
  status: PublicFormStatus;
  createdAt: string;
  updatedAt: string;
  submissionCount?: number;
}

// Safe metadata exposed to unauthenticated public client before PIN verification
export interface PublicFormInfo {
  id: string;
  workspaceId?: string;
  title: string;
  description?: string;
  instructions?: string;
  contactInfo?: string;
  projectName?: string;
  clientName?: string;
  hasPin: boolean;
  status: PublicFormStatus;
}

// Session state after successful PIN verification
export interface AuthorizedFormSession {
  publicFormId: string;
  workspaceId?: string;
  projectId: string;
  shareToken: string;
  questionnaireId: string;
  questionnaireVersion: number;
  clientName: string;
  projectName: string;
  formTitle: string;
  instructions?: string;
  verifiedAt: string;
}

// ---------------------------------------------------------------------------
// PHASE 6: MULTI-TENANT WORKSPACE & ISOLATION TYPES
// ---------------------------------------------------------------------------

export interface Workspace {
  id: string; // Exactly user.uid (1 registered user = exactly 1 workspace)
  name: string;
  ownerId: string; // user.uid
  ownerEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicFormSecurityRecord {
  publicFormId: string;
  workspaceId: string;
  ownerId: string;
  pinHash: string;
  pinSalt: string;
  encryptedShareToken: string;
  iv: string;
  authTag: string;
  shareToken?: string;
  updatedAt: string;
}



