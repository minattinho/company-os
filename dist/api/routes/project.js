"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectRouter = projectRouter;
const express_1 = require("express");
function projectRouter(contextBuilder, scanner, analyzer) {
    const router = (0, express_1.Router)();
    // GET /api/project/context
    router.get('/context', (_req, res) => {
        const context = contextBuilder.load();
        if (!context) {
            res.status(404).json({ error: 'Context not yet generated. Run a scan first.' });
            return;
        }
        res.json(context);
    });
    // POST /api/project/scan — trigger manual scan
    router.post('/scan', async (_req, res) => {
        try {
            const result = await scanner.scan();
            const insights = analyzer.analyze(result.files);
            const context = await contextBuilder.build(insights);
            res.json({ success: true, context });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    return router;
}
//# sourceMappingURL=project.js.map