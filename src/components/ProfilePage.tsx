import { useEffect, useState } from 'react';
import { Calendar, Download, Edit3, Package, User as UserIcon } from 'lucide-react';
import { api, formatDate } from '../lib/api';
import type { ModItem, User } from '../types';
import { ModCard } from './ModCard';

interface ProfilePageProps {
  username: string;
  currentUser: User | null;
  onSelectMod: (modId: string) => void;
  onSelectCreator: (username: string) => void;
  onUserUpdated: (user: User) => void;
}

export function ProfilePage({
  username,
  currentUser,
  onSelectMod,
  onSelectCreator,
  onUserUpdated,
}: ProfilePageProps) {
  const [profile, setProfile] = useState<User | null>(null);
  const [mods, setMods] = useState<ModItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.getProfile(username);
        if (cancelled) return;
        setProfile(res.profile);
        setMods(res.mods);
        setDisplayName(res.profile.displayName);
        setBio(res.profile.bio);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to load creator profile.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [username]);

  const isOwnProfile = Boolean(currentUser && profile && currentUser.uid === profile.uid);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await api.updateProfile({
        displayName: displayName.trim(),
        bio: bio.trim(),
        avatarFile,
      });
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              displayName: res.user.displayName,
              bio: res.user.bio,
              avatarUrl: res.user.avatarUrl,
            }
          : res.user
      );
      onUserUpdated(res.user);
      setEditing(false);
      setAvatarFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[1160px] px-4 py-10 sm:px-6">
        <div className="h-44 animate-pulse rounded-xl border border-white/8 bg-[#15171E]" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="mx-auto max-w-[1160px] px-4 py-12 sm:px-6">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">
          {error || 'Creator profile not found.'}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1160px] px-4 py-8 sm:px-6 sm:py-10">
      <div className="rounded-xl border border-white/8 bg-[#15171E] p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#1C1F28]">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.displayName}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserIcon className="h-9 w-9 text-[#F16436]" />
              )}
            </div>
            <div>
              <h1 className="font-display text-2xl font-extrabold text-white">
                {profile.displayName}
              </h1>
              <p className="font-mono text-xs text-zinc-400">
                @{profile.username}
                {currentUser?.uid === profile.uid && currentUser.role === 'admin'
                  ? ' · Administrator'
                  : ' · Bedrock Creator'}
              </p>
              <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-zinc-300">
                {profile.bio || 'Minecraft Bedrock Edition mod creator on DOG MODS.'}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-4 font-mono text-xs text-zinc-400 tabular-nums">
                <span className="inline-flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-[#F16436]" />
                  {profile.modCount ?? mods.length} published mods
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Download className="h-3.5 w-3.5 text-[#F16436]" />
                  {(profile.totalDownloads ?? 0).toLocaleString()} downloads
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-zinc-500" />
                  Joined {formatDate(profile.createdAt)}
                </span>
              </div>
            </div>
          </div>

          {isOwnProfile && (
            <button
              type="button"
              onClick={() => setEditing((prev) => !prev)}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-white/12 bg-[#1C1F28] px-4 text-xs font-semibold text-white hover:border-white/25"
            >
              <Edit3 className="h-3.5 w-3.5" />
              {editing ? 'Close Editor' : 'Edit Profile'}
            </button>
          )}
        </div>

        {editing && isOwnProfile && (
          <form onSubmit={handleSaveProfile} className="mt-6 space-y-4 border-t border-white/8 pt-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="profile-display" className="block text-xs font-semibold text-zinc-300">
                  Display Name
                </label>
                <input
                  id="profile-display"
                  type="text"
                  required
                  maxLength={40}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-lg border border-white/12 bg-[#0D0E12] px-3 text-sm text-white focus:border-[#F16436] focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="profile-avatar" className="block text-xs font-semibold text-zinc-300">
                  Avatar Image (optional)
                </label>
                <input
                  id="profile-avatar"
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp"
                  onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                  className="mt-1.5 block w-full text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-[#1C1F28] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
                />
              </div>
            </div>
            <div>
              <label htmlFor="profile-bio" className="block text-xs font-semibold text-zinc-300">
                Creator Bio
              </label>
              <textarea
                id="profile-bio"
                rows={3}
                maxLength={500}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-white/12 bg-[#0D0E12] p-3 text-sm text-white focus:border-[#F16436] focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-10 items-center rounded-lg bg-[#F16436] px-5 text-xs font-bold text-white hover:bg-[#FF784B]"
              >
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        )}
      </div>

      <section className="mt-8">
        <h2 className="font-display text-xl font-bold text-white">
          Published Bedrock Mods
        </h2>
        {mods.length === 0 ? (
          <div className="mt-4 rounded-xl border border-white/8 bg-[#15171E] p-8 text-center text-sm text-zinc-400">
            No approved mods published yet.
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {mods.map((mod) => (
              <ModCard
                key={mod.id}
                mod={mod}
                onSelect={onSelectMod}
                onSelectCreator={onSelectCreator}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
