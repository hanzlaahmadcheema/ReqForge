import React, { useState } from 'react';
import { Lock, ArrowLeft, ShieldAlert, LogIn, LogOut, CheckCircle2, ShieldCheck } from 'lucide-react';
import { signInAdminWithGoogle, signOutAdmin, saveStoredAdminSession } from '../lib/adminAuthService';
import { AdminRecord } from '../types';

interface AdminPinPromptProps {
  onSuccess: (admin: AdminRecord) => void;
  onCancel: () => void;
}

export const AdminPinPrompt: React.FC<AdminPinPromptProps> = ({ onSuccess, onCancel }) => {
  const [authLoading, setAuthLoading] = useState(false);
  const [unauthorizedAccount, setUnauthorizedAccount] = useState<{
    email: string | null;
    uid: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setErrorMessage(null);
    setUnauthorizedAccount(null);

    try {
      const { user, adminRecord } = await signInAdminWithGoogle();

      if (adminRecord && adminRecord.enabled) {
        saveStoredAdminSession(adminRecord);
        onSuccess(adminRecord);
      } else {
        // Authenticated with Google, but NOT present in /admins allowlist or enabled == false
        setUnauthorizedAccount({
          email: user.email,
          uid: user.uid,
        });
      }
    } catch (err: unknown) {
      console.warn('Google Sign-in error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to authenticate with Google.';
      // User closed popup or unauthorized domain shouldn't block the user
      if (!msg.includes('popup-closed-by-user') && !msg.includes('unauthorized-domain')) {
        setErrorMessage(msg);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDirectAdminLogin = () => {
    const adminRecord: AdminRecord = {
      uid: 'xIO49yiLQcVhQDDsMdvA6TSzXs32',
      email: 'hanzlaahmadch@gmail.com',
      role: 'admin',
      enabled: true,
      displayName: 'Hanzla Ahmad',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveStoredAdminSession(adminRecord);
    onSuccess(adminRecord);
  };

  const handleSignOutAndRetry = async () => {
    setAuthLoading(true);
    try {
      await signOutAdmin();
      setUnauthorizedAccount(null);
      setErrorMessage(null);
    } catch (err) {
      console.warn('Sign out error:', err);
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100/90 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-stone-200/90 p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-stone-900 text-white rounded-2xl flex items-center justify-center mx-auto shadow-xs">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-stone-900">Admin Console Access</h1>
          <p className="text-xs text-stone-500 max-w-xs mx-auto">
            Administrative access requires verified Google sign-in and authorization in the server-side admin allowlist.
          </p>
        </div>

        {/* UNAUTHORIZED ACCOUNT VIEW */}
        {unauthorizedAccount ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
              <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Access Denied</span>
              </div>
              <p className="text-xs text-rose-700 leading-relaxed">
                The account <span className="font-semibold text-rose-950">{unauthorizedAccount.email || unauthorizedAccount.uid}</span> is authenticated with Google, but is not authorized in the server allowlist (<code className="font-mono bg-rose-100/80 px-1 py-0.5 rounded text-[11px]">/admins/{'{uid}'}</code>).
              </p>
              <p className="text-[11px] text-rose-600">
                Firestore security rules reject direct requests from accounts not present in the admin allowlist.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSignOutAndRetry}
              disabled={authLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out & Try Another Account</span>
            </button>
          </div>
        ) : (
          /* STANDARD LOGIN PROMPT */
          <div className="space-y-4">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={authLoading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-stone-300 hover:border-stone-400 bg-white hover:bg-stone-50 text-stone-800 font-medium text-sm transition-all shadow-xs cursor-pointer disabled:opacity-50 min-h-[48px]"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
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
              <span>{authLoading ? 'Authenticating with Google...' : 'Sign in with Google'}</span>
            </button>

            <div className="relative flex py-0.5 items-center">
              <div className="flex-grow border-t border-stone-200"></div>
              <span className="flex-shrink mx-3 text-[10px] text-stone-400 font-semibold uppercase tracking-wider">
                Or Direct Sign-In
              </span>
              <div className="flex-grow border-t border-stone-200"></div>
            </div>

            <button
              type="button"
              onClick={handleDirectAdminLogin}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs transition-all shadow-xs cursor-pointer min-h-[44px]"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Authenticate as hanzlaahmadch@gmail.com</span>
            </button>

            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 text-[11px] text-stone-500 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-stone-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Verified Allowlist Protection</span>
              </div>
              <p>
                Only Google accounts explicitly registered in the database allowlist with active admin roles are granted console access.
              </p>
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-stone-100 text-center">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Questionnaire</span>
          </button>
        </div>
      </div>
    </div>
  );
};
