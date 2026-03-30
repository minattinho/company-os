import { Router, Request, Response } from 'express';
import { AgentOrchestrator } from '../../agents/AgentOrchestrator';
import { logger } from '../../utils/logger';

export function agentsRouter(orchestrator: AgentOrchestrator): Router {
  const router = Router();

  // GET /api/agents — list all agents
  router.get('/', (_req: Request, res: Response) => {
    res.json({
      agents: orchestrator.getAllAgents(),
      teams: orchestrator.getAllTeams(),
    });
  });

  // GET /api/agents/:id — get single agent
  router.get('/:id', (req: Request, res: Response) => {
    const agent = orchestrator.getAgent(req.params['id'] ?? '');
    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    res.json(agent.getData());
  });

  // POST /api/agents — create agent
  router.post('/', (req: Request, res: Response) => {
    try {
      const { name, role, teamId, avatar, customSystemPrompt } = req.body as {
        name: string;
        role: string;
        teamId: string;
        avatar: { color: string; hairStyle: number; skinTone: number };
        customSystemPrompt: string;
      };

      if (!name || !role || !teamId) {
        res.status(400).json({ error: 'name, role, and teamId are required' });
        return;
      }

      const agent = orchestrator.createAgent({ name, role, teamId, avatar, customSystemPrompt });
      res.status(201).json(agent.getData());
    } catch (err) {
      logger.error('Failed to create agent', { error: err });
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // DELETE /api/agents/:id
  router.delete('/:id', (req: Request, res: Response) => {
    const deleted = orchestrator.deleteAgent(req.params['id'] ?? '');
    if (!deleted) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    res.json({ success: true });
  });

  // GET /api/agents/:id/context
  router.get('/:id/context', (req: Request, res: Response) => {
    try {
      const context = orchestrator.getAgentPromptContext(req.params['id'] ?? '');
      res.json(context);
    } catch (err) {
      res.status(404).json({ error: (err as Error).message });
    }
  });

  // POST /api/agents/:id/speak
  router.post('/:id/speak', (req: Request, res: Response) => {
    try {
      const { question, answer } = req.body as { question: string; answer: string };
      if (!answer) {
        res.status(400).json({ error: 'answer is required' });
        return;
      }
      const result = orchestrator.recordAgentAnswer(req.params['id'] ?? '', question || '', answer);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // POST /api/agents/:id/move — move to different team
  router.post('/:id/move', (req: Request, res: Response) => {
    const { newTeamId } = req.body as { newTeamId: string };
    const success = orchestrator.moveAgentToTeam(req.params['id'] ?? '', newTeamId);
    if (!success) {
      res.status(400).json({ error: 'Failed to move agent' });
      return;
    }
    res.json({ success: true });
  });

  // POST /api/teams — create team
  router.post('/teams', (req: Request, res: Response) => {
    const { name, color } = req.body as { name: string; color: string };
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const team = orchestrator.createTeam({ name, color: color ?? '#4A90D9' });
    res.status(201).json(team);
  });

  return router;
}
