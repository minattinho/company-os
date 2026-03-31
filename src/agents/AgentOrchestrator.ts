import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { BaseAgent, AgentData, AgentAvatar } from './BaseAgent';
import { ProjectContext } from '../scanner/ContextBuilder';
import { logger } from '../utils/logger';

export interface TeamData {
  id: string;
  name: string;
  color: string;
  floor: number;
  agentIds: string[];
}

export interface CreateAgentParams {
  name: string;
  role: string;
  teamId: string;
  avatar: AgentAvatar;
  customSystemPrompt: string;
}

export interface CreateTeamParams {
  name: string;
  color: string;
}

export class AgentOrchestrator extends EventEmitter {
  private agents: Map<string, BaseAgent> = new Map();
  private teams: Map<string, TeamData> = new Map();
  private dataDir: string;
  private anthropicApiKey?: string;
  private projectContext?: ProjectContext;
  private agentThinkInterval: number;

  constructor(dataDir: string, anthropicApiKey?: string, agentThinkIntervalMinutes = 5) {
    super();
    this.dataDir = dataDir;
    this.anthropicApiKey = anthropicApiKey;
    this.agentThinkInterval = agentThinkIntervalMinutes;
    this.loadPersistedData();
  }

  setProjectContext(context: ProjectContext): void {
    this.projectContext = context;
    for (const agent of this.agents.values()) {
      agent.setProjectContext(context);
    }
    this.emit('context:updated', context);
  }

  createTeam(params: CreateTeamParams): TeamData {
    const floor = this.teams.size; // next available floor
    const team: TeamData = {
      id: uuidv4(),
      name: params.name,
      color: params.color,
      floor,
      agentIds: [],
    };
    this.teams.set(team.id, team);
    this.saveTeams();
    this.emit('team:created', team);
    logger.info(`Team created: ${team.name} (floor ${floor})`);
    return team;
  }

  createAgent(params: CreateAgentParams): BaseAgent {
    const team = this.teams.get(params.teamId);
    if (!team) throw new Error(`Team ${params.teamId} not found`);

    // Calculate starting position on the team's floor
    const existingAgentsOnFloor = team.agentIds.length;
    const startX = 150 + existingAgentsOnFloor * 80;
    const startY = 100;

    const agent = new BaseAgent(
      {
        ...params,
        position: { x: startX, y: startY },
        floor: team.floor,
        state: 'arriving',
        currentTask: 'Joining the team...',
      },
      this.dataDir,
      this.anthropicApiKey
    );

    if (this.projectContext) {
      agent.setProjectContext(this.projectContext);
    }

    agent.loadMemory();

    this.agents.set(agent.getId(), agent);
    team.agentIds.push(agent.getId());

    this.saveAgents();
    this.saveTeams();

    // Start autonomous think loop
    agent.startThinkLoop(this.agentThinkInterval);

    // Transition from arriving to working after 3s
    setTimeout(() => {
      if (agent.getData().state === 'arriving') {
        agent.setState('working');
        this.emit('agent:update', agent.getData());
      }
    }, 3000);

    this.emit('agent:created', agent.getData());
    logger.info(`Agent created: ${params.name} (${params.role}) on floor ${team.floor}`);

    return agent;
  }

  deleteAgent(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    agent.stopThinkLoop();
    const data = agent.getData();

    // Remove from team
    const team = this.teams.get(data.teamId);
    if (team) {
      team.agentIds = team.agentIds.filter((id) => id !== agentId);
    }

    this.agents.delete(agentId);
    this.saveAgents();
    this.saveTeams();
    this.emit('agent:deleted', agentId);
    return true;
  }

  moveAgentToTeam(agentId: string, newTeamId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    const oldTeam = this.teams.get(agent.getData().teamId);
    const newTeam = this.teams.get(newTeamId);
    if (!newTeam) return false;

    if (oldTeam) {
      oldTeam.agentIds = oldTeam.agentIds.filter((id) => id !== agentId);
    }

    newTeam.agentIds.push(agentId);
    agent.setFloor(newTeam.floor);

    this.saveAgents();
    this.saveTeams();
    this.emit('agent:moved', { agentId, newTeamId, newFloor: newTeam.floor });
    return true;
  }

  getAgent(id: string): BaseAgent | undefined {
    return this.agents.get(id);
  }

  getAllAgents(): AgentData[] {
    return Array.from(this.agents.values()).map((a) => a.getData());
  }

  getAllTeams(): TeamData[] {
    return Array.from(this.teams.values());
  }

