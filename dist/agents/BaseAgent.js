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
exports.BaseAgent = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const uuid_1 = require("uuid");
const logger_1 = require("../utils/logger");
const MAX_MEMORY_SIZE = 20;
class BaseAgent {
    data;
    dataDir;
    projectContext;
    constructor(agentData, dataDir, _anthropicApiKey // kept for signature compatibility, not used
    ) {
        this.data = {
            id: agentData.id ?? (0, uuid_1.v4)(),
            name: agentData.name,
            role: agentData.role,
            teamId: agentData.teamId,
            avatar: agentData.avatar ?? { color: '#4A90D9', hairStyle: 1, skinTone: 1 },
            customSystemPrompt: agentData.customSystemPrompt ?? '',
            builtSystemPrompt: agentData.builtSystemPrompt ?? '',
            currentTask: agentData.currentTask ?? 'Settling in...',
            position: agentData.position ?? { x: 100, y: 100 },
            floor: agentData.floor ?? 0,
            state: agentData.state ?? 'arriving',
            memory: agentData.memory ?? [],
            createdAt: agentData.createdAt ?? new Date().toISOString(),
            lastThoughtAt: agentData.lastThoughtAt ?? new Date().toISOString(),
        };
        this.dataDir = dataDir;
    }
    setProjectContext(context) {
        this.projectContext = context;
        this.data.builtSystemPrompt = this.buildSystemPrompt();
    }
    buildSystemPrompt() {
        const ctx = this.projectContext;
        if (!ctx) {
            return this.data.customSystemPrompt ||
                `You are ${this.data.name}, a ${this.data.role}. Answer questions based on your role and expertise.`;
        }
        return `You are ${this.data.name}, a ${this.data.role} at a virtual AI company analyzing the project "${ctx.projectName}".

## Your Role & Personality
${this.data.customSystemPrompt || `As a ${this.data.role}, you focus on your area of expertise and provide actionable insights about this project.`}

## Project Context
- **Project**: ${ctx.projectName} (${ctx.projectType})
- **Language**: ${ctx.mainLanguage}
- **Frameworks**: ${ctx.frameworks.join(', ') || 'None detected'}
- **Lines of Code**: ${ctx.linesOfCode}
- **Has Tests**: ${ctx.hasTests ? 'Yes' : 'No'}
- **Has CI**: ${ctx.hasCI ? 'Yes' : 'No'}
- **Security Flags**: ${ctx.securityFlags.join(', ') || 'None'}
- **Dependencies**: ${ctx.dependencies.slice(0, 10).map((d) => d.name).join(', ')}
- **API Endpoints**: ${ctx.apiEndpoints.slice(0, 10).join(', ') || 'None detected'}
- **Env Vars**: ${ctx.envVarsUsed.join(', ') || 'None'}

## Project Summary
${ctx.summary}

## Recent Changes
${ctx.recentChanges}

---
Keep responses concise (2-4 sentences max) and focused on your specific expertise. Always be actionable and specific to this project.`;
    }
    getData() {
        return { ...this.data };
    }
    getId() {
        return this.data.id;
    }
    setState(state) {
        this.data.state = state;
    }
    setPosition(x, y) {
        this.data.position = { x, y };
    }
    setFloor(floor) {
        this.data.floor = floor;
    }
    setCurrentTask(task) {
        this.data.currentTask = task;
    }
    /**
     * Records an answer from the IDE AI (Antigravity) into this agent's memory.
     * The actual AI call is made by the IDE, not by this server.
     */
    recordAnswer(question, answer) {
        this.addToMemory(`Q: ${question}\nA: ${answer}`);
        this.data.currentTask = answer.substring(0, 120);
        this.data.lastThoughtAt = new Date().toISOString();
        this.data.state = 'talking';
        setTimeout(() => {
            if (this.data.state === 'talking') {
                this.data.state = 'working';
            }
        }, 8000);
    }
    /**
     * Returns the agent's system prompt and memory so the IDE AI can respond on its behalf.
     * No API call is made here.
     */
    getPromptContext() {
        return {
            systemPrompt: this.data.builtSystemPrompt || this.buildSystemPrompt(),
            memory: this.data.memory.slice(-5),
            currentTask: this.data.currentTask,
        };
    }
    // ── No-op stubs kept for orchestrator compatibility ──────────────────────────
    startThinkLoop(_intervalMinutes) {
        // Autonomous thinking disabled — Antigravity is the intelligence
        logger_1.logger.debug(`Agent ${this.data.name} visual-only mode (no autonomous thinking)`);
    }
    stopThinkLoop() {
        // no-op
    }
    addToMemory(entry) {
        this.data.memory.push(`[${new Date().toISOString()}] ${entry}`);
        if (this.data.memory.length > MAX_MEMORY_SIZE) {
            this.data.memory = this.data.memory.slice(-MAX_MEMORY_SIZE);
        }
        this.saveMemory();
    }
    saveMemory() {
        const memoriesDir = path.join(this.dataDir, 'memories');
        if (!fs.existsSync(memoriesDir)) {
            fs.mkdirSync(memoriesDir, { recursive: true });
        }
        const memPath = path.join(memoriesDir, `${this.data.id}.json`);
        fs.writeFileSync(memPath, JSON.stringify(this.data.memory, null, 2));
    }
    loadMemory() {
        const memPath = path.join(this.dataDir, 'memories', `${this.data.id}.json`);
        if (fs.existsSync(memPath)) {
            try {
                this.data.memory = JSON.parse(fs.readFileSync(memPath, 'utf-8'));
            }
            catch {
                this.data.memory = [];
            }
        }
    }
    toJSON() {
        return this.getData();
    }
}
exports.BaseAgent = BaseAgent;
//# sourceMappingURL=BaseAgent.js.map