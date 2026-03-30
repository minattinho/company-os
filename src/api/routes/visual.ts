import { Router, Request, Response } from 'express';
import { MeetingOrchestrator, MeetingType } from '../../agents/MeetingOrchestrator';

export function visualRouter(meetingOrchestrator: MeetingOrchestrator): Router {
  const router = Router();

  // GET /api/visual/meetings — meeting history
  router.get('/meetings', (_req: Request, res: Response) => {
    const history = meetingOrchestrator.getMeetingHistory();
    res.json({ meetings: history });
  });

  // GET /api/visual/meetings/current — current meeting
  router.get('/meetings/current', (_req: Request, res: Response) => {
    const current = meetingOrchestrator.getCurrentMeeting();
    const phase = meetingOrchestrator.getCurrentPhase();
    res.json({ meeting: current, phase });
  });

  // POST /api/visual/meetings/convoke — manually trigger meeting
  router.post('/meetings/convoke', (req: Request, res: Response) => {
    const { type, topic, attendees } = req.body as {
      type: MeetingType;
      topic: string;
      attendees?: string[];
    };

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
  router.post('/meetings/speak', (req: Request, res: Response) => {
    try {
      const { agentId, message } = req.body as { agentId: string; message: string };
      if (!agentId || !message) {
        res.status(400).json({ error: 'agentId and message required' });
        return;
      }
      meetingOrchestrator.recordAgentSpeaking(agentId, message);
      res.json({ success: true, phase: meetingOrchestrator.getCurrentPhase() });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // POST /api/visual/meetings/conclude
  router.post('/meetings/conclude', (req: Request, res: Response) => {
    try {
      const { conclusion, actionItems, mood } = req.body as {
        conclusion: string;
        actionItems: string[];
        mood: 'positive' | 'neutral' | 'concerned';
      };
      if (!conclusion) {
        res.status(400).json({ error: 'conclusion is required' });
        return;
      }
      meetingOrchestrator.endMeeting(conclusion, actionItems || [], mood || 'neutral');
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // POST /api/visual/meetings/emergency
  router.post('/meetings/emergency', (req: Request, res: Response) => {
    const { reason } = req.body as { reason: string };
    if (!reason) {
      res.status(400).json({ error: 'reason is required' });
      return;
    }
    meetingOrchestrator.triggerEmergency(reason);
    res.json({ success: true });
  });

  return router;
}
