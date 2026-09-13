import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { Client, Project, Questionnaire, Submission, ProjectQuestionnaireAssignment } from '../types';
import { getQuestionnaire } from './questionnaireService';

function sanitize<T>(data: T): T {
  if (data === undefined) return null as unknown as T;
  if (data === null || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map((x) => sanitize(x)) as unknown as T;
  const cleanObj: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    cleanObj[k] = v !== undefined ? sanitize(v) : null;
  }
  return cleanObj as unknown as T;
}

// ---------------------------------------------------------------------------
// CLIENTS MANAGEMENT
// ---------------------------------------------------------------------------

export async function fetchClients(workspaceId?: string): Promise<Client[]> {
  try {
    const targetWs = workspaceId || auth.currentUser?.uid;
    const colRef = collection(db, 'clients');
    const q = targetWs ? query(colRef, where('workspaceId', '==', targetWs)) : colRef;
    const snap = await getDocs(q);
    const clients: Client[] = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      clients.push({
        id: docSnap.id,
        workspaceId: data.workspaceId,
        ownerId: data.ownerId,
        name: data.name || 'Unnamed Client',
        contactPerson: data.contactPerson || '',
        contactEmail: data.contactEmail || '',
        contactPhone: data.contactPhone || '',
        notes: data.notes || '',
        status: data.status === 'archived' ? 'archived' : 'active',
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      });
    });

    clients.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return clients;
  } catch (err) {
    console.warn('Error fetching clients from Firestore:', err);
    return [];
  }
}

export async function getClient(id: string): Promise<Client | null> {
  try {
    const docRef = doc(db, 'clients', id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        id: snap.id,
        workspaceId: data.workspaceId,
        ownerId: data.ownerId,
        name: data.name || 'Unnamed Client',
        contactPerson: data.contactPerson || '',
        contactEmail: data.contactEmail || '',
        contactPhone: data.contactPhone || '',
        notes: data.notes || '',
        status: data.status === 'archived' ? 'archived' : 'active',
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
    }
  } catch (err) {
    console.warn(`Error getting client ${id}:`, err);
  }
  return null;
}

export async function createClient(
  data: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>,
  workspaceId?: string
): Promise<Client> {
  const id = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const wsId = workspaceId || data.workspaceId || auth.currentUser?.uid || 'default';
  const client: Client = {
    ...data,
    id,
    workspaceId: wsId,
    ownerId: wsId,
    status: data.status || 'active',
    createdAt: now,
    updatedAt: now,
  };

  try {
    const docRef = doc(db, 'clients', id);
    await setDoc(docRef, sanitize(client));
  } catch (err) {
    console.error('Error creating client in Firestore:', err);
  }

  return client;
}

export async function updateClient(
  id: string,
  data: Partial<Omit<Client, 'id' | 'createdAt'>>
): Promise<void> {
  try {
    const docRef = doc(db, 'clients', id);
    const updated = {
      ...data,
      updatedAt: new Date().toISOString(),
    };
    await updateDoc(docRef, sanitize(updated));
  } catch (err) {
    console.error(`Error updating client ${id}:`, err);
    throw err;
  }
}

export async function archiveClient(id: string, archive = true): Promise<void> {
  return updateClient(id, { status: archive ? 'archived' : 'active' });
}

// ---------------------------------------------------------------------------
// PROJECTS MANAGEMENT
// ---------------------------------------------------------------------------

export async function fetchProjects(clientId?: string, workspaceId?: string): Promise<Project[]> {
  try {
    const targetWs = workspaceId || auth.currentUser?.uid;
    const colRef = collection(db, 'projects');
    const q = targetWs ? query(colRef, where('workspaceId', '==', targetWs)) : colRef;
    const snap = await getDocs(q);
    const projects: Project[] = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (!clientId || data.clientId === clientId) {
        projects.push({
          id: docSnap.id,
          workspaceId: data.workspaceId,
          ownerId: data.ownerId,
          clientId: data.clientId || '',
          name: data.name || 'Unnamed Project',
          description: data.description || '',
          questionnaireId: data.questionnaireId || data.assignedQuestionnaireId || undefined,
          assignedQuestionnaireId: data.assignedQuestionnaireId || data.questionnaireId || undefined,
          questionnaireVersion: data.questionnaireVersion,
          assignedQuestionnaires: data.assignedQuestionnaires || [],
          shareLinkStatus: data.shareLinkStatus || 'active',
          shareToken: data.shareToken,
          status: data.status || 'active',
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        });
      }
    });

    projects.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return projects;
  } catch (err) {
    console.warn('Error fetching projects from Firestore:', err);
    return [];
  }
}

