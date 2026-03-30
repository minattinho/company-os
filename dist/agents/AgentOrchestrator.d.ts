import { EventEmitter } from 'events';
import { BaseAgent, AgentData, AgentAvatar } from './BaseAgent';
import { ProjectContext } from '../scanner/ContextBuilder';
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
export declare class AgentOrchestrator extends EventEmitter {
    private agents;
    private teams;
    private dataDir;
    private anthropicApiKey?;
    private projectContext?;
    private agentThinkInterval;
    constructor(dataDir: string, anthropicApiKey?: string, agentThinkIntervalMinutes?: number);
    setProjectContext(context: ProjectContext): void;
    createTeam(params: CreateTeamParams): TeamData;
    createAgent(params: CreateAgentParams): BaseAgent;
    deleteAgent(agentId: string): boolean;
    moveAgentToTeam(agentId: string, newTeamId: string): boolean;
    getAgent(id: string): BaseAgent | undefined;
    getAllAgents(): AgentData[];
    getAllTeams(): TeamData[];
    getTeam(id: string): TeamData | undefined;
    getAgentPromptContext(agentId: string): {
        systemPrompt: string;
        memory: string[];
        currentTask: string;
    };
    recordAgentAnswer(agentId: string, question: string, answer: string): {
        answer: string;
        agent: AgentData;
    };
    updateAgentPosition(agentId: string, x: number, y: number): void;
    updateAgentState(agentId: string, state: AgentData['state']): void;
    stopAll(): void;
    private saveAgents;
    private saveTeams;
    private loadPersistedData;
    private loadTeams;
    private loadAgents;
    exportTeam(): string;
    importTeam(jsonString: string): void;
}
//# sourceMappingURL=AgentOrchestrator.d.ts.map