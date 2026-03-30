import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ProjectContext } from '../scanner/ContextBuilder';
import { logger } from '../utils/logger';

export type AgentState =
  | 'idle'
  | 'walking'
  | 'working'
  | 'talking'
  | 'thinking'
  | 'arriving'
  | 'going_to_meeting'
  | 'entering_meeting'
  | 'seated'
  | 'listening'
  | 'watching'
  | 'leaving_meeting';

export interface AgentAvatar {
  color: string;
  hairStyle: number; // 1-4
  skinTone: number;  // 1-4
}

export interface AgentData {
  id: string;
  name: string;
  role: string;
  teamId: string;
  avatar: AgentAvatar;
  customSystemPrompt: string;
  builtSystemPrompt: string;
  currentTask: string;
  position: { x: number; y: number };
  floor: number;
  state: AgentState;
  memory: string[];
  createdAt: string;
  lastThoughtAt: string;
}

const MAX_MEMORY_SIZE = 20;

export class BaseAgent {
  protected data: AgentData;
  protected dataDir: string;
  protected projectContext?: ProjectContext;

  constructor(
    agentData: Partial<AgentData> & { name: string; role: string; teamId: string },
    dataDir: string,
    _anthropicApiKey?: string // kept for signature compatibility, not used
  ) {
    this.data = {
      id: agentData.id ?? uuidv4(),
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

  setProjectContext(context: ProjectContext): void {
    this.projectContext = context;
    this.data.builtSystemPrompt = this.buildSystemPrompt();
  }

  buildSystemPrompt(): string {
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

  getData(): AgentData {
    return { ...this.data };
  }

  getId(): string {
    return this.data.id;
  }

  setState(state: AgentState): void {
    this.data.state = state;
  }

  setPosition(x: number, y: number): void {
    this.data.position = { x, y };
  }

  setFloor(floor: number): void {
    this.data.floor = floor;
  }

  setCurrentTask(task: string): void {
    this.data.currentTask = task;
  }

  /**
   * Records an answer from the IDE AI (Antigravity) into this agent's memory.
   * The actual AI call is made by the IDE, not by this server.
   */
  recordAnswer(question: string, answer: string): void {
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
  getPromptContext(): { systemPrompt: string; memory: string[]; currentTask: string } {
    return {
      systemPrompt: this.data.builtSystemPrompt || this.buildSystemPrompt(),
      memory: this.data.memory.slice(-5),
      currentTask: this.data.currentTask,
    };
  }

  // ── No-op stubs kept for orchestrator compatibility ──────────────────────────
  startThinkLoop(_intervalMinutes: number): void {
    // Autonomous thinking disabled — Antigravity is the intelligence
    logger.debug(`Agent ${this.data.name} visual-only mode (no autonomous thinking)`);
  }

  stopThinkLoop(): void {
    // no-op
  }

  private addToMemory(entry: string): void {
    this.data.memory.push(`[${new Date().toISOString()}] ${entry}`);
    if (this.data.memory.length > MAX_MEMORY_SIZE) {
      this.data.memory = this.data.memory.slice(-MAX_MEMORY_SIZE);
    }
    this.saveMemory();
  }

  private saveMemory(): void {
    const memoriesDir = path.join(this.dataDir, 'memories');
    if (!fs.existsSync(memoriesDir)) {
      fs.mkdirSync(memoriesDir, { recursive: true });
    }
    const memPath = path.join(memoriesDir, `${this.data.id}.json`);
    fs.writeFileSync(memPath, JSON.stringify(this.data.memory, null, 2));
  }

  loadMemory(): void {
    const memPath = path.join(this.dataDir, 'memories', `${this.data.id}.json`);
    if (fs.existsSync(memPath)) {
      try {
        this.data.memory = JSON.parse(fs.readFileSync(memPath, 'utf-8')) as string[];
      } catch {
        this.data.memory = [];
      }
    }
  }

  toJSON(): AgentData {
    return this.getData();
  }
}
