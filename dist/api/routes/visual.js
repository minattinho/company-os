"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.visualRouter = visualRouter;
const express_1 = require("express");
function visualRouter(meetingOrchestrator) {
    const router = (0, express_1.Router)();
    // GET /api/visual/meetings — meeting history
    router.get('/meetings', (_req, res) => {
        const history = meetingOrchestrator.getMeetingHistory();
        res.json({ meetings: history });
    });
    // GET /api/visual/meetings/current — current meeting
    router.get('/meetings/current', (_req, res) => {
        const current = meetingOrchestrator.getCurrentMeeting();
        const phase = meetingOrchestrator.getCurrentPhase();
        res.json({ meeting: current, phase });
    });
    // POST /api/visual/meetings/convoke — manually trigger meeting
    router.post('/meetings/convoke', (req, res) => {
        const { type, topic, attendees } = req.body;
        if (!type || !topic) {
            res.status(400).json({ error: 'type and topic are required' });
            return;
        }
        const meeting = meetingOrchestrator.startMeeting(type, topic, attendees ?? []);
        if (!meeting) {
            res.status(409).json({ error: 'Meeting already in progress' });
            return;
        }
        res.json({ success: true, meeting });
    });
    // POST /api/visual/meetings/speak
    router.post('/meetings/speak', (req, res) => {
        try {
            const { agentId, message } = req.body;
            if (!agentId || !message) {
                res.status(400).json({ error: 'agentId and message required' });
                return;
            }
            meetingOrchestrator.recordAgentSpeaking(agentId, message);
            res.json({ success: true, phase: meetingOrchestrator.getCurrentPhase() });
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    });
    // POST /api/visual/meetings/conclude
    router.post('/meetings/conclude', (req, res) => {
        try {
            const { conclusion, actionItems, mood } = req.body;
            if (!conclusion) {
                res.status(400).json({ error: 'conclusion is required' });
                return;
            }
            meetingOrchestrator.endMeeting(conclusion, actionItems || [], mood || 'neutral');
            res.json({ success: true });
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    });
    // POST /api/visual/meetings/emergency
    router.post('/meetings/emergency', (req, res) => {
        const { reason } = req.body;
        if (!reason) {
            res.status(400).json({ error: 'reason is required' });
            return;
        }
        meetingOrchestrator.triggerEmergency(reason);
        res.json({ success: true });
    });
    return router;
}
//# sourceMappingURL=visual.js.map