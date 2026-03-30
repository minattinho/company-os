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
exports.MeetingOrchestrator = exports.MeetingType = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const events_1 = require("events");
const uuid_1 = require("uuid");
const logger_1 = require("../utils/logger");
var MeetingType;
(function (MeetingType) {
    MeetingType["DAILY"] = "daily";
    MeetingType["SPRINT"] = "sprint";
    MeetingType["BOARDROOM"] = "boardroom";
    MeetingType["EMERGENCY"] = "emergency";
    MeetingType["RETROSPECTIVE"] = "retro";
    MeetingType["CUSTOM"] = "custom";
})(MeetingType || (exports.MeetingType = MeetingType = {}));
class MeetingOrchestrator extends events_1.EventEmitter {
    agentOrchestrator;
    dataDir;
    currentMeeting = null;
    currentPhase = 'idle';
    constructor(agentOrchestrator, dataDir, _config = {} // kept for compatibility, autonomous scheduled meetings disabled
    ) {
        super();
        this.agentOrchestrator = agentOrchestrator;
        this.dataDir = dataDir;
    }
    // Called by IDE to start the visual orchestration of a meeting
    startMeeting(type, topic, attendeeIds) {
        if (this.currentMeeting) {
            logger_1.logger.warn('Meeting already in progress, skipping');
            return null;
        }
        if (attendeeIds.length === 0) {
            attendeeIds = this.agentOrchestrator.getAllAgents().map(a => a.id);
        }
        const meeting = {
            id: (0, uuid_1.v4)(),
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
        logger_1.logger.info(`Meeting started visually: ${type} — "${topic}"`);
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
    triggerEmergency(reason) {
        logger_1.logger.warn(`Emergency mode triggered: ${reason}`);
        this.emit('emergency:trigger', { reason });
    }
    setPhase(phase) {
        this.currentPhase = phase;
        this.emit('meeting:phaseChange', phase);
    }
    // Called by IDE when an agent speaks
    recordAgentSpeaking(agentId, message) {
        if (!this.currentMeeting)
            throw new Error('No active meeting');
        const agent = this.agentOrchestrator.getAgent(agentId);
        if (!agent)
            throw new Error(`Agent ${agentId} not found`);
        const agentData = agent.getData();
        // Set others to listening
        for (const otherId of this.currentMeeting.attendees) {
            if (otherId !== agentId) {
                this.agentOrchestrator.updateAgentState(otherId, 'listening');
            }
        }
        const entry = {
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
    endMeeting(conclusion, actionItems, mood) {
        if (!this.currentMeeting)
            throw new Error('No active meeting');
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
            for (const agentId of this.currentMeeting.attendees) {
                this.agentOrchestrator.updateAgentState(agentId, 'leaving_meeting');
            }
            this.emit('meeting:end', { meeting: this.currentMeeting });
            this.saveMeeting(this.currentMeeting);
            // Return agents to working
            setTimeout(() => {
                for (const agentId of this.currentMeeting.attendees) {
                    this.agentOrchestrator.updateAgentState(agentId, 'working');
                }
                this.currentMeeting = null;
                this.setPhase('idle');
            }, 3000);
        }, 5000);
    }
    getCurrentMeeting() {
        return this.currentMeeting;
    }
    getCurrentPhase() {
        return this.currentPhase;
    }
    saveMeeting(meeting) {
        const meetingsDir = path.join(this.dataDir, 'meetings');
        if (!fs.existsSync(meetingsDir)) {
            fs.mkdirSync(meetingsDir, { recursive: true });
        }
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const filePath = path.join(meetingsDir, `${ts}-${meeting.type}.json`);
        fs.writeFileSync(filePath, JSON.stringify(meeting, null, 2));
        logger_1.logger.info(`Meeting saved: ${filePath}`);
    }
    getMeetingHistory() {
        const meetingsDir = path.join(this.dataDir, 'meetings');
        if (!fs.existsSync(meetingsDir))
            return [];
        try {
            const files = fs.readdirSync(meetingsDir)
                .filter((f) => f.endsWith('.json'))
                .sort()
                .reverse()
                .slice(0, 20);
            return files.map((f) => {
                return JSON.parse(fs.readFileSync(path.join(meetingsDir, f), 'utf-8'));
            });
        }
        catch {
            return [];
        }
    }
    stopAll() {
        // No timers to stop in passive mode
    }
}
exports.MeetingOrchestrator = MeetingOrchestrator;
//# sourceMappingURL=MeetingOrchestrator.js.map