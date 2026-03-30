import { ProjectContext } from '../scanner/ContextBuilder';
export type AgentState = 'idle' | 'walking' | 'working' | 'talking' | 'thinking' | 'arriving' | 'going_to_meeting' | 'entering_meeting' | 'seated' | 'listening' | 'watching' | 'leaving_meeting';
export interface AgentAvatar {
    color: string;
    hairStyle: number;
    skinTone: number;
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
    position: {
        x: number;
        y: number;
    };
    floor: number;
    state: AgentState;
    memory: string[];
    createdAt: string;
    lastThoughtAt: string;
}
export declare class BaseAgent {
    protected data: AgentData;
    protected dataDir: string;
    protected projectContext?: ProjectContext;
    constructor(agentData: Partial<AgentData> & {
        name: string;
        role: string;
        teamId: string;
    }, dataDir: string, _anthropicApiKey?: string);
    setProjectContext(context: ProjectContext): void;
    buildSystemPrompt(): string;
    getData(): AgentData;
    getId(): string;
    setState(state: AgentState): void;
    setPosition(x: number, y: number): void;
    setFloor(floor: number): void;
    setCurrentTask(task: string): void;
    /**
     * Records an answer from the IDE AI (Antigravity) into this agent's memory.
     * The actual AI call is made by the IDE, not by this server.
     */
    recordAnswer(question: string, answer: string): void;
    /**
     * Returns the agent's system prompt and memory so the IDE AI can respond on its behalf.
     * No API call is made here.
     */
    getPromptContext(): {
        systemPrompt: string;
        memory: string[];
        currentTask: string;
    };
    startThinkLoop(_intervalMinutes: number): void;
    stopThinkLoop(): void;
    private addToMemory;
    private saveMemory;
    loadMemory(): void;
    toJSON(): AgentData;
}
//# sourceMappingURL=BaseAgent.d.ts.map