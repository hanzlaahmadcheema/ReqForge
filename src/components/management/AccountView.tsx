import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Building2,
  Mail,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Eye,
  EyeOff,
  User as UserIcon,
  Calendar,
  Clock,
  Sparkles,
  Link2,
  Unlink,
  RefreshCw,
  Info,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { Workspace, AdminRecord, UserAuthProviders } from '../../types';
import {
  getUserAuthProviders,
  setPasswordForCurrentUser,
  linkGoogleToCurrentUser,
  unlinkProviderFromCurrentUser,
  updateUserDisplayName,
} from '../../lib/adminAuthService';
import { updateWorkspaceName } from '../../lib/workspaceService';
import { copyToClipboard } from '../../lib/clipboardUtils';

interface AccountViewProps {
  currentUser: User | null;
  currentWorkspace: Workspace | null;
  adminRecord: AdminRecord | null;
  onUserUpdated?: (user: User) => void;
  onWorkspaceUpdated?: (workspace: Workspace) => void;
}

export const AccountView: React.FC<AccountViewProps> = ({
  currentUser,
  currentWorkspace,
  adminRecord,
  onUserUpdated,
  onWorkspaceUpdated,
}) => {
  // Provider state
  const [providersInfo, setProvidersInfo] = useState<UserAuthProviders>(() =>
    getUserAuthProviders(currentUser)
  );

  // Sync providersInfo when currentUser prop changes
  useEffect(() => {
    setProvidersInfo(getUserAuthProviders(currentUser));
  }, [currentUser]);

  // Form states for profile & workspace name
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [workspaceName, setWorkspaceName] = useState(currentWorkspace?.name || '');
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingWorkspaceName, setIsSavingWorkspaceName] = useState(false);

  // Password management states
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Google account link / unlink state
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
  const [isUnlinkingProvider, setIsUnlinkingProvider] = useState<string | null>(null);

  // Feedback notifications
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [copiedUid, setCopiedUid] = useState(false);

  const handleCopyUid = async () => {
    if (!currentUser?.uid) return;
    const ok = await copyToClipboard(currentUser.uid);
    if (ok) {
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 2000);
    }
  };

  // 1. Update Display Name
  const handleSaveDisplayName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setStatusMessage({ type: 'error', text: 'Display name cannot be empty.' });
      return;
    }
    setIsSavingName(true);
    setStatusMessage(null);
    try {
      const updatedUser = await updateUserDisplayName(displayName.trim());
      onUserUpdated?.(updatedUser);
      setStatusMessage({ type: 'success', text: 'Display name updated successfully.' });
    } catch (err) {
      console.error('Error updating display name:', err);
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update display name.',
      });
    } finally {
      setIsSavingName(false);
    }
  };

  // 2. Update Workspace Name
  const handleSaveWorkspaceName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace?.id || !workspaceName.trim()) {
      setStatusMessage({ type: 'error', text: 'Workspace name cannot be empty.' });
      return;
    }
    setIsSavingWorkspaceName(true);
    setStatusMessage(null);
    try {
      await updateWorkspaceName(currentWorkspace.id, workspaceName.trim());
      const updatedWs: Workspace = {
        ...currentWorkspace,
        name: workspaceName.trim(),
        updatedAt: new Date().toISOString(),
      };
      onWorkspaceUpdated?.(updatedWs);
      setStatusMessage({ type: 'success', text: 'Workspace name updated successfully.' });
    } catch (err) {
      console.error('Error updating workspace name:', err);
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update workspace name.',
      });
    } finally {
      setIsSavingWorkspaceName(false);
    }
  };

  // 3. Set or Update Password (handles both Google-only account setting password and password changes)
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setStatusMessage({
        type: 'error',
        text: 'Password must be at least 6 characters long.',
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatusMessage({
        type: 'error',
        text: 'Passwords do not match. Please re-enter identical passwords.',
      });
      return;
    }

    setIsSavingPassword(true);
    setStatusMessage(null);
    try {
      const updatedUser = await setPasswordForCurrentUser(newPassword);
      onUserUpdated?.(updatedUser);
      setProvidersInfo(getUserAuthProviders(updatedUser));
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
      setStatusMessage({
        type: 'success',
        text: 'Password configured successfully! You can now sign in using both Google and your email & password.',
      });
    } catch (err: unknown) {
      console.error('Error setting password:', err);
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/requires-recent-login') {
        setStatusMessage({
          type: 'error',
          text: 'This operation is sensitive and requires recent authentication. Please sign out, sign back in, and try again.',
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: err instanceof Error ? err.message : 'Failed to configure password.',
        });
      }
    } finally {
      setIsSavingPassword(false);
    }
  };

  // 4. Attach / Link Google Account (for email-first users)
  const handleLinkGoogle = async () => {
    setIsLinkingGoogle(true);
    setStatusMessage(null);
    try {
      const updatedUser = await linkGoogleToCurrentUser();
      onUserUpdated?.(updatedUser);
      setProvidersInfo(getUserAuthProviders(updatedUser));
      setStatusMessage({
        type: 'success',
        text: 'Google account connected successfully! You can now sign in using "Continue with Google" as well.',
      });
    } catch (err: unknown) {
      console.error('Error linking Google account:', err);
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/credential-already-in-use') {
        setStatusMessage({
          type: 'error',
          text: 'This Google account is already linked to another ReqForge account.',
        });
      } else if (code === 'auth/popup-closed-by-user') {
        setStatusMessage({
          type: 'error',
          text: 'Google authentication was cancelled before completion.',
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: err instanceof Error ? err.message : 'Failed to connect Google account.',
        });
      }
    } finally {
      setIsLinkingGoogle(false);
    }
  };

  // 5. Disconnect / Unlink a Provider
  const handleUnlinkProvider = async (providerId: string, providerName: string) => {
    if (providersInfo.providers.length <= 1) {
      setStatusMessage({
        type: 'error',
        text: 'You must maintain at least one active sign-in method.',
      });
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to disconnect ${providerName}? You will no longer be able to sign in using this method.`
    );
    if (!confirmed) return;

    setIsUnlinkingProvider(providerId);
    setStatusMessage(null);
    try {
      const updatedUser = await unlinkProviderFromCurrentUser(providerId);
      onUserUpdated?.(updatedUser);
      setProvidersInfo(getUserAuthProviders(updatedUser));
      setStatusMessage({
        type: 'success',
        text: `${providerName} disconnected successfully.`,
      });
    } catch (err) {
      console.error(`Error unlinking ${providerId}:`, err);
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : `Failed to disconnect ${providerName}.`,
      });
    } finally {
      setIsUnlinkingProvider(null);
    }
  };

  const hasMultipleProviders = providersInfo.hasGoogle && providersInfo.hasPassword;

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-150">
      {/* View Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-stone-200/90 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-stone-900 text-white flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <h1 className="text-lg sm:text-xl font-black text-stone-900 tracking-tight">
                Account &amp; Security
              </h1>
            </div>
            <p className="text-xs text-stone-500">
              Manage your credentials, multi-method sign-in, and isolated workspace identity.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-800 border border-stone-200">
              <Building2 className="w-3.5 h-3.5 text-stone-500" />
              <span className="truncate max-w-[150px]">{currentWorkspace?.name || 'Workspace'}</span>
            </span>

            {hasMultipleProviders ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                Google + Password
              </span>
            ) : providersInfo.hasGoogle ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                Google Only
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-800 border border-stone-200">
                Password Only
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Status Notifications */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-xs flex items-start justify-between gap-3 animate-in fade-in ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
              : 'bg-amber-50 border border-amber-200 text-amber-900'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            )}
            <span className="font-medium leading-relaxed">{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-stone-400 hover:text-stone-700 font-bold px-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* SECTION 1: CONNECTED SIGN-IN METHODS (PRIMARY FEATURE) */}
      <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-stone-100">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound className="w-4 h-4 text-stone-700" />
            <h2 className="text-sm font-black text-stone-900 uppercase tracking-wider">
              Connected Sign-In Methods
            </h2>
          </div>
          <p className="text-xs text-stone-500">
            You can sign in with Google, Email and Password, or both. Both methods connect to the
            exact same workspace, clients, and project questionnaires.
          </p>
        </div>

        <div className="divide-y divide-stone-100">
          {/* METHOD A: GOOGLE SIGN-IN */}
          <div className="p-5 sm:p-6 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-stone-900">Google Account</h3>
                    {providersInfo.hasGoogle ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <Check className="w-3 h-3 text-emerald-600" />
                        Connected
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 border border-stone-200">
                        Not Connected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {providersInfo.hasGoogle
                      ? `Signed in with ${providersInfo.googleEmail || currentUser?.email || 'Google'}. You can click "Continue with Google" on the login screen.`
                      : 'Attach your Google account to sign in with one click without typing your password.'}
                  </p>
                </div>
              </div>

              {/* Google Actions */}
              <div className="shrink-0 flex items-center gap-2 self-start sm:self-center">
                {providersInfo.hasGoogle ? (
                  providersInfo.hasPassword ? (
                    <button
                      type="button"
                      onClick={() => handleUnlinkProvider('google.com', 'Google Account')}
                      disabled={isUnlinkingProvider === 'google.com'}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-stone-600 hover:text-red-700 hover:bg-red-50 border border-stone-200 hover:border-red-200 transition-colors cursor-pointer disabled:opacity-50 min-h-[38px]"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                      <span>{isUnlinkingProvider === 'google.com' ? 'Disconnecting...' : 'Disconnect Google'}</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-stone-400 italic">Sole sign-in method</span>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={handleLinkGoogle}
                    disabled={isLinkingGoogle}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-stone-50 text-stone-900 border border-stone-300 hover:border-stone-400 text-xs font-bold shadow-2xs transition-all cursor-pointer disabled:opacity-50 min-h-[38px]"
                  >
                    <Link2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>{isLinkingGoogle ? 'Connecting...' : 'Connect Google Account'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* METHOD B: EMAIL & PASSWORD SIGN-IN */}
          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-stone-700" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-stone-900">Email &amp; Password</h3>
                    {providersInfo.hasPassword ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <Check className="w-3 h-3 text-emerald-600" />
                        Password Set
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                        No Password Set
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {providersInfo.hasPassword
                      ? `You can sign in with ${currentUser?.email} and your password.`
                      : `You originally signed up with Google. Set a password below so you can sign in with ${currentUser?.email} and password anytime.`}
                  </p>
                </div>
              </div>

              {/* Password Action Buttons */}
              <div className="shrink-0 flex items-center gap-2 self-start sm:self-center">
                {providersInfo.hasPassword ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPasswordForm(!showPasswordForm);
                        setStatusMessage(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-stone-800 bg-stone-100 hover:bg-stone-200 border border-stone-200 transition-colors cursor-pointer min-h-[38px]"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>{showPasswordForm ? 'Cancel' : 'Change Password'}</span>
                    </button>

                    {providersInfo.hasGoogle && (
                      <button
                        type="button"
                        onClick={() => handleUnlinkProvider('password', 'Email & Password')}
                        disabled={isUnlinkingProvider === 'password'}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-stone-600 hover:text-red-700 hover:bg-red-50 border border-stone-200 hover:border-red-200 transition-colors cursor-pointer disabled:opacity-50 min-h-[38px]"
                        title="Remove password and use Google only"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                        <span>{isUnlinkingProvider === 'password' ? 'Removing...' : 'Remove Password'}</span>
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordForm(!showPasswordForm);
                      setStatusMessage(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold shadow-xs transition-all cursor-pointer min-h-[38px]"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{showPasswordForm ? 'Cancel' : 'Set Account Password'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* PASSWORD CONFIGURATION / CHANGE FORM */}
            {showPasswordForm && (
              <form
                onSubmit={handleSavePassword}
                className="p-4 sm:p-5 rounded-xl bg-stone-50 border border-stone-200/90 space-y-4 animate-in fade-in"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-stone-800">
                  <KeyRound className="w-4 h-4 text-stone-600" />
                  <span>
                    {providersInfo.hasPassword ? 'Change Account Password' : 'Set Account Password for Email Sign-In'}
                  </span>
                </div>

                {!providersInfo.hasPassword && (
                  <p className="text-xs text-stone-600 bg-white p-3 rounded-lg border border-stone-200">
                    Once set, you will be able to log in to this workspace using <strong>{currentUser?.email}</strong> and
                    this password, as well as via "Continue with Google".
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      New Password (min. 6 characters)
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswordText ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        minLength={6}
                        className="w-full pl-3 pr-10 py-2 rounded-xl border border-stone-300 text-xs bg-white focus:ring-2 focus:ring-stone-900 focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordText(!showPasswordText)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                      >
                        {showPasswordText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Confirm Password
                    </label>
                    <input
                      type={showPasswordText ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs bg-white focus:ring-2 focus:ring-stone-900 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setNewPassword('');
                      setConfirmPassword('');
                    }}
                    className="px-3 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingPassword || !newPassword}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 min-h-[38px]"
                  >
                    {isSavingPassword ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving Password...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>{providersInfo.hasPassword ? 'Update Password' : 'Save Password & Enable Email Sign-In'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 2: WORKSPACE & PROFILE SETTINGS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Card */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-stone-200/90 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
            <UserIcon className="w-4 h-4 text-stone-700" />
            <h2 className="text-sm font-black text-stone-900 uppercase tracking-wider">
              User Profile
            </h2>
          </div>

          <form onSubmit={handleSaveDisplayName} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Display Name
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Acme Studio"
                  className="flex-1 px-3 py-2 rounded-xl border border-stone-300 text-xs focus:ring-2 focus:ring-stone-900 focus:outline-hidden"
                />
                <button
                  type="submit"
                  disabled={isSavingName || displayName === (currentUser?.displayName || '')}
                  className="px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shrink-0 min-h-[38px]"
                >
                  {isSavingName ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Primary Account Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={currentUser?.email || ''}
                  disabled
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-200 text-xs bg-stone-50 text-stone-600 cursor-not-allowed"
                />
              </div>
              <p className="text-[11px] text-stone-400 mt-1">
                Managed via Firebase Authentication provider.
              </p>
            </div>
          </form>
        </div>

        {/* Workspace Identity Card */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-stone-200/90 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
            <Building2 className="w-4 h-4 text-stone-700" />
            <h2 className="text-sm font-black text-stone-900 uppercase tracking-wider">
              Workspace Identity
            </h2>
          </div>

          <form onSubmit={handleSaveWorkspaceName} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Workspace Name
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="e.g. My Agency Workspace"
                  className="flex-1 px-3 py-2 rounded-xl border border-stone-300 text-xs focus:ring-2 focus:ring-stone-900 focus:outline-hidden"
                />
                <button
                  type="submit"
                  disabled={
                    isSavingWorkspaceName ||
                    workspaceName === (currentWorkspace?.name || '')
                  }
                  className="px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shrink-0 min-h-[38px]"
                >
                  {isSavingWorkspaceName ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Tenant Workspace ID (UID)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={currentUser?.uid || ''}
                  disabled
                  className="flex-1 px-3 py-2 rounded-xl border border-stone-200 text-xs bg-stone-50 font-mono text-stone-600 cursor-not-allowed truncate"
                />
                <button
                  type="button"
                  onClick={handleCopyUid}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-stone-200 hover:bg-stone-100 text-stone-700 text-xs font-bold transition-colors cursor-pointer shrink-0 min-h-[38px]"
                  title="Copy Workspace UID"
                >
                  {copiedUid ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUid ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* SECTION 3: SYSTEM METADATA & MULTI-TENANT ARCHITECTURE */}
      <div className="p-5 bg-stone-50 rounded-2xl border border-stone-200/90 text-xs text-stone-600 space-y-3">
        <div className="flex items-center gap-2 font-bold text-stone-900">
          <Info className="w-4 h-4 text-stone-500" />
          <span>Multi-Method Authentication &amp; Multi-Tenant Guarantees</span>
        </div>
        <p className="leading-relaxed">
          In ReqForge, <strong>1 registered user = 1 isolated workspace</strong>. Regardless of whether you sign in with
          Google or with Email and Password, your authentication token maps directly to your workspace ID:{' '}
          <code className="px-1.5 py-0.5 rounded bg-stone-200/80 font-mono text-[11px] text-stone-800">
            {currentUser?.uid}
          </code>
          . All clients, projects, questionnaire definitions, and submission records are strictly isolated.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-stone-500 pt-2 border-t border-stone-200/70">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-stone-400" />
            <span>
              Account Created:{' '}
              {currentUser?.metadata?.creationTime
                ? new Date(currentUser.metadata.creationTime).toLocaleString()
                : 'N/A'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-stone-400" />
            <span>
              Last Sign-In:{' '}
              {currentUser?.metadata?.lastSignInTime
                ? new Date(currentUser.metadata.lastSignInTime).toLocaleString()
                : 'N/A'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
