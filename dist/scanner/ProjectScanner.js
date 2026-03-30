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
exports.ProjectScanner = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const glob_1 = require("glob");
const ignore_1 = __importDefault(require("ignore"));
const events_1 = require("events");
const chokidar_1 = __importDefault(require("chokidar"));
const logger_1 = require("../utils/logger");
class ProjectScanner extends events_1.EventEmitter {
    projectPath;
    ignorePatterns;
    ig;
    watcher;
    constructor(projectPath, ignorePatterns = []) {
        super();
        this.projectPath = projectPath;
        this.ignorePatterns = [
            'node_modules',
            '.git',
            'dist',
            'build',
            '.company-os',
            'coverage',
            '*.min.js',
            '*.min.css',
            '*.map',
            '*.lock',
            'package-lock.json',
            'yarn.lock',
            'pnpm-lock.yaml',
            ...ignorePatterns,
        ];
        this.ig = (0, ignore_1.default)();
        this.loadGitignore();
        this.ig.add(this.ignorePatterns);
    }
    loadGitignore() {
        const gitignorePath = path.join(this.projectPath, '.gitignore');
        if (fs.existsSync(gitignorePath)) {
            const content = fs.readFileSync(gitignorePath, 'utf-8');
            this.ig.add(content);
            logger_1.logger.debug('Loaded .gitignore rules');
        }
    }
    async scan() {
        logger_1.logger.info(`Scanning project at: ${this.projectPath}`);
        const startTime = Date.now();
        const allFiles = await (0, glob_1.glob)('**/*', {
            cwd: this.projectPath,
            nodir: true,
            dot: true,
            absolute: false,
        });
        const filteredFiles = allFiles.filter((f) => {
            try {
                return !this.ig.ignores(f);
            }
            catch {
                return false;
            }
        });
        const scannedFiles = [];
        let totalSize = 0;
        for (const relativePath of filteredFiles) {
            const absolutePath = path.join(this.projectPath, relativePath);
            try {
                const stat = fs.statSync(absolutePath);
                if (!stat.isFile())
                    continue;
                const ext = path.extname(relativePath).toLowerCase();
                const size = stat.size;
                totalSize += size;
                const file = {
                    relativePath,
                    absolutePath,
                    extension: ext,
                    size,
                };
                // Read text files under 100KB
                if (this.isTextFile(ext) && size < 100 * 1024) {
                    try {
                        const content = fs.readFileSync(absolutePath, 'utf-8');
                        file.content = content;
                        file.lines = content.split('\n').length;
                    }
                    catch {
                        // binary or unreadable
                    }
                }
                scannedFiles.push(file);
            }
            catch {
                // skip inaccessible files
            }
        }
        const elapsed = Date.now() - startTime;
        logger_1.logger.info(`Scan complete: ${scannedFiles.length} files in ${elapsed}ms`);
        return {
            files: scannedFiles,
            totalFiles: scannedFiles.length,
            totalSize,
            scannedAt: new Date().toISOString(),
        };
    }
    isTextFile(ext) {
        const textExtensions = new Set([
            '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
            '.json', '.yaml', '.yml', '.toml', '.env',
            '.md', '.mdx', '.txt', '.rst',
            '.html', '.htm', '.css', '.scss', '.sass', '.less',
            '.py', '.rb', '.go', '.rs', '.java', '.kt', '.swift',
            '.sh', '.bash', '.zsh', '.fish',
            '.sql', '.graphql', '.gql',
            '.xml', '.svg',
            '.dockerfile', '.gitignore', '.eslintrc', '.prettierrc',
            '.editorconfig', '.nvmrc',
        ]);
        if (textExtensions.has(ext))
            return true;
        // files without extension (Dockerfile, Makefile, etc.)
        return ext === '';
    }
    startWatching(callback, debounceMs = 3000) {
        if (this.watcher) {
            this.watcher.close();
        }
        let debounceTimer = null;
        this.watcher = chokidar_1.default.watch(this.projectPath, {
            ignored: (filePath) => {
                const rel = path.relative(this.projectPath, filePath);
                if (!rel)
                    return false;
                try {
                    return this.ig.ignores(rel);
                }
                catch {
                    return false;
                }
            },
            persistent: true,
            ignoreInitial: true,
        });
        const trigger = () => {
            if (debounceTimer)
                clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                logger_1.logger.info('File changes detected, triggering re-scan...');
                this.emit('change');
                callback();
            }, debounceMs);
        };
        this.watcher.on('add', trigger);
        this.watcher.on('change', trigger);
        this.watcher.on('unlink', trigger);
        logger_1.logger.info('File watcher started');
    }
    stopWatching() {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = undefined;
            logger_1.logger.info('File watcher stopped');
        }
    }
}
exports.ProjectScanner = ProjectScanner;
//# sourceMappingURL=ProjectScanner.js.map