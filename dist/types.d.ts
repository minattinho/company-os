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
    };
}
export declare const defaultConfig: CompanyOSConfig;
//# sourceMappingURL=types.d.ts.map