"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultConfig = void 0;
exports.defaultConfig = {
    projectPath: process.cwd(),
    port: 3000,
    scanIgnore: ['node_modules', '.git', 'dist', 'build', '.company-os'],
    agentThinkInterval: 5,
    visual: {
        theme: 'dark',
        pixelScale: 2,
        showNames: true,
    },
    meetings: {
        daily: { enabled: true, intervalMinutes: 30, attendees: 'all' },
        sprint: { enabled: true, intervalMinutes: 120, attendees: 'all' },
        boardroom: { enabled: true, intervalMinutes: 480, attendees: 'leaders' },
        emergency: {
            enabled: true,
            triggers: ['security_flag_detected', 'no_tests_found', 'critical_dependency', 'new_file_scan'],
        },
    },
};
//# sourceMappingURL=types.js.map