import { useState } from 'react';
import { Download, Menu, Shield, User as UserIcon, X, LogOut } from 'lucide-react';
import type { User } from '../types';

export type ActiveRoute =
  | { page: 'home' }
  | { page: 'mod'; modId: string }
  | { page: 'upload'; editModId?: string }
  | { page: 'my-mods' }
  | { page: 'profile'; username: string }
  | { page: 'admin' };

interface NavbarProps {
  route: ActiveRoute;
  user: User | null;
  authReady: boolean;
  onNavigate: (next: ActiveRoute) => void;
  onOpenAuth: () => void;
  onLogout: () => void;
}

export function Navbar({ route, user, authReady, onNavigate, onOpenAuth, onLogout }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinkClass = (active: boolean) =>
    `text-sm font-medium transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
      active
        ? 'text-white border-[#F16436]'
        : 'text-zinc-400 border-transparent hover:text-white'
    }`;

  const handleNav = (next: ActiveRoute) => {
    setMobileOpen(false);
    onNavigate(next);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-[#0D0E12]/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-8 px-4 sm:px-6">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleNav({ page: 'home' })}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F16436]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#F16436] text-white">
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
              <path d="M5 4l3.5 3.5h7L19 4v7.5l2 2.5-2.5 5.5H5.5L3 14l2-2.5V4zm4.5 7.5a1.25 1.25 0 100 2.5 1.25 1.25 0 000-2.5zm5 0a1.25 1.25 0 100 2.5 1.25 1.25 0 000-2.5zm-4 4.5l1.5 1.5 1.5-1.5h-3z" />
            </svg>
          </span>
          <span className="font-display text-lg font-extrabold tracking-tight text-white">
            DOG MODS
          </span>
        </button>

        {/* Zone 2: Primary Navigation Links */}
        <nav className="hidden md:flex items-center gap-7" aria-label="Primary navigation">
          <button
            type="button"
            onClick={() => handleNav({ page: 'home' })}
            className={navLinkClass(route.page === 'home')}
          >
            Explore
          </button>
          <button
            type="button"
            onClick={() => handleNav({ page: 'upload' })}
            className={navLinkClass(route.page === 'upload')}
          >
            Upload Mod
          </button>
          <button
            type="button"
            onClick={() => {
              if (!user) {
                onOpenAuth();
              } else {
                handleNav({ page: 'my-mods' });
              }
            }}
            className={navLinkClass(route.page === 'my-mods')}
          >
            My Mods
          </button>
          <button
            type="button"
            onClick={() => handleNav({ page: 'admin' })}
            className={navLinkClass(route.page === 'admin')}
          >
            Admin
          </button>
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          {!authReady ? (
            <div className="hidden md:block h-9 w-24 animate-pulse rounded-lg bg-[#15171E]" />
          ) : user ? (
            <div className="hidden md:flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleNav({ page: 'profile', username: user.username })}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#15171E] px-3.5 py-1.5 text-sm font-medium text-zinc-100 hover:border-white/20 hover:bg-[#1C1F28] transition-colors whitespace-nowrap shrink-0"
              >
                <UserIcon className="h-4 w-4 text-[#F16436]" />
                <span className="max-w-[140px] truncate">{user.displayName}</span>
              </button>
              <button
                type="button"
                onClick={onLogout}
                title="Sign out"
                aria-label="Sign out"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-zinc-400 hover:border-white/20 hover:text-white transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="hidden md:inline-flex items-center justify-center rounded-lg bg-[#F16436] px-4 py-2 text-sm font-semibold text-white hover:bg-[#FF784B] transition-colors whitespace-nowrap shrink-0"
            >
              Sign In
            </button>
          )}

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="inline-flex md:hidden h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-[#15171E] text-zinc-200 hover:text-white"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="border-t border-white/8 bg-[#15171E] px-4 py-4 md:hidden">
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => handleNav({ page: 'home' })}
              className="flex h-11 items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-zinc-200 hover:bg-white/5"
            >
              <Download className="h-4 w-4 text-[#F16436]" />
              Explore Bedrock Mods
            </button>
            <button
              type="button"
              onClick={() => handleNav({ page: 'upload' })}
              className="flex h-11 items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-zinc-200 hover:bg-white/5"
            >
              <Download className="h-4 w-4 rotate-180 text-[#F16436]" />
              Upload Mod
            </button>
            {user && (
              <>
                <button
                  type="button"
                  onClick={() => handleNav({ page: 'my-mods' })}
                  className="flex h-11 items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-zinc-200 hover:bg-white/5"
                >
                  <UserIcon className="h-4 w-4 text-zinc-400" />
                  My Uploaded Mods
                </button>
                <button
                  type="button"
                  onClick={() => handleNav({ page: 'profile', username: user.username })}
                  className="flex h-11 items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-zinc-200 hover:bg-white/5"
                >
                  <UserIcon className="h-4 w-4 text-zinc-400" />
                  Creator Profile ({user.displayName})
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => handleNav({ page: 'admin' })}
              className="flex h-11 items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-zinc-200 hover:bg-white/5"
            >
              <Shield className="h-4 w-4 text-zinc-400" />
              Admin Dashboard
            </button>
            <div className="mt-2 border-t border-white/8 pt-3">
              {user ? (
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    onLogout();
                  }}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-white/10 text-sm font-medium text-zinc-200 hover:bg-white/5"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    onOpenAuth();
                  }}
                  className="flex h-11 w-full items-center justify-center rounded-lg bg-[#F16436] text-sm font-semibold text-white hover:bg-[#FF784B]"
                >
                  Sign In / Register
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