  getTeam(id: string): TeamData | undefined {
    return this.teams.get(id);
  }

  getAgentPromptContext(agentId: string) {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);
    return agent.getPromptContext();
  }

  setPendingQuestion(agentId: string, question: string): AgentData {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);
    agent.setCurrentTask(`Thinking: ${question.substring(0, 100)}`);
    agent.setState('thinking');
    this.emit('agent:update', agent.getData());
    return agent.getData();
  }

  recordAgentAnswer(agentId: string, question: string, answer: string): { answer: string; agent: AgentData } {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);

    agent.recordAnswer(question, answer);
    this.emit('agent:speak', { agentId, message: answer });
    this.emit('agent:update', agent.getData());

    return { answer, agent: agent.getData() };
  }

  updateAgentPosition(agentId: string, x: number, y: number): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.setPosition(x, y);
      this.emit('agent:update', agent.getData());
    }
  }

  updateAgentState(agentId: string, state: AgentData['state']): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.setState(state);
      this.emit('agent:update', agent.getData());
    }
  }

  stopAll(): void {
    for (const agent of this.agents.values()) {
      agent.stopThinkLoop();
    }
    this.saveAgents();
    logger.info('All agents stopped and state saved');
  }

  private saveAgents(): void {
    const agentsPath = path.join(this.dataDir, 'agents.json');
    const data = Array.from(this.agents.values()).map((a) => a.toJSON());
    fs.writeFileSync(agentsPath, JSON.stringify(data, null, 2));
  }

  private saveTeams(): void {
    const teamsPath = path.join(this.dataDir, 'teams.json');
    const data = Array.from(this.teams.values());
    fs.writeFileSync(teamsPath, JSON.stringify(data, null, 2));
  }

  private loadPersistedData(): void {
    this.loadTeams();
    this.loadAgents();
  }

  private loadTeams(): void {
    const teamsPath = path.join(this.dataDir, 'teams.json');
    if (!fs.existsSync(teamsPath)) return;

    try {
      const teams = JSON.parse(fs.readFileSync(teamsPath, 'utf-8')) as TeamData[];
      for (const team of teams) {
        this.teams.set(team.id, { ...team, agentIds: [] }); // agentIds rebuilt from agents
      }
      logger.info(`Loaded ${teams.length} teams`);
    } catch (err) {
      logger.warn('Failed to load teams', { error: err });
    }
  }

  private loadAgents(): void {
    const agentsPath = path.join(this.dataDir, 'agents.json');
    if (!fs.existsSync(agentsPath)) return;

    try {
      const agentsData = JSON.parse(fs.readFileSync(agentsPath, 'utf-8')) as AgentData[];

      for (const agentData of agentsData) {
        const agent = new BaseAgent(agentData, this.dataDir, this.anthropicApiKey);
        agent.loadMemory();
        this.agents.set(agent.getId(), agent);

        // Rebuild team's agentIds
        const team = this.teams.get(agentData.teamId);
        if (team && !team.agentIds.includes(agentData.id)) {
          team.agentIds.push(agentData.id);
        }

        // Start think loop
        agent.startThinkLoop(this.agentThinkInterval);
      }

      logger.info(`Loaded ${agentsData.length} agents`);
    } catch (err) {
      logger.warn('Failed to load agents', { error: err });
    }
  }

  exportTeam(): string {
    const exportData = {
      agents: this.getAllAgents(),
      teams: this.getAllTeams(),
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
    };
    return JSON.stringify(exportData, null, 2);
  }

  importTeam(jsonString: string): void {
    const data = JSON.parse(jsonString) as {
      agents: AgentData[];
      teams: TeamData[];
    };

    for (const team of data.teams) {
      if (!this.teams.has(team.id)) {
        this.teams.set(team.id, { ...team, agentIds: [] });
      }
    }

    for (const agentData of data.agents) {
      if (!this.agents.has(agentData.id)) {
        const agent = new BaseAgent(
          { ...agentData, state: 'arriving', memory: [] },
          this.dataDir,
          this.anthropicApiKey
        );
        if (this.projectContext) agent.setProjectContext(this.projectContext);
        this.agents.set(agent.getId(), agent);

        const team = this.teams.get(agentData.teamId);
        if (team && !team.agentIds.includes(agentData.id)) {
          team.agentIds.push(agentData.id);
        }
        agent.startThinkLoop(this.agentThinkInterval);
      }
    }

    this.saveAgents();
    this.saveTeams();
    this.emit('team:imported');
  }
}
