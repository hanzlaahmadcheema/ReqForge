import React, { useState } from 'react';
import {
  Users,
  Plus,
  Search,
  Building2,
  Mail,
  Phone,
  FolderKanban,
  FileCheck2,
  FileQuestion,
  Edit2,
  Archive,
  RotateCcw,
  Eye,
  ArrowLeft,
  Share2,
  FileDown,
  X,
  Check,
} from 'lucide-react';
import { Client, Project, Questionnaire, Submission } from '../../types';

interface ClientsViewProps {
  clients: Client[];
  projects: Project[];
  questionnaires?: Questionnaire[];
  submissions: Submission[];
  onCreateClient: (data: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateClient: (id: string, data: Partial<Omit<Client, 'id' | 'createdAt'>>) => Promise<void>;
  onArchiveClient: (id: string, archive: boolean) => Promise<void>;
  onCreateProjectForClient: (clientId: string) => void;
  onOpenShareLink: (project: Project) => void;
  onViewSubmission: (sub: Submission) => void;
  onDownloadPdf: (sub: Submission) => void;
}

export const ClientsView: React.FC<ClientsViewProps> = ({
  clients,
  projects,
  questionnaires = [],
  submissions,
  onCreateClient,
  onUpdateClient,
  onArchiveClient,
  onCreateProjectForClient,
  onOpenShareLink,
  onViewSubmission,
  onDownloadPdf,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Form states for create / edit
  const [formName, setFormName] = useState('');
  const [formContactPerson, setFormContactPerson] = useState('');
  const [formContactEmail, setFormContactEmail] = useState('');
  const [formContactPhone, setFormContactPhone] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formStatus, setFormStatus] = useState<'active' | 'archived'>('active');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Open Create Modal
  const handleOpenCreate = () => {
    setFormName('');
    setFormContactPerson('');
    setFormContactEmail('');
    setFormContactPhone('');
    setFormNotes('');
    setFormStatus('active');
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (client: Client) => {
    setEditingClient(client);
    setFormName(client.name);
    setFormContactPerson(client.contactPerson || '');
    setFormContactEmail(client.contactEmail || '');
    setFormContactPhone(client.contactPhone || '');
    setFormNotes(client.notes || '');
    setFormStatus(client.status);
  };

  // Submit Create or Edit
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    setFormSubmitting(true);
    try {
      if (editingClient) {
        await onUpdateClient(editingClient.id, {
          name: formName.trim(),
          contactPerson: formContactPerson.trim() || undefined,
          contactEmail: formContactEmail.trim() || undefined,
          contactPhone: formContactPhone.trim() || undefined,
          notes: formNotes.trim() || undefined,
          status: formStatus,
        });

        if (selectedClient && selectedClient.id === editingClient.id) {
          setSelectedClient({
            ...selectedClient,
            name: formName.trim(),
            contactPerson: formContactPerson.trim() || undefined,
            contactEmail: formContactEmail.trim() || undefined,
            contactPhone: formContactPhone.trim() || undefined,
            notes: formNotes.trim() || undefined,
            status: formStatus,
            updatedAt: new Date().toISOString(),
          });
        }
        setEditingClient(null);
      } else {
        await onCreateClient({
          name: formName.trim(),
          contactPerson: formContactPerson.trim() || undefined,
          contactEmail: formContactEmail.trim() || undefined,
          contactPhone: formContactPhone.trim() || undefined,
          notes: formNotes.trim() || undefined,
          status: formStatus,
        });
        setIsCreateModalOpen(false);
      }
    } catch (err) {
      console.error('Error saving client:', err);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Filter clients
  const filteredClients = clients.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.name.toLowerCase().includes(q);
      const matchContact = (c.contactPerson || '').toLowerCase().includes(q);
      const matchEmail = (c.contactEmail || '').toLowerCase().includes(q);
      const matchPhone = (c.contactPhone || '').toLowerCase().includes(q);
      const matchNotes = (c.notes || '').toLowerCase().includes(q);
      if (!matchName && !matchContact && !matchEmail && !matchPhone && !matchNotes) return false;
    }
    return true;
  });