export async function getProject(id: string): Promise<Project | null> {
  try {
    const docRef = doc(db, 'projects', id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        id: snap.id,
        workspaceId: data.workspaceId,
        ownerId: data.ownerId,
        clientId: data.clientId || '',
        name: data.name || 'Unnamed Project',
        description: data.description || '',
        questionnaireId: data.questionnaireId || data.assignedQuestionnaireId || undefined,
        assignedQuestionnaireId: data.assignedQuestionnaireId || data.questionnaireId || undefined,
        questionnaireVersion: data.questionnaireVersion,
        assignedQuestionnaires: data.assignedQuestionnaires || [],
        shareLinkStatus: data.shareLinkStatus || 'active',
        shareToken: data.shareToken,
        status: data.status || 'active',
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
    }
  } catch (err) {
    console.warn(`Error getting project ${id}:`, err);
  }
  return null;
}

export async function syncProjectShareTokenDoc(project: Project): Promise<void> {
  if (!project.id) return;
  try {
    let clientName: string | undefined = undefined;
    if (project.clientId) {
      try {
        const c = await getClient(project.clientId);
        if (c) clientName = c.name;
      } catch {
        // Best effort lookup
      }
    }

    const primaryQId = project.questionnaireId || project.assignedQuestionnaireId || '';
    const primaryQVer = project.questionnaireVersion || 1;

    // 1. Sync primary project shareToken if present
    if (project.shareToken) {
      const tokenRef = doc(db, 'projects', project.id, 'tokens', project.shareToken);
      await setDoc(
        tokenRef,
        sanitize({
          projectId: project.id,
          workspaceId: project.workspaceId,
          ownerId: project.ownerId,
          shareToken: project.shareToken,
          clientId: project.clientId,
          clientName: clientName || '',
          name: project.name,
          description: project.description || '',
          questionnaireId: primaryQId,
          assignedQuestionnaireId: primaryQId,
          questionnaireVersion: primaryQVer,
          assignedQuestionnaires: project.assignedQuestionnaires || [],
          shareLinkStatus: project.shareLinkStatus || 'active',
          status: project.status || 'active',
          createdAt: project.createdAt || new Date().toISOString(),
          updatedAt: project.updatedAt || new Date().toISOString(),
        }),
        { merge: true }
      );
    }

    // 2. Sync each assigned questionnaire token if present
    if (project.assignedQuestionnaires && project.assignedQuestionnaires.length > 0) {
      for (const asgn of project.assignedQuestionnaires) {
        if (asgn.shareToken && asgn.shareToken !== project.shareToken) {
          const asgnTokenRef = doc(db, 'projects', project.id, 'tokens', asgn.shareToken);
          await setDoc(
            asgnTokenRef,
            sanitize({
              projectId: project.id,
              workspaceId: project.workspaceId,
              ownerId: project.ownerId,
              shareToken: asgn.shareToken,
              clientId: project.clientId,
              clientName: clientName || '',
              name: project.name,
              description: project.description || '',
              questionnaireId: asgn.questionnaireId,
              assignedQuestionnaireId: asgn.questionnaireId,
              questionnaireVersion: asgn.questionnaireVersion || 1,
              assignmentId: asgn.id,
              shareLinkStatus: asgn.shareLinkStatus || project.shareLinkStatus || 'active',
              status: project.status || 'active',
              createdAt: asgn.assignedAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }),
            { merge: true }
          );
        }
      }
    }
  } catch (err) {
    console.warn('Error syncing project share token document:', err);
  }
}

/**
 * Validates a client's share-link project access using Firestore scoped token document.
 * Returns the project metadata only if the token matches and both project and share link are active.
 */
export async function getProjectByShareToken(
  projectId: string,
  shareToken: string
): Promise<{ project: Project; clientName?: string } | null> {
  if (!projectId || !shareToken || !projectId.trim() || !shareToken.trim()) {
    return null;
  }
  const cleanProjId = projectId.trim();
  const cleanToken = shareToken.trim();

  try {
    const tokenDocRef = doc(db, 'projects', cleanProjId, 'tokens', cleanToken);
    const snap = await getDoc(tokenDocRef);
    if (snap.exists()) {
      const data = snap.data();
      if (
        data.shareLinkStatus === 'active' &&
        data.status === 'active' &&
        data.projectId === cleanProjId
      ) {
        return {
          project: {
            id: cleanProjId,
            workspaceId: data.workspaceId,
            ownerId: data.ownerId,
            clientId: data.clientId || '',
            name: data.name || 'Unnamed Project',
            description: data.description || '',
            questionnaireId: data.questionnaireId || data.assignedQuestionnaireId || undefined,
            assignedQuestionnaireId: data.assignedQuestionnaireId || data.questionnaireId || undefined,
            questionnaireVersion: data.questionnaireVersion,
            assignedQuestionnaires: data.assignedQuestionnaires || [],
            shareLinkStatus: data.shareLinkStatus,
            shareToken: cleanToken,
            status: data.status,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          },
          clientName: data.clientName,
        };
      }
    }
  } catch (err) {
    console.warn('Error validating share link token with Firestore:', err);
  }
  return null;
}

export async function updateProjectShareLink(
  projectId: string,
  shareLinkStatus: 'active' | 'revoked'
): Promise<void> {
  const docRef = doc(db, 'projects', projectId);
  const now = new Date().toISOString();
  await updateDoc(docRef, {
    shareLinkStatus,
    updatedAt: now,
  });
  const proj = await getProject(projectId);
  if (proj) {
    await syncProjectShareTokenDoc({ ...proj, shareLinkStatus, updatedAt: now });
  }
}

export async function assignQuestionnaireToProject(
  projectId: string,
  questionnaireId: string,
  questionnaireVersion?: number
): Promise<void> {
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);

  const now = new Date().toISOString();
  const version = questionnaireVersion ?? project.questionnaireVersion ?? 1;

  // Check if an assignment already exists for this questionnaire
  const assignments = project.assignedQuestionnaires ? [...project.assignedQuestionnaires] : [];
  const existingIdx = assignments.findIndex((a) => a.questionnaireId === questionnaireId);

  if (existingIdx >= 0) {
    assignments[existingIdx] = {
      ...assignments[existingIdx],
      questionnaireVersion: version,
    };
  } else {
    assignments.push({
      id: `asgn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      questionnaireId,
      questionnaireVersion: version,
      shareToken: `st_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`,
      shareLinkStatus: 'active',
      assignedAt: now,
      status: 'pending',
    });
  }

  const docRef = doc(db, 'projects', projectId);
  const updateData: Record<string, unknown> = {
    questionnaireId,
    assignedQuestionnaireId: questionnaireId,
    questionnaireVersion: version,
    assignedQuestionnaires: assignments,
    updatedAt: now,
  };

  await updateDoc(docRef, sanitize(updateData));
  const fullProj = await getProject(projectId);
  if (fullProj) {
    await syncProjectShareTokenDoc(fullProj);
  }
}

export async function addQuestionnaireAssignmentToProject(
  projectId: string,
  questionnaireId: string,
  questionnaireVersion = 1,
  title?: string
): Promise<ProjectQuestionnaireAssignment> {
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);

  const assignmentId = `asgn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const assignmentToken = `st_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
  const newAssignment: ProjectQuestionnaireAssignment = {
    id: assignmentId,
    questionnaireId,
    questionnaireVersion,
    title: title || '',
    shareToken: assignmentToken,
    shareLinkStatus: 'active',
    assignedAt: new Date().toISOString(),
    status: 'pending',
  };

  const existingAssignments = project.assignedQuestionnaires || [];
  const assignments = [...existingAssignments, newAssignment];

  const updateData: Partial<Project> = {
    assignedQuestionnaires: assignments,
  };
  if (!project.questionnaireId) {
    updateData.questionnaireId = questionnaireId;
    updateData.assignedQuestionnaireId = questionnaireId;
    updateData.questionnaireVersion = questionnaireVersion;
  }

  await updateProject(projectId, updateData);
  return newAssignment;
}

export async function removeQuestionnaireAssignmentFromProject(
  projectId: string,
  assignmentId: string
): Promise<void> {
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);

  const assignments = (project.assignedQuestionnaires || []).filter((a) => a.id !== assignmentId);
  await updateProject(projectId, {
    assignedQuestionnaires: assignments,
  });
}

export async function createProject(
  data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>,
  workspaceId?: string
): Promise<Project> {
  const id = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const wsId = workspaceId || data.workspaceId || auth.currentUser?.uid || 'default';
  const qId = data.questionnaireId || data.assignedQuestionnaireId || undefined;
  const shareToken =
    data.shareToken ||
    `st_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;

  let assignments: ProjectQuestionnaireAssignment[] = data.assignedQuestionnaires || [];
  if (assignments.length === 0 && qId) {
    assignments = [
      {
        id: `asgn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        questionnaireId: qId,
        questionnaireVersion: data.questionnaireVersion || 1,
        shareToken,
        shareLinkStatus: 'active',
        assignedAt: now,
        status: 'pending',
      },
    ];
  }

  const project: Project = {
    ...data,
    id,
    workspaceId: wsId,
    ownerId: wsId,
    questionnaireId: qId,
    assignedQuestionnaireId: qId,
    assignedQuestionnaires: assignments,
    shareToken,
    shareLinkStatus: data.shareLinkStatus || 'active',
    status: data.status || 'active',
    createdAt: now,
    updatedAt: now,
  };

  try {
    const docRef = doc(db, 'projects', id);
    await setDoc(docRef, sanitize(project));
    await syncProjectShareTokenDoc(project);
  } catch (err) {
    console.error('Error creating project in Firestore:', err);
  }

  return project;
}

export async function updateProject(
  id: string,
  data: Partial<Omit<Project, 'id' | 'createdAt'>>
): Promise<void> {
  try {
    const docRef = doc(db, 'projects', id);
    const updated: Record<string, unknown> = {
      ...data,
      updatedAt: new Date().toISOString(),
    };
    if (data.questionnaireId) {
      updated.assignedQuestionnaireId = data.questionnaireId;
    }
    await updateDoc(docRef, sanitize(updated));
    const fullProj = await getProject(id);
    if (fullProj) {
      await syncProjectShareTokenDoc(fullProj);
    }
  } catch (err) {
    console.error(`Error updating project ${id}:`, err);
    throw err;
  }
}

export async function archiveProject(id: string, archive = true): Promise<void> {
  return updateProject(id, { status: archive ? 'archived' : 'active' });
}

// ---------------------------------------------------------------------------
// QUESTIONNAIRES MANAGEMENT
// ---------------------------------------------------------------------------

export async function fetchQuestionnaires(workspaceId?: string): Promise<Questionnaire[]> {
  try {
    const targetWs = workspaceId || auth.currentUser?.uid;
    const colRef = collection(db, 'questionnaires');
    const q = targetWs ? query(colRef, where('workspaceId', '==', targetWs)) : colRef;
    const snap = await getDocs(q);
    const list: Questionnaire[] = [];

    if (!snap.empty) {
      for (const qDoc of snap.docs) {
        const fullQ = await getQuestionnaire(qDoc.id);
        if (fullQ) {
          list.push(fullQ);
        }
      }
    }

    return list;
  } catch (err) {
    console.warn('Error fetching questionnaires from Firestore:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// SUBMISSIONS MANAGEMENT
// ---------------------------------------------------------------------------

export interface SubmissionFilter {
  clientId?: string;
  projectId?: string;
  questionnaireId?: string;
  status?: string;
  search?: string;
}

export async function fetchSubmissions(filter?: SubmissionFilter, workspaceId?: string): Promise<Submission[]> {
  try {
    // 1. Fetch from primary `/submissions`
    const targetWs = workspaceId || auth.currentUser?.uid;
    const colRef = collection(db, 'submissions');
    const q = targetWs ? query(colRef, where('workspaceId', '==', targetWs)) : colRef;
    const snap = await getDocs(q);
    const items: Submission[] = [];

    snap.forEach((docSnap) => {
      const d = docSnap.data();
      items.push({
        id: docSnap.id,
        workspaceId: d.workspaceId,
        ownerId: d.ownerId,
        questionnaireId: d.questionnaireId || d.formId || '',
        questionnaireVersion: d.questionnaireVersion || 1,
        clientId: d.clientId,
        clientCode: d.clientCode || docSnap.id,
        projectId: d.projectId,
        contactPerson: d.contactPerson ?? null,
        contactPhone: d.contactPhone ?? null,
        additionalRequirements: d.additionalRequirements || '',
        status: d.status || 'submitted',
        submittedAtIso: d.submittedAtIso || (d.submittedAt?.toDate ? d.submittedAt.toDate().toISOString() : new Date().toISOString()),
        submittedAt: d.submittedAt,
        answers: d.answers || {},
        rawAnswers: d.rawAnswers || d.answers,
        formId: d.formId,
        formTitle: d.formTitle,
        isMasterDoc: d.isMasterDoc ?? false,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      });
    });

    // 2. Also check `/clientResponses` to merge any legacy submissions from Phase 1 if legacy admin or unscoped
    if (!targetWs || targetWs === '8evjlNiaUoQneySNXZGhSeZRSoh1') {
      try {
        const legacyRef = collection(db, 'clientResponses');
        const legacySnap = await getDocs(legacyRef);
        legacySnap.forEach((docSnap) => {
          const d = docSnap.data();
          if (d.isMasterDoc) return; // skip company summary docs
          if (!items.some((existing) => existing.id === docSnap.id)) {
            items.push({
              id: docSnap.id,
              workspaceId: d.workspaceId || '8evjlNiaUoQneySNXZGhSeZRSoh1',
              ownerId: d.ownerId || '8evjlNiaUoQneySNXZGhSeZRSoh1',
              questionnaireId: d.questionnaireId || d.formId || '',
              questionnaireVersion: d.questionnaireVersion || 1,
              clientId: d.clientId,
              clientCode: d.clientCode || docSnap.id,
              projectId: d.projectId,
              contactPerson: d.contactPerson ?? null,
              contactPhone: d.contactPhone ?? null,
              additionalRequirements: d.additionalRequirements || '',
              status: d.status || 'submitted',
              submittedAtIso: d.submittedAtIso || (d.submittedAt?.toDate ? d.submittedAt.toDate().toISOString() : new Date().toISOString()),
              submittedAt: d.submittedAt,
              answers: d.answers || {},
              rawAnswers: d.rawAnswers || d.answers,
              formId: d.formId,
              formTitle: d.formTitle,
              isMasterDoc: false,
            });
          }
        });
      } catch {
        // Ignore legacy errors
      }
    }

    // Sort newest first
    items.sort((a, b) => new Date(b.submittedAtIso).getTime() - new Date(a.submittedAtIso).getTime());

    // Apply filters
    if (!filter) return items;

    return items.filter((sub) => {
      if (filter.clientId && filter.clientId !== 'ALL' && sub.clientId !== filter.clientId) {
        return false;
      }
      if (filter.projectId && filter.projectId !== 'ALL' && sub.projectId !== filter.projectId) {
        return false;
      }
      if (filter.questionnaireId && filter.questionnaireId !== 'ALL' && sub.questionnaireId !== filter.questionnaireId) {
        return false;
      }
      if (filter.status && filter.status !== 'ALL' && sub.status !== filter.status) {
        return false;
      }
      if (filter.search && filter.search.trim()) {
        const q = filter.search.toLowerCase();
        const clientMatch = (sub.clientCode || '').toLowerCase().includes(q);
        const contactMatch = (sub.contactPerson || '').toLowerCase().includes(q);
        const phoneMatch = (sub.contactPhone || '').toLowerCase().includes(q);
        const notesMatch = (sub.additionalRequirements || '').toLowerCase().includes(q);
        const idMatch = sub.id.toLowerCase().includes(q);
        if (!clientMatch && !contactMatch && !phoneMatch && !notesMatch && !idMatch) {
          return false;
        }
      }
      return true;
    });
  } catch (err) {
    console.warn('Error fetching submissions:', err);
    return [];
  }
}

export async function deleteSubmission(_id: string): Promise<void> {
  // Permanent deletion of submissions is strictly prohibited by security policy.
  // Submissions follow the lifecycle: draft -> submitted -> reviewed -> archived
  throw new Error('Permanent deletion of submissions is not permitted. Please use the archive status instead.');
}

// ---------------------------------------------------------------------------
// DASHBOARD METRICS
// ---------------------------------------------------------------------------

export interface DashboardMetrics {
  totalClients: number;
  activeProjects: number;
  totalQuestionnaires: number;
  publishedQuestionnaires: number;
  pendingSubmissions: number;
  submittedSubmissions: number;
  reviewedSubmissions: number;
  archivedSubmissions: number;
  completedSubmissions: number;
}

export async function fetchDashboardMetrics(workspaceId?: string): Promise<DashboardMetrics> {
  const [clients, projects, questionnaires, submissions] = await Promise.all([
    fetchClients(workspaceId),
    fetchProjects(undefined, workspaceId),
    fetchQuestionnaires(workspaceId),
    fetchSubmissions(undefined, workspaceId),
  ]);

  const activeProjects = projects.filter((p) => p.status === 'active').length;
  const publishedQuestionnaires = questionnaires.filter((q) => q.status === 'published').length;
  const pendingSubmissions = submissions.filter((s) => s.status === 'draft').length;
  const submittedSubmissions = submissions.filter((s) => s.status === 'submitted').length;
  const reviewedSubmissions = submissions.filter((s) => s.status === 'reviewed').length;
  const archivedSubmissions = submissions.filter((s) => s.status === 'archived').length;
  const completedSubmissions = submissions.filter((s) => s.status !== 'draft').length;

  return {
    totalClients: clients.length,
    activeProjects,
    totalQuestionnaires: questionnaires.length,
    publishedQuestionnaires,
    pendingSubmissions,
    submittedSubmissions,
    reviewedSubmissions,
    archivedSubmissions,
    completedSubmissions,
  };
}
