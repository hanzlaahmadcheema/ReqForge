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
import { db } from './firebase';
import { Client, Project, Questionnaire, Submission } from '../types';
import { DEFAULT_QUESTIONNAIRE } from '../data/defaultQuestionnaire';
import { getQuestionnaire, seedQuestionnaireIfMissing } from './questionnaireService';

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

export async function fetchClients(): Promise<Client[]> {
  try {
    const colRef = collection(db, 'clients');
    const snap = await getDocs(colRef);
    const clients: Client[] = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      clients.push({
        id: docSnap.id,
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

    // If Firestore is empty, seed an initial example client and project for immediate usability
    if (clients.length === 0) {
      const defaultClient = await seedInitialClientAndProject();
      if (defaultClient) {
        clients.push(defaultClient);
      }
    }

    clients.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return clients;
  } catch (err) {
    console.warn('Error fetching clients from Firestore:', err);
    return getLocalFallbackClients();
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
  data: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Client> {
  const id = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const client: Client = {
    ...data,
    id,
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

export async function fetchProjects(clientId?: string): Promise<Project[]> {
  try {
    const colRef = collection(db, 'projects');
    const snap = await getDocs(colRef);
    const projects: Project[] = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (!clientId || data.clientId === clientId) {
        projects.push({
          id: docSnap.id,
          clientId: data.clientId || '',
          name: data.name || 'Unnamed Project',
          description: data.description || '',
          questionnaireId: data.questionnaireId || data.assignedQuestionnaireId || DEFAULT_QUESTIONNAIRE.id,
          assignedQuestionnaireId: data.questionnaireId || data.assignedQuestionnaireId || DEFAULT_QUESTIONNAIRE.id,
          questionnaireVersion: data.questionnaireVersion,
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
    return getLocalFallbackProjects(clientId);
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
        clientId: data.clientId || '',
        name: data.name || 'Unnamed Project',
        description: data.description || '',
        questionnaireId: data.questionnaireId || data.assignedQuestionnaireId || DEFAULT_QUESTIONNAIRE.id,
        assignedQuestionnaireId: data.questionnaireId || data.assignedQuestionnaireId || DEFAULT_QUESTIONNAIRE.id,
        questionnaireVersion: data.questionnaireVersion,
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
  if (!project.id || !project.shareToken) return;
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

    const tokenRef = doc(db, 'projects', project.id, 'tokens', project.shareToken);
    await setDoc(
      tokenRef,
      sanitize({
        projectId: project.id,
        shareToken: project.shareToken,
        clientId: project.clientId,
        clientName: clientName || '',
        name: project.name,
        description: project.description || '',
        questionnaireId: project.questionnaireId || project.assignedQuestionnaireId || DEFAULT_QUESTIONNAIRE.id,
        assignedQuestionnaireId: project.assignedQuestionnaireId || project.questionnaireId || DEFAULT_QUESTIONNAIRE.id,
        questionnaireVersion: project.questionnaireVersion || 1,
        shareLinkStatus: project.shareLinkStatus || 'active',
        status: project.status || 'active',
        createdAt: project.createdAt || new Date().toISOString(),
        updatedAt: project.updatedAt || new Date().toISOString(),
      }),
      { merge: true }
    );
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
            clientId: data.clientId || '',
            name: data.name || 'Unnamed Project',
            description: data.description || '',
            questionnaireId: data.questionnaireId || data.assignedQuestionnaireId || DEFAULT_QUESTIONNAIRE.id,
            assignedQuestionnaireId: data.assignedQuestionnaireId || data.questionnaireId || DEFAULT_QUESTIONNAIRE.id,
            questionnaireVersion: data.questionnaireVersion,
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
  if (proj && proj.shareToken) {
    await syncProjectShareTokenDoc({ ...proj, shareLinkStatus, updatedAt: now });
  }
}

export async function assignQuestionnaireToProject(
  projectId: string,
  questionnaireId: string,
  questionnaireVersion?: number
): Promise<void> {
  const docRef = doc(db, 'projects', projectId);
  const now = new Date().toISOString();
  const updateData: Record<string, unknown> = {
    questionnaireId,
    assignedQuestionnaireId: questionnaireId,
    updatedAt: now,
  };
  if (questionnaireVersion !== undefined) {
    updateData.questionnaireVersion = questionnaireVersion;
  }
  await updateDoc(docRef, updateData);
  const proj = await getProject(projectId);
  if (proj && proj.shareToken) {
    await syncProjectShareTokenDoc({
      ...proj,
      questionnaireId,
      assignedQuestionnaireId: questionnaireId,
      questionnaireVersion: questionnaireVersion ?? proj.questionnaireVersion,
      updatedAt: now,
    });
  }
}

export async function createProject(
  data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Project> {
  const id = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const qId = data.questionnaireId || data.assignedQuestionnaireId || DEFAULT_QUESTIONNAIRE.id;
  const shareToken =
    data.shareToken ||
    `st_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
  const project: Project = {
    ...data,
    id,
    questionnaireId: qId,
    assignedQuestionnaireId: qId,
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
    if (fullProj && fullProj.shareToken) {
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

export async function fetchQuestionnaires(): Promise<Questionnaire[]> {
  try {
    const colRef = collection(db, 'questionnaires');
    const snap = await getDocs(colRef);
    const list: Questionnaire[] = [];

    if (!snap.empty) {
      for (const qDoc of snap.docs) {
        const fullQ = await getQuestionnaire(qDoc.id);
        if (fullQ) {
          list.push(fullQ);
        }
      }
    }

    // Always ensure default questionnaire is present
    if (list.length === 0) {
      await seedQuestionnaireIfMissing(DEFAULT_QUESTIONNAIRE);
      list.push(DEFAULT_QUESTIONNAIRE);
    }

    return list;
  } catch (err) {
    console.warn('Error fetching questionnaires from Firestore:', err);
    return [DEFAULT_QUESTIONNAIRE];
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

export async function fetchSubmissions(filter?: SubmissionFilter): Promise<Submission[]> {
  try {
    // 1. Fetch from primary `/submissions`
    const colRef = collection(db, 'submissions');
    const snap = await getDocs(colRef);
    const items: Submission[] = [];

    snap.forEach((docSnap) => {
      const d = docSnap.data();
      items.push({
        id: docSnap.id,
        questionnaireId: d.questionnaireId || d.formId || DEFAULT_QUESTIONNAIRE.id,
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

    // 2. Also check `/clientResponses` to merge any legacy submissions from Phase 1
    try {
      const legacyRef = collection(db, 'clientResponses');
      const legacySnap = await getDocs(legacyRef);
      legacySnap.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.isMasterDoc) return; // skip company summary docs
        if (!items.some((existing) => existing.id === docSnap.id)) {
          items.push({
            id: docSnap.id,
            questionnaireId: d.questionnaireId || d.formId || DEFAULT_QUESTIONNAIRE.id,
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
  pendingSubmissions: number;
  completedSubmissions: number;
}

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const [clients, projects, questionnaires, submissions] = await Promise.all([
    fetchClients(),
    fetchProjects(),
    fetchQuestionnaires(),
    fetchSubmissions(),
  ]);

  const activeProjects = projects.filter((p) => p.status === 'active').length;
  const pendingSubmissions = submissions.filter((s) => s.status === 'draft').length;
  const completedSubmissions = submissions.filter((s) => s.status !== 'draft').length;

  return {
    totalClients: clients.length,
    activeProjects,
    totalQuestionnaires: questionnaires.length,
    pendingSubmissions,
    completedSubmissions,
  };
}

// ---------------------------------------------------------------------------
// INITIAL SEED & FALLBACKS
// ---------------------------------------------------------------------------

async function seedInitialClientAndProject(): Promise<Client | null> {
  try {
    const clientId = 'client_abc_distribution';
    const now = new Date().toISOString();
    const initialClient: Client = {
      id: clientId,
      name: 'ABC Company',
      contactPerson: 'Alex Turner',
      contactEmail: 'alex@abccompany.com',
      contactPhone: '+1 (555) 234-5678',
      notes: 'Initial client requesting distribution and operations system specifications.',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(doc(db, 'clients', clientId), sanitize(initialClient));

    // Seed default projects
    const projectId = 'proj_inventory_system';
    const initialProject: Project = {
      id: projectId,
      clientId,
      name: 'Inventory System',
      description: 'Centralized inventory, beverage stock tracking, damage and returns system.',
      questionnaireId: DEFAULT_QUESTIONNAIRE.id,
      assignedQuestionnaireId: DEFAULT_QUESTIONNAIRE.id,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(doc(db, 'projects', projectId), sanitize(initialProject));

    return initialClient;
  } catch (err) {
    console.warn('Could not seed initial client in Firestore:', err);
    return null;
  }
}

function getLocalFallbackClients(): Client[] {
  return [
    {
      id: 'client_abc_distribution',
      name: 'ABC Company',
      contactPerson: 'Alex Turner',
      contactEmail: 'alex@abccompany.com',
      contactPhone: '+1 (555) 234-5678',
      notes: 'Initial client requesting distribution and operations specifications.',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
}

function getLocalFallbackProjects(clientId?: string): Project[] {
  const list: Project[] = [
    {
      id: 'proj_inventory_system',
      clientId: 'client_abc_distribution',
      name: 'Inventory System',
      description: 'Centralized inventory, beverage stock tracking, damage and returns system.',
      questionnaireId: DEFAULT_QUESTIONNAIRE.id,
      assignedQuestionnaireId: DEFAULT_QUESTIONNAIRE.id,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'proj_website',
      clientId: 'client_abc_distribution',
      name: 'Corporate Website',
      description: 'Public marketing website and customer inquiry portal.',
      questionnaireId: DEFAULT_QUESTIONNAIRE.id,
      assignedQuestionnaireId: DEFAULT_QUESTIONNAIRE.id,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  return clientId ? list.filter((p) => p.clientId === clientId) : list;
}
