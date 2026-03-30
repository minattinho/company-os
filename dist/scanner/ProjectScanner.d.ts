import { EventEmitter } from 'events';
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
export declare class ProjectScanner extends EventEmitter {
    private projectPath;
    private ignorePatterns;
    private ig;
    private watcher?;
    constructor(projectPath: string, ignorePatterns?: string[]);
    private loadGitignore;
    scan(): Promise<ScanResult>;
    private isTextFile;
    startWatching(callback: () => void, debounceMs?: number): void;
    stopWatching(): void;
}
//# sourceMappingURL=ProjectScanner.d.ts.map