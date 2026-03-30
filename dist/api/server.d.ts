import { Server as SocketIOServer } from 'socket.io';
import { AgentOrchestrator } from '../agents/AgentOrchestrator';
import { MeetingOrchestrator } from '../agents/MeetingOrchestrator';
import { ContextBuilder } from '../scanner/ContextBuilder';
import { ProjectScanner } from '../scanner/ProjectScanner';
import { FileAnalyzer } from '../scanner/FileAnalyzer';
export interface ServerDeps {
    orchestrator: AgentOrchestrator;
    meetingOrchestrator: MeetingOrchestrator;
    contextBuilder: ContextBuilder;
    scanner: ProjectScanner;
    analyzer: FileAnalyzer;
    port: number;
    projectName: string;
}
export declare function createExpressServer(deps: ServerDeps): {
    app: import("express-serve-static-core").Express;
    httpServer: import("http").Server<typeof import("http").IncomingMessage, typeof import("http").ServerResponse>;
    io: SocketIOServer<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
};
//# sourceMappingURL=server.d.ts.map