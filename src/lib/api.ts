import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { signInWithPopup, signOut } from 'firebase/auth';
import type {
  AdminOverview,
  BedrockFormat,
  Category,
  MinecraftVersion,
  ModItem,
  ModStatus,
  User,
  UserRole,
} from '../types';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './firebase';

const BOOTSTRAP_ADMIN_EMAIL = 'ngpenh@gmail.com';
const BEDROCK_VERSION_REGEX = /^1\.[0-9]{1,3}(\.[0-9]{1,3}){0,2}$/;

export const DEFAULT_BEDROCK_VERSIONS: string[] = [
  '1.26.0',
  '1.26.1',
  '1.26.2',
  '1.26.3',
  '1.26.4',
  '1.26.5',
  '1.26.10',
  '1.26.20',
  '1.26.30',
  '1.26.40',
  '1.26.50',
  '1.26.60',
];

export const DEFAULT_VERSION_FILTER_BASES: string[] = [
  '1.26.0',
  '1.26.1',
  '1.26.10',
  '1.26.20',
  '1.26.30',
  '1.26.40',
  '1.26.50',
  '1.26.60',
];

export function isValidBedrockVersion(version: string): boolean {
  return BEDROCK_VERSION_REGEX.test(version.trim());
}

export function versionToSortOrder(version: string): number {
  const parts = version
    .trim()
    .split('.')
    .map((p) => Number.parseInt(p, 10) || 0);
  const major = parts[0] ?? 1;
  const minor = parts[1] ?? 0;
  const patch = parts[2] ?? 0;
  return major * 1_000_000 + minor * 1_000 + patch;
}

export function compareBedrockVersions(a: string, b: string): number {
  const pa = a
    .trim()
    .split('.')
    .map((p) => Number.parseInt(p, 10) || 0);
  const pb = b
    .trim()
    .split('.')
    .map((p) => Number.parseInt(p, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const dbVal = pb[i] ?? 0;
    if (da !== dbVal) return da - dbVal;
  }
  return 0;
}

export function versionToDocId(version: string): string {
  return version.trim().replace(/\./g, '_');
}

const DEFAULT_CATEGORIES: Array<{
  id: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
}> = [
  {
    id: 'addons',
    name: 'Addons',
    slug: 'addons',
    description: 'Behavior and resource packs adding items, mechanics, and Bedrock gameplay.',
    sortOrder: 1,
  },
  {
    id: 'shaders-textures',
    name: 'Shaders & Textures',
    slug: 'shaders-textures',
    description: 'Vibrant lighting, PBR resource packs, and crisp Bedrock textures.',
    sortOrder: 2,
  },
  {
    id: 'worlds-maps',
    name: 'Worlds & Maps',
    slug: 'worlds-maps',
    description: 'Custom survival islands, adventure citadels, and Bedrock worlds.',
    sortOrder: 3,
  },
  {
    id: 'mobs-bosses',
    name: 'Mobs & Bosses',
    slug: 'mobs-bosses',
    description: 'Loyal companions, custom creatures, and Nether boss encounters.',
    sortOrder: 4,
  },
  {
    id: 'tech-redstone',
    name: 'Tech & Redstone',
    slug: 'tech-redstone',
    description: 'Machinery, conveyors, pipes, and industrial Bedrock automation.',
    sortOrder: 5,
  },
  {
    id: 'ui-utilities',
    name: 'UI & Utilities',
    slug: 'ui-utilities',
    description: 'Clean HUD tweaks, waypoints, and Bedrock quality-of-life utilities.',
    sortOrder: 6,
  },
];

function timestampToIso(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (val && typeof (val as { toDate?: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof val === 'string' && val) return val;
  return new Date().toISOString();
}

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || 'bedrock-mod';
}

function makeUsernameFromUser(displayName: string | null, email: string | null, uid: string): string {
  const raw = (displayName || email?.split('@')[0] || 'creator')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20);
  const base = raw.length >= 3 ? raw : `user_${uid.slice(0, 6).toLowerCase()}`;
  return base.replace(/[^a-z0-9_]/g, '').slice(0, 32) || 'bedrock_user';
}

function docToModItem(id: string, data: Record<string, unknown>): ModItem {
  const mcVersion = String(data.mcVersion || '');
  const rawCompatible = Array.isArray(data.compatibleVersions)
    ? data.compatibleVersions
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        .map((v) => v.trim())
    : [];
  const compatibleVersions =
    rawCompatible.length > 0
      ? Array.from(new Set(rawCompatible))
      : mcVersion
        ? [mcVersion]
        : [];

  return {
    id,
    name: String(data.name || ''),
    slug: String(data.slug || ''),
    description: String(data.description || ''),
    imageUrl: String(data.imageUrl || ''),
    imageFilename: String(data.imageFilename || ''),
    fileUrl: String(data.fileUrl || ''),
    fileStorageName: String(data.fileStorageName || ''),
    fileOriginalName: String(data.fileOriginalName || ''),
    fileSize: Number(data.fileSize || 0),
    fileFormat: (data.fileFormat as BedrockFormat) || '.mcaddon',
    categoryId: String(data.categoryId || ''),
    categoryName: String(data.categoryName || ''),
    categorySlug: String(data.categorySlug || ''),
    mcVersion,
    compatibleVersions,
    creatorName: String(data.creatorName || ''),
    creatorId: String(data.creatorId || ''),
    creatorUsername: String(data.creatorUsername || ''),
    status: (data.status as ModStatus) || 'approved',
    isFeatured: Boolean(data.isFeatured),
    downloadCount: Number(data.downloadCount || 0),
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, idx);
  return `${value >= 10 || idx === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[idx]}`;
}

export function formatCompactNumber(num: number): string {
  if (!Number.isFinite(num)) return '0';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

async function getIdTokenOrThrow(): Promise<string> {
  const fbUser = auth.currentUser;
  if (!fbUser) {
    throw new Error('Authentication required. Please sign in.');
  }
  return fbUser.getIdToken();
}

async function uploadToStorageServer(formData: FormData): Promise<{
  fileUrl?: string;
  fileStorageName?: string;
  fileOriginalName?: string;
  fileSize?: number;
  fileFormat?: BedrockFormat;
  imageUrl?: string;
  imageFilename?: string;
}> {
  const token = await getIdTokenOrThrow();
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || `Upload failed (${res.status}).`);
  }
  return data;
}