  // Client Details View
  if (selectedClient) {
    const clientProjects = projects.filter((p) => p.clientId === selectedClient.id);
    const clientSubmissions = submissions.filter(
      (s) =>
        s.clientId === selectedClient.id ||
        s.clientCode?.toLowerCase() === selectedClient.name?.toLowerCase()
    );

    return (
      <div className="space-y-6 animate-in fade-in duration-150">
        {/* Breadcrumb & Navigation */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSelectedClient(null)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Clients</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenEdit(selectedClient)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-50 text-xs font-semibold text-stone-700 cursor-pointer transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Details</span>
            </button>
            <button
              type="button"
              onClick={() => onArchiveClient(selectedClient.id, selectedClient.status !== 'archived')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-50 text-xs font-semibold text-stone-700 cursor-pointer transition-colors"
            >
              {selectedClient.status === 'archived' ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Unarchive</span>
                </>
              ) : (
                <>
                  <Archive className="w-3.5 h-3.5 text-amber-600" />
                  <span>Archive</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Client Profile Header Card */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-stone-900 text-white flex items-center justify-center font-bold text-lg shadow-xs">
                {selectedClient.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-black text-stone-900 tracking-tight">{selectedClient.name}</h2>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                      selectedClient.status === 'active'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-stone-200 text-stone-700'
                    }`}
                  >
                    {selectedClient.status}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  Client Record ID: <span className="font-mono text-stone-700">{selectedClient.id}</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onCreateProjectForClient(selectedClient.id)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Project for this Client</span>
            </button>
          </div>

          {/* Contact Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-stone-100 text-xs">
            <div className="p-3 bg-stone-50 rounded-xl">
              <span className="text-[11px] text-stone-400 font-semibold uppercase block">Contact Person</span>
              <span className="font-semibold text-stone-800 mt-0.5 block">
                {selectedClient.contactPerson || 'Not provided'}
              </span>
            </div>
            <div className="p-3 bg-stone-50 rounded-xl">
              <span className="text-[11px] text-stone-400 font-semibold uppercase block">Email Address</span>
              <span className="font-semibold text-stone-800 mt-0.5 block truncate">
                {selectedClient.contactEmail || 'Not provided'}
              </span>
            </div>
            <div className="p-3 bg-stone-50 rounded-xl">
              <span className="text-[11px] text-stone-400 font-semibold uppercase block">Phone Number</span>
              <span className="font-semibold text-stone-800 mt-0.5 block">
                {selectedClient.contactPhone || 'Not provided'}
              </span>
            </div>
          </div>

          {selectedClient.notes && (
            <div className="p-3.5 bg-stone-50 rounded-xl text-xs space-y-1">
              <span className="text-[11px] text-stone-400 font-semibold uppercase block">Client Notes</span>
              <p className="text-stone-700 whitespace-pre-wrap leading-relaxed">{selectedClient.notes}</p>
            </div>
          )}
        </div>

        {/* Client Projects Section */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-stone-900">Projects ({clientProjects.length})</h3>
              <p className="text-xs text-stone-500">Active systems and applications under {selectedClient.name}</p>
            </div>
            <button
              type="button"
              onClick={() => onCreateProjectForClient(selectedClient.id)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:text-stone-900 hover:bg-stone-100 rounded-lg cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Project</span>
            </button>
          </div>

          {clientProjects.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-stone-200 rounded-xl text-xs text-stone-400 space-y-2">
              <FolderKanban className="w-8 h-8 mx-auto text-stone-300" />
              <p>No projects created for this client yet.</p>
              <button
                type="button"
                onClick={() => onCreateProjectForClient(selectedClient.id)}
                className="px-3 py-1.5 bg-stone-900 text-white rounded-lg font-semibold hover:bg-stone-800 cursor-pointer"
              >
                Create First Project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clientProjects.map((proj) => (
                <div
                  key={proj.id}
                  className="p-4 rounded-xl border border-stone-200 hover:border-stone-300 bg-stone-50/40 hover:bg-white transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-stone-900">{proj.name}</h4>
                      <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">{proj.description || 'No description provided'}</p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 bg-stone-200 text-stone-700 rounded-full shrink-0">
                      {proj.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                    <span className="text-[11px] text-stone-400">
                      Assigned: {proj.questionnaireId ? 'Questionnaire Bound' : 'Default Questionnaire'}
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenShareLink(proj)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold cursor-pointer shadow-2xs"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share Link</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Assigned Questionnaires Section */}
        {(() => {
          const assignedQuestionnaireIds = new Set<string>();
          clientProjects.forEach((p) => {
            if (p.questionnaireId) assignedQuestionnaireIds.add(p.questionnaireId);
            if (p.assignedQuestionnaireId) assignedQuestionnaireIds.add(p.assignedQuestionnaireId);
            p.assignedQuestionnaires?.forEach((a) => assignedQuestionnaireIds.add(a.questionnaireId));
          });

          const clientAssignedQuestionnaires = questionnaires.filter(
            (q) => assignedQuestionnaireIds.has(q.id) || q.clientId === selectedClient.id
          );

          return (
            <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-stone-900">
                    Assigned Questionnaires ({clientAssignedQuestionnaires.length})
                  </h3>
                  <p className="text-xs text-stone-500">
                    Questionnaire schemas mapped to {selectedClient.name}'s systems
                  </p>
                </div>
              </div>

              {clientAssignedQuestionnaires.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-stone-200 rounded-xl text-xs text-stone-400 space-y-1">
                  <FileQuestion className="w-8 h-8 mx-auto text-stone-300" />
                  <p>No questionnaires currently assigned to this client's projects.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {clientAssignedQuestionnaires.map((q) => {
                    const linkedProjects = clientProjects.filter(
                      (p) =>
                        p.questionnaireId === q.id ||
                        p.assignedQuestionnaireId === q.id ||
                        p.assignedQuestionnaires?.some((a) => a.questionnaireId === q.id)
                    );

                    return (
                      <div
                        key={q.id}
                        className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/40 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-bold text-xs text-stone-900">{q.title}</h4>
                            <p className="text-[11px] text-stone-500 line-clamp-1 mt-0.5">
                              {q.description || 'Requirements specifications template'}
                            </p>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full shrink-0">
                            v{q.version} • {q.status}
                          </span>
                        </div>

                        <div className="text-[11px] text-stone-500 pt-1.5 border-t border-stone-100 flex items-center justify-between">
                          <span>{q.sections?.length || 0} Sections</span>
                          <span className="text-stone-400">
                            {linkedProjects.length > 0
                              ? `Used by: ${linkedProjects.map((p) => p.name).join(', ')}`
                              : 'Client Specific'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Client Submissions Section */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-stone-900">Submissions ({clientSubmissions.length})</h3>
              <p className="text-xs text-stone-500">Requirements submitted by or recorded for {selectedClient.name}</p>
            </div>
          </div>

          {clientSubmissions.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-stone-200 rounded-xl text-xs text-stone-400 space-y-1">
              <FileCheck2 className="w-8 h-8 mx-auto text-stone-300" />
              <p>No questionnaire submissions recorded for this client yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-stone-100 border border-stone-200 rounded-xl overflow-hidden">
              {clientSubmissions.map((sub) => {
                const date = new Date(sub.submittedAtIso).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });
                return (
                  <div key={sub.id} className="p-4 flex items-center justify-between gap-4 hover:bg-stone-50/60 transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-stone-900">{sub.id}</span>
                        <span className="text-[10px] font-bold px-2 py-0.2 bg-emerald-100 text-emerald-800 rounded-full">
                          {sub.status || 'submitted'}
                        </span>
                      </div>
                      <span className="text-xs text-stone-400 mt-0.5 block">
                        Submitted: {date} {sub.contactPerson ? `by ${sub.contactPerson}` : ''}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onViewSubmission(sub)}
                        className="px-3 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-100 text-xs font-semibold text-stone-700 cursor-pointer"
                      >
                        Inspect Answers
                      </button>
                      <button
                        type="button"
                        onClick={() => onDownloadPdf(sub)}
                        className="p-1.5 rounded-lg border border-stone-300 hover:bg-stone-100 text-stone-600 hover:text-stone-900 cursor-pointer"
                        title="Download PDF"
                      >
                        <FileDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Clients Directory List View
  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">Clients Management</h2>
          <p className="text-xs text-stone-500">Manage client organizations, linked projects, and specifications</p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Client</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-stone-200 shadow-2xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search clients by name, contact, email, or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-transparent text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl shrink-0">
          {(['all', 'active', 'archived'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Clients Table / Cards */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs">
        {filteredClients.length === 0 ? (
          <div className="text-center py-16 text-xs text-stone-400 space-y-2">
            <Users className="w-10 h-10 mx-auto text-stone-300" />
            <p>No clients found matching your search.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-600">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Client Organization</th>
                  <th className="py-3 px-4">Primary Contact</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Projects</th>
                  <th className="py-3 px-4">Submissions</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredClients.map((client) => {
                  const clientProjectsCount = projects.filter((p) => p.clientId === client.id).length;
                  const clientSubsCount = submissions.filter(
                    (s) =>
                      s.clientId === client.id ||
                      s.clientCode?.toLowerCase() === client.name?.toLowerCase()
                  ).length;

                  return (
                    <tr
                      key={client.id}
                      className="hover:bg-stone-50/70 transition-colors group cursor-pointer"
                      onClick={() => setSelectedClient(client)}
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-stone-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                            {client.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-stone-900 block group-hover:text-black">
                              {client.name}
                            </span>
                            <span className="text-[11px] text-stone-400">{client.id}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div>
                          <span className="font-medium text-stone-800 block">
                            {client.contactPerson || '—'}
                          </span>
                          <span className="text-[11px] text-stone-400 block truncate max-w-[180px]">
                            {client.contactEmail || client.contactPhone || 'No contact info'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                            client.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-stone-200 text-stone-700'
                          }`}
                        >
                          {client.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-stone-800">
                        {clientProjectsCount}
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-stone-800">
                        {clientSubsCount}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div
                          className="inline-flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedClient(client)}
                            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 cursor-pointer"
                            title="View Client Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(client)}
                            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 cursor-pointer"
                            title="Edit Client"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Create or Edit Client */}
      {(isCreateModalOpen || editingClient) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50">
              <h3 className="text-sm font-bold text-stone-900">
                {editingClient ? 'Edit Client Record' : 'Create New Client'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setEditingClient(null);
                }}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-stone-700 block mb-1">
                  Company / Client Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Corporation"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">Contact Person</label>
                <input
                  type="text"
                  placeholder="e.g. Jane Doe"
                  value={formContactPerson}
                  onChange={(e) => setFormContactPerson(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="contact@company.com"
                    value={formContactEmail}
                    onChange={(e) => setFormContactEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                  />
                </div>
                <div>
                  <label className="font-semibold text-stone-700 block mb-1">Phone</label>
                  <input
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={formContactPhone}
                    onChange={(e) => setFormContactPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">Notes</label>
                <textarea
                  rows={3}
                  placeholder="General notes or business requirements context..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                />
              </div>

              <div>
                <label className="font-semibold text-stone-700 block mb-1">Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as 'active' | 'archived')}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                >
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setEditingClient(null);
                  }}
                  className="px-3.5 py-2 text-stone-600 hover:bg-stone-100 rounded-xl font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting || !formName.trim()}
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white rounded-xl font-bold transition-colors cursor-pointer shadow-xs"
                >
                  {formSubmitting ? 'Saving...' : editingClient ? 'Save Changes' : 'Create Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
