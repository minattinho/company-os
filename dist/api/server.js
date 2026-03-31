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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createExpressServer = createExpressServer;
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const agents_1 = require("./routes/agents");
const project_1 = require("./routes/project");
const visual_1 = require("./routes/visual");
const files_1 = require("./routes/files");
const logger_1 = require("../utils/logger");
function createExpressServer(deps) {
    const app = (0, express_1.default)();
    const httpServer = (0, http_1.createServer)(app);
    const io = new socket_io_1.Server(httpServer, {
        cors: { origin: '*' },
    });
    app.use(express_1.default.json({ limit: '10mb' }));
    app.use(express_1.default.urlencoded({ extended: true }));
    // Serve public files
    const publicDir = path.join(__dirname, '../../public');
    if (fs.existsSync(publicDir)) {
        app.use(express_1.default.static(publicDir));
    }
    // API Routes
    app.use('/api/agents', (0, agents_1.agentsRouter)(deps.orchestrator));
    app.use('/api/project', (0, project_1.projectRouter)(deps.contextBuilder, deps.scanner, deps.analyzer));
    app.use('/api/visual', (0, visual_1.visualRouter)(deps.meetingOrchestrator));
    app.use('/api/files', (0, files_1.filesRouter)(deps.dataDir, io, deps.orchestrator));
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
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    });
    // Fallback to index.html for SPA
    app.get('*', (_req, res) => {
        const indexPath = path.join(publicDir, 'index.html');
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        }
        else {
            res.status(404).send('Company-OS: public/index.html not found');
        }
    });
    // ─── WebSocket Event Bridging ───────────────────────────────────────────────
    function bridgeEvents(source) {
        const events = [
            'agent:created', 'agent:update', 'agent:speak', 'agent:deleted', 'agent:moved',
            'team:created', 'team:imported',
            'meeting:start', 'meeting:phase', 'meeting:speak', 'meeting:conclusion',
            'meeting:end', 'meeting:thinking', 'meeting:phaseChange',
            'emergency:trigger', 'context:updated', 'scan:complete',
        ];
        for (const event of events) {
            source.on(event, (data) => {
                io.emit(event, data);
            });
        }
    }
    bridgeEvents(deps.orchestrator);
    bridgeEvents(deps.meetingOrchestrator);
    io.on('connection', (socket) => {
        logger_1.logger.debug(`WebSocket client connected: ${socket.id}`);
        // Send initial state
        socket.emit('init', {
            agents: deps.orchestrator.getAllAgents(),
            teams: deps.orchestrator.getAllTeams(),
            context: deps.contextBuilder.load(),
            currentMeeting: deps.meetingOrchestrator.getCurrentMeeting(),
        });
        // Handle client actions
        socket.on('agent:move', (data) => {
            deps.orchestrator.updateAgentPosition(data.agentId, data.x, data.y);
        });
        socket.on('user:message', async (data) => {
            // Broadcast user message to all connected clients
            io.emit('user:message', { message: data.message, timestamp: new Date().toISOString() });
        });
        socket.on('disconnect', () => {
            logger_1.logger.debug(`WebSocket client disconnected: ${socket.id}`);
        });
    });
    return { app, httpServer, io };
}
//# sourceMappingURL=server.js.map