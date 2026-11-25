export type UserRole = 'user' | 'admin';
export type ModStatus = 'pending' | 'approved' | 'rejected';
export type BedrockFormat = '.mcaddon' | '.mcpack' | '.mcworld' | '.zip';

export interface User {
  uid: string;
  username: string;
  email?: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  role: UserRole;
  isBanned: boolean;
  createdAt: string;
  modCount?: number;
  totalDownloads?: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
  modCount: number;
}

export interface MinecraftVersion {
  id: string;
  version: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

export interface ModItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  imageFilename: string;
  fileUrl: string;
  fileStorageName: string;
  fileOriginalName: string;
  fileSize: number;
  fileFormat: BedrockFormat;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  mcVersion: string;
  compatibleVersions: string[];
  creatorName: string;
  creatorId: string;
  creatorUsername: string;
  status: ModStatus;
  isFeatured: boolean;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOverview {
  totalMods: number;
  pendingMods: number;
  approvedMods: number;
  rejectedMods: number;
  totalDownloads: number;
  totalUsers: number;
  totalCategories: number;
}
