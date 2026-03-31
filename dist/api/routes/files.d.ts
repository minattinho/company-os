import { Router } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { AgentOrchestrator } from '../../agents/AgentOrchestrator';
export type FileCategory = 'logo' | 'font' | 'color-palette' | 'guideline' | 'document' | 'other';
export interface FileRecord {
    id: string;
    filename: string;
    storedName: string;
    mimeType: string;
    size: number;
    category: FileCategory;
    teamId: string;
    teamName: string;
    uploadedBy: string;
    uploadedAt: string;
}
export declare function filesRouter(dataDir: string, io: SocketIOServer, orchestrator: AgentOrchestrator): Router;
//# sourceMappingURL=files.d.ts.map