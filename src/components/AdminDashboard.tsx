import { useCallback, useEffect, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  FolderPlus,
  Layers,
  LogIn,
  Shield,
  Star,
  Trash2,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { api, formatBytes } from '../lib/api';
import type { AdminOverview, Category, MinecraftVersion, ModItem, User } from '../types';

interface AdminDashboardProps {
  currentUser: User | null;
  authReady: boolean;
  onOpenAuth: () => void;
  onSelectMod: (modId: string) => void;
  onDataChanged: () => void;
}

export function AdminDashboard({
  currentUser,
  authReady,
  onOpenAuth,
  onSelectMod,
  onDataChanged,
}: AdminDashboardProps) {
  const [tab, setTab] = useState<'mods' | 'categories' | 'versions' | 'users'>('mods');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [mods, setMods] = useState<ModItem[]>([]);
  const [modStatusFilter, setModStatusFilter] = useState<
    'all' | 'approved' | 'pending' | 'rejected'
  >('all');
  const [modSearch, setModSearch] = useState('');

  const [categories, setCategories] = useState<Category[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');

  const [versions, setVersions] = useState<MinecraftVersion[]>([]);
  const [newVersionStr, setNewVersionStr] = useState('');
  const [newVersionLabel, setNewVersionLabel] = useState('');

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [confirmDeleteModId, setConfirmDeleteModId] = useState<string | null>(null);
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'admin';

  const loadAdminData = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setActionError(null);
    try {
      const res = await api.getAdminData({
        status: modStatusFilter,
        search: modSearch.trim() || undefined,
      });
      setOverview(res.overview);
      setMods(res.mods);
      setCategories(res.categories);
      setVersions(res.versions);
      setUsers(res.users);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to load admin console.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, modStatusFilter, modSearch]);

  useEffect(() => {
    if (isAdmin) {
      loadAdminData();
    } else if (authReady) {
      setLoading(false);
    }
  }, [isAdmin, authReady, loadAdminData]);

  const handleModStatus = async (id: string, status: 'approved' | 'rejected') => {
    setActionError(null);
    setBusyKey(`status-${id}`);
    try {
      await api.setModStatus(id, status);
      await loadAdminData();
      onDataChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update mod status.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleToggleFeature = async (mod: ModItem) => {
    setActionError(null);
    setBusyKey(`feature-${mod.id}`);
    try {
      await api.setModFeatured(mod.id, !mod.isFeatured);
      await loadAdminData();
      onDataChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to toggle featured status.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleDeleteMod = async (mod: ModItem) => {
    setActionError(null);
    setBusyKey(`delete-mod-${mod.id}`);
    try {
      await api.deleteMod(mod);
      setConfirmDeleteModId(null);
      await loadAdminData();
      onDataChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete mod.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setActionError(null);
    setBusyKey('create-cat');
    try {
      await api.createCategory({ name: newCatName.trim(), description: newCatDesc.trim() });
      setNewCatName('');
      setNewCatDesc('');
      await loadAdminData();
      onDataChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create category.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    setActionError(null);
    setBusyKey(`delete-cat-${id}`);
    try {
      await api.deleteCategory(id);
      await loadAdminData();
      onDataChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete category.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersionStr.trim()) return;
    setActionError(null);
    setBusyKey('create-ver');
    try {
      await api.createVersion({
        version: newVersionStr.trim(),
        label: newVersionLabel.trim() || undefined,
      });
      setNewVersionStr('');
      setNewVersionLabel('');
      await loadAdminData();
      onDataChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to add Minecraft version.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleDeleteVersion = async (id: string) => {
    setActionError(null);
    setBusyKey(`delete-ver-${id}`);
    try {
      await api.deleteVersion(id);
      await loadAdminData();
      onDataChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove version.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleToggleUserBan = async (u: User) => {
    setActionError(null);
    setBusyKey(`ban-${u.uid}`);
    try {
      await api.updateAdminUser(u, { isBanned: !u.isBanned });
      await loadAdminData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update user.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleToggleUserRole = async (u: User) => {
    setActionError(null);
    setBusyKey(`role-${u.uid}`);
    try {
      await api.updateAdminUser(u, { role: u.role === 'admin' ? 'user' : 'admin' });
      await loadAdminData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update user role.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleDeleteUser = async (u: User) => {
    setActionError(null);
    setBusyKey(`delete-user-${u.uid}`);
    try {
      await api.deleteAdminUser(u.uid);
      setConfirmDeleteUserId(null);
      await loadAdminData();
      onDataChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete user.');
    } finally {
      setBusyKey(null);
    }
  };

  if (!authReady) {
    return (
      <div className="mx-auto max-w-[540px] px-4 py-12 sm:px-6">
        <div className="h-44 animate-pulse rounded-xl border border-white/8 bg-[#15171E]" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-[540px] px-4 py-12 sm:px-6">
        <div className="rounded-xl border border-white/10 bg-[#15171E] p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F16436]/15 text-[#F16436]">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-display text-xl font-extrabold text-white">
                Administrator Access
              </h1>
              <p className="text-xs text-zinc-400">
                Manage Minecraft Bedrock mods, featured listings, categories, and creators.
              </p>
            </div>
          </div>

          {!currentUser ? (
            <div className="mt-6 space-y-4">
              <p className="text-sm text-zinc-300">
                Sign in with an administrator Google account to open the moderation console.
              </p>
              <button
                type="button"
                onClick={onOpenAuth}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#F16436] text-sm font-bold text-white hover:bg-[#FF784B]"
              >
                <LogIn className="h-4 w-4" />
                Sign In with Google
              </button>
            </div>
          ) : (
            <div className="mt-6 space-y-3 rounded-lg border border-white/10 bg-[#0D0E12] p-4">
              <p className="text-sm font-semibold text-white">
                Signed in as {currentUser.displayName} (@{currentUser.username})
              </p>
              <p className="text-xs leading-relaxed text-zinc-400">
                Your account currently has standard creator permissions. Contact a site
                administrator if you need moderation privileges enabled for your account.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#FF784B]">
            Moderation &amp; Platform Controls
          </p>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-white sm:text-3xl">
            Admin Dashboard
          </h1>
        </div>

        {/* Workspace Tab Buttons */}
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/8 bg-[#15171E] p-1">
          <button
            type="button"
            onClick={() => setTab('mods')}
            className={`h-9 rounded-lg px-4 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              tab === 'mods' ? 'bg-[#F16436] text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Mod Moderation
          </button>
          <button
            type="button"
            onClick={() => setTab('categories')}
            className={`h-9 rounded-lg px-4 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              tab === 'categories' ? 'bg-[#F16436] text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Categories
          </button>
          <button
            type="button"
            onClick={() => setTab('versions')}
            className={`h-9 rounded-lg px-4 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              tab === 'versions' ? 'bg-[#F16436] text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            MC Versions
          </button>
          <button
            type="button"
            onClick={() => setTab('users')}
            className={`h-9 rounded-lg px-4 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              tab === 'users' ? 'bg-[#F16436] text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Users
          </button>
        </div>
      </div>

      {/* Overview Metrics Row */}
      {overview && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border border-white/8 bg-[#15171E] p-4">
            <p className="text-xs text-zinc-400">Pending Review</p>
            <p className="mt-1 font-mono text-2xl font-bold text-amber-300 tabular-nums">
              {overview.pendingMods}
            </p>
          </div>
          <div className="rounded-xl border border-white/8 bg-[#15171E] p-4">
            <p className="text-xs text-zinc-400">Approved Mods</p>
            <p className="mt-1 font-mono text-2xl font-bold text-emerald-400 tabular-nums">
              {overview.approvedMods}
            </p>
          </div>
          <div className="rounded-xl border border-white/8 bg-[#15171E] p-4">
            <p className="text-xs text-zinc-400">Rejected Mods</p>
            <p className="mt-1 font-mono text-2xl font-bold text-red-400 tabular-nums">
              {overview.rejectedMods}
            </p>
          </div>
          <div className="rounded-xl border border-white/8 bg-[#15171E] p-4">
            <p className="text-xs text-zinc-400">Total Downloads</p>
            <p className="mt-1 font-mono text-2xl font-bold text-white tabular-nums">
              {overview.totalDownloads.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-white/8 bg-[#15171E] p-4">
            <p className="text-xs text-zinc-400">Registered Users</p>
            <p className="mt-1 font-mono text-2xl font-bold text-white tabular-nums">
              {overview.totalUsers}
            </p>
          </div>
          <div className="rounded-xl border border-white/8 bg-[#15171E] p-4">
            <p className="text-xs text-zinc-400">Categories</p>
            <p className="mt-1 font-mono text-2xl font-bold text-white tabular-nums">
              {overview.totalCategories}
            </p>
          </div>
        </div>
      )}

      {actionError && (
        <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {actionError}
        </div>
      )}

      {/* Tab 1: Mod Moderation */}
      {tab === 'mods' && (
        <section className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              {(['all', 'approved', 'pending', 'rejected'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setModStatusFilter(st)}
                  className={`h-9 rounded-lg px-3.5 text-xs font-semibold capitalize transition-colors ${
                    modStatusFilter === st
                      ? 'border border-white/15 bg-[#1C1F28] text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
            <input
              type="search"
              value={modSearch}
              onChange={(e) => setModSearch(e.target.value)}
              placeholder="Filter mods by name or creator..."
              className="h-9 w-full rounded-lg border border-white/12 bg-[#15171E] px-3 text-xs text-white placeholder-zinc-500 focus:border-[#F16436] focus:outline-none sm:w-64"
            />
          </div>

          {loading ? (
            <div className="h-48 animate-pulse rounded-xl border border-white/8 bg-[#15171E]" />
          ) : mods.length === 0 ? (
            <div className="rounded-xl border border-white/8 bg-[#15171E] p-10 text-center text-sm text-zinc-400">
              No mods match the selected filter.
            </div>
          ) : (
            <div className="space-y-3">
              {mods.map((mod) => (
                <div
                  key={mod.id}
                  className="flex flex-col gap-4 rounded-xl border border-white/8 bg-[#15171E] p-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <img
                      src={mod.imageUrl}
                      alt={mod.name}
                      referrerPolicy="no-referrer"
                      className="h-14 w-14 shrink-0 rounded-lg bg-[#1C1F28] object-cover"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => onSelectMod(mod.id)}
                          className="truncate font-display text-base font-bold text-white hover:text-[#FF784B]"
                        >
                          {mod.name}
                        </button>
                        <span
                          className={`text-xs font-semibold capitalize ${
                            mod.status === 'approved'
                              ? 'text-emerald-400'
                              : mod.status === 'rejected'
                                ? 'text-red-400'
                                : 'text-amber-300'
                          }`}
                        >
                          {mod.status}
                        </span>
                        {mod.isFeatured && (
                          <span className="text-xs font-semibold text-[#FF784B]">· Featured</span>
                        )}
                      </div>
                      <p className="mt-1 truncate font-mono text-xs text-zinc-400 tabular-nums">
                        by {mod.creatorName} (@{mod.creatorUsername}) · {mod.categoryName} ·{' '}
                        {mod.mcVersion} · {mod.fileOriginalName} ({formatBytes(mod.fileSize)})
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleModStatus(mod.id, 'approved')}
                      disabled={mod.status === 'approved' || busyKey === `status-${mod.id}`}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-40"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleModStatus(mod.id, 'rejected')}
                      disabled={mod.status === 'rejected' || busyKey === `status-${mod.id}`}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/15 px-3 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 disabled:opacity-40"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleFeature(mod)}
                      disabled={busyKey === `feature-${mod.id}`}
                      className={`inline-flex h-8 items-center gap-1 rounded-lg border px-3 text-xs font-semibold disabled:opacity-50 ${
                        mod.isFeatured
                          ? 'border-[#F16436] bg-[#F16436] text-white'
                          : 'border-white/12 bg-[#1C1F28] text-zinc-200 hover:border-[#F16436]/50'
                      }`}
                    >
                      <Star className="h-3.5 w-3.5" />
                      {mod.isFeatured ? 'Featured' : 'Feature'}
                    </button>

                    {confirmDeleteModId === mod.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleDeleteMod(mod)}
                          disabled={busyKey === `delete-mod-${mod.id}`}
                          className="inline-flex h-8 items-center rounded-lg bg-red-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          {busyKey === `delete-mod-${mod.id}` ? 'Deleting...' : 'Confirm'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteModId(null)}
                          className="inline-flex h-8 items-center rounded-lg border border-white/10 px-2.5 text-xs text-zinc-300"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteModId(mod.id)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-500/25 bg-red-500/10 px-3 text-xs font-semibold text-red-300 hover:bg-red-500/20"
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
        </section>
      )}

      {/* Tab 2: Categories Management */}
      {tab === 'categories' && (
        <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
          <form
            onSubmit={handleCreateCategory}
            className="h-fit space-y-4 rounded-xl border border-white/8 bg-[#15171E] p-5"
          >
            <h2 className="font-display text-lg font-bold text-white">Add Category</h2>
            <div>
              <label className="block text-xs font-semibold text-zinc-300">Category Name</label>
              <input
                type="text"
                required
                maxLength={40}
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="e.g., Mini-Games"
                className="mt-1.5 h-10 w-full rounded-lg border border-white/12 bg-[#0D0E12] px-3 text-sm text-white focus:border-[#F16436] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300">Description</label>
              <textarea
                rows={3}
                maxLength={300}
                value={newCatDesc}
                onChange={(e) => setNewCatDesc(e.target.value)}
                placeholder="Short Bedrock category description"
                className="mt-1.5 w-full rounded-lg border border-white/12 bg-[#0D0E12] p-3 text-sm text-white focus:border-[#F16436] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={busyKey === 'create-cat'}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#F16436] text-xs font-bold text-white hover:bg-[#FF784B] disabled:opacity-50"
            >
              <FolderPlus className="h-4 w-4" />
              {busyKey === 'create-cat' ? 'Creating...' : 'Create Category'}
            </button>
          </form>

          <div className="space-y-3">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-[#15171E] p-4"
              >
                <div>
                  <h3 className="font-display text-base font-bold text-white">
                    {cat.name}{' '}
                    <span className="ml-2 font-mono text-xs font-normal text-zinc-400 tabular-nums">
                      ({cat.modCount} approved mods)
                    </span>
                  </h3>
                  <p className="mt-1 text-xs text-zinc-400">{cat.description || 'No description.'}</p>
                </div>
                <button
                  type="button"
                  disabled={busyKey === `delete-cat-${cat.id}`}
                  onClick={() => handleDeleteCategory(cat.id)}
                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-red-500/25 bg-red-500/10 px-3 text-xs font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tab 3: Minecraft Bedrock Versions Management */}
      {tab === 'versions' && (
        <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
          <form
            onSubmit={handleCreateVersion}
            className="h-fit space-y-4 rounded-xl border border-white/8 bg-[#15171E] p-5"
          >
            <h2 className="font-display text-lg font-bold text-white">Add Minecraft Version</h2>
            <p className="text-xs leading-relaxed text-zinc-400">
              New versions immediately appear in the Upload Mod form and Browse version filters.
            </p>
            <div>
              <label className="block text-xs font-semibold text-zinc-300">
                Bedrock Version Number
              </label>
              <input
                type="text"
                required
                maxLength={20}
                value={newVersionStr}
                onChange={(e) => setNewVersionStr(e.target.value)}
                placeholder="e.g., 1.26.70 or 1.27.0"
                className="mt-1.5 h-10 w-full rounded-lg border border-white/12 bg-[#0D0E12] px-3 font-mono text-sm text-white focus:border-[#F16436] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-300">
                Display Label <span className="font-normal text-zinc-500">(optional)</span>
              </label>
              <input
                type="text"
                maxLength={32}
                value={newVersionLabel}
                onChange={(e) => setNewVersionLabel(e.target.value)}
                placeholder="e.g., Bedrock 1.26.70"
                className="mt-1.5 h-10 w-full rounded-lg border border-white/12 bg-[#0D0E12] px-3 text-sm text-white focus:border-[#F16436] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={busyKey === 'create-ver'}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#F16436] text-xs font-bold text-white hover:bg-[#FF784B] disabled:opacity-50"
            >
              <Layers className="h-4 w-4" />
              {busyKey === 'create-ver' ? 'Adding...' : 'Add Bedrock Version'}
            </button>
          </form>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {versions.map((ver) => (
              <div
                key={ver.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-[#15171E] p-4"
              >
                <div>
                  <h3 className="font-mono text-base font-bold text-white tabular-nums">
                    {ver.version}
                  </h3>
                  <p className="mt-0.5 text-xs text-zinc-400">{ver.label}</p>
                </div>
                <button
                  type="button"
                  disabled={busyKey === `delete-ver-${ver.id}`}
                  onClick={() => handleDeleteVersion(ver.id)}
                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-red-500/25 bg-red-500/10 px-3 text-xs font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tab 4: User Management */}
      {tab === 'users' && (
        <section className="mt-6 overflow-hidden rounded-xl border border-white/8 bg-[#15171E]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/8 bg-[#111318] text-xs text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Mods</th>
                  <th className="px-4 py-3 text-right font-semibold">Downloads</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {users.map((u) => (
                  <tr key={u.uid} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-white">{u.displayName}</p>
                      <p className="font-mono text-xs text-zinc-400">
                        @{u.username}
                        {u.email ? ` · ${u.email}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs capitalize text-zinc-200">{u.role}</td>
                    <td className="px-4 py-3 text-xs font-semibold">
                      {u.isBanned ? (
                        <span className="text-red-400">Suspended</span>
                      ) : (
                        <span className="text-emerald-400">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-zinc-200 tabular-nums">
                      {u.modCount ?? 0}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-zinc-200 tabular-nums">
                      {(u.totalDownloads ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {u.uid === currentUser?.uid ? (
                        <span className="text-xs text-zinc-500">Current Session</span>
                      ) : (
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            disabled={busyKey === `role-${u.uid}`}
                            onClick={() => handleToggleUserRole(u)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/12 bg-[#1C1F28] px-2.5 text-xs font-medium text-zinc-200 hover:text-white disabled:opacity-50"
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            {u.role === 'admin' ? 'Demote' : 'Make Admin'}
                          </button>
                          <button
                            type="button"
                            disabled={busyKey === `ban-${u.uid}`}
                            onClick={() => handleToggleUserBan(u)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 text-xs font-medium text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
                          >
                            <Ban className="h-3.5 w-3.5" />
                            {u.isBanned ? 'Unban' : 'Ban'}
                          </button>
                          {confirmDeleteUserId === u.uid ? (
                            <>
                              <button
                                type="button"
                                disabled={busyKey === `delete-user-${u.uid}`}
                                onClick={() => handleDeleteUser(u)}
                                className="inline-flex h-8 items-center rounded-lg bg-red-600 px-2.5 text-xs font-semibold text-white disabled:opacity-50"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteUserId(null)}
                                className="inline-flex h-8 items-center rounded-lg border border-white/10 px-2 text-xs text-zinc-300"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteUserId(u.uid)}
                              aria-label={`Delete user ${u.displayName}`}
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 text-xs font-medium text-red-300 hover:bg-red-500/20"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
