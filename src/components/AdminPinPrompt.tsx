/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ArrowLeft,
  ShieldAlert,
  LogIn,
  UserPlus,
  Building2,
  CheckCircle2,
  Mail,
  KeyRound,
  User as UserIcon,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  saveStoredAdminSession,
} from '../lib/adminAuthService';
import { AdminRecord, Workspace } from '../types';

interface AdminPinPromptProps {
  onSuccess: (user: User, workspace: Workspace, adminRecord: AdminRecord | null) => void;
  onCancel: () => void;
}

export const AdminPinPrompt: React.FC<AdminPinPromptProps> = ({ onSuccess, onCancel }) => {
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setAuthLoading(true);
    setErrorMessage(null);

    try {
      const { user, workspace, adminRecord } = await signInWithEmail(email.trim(), password);
      if (adminRecord && adminRecord.enabled) {
        saveStoredAdminSession(adminRecord);
      }
      onSuccess(user, workspace, adminRecord);
    } catch (err: unknown) {
      console.warn('Email Sign-in error:', err);
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setErrorMessage('Invalid email or password. Please check your credentials and try again.');
      } else if (code === 'auth/too-many-requests') {
        setErrorMessage('Access temporarily blocked due to multiple failed attempts. Please try again later.');
      } else {
        setErrorMessage(err instanceof Error ? err.message : 'Sign in failed. Please try again.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage('Please provide an email and password.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setAuthLoading(true);
    setErrorMessage(null);

    try {
      const { user, workspace, adminRecord } = await signUpWithEmail(
        email.trim(),
        password,
        displayName.trim() || undefined
      );
      if (adminRecord && adminRecord.enabled) {
        saveStoredAdminSession(adminRecord);
      }
      onSuccess(user, workspace, adminRecord);
    } catch (err: unknown) {
      console.warn('Email Sign-up error:', err);
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/email-already-in-use') {
        setErrorMessage('An account with this email address already exists. Please sign in instead.');
      } else if (code === 'auth/weak-password') {
        setErrorMessage('Password is too weak. Please use at least 6 characters.');
      } else {
        setErrorMessage(err instanceof Error ? err.message : 'Sign up failed. Please try again.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setErrorMessage(null);

    try {
      const { user, workspace, adminRecord } = await signInWithGoogle();
      if (adminRecord && adminRecord.enabled) {
        saveStoredAdminSession(adminRecord);
      }
      onSuccess(user, workspace, adminRecord);
    } catch (err: unknown) {
      console.warn('Google Sign-in error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to authenticate with Google.';
      const errCode = (err as { code?: string })?.code || '';

      if (errCode === 'auth/popup-closed-by-user' || msg.includes('popup-closed-by-user')) {
        setErrorMessage('Google sign-in was cancelled before completion.');
      } else if (errCode === 'auth/unauthorized-domain' || msg.includes('unauthorized-domain')) {
        const host = typeof window !== 'undefined' ? window.location.hostname : 'current domain';
        setErrorMessage(
          `Unauthorized Domain (${host}): In Firebase Console, add "${host}" to Authentication > Settings > Authorized domains.`
        );
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100/90 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-stone-200/90 p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">
        {/* Header Icon & Title */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-stone-900 text-white rounded-2xl flex items-center justify-center mx-auto shadow-xs">
            <Building2 className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-stone-900">ReqForge Workspace</h1>
          <p className="text-xs text-stone-500 max-w-xs mx-auto">
            1 registered user = 1 isolated workspace. Manage your own clients, questionnaires, and client submissions.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex rounded-xl bg-stone-100 p-1 border border-stone-200/80">
          <button
            type="button"
            onClick={() => {
              setTab('signin');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              tab === 'signin'
                ? 'bg-white text-stone-950 shadow-xs font-bold'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('signup');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              tab === 'signup'
                ? 'bg-white text-stone-950 shadow-xs font-bold'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            Create Workspace
          </button>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* SIGN IN FORM */}
        {tab === 'signin' && (
          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    required
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-stone-300 text-xs focus:ring-2 focus:ring-stone-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-stone-300 text-xs focus:ring-2 focus:ring-stone-900 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 min-h-[44px]"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{authLoading ? 'Signing In...' : 'Sign In to Workspace'}</span>
            </button>
          </form>
        )}

        {/* SIGN UP FORM */}
        {tab === 'signup' && (
          <form onSubmit={handleEmailSignUp} className="space-y-4">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Your Name or Company
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Acme Studio"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-stone-300 text-xs focus:ring-2 focus:ring-stone-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    required
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-stone-300 text-xs focus:ring-2 focus:ring-stone-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Password (min. 6 characters)
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-stone-300 text-xs focus:ring-2 focus:ring-stone-900 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 min-h-[44px]"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{authLoading ? 'Creating Workspace...' : 'Create Account & Workspace'}</span>
            </button>
          </form>
        )}

        {/* GOOGLE SIGN IN DIVIDER & BUTTON */}
        <div className="relative flex py-1 items-center">
          <div className="grow border-t border-stone-200"></div>
          <span className="shrink mx-3 text-stone-400 text-[11px] uppercase font-semibold">
            Or continue with
          </span>
          <div className="grow border-t border-stone-200"></div>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={authLoading}
          className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-stone-300 hover:border-stone-400 bg-white hover:bg-stone-50 text-stone-800 font-semibold text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50 min-h-[44px]"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
          <span>{authLoading ? 'Signing In with Google...' : 'Continue with Google'}</span>
        </button>

        {/* Security Note */}
        <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 text-[11px] text-stone-500 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-stone-700">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Strict Workspace Isolation</span>
          </div>
          <p>
            Your projects, clients, and questionnaire submissions are strictly isolated in your workspace. Other users cannot access or view your records.
          </p>
        </div>

        {/* Return to Home / Questionnaire */}
        <div className="pt-2 border-t border-stone-100 text-center">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Home</span>
          </button>
        </div>
      </div>
    </div>
  );
};
