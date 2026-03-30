/** @type {import('./dist/types').CompanyOSConfig} */
module.exports = {
  projectPath: process.cwd(),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  port: 3000,
  scanIgnore: ['node_modules', '.git', 'dist', 'build', '.company-os', 'coverage'],
  agentThinkInterval: 5, // minutes between autonomous agent thoughts
  visual: {
    theme: 'dark',   // 'light' | 'dark' | 'retro'
    pixelScale: 2,   // scale factor for sprites (1 or 2)
    showNames: true, // show agent names above sprites
  },
  meetings: {
    daily: {
      enabled: true,
      intervalMinutes: 30,
      attendees: 'all'
    },
    sprint: {
      enabled: true,
      intervalMinutes: 120,
      attendees: ['tech', 'clevel']
    },
    boardroom: {
      enabled: true,
      intervalMinutes: 480,
      attendees: 'leaders'
    },
    emergency: {
      enabled: true,
      triggers: [
        'security_flag_detected',
        'no_tests_found',
        'critical_dependency',
        'new_file_scan'
      ]
    }
  }
};
