import React, { useState } from 'react';
import {
  Share2,
  Copy,
  Check,
  ExternalLink,
  X,
  Building2,
  FolderKanban,
  FileText,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Ban,
} from 'lucide-react';
import { Project, Client } from '../../types';
import { updateProjectShareLink, updateProject } from '../../lib/managementService';

interface ShareLinkModalProps {
  project: Project;
  client?: Client | null;
  onClose: () => void;
  onProjectUpdated?: (updated: Project) => void;
}

export const ShareLinkModal: React.FC<ShareLinkModalProps> = ({
  project,
  client,
  onClose,
  onProjectUpdated,
}) => {
  const [copied, setCopied] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<'active' | 'revoked'>(
    project.shareLinkStatus || 'active'
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeToken] = useState<string>(() => {
    return project.shareToken || `st_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
  });

  // Ensure missing shareToken is saved to Firestore
  React.useEffect(() => {
    if (!project.shareToken) {
      updateProject(project.id, { shareToken: activeToken }).catch(console.warn);
      if (onProjectUpdated) {
        onProjectUpdated({ ...project, shareToken: activeToken });
      }
    }
  }, [project, activeToken, onProjectUpdated]);

  // Construct secure URL with project identifier and required authorization share token
  const origin = window.location.origin;
  const token = project.shareToken || activeToken;
  const shareUrl = `${origin}/?project=${project.id}&token=${token}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleToggleRevoke = async () => {
    const nextStatus = currentStatus === 'active' ? 'revoked' : 'active';
    setIsUpdating(true);
    try {
      await updateProjectShareLink(project.id, nextStatus);
      setCurrentStatus(nextStatus);
      const updatedProject: Project = {
        ...project,
        shareLinkStatus: nextStatus,
      };
      if (onProjectUpdated) {
        onProjectUpdated(updatedProject);
      }
    } catch (err) {
      console.error('Failed updating share link status:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const isRevoked = currentStatus === 'revoked';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-lg w-full max-h-[90dvh] overflow-y-auto shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Mobile drag handle */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-stone-300" />
        </div>

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-stone-900 text-white shadow-xs">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-stone-900">Client Questionnaire Link</h3>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                    isRevoked
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {isRevoked ? (
                    <>
                      <Ban className="w-3 h-3 text-rose-600" />
                      Revoked
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      Active
                    </>
                  )}
                </span>
              </div>
              <p className="text-xs text-stone-500">Share this link with your client to collect requirements</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-lg transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 pb-safe sm:pb-6">
          {/* Associated metadata pills */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 text-xs">
            <div className="flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-stone-500 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-stone-400 uppercase tracking-wider block font-semibold">Client</span>
                <span className="font-semibold text-stone-800 truncate block">{client?.name || 'Assigned Client'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FolderKanban className="w-3.5 h-3.5 text-stone-500 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-stone-400 uppercase tracking-wider block font-semibold">Project</span>
                <span className="font-semibold text-stone-800 truncate block">{project.name}</span>
              </div>
            </div>
          </div>

          {/* Share Link Input Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-stone-700 block">Direct Questionnaire URL</label>
              {isRevoked && (
                <span className="text-[11px] font-medium text-rose-600 flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" />
                  Link is deactivated
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                disabled={isRevoked}
                className={`w-full px-3.5 py-2.5 rounded-xl text-base sm:text-xs font-mono select-all focus:outline-none focus:ring-2 min-h-[44px] sm:min-h-0 ${
                  isRevoked
                    ? 'bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed line-through'
                    : 'bg-stone-50 border border-stone-200 text-stone-800 focus:ring-stone-900/10'
                }`}
              />
              <button
                type="button"
                onClick={handleCopy}
                disabled={isRevoked}
                className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shrink-0 min-h-[44px] sm:min-h-0 active:scale-[0.98] ${
                  isRevoked
                    ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                    : copied
                    ? 'bg-emerald-600 text-white cursor-pointer'
                    : 'bg-stone-900 hover:bg-stone-800 text-white cursor-pointer'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Link Status & Control Box */}
          <div
            className={`p-4 rounded-xl border text-xs space-y-3 ${
              isRevoked
                ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                : 'bg-blue-50/60 border-blue-100 text-blue-900'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  {isRevoked ? (
                    <>
                      <ShieldAlert className="w-4 h-4 text-rose-600" />
                      <span className="text-rose-950 font-bold">Link Revoked</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span className="text-blue-950 font-bold">Automatic Client & Project Binding</span>
                    </>
                  )}
                </div>
                <p className="text-[11px] leading-relaxed opacity-90">
                  {isRevoked
                    ? 'This link has been deactivated. Any client who attempts to open this questionnaire will see a notice that the link has been revoked.'
                    : `Opening this link automatically pre-fills the project and client for ${client?.name || 'this client'} and saves all progress directly to ${project.name}.`}
                </p>
              </div>
            </div>

            {/* Revoke / Reactivate Button */}
            <div className="pt-2 border-t border-black/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-stone-500">
                {isRevoked ? 'Need to allow submissions again?' : 'Need to close or pause submissions?'}
              </span>
              <button
                type="button"
                onClick={handleToggleRevoke}
                disabled={isUpdating}
                className={`w-full sm:w-auto px-3 py-2 sm:py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[38px] sm:min-h-0 active:scale-[0.98] ${
                  isRevoked
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-rose-100 hover:bg-rose-200 text-rose-800'
                }`}
              >
                {isUpdating ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : isRevoked ? (
                  <>
                    <RefreshCw className="w-3 h-3" />
                    <span>Re-activate Link</span>
                  </>
                ) : (
                  <>
                    <Ban className="w-3 h-3 text-rose-600" />
                    <span>Revoke Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-stone-100">
            {!isRevoked ? (
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 hover:underline min-h-[40px] sm:min-h-0"
              >
                <span>Test Client Form</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : (
              <span className="text-xs text-stone-400 italic">Preview disabled while revoked</span>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer min-h-[40px] sm:min-h-0 active:scale-[0.98]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
