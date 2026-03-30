import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { AgentOrchestrator } from './AgentOrchestrator';
import { logger } from '../utils/logger';

export enum MeetingType {
  DAILY = 'daily',
  SPRINT = 'sprint',
  BOARDROOM = 'boardroom',
  EMERGENCY = 'emergency',
  RETROSPECTIVE = 'retro',
  CUSTOM = 'custom',
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
  daily?: { enabled: boolean; intervalMinutes: number; attendees: string | string[] };
  sprint?: { enabled: boolean; intervalMinutes: number; attendees: string | string[] };
  boardroom?: { enabled: boolean; intervalMinutes: number; attendees: string | string[] };
  emergency?: {
    enabled: boolean;
    triggers: string[];
  };
}

export type MeetingPhase =
  | 'idle'
  | 'convening'
  | 'opening'
  | 'discussion'
  | 'deliberation'
  | 'conclusion'
  | 'closing';

export class MeetingOrchestrator extends EventEmitter {
  private agentOrchestrator: AgentOrchestrator;
  private dataDir: string;
  private currentMeeting: MeetingRecord | null = null;
  private currentPhase: MeetingPhase = 'idle';

  constructor(
    agentOrchestrator: AgentOrchestrator,
    dataDir: string,
    _config: MeetingConfig = {} // kept for compatibility, autonomous scheduled meetings disabled
  ) {
    super();
    this.agentOrchestrator = agentOrchestrator;
    this.dataDir = dataDir;
  }

  // Called by IDE to start the visual orchestration of a meeting
  startMeeting(
    type: MeetingType,
    topic: string,
    attendeeIds: string[]
  ): MeetingRecord | null {
    if (this.currentMeeting) {
      logger.warn('Meeting already in progress, skipping');
      return null;
    }

    if (attendeeIds.length === 0) {
      attendeeIds = this.agentOrchestrator.getAllAgents().map(a => a.id);
    }

    const meeting: MeetingRecord = {
      id: uuidv4(),
      type,
      startedAt: new Date().toISOString(),
      topic,
      attendees: attendeeIds,
      transcript: [],
      conclusion: '',
      actionItems: [],
      mood: 'neutral',
    };

    this.currentMeeting = meeting;
    logger.info(`Meeting started visually: ${type} — "${topic}"`);

    this.setPhase('convening');
    for (const agentId of attendeeIds) {
      this.agentOrchestrator.updateAgentState(agentId, 'going_to_meeting');
    }
    this.emit('meeting:start', { meeting });

    // Auto transition to seated after 2s
    setTimeout(() => {
      this.setPhase('opening');
      this.emit('meeting:phase', { phase: 'opening', meeting: this.currentMeeting });
      for (const agentId of attendeeIds) {
        this.agentOrchestrator.updateAgentState(agentId, 'seated');
      }
      setTimeout(() => {
        this.setPhase('discussion');
        this.emit('meeting:phase', { phase: 'discussion', meeting: this.currentMeeting });
      }, 1500);
    }, 2000);

    return meeting;
  }

  triggerEmergency(reason: string): void {
    logger.warn(`Emergency mode triggered: ${reason}`);
    this.emit('emergency:trigger', { reason });
  }

  setPhase(phase: MeetingPhase): void {
    this.currentPhase = phase;
    this.emit('meeting:phaseChange', phase);
  }

  // Called by IDE when an agent speaks
  recordAgentSpeaking(agentId: string, message: string): void {
    if (!this.currentMeeting) throw new Error('No active meeting');

    const agent = this.agentOrchestrator.getAgent(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);

    const agentData = agent.getData();

    // Set others to listening
    for (const otherId of this.currentMeeting.attendees) {
      if (otherId !== agentId) {
        this.agentOrchestrator.updateAgentState(otherId, 'listening');
      }
    }

    const entry: MeetingTranscriptEntry = {
      agentId,
      agentName: agentData.name,
      role: agentData.role,
      message,
      timestamp: new Date().toISOString(),
    };

    this.currentMeeting.transcript.push(entry);

    agent.recordAnswer('Meeting discussion', message);
    this.agentOrchestrator.updateAgentState(agentId, 'talking');
    this.emit('meeting:speak', { entry, meeting: this.currentMeeting });

    // After ~8s, everyone stays seated
    setTimeout(() => {
      if (this.currentMeeting && this.currentPhase === 'discussion') {
        for (const id of this.currentMeeting.attendees) {
          this.agentOrchestrator.updateAgentState(id, 'seated');
        }
      }
    }, 8000);
  }

  // Called by IDE to conclude meeting
  endMeeting(conclusion: string, actionItems: string[], mood: 'positive' | 'neutral' | 'concerned'): void {
    if (!this.currentMeeting) throw new Error('No active meeting');

    this.setPhase('conclusion');
    this.currentMeeting.conclusion = conclusion;
    this.currentMeeting.actionItems = actionItems;
    this.currentMeeting.mood = mood;
    this.currentMeeting.endedAt = new Date().toISOString();

    const leaderId = this.currentMeeting.attendees[0];
    if (leaderId) {
      this.agentOrchestrator.updateAgentState(leaderId, 'talking');
    }

    this.emit('meeting:conclusion', { conclusion, actionItems, meeting: this.currentMeeting });

    setTimeout(() => {
      this.setPhase('closing');
      for (const agentId of this.currentMeeting!.attendees) {
        this.agentOrchestrator.updateAgentState(agentId, 'leaving_meeting');
      }
      this.emit('meeting:end', { meeting: this.currentMeeting });
      this.saveMeeting(this.currentMeeting!);

      // Return agents to working
      setTimeout(() => {
        for (const agentId of this.currentMeeting!.attendees) {
          this.agentOrchestrator.updateAgentState(agentId, 'working');
        }
        this.currentMeeting = null;
        this.setPhase('idle');
      }, 3000);

    }, 5000);
  }

  getCurrentMeeting(): MeetingRecord | null {
    return this.currentMeeting;
  }

  getCurrentPhase(): MeetingPhase {
    return this.currentPhase;
  }

  private saveMeeting(meeting: MeetingRecord): void {
    const meetingsDir = path.join(this.dataDir, 'meetings');
    if (!fs.existsSync(meetingsDir)) {
      fs.mkdirSync(meetingsDir, { recursive: true });
    }
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(meetingsDir, `${ts}-${meeting.type}.json`);
    fs.writeFileSync(filePath, JSON.stringify(meeting, null, 2));
    logger.info(`Meeting saved: ${filePath}`);
  }

  getMeetingHistory(): MeetingRecord[] {
    const meetingsDir = path.join(this.dataDir, 'meetings');
    if (!fs.existsSync(meetingsDir)) return [];

    try {
      const files = fs.readdirSync(meetingsDir)
        .filter((f) => f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, 20);

      return files.map((f) => {
        return JSON.parse(fs.readFileSync(path.join(meetingsDir, f), 'utf-8')) as MeetingRecord;
      });
    } catch {
      return [];
    }
  }

  stopAll(): void {
    // No timers to stop in passive mode
  }
}
