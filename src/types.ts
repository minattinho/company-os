export interface CompanyOSConfig {
  projectPath: string;
  anthropicApiKey?: string;
  port: number;
  scanIgnore: string[];
  agentThinkInterval: number;
  visual: {
    theme: 'light' | 'dark' | 'retro';
    pixelScale: number;
    showNames: boolean;
  };
  meetings: {
    daily?: { enabled: boolean; intervalMinutes: number; attendees: string | string[] };
    sprint?: { enabled: boolean; intervalMinutes: number; attendees: string | string[] };
    boardroom?: { enabled: boolean; intervalMinutes: number; attendees: string | string[] };
    emergency?: { enabled: boolean; triggers: string[] };
  };
}

export const defaultConfig: CompanyOSConfig = {
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
