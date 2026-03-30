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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileAnalyzer = void 0;
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const logger_1 = require("../utils/logger");
class FileAnalyzer {
    projectPath;
    constructor(projectPath) {
        this.projectPath = projectPath;
    }
    analyze(files) {
        logger_1.logger.debug('Analyzing project files...');
        const packageJson = this.readPackageJson(files);
        const readme = this.extractReadme(files);
        const linesOfCode = this.countLinesOfCode(files);
        const mainLanguage = this.detectMainLanguage(files);
        const frameworks = this.detectFrameworks(files, packageJson);
        const projectType = this.detectProjectType(files, packageJson, frameworks);
        const dependencies = this.extractDependencies(packageJson);
        const devDependencies = this.extractDevDependencies(packageJson);
        const hasTests = this.detectTests(files);
        const hasCI = this.detectCI(files);
        const hasDocs = this.detectDocs(files);
        const mainEntryPoints = this.detectEntryPoints(files, packageJson);
        const apiEndpoints = this.detectApiEndpoints(files);
        const envVarsUsed = this.detectEnvVars(files);
        const recentChanges = this.getRecentGitChanges();
        const codeComplexityScore = this.estimateComplexity(files, linesOfCode);
        const securityFlags = this.detectSecurityIssues(files);
        return {
            projectName: packageJson?.name ?? path.basename(this.projectPath),
            projectType,
            mainLanguage,
            frameworks,
            dependencies,
            devDependencies,
            fileCount: files.length,
            linesOfCode,
            hasTests,
            testCoverage: null,
            hasCI,
            hasDocs,
            readme: readme.substring(0, 2000),
            mainEntryPoints,
            apiEndpoints,
            envVarsUsed,
            recentChanges,
            codeComplexityScore,
            securityFlags,
            packageJson: packageJson,
        };
    }
    readPackageJson(files) {
        const pkgFile = files.find((f) => f.relativePath === 'package.json');
        if (!pkgFile?.content)
            return null;
        try {
            return JSON.parse(pkgFile.content);
        }
        catch {
            return null;
        }
    }
    extractReadme(files) {
        const readmeFile = files.find((f) => /^readme\.md$/i.test(f.relativePath));
        return readmeFile?.content ?? '';
    }
    countLinesOfCode(files) {
        const codeExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.py', '.rb', '.go', '.rs', '.java', '.kt', '.swift', '.css', '.scss']);
        return files
            .filter((f) => codeExtensions.has(f.extension))
            .reduce((sum, f) => sum + (f.lines ?? 0), 0);
    }
    detectMainLanguage(files) {
        const langCount = {};
        for (const file of files) {
            const langMap = {
                '.ts': 'TypeScript', '.tsx': 'TypeScript',
                '.js': 'JavaScript', '.jsx': 'JavaScript', '.mjs': 'JavaScript',
                '.py': 'Python', '.rb': 'Ruby', '.go': 'Go',
                '.rs': 'Rust', '.java': 'Java', '.kt': 'Kotlin',
                '.swift': 'Swift', '.php': 'PHP', '.cs': 'C#',
            };
            const lang = langMap[file.extension];
            if (lang)
                langCount[lang] = (langCount[lang] ?? 0) + (file.lines ?? 1);
        }
        if (Object.keys(langCount).length === 0)
            return 'Unknown';
        return Object.entries(langCount).sort((a, b) => b[1] - a[1])[0][0];
    }
    detectFrameworks(files, pkg) {
        const frameworks = [];
        const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
        const depNames = Object.keys(deps);
        const frameworkMap = {
            'react': 'React', 'react-dom': 'React',
            'next': 'Next.js', 'nuxt': 'Nuxt.js',
            'vue': 'Vue.js', 'angular': 'Angular',
            'svelte': 'Svelte', 'solid-js': 'SolidJS',
            'express': 'Express', 'fastify': 'Fastify',
            'koa': 'Koa', 'hapi': 'Hapi',
            'nestjs': 'NestJS', '@nestjs/core': 'NestJS',
            'django': 'Django', 'flask': 'Flask',
            'tailwindcss': 'Tailwind CSS',
            'prisma': 'Prisma', 'typeorm': 'TypeORM',
            'trpc': 'tRPC', '@trpc/server': 'tRPC',
            'graphql': 'GraphQL',
            'socket.io': 'Socket.io',
        };
        for (const dep of depNames) {
            const fw = frameworkMap[dep.toLowerCase()];
            if (fw && !frameworks.includes(fw))
                frameworks.push(fw);
        }
        return frameworks;
    }
    detectProjectType(files, pkg, frameworks) {
        if (frameworks.some((f) => ['React', 'Next.js', 'Vue.js', 'Angular', 'Svelte'].includes(f)))
            return 'webapp';
        if (frameworks.some((f) => ['Express', 'Fastify', 'Koa', 'NestJS'].includes(f)))
            return 'api';
        const deps = pkg?.dependencies ?? {};
        if (Object.keys(deps).length === 0 && files.some((f) => f.relativePath.includes('bin/')))
            return 'cli';
        if (pkg?.main?.includes('index') && !pkg?.scripts)
            return 'library';
        return 'unknown';
    }
    extractDependencies(pkg) {
        if (!pkg?.dependencies)
            return [];
        const paidPackages = new Set(['@anthropic-ai/sdk', 'openai', 'stripe', 'twilio', 'sendgrid', 'algolia']);
        return Object.entries(pkg.dependencies).map(([name, version]) => ({
            name,
            version,
            isPaid: paidPackages.has(name),
        }));
    }
    extractDevDependencies(pkg) {
        if (!pkg?.devDependencies)
            return [];
        return Object.entries(pkg.devDependencies).map(([name, version]) => ({ name, version }));
    }
    detectTests(files) {
        return files.some((f) => f.relativePath.includes('__tests__') ||
            f.relativePath.includes('.test.') ||
            f.relativePath.includes('.spec.') ||
            f.relativePath.includes('/test/') ||
            f.relativePath.includes('/tests/'));
    }
    detectCI(files) {
        return files.some((f) => f.relativePath.includes('.github/workflows') ||
            f.relativePath.includes('.gitlab-ci') ||
            f.relativePath.includes('Jenkinsfile') ||
            f.relativePath.includes('.circleci') ||
            f.relativePath.includes('.travis.yml'));
    }
    detectDocs(files) {
        return files.some((f) => f.relativePath.toLowerCase().includes('readme') ||
            f.relativePath.includes('docs/') ||
            f.relativePath.includes('documentation/'));
    }
    detectEntryPoints(files, pkg) {
        const entries = [];
        if (pkg?.main)
            entries.push(pkg.main);
        if (pkg?.bin) {
            const bin = pkg.bin;
            entries.push(...Object.values(bin));
        }
        const commonEntries = ['src/index.ts', 'src/index.js', 'index.ts', 'index.js', 'src/main.ts', 'src/app.ts'];
        for (const entry of commonEntries) {
            if (files.some((f) => f.relativePath === entry) && !entries.includes(entry)) {
                entries.push(entry);
            }
        }
        return entries.slice(0, 5);
    }
    detectApiEndpoints(files) {
        const endpoints = [];
        const routeRegex = /(?:app|router)\.(get|post|put|patch|delete|use)\s*\(\s*['"`]([^'"`]+)['"`]/gi;
        for (const file of files) {
            if (!file.content)
                continue;
            let match;
            while ((match = routeRegex.exec(file.content)) !== null) {
                const endpoint = `${match[1].toUpperCase()} ${match[2]}`;
                if (!endpoints.includes(endpoint))
                    endpoints.push(endpoint);
            }
        }
        return endpoints.slice(0, 20);
    }
    detectEnvVars(files) {
        const envVars = new Set();
        const envRegex = /process\.env\.([A-Z_][A-Z0-9_]*)/g;
        for (const file of files) {
            if (!file.content)
                continue;
            let match;
            while ((match = envRegex.exec(file.content)) !== null) {
                envVars.add(match[1]);
            }
        }
        // Also read .env.example
        const envExampleFile = files.find((f) => f.relativePath === '.env.example');
        if (envExampleFile?.content) {
            for (const line of envExampleFile.content.split('\n')) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    const key = trimmed.split('=')[0].trim();
                    if (key)
                        envVars.add(key);
                }
            }
        }
        return Array.from(envVars).slice(0, 30);
    }
    getRecentGitChanges() {
        try {
            return (0, child_process_1.execSync)('git log --oneline -20', {
                cwd: this.projectPath,
                encoding: 'utf-8',
                timeout: 5000,
                stdio: ['ignore', 'pipe', 'ignore'],
            }).trim();
        }
        catch {
            return 'No git history available';
        }
    }
    estimateComplexity(files, linesOfCode) {
        let score = 1;
        if (linesOfCode > 1000)
            score += 1;
        if (linesOfCode > 5000)
            score += 1;
        if (linesOfCode > 20000)
            score += 2;
        if (linesOfCode > 100000)
            score += 2;
        const hasComplexPatterns = files.some((f) => {
            if (!f.content)
                return false;
            return (f.content.includes('async') ||
                f.content.includes('Promise') ||
                f.content.includes('Observable'));
        });
        if (hasComplexPatterns)
            score += 1;
        const uniqueExtensions = new Set(files.map((f) => f.extension)).size;
        if (uniqueExtensions > 10)
            score += 1;
        return Math.min(10, score);
    }
    detectSecurityIssues(files) {
        const flags = [];
        for (const file of files) {
            if (!file.content)
                continue;
            // Check for hardcoded secrets
            const secretPatterns = [
                { pattern: /['"]sk-[a-zA-Z0-9]{32,}['"]/, label: 'Possible hardcoded OpenAI API key' },
                { pattern: /['"]sk-ant-[a-zA-Z0-9-]{32,}['"]/, label: 'Possible hardcoded Anthropic API key' },
                { pattern: /password\s*=\s*['"][^'"]{8,}['"]/, label: 'Possible hardcoded password' },
                { pattern: /AWS_SECRET_ACCESS_KEY\s*=\s*['"][^'"]+['"]/, label: 'Possible hardcoded AWS secret' },
            ];
            for (const { pattern, label } of secretPatterns) {
                if (pattern.test(file.content)) {
                    flags.push(`${label} in ${file.relativePath}`);
                }
            }
            // Check for eval usage
            if (/\beval\s*\(/.test(file.content) && !file.relativePath.includes('test')) {
                flags.push(`eval() usage detected in ${file.relativePath}`);
            }
        }
        return flags.slice(0, 10);
    }
}
exports.FileAnalyzer = FileAnalyzer;
//# sourceMappingURL=FileAnalyzer.js.map