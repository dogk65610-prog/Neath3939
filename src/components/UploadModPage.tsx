import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, CheckCircle2, FileArchive, ImagePlus, UploadCloud } from 'lucide-react';
import {
  api,
  compareBedrockVersions,
  DEFAULT_BEDROCK_VERSIONS,
  formatBytes,
  isValidBedrockVersion,
} from '../lib/api';
import type { Category, MinecraftVersion, ModItem, User } from '../types';

const MAX_MOD_BYTES = 50 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MOD_EXTS = ['.mcaddon', '.mcpack', '.mcworld', '.zip'];

interface UploadModPageProps {
  currentUser: User | null;
  categories: Category[];
  versions: MinecraftVersion[];
  editModId?: string;
  onOpenAuth: () => void;
  onPublished: (mod: ModItem) => void;
  onCancel: () => void;
}

export function UploadModPage({
  currentUser,
  categories,
  versions,
  editModId,
  onOpenAuth,
  onPublished,
  onCancel,
}: UploadModPageProps) {
  const isEditing = Boolean(editModId);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id || '');
  const [mcVersion, setMcVersion] = useState('1.26.0');
  const [compatibleVersions, setCompatibleVersions] = useState<string[]>(['1.26.0']);
  const [creatorName, setCreatorName] = useState(currentUser?.displayName || '');

  const [modImage, setModImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [modFile, setModFile] = useState<File | null>(null);
  const [existingFileInfo, setExistingFileInfo] = useState<{ name: string; size: number } | null>(null);

  const [loadingEdit, setLoadingEdit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableVersions = useMemo(() => {
    const baseList =
      versions.length > 0 ? versions.map((v) => v.version) : DEFAULT_BEDROCK_VERSIONS;
    const merged = Array.from(
      new Set([...baseList, ...(isEditing ? [mcVersion, ...compatibleVersions] : [])])
    ).filter((v) => isValidBedrockVersion(v));
    return merged.sort(compareBedrockVersions);
  }, [versions, isEditing, mcVersion, compatibleVersions]);

  useEffect(() => {
    if (!categoryId && categories.length > 0) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  useEffect(() => {
    if (currentUser && !creatorName && !isEditing) {
      setCreatorName(currentUser.displayName);
    }
  }, [currentUser, creatorName, isEditing]);

  useEffect(() => {
    if (!editModId) return;
    let cancelled = false;
    async function loadExisting() {
      setLoadingEdit(true);
      setError(null);
      try {
        const res = await api.getMod(editModId!);
        if (cancelled) return;
        const m = res.mod;
        setName(m.name);
        setDescription(m.description);
        setCategoryId(m.categoryId);
        setMcVersion(m.mcVersion);
        setCompatibleVersions(
          m.compatibleVersions && m.compatibleVersions.length > 0
            ? m.compatibleVersions
            : [m.mcVersion]
        );
        setCreatorName(m.creatorName);
        setImagePreview(m.imageUrl);
        setExistingFileInfo({ name: m.fileOriginalName, size: m.fileSize });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load mod for editing.');
      } finally {
        if (!cancelled) setLoadingEdit(false);
      }
    }
    loadExisting();
    return () => {
      cancelled = true;
    };
  }, [editModId]);

  useEffect(() => {
    return () => {
      if (imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handlePrimaryVersionChange = (nextVersion: string) => {
    setMcVersion(nextVersion);
    setCompatibleVersions((prev) =>
      prev.includes(nextVersion) ? prev : [...prev, nextVersion].sort(compareBedrockVersions)
    );
  };

  const toggleCompatibleVersion = (ver: string) => {
    if (ver === mcVersion) return; // Primary version is always compatible
    setCompatibleVersions((prev) => {
      if (prev.includes(ver)) {
        return prev.filter((v) => v !== ver);
      }
      return [...prev, ver].sort(compareBedrockVersions);
    });
  };

  const handleImagePick = (file: File | null) => {
    setError(null);
    if (!file) return;
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      setError('Unsupported image format. Please choose a .png, .jpg, or .webp image.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('Cover image exceeds the 5 MB limit.');
      return;
    }
    setModImage(file);
    if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleModFilePick = (file: File | null) => {
    setError(null);
    if (!file) return;
    const dotIdx = file.name.lastIndexOf('.');
    const ext = dotIdx >= 0 ? file.name.slice(dotIdx).toLowerCase() : '';
    if (ext === '.jar') {
      setError(
        'Java Edition .jar files are not allowed. DOG MODS only accepts Minecraft Bedrock formats (.mcaddon, .mcpack, .mcworld, .zip).'
      );
      return;
    }
    if (!ALLOWED_MOD_EXTS.includes(ext)) {
      setError(
        `Unsupported file format "${ext || 'unknown'}". Allowed formats: .mcaddon, .mcpack, .mcworld, .zip.`
      );
      return;
    }
    if (file.size > MAX_MOD_BYTES) {
      setError(`Mod file is too large (${formatBytes(file.size)}). Maximum allowed size is 50 MB.`);
      return;
    }
    if (file.size === 0) {
      setError('Selected file is empty (0 bytes). Please upload a valid Bedrock package.');
      return;
    }
    setModFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onOpenAuth();
      return;
    }
    setError(null);

    if (name.trim().length < 3) {
      setError('Mod Name must be at least 3 characters.');
      return;
    }
    if (description.trim().length < 15) {
      setError('Mod Description must be at least 15 characters.');
      return;
    }
    if (!isValidBedrockVersion(mcVersion)) {
      setError('Please select a valid Minecraft Bedrock version (e.g., 1.26.0).');
      return;
    }
    if (!isEditing && !modImage) {
      setError('Please upload a Mod Image (400x400 recommended).');
      return;
    }
    if (!isEditing && !modFile) {
      setError('Please attach a Minecraft Bedrock Mod File (.mcaddon, .mcpack, .mcworld, or .zip).');
      return;
    }
    const selectedCategory = categories.find((c) => c.id === categoryId);
    if (!selectedCategory) {
      setError('Please select a valid category.');
      return;
    }

    const verifiedCompatible = Array.from(
      new Set([mcVersion.trim(), ...compatibleVersions.map((v) => v.trim())])
    ).filter((v) => isValidBedrockVersion(v));

    setSubmitting(true);
    try {
      const res = isEditing
        ? await api.updateMod(editModId!, {
            name,
            description,
            category: selectedCategory,
            mcVersion,
            compatibleVersions: verifiedCompatible,
            creatorName: creatorName.trim() || currentUser.displayName,
            modFile,
            modImage,
          })
        : await api.publishMod({
            name,
            description,
            category: selectedCategory,
            mcVersion,
            compatibleVersions: verifiedCompatible,
            creatorName: creatorName.trim() || currentUser.displayName,
            modFile: modFile!,
            modImage: modImage!,
            user: currentUser,
          });
      onPublished(res.mod);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish mod.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="mx-auto max-w-[680px] px-4 py-14 sm:px-6">
        <div className="rounded-xl border border-white/10 bg-[#15171E] p-8 text-center">
          <UploadCloud className="mx-auto h-11 w-11 text-[#F16436]" />
          <h1 className="mt-4 font-display text-2xl font-extrabold text-white">
            Sign in to Publish Bedrock Mods
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Sign in with Google so your uploaded{' '}
            <span className="font-mono text-zinc-200">.mcaddon</span>,{' '}
            <span className="font-mono text-zinc-200">.mcpack</span>, and{' '}
            <span className="font-mono text-zinc-200">.mcworld</span> releases are saved permanently
            in the cloud and editable from any device.
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
    <div className="mx-auto max-w-[920px] px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-7">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#FF784B]">
          Minecraft Bedrock Edition Only
        </p>
        <h1 className="mt-1.5 font-display text-2xl font-extrabold text-white sm:text-3xl">
          {isEditing ? 'Edit Mod Release' : 'Upload Minecraft Bedrock Mod'}
        </h1>
        <p className="mt-1.5 text-sm text-zinc-400">
          Files are stored securely and validated for Bedrock compatibility (.mcaddon, .mcpack, .mcworld, .zip up to 50 MB).
        </p>
      </div>

      {loadingEdit ? (
        <div className="h-96 animate-pulse rounded-xl border border-white/8 bg-[#15171E]" />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-white/8 bg-[#15171E] p-6 sm:p-8">
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-red-500/35 bg-red-500/10 p-4 text-sm text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 md:grid-cols-[240px_1fr]">
            <div>
              <label className="block text-sm font-semibold text-zinc-200">
                Mod Image <span className="font-normal text-zinc-400">(400x400 rec.)</span>
              </label>
              <label className="mt-2 flex aspect-square w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-white/15 bg-[#1C1F28] hover:border-[#F16436] transition-colors">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Mod thumbnail preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 p-4 text-center">
                    <ImagePlus className="h-8 w-8 text-[#F16436]" />
                    <span className="text-xs font-medium text-zinc-300">Click to upload cover</span>
                    <span className="text-[11px] text-zinc-500">PNG, JPG, WEBP · Max 5 MB</span>
                  </div>
                )}
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                  onChange={(e) => handleImagePick(e.target.files?.[0] || null)}
                  className="sr-only"
                />
              </label>
              {modImage && (
                <p className="mt-2 truncate text-xs text-zinc-400">
                  {modImage.name} ({formatBytes(modImage.size)})
                </p>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="mod-name" className="block text-sm font-semibold text-zinc-200">
                  Mod Name
                </label>
                <input
                  id="mod-name"
                  type="text"
                  required
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Armored Wolf Companions"
                  className="mt-1.5 h-11 w-full rounded-xl border border-white/12 bg-[#0D0E12] px-3.5 text-sm text-white placeholder-zinc-500 focus:border-[#F16436] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="mod-category" className="block text-sm font-semibold text-zinc-200">
                    Category
                  </label>
                  <select
                    id="mod-category"
                    required
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="mt-1.5 h-11 w-full rounded-xl border border-white/12 bg-[#0D0E12] px-3.5 text-sm text-white focus:border-[#F16436] focus:outline-none"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="mod-version" className="block text-sm font-semibold text-zinc-200">
                    Minecraft Version (Bedrock)
                  </label>
                  <select
                    id="mod-version"
                    required
                    value={mcVersion}
                    onChange={(e) => handlePrimaryVersionChange(e.target.value)}
                    className="mt-1.5 h-11 w-full rounded-xl border border-white/12 bg-[#0D0E12] px-3.5 font-mono text-sm text-white focus:border-[#F16436] focus:outline-none"
                  >
                    {availableVersions.map((v) => (
                      <option key={v} value={v}>
                        Bedrock {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="mod-creator" className="block text-sm font-semibold text-zinc-200">
                  Creator Name
                </label>
                <input
                  id="mod-creator"
                  type="text"
                  required
                  maxLength={60}
                  value={creatorName}
                  onChange={(e) => setCreatorName(e.target.value)}
                  placeholder="Your creator name"
                  className="mt-1.5 h-11 w-full rounded-xl border border-white/12 bg-[#0D0E12] px-3.5 text-sm text-white placeholder-zinc-500 focus:border-[#F16436] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Multi-select Compatible Bedrock Versions */}
          <div className="border-t border-white/8 pt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <label className="block text-sm font-semibold text-zinc-200">
                  Compatible Versions
                </label>
                <p className="mt-0.5 text-xs text-zinc-400">
                  Select only the Minecraft Bedrock versions you have tested and verified for this release.
                </p>
              </div>
              {compatibleVersions.length > 1 && (
                <button
                  type="button"
                  onClick={() => setCompatibleVersions([mcVersion])}
                  className="text-xs font-medium text-[#FF784B] hover:underline"
                >
                  Keep primary only
                </button>
              )}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {availableVersions.map((ver) => {
                const isPrimary = ver === mcVersion;
                const isSelected = isPrimary || compatibleVersions.includes(ver);
                return (
                  <button
                    key={ver}
                    type="button"
                    onClick={() => toggleCompatibleVersion(ver)}
                    aria-pressed={isSelected}
                    title={
                      isPrimary
                        ? `${ver} is the primary Minecraft version`
                        : `Toggle ${ver} compatibility`
                    }
                    className={`flex h-10 items-center justify-center gap-1.5 rounded-lg border px-2.5 font-mono text-xs font-semibold transition-colors whitespace-nowrap tabular-nums ${
                      isPrimary
                        ? 'border-[#F16436] bg-[#F16436] text-white'
                        : isSelected
                          ? 'border-[#F16436]/60 bg-[#F16436]/15 text-[#FF784B]'
                          : 'border-white/10 bg-[#0D0E12] text-zinc-400 hover:border-white/25 hover:text-white'
                    }`}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                    <span>{ver}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="mod-desc" className="block text-sm font-semibold text-zinc-200">
              Mod Description
            </label>
            <textarea
              id="mod-desc"
              required
              rows={5}
              maxLength={5000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe features, crafting recipes, experimental toggles required, and Bedrock gameplay changes..."
              className="mt-1.5 w-full rounded-xl border border-white/12 bg-[#0D0E12] p-3.5 text-sm leading-relaxed text-white placeholder-zinc-500 focus:border-[#F16436] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-zinc-200">
              Upload Mod File{' '}
              <span className="font-mono text-xs font-normal text-zinc-400">
                (.mcaddon, .mcpack, .mcworld, .zip · Max 50 MB)
              </span>
            </label>
            <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-[#0D0E12] p-6 text-center hover:border-[#F16436] transition-colors">
              {modFile ? (
                <div className="flex items-center gap-3 text-left">
                  <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-400" />
                  <div>
                    <p className="font-mono text-sm font-semibold text-white">{modFile.name}</p>
                    <p className="text-xs text-zinc-400 tabular-nums">
                      {formatBytes(modFile.size)} · Ready for upload
                    </p>
                  </div>
                </div>
              ) : isEditing && existingFileInfo ? (
                <div className="flex items-center gap-3 text-left">
                  <FileArchive className="h-6 w-6 shrink-0 text-[#F16436]" />
                  <div>
                    <p className="font-mono text-sm font-semibold text-white">
                      Current: {existingFileInfo.name} ({formatBytes(existingFileInfo.size)})
                    </p>
                    <p className="text-xs text-zinc-400">Click to replace with a newer Bedrock package</p>
                  </div>
                </div>
              ) : (
                <>
                  <UploadCloud className="h-8 w-8 text-[#F16436]" />
                  <p className="mt-2 text-sm font-semibold text-zinc-200">
                    Choose a Minecraft Bedrock file
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Supports .mcaddon, .mcpack, .mcworld, .zip · Java .jar files blocked
                  </p>
                </>
              )}
              <input
                type="file"
                accept=".mcaddon,.mcpack,.mcworld,.zip"
                onChange={(e) => handleModFilePick(e.target.files?.[0] || null)}
                className="sr-only"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-white/8 pt-5">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-white/12 px-5 text-sm font-medium text-zinc-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#F16436] px-6 text-sm font-bold text-white hover:bg-[#FF784B] disabled:opacity-60 transition-colors"
            >
              <UploadCloud className="h-4 w-4" />
              {submitting
                ? isEditing
                  ? 'Saving Changes...'
                  : 'Publishing Mod...'
                : isEditing
                  ? 'Save Changes'
                  : 'Publish Mod'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
