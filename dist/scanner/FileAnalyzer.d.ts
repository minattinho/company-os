import { ScannedFile } from './ProjectScanner';
export interface ProjectInsights {
    projectName: string;
    projectType: 'webapp' | 'api' | 'library' | 'cli' | 'mobile' | 'unknown';
    mainLanguage: string;
    frameworks: string[];
    dependencies: {
        name: string;
        version: string;
        isPaid: boolean;
    }[];
    devDependencies: {
        name: string;
        version: string;
    }[];
    fileCount: number;
    linesOfCode: number;
    hasTests: boolean;
    testCoverage: number | null;
    hasCI: boolean;
    hasDocs: boolean;
    readme: string;
    mainEntryPoints: string[];
    apiEndpoints: string[];
    envVarsUsed: string[];
    recentChanges: string;
    codeComplexityScore: number;
    securityFlags: string[];
    packageJson: Record<string, unknown> | null;
}
export declare class FileAnalyzer {
    private projectPath;
    constructor(projectPath: string);
    analyze(files: ScannedFile[]): ProjectInsights;
    private readPackageJson;
    private extractReadme;
    private countLinesOfCode;
    private detectMainLanguage;
    private detectFrameworks;
    private detectProjectType;
    private extractDependencies;
    private extractDevDependencies;
    private detectTests;
    private detectCI;
    private detectDocs;
    private detectEntryPoints;
    private detectApiEndpoints;
    private detectEnvVars;
    private getRecentGitChanges;
    private estimateComplexity;
    private detectSecurityIssues;
}
//# sourceMappingURL=FileAnalyzer.d.ts.map