import * as fs from 'fs';
import * as path from 'path';
import { ProjectInsights } from './FileAnalyzer';
import { logger } from '../utils/logger';

export interface ProjectContext extends ProjectInsights {
  summary: string;
  generatedAt: string;
}

const DATA_DIR = '.company-os';

export class ContextBuilder {
  private projectPath: string;
  private dataDir: string;

  constructor(projectPath: string, _anthropicApiKey?: string) { // kept param for signature compatibility
    this.projectPath = projectPath;
    this.dataDir = path.join(projectPath, DATA_DIR);
    this.ensureDataDir();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    const memoriesDir = path.join(this.dataDir, 'memories');
    if (!fs.existsSync(memoriesDir)) {
      fs.mkdirSync(memoriesDir, { recursive: true });
    }
    const meetingsDir = path.join(this.dataDir, 'meetings');
    if (!fs.existsSync(meetingsDir)) {
      fs.mkdirSync(meetingsDir, { recursive: true });
    }

    // Add .company-os to .gitignore of host project
    this.updateGitignore();
  }

  private updateGitignore(): void {
    const gitignorePath = path.join(this.projectPath, '.gitignore');
    const entry = '\n# Company-OS\n.company-os/\n';
    if (fs.existsSync(gitignorePath)) {
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      if (!content.includes('.company-os')) {
        fs.appendFileSync(gitignorePath, entry);
      }
    } else {
      fs.writeFileSync(gitignorePath, entry.trim());
    }
  }

  async build(insights: ProjectInsights): Promise<ProjectContext> {
    logger.info('Building project context...');

    const summary = this.buildFallbackSummary(insights);

    const context: ProjectContext = {
      ...insights,
      summary,
      generatedAt: new Date().toISOString(),
    };

    this.save(context);
    logger.info('Context saved to .company-os/context.json');

    return context;
  }

  private buildFallbackSummary(insights: ProjectInsights): string {
    return `${insights.projectName} is a ${insights.projectType} project written primarily in ${insights.mainLanguage}. ` +
      `It has ${insights.fileCount} files with approximately ${insights.linesOfCode} lines of code. ` +
      `Frameworks used: ${insights.frameworks.join(', ') || 'none detected'}. ` +
      `${insights.hasTests ? 'Has automated tests.' : 'No tests detected.'} ` +
      `${insights.hasCI ? 'CI/CD configured.' : 'No CI/CD detected.'} ` +
      `${insights.securityFlags.length > 0 ? `Security concerns: ${insights.securityFlags.join('; ')}.` : 'No security issues detected.'}`;
  }

  save(context: ProjectContext): void {
    const contextPath = path.join(this.dataDir, 'context.json');
    fs.writeFileSync(contextPath, JSON.stringify(context, null, 2));
  }

  load(): ProjectContext | null {
    const contextPath = path.join(this.dataDir, 'context.json');
    if (!fs.existsSync(contextPath)) return null;
    try {
      return JSON.parse(fs.readFileSync(contextPath, 'utf-8')) as ProjectContext;
    } catch {
      return null;
    }
  }

  getDataDir(): string {
    return this.dataDir;
  }
}
