import { EventEmitter } from 'events';
import { AgentOrchestrator } from './AgentOrchestrator';
export declare enum MeetingType {
    DAILY = "daily",
    SPRINT = "sprint",
    BOARDROOM = "boardroom",
    EMERGENCY = "emergency",
    RETROSPECTIVE = "retro",
    CUSTOM = "custom"
}
export interface MeetingTranscriptEntry {
    agentId: string;
    agentName: string;
    role: string;
    message: string;
    timestamp: string;
}
export interface MeetingRecord {
    id: string;
    type: MeetingType;
    startedAt: string;
    endedAt?: string;
    topic: string;
    attendees: string[];
    transcript: MeetingTranscriptEntry[];
    conclusion: string;
    actionItems: string[];
    mood: 'positive' | 'neutral' | 'concerned';
}
export interface MeetingConfig {
    daily?: {
        enabled: boolean;
        intervalMinutes: number;
        attendees: string | string[];
    };
    sprint?: {
        enabled: boolean;
        intervalMinutes: number;
        attendees: string | string[];
    };
    boardroom?: {
        enabled: boolean;
        intervalMinutes: number;
        attendees: string | string[];
    };
    emergency?: {
        enabled: boolean;
        triggers: string[];
    };
}
export type MeetingPhase = 'idle' | 'convening' | 'opening' | 'discussion' | 'deliberation' | 'conclusion' | 'closing';
export declare class MeetingOrchestrator extends EventEmitter {
    private agentOrchestrator;
    private dataDir;
    private currentMeeting;
    private currentPhase;
    constructor(agentOrchestrator: AgentOrchestrator, dataDir: string, _config?: MeetingConfig);
    startMeeting(type: MeetingType, topic: string, attendeeIds: string[]): MeetingRecord | null;
    triggerEmergency(reason: string): void;
    setPhase(phase: MeetingPhase): void;
    recordAgentSpeaking(agentId: string, message: string): void;
    endMeeting(conclusion: string, actionItems: string[], mood: 'positive' | 'neutral' | 'concerned'): void;
    getCurrentMeeting(): MeetingRecord | null;
    getCurrentPhase(): MeetingPhase;
    private saveMeeting;
    getMeetingHistory(): MeetingRecord[];
    stopAll(): void;
}
//# sourceMappingURL=MeetingOrchestrator.d.ts.map