"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentsRouter = agentsRouter;
const express_1 = require("express");
const logger_1 = require("../../utils/logger");
function agentsRouter(orchestrator) {
    const router = (0, express_1.Router)();
    // GET /api/agents — list all agents
    router.get('/', (_req, res) => {
        res.json({
            agents: orchestrator.getAllAgents(),
            teams: orchestrator.getAllTeams(),
        });
    });
    // GET /api/agents/:id — get single agent
    router.get('/:id', (req, res) => {
        const agent = orchestrator.getAgent(req.params['id'] ?? '');
        if (!agent) {
            res.status(404).json({ error: 'Agent not found' });
            return;
        }
        res.json(agent.getData());
    });
    // POST /api/agents — create agent
    router.post('/', (req, res) => {
        try {
            const { name, role, teamId, avatar, customSystemPrompt } = req.body;
            if (!name || !role || !teamId) {
                res.status(400).json({ error: 'name, role, and teamId are required' });
                return;
            }
            const agent = orchestrator.createAgent({ name, role, teamId, avatar, customSystemPrompt });
            res.status(201).json(agent.getData());
        }
        catch (err) {
            logger_1.logger.error('Failed to create agent', { error: err });
            res.status(500).json({ error: err.message });
        }
    });
    // DELETE /api/agents/:id
    router.delete('/:id', (req, res) => {
        const deleted = orchestrator.deleteAgent(req.params['id'] ?? '');
        if (!deleted) {
            res.status(404).json({ error: 'Agent not found' });
            return;
        }
        res.json({ success: true });
    });
    // GET /api/agents/:id/context
    router.get('/:id/context', (req, res) => {
        try {
            const context = orchestrator.getAgentPromptContext(req.params['id'] ?? '');
            res.json(context);
        }
        catch (err) {
            res.status(404).json({ error: err.message });
        }
    });
    // POST /api/agents/:id/speak
    router.post('/:id/speak', (req, res) => {
        try {
            const { question, answer } = req.body;
            if (!answer) {
                res.status(400).json({ error: 'answer is required' });
                return;
            }
            const result = orchestrator.recordAgentAnswer(req.params['id'] ?? '', question || '', answer);
            res.json(result);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // POST /api/agents/:id/move — move to different team
    router.post('/:id/move', (req, res) => {
        const { newTeamId } = req.body;
        const success = orchestrator.moveAgentToTeam(req.params['id'] ?? '', newTeamId);
        if (!success) {
            res.status(400).json({ error: 'Failed to move agent' });
            return;
        }
        res.json({ success: true });
    });
    // POST /api/teams — create team
    router.post('/teams', (req, res) => {
        const { name, color } = req.body;
        if (!name) {
            res.status(400).json({ error: 'name is required' });
            return;
        }
        const team = orchestrator.createTeam({ name, color: color ?? '#4A90D9' });
        res.status(201).json(team);
    });
    return router;
}
//# sourceMappingURL=agents.js.map