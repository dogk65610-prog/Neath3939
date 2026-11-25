import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const DATA_DIR = path.resolve(process.cwd(), 'data');
export const STORAGE_DIR = path.resolve(process.cwd(), 'storage');
export const MODS_DIR = path.resolve(STORAGE_DIR, 'mods');
export const IMAGES_DIR = path.resolve(STORAGE_DIR, 'images');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(MODS_DIR, { recursive: true });
fs.mkdirSync(IMAGES_DIR, { recursive: true });

export const db = new Database(path.join(DATA_DIR, 'dogmods.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT '',
    avatar_url TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'user',
    is_banned INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS mods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    image_url TEXT NOT NULL,
    image_filename TEXT,
    file_storage_name TEXT NOT NULL,
    file_original_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    file_format TEXT NOT NULL,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    mc_version TEXT NOT NULL,
    creator_name TEXT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    is_featured INTEGER NOT NULL DEFAULT 0,
    download_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_mods_status ON mods(status);
  CREATE INDEX IF NOT EXISTS idx_mods_category ON mods(category_id);
  CREATE INDEX IF NOT EXISTS idx_mods_featured ON mods(is_featured);
  CREATE INDEX IF NOT EXISTS idx_mods_user ON mods(user_id);
`);

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) {
    return false;
  }
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
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

export async function initializeDatabaseSeed(): Promise<void> {
  const catCount = (db.prepare('SELECT COUNT(*) as c FROM categories').get() as { c: number }).c;
  const now = new Date().toISOString();

  if (catCount === 0) {
    const insertCat = db.prepare(
      'INSERT INTO categories (name, slug, description, sort_order, created_at) VALUES (?, ?, ?, ?, ?)'
    );
    const seedCategories = [
      ['Addons', 'addons', 'Behavior and resource packs adding items, mechanics, and Bedrock gameplay.', 1],
      ['Shaders & Textures', 'shaders-textures', 'Vibrant lighting, PBR resource packs, and crisp Bedrock textures.', 2],
      ['Worlds & Maps', 'worlds-maps', 'Custom survival islands, adventure citadels, and Bedrock worlds.', 3],
      ['Mobs & Bosses', 'mobs-bosses', 'Loyal companions, custom creatures, and Nether boss encounters.', 4],
      ['Tech & Redstone', 'tech-redstone', 'Machinery, conveyors, pipes, and industrial Bedrock automation.', 5],
      ['UI & Utilities', 'ui-utilities', 'Clean HUD tweaks, waypoints, and Bedrock quality-of-life utilities.', 6],
    ] as const;

    const tx = db.transaction(() => {
      for (const [name, slug, desc, order] of seedCategories) {
        insertCat.run(name, slug, desc, order, now);
      }
    });
    tx();
  }
}
