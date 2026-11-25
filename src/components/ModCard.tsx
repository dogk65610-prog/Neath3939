import { useState } from 'react';
import { Download, Package } from 'lucide-react';
import { api, formatBytes, formatCompactNumber } from '../lib/api';
import type { ModItem } from '../types';

interface ModCardProps {
  mod: ModItem;
  onSelect: (modId: string) => void;
  onSelectCreator: (username: string) => void;
  onDownloaded?: (modId: string) => void;
}

export function ModCard({ mod, onSelect, onSelectCreator, onDownloaded }: ModCardProps) {
  const [imgError, setImgError] = useState(false);

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = mod.fileUrl;
    link.download = mod.fileOriginalName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    void api.recordDownload(mod.id);
    onDownloaded?.(mod.id);
  };

  return (
    <article
      onClick={() => onSelect(mod.id)}
      className="group flex flex-col overflow-hidden rounded-xl border border-white/8 bg-[#15171E] transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-[#F16436]/50 cursor-pointer"
    >
      {/* Square 1:1 Cover Image */}
      <div className="relative aspect-square w-full overflow-hidden bg-[#1C1F28]">
        {!imgError && mod.imageUrl ? (
          <img
            src={mod.imageUrl}
            alt={`${mod.name} Minecraft Bedrock mod cover`}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#1C1F28] to-[#111318] p-4 text-center">
            <Package className="h-10 w-10 text-[#F16436]" />
            <span className="text-xs font-medium text-zinc-400 line-clamp-2">{mod.name}</span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#15171E] via-[#15171E]/30 to-transparent" />
      </div>

      {/* Card Body */}
      <div className="flex flex-1 flex-col justify-between p-4 pt-2">
        <div>
          <h3 className="font-display text-base font-bold leading-snug text-white group-hover:text-[#FF784B] transition-colors line-clamp-1">
            {mod.name}
          </h3>
          <p className="mt-1 text-xs text-zinc-400">
            by{' '}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectCreator(mod.creatorUsername);
              }}
              className="font-medium text-zinc-300 hover:text-[#F16436] hover:underline"
            >
              {mod.creatorName}
            </button>
          </p>
          <p className="mt-2.5 text-sm leading-relaxed text-zinc-400 line-clamp-2">
            {mod.description}
          </p>
        </div>

        {/* Clean Unboxed Metadata + Download Trigger */}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/6 pt-3">
          <div className="min-w-0 truncate font-mono text-xs text-zinc-400 tabular-nums">
            <span>{mod.categoryName}</span>
            <span className="mx-1.5 text-zinc-600" aria-hidden="true">·</span>
            <span>
              {mod.mcVersion}
              {mod.compatibleVersions && mod.compatibleVersions.length > 1
                ? ` (+${mod.compatibleVersions.length - 1})`
                : ''}
            </span>
            <span className="mx-1.5 text-zinc-600" aria-hidden="true">·</span>
            <span>{mod.fileFormat}</span>
          </div>

          <button
            type="button"
            onClick={handleDownload}
            title={`Download ${mod.fileOriginalName} (${formatBytes(mod.fileSize)})`}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[#1C1F28] px-3 text-xs font-semibold text-zinc-100 hover:bg-[#F16436] hover:text-white transition-colors tabular-nums"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{formatCompactNumber(mod.downloadCount)}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
