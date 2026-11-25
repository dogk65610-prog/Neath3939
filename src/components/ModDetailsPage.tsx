import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  FileArchive,
  HardDrive,
  Package,
  Star,
  Trash2,
  XCircle,
} from 'lucide-react';
import { api, formatBytes, formatDate } from '../lib/api';
import type { ModItem, User } from '../types';

interface ModDetailsPageProps {
  modId: string;
  currentUser: User | null;
  onBack: () => void;
  onSelectCreator: (username: string) => void;
  onEditMod: (modId: string) => void;
  onModChanged: () => void;
}

export function ModDetailsPage({
  modId,
  currentUser,
  onBack,
  onSelectCreator,
  onEditMod,
  onModChanged,
}: ModDetailsPageProps) {
  const [mod, setMod] = useState<ModItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      setImgError(false);
      try {
        const res = await api.getMod(modId);
        if (!cancelled) setMod(res.mod);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load mod details.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [modId]);

  const handleDownload = () => {
    if (!mod) return;
    const link = document.createElement('a');
    link.href = mod.fileUrl;
    link.download = mod.fileOriginalName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setMod((prev) => (prev ? { ...prev, downloadCount: prev.downloadCount + 1 } : prev));
    void api.recordDownload(mod.id);
    onModChanged();
  };

  const handleDelete = async () => {
    if (!mod) return;
    setActionBusy(true);
    try {
      await api.deleteMod(mod);
      onModChanged();
      onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete mod.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleAdminStatus = async (status: 'approved' | 'rejected') => {
    if (!mod) return;
    setActionBusy(true);
    try {
      const updated = await api.setModStatus(mod.id, status);
      setMod(updated);
      onModChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleAdminFeature = async () => {
    if (!mod) return;
    setActionBusy(true);
    try {
      const updated = await api.setModFeatured(mod.id, !mod.isFeatured);
      setMod(updated);
      onModChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle featured state.');
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[1160px] px-4 py-10 sm:px-6">
        <div className="h-96 animate-pulse rounded-xl border border-white/8 bg-[#15171E]" />
      </div>
    );
  }

  if (error || !mod) {
    return (
      <div className="mx-auto max-w-[1160px] px-4 py-12 sm:px-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Mods
        </button>
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">
          {error || 'Mod not found.'}
        </div>
      </div>
    );
  }

  const isOwner = Boolean(currentUser && currentUser.uid === mod.creatorId);
  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="mx-auto max-w-[1160px] px-4 py-8 sm:px-6 sm:py-10">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Bedrock Mods
      </button>

      {mod.status !== 'approved' && (
        <div
          className={`mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-sm ${
            mod.status === 'pending'
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
              : 'border-red-500/30 bg-red-500/10 text-red-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {mod.status === 'pending' ? (
              <Clock className="h-4 w-4 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 shrink-0" />
            )}
            <span>
              {mod.status === 'pending'
                ? 'Status: Pending Review — visible to you and Administrators.'
                : 'Status: Rejected — hidden from public catalog.'}
            </span>
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[380px_1fr]">
        <div className="space-y-5">
          <div className="overflow-hidden rounded-xl border border-white/8 bg-[#15171E]">
            <div className="aspect-square w-full bg-[#1C1F28]">
              {!imgError && mod.imageUrl ? (
                <img
                  src={mod.imageUrl}
                  alt={`${mod.name} cover artwork`}
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
                  <Package className="h-14 w-14 text-[#F16436]" />
                  <span className="text-sm font-medium text-zinc-400">{mod.name}</span>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownload}
            className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-[#F16436] px-6 text-base font-bold text-white hover:bg-[#FF784B] transition-colors"
          >
            <Download className="h-5 w-5" />
            Download Mod ({formatBytes(mod.fileSize)})
          </button>

          <div className="rounded-xl border border-white/8 bg-[#15171E] p-5">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-zinc-400">
              Bedrock Package Details
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-4 border-b border-white/6 pb-2.5">
                <dt className="flex items-center gap-2 text-zinc-400">
                  <FileArchive className="h-4 w-4 text-zinc-500" />
                  Mod File
                </dt>
                <dd className="max-w-[200px] truncate text-right font-mono text-xs text-zinc-100" title={mod.fileOriginalName}>
                  {mod.fileOriginalName}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-white/6 pb-2.5">
                <dt className="flex items-center gap-2 text-zinc-400">
                  <HardDrive className="h-4 w-4 text-zinc-500" />
                  File Size
                </dt>
                <dd className="font-mono text-xs text-zinc-100 tabular-nums">
                  {formatBytes(mod.fileSize)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-white/6 pb-2.5">
                <dt className="flex items-center gap-2 text-zinc-400">
                  <Package className="h-4 w-4 text-zinc-500" />
                  Supported Minecraft Version
                </dt>
                <dd className="font-mono text-xs text-zinc-100 tabular-nums">
                  Bedrock {mod.mcVersion}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4 border-b border-white/6 pb-2.5">
                <dt className="flex items-center gap-2 text-zinc-400 shrink-0">
                  <CheckCircle2 className="h-4 w-4 text-zinc-500" />
                  Compatible Versions
                </dt>
                <dd className="text-right font-mono text-xs leading-relaxed text-zinc-100 tabular-nums">
                  {(mod.compatibleVersions && mod.compatibleVersions.length > 0
                    ? mod.compatibleVersions
                    : [mod.mcVersion]
                  ).join(' · ')}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-white/6 pb-2.5">
                <dt className="flex items-center gap-2 text-zinc-400">
                  <Download className="h-4 w-4 text-zinc-500" />
                  Downloads
                </dt>
                <dd className="font-mono text-xs text-zinc-100 tabular-nums">
                  {mod.downloadCount.toLocaleString()}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="flex items-center gap-2 text-zinc-400">
                  <Calendar className="h-4 w-4 text-zinc-500" />
                  Uploaded
                </dt>
                <dd className="font-mono text-xs text-zinc-100 tabular-nums">
                  {formatDate(mod.createdAt)}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-white/8 bg-[#15171E] p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-400">
              <span>{mod.categoryName}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{mod.fileFormat}</span>
              {mod.isFeatured && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#FF784B] font-semibold">Featured Release</span>
                </>
              )}
            </div>

            <h1 className="mt-2 font-display text-2xl font-extrabold text-white sm:text-4xl [text-wrap:balance]">
              {mod.name}
            </h1>

            <p className="mt-3 text-sm text-zinc-400">
              Created by{' '}
              <button
                type="button"
                onClick={() => onSelectCreator(mod.creatorUsername)}
                className="font-semibold text-white hover:text-[#F16436] hover:underline"
              >
                {mod.creatorName}
              </button>{' '}
              <span className="text-zinc-500">(@{mod.creatorUsername})</span>
            </p>

            {(isOwner || isAdmin) && (
              <div className="mt-5 flex flex-wrap items-center gap-2.5 border-y border-white/8 py-4">
                <button
                  type="button"
                  onClick={() => onEditMod(mod.id)}
                  disabled={actionBusy}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/12 bg-[#1C1F28] px-3.5 text-xs font-semibold text-white hover:border-white/25"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Edit Mod
                </button>

                {isAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleAdminStatus('approved')}
                      disabled={actionBusy || mod.status === 'approved'}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdminStatus('rejected')}
                      disabled={actionBusy || mod.status === 'rejected'}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/15 px-3.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={handleAdminFeature}
                      disabled={actionBusy}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#F16436]/40 bg-[#F16436]/15 px-3.5 text-xs font-semibold text-[#FF784B] hover:bg-[#F16436]/25"
                    >
                      <Star className="h-3.5 w-3.5" />
                      {mod.isFeatured ? 'Unfeature' : 'Feature on Home'}
                    </button>
                  </>
                )}

                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    disabled={actionBusy}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 text-xs font-semibold text-red-300 hover:bg-red-500/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={actionBusy}
                      className="inline-flex h-9 items-center rounded-lg bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-500"
                    >
                      Confirm Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="inline-flex h-9 items-center rounded-lg border border-white/10 px-3 text-xs text-zinc-300"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6">
              <h2 className="font-display text-lg font-bold text-white">About this Mod</h2>
              <div className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-300">
                {mod.description}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/8 bg-[#15171E] p-6">
            <h2 className="font-display text-base font-bold text-white">
              How to Install on Minecraft Bedrock
            </h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-400">
              <li>
                Click <span className="font-semibold text-zinc-200">Download Mod</span> to save{' '}
                <span className="font-mono text-xs text-zinc-200">{mod.fileOriginalName}</span>.
              </li>
              <li>
                On Android, iOS, or Windows 10/11, tap or double-click the{' '}
                <span className="font-mono text-xs text-zinc-200">{mod.fileFormat}</span> file to
                import it directly into Minecraft Bedrock Edition.
              </li>
              <li>
                Activate the Behavior/Resource Pack in your World Settings before launching.
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
