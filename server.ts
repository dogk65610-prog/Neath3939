import 'dotenv/config';
import crypto from 'crypto';
import express, { NextFunction, Request, Response } from 'express';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { DecodedIdToken, getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

const PORT = Number(process.env.PORT) || 3000;
const BOOTSTRAP_ADMIN_EMAIL = 'ngpenh@gmail.com';
const MAX_MOD_FILE_BYTES = 50 * 1024 * 1024; // 50 MB
const MAX_IMAGE_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_MOD_EXTENSIONS = new Set(['.mcaddon', '.mcpack', '.mcworld', '.zip']);
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

const STORAGE_DIR = path.resolve(process.cwd(), 'storage');
const MODS_DIR = path.resolve(STORAGE_DIR, 'mods');
const IMAGES_DIR = path.resolve(STORAGE_DIR, 'images');
const META_DIR = path.resolve(STORAGE_DIR, 'meta');

fs.mkdirSync(MODS_DIR, { recursive: true });
fs.mkdirSync(IMAGES_DIR, { recursive: true });
fs.mkdirSync(META_DIR, { recursive: true });

const adminApp = getApps().length
  ? getApp()
  : initializeApp({ projectId: firebaseConfig.projectId });
const adminAuth = getAuth(adminApp);

interface AuthedRequest extends Request {
  firebaseUser?: DecodedIdToken;
}

interface FileOwnershipMeta {
  ownerUid: string;
  fileStorageName?: string;
  fileOriginalName?: string;
  imageFilename?: string;
}

function safeResolveInDir(baseDir: string, filename: string): string | null {
  if (!filename || typeof filename !== 'string') return null;
  const cleanName = path.basename(filename);
  const resolved = path.resolve(baseDir, cleanName);
  if (!resolved.startsWith(baseDir + path.sep)) return null;
  return resolved;
}

function safeUnlink(baseDir: string, filename: string | null | undefined): void {
  if (!filename) return;
  const resolved = safeResolveInDir(baseDir, filename);
  if (resolved && fs.existsSync(resolved)) {
    try {
      fs.unlinkSync(resolved);
    } catch {
      // Ignore cleanup errors
    }
  }
}

function sanitizeDownloadFilename(name: string): string {
  const base = path.basename(name).replace(/["\r\n\\/;]/g, '_').trim();
  return base || 'bedrock-mod.mcaddon';
}

function writeOwnershipMeta(key: string, meta: FileOwnershipMeta): void {
  const metaPath = safeResolveInDir(META_DIR, `${path.basename(key)}.json`);
  if (!metaPath) return;
  fs.writeFileSync(metaPath, JSON.stringify(meta));
}

function readOwnershipMeta(key: string): FileOwnershipMeta | null {
  const metaPath = safeResolveInDir(META_DIR, `${path.basename(key)}.json`);
  if (!metaPath || !fs.existsSync(metaPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(metaPath, 'utf8')) as FileOwnershipMeta;
  } catch {
    return null;
  }
}

function deleteOwnershipMeta(key: string): void {
  safeUnlink(META_DIR, `${path.basename(key)}.json`);
}

async function requireFirebaseAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.firebaseUser = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired sign-in session. Please sign in again.' });
  }
}

const uploadStorage = multer.diskStorage({
  destination: (_req, file, cb) => {
    if (file.fieldname === 'modFile') {
      cb(null, MODS_DIR);
    } else {
      cb(null, IMAGES_DIR);
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const uploadMiddleware = multer({
  storage: uploadStorage,
  limits: {
    fileSize: MAX_MOD_FILE_BYTES,
    files: 2,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.fieldname === 'modFile') {
      if (ext === '.jar') {
        cb(
          new Error(
            'Java Edition .jar mods are not supported. DOG MODS only allows Minecraft Bedrock files (.mcaddon, .mcpack, .mcworld, .zip).'
          )
        );
        return;
      }
      if (!ALLOWED_MOD_EXTENSIONS.has(ext)) {
        cb(
          new Error(
            `Unsupported mod file format "${ext || 'unknown'}". Allowed Minecraft Bedrock formats: .mcaddon, .mcpack, .mcworld, .zip.`
          )
        );
        return;
      }
      cb(null, true);
      return;
    }

    if (file.fieldname === 'modImage' || file.fieldname === 'avatarImage') {
      if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
        cb(new Error('Unsupported image format. Please upload a .png, .jpg, .jpeg, or .webp image.'));
        return;
      }
      cb(null, true);
      return;
    }

    cb(new Error('Unexpected upload field.'));
  },
});

function cleanupUploadedFiles(req: Request): void {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  if (files) {
    for (const field of Object.keys(files)) {
      for (const f of files[field] || []) {
        const dir = field === 'modFile' ? MODS_DIR : IMAGES_DIR;
        safeUnlink(dir, f.filename);
      }
    }
  }
  if (req.file) {
    const dir = req.file.fieldname === 'modFile' ? MODS_DIR : IMAGES_DIR;
    safeUnlink(dir, req.file.filename);
  }
}

async function startServer(): Promise<void> {
  const app = express();
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });
  app.use(express.json({ limit: '1mb' }));

  // Upload mod package + cover image (or either during edit)
  app.post(
    '/api/upload',
    requireFirebaseAuth,
    uploadMiddleware.fields([
      { name: 'modFile', maxCount: 1 },
      { name: 'modImage', maxCount: 1 },
    ]),
    (req: AuthedRequest, res) => {
      try {
        const files = req.files as Record<string, Express.Multer.File[]> | undefined;
        const modFile = files?.modFile?.[0];
        const modImage = files?.modImage?.[0];

        if (!modFile && !modImage) {
          res.status(400).json({ error: 'No mod file or image was uploaded.' });
          return;
        }
        if (modImage && modImage.size > MAX_IMAGE_FILE_BYTES) {
          cleanupUploadedFiles(req);
          res.status(400).json({ error: 'Cover image must be 5 MB or smaller.' });
          return;
        }

        const ownerUid = req.firebaseUser!.uid;
        const result: Record<string, string | number> = {};

        if (modFile) {
          const safeOriginal = sanitizeDownloadFilename(modFile.originalname);
          const ext = path.extname(modFile.originalname).toLowerCase();
          writeOwnershipMeta(modFile.filename, {
            ownerUid,
            fileStorageName: modFile.filename,
            fileOriginalName: safeOriginal,
          });
          result.fileStorageName = modFile.filename;
          result.fileOriginalName = safeOriginal;
          result.fileSize = modFile.size;
          result.fileFormat = ext;
          result.fileUrl = `/api/files/mods/${encodeURIComponent(modFile.filename)}?name=${encodeURIComponent(safeOriginal)}`;
        }

        if (modImage) {
          writeOwnershipMeta(modImage.filename, {
            ownerUid,
            imageFilename: modImage.filename,
          });
          result.imageFilename = modImage.filename;
          result.imageUrl = `/api/files/images/${encodeURIComponent(modImage.filename)}`;
        }

        res.status(201).json(result);
      } catch (err) {
        cleanupUploadedFiles(req);
        res.status(500).json({ error: err instanceof Error ? err.message : 'File upload failed.' });
      }
    }
  );

  // Upload user avatar image
  app.post(
    '/api/upload/avatar',
    requireFirebaseAuth,
    uploadMiddleware.single('avatarImage'),
    (req: AuthedRequest, res) => {
      try {
        if (!req.file) {
          res.status(400).json({ error: 'Please select an avatar image.' });
          return;
        }
        if (req.file.size > MAX_IMAGE_FILE_BYTES) {
          cleanupUploadedFiles(req);
          res.status(400).json({ error: 'Avatar image must be 5 MB or smaller.' });
          return;
        }
        writeOwnershipMeta(req.file.filename, {
          ownerUid: req.firebaseUser!.uid,
          imageFilename: req.file.filename,
        });
        res.status(201).json({
          imageFilename: req.file.filename,
          imageUrl: `/api/files/images/${encodeURIComponent(req.file.filename)}`,
        });
      } catch (err) {
        cleanupUploadedFiles(req);
        res.status(500).json({ error: err instanceof Error ? err.message : 'Avatar upload failed.' });
      }
    }
  );

  // Download stored mod file
  app.get('/api/files/mods/:storageName', (req, res) => {
    const resolved = safeResolveInDir(MODS_DIR, req.params.storageName);
    if (!resolved || !fs.existsSync(resolved)) {
      res.status(404).json({ error: 'Mod file not found in storage.' });
      return;
    }

    const meta = readOwnershipMeta(req.params.storageName);
    const requestedName = typeof req.query.name === 'string' ? req.query.name : '';
    const safeName = sanitizeDownloadFilename(
      requestedName || meta?.fileOriginalName || req.params.storageName
    );
    const stat = fs.statSync(resolved);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', String(stat.size));
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    fs.createReadStream(resolved).pipe(res);
  });

  // Serve stored cover/avatar image
  app.get('/api/files/images/:filename', (req, res) => {
    const resolved = safeResolveInDir(IMAGES_DIR, req.params.filename);
    if (!resolved || !fs.existsSync(resolved)) {
      res.status(404).json({ error: 'Image not found.' });
      return;
    }
    const ext = path.extname(resolved).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
    };
    res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    fs.createReadStream(resolved).pipe(res);
  });

  // Delete stored mod file / image when mod is deleted or replaced
  app.post('/api/files/delete', requireFirebaseAuth, (req: AuthedRequest, res) => {
    const { fileStorageName, imageFilename } = req.body ?? {};
    const caller = req.firebaseUser!;
    const isBootstrapAdmin =
      caller.email === BOOTSTRAP_ADMIN_EMAIL && caller.email_verified === true;

    const canDeleteKey = (key: string): boolean => {
      if (isBootstrapAdmin) return true;
      const meta = readOwnershipMeta(key);
      return Boolean(meta && meta.ownerUid === caller.uid);
    };

    if (typeof fileStorageName === 'string' && fileStorageName.trim()) {
      const cleanMod = path.basename(fileStorageName.trim());
      if (canDeleteKey(cleanMod)) {
        safeUnlink(MODS_DIR, cleanMod);
        deleteOwnershipMeta(cleanMod);
      }
    }

    if (typeof imageFilename === 'string' && imageFilename.trim()) {
      const cleanImg = path.basename(imageFilename.trim());
      if (canDeleteKey(cleanImg)) {
        safeUnlink(IMAGES_DIR, cleanImg);
        deleteOwnershipMeta(cleanImg);
      }
    }

    res.json({ deleted: true });
  });

  // Upload & API error handler
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith('/api/')) {
      next(err);
      return;
    }
    cleanupUploadedFiles(req);
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ error: 'File exceeds the 50 MB maximum upload size limit.' });
        return;
      }
      res.status(400).json({ error: err.message });
      return;
    }
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Unexpected server error.' });
  });

  // --- VITE / STATIC FRONTEND ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DOG MODS server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start DOG MODS server:', err);
  process.exit(1);
});
