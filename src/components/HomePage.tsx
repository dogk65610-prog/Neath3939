import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Flame, PackagePlus, Search, Sparkles, Clock } from 'lucide-react';
import { api, compareBedrockVersions, DEFAULT_VERSION_FILTER_BASES } from '../lib/api';
import type { Category, MinecraftVersion, ModItem } from '../types';
import { ModCard } from './ModCard';

const HERO_IMAGE = '/src/assets/images/hero_bedrock_citadel_1795621584342.jpg';

interface HomePageProps {
  categories: Category[];
  versions: MinecraftVersion[];
  onSelectMod: (modId: string) => void;
  onSelectCreator: (username: string) => void;
  onGoUpload: () => void;
  refreshSignal: number;
}

const FORMAT_OPTIONS = [
  { value: 'all', label: 'All Formats' },
  { value: '.mcaddon', label: '.mcaddon' },
  { value: '.mcpack', label: '.mcpack' },
  { value: '.mcworld', label: '.mcworld' },
  { value: '.zip', label: '.zip' },
];

export function HomePage({
  categories,
  versions,
  onSelectMod,
  onSelectCreator,
  onGoUpload,
  refreshSignal,
}: HomePageProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedFormat, setSelectedFormat] = useState<string>('all');
  const [selectedVersion, setSelectedVersion] = useState<string>('all');
  const [sortMode, setSortMode] = useState<'popular' | 'latest'>('popular');

  const [featuredMods, setFeaturedMods] = useState<ModItem[]>([]);
  const [popularMods, setPopularMods] = useState<ModItem[]>([]);
  const [latestMods, setLatestMods] = useState<ModItem[]>([]);
  const [filteredMods, setFilteredMods] = useState<ModItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const versionFilterOptions = useMemo(() => {
    const extraAbove12660 = versions
      .map((v) => v.version)
      .filter(
        (ver) =>
          !DEFAULT_VERSION_FILTER_BASES.includes(ver) &&
          compareBedrockVersions(ver, '1.26.60') > 0
      )
      .sort(compareBedrockVersions);

    const bases = Array.from(new Set([...DEFAULT_VERSION_FILTER_BASES, ...extraAbove12660]));
    return [
      { value: 'all', label: 'All Versions' },
      ...bases.map((v) => ({ value: `${v}+`, label: `${v}+` })),
    ];
  }, [versions]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 200);
    return () => clearTimeout(t);
  }, [search]);

  const isFiltering =
    debouncedSearch.length > 0 ||
    selectedCategory !== 'all' ||
    selectedFormat !== 'all' ||
    selectedVersion !== 'all';

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (isFiltering) {
          const res = await api.getMods({
            search: debouncedSearch || undefined,
            category: selectedCategory,
            format: selectedFormat,
            version: selectedVersion,
            sort: sortMode,
            limit: 48,
          });
          if (!cancelled) {
            setFilteredMods(res.mods);
          }
        } else {
          const [featRes, popRes, latRes] = await Promise.all([
            api.getMods({ featured: true, sort: 'popular', limit: 6 }),
            api.getMods({ sort: 'popular', limit: 8 }),
            api.getMods({ sort: 'latest', limit: 8 }),
          ]);
          if (!cancelled) {
            setFeaturedMods(featRes.mods);
            setPopularMods(popRes.mods);
            setLatestMods(latRes.mods);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load Bedrock mods.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [
    debouncedSearch,
    selectedCategory,
    selectedFormat,
    selectedVersion,
    sortMode,
    isFiltering,
    refreshSignal,
  ]);

  const handleLocalDownloadIncrement = (modId: string) => {
    const bump = (list: ModItem[]) =>
      list.map((m) => (m.id === modId ? { ...m, downloadCount: m.downloadCount + 1 } : m));
    setFeaturedMods(bump);
    setPopularMods(bump);
    setLatestMods(bump);
    setFilteredMods(bump);
  };

  const resetFilters = () => {
    setSearch('');
    setSelectedCategory('all');
    setSelectedFormat('all');
    setSelectedVersion('all');
  };

  return (
    <div className="pb-16">
      {/* Hero Banner */}
      <section className="relative overflow-hidden border-b border-white/8 bg-[#111319]">
        <div className="absolute inset-0">
          <img
            src={HERO_IMAGE}
            alt="Minecraft Bedrock voxel fortress under amber dusk sky"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover object-center opacity-45"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0D0E12] via-[#0D0E12]/88 to-[#0D0E12]/45" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0D0E12] via-transparent to-[#0D0E12]/40" />
        </div>

        <div className="relative mx-auto max-w-[1280px] px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-2xl"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#FF784B]">
              Minecraft Bedrock Edition Repository
            </p>
            <h1 className="mt-2.5 font-display text-3xl font-extrabold tracking-tight text-white sm:text-5xl [text-wrap:balance]">
              Curated Bedrock Mods, Addons &amp; Worlds
            </h1>
            <p className="mt-3.5 text-base leading-relaxed text-zinc-300 sm:text-lg">
              Download verified <span className="font-mono text-zinc-100">.mcaddon</span>,{' '}
              <span className="font-mono text-zinc-100">.mcpack</span>, and{' '}
              <span className="font-mono text-zinc-100">.mcworld</span> releases built strictly for
              Minecraft Bedrock 1.26+ on Android, iOS, Windows, and Consoles.
            </p>

            {/* Search & Upload Bar */}
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search Bedrock mods, creators, or 1.26.0..."
                  aria-label="Search Minecraft Bedrock mods"
                  className="h-12 w-full rounded-xl border border-white/12 bg-[#15171E]/95 pl-10 pr-4 text-sm text-white placeholder-zinc-500 focus:border-[#F16436] focus:outline-none focus:ring-2 focus:ring-[#F16436]/25"
                />
              </div>
              <button
                type="button"
                onClick={onGoUpload}
                className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#F16436] px-5 text-sm font-semibold text-white hover:bg-[#FF784B] transition-colors whitespace-nowrap"
              >
                <PackagePlus className="h-4 w-4" />
                Upload Mod
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Categories, Version & Format Filter Strip */}
      <section className="border-b border-white/8 bg-[#0D0E12]" aria-label="Categories and filters">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`h-9 shrink-0 rounded-lg px-3.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                selectedCategory === 'all'
                  ? 'bg-[#F16436] text-white'
                  : 'bg-[#15171E] text-zinc-300 hover:bg-[#1C1F28] hover:text-white'
              }`}
            >
              All Categories
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.slug)}
                className={`h-9 shrink-0 rounded-lg px-3.5 text-xs font-semibold transition-colors whitespace-nowrap tabular-nums ${
                  selectedCategory === cat.slug
                    ? 'bg-[#F16436] text-white'
                    : 'bg-[#15171E] text-zinc-300 hover:bg-[#1C1F28] hover:text-white'
                }`}
              >
                {cat.name}
                <span className="ml-1.5 opacity-65">{cat.modCount}</span>
              </button>
            ))}
          </div>

          {/* Version & Format Selectors */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <label htmlFor="version-filter" className="text-xs font-medium text-zinc-400 whitespace-nowrap">
                Version:
              </label>
              <select
                id="version-filter"
                value={selectedVersion}
                onChange={(e) => setSelectedVersion(e.target.value)}
                className="h-9 rounded-lg border border-white/10 bg-[#15171E] px-3 font-mono text-xs text-zinc-200 focus:border-[#F16436] focus:outline-none"
              >
                {versionFilterOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="format-filter" className="text-xs font-medium text-zinc-400 whitespace-nowrap">
                Format:
              </label>
              <select
                id="format-filter"
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value)}
                className="h-9 rounded-lg border border-white/10 bg-[#15171E] px-3 font-mono text-xs text-zinc-200 focus:border-[#F16436] focus:outline-none"
              >
                {FORMAT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="mx-auto max-w-[1280px] px-4 pt-8 sm:px-6">
        {error && (
          <div className="mb-8 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-[340px] animate-pulse rounded-xl border border-white/6 bg-[#15171E]"
              />
            ))}
          </div>
        ) : isFiltering ? (
          <section>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-white">
                  Browse Results
                </h2>
                <p className="mt-1 text-sm text-zinc-400 tabular-nums">
                  {filteredMods.length} Bedrock {filteredMods.length === 1 ? 'mod' : 'mods'} found
                  {selectedVersion !== 'all' ? ` for ${selectedVersion}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSortMode('popular')}
                  className={`h-9 rounded-lg px-3.5 text-xs font-semibold transition-colors ${
                    sortMode === 'popular'
                      ? 'bg-[#1C1F28] text-white border border-white/15'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Most Popular
                </button>
                <button
                  type="button"
                  onClick={() => setSortMode('latest')}
                  className={`h-9 rounded-lg px-3.5 text-xs font-semibold transition-colors ${
                    sortMode === 'latest'
                      ? 'bg-[#1C1F28] text-white border border-white/15'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Latest
                </button>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="h-9 rounded-lg px-3 text-xs font-medium text-[#FF784B] hover:underline"
                >
                  Reset
                </button>
              </div>
            </div>

            {filteredMods.length === 0 ? (
              <div className="rounded-xl border border-white/8 bg-[#15171E] p-12 text-center">
                <p className="font-display text-lg font-bold text-white">No matching Bedrock mods</p>
                <p className="mt-2 text-sm text-zinc-400">
                  Try clearing your search, switching categories, or selecting All Versions.
                </p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-[#F16436] px-4 text-sm font-semibold text-white hover:bg-[#FF784B]"
                >
                  Show All Mods
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {filteredMods.map((mod) => (
                  <ModCard
                    key={mod.id}
                    mod={mod}
                    onSelect={onSelectMod}
                    onSelectCreator={onSelectCreator}
                    onDownloaded={handleLocalDownloadIncrement}
                  />
                ))}
              </div>
            )}
          </section>
        ) : featuredMods.length === 0 && popularMods.length === 0 && latestMods.length === 0 ? (
          <div className="rounded-xl border border-white/8 bg-[#15171E] p-12 text-center">
            <PackagePlus className="mx-auto h-10 w-10 text-[#F16436]" />
            <h2 className="mt-4 font-display text-xl font-bold text-white">
              No Bedrock Mods Published Yet
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Upload your first Minecraft Bedrock <span className="font-mono text-zinc-200">.mcaddon</span>,{' '}
              <span className="font-mono text-zinc-200">.mcpack</span>,{' '}
              <span className="font-mono text-zinc-200">.mcworld</span>, or{' '}
              <span className="font-mono text-zinc-200">.zip</span> package to get started.
            </p>
            <button
              type="button"
              onClick={onGoUpload}
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-[#F16436] px-6 text-sm font-semibold text-white hover:bg-[#FF784B] transition-colors"
            >
              <PackagePlus className="h-4 w-4" />
              Upload First Mod
            </button>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Section 1: Featured Bedrock Mods */}
            {featuredMods.length > 0 && (
              <section>
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="h-5 w-5 text-[#F16436]" />
                    <h2 className="font-display text-xl font-bold text-white sm:text-2xl">
                      Featured Bedrock Mods
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedCategory(categories[0]?.slug || 'all')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-400 hover:text-[#FF784B] transition-colors"
                  >
                    Browse Catalog <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {featuredMods.map((mod) => (
                    <ModCard
                      key={mod.id}
                      mod={mod}
                      onSelect={onSelectMod}
                      onSelectCreator={onSelectCreator}
                      onDownloaded={handleLocalDownloadIncrement}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Section 2: Popular Mods */}
            <section>
              <div className="mb-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <Flame className="h-5 w-5 text-[#F16436]" />
                  <h2 className="font-display text-xl font-bold text-white sm:text-2xl">
                    Popular Mods
                  </h2>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {popularMods.map((mod) => (
                  <ModCard
                    key={mod.id}
                    mod={mod}
                    onSelect={onSelectMod}
                    onSelectCreator={onSelectCreator}
                    onDownloaded={handleLocalDownloadIncrement}
                  />
                ))}
              </div>
            </section>

            {/* Section 3: Latest Mods */}
            <section>
              <div className="mb-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <Clock className="h-5 w-5 text-[#F16436]" />
                  <h2 className="font-display text-xl font-bold text-white sm:text-2xl">
                    Latest Mods
                  </h2>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {latestMods.map((mod) => (
                  <ModCard
                    key={mod.id}
                    mod={mod}
                    onSelect={onSelectMod}
                    onSelectCreator={onSelectCreator}
                    onDownloaded={handleLocalDownloadIncrement}
                  />
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