async function deleteFilesFromStorageServer(
  fileStorageName?: string,
  imageFilename?: string
): Promise<void> {
  if (!fileStorageName && !imageFilename) return;
  try {
    const token = await getIdTokenOrThrow();
    await fetch('/api/files/delete', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileStorageName, imageFilename }),
    });
  } catch {
    // Non-fatal if storage cleanup fails after Firestore delete
  }
}

export async function ensureDefaultCategories(): Promise<void> {
  if (!auth.currentUser) return;
  try {
    const snap = await getDocs(collection(db, 'categories'));
    const existingIds = new Set(snap.docs.map((d) => d.id));
    for (const cat of DEFAULT_CATEGORIES) {
      if (!existingIds.has(cat.id)) {
        await setDoc(doc(db, 'categories', cat.id), {
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
          sortOrder: cat.sortOrder,
          createdAt: serverTimestamp(),
        });
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'categories');
  }
}

export async function ensureDefaultVersions(): Promise<void> {
  if (!auth.currentUser) return;
  try {
    const snap = await getDocs(collection(db, 'versions'));
    const existingIds = new Set(snap.docs.map((d) => d.id));
    for (const ver of DEFAULT_BEDROCK_VERSIONS) {
      const id = versionToDocId(ver);
      if (!existingIds.has(id)) {
        await setDoc(doc(db, 'versions', id), {
          version: ver,
          label: `Bedrock ${ver}`,
          sortOrder: versionToSortOrder(ver),
          isActive: true,
          createdAt: serverTimestamp(),
        });
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'versions');
  }
}

function normalizeCompatibleList(primary: string, compatible?: string[]): string[] {
  const cleanPrimary = primary.trim();
  const list = [cleanPrimary, ...(compatible || [])]
    .map((v) => v.trim())
    .filter((v) => isValidBedrockVersion(v));
  const unique = Array.from(new Set(list)).slice(0, 40);
  // Keep primary version first so firestore.rules index-0 check always passes
  const rest = unique
    .filter((v) => v !== cleanPrimary)
    .sort(compareBedrockVersions);
  return [cleanPrimary, ...rest];
}

export async function syncSignedInUser(): Promise<User | null> {
  const fbUser = auth.currentUser;
  if (!fbUser) return null;

  const userRef = doc(db, 'users', fbUser.uid);
  const creatorRef = doc(db, 'creators', fbUser.uid);
  const adminRef = doc(db, 'admins', fbUser.uid);
  const isBootstrapOwner =
    fbUser.email === BOOTSTRAP_ADMIN_EMAIL && fbUser.emailVerified === true;

  let userSnap;
  try {
    userSnap = await getDoc(userRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `users/${fbUser.uid}`);
  }

  if (!userSnap.exists()) {
    const username = makeUsernameFromUser(fbUser.displayName, fbUser.email, fbUser.uid);
    const displayName = (fbUser.displayName || username).trim().slice(0, 40) || 'Bedrock Creator';
    const email = (fbUser.email || '').trim().slice(0, 160);
    const avatarUrl = (fbUser.photoURL || '').trim().slice(0, 500);
    const role: UserRole = isBootstrapOwner ? 'admin' : 'user';

    try {
      const batch = writeBatch(db);
      batch.set(creatorRef, {
        uid: fbUser.uid,
        username,
        displayName,
        bio: '',
        avatarUrl,
        createdAt: serverTimestamp(),
      });
      batch.set(userRef, {
        uid: fbUser.uid,
        username,
        email,
        displayName,
        bio: '',
        avatarUrl,
        role,
        isBanned: false,
        createdAt: serverTimestamp(),
      });
      if (isBootstrapOwner) {
        batch.set(adminRef, {
          uid: fbUser.uid,
          email,
          grantedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      userSnap = await getDoc(userRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${fbUser.uid}`);
    }
  } else if (isBootstrapOwner) {
    try {
      const adminSnap = await getDoc(adminRef);
      if (!adminSnap.exists()) {
        await setDoc(adminRef, {
          uid: fbUser.uid,
          email: fbUser.email || BOOTSTRAP_ADMIN_EMAIL,
          grantedAt: serverTimestamp(),
        });
      }
      if (userSnap.data()?.role !== 'admin') {
        await updateDoc(userRef, { role: 'admin' });
        userSnap = await getDoc(userRef);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `admins/${fbUser.uid}`);
    }
  }

  await Promise.all([ensureDefaultCategories(), ensureDefaultVersions()]);

  const data = userSnap.data()!;
  return {
    uid: fbUser.uid,
    username: String(data.username || ''),
    email: String(data.email || ''),
    displayName: String(data.displayName || ''),
    bio: String(data.bio || ''),
    avatarUrl: String(data.avatarUrl || ''),
    role: (data.role as UserRole) || 'user',
    isBanned: Boolean(data.isBanned),
    createdAt: timestampToIso(data.createdAt),
  };
}

export const api = {
  async signInWithGoogle(): Promise<User | null> {
    await signInWithPopup(auth, googleProvider);
    return syncSignedInUser();
  },

  async signOutUser(): Promise<void> {
    await signOut(auth);
  },

  async updateProfile(payload: {
    displayName: string;
    bio: string;
    avatarFile?: File | null;
  }): Promise<{ user: User }> {
    const fbUser = auth.currentUser;
    if (!fbUser) throw new Error('Please sign in first.');

    const userRef = doc(db, 'users', fbUser.uid);
    const creatorRef = doc(db, 'creators', fbUser.uid);

    let currentData: Record<string, unknown>;
    try {
      const snap = await getDoc(userRef);
      if (!snap.exists()) throw new Error('Profile not found.');
      currentData = snap.data();
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `users/${fbUser.uid}`);
    }

    let avatarUrl = String(currentData.avatarUrl || '');
    if (payload.avatarFile) {
      const fd = new FormData();
      fd.append('avatarImage', payload.avatarFile);
      const token = await getIdTokenOrThrow();
      const res = await fetch('/api/upload/avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || 'Avatar upload failed.');
      }
      avatarUrl = json.imageUrl;
    }

    const nextDisplay = payload.displayName.trim().slice(0, 40) || String(currentData.displayName);
    const nextBio = payload.bio.trim().slice(0, 500);

    try {
      const batch = writeBatch(db);
      batch.update(userRef, {
        displayName: nextDisplay,
        bio: nextBio,
        avatarUrl,
      });
      batch.update(creatorRef, {
        displayName: nextDisplay,
        bio: nextBio,
        avatarUrl,
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${fbUser.uid}`);
    }

    const updated = await syncSignedInUser();
    if (!updated) throw new Error('Unable to reload profile.');
    return { user: updated };
  },

  async getCategories(): Promise<{ categories: Category[] }> {
    let catSnap;
    let modsSnap;
    try {
      [catSnap, modsSnap] = await Promise.all([
        getDocs(collection(db, 'categories')),
        getDocs(query(collection(db, 'mods'), where('status', '==', 'approved'))),
      ]);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'categories');
    }

    const countByCat = new Map<string, number>();
    for (const d of modsSnap.docs) {
      const catId = String(d.data().categoryId || '');
      countByCat.set(catId, (countByCat.get(catId) || 0) + 1);
    }

    if (catSnap.empty) {
      return {
        categories: DEFAULT_CATEGORIES.map((c) => ({
          ...c,
          modCount: countByCat.get(c.id) || 0,
        })),
      };
    }

    const categories: Category[] = catSnap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: String(data.name || ''),
          slug: String(data.slug || d.id),
          description: String(data.description || ''),
          sortOrder: Number(data.sortOrder || 0),
          modCount: countByCat.get(d.id) || 0,
        };
      })
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

    return { categories };
  },

  async getVersions(): Promise<{ versions: MinecraftVersion[] }> {
    let snap;
    try {
      snap = await getDocs(collection(db, 'versions'));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'versions');
    }

    if (snap.empty) {
      return {
        versions: DEFAULT_BEDROCK_VERSIONS.map((v) => ({
          id: versionToDocId(v),
          version: v,
          label: `Bedrock ${v}`,
          sortOrder: versionToSortOrder(v),
          isActive: true,
        })),
      };
    }

    const versions: MinecraftVersion[] = snap.docs
      .map((d) => {
        const data = d.data();
        const ver = String(data.version || d.id.replace(/_/g, '.'));
        return {
          id: d.id,
          version: ver,
          label: String(data.label || `Bedrock ${ver}`),
          sortOrder: Number(data.sortOrder || versionToSortOrder(ver)),
          isActive: data.isActive !== false,
        };
      })
      .filter((v) => v.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder || compareBedrockVersions(a.version, b.version));

    return { versions };
  },

  async createVersion(payload: { version: string; label?: string }): Promise<MinecraftVersion> {
    await ensureDefaultVersions();
    const cleanVersion = payload.version.trim();
    if (!isValidBedrockVersion(cleanVersion)) {
      throw new Error('Enter a valid Minecraft Bedrock version like 1.26.70 or 1.27.0.');
    }
    const cleanLabel = (payload.label?.trim() || `Bedrock ${cleanVersion}`).slice(0, 32);
    const docId = versionToDocId(cleanVersion);
    const sortOrder = versionToSortOrder(cleanVersion);

    try {
      const existingSnap = await getDoc(doc(db, 'versions', docId));
      if (existingSnap.exists()) {
        throw new Error(`Version ${cleanVersion} already exists.`);
      }
      await setDoc(doc(db, 'versions', docId), {
        version: cleanVersion,
        label: cleanLabel,
        sortOrder,
        isActive: true,
        createdAt: serverTimestamp(),
      });
      return {
        id: docId,
        version: cleanVersion,
        label: cleanLabel,
        sortOrder,
        isActive: true,
      };
    } catch (err) {
      if (err instanceof Error && err.message.includes('already exists')) throw err;
      handleFirestoreError(err, OperationType.CREATE, `versions/${docId}`);
    }
  },

  async deleteVersion(id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'versions', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `versions/${id}`);
    }
  },

  async getMods(params?: {
    search?: string;
    category?: string;
    format?: string;
    version?: string;
    sort?: 'latest' | 'popular' | 'featured';
    featured?: boolean;
    limit?: number;
  }): Promise<{ mods: ModItem[] }> {
    let snap;
    try {
      snap = await getDocs(query(collection(db, 'mods'), where('status', '==', 'approved')));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'mods');
    }

    let items = snap.docs.map((d) => docToModItem(d.id, d.data()));

    if (params?.featured) {
      items = items.filter((m) => m.isFeatured);
    }
    if (params?.category && params.category !== 'all') {
      items = items.filter((m) => m.categorySlug === params.category || m.categoryId === params.category);
    }
    if (params?.format && params.format !== 'all') {
      items = items.filter((m) => m.fileFormat === params.format);
    }
    if (params?.version && params.version !== 'all') {
      const rawFilter = params.version.trim();
      const isPlus = rawFilter.endsWith('+');
      const minVer = isPlus ? rawFilter.slice(0, -1) : rawFilter;
      items = items.filter((m) => {
        const declared = Array.from(
          new Set([m.mcVersion, ...m.compatibleVersions].filter(Boolean))
        );
        if (isPlus) {
          return declared.some((v) => compareBedrockVersions(v, minVer) >= 0);
        }
        return declared.includes(minVer);
      });
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      items = items.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          m.creatorName.toLowerCase().includes(q) ||
          m.mcVersion.toLowerCase().includes(q) ||
          m.compatibleVersions.some((v) => v.toLowerCase().includes(q))
      );
    }

    if (params?.sort === 'popular') {
      items.sort((a, b) => b.downloadCount - a.downloadCount || b.createdAt.localeCompare(a.createdAt));
    } else if (params?.sort === 'featured') {
      items.sort(
        (a, b) =>
          Number(b.isFeatured) - Number(a.isFeatured) ||
          b.downloadCount - a.downloadCount ||
          b.createdAt.localeCompare(a.createdAt)
      );
    } else {
      items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    if (params?.limit && params.limit > 0) {
      items = items.slice(0, params.limit);
    }

    return { mods: items };
  },

  async getMod(id: string): Promise<{ mod: ModItem }> {
    let snap;
    try {
      snap = await getDoc(doc(db, 'mods', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `mods/${id}`);
    }
    if (!snap.exists()) {
      throw new Error('Mod not found.');
    }
    return { mod: docToModItem(snap.id, snap.data()) };
  },

  async recordDownload(modId: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'mods', modId), {
        downloadCount: increment(1),
      });
    } catch {
      // Never block user download if counter increment fails
    }
  },

  async getProfile(username: string): Promise<{ profile: User; mods: ModItem[] }> {
    const clean = username.trim().toLowerCase();
    let creatorSnap;
    let modsSnap;
    try {
      creatorSnap = await getDocs(
        query(collection(db, 'creators'), where('username', '==', clean))
      );
      if (creatorSnap.empty) {
        throw new Error('Creator profile not found.');
      }
      const creatorDoc = creatorSnap.docs[0];
      modsSnap = await getDocs(
        query(collection(db, 'mods'), where('status', '==', 'approved'))
      );

      const cData = creatorDoc.data();
      const mods = modsSnap.docs
        .map((d) => docToModItem(d.id, d.data()))
        .filter((m) => m.creatorId === creatorDoc.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      const totalDownloads = mods.reduce((sum, m) => sum + m.downloadCount, 0);

      return {
        profile: {
          uid: creatorDoc.id,
          username: String(cData.username || ''),
          displayName: String(cData.displayName || ''),
          bio: String(cData.bio || ''),
          avatarUrl: String(cData.avatarUrl || ''),
          role: 'user',
          isBanned: false,
          createdAt: timestampToIso(cData.createdAt),
          modCount: mods.length,
          totalDownloads,
        },
        mods,
      };
    } catch (err) {
      if (err instanceof Error && err.message === 'Creator profile not found.') {
        throw err;
      }
      handleFirestoreError(err, OperationType.GET, `creators/${clean}`);
    }
  },

  async getMyMods(): Promise<{ mods: ModItem[] }> {
    const fbUser = auth.currentUser;
    if (!fbUser) return { mods: [] };
    try {
      const snap = await getDocs(
        query(collection(db, 'mods'), where('creatorId', '==', fbUser.uid))
      );
      const mods = snap.docs
        .map((d) => docToModItem(d.id, d.data()))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return { mods };
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'mods');
    }
  },

  async publishMod(payload: {
    name: string;
    description: string;
    category: Category;
    mcVersion: string;
    compatibleVersions: string[];
    creatorName: string;
    modFile: File;
    modImage: File;
    user: User;
  }): Promise<{ mod: ModItem }> {
    await Promise.all([ensureDefaultCategories(), ensureDefaultVersions()]);

    const fd = new FormData();
    fd.append('modFile', payload.modFile);
    fd.append('modImage', payload.modImage);
    const uploaded = await uploadToStorageServer(fd);

    if (!uploaded.fileUrl || !uploaded.fileStorageName || !uploaded.imageUrl) {
      throw new Error('File storage did not return valid URLs.');
    }

    const cleanName = payload.name.trim().slice(0, 80);
    const cleanDesc = payload.description.trim().slice(0, 5000);
    const cleanVersion = payload.mcVersion.trim().slice(0, 20);
    const cleanCompatible = normalizeCompatibleList(cleanVersion, payload.compatibleVersions);
    const cleanCreator = payload.creatorName.trim().slice(0, 60) || payload.user.displayName;
    const slug = `${slugify(cleanName)}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      const docRef = await addDoc(collection(db, 'mods'), {
        name: cleanName,
        slug,
        description: cleanDesc,
        imageUrl: uploaded.imageUrl,
        imageFilename: uploaded.imageFilename || '',
        fileUrl: uploaded.fileUrl,
        fileStorageName: uploaded.fileStorageName,
        fileOriginalName: uploaded.fileOriginalName || payload.modFile.name,
        fileSize: uploaded.fileSize || payload.modFile.size,
        fileFormat: uploaded.fileFormat || '.mcaddon',
        categoryId: payload.category.id,
        categoryName: payload.category.name,
        categorySlug: payload.category.slug,
        mcVersion: cleanVersion,
        compatibleVersions: cleanCompatible,
        creatorName: cleanCreator,
        creatorId: payload.user.uid,
        creatorUsername: payload.user.username,
        status: 'approved',
        isFeatured: false,
        downloadCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const createdSnap = await getDoc(docRef);
      return { mod: docToModItem(createdSnap.id, createdSnap.data()!) };
    } catch (err) {
      await deleteFilesFromStorageServer(uploaded.fileStorageName, uploaded.imageFilename);
      handleFirestoreError(err, OperationType.CREATE, 'mods');
    }
  },

  async updateMod(
    id: string,
    payload: {
      name: string;
      description: string;
      category: Category;
      mcVersion: string;
      compatibleVersions: string[];
      creatorName: string;
      modFile?: File | null;
      modImage?: File | null;
    }
  ): Promise<{ mod: ModItem }> {
    const modRef = doc(db, 'mods', id);
    let existingSnap;
    try {
      existingSnap = await getDoc(modRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `mods/${id}`);
    }
    if (!existingSnap.exists()) {
      throw new Error('Mod not found.');
    }
    const existing = docToModItem(existingSnap.id, existingSnap.data());

    let uploaded: Awaited<ReturnType<typeof uploadToStorageServer>> = {};
    if (payload.modFile || payload.modImage) {
      const fd = new FormData();
      if (payload.modFile) fd.append('modFile', payload.modFile);
      if (payload.modImage) fd.append('modImage', payload.modImage);
      uploaded = await uploadToStorageServer(fd);
    }

    const cleanName = payload.name.trim().slice(0, 80);
    const cleanDesc = payload.description.trim().slice(0, 5000);
    const cleanVersion = payload.mcVersion.trim().slice(0, 20);
    const cleanCompatible = normalizeCompatibleList(cleanVersion, payload.compatibleVersions);
    const cleanCreator = payload.creatorName.trim().slice(0, 60) || existing.creatorName;

    try {
      await updateDoc(modRef, {
        name: cleanName,
        slug: existing.slug,
        description: cleanDesc,
        imageUrl: uploaded.imageUrl || existing.imageUrl,
        imageFilename: uploaded.imageFilename ?? existing.imageFilename,
        fileUrl: uploaded.fileUrl || existing.fileUrl,
        fileStorageName: uploaded.fileStorageName || existing.fileStorageName,
        fileOriginalName: uploaded.fileOriginalName || existing.fileOriginalName,
        fileSize: uploaded.fileSize || existing.fileSize,
        fileFormat: uploaded.fileFormat || existing.fileFormat,
        categoryId: payload.category.id,
        categoryName: payload.category.name,
        categorySlug: payload.category.slug,
        mcVersion: cleanVersion,
        compatibleVersions: cleanCompatible,
        creatorName: cleanCreator,
        updatedAt: serverTimestamp(),
      });

      if (uploaded.fileStorageName && existing.fileStorageName) {
        await deleteFilesFromStorageServer(existing.fileStorageName, undefined);
      }
      if (uploaded.imageFilename && existing.imageFilename) {
        await deleteFilesFromStorageServer(undefined, existing.imageFilename);
      }

      const updatedSnap = await getDoc(modRef);
      return { mod: docToModItem(updatedSnap.id, updatedSnap.data()!) };
    } catch (err) {
      await deleteFilesFromStorageServer(uploaded.fileStorageName, uploaded.imageFilename);
      handleFirestoreError(err, OperationType.UPDATE, `mods/${id}`);
    }
  },

  async deleteMod(mod: Pick<ModItem, 'id' | 'fileStorageName' | 'imageFilename'>): Promise<void> {
    try {
      await deleteDoc(doc(db, 'mods', mod.id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `mods/${mod.id}`);
    }
    await deleteFilesFromStorageServer(mod.fileStorageName, mod.imageFilename);
  },

  // --- ADMIN CONTROLS ---
  async getAdminData(params?: { status?: string; search?: string }): Promise<{
    overview: AdminOverview;
    mods: ModItem[];
    users: User[];
    categories: Category[];
    versions: MinecraftVersion[];
  }> {
    try {
      const [modsSnap, usersSnap, catsRes, versRes] = await Promise.all([
        getDocs(collection(db, 'mods')),
        getDocs(collection(db, 'users')),
        this.getCategories(),
        this.getVersions(),
      ]);

      const allMods = modsSnap.docs
        .map((d) => docToModItem(d.id, d.data()))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      const modCountsByUser = new Map<string, { count: number; downloads: number }>();
      let pendingMods = 0;
      let approvedMods = 0;
      let rejectedMods = 0;
      let totalDownloads = 0;

      for (const m of allMods) {
        if (m.status === 'pending') pendingMods++;
        else if (m.status === 'approved') approvedMods++;
        else if (m.status === 'rejected') rejectedMods++;
        totalDownloads += m.downloadCount;

        const cur = modCountsByUser.get(m.creatorId) || { count: 0, downloads: 0 };
        cur.count += 1;
        cur.downloads += m.downloadCount;
        modCountsByUser.set(m.creatorId, cur);
      }

      const users: User[] = usersSnap.docs
        .map((d) => {
          const data = d.data();
          const stats = modCountsByUser.get(d.id) || { count: 0, downloads: 0 };
          return {
            uid: d.id,
            username: String(data.username || ''),
            email: String(data.email || ''),
            displayName: String(data.displayName || ''),
            bio: String(data.bio || ''),
            avatarUrl: String(data.avatarUrl || ''),
            role: (data.role as UserRole) || 'user',
            isBanned: Boolean(data.isBanned),
            createdAt: timestampToIso(data.createdAt),
            modCount: stats.count,
            totalDownloads: stats.downloads,
          };
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      let filteredMods = allMods;
      if (params?.status && params.status !== 'all') {
        filteredMods = filteredMods.filter((m) => m.status === params.status);
      }
      if (params?.search) {
        const q = params.search.toLowerCase();
        filteredMods = filteredMods.filter(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            m.creatorName.toLowerCase().includes(q) ||
            m.creatorUsername.toLowerCase().includes(q)
        );
      }

      return {
        overview: {
          totalMods: allMods.length,
          pendingMods,
          approvedMods,
          rejectedMods,
          totalDownloads,
          totalUsers: users.length,
          totalCategories: catsRes.categories.length,
        },
        mods: filteredMods,
        users,
        categories: catsRes.categories,
        versions: versRes.versions,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'admin');
    }
  },

  async setModStatus(id: string, status: ModStatus): Promise<ModItem> {
    const modRef = doc(db, 'mods', id);
    try {
      await updateDoc(modRef, {
        status,
        updatedAt: serverTimestamp(),
      });
      const snap = await getDoc(modRef);
      return docToModItem(snap.id, snap.data()!);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `mods/${id}`);
    }
  },

  async setModFeatured(id: string, isFeatured: boolean): Promise<ModItem> {
    const modRef = doc(db, 'mods', id);
    try {
      await updateDoc(modRef, {
        isFeatured,
        updatedAt: serverTimestamp(),
      });
      const snap = await getDoc(modRef);
      return docToModItem(snap.id, snap.data()!);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `mods/${id}`);
    }
  },

  async updateAdminUser(
    targetUser: User,
    payload: { role?: UserRole; isBanned?: boolean }
  ): Promise<void> {
    const userRef = doc(db, 'users', targetUser.uid);
    const adminRef = doc(db, 'admins', targetUser.uid);
    try {
      const nextRole = payload.role ?? targetUser.role;
      const nextBanned = payload.isBanned ?? targetUser.isBanned;
      await updateDoc(userRef, { role: nextRole, isBanned: nextBanned });
      if (payload.role === 'admin') {
        await setDoc(adminRef, {
          uid: targetUser.uid,
          email: targetUser.email || '',
          grantedAt: serverTimestamp(),
        });
      } else if (payload.role === 'user') {
        await deleteDoc(adminRef);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUser.uid}`);
    }
  },

  async deleteAdminUser(uid: string): Promise<void> {
    try {
      const modsSnap = await getDocs(
        query(collection(db, 'mods'), where('creatorId', '==', uid))
      );
      for (const mDoc of modsSnap.docs) {
        const data = mDoc.data();
        await deleteDoc(mDoc.ref);
        await deleteFilesFromStorageServer(
          String(data.fileStorageName || ''),
          String(data.imageFilename || '')
        );
      }
      await deleteDoc(doc(db, 'users', uid));
      await deleteDoc(doc(db, 'creators', uid));
      await deleteDoc(doc(db, 'admins', uid));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${uid}`);
    }
  },

  async createCategory(payload: { name: string; description: string }): Promise<void> {
    await ensureDefaultCategories();
    const cleanName = payload.name.trim().slice(0, 40);
    const cleanDesc = payload.description.trim().slice(0, 300);
    if (cleanName.length < 2) {
      throw new Error('Category name must be at least 2 characters.');
    }
    const slug = slugify(cleanName);
    try {
      const existingSnap = await getDocs(collection(db, 'categories'));
      if (existingSnap.docs.some((d) => d.id === slug)) {
        throw new Error('A category with that name already exists.');
      }
      await setDoc(doc(db, 'categories', slug), {
        name: cleanName,
        slug,
        description: cleanDesc,
        sortOrder: existingSnap.size + 1,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      if (err instanceof Error && err.message.includes('already exists')) throw err;
      handleFirestoreError(err, OperationType.CREATE, `categories/${slug}`);
    }
  },

  async deleteCategory(id: string): Promise<void> {
    try {
      const modsSnap = await getDocs(
        query(collection(db, 'mods'), where('categoryId', '==', id))
      );
      if (!modsSnap.empty) {
        throw new Error(
          `Cannot delete category while ${modsSnap.size} mod(s) are assigned to it.`
        );
      }
      await deleteDoc(doc(db, 'categories', id));
    } catch (err) {
      if (err instanceof Error && err.message.includes('Cannot delete category')) throw err;
      handleFirestoreError(err, OperationType.DELETE, `categories/${id}`);
    }
  },
};
