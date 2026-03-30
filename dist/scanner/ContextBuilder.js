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
exports.ContextBuilder = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger_1 = require("../utils/logger");
const DATA_DIR = '.company-os';
class ContextBuilder {
    projectPath;
    dataDir;
    constructor(projectPath, _anthropicApiKey) {
        this.projectPath = projectPath;
        this.dataDir = path.join(projectPath, DATA_DIR);
        this.ensureDataDir();
    }
    ensureDataDir() {
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
    updateGitignore() {
        const gitignorePath = path.join(this.projectPath, '.gitignore');
        const entry = '\n# Company-OS\n.company-os/\n';
        if (fs.existsSync(gitignorePath)) {
            const content = fs.readFileSync(gitignorePath, 'utf-8');
            if (!content.includes('.company-os')) {
                fs.appendFileSync(gitignorePath, entry);
            }
        }
        else {
            fs.writeFileSync(gitignorePath, entry.trim());
        }
    }
    async build(insights) {
        logger_1.logger.info('Building project context...');
        const summary = this.buildFallbackSummary(insights);
        const context = {
            ...insights,
            summary,
            generatedAt: new Date().toISOString(),
        };
        this.save(context);
        logger_1.logger.info('Context saved to .company-os/context.json');
        return context;
    }
    buildFallbackSummary(insights) {
        return `${insights.projectName} is a ${insights.projectType} project written primarily in ${insights.mainLanguage}. ` +
            `It has ${insights.fileCount} files with approximately ${insights.linesOfCode} lines of code. ` +
            `Frameworks used: ${insights.frameworks.join(', ') || 'none detected'}. ` +
            `${insights.hasTests ? 'Has automated tests.' : 'No tests detected.'} ` +
            `${insights.hasCI ? 'CI/CD configured.' : 'No CI/CD detected.'} ` +
            `${insights.securityFlags.length > 0 ? `Security concerns: ${insights.securityFlags.join('; ')}.` : 'No security issues detected.'}`;
    }
    save(context) {
        const contextPath = path.join(this.dataDir, 'context.json');
        fs.writeFileSync(contextPath, JSON.stringify(context, null, 2));
    }
    load() {
        const contextPath = path.join(this.dataDir, 'context.json');
        if (!fs.existsSync(contextPath))
            return null;
        try {
            return JSON.parse(fs.readFileSync(contextPath, 'utf-8'));
        }
        catch {
            return null;
        }
    }
    getDataDir() {
        return this.dataDir;
    }
}
exports.ContextBuilder = ContextBuilder;
//# sourceMappingURL=ContextBuilder.js.map