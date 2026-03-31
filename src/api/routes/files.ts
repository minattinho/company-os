import { Router, Request, Response } from 'express';
import multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { Server as SocketIOServer } from 'socket.io';
import { AgentOrchestrator } from '../../agents/AgentOrchestrator';
import { logger } from '../../utils/logger';

export type FileCategory = 'logo' | 'font' | 'color-palette' | 'guideline' | 'document' | 'other';

export interface FileRecord {
  id: string;
  filename: string;
  storedName: string;
  mimeType: string;
  size: number;
  category: FileCategory;
  teamId: string;
  teamName: string;
  uploadedBy: string;
  uploadedAt: string;
}

const ALLOWED_CATEGORIES: FileCategory[] = ['logo', 'font', 'color-palette', 'guideline', 'document', 'other'];

const ALLOWED_MIME_PREFIXES = ['image/', 'font/', 'application/font-', 'application/x-font-'];
const ALLOWED_MIME_EXACT = new Set([
  'application/pdf',
  'text/plain',
  'application/json',
  'image/svg+xml',
]);

function isMimeAllowed(mime: string): boolean {
  if (ALLOWED_MIME_EXACT.has(mime)) return true;
  return ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix));
}

function sanitizeFilename(name: string): string {
  return path.basename(name)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_');
}

export function filesRouter(
  dataDir: string,
  io: SocketIOServer,
  orchestrator: AgentOrchestrator
): Router {
  const router = Router();
  const filesJsonPath = path.join(dataDir, 'files.json');
  const filesStorageDir = path.join(dataDir, 'files');

  const upload = multer({
    dest: os.tmpdir(),
    limits: { fileSize: 25 * 1024 * 1024 },
  });

  function loadFileRecords(): FileRecord[] {
    if (!fs.existsSync(filesJsonPath)) return [];
    try {
      return JSON.parse(fs.readFileSync(filesJsonPath, 'utf-8')) as FileRecord[];
    } catch {
      return [];
    }
  }

  function saveFileRecords(records: FileRecord[]): void {
    fs.writeFileSync(filesJsonPath, JSON.stringify(records, null, 2), 'utf-8');
  }

  // GET /api/files
  router.get('/', (_req: Request, res: Response) => {
    const { teamId, category } = _req.query as { teamId?: string; category?: string };
    let records = loadFileRecords();
    if (teamId) records = records.filter((r) => r.teamId === teamId);
    if (category) records = records.filter((r) => r.category === category);
    res.json({ files: records });
  });

  // GET /api/files/:id/download
  router.get('/:id/download', (req: Request, res: Response) => {
    const records = loadFileRecords();
    const record = records.find((r) => r.id === req.params['id']);
    if (!record) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    const absolutePath = path.join(filesStorageDir, record.teamId, record.storedName);
    if (!fs.existsSync(absolutePath)) {
      res.status(404).json({ error: 'File missing from disk' });
      return;
    }
    res.download(absolutePath, record.filename, (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ error: 'Download failed' });
      }
    });
  });

  // POST /api/files/upload
  router.post('/upload', upload.single('file'), (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    const { teamId, category, uploadedBy } = req.body as {
      teamId?: string;
      category?: string;
      uploadedBy?: string;
    };

    if (!teamId) {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: 'teamId is required' });
      return;
    }

    const teams = orchestrator.getAllTeams();
    const team = teams.find((t) => t.id === teamId);
    if (!team) {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: `Team "${teamId}" not found` });
      return;
    }

    if (!category || !ALLOWED_CATEGORIES.includes(category as FileCategory)) {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: `Invalid category. Must be one of: ${ALLOWED_CATEGORIES.join(', ')}` });
      return;
    }

    const mime = file.mimetype;
    if (!isMimeAllowed(mime)) {
      fs.unlinkSync(file.path);
      res.status(415).json({ error: `File type "${mime}" is not allowed` });
      return;
    }

    const sanitized = sanitizeFilename(file.originalname);
    const id = uuidv4();
    const storedName = `${id}_${sanitized}`;
    const teamDir = path.join(filesStorageDir, teamId);
    fs.mkdirSync(teamDir, { recursive: true });
    const finalPath = path.join(teamDir, storedName);

    try {
      fs.renameSync(file.path, finalPath);
    } catch (err: unknown) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === 'EXDEV') {
        fs.copyFileSync(file.path, finalPath);
        fs.unlinkSync(file.path);
      } else {
        throw err;
      }
    }

    const record: FileRecord = {
      id,
      filename: sanitized,
      storedName,
      mimeType: mime,
      size: file.size,
      category: category as FileCategory,
      teamId,
      teamName: team.name,
      uploadedBy: uploadedBy ?? 'Manual Upload',
      uploadedAt: new Date().toISOString(),
    };

    const records = loadFileRecords();
    records.push(record);
    saveFileRecords(records);

    io.emit('file:uploaded', record);
    logger.info(`File uploaded: ${sanitized} (${team.name}, ${category})`);

    res.status(201).json({ success: true, file: record });
  });

  // DELETE /api/files/:id
  router.delete('/:id', (req: Request, res: Response) => {
    const records = loadFileRecords();
    const idx = records.findIndex((r) => r.id === req.params['id']);
    if (idx === -1) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const record = records[idx];
    const absolutePath = path.join(filesStorageDir, record.teamId, record.storedName);

    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    } else {
      logger.warn(`Physical file missing for record ${record.id}: ${absolutePath}`);
    }

    records.splice(idx, 1);
    saveFileRecords(records);

    io.emit('file:deleted', { id: record.id });
    logger.info(`File deleted: ${record.filename}`);

    res.json({ success: true });
  });

  // Multer error handler
  router.use((err: unknown, _req: Request, res: Response, next: (err?: unknown) => void) => {
    if (err && typeof err === 'object' && 'code' in err) {
      const multerErr = err as { code: string; message: string };
      if (multerErr.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ error: 'File too large. Maximum size is 25 MB.' });
        return;
      }
    }
    next(err);
  });

  return router;
}
