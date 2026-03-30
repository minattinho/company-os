import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import * as path from 'path';
import * as fs from 'fs';
import { AgentOrchestrator } from '../agents/AgentOrchestrator';
import { MeetingOrchestrator } from '../agents/MeetingOrchestrator';
import { ContextBuilder } from '../scanner/ContextBuilder';
import { ProjectScanner } from '../scanner/ProjectScanner';
import { FileAnalyzer } from '../scanner/FileAnalyzer';
import { agentsRouter } from './routes/agents';
import { projectRouter } from './routes/project';
import { visualRouter } from './routes/visual';
import { logger } from '../utils/logger';

export interface ServerDeps {
  orchestrator: AgentOrchestrator;
  meetingOrchestrator: MeetingOrchestrator;
  contextBuilder: ContextBuilder;
  scanner: ProjectScanner;
  analyzer: FileAnalyzer;
  port: number;
  projectName: string;
}

export function createExpressServer(deps: ServerDeps) {
  const app = express();
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*' },
  });

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Serve public files
  const publicDir = path.join(__dirname, '../../public');
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
  }

  // API Routes
  app.use('/api/agents', agentsRouter(deps.orchestrator));
  app.use('/api/project', projectRouter(deps.contextBuilder, deps.scanner, deps.analyzer));
  app.use('/api/visual', visualRouter(deps.meetingOrchestrator));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      projectName: deps.projectName,
      agents: deps.orchestrator.getAllAgents().length,
      teams: deps.orchestrator.getAllTeams().length,
    });
  });

  // Export/Import team
  app.get('/api/team/export', (_req, res) => {
    const data = deps.orchestrator.exportTeam();
    res.setHeader('Content-Disposition', 'attachment; filename="company-os-team.json"');
    res.setHeader('Content-Type', 'application/json');
    res.send(data);
  });

  app.post('/api/team/import', (req, res) => {
    try {
      const json = JSON.stringify(req.body);
      deps.orchestrator.importTeam(json);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Fallback to index.html for SPA
  app.get('*', (_req, res) => {
    const indexPath = path.join(publicDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Company-OS: public/index.html not found');
    }
  });

  // ─── WebSocket Event Bridging ───────────────────────────────────────────────

  function bridgeEvents(source: AgentOrchestrator | MeetingOrchestrator) {
    const events = [
      'agent:created', 'agent:update', 'agent:speak', 'agent:deleted', 'agent:moved',
      'team:created', 'team:imported',
      'meeting:start', 'meeting:phase', 'meeting:speak', 'meeting:conclusion',
      'meeting:end', 'meeting:thinking', 'meeting:phaseChange',
      'emergency:trigger', 'context:updated', 'scan:complete',
    ];

    for (const event of events) {
      source.on(event, (data: unknown) => {
        io.emit(event, data);
      });
    }
  }

  bridgeEvents(deps.orchestrator);
  bridgeEvents(deps.meetingOrchestrator);

  io.on('connection', (socket) => {
    logger.debug(`WebSocket client connected: ${socket.id}`);

    // Send initial state
    socket.emit('init', {
      agents: deps.orchestrator.getAllAgents(),
      teams: deps.orchestrator.getAllTeams(),
      context: deps.contextBuilder.load(),
      currentMeeting: deps.meetingOrchestrator.getCurrentMeeting(),
    });

    // Handle client actions
    socket.on('agent:move', (data: { agentId: string; x: number; y: number }) => {
      deps.orchestrator.updateAgentPosition(data.agentId, data.x, data.y);
    });

    socket.on('user:message', async (data: { message: string; meetingId?: string }) => {
      // Broadcast user message to all connected clients
      io.emit('user:message', { message: data.message, timestamp: new Date().toISOString() });
    });

    socket.on('disconnect', () => {
      logger.debug(`WebSocket client disconnected: ${socket.id}`);
    });
  });

  return { app, httpServer, io };
}
