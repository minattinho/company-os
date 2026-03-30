import { ProjectInsights } from './FileAnalyzer';
export interface ProjectContext extends ProjectInsights {
    summary: string;
    generatedAt: string;
}
export declare class ContextBuilder {
    private projectPath;
    private dataDir;
    constructor(projectPath: string, _anthropicApiKey?: string);
    private ensureDataDir;
    private updateGitignore;
    build(insights: ProjectInsights): Promise<ProjectContext>;
    private buildFallbackSummary;
    save(context: ProjectContext): void;
    load(): ProjectContext | null;
    getDataDir(): string;
}
//# sourceMappingURL=ContextBuilder.d.ts.map