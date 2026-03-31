"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.filesRouter = filesRouter;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const uuid_1 = require("uuid");
const logger_1 = require("../../utils/logger");
const ALLOWED_CATEGORIES = ['logo', 'font', 'color-palette', 'guideline', 'document', 'other'];
const ALLOWED_MIME_PREFIXES = ['image/', 'font/', 'application/font-', 'application/x-font-'];
const ALLOWED_MIME_EXACT = new Set([
    'application/pdf',
    'text/plain',
    'application/json',
    'image/svg+xml',
]);
function isMimeAllowed(mime) {
    if (ALLOWED_MIME_EXACT.has(mime))
        return true;
    return ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix));
}
function sanitizeFilename(name) {
    return path.basename(name)
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_{2,}/g, '_');
}
function filesRouter(dataDir, io, orchestrator) {
    const router = (0, express_1.Router)();
    const filesJsonPath = path.join(dataDir, 'files.json');
    const filesStorageDir = path.join(dataDir, 'files');
    const upload = (0, multer_1.default)({
        dest: os.tmpdir(),
        limits: { fileSize: 25 * 1024 * 1024 },
    });
    function loadFileRecords() {
        if (!fs.existsSync(filesJsonPath))
            return [];
        try {
            return JSON.parse(fs.readFileSync(filesJsonPath, 'utf-8'));
        }
        catch {
            return [];
        }
    }
    function saveFileRecords(records) {
        fs.writeFileSync(filesJsonPath, JSON.stringify(records, null, 2), 'utf-8');
    }
    // GET /api/files
    router.get('/', (_req, res) => {
        const { teamId, category } = _req.query;
        let records = loadFileRecords();
        if (teamId)
            records = records.filter((r) => r.teamId === teamId);
        if (category)
            records = records.filter((r) => r.category === category);
        res.json({ files: records });
    });
    // GET /api/files/:id/download
    router.get('/:id/download', (req, res) => {
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
    router.post('/upload', upload.single('file'), (req, res) => {
        const file = req.file;
        if (!file) {
            res.status(400).json({ error: 'No file provided' });
            return;
        }
        const { teamId, category, uploadedBy } = req.body;
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
        if (!category || !ALLOWED_CATEGORIES.includes(category)) {
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
        const id = (0, uuid_1.v4)();
        const storedName = `${id}_${sanitized}`;
        const teamDir = path.join(filesStorageDir, teamId);
        fs.mkdirSync(teamDir, { recursive: true });
        const finalPath = path.join(teamDir, storedName);
        try {
            fs.renameSync(file.path, finalPath);
        }
        catch (err) {
            const nodeErr = err;
            if (nodeErr.code === 'EXDEV') {
                fs.copyFileSync(file.path, finalPath);
                fs.unlinkSync(file.path);
            }
            else {
                throw err;
            }
        }
        const record = {
            id,
            filename: sanitized,
            storedName,
            mimeType: mime,
            size: file.size,
            category: category,
            teamId,
            teamName: team.name,
            uploadedBy: uploadedBy ?? 'Manual Upload',
            uploadedAt: new Date().toISOString(),
        };
        const records = loadFileRecords();
        records.push(record);
        saveFileRecords(records);
        io.emit('file:uploaded', record);
        logger_1.logger.info(`File uploaded: ${sanitized} (${team.name}, ${category})`);
        res.status(201).json({ success: true, file: record });
    });
    // DELETE /api/files/:id
    router.delete('/:id', (req, res) => {
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
        }
        else {
            logger_1.logger.warn(`Physical file missing for record ${record.id}: ${absolutePath}`);
        }
        records.splice(idx, 1);
        saveFileRecords(records);
        io.emit('file:deleted', { id: record.id });
        logger_1.logger.info(`File deleted: ${record.filename}`);
        res.json({ success: true });
    });
    // Multer error handler
    router.use((err, _req, res, next) => {
        if (err && typeof err === 'object' && 'code' in err) {
            const multerErr = err;
            if (multerErr.code === 'LIMIT_FILE_SIZE') {
                res.status(413).json({ error: 'File too large. Maximum size is 25 MB.' });
                return;
            }
        }
        next(err);
    });
    return router;
}
//# sourceMappingURL=files.js.map