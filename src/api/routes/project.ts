import { Router, Request, Response } from 'express';
import { ContextBuilder } from '../../scanner/ContextBuilder';
import { ProjectScanner } from '../../scanner/ProjectScanner';
import { FileAnalyzer } from '../../scanner/FileAnalyzer';

export function projectRouter(
  contextBuilder: ContextBuilder,
  scanner: ProjectScanner,
  analyzer: FileAnalyzer
): Router {
  const router = Router();

  // GET /api/project/context
  router.get('/context', (_req: Request, res: Response) => {
    const context = contextBuilder.load();
    if (!context) {
      res.status(404).json({ error: 'Context not yet generated. Run a scan first.' });
      return;
    }
    res.json(context);
  });

  // POST /api/project/scan — trigger manual scan
  router.post('/scan', async (_req: Request, res: Response) => {
    try {
      const result = await scanner.scan();
      const insights = analyzer.analyze(result.files);
      const context = await contextBuilder.build(insights);
      res.json({ success: true, context });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
