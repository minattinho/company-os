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
exports.AgentOrchestrator = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const events_1 = require("events");
const uuid_1 = require("uuid");
const BaseAgent_1 = require("./BaseAgent");
const logger_1 = require("../utils/logger");
class AgentOrchestrator extends events_1.EventEmitter {
    agents = new Map();
    teams = new Map();
    dataDir;
    anthropicApiKey;
    projectContext;
    agentThinkInterval;
    constructor(dataDir, anthropicApiKey, agentThinkIntervalMinutes = 5) {
        super();
        this.dataDir = dataDir;
        this.anthropicApiKey = anthropicApiKey;
        this.agentThinkInterval = agentThinkIntervalMinutes;
        this.loadPersistedData();
    }
    setProjectContext(context) {
        this.projectContext = context;
        for (const agent of this.agents.values()) {
            agent.setProjectContext(context);
        }
        this.emit('context:updated', context);
    }
    createTeam(params) {
        const floor = this.teams.size; // next available floor
        const team = {
            id: (0, uuid_1.v4)(),
            name: params.name,
            color: params.color,
            floor,
            agentIds: [],
        };
        this.teams.set(team.id, team);
        this.saveTeams();
        this.emit('team:created', team);
        logger_1.logger.info(`Team created: ${team.name} (floor ${floor})`);
        return team;
    }
    createAgent(params) {
        const team = this.teams.get(params.teamId);
        if (!team)
            throw new Error(`Team ${params.teamId} not found`);
        // Calculate starting position on the team's floor
        const existingAgentsOnFloor = team.agentIds.length;
        const startX = 150 + existingAgentsOnFloor * 80;
        const startY = 100;
        const agent = new BaseAgent_1.BaseAgent({
            ...params,
            position: { x: startX, y: startY },
            floor: team.floor,
            state: 'arriving',
            currentTask: 'Joining the team...',
        }, this.dataDir, this.anthropicApiKey);
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
        logger_1.logger.info(`Agent created: ${params.name} (${params.role}) on floor ${team.floor}`);
        return agent;
    }
    deleteAgent(agentId) {
        const agent = this.agents.get(agentId);
        if (!agent)
            return false;
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
    moveAgentToTeam(agentId, newTeamId) {
        const agent = this.agents.get(agentId);
        if (!agent)
            return false;
        const oldTeam = this.teams.get(agent.getData().teamId);
        const newTeam = this.teams.get(newTeamId);
        if (!newTeam)
            return false;
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
    getAgent(id) {
        return this.agents.get(id);
    }
    getAllAgents() {
        return Array.from(this.agents.values()).map((a) => a.getData());
    }
    getAllTeams() {
        return Array.from(this.teams.values());
    }
    getTeam(id) {
        return this.teams.get(id);
    }
    getAgentPromptContext(agentId) {
        const agent = this.agents.get(agentId);
        if (!agent)
            throw new Error(`Agent ${agentId} not found`);
        return agent.getPromptContext();
    }
    recordAgentAnswer(agentId, question, answer) {
        const agent = this.agents.get(agentId);
        if (!agent)
            throw new Error(`Agent ${agentId} not found`);
        agent.recordAnswer(question, answer);
        this.emit('agent:speak', { agentId, message: answer });
        this.emit('agent:update', agent.getData());
        return { answer, agent: agent.getData() };
    }
    updateAgentPosition(agentId, x, y) {
        const agent = this.agents.get(agentId);
        if (agent) {
            agent.setPosition(x, y);
            this.emit('agent:update', agent.getData());
        }
    }
    updateAgentState(agentId, state) {
        const agent = this.agents.get(agentId);
        if (agent) {
            agent.setState(state);
            this.emit('agent:update', agent.getData());
        }
    }
    stopAll() {
        for (const agent of this.agents.values()) {
            agent.stopThinkLoop();
        }
        this.saveAgents();
        logger_1.logger.info('All agents stopped and state saved');
    }
    saveAgents() {
        const agentsPath = path.join(this.dataDir, 'agents.json');
        const data = Array.from(this.agents.values()).map((a) => a.toJSON());
        fs.writeFileSync(agentsPath, JSON.stringify(data, null, 2));
    }
    saveTeams() {
        const teamsPath = path.join(this.dataDir, 'teams.json');
        const data = Array.from(this.teams.values());
        fs.writeFileSync(teamsPath, JSON.stringify(data, null, 2));
    }
    loadPersistedData() {
        this.loadTeams();
        this.loadAgents();
    }
    loadTeams() {
        const teamsPath = path.join(this.dataDir, 'teams.json');
        if (!fs.existsSync(teamsPath))
            return;
        try {
            const teams = JSON.parse(fs.readFileSync(teamsPath, 'utf-8'));
            for (const team of teams) {
                this.teams.set(team.id, { ...team, agentIds: [] }); // agentIds rebuilt from agents
            }
            logger_1.logger.info(`Loaded ${teams.length} teams`);
        }
        catch (err) {
            logger_1.logger.warn('Failed to load teams', { error: err });
        }
    }
    loadAgents() {
        const agentsPath = path.join(this.dataDir, 'agents.json');
        if (!fs.existsSync(agentsPath))
            return;
        try {
            const agentsData = JSON.parse(fs.readFileSync(agentsPath, 'utf-8'));
            for (const agentData of agentsData) {
                const agent = new BaseAgent_1.BaseAgent(agentData, this.dataDir, this.anthropicApiKey);
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
            logger_1.logger.info(`Loaded ${agentsData.length} agents`);
        }
        catch (err) {
            logger_1.logger.warn('Failed to load agents', { error: err });
        }
    }
    exportTeam() {
        const exportData = {
            agents: this.getAllAgents(),
            teams: this.getAllTeams(),
            exportedAt: new Date().toISOString(),
            version: '1.0.0',
        };
        return JSON.stringify(exportData, null, 2);
    }
    importTeam(jsonString) {
        const data = JSON.parse(jsonString);
        for (const team of data.teams) {
            if (!this.teams.has(team.id)) {
                this.teams.set(team.id, { ...team, agentIds: [] });
            }
        }
        for (const agentData of data.agents) {
            if (!this.agents.has(agentData.id)) {
                const agent = new BaseAgent_1.BaseAgent({ ...agentData, state: 'arriving', memory: [] }, this.dataDir, this.anthropicApiKey);
                if (this.projectContext)
                    agent.setProjectContext(this.projectContext);
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
exports.AgentOrchestrator = AgentOrchestrator;
//# sourceMappingURL=AgentOrchestrator.js.map