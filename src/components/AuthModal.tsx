import { useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, X } from 'lucide-react';
import { api } from '../lib/api';
import type { User } from '../types';

interface AuthModalProps {
  onClose: () => void;
  onAuthenticated: (user: User) => void;
}

export function AuthModal({ onClose, onAuthenticated }: AuthModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const user = await api.signInWithGoogle();
      if (user) {
        onAuthenticated(user);
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md rounded-xl border border-white/12 bg-[#15171E] p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 id="auth-modal-title" className="font-display text-xl font-extrabold text-white">
            Sign In to DOG MODS
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          Sign in with your Google account to create your DOG MODS creator profile, publish
          Minecraft Bedrock mods permanently, and manage your uploads across devices.
        </p>

        {error && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          disabled={submitting}
          onClick={handleGoogleSignIn}
          className="mt-6 flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#F16436] px-5 text-sm font-bold text-white hover:bg-[#FF784B] disabled:opacity-60 transition-colors"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
            <path d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z" />
          </svg>
          {submitting ? 'Connecting...' : 'Continue with Google'}
        </button>
      </motion.div>
    </div>
  );
}
