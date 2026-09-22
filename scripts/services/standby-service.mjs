/**
 * ReelOS Thoughtful Living Room Standby Ambiance Service
 * Sovereign End-to-End Neural Cinema Suite
 *
 * Implements:
 * 1. Campfire Mode (The Hearth): Warm fireplace loop with normalized ambient wood crackle audio
 * 2. The Living Gallery: Curated high-resolution museum fine art and classic film stills
 * 3. Sovereign Family Photo Wall: 100% private, local-first photo frame (.reelos-state/photos/)
 * 4. Local photo upload from companion devices
 */

import fs from 'node:fs';
import path from 'node:path';

const STATE_DIR = process.env.REELOS_STATE || (
  process.platform === 'win32'
    ? path.join(process.cwd(), '.reelos-state')
    : '/var/lib/reelos'
);

const PHOTOS_DIR = path.join(STATE_DIR, 'photos');

function ensurePhotosDir() {
  try {
    if (!fs.existsSync(PHOTOS_DIR)) {
      fs.mkdirSync(PHOTOS_DIR, { recursive: true });
    }
  } catch {}
}

ensurePhotosDir();

export const CURATED_GALLERY_ARTWORKS = [
  {
    id: 'art_1',
    title: 'The Starry Night',
    artist: 'Vincent van Gogh (1889)',
    url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1920&q=80',
    description: 'Post-impressionist masterwork capturing turbulent nocturnal resonance.',
  },
  {
    id: 'art_2',
    title: 'Wanderer above the Sea of Fog',
    artist: 'Caspar David Friedrich (1818)',
    url: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=1920&q=80',
    description: 'Romantic sublime solitude overlooking mist-veiled mountain peaks.',
  },
  {
    id: 'art_3',
    title: 'Cinematic Horizon in Ochre & Gold',
    artist: 'Criterion Archivist Selection',
    url: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1920&q=80',
    description: 'Minimalist quiet seascape in velvet dawn light.',
  },
];

class StandbyService {
  constructor() {
    this.activeMode = 'campfire'; // 'campfire' | 'gallery' | 'photowall'
    this.idleMinutesThreshold = 3;
    this.isMuted = false;
  }

  getMode() {
    return this.activeMode;
  }

  setMode(mode) {
    if (['campfire', 'gallery', 'photowall'].includes(mode)) {
      this.activeMode = mode;
      return true;
    }
    return false;
  }

  listPhotos() {
    ensurePhotosDir();
    try {
      const files = fs.readdirSync(PHOTOS_DIR);
      return files
        .filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f))
        .map((f) => {
          const stat = fs.statSync(path.join(PHOTOS_DIR, f));
          return {
            filename: f,
            url: `/api/standby/photos/${encodeURIComponent(f)}`,
            uploadedAt: stat.mtimeMs,
            sizeBytes: stat.size,
          };
        })
        .sort((a, b) => b.uploadedAt - a.uploadedAt);
    } catch {
      return [];
    }
  }

  savePhotoBase64(filename, base64Data, uploader = 'Family Member') {
    ensurePhotosDir();
    const cleanExt = path.extname(filename).toLowerCase() || '.jpg';
    const safeName = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}${cleanExt}`;
    const filePath = path.join(PHOTOS_DIR, safeName);
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);
    return {
      filename: safeName,
      url: `/api/standby/photos/${encodeURIComponent(safeName)}`,
      sizeBytes: buffer.length,
      uploader,
      uploadedAt: Date.now(),
    };
  }

  deletePhoto(filename) {
    ensurePhotosDir();
    const safeName = path.basename(filename);
    const filePath = path.join(PHOTOS_DIR, safeName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }
}

export const standbyService = new StandbyService();

// Route Handlers

export async function handleStandbyRoute(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  const p = url.pathname;
  const method = (req.method || 'GET').toUpperCase();

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // GET /api/standby/status
  if (p === '/api/standby/status') {
    const photos = standbyService.listPhotos();
    res.statusCode = 200;
    return res.end(JSON.stringify({
      ok: true,
      activeMode: standbyService.getMode(),
      idleMinutesThreshold: standbyService.idleMinutesThreshold,
      photosCount: photos.length,
      curatedArtworks: CURATED_GALLERY_ARTWORKS,
    }));
  }

  // POST /api/standby/mode
  if (p === '/api/standby/mode' && method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    let data = {};
    try { data = JSON.parse(body || '{}'); } catch {}
    const success = standbyService.setMode(data.mode);
    res.statusCode = success ? 200 : 400;
    return res.end(JSON.stringify({ ok: success, activeMode: standbyService.getMode() }));
  }

  // GET /api/standby/photos
  if (p === '/api/standby/photos') {
    const photos = standbyService.listPhotos();
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, photos }));
  }

  // POST /api/standby/upload
  if (p === '/api/standby/upload' && method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    let data = {};
    try { data = JSON.parse(body || '{}'); } catch {}
    if (!data.base64) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ ok: false, error: 'Missing base64 photo data' }));
    }
    const result = standbyService.savePhotoBase64(data.filename || 'photo.jpg', data.base64, data.uploader);
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, photo: result }));
  }

  // GET /api/standby/photos/:filename
  if (p.startsWith('/api/standby/photos/')) {
    const filename = path.basename(p.replace('/api/standby/photos/', ''));
    const filePath = path.join(PHOTOS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      return res.end('Photo not found');
    }
    const ext = path.extname(filename).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    res.statusCode = 200;
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return fs.createReadStream(filePath).pipe(res);
  }

  res.statusCode = 404;
  return res.end(JSON.stringify({ ok: false, error: 'Not found' }));
}
