import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Edit3, Eye, PackagePlus, Trash2, XCircle } from 'lucide-react';
import { api, formatBytes, formatDate } from '../lib/api';
import type { ModItem, ModStatus, User } from '../types';

interface MyModsPageProps {
  currentUser: User | null;
  onOpenAuth: () => void;
  onSelectMod: (modId: string) => void;
  onEditMod: (modId: string) => void;
  onUploadNew: () => void;
  onChanged: () => void;
}

function StatusLabel({ status }: { status: ModStatus }) {
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Published
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-400">
        <XCircle className="h-3.5 w-3.5" />
        Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300">
      <Clock className="h-3.5 w-3.5" />
      Pending Review
    </span>
  );
}

export function MyModsPage({
  currentUser,
  onOpenAuth,
  onSelectMod,
  onEditMod,
  onUploadNew,
  onChanged,
}: MyModsPageProps) {
  const [mods, setMods] = useState<ModItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.getMyMods();
        if (!cancelled) setMods(res.mods);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load your mods.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const handleDelete = async (mod: ModItem) => {
    setBusyId(mod.id);
    setError(null);
    try {
      await api.deleteMod(mod);
      setMods((prev) => prev.filter((m) => m.id !== mod.id));
      setConfirmId(null);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete mod.');
    } finally {
      setBusyId(null);
    }
  };

  if (!currentUser) {
    return (
      <div className="mx-auto max-w-[680px] px-4 py-14 sm:px-6">
        <div className="rounded-xl border border-white/10 bg-[#15171E] p-8 text-center">
          <h1 className="font-display text-2xl font-extrabold text-white">Sign In Required</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Sign in with Google to view, edit, or delete your uploaded Minecraft Bedrock mods.
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[#F16436] px-6 text-sm font-semibold text-white hover:bg-[#FF784B]"
          >
            Sign In with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1160px] px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-white sm:text-3xl">
            My Uploaded Mods
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Manage your Bedrock addons, track downloads, and update releases.
          </p>
        </div>
        <button
          type="button"
          onClick={onUploadNew}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#F16436] px-5 text-sm font-semibold text-white hover:bg-[#FF784B] transition-colors"
        >
          <PackagePlus className="h-4 w-4" />
          Upload New Mod
        </button>
      </div>

      {error && (
        <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-white/8 bg-[#15171E]" />
          ))}
        </div>
      ) : mods.length === 0 ? (
        <div className="mt-8 rounded-xl border border-white/8 bg-[#15171E] p-12 text-center">
          <p className="font-display text-lg font-bold text-white">No uploaded mods yet</p>
          <p className="mt-2 text-sm text-zinc-400">
            Share your first Minecraft Bedrock addon, shader, or world with the community.
          </p>
          <button
            type="button"
            onClick={onUploadNew}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[#F16436] px-5 text-sm font-semibold text-white hover:bg-[#FF784B]"
          >
            Publish Your First Mod
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {mods.map((mod) => (
            <div
              key={mod.id}
              className="flex flex-col gap-4 rounded-xl border border-white/8 bg-[#15171E] p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-4 min-w-0">
                <img
                  src={mod.imageUrl}
                  alt={mod.name}
                  referrerPolicy="no-referrer"
                  className="h-16 w-16 shrink-0 rounded-lg object-cover bg-[#1C1F28]"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onSelectMod(mod.id)}
                      className="truncate font-display text-base font-bold text-white hover:text-[#FF784B]"
                    >
                      {mod.name}
                    </button>
                    <StatusLabel status={mod.status} />
                  </div>
                  <p className="mt-1 truncate font-mono text-xs text-zinc-400 tabular-nums">
                    {mod.categoryName} · {mod.mcVersion} · {mod.fileOriginalName} ({formatBytes(mod.fileSize)}) ·{' '}
                    {mod.downloadCount.toLocaleString()} downloads · {formatDate(mod.createdAt)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onSelectMod(mod.id)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-[#1C1F28] px-3 text-xs font-medium text-zinc-200 hover:text-white"
                >
                  <Eye className="h-3.5 w-3.5" />
                  View
                </button>
                <button
                  type="button"
                  onClick={() => onEditMod(mod.id)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-[#1C1F28] px-3 text-xs font-medium text-zinc-200 hover:text-white"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Edit
                </button>
                {confirmId === mod.id ? (
                  <>
                    <button
                      type="button"
                      disabled={busyId === mod.id}
                      onClick={() => handleDelete(mod)}
                      className="inline-flex h-9 items-center rounded-lg bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-500"
                    >
                      Confirm Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      className="inline-flex h-9 items-center rounded-lg border border-white/10 px-3 text-xs text-zinc-300"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmId(mod.id)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-500/25 bg-red-500/10 px-3 text-xs font-medium text-red-300 hover:bg-red-500/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
