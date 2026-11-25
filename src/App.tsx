import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { CheckCircle2, X } from 'lucide-react';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthModal } from './components/AuthModal';
import { HomePage } from './components/HomePage';
import { ModDetailsPage } from './components/ModDetailsPage';
import { MyModsPage } from './components/MyModsPage';
import { ActiveRoute, Navbar } from './components/Navbar';
import { ProfilePage } from './components/ProfilePage';
import { UploadModPage } from './components/UploadModPage';
import { api, syncSignedInUser } from './lib/api';
import { auth } from './lib/firebase';
import type { Category, MinecraftVersion, ModItem, User } from './types';

function parseHashRoute(): ActiveRoute {
  const hash = window.location.hash.replace(/^#/, '');
  if (hash.startsWith('/mod/')) {
    const id = decodeURIComponent(hash.slice('/mod/'.length)).trim();
    if (id) return { page: 'mod', modId: id };
  }
  if (hash === '/upload') return { page: 'upload' };
  if (hash.startsWith('/edit/')) {
    const id = decodeURIComponent(hash.slice('/edit/'.length)).trim();
    if (id) return { page: 'upload', editModId: id };
  }
  if (hash === '/my-mods') return { page: 'my-mods' };
  if (hash.startsWith('/profile/')) {
    const username = decodeURIComponent(hash.slice('/profile/'.length)).trim();
    if (username) return { page: 'profile', username };
  }
  if (hash === '/admin') return { page: 'admin' };
  return { page: 'home' };
}

function routeToHash(route: ActiveRoute): string {
  switch (route.page) {
    case 'mod':
      return `#/mod/${encodeURIComponent(route.modId)}`;
    case 'upload':
      return route.editModId ? `#/edit/${encodeURIComponent(route.editModId)}` : '#/upload';
    case 'my-mods':
      return '#/my-mods';
    case 'profile':
      return `#/profile/${encodeURIComponent(route.username)}`;
    case 'admin':
      return '#/admin';
    default:
      return '#/';
  }
}

export default function App() {
  const [route, setRoute] = useState<ActiveRoute>(() => parseHashRoute());
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [versions, setVersions] = useState<MinecraftVersion[]>([]);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const loadMetadata = useCallback(async () => {
    try {
      const [catRes, verRes] = await Promise.all([api.getCategories(), api.getVersions()]);
      setCategories(catRes.categories);
      setVersions(verRes.versions);
    } catch {
      // Handled gracefully
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (fbUser) {
          const synced = await syncSignedInUser();
          setUser(synced);
        } else {
          setUser(null);
        }
      } catch (err) {
        setNotice(
          err instanceof Error
            ? `Failed to sync account profile: ${err.message}`
            : 'Failed to restore sign-in session.'
        );
      } finally {
        setAuthReady(true);
        setRefreshSignal((s) => s + 1);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata, refreshSignal]);

  useEffect(() => {
    const onHashChange = () => {
      setRoute(parseHashRoute());
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((next: ActiveRoute) => {
    setRoute(next);
    const nextHash = routeToHash(next);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const bumpRefresh = useCallback(() => {
    setRefreshSignal((s) => s + 1);
  }, []);

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
  }, []);

  const handleLogout = async () => {
    try {
      await api.signOutUser();
      setUser(null);
      if (route.page === 'my-mods') {
        navigate({ page: 'home' });
      }
      showNotice('You have signed out.');
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Sign-out failed.');
    }
  };

  const handlePublishedMod = (mod: ModItem) => {
    bumpRefresh();
    if (mod.status === 'approved') {
      showNotice(`"${mod.name}" is now published and live on DOG MODS.`);
    } else {
      showNotice(`"${mod.name}" was saved and is available in My Mods.`);
    }
    navigate({ page: 'mod', modId: mod.id });
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#0D0E12] text-[#F3F4F6]">
      <Navbar
        route={route}
        user={user}
        authReady={authReady}
        onNavigate={navigate}
        onOpenAuth={() => setAuthModalOpen(true)}
        onLogout={handleLogout}
      />

      {notice && (
        <div className="border-b border-[#F16436]/30 bg-[#F16436]/12">
          <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-4 py-2.5 text-xs font-medium text-zinc-100 sm:px-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#FF784B]" />
              <span>{notice}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Dismiss notice"
              className="rounded p-1 text-zinc-400 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <main className="flex-1">
        {route.page === 'home' && (
          <HomePage
            categories={categories}
            versions={versions}
            onSelectMod={(modId) => navigate({ page: 'mod', modId })}
            onSelectCreator={(username) => navigate({ page: 'profile', username })}
            onGoUpload={() => navigate({ page: 'upload' })}
            refreshSignal={refreshSignal}
          />
        )}

        {route.page === 'mod' && (
          <ModDetailsPage
            modId={route.modId}
            currentUser={user}
            onBack={() => navigate({ page: 'home' })}
            onSelectCreator={(username) => navigate({ page: 'profile', username })}
            onEditMod={(modId) => navigate({ page: 'upload', editModId: modId })}
            onModChanged={bumpRefresh}
          />
        )}

        {route.page === 'upload' && (
          <UploadModPage
            currentUser={user}
            categories={categories}
            versions={versions}
            editModId={route.editModId}
            onOpenAuth={() => setAuthModalOpen(true)}
            onPublished={handlePublishedMod}
            onCancel={() =>
              route.editModId
                ? navigate({ page: 'mod', modId: route.editModId })
                : navigate({ page: 'home' })
            }
          />
        )}

        {route.page === 'my-mods' && (
          <MyModsPage
            currentUser={user}
            onOpenAuth={() => setAuthModalOpen(true)}
            onSelectMod={(modId) => navigate({ page: 'mod', modId })}
            onEditMod={(modId) => navigate({ page: 'upload', editModId: modId })}
            onUploadNew={() => navigate({ page: 'upload' })}
            onChanged={bumpRefresh}
          />
        )}

        {route.page === 'profile' && (
          <ProfilePage
            username={route.username}
            currentUser={user}
            onSelectMod={(modId) => navigate({ page: 'mod', modId })}
            onSelectCreator={(username) => navigate({ page: 'profile', username })}
            onUserUpdated={(updated) => setUser(updated)}
          />
        )}

        {route.page === 'admin' && (
          <AdminDashboard
            currentUser={user}
            authReady={authReady}
            onOpenAuth={() => setAuthModalOpen(true)}
            onSelectMod={(modId) => navigate({ page: 'mod', modId })}
            onDataChanged={bumpRefresh}
          />
        )}
      </main>

      <footer className="border-t border-white/8 bg-[#0D0E12] py-8">
        <div className="mx-auto flex max-w-[1280px] flex-col items-start justify-between gap-4 px-4 text-xs text-zinc-500 sm:flex-row sm:items-center sm:px-6">
          <p>DOG MODS — Minecraft Bedrock Edition Mod &amp; Addon Portal</p>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => navigate({ page: 'home' })}
              className="hover:text-zinc-300"
            >
              Explore
            </button>
            <button
              type="button"
              onClick={() => navigate({ page: 'upload' })}
              className="hover:text-zinc-300"
            >
              Upload Mod
            </button>
            <button
              type="button"
              onClick={() => navigate({ page: 'admin' })}
              className="hover:text-zinc-300"
            >
              Admin
            </button>
          </div>
        </div>
      </footer>

      {authModalOpen && (
        <AuthModal
          onClose={() => setAuthModalOpen(false)}
          onAuthenticated={(u) => {
            setUser(u);
            bumpRefresh();
            showNotice(`Signed in as ${u.displayName}.`);
          }}
        />
      )}
    </div>
  );
}
