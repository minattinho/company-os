import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import ignore from 'ignore';
import { EventEmitter } from 'events';
import chokidar from 'chokidar';
import { logger } from '../utils/logger';

export interface ScanResult {
  files: ScannedFile[];
  totalFiles: number;
  totalSize: number;
  scannedAt: string;
}

export interface ScannedFile {
  relativePath: string;
  absolutePath: string;
  extension: string;
  size: number;
  content?: string;
  lines?: number;
}

export class ProjectScanner extends EventEmitter {
  private projectPath: string;
  private ignorePatterns: string[];
  private ig: ReturnType<typeof ignore>;
  private watcher?: chokidar.FSWatcher;

  constructor(projectPath: string, ignorePatterns: string[] = []) {
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
    this.ig = ignore();
    this.loadGitignore();
    this.ig.add(this.ignorePatterns);
  }

  private loadGitignore(): void {
    const gitignorePath = path.join(this.projectPath, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      this.ig.add(content);
      logger.debug('Loaded .gitignore rules');
    }
  }

  async scan(): Promise<ScanResult> {
    logger.info(`Scanning project at: ${this.projectPath}`);
    const startTime = Date.now();

    const allFiles = await glob('**/*', {
      cwd: this.projectPath,
      nodir: true,
      dot: true,
      absolute: false,
    });

    const filteredFiles = allFiles.filter((f) => {
      try {
        return !this.ig.ignores(f);
      } catch {
        return false;
      }
    });

    const scannedFiles: ScannedFile[] = [];
    let totalSize = 0;

    for (const relativePath of filteredFiles) {
      const absolutePath = path.join(this.projectPath, relativePath);
      try {
        const stat = fs.statSync(absolutePath);
        if (!stat.isFile()) continue;

        const ext = path.extname(relativePath).toLowerCase();
        const size = stat.size;
        totalSize += size;

        const file: ScannedFile = {
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
          } catch {
            // binary or unreadable
          }
        }

        scannedFiles.push(file);
      } catch {
        // skip inaccessible files
      }
    }

    const elapsed = Date.now() - startTime;
    logger.info(`Scan complete: ${scannedFiles.length} files in ${elapsed}ms`);

    return {
      files: scannedFiles,
      totalFiles: scannedFiles.length,
      totalSize,
      scannedAt: new Date().toISOString(),
    };
  }

  private isTextFile(ext: string): boolean {
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
    if (textExtensions.has(ext)) return true;
    // files without extension (Dockerfile, Makefile, etc.)
    return ext === '';
  }

  startWatching(callback: () => void, debounceMs = 3000): void {
    if (this.watcher) {
      this.watcher.close();
    }

    let debounceTimer: NodeJS.Timeout | null = null;

    this.watcher = chokidar.watch(this.projectPath, {
      ignored: (filePath: string) => {
        const rel = path.relative(this.projectPath, filePath);
        if (!rel) return false;
        try {
          return this.ig.ignores(rel);
        } catch {
          return false;
        }
      },
      persistent: true,
      ignoreInitial: true,
    });

    const trigger = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        logger.info('File changes detected, triggering re-scan...');
        this.emit('change');
        callback();
      }, debounceMs);
    };

    this.watcher.on('add', trigger);
    this.watcher.on('change', trigger);
    this.watcher.on('unlink', trigger);

    logger.info('File watcher started');
  }

  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = undefined;
      logger.info('File watcher stopped');
    }
  }
}
