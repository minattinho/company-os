#!/usr/bin/env node
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
require("dotenv/config");
const path = __importStar(require("path"));
const commander_1 = require("commander");
const cosmiconfig_1 = require("cosmiconfig");
const ProjectScanner_1 = require("./scanner/ProjectScanner");
const FileAnalyzer_1 = require("./scanner/FileAnalyzer");
const ContextBuilder_1 = require("./scanner/ContextBuilder");
const AgentOrchestrator_1 = require("./agents/AgentOrchestrator");
const MeetingOrchestrator_1 = require("./agents/MeetingOrchestrator");
const server_1 = require("./api/server");
const types_1 = require("./types");
const program = new commander_1.Command();
program
    .name('company-os')
    .description('AI-powered virtual office for any project')
    .version('1.0.0');
async function loadConfig(projectPath) {
    const explorer = (0, cosmiconfig_1.cosmiconfig)('company-os');
    const result = await explorer.search(projectPath);
    const fileConfig = result?.config ?? {};
    return {
        ...types_1.defaultConfig,
        ...fileConfig,
        projectPath,
        anthropicApiKey: process.env['ANTHROPIC_API_KEY'] ?? fileConfig.anthropicApiKey,
        port: Number(process.env['PORT'] ?? fileConfig.port ?? types_1.defaultConfig.port),
        visual: { ...types_1.defaultConfig.visual, ...(fileConfig.visual ?? {}) },
        meetings: {
            ...types_1.defaultConfig.meetings,
            ...(fileConfig.meetings ?? {}),
        },
    };
}
async function initializeSystem(config) {
    const dataDir = path.join(config.projectPath, '.company-os');
    const scanner = new ProjectScanner_1.ProjectScanner(config.projectPath, config.scanIgnore);
    const analyzer = new FileAnalyzer_1.FileAnalyzer(config.projectPath);
    const contextBuilder = new ContextBuilder_1.ContextBuilder(config.projectPath, config.anthropicApiKey);
    const orchestrator = new AgentOrchestrator_1.AgentOrchestrator(dataDir, config.anthropicApiKey, config.agentThinkInterval);
    const meetingOrchestrator = new MeetingOrchestrator_1.MeetingOrchestrator(orchestrator, dataDir, config.meetings ?? {});
    // Perform initial scan
    console.log('🔍 Scanning project...');
    const scanResult = await scanner.scan();
    const insights = analyzer.analyze(scanResult.files);
    const context = await contextBuilder.build(insights);
    orchestrator.setProjectContext(context);
    console.log(`✅ Context built: ${context.projectName} (${context.projectType})`);
    // Check for emergency triggers
    if (config.meetings?.emergency?.enabled) {
        const triggers = config.meetings.emergency.triggers ?? [];
        if (triggers.includes('security_flag_detected') && context.securityFlags.length > 0) {
            meetingOrchestrator.triggerEmergency(`Security issues detected: ${context.securityFlags[0]}`);
        }
        if (triggers.includes('no_tests_found') && !context.hasTests) {
            meetingOrchestrator.triggerEmergency('No tests found in project');
        }
    }
    // Start file watcher for hot-reload
    scanner.startWatching(async () => {
        console.log('🔄 Re-scanning project...');
        const newScan = await scanner.scan();
        const newInsights = analyzer.analyze(newScan.files);
        const newContext = await contextBuilder.build(newInsights);
        orchestrator.setProjectContext(newContext);
        console.log('✅ Context updated');
    });
    return { scanner, analyzer, contextBuilder, orchestrator, meetingOrchestrator, context, dataDir };
}
// ─── Commands ──────────────────────────────────────────────────────────────────
program
    .command('start')
    .description('Start the Company-OS server and visual office')
    .option('-p, --port <port>', 'Port to listen on', '3000')
    .option('--project-path <path>', 'Path to project to scan (default: current directory)')
    .action(async (opts) => {
    const projectPath = opts.projectPath ? path.resolve(opts.projectPath) : process.cwd();
    console.log('\n🏢 Company-OS Starting...\n');
    const config = await loadConfig(projectPath);
    config.port = parseInt(opts.port, 10);
    const { scanner, analyzer, contextBuilder, orchestrator, meetingOrchestrator, context, dataDir } = await initializeSystem(config);
    const { httpServer } = (0, server_1.createExpressServer)({
        orchestrator,
        meetingOrchestrator,
        contextBuilder,
        scanner,
        analyzer,
        port: config.port,
        projectName: context.projectName,
        dataDir,
    });
    // Graceful shutdown
    const shutdown = () => {
        console.log('\n💾 Saving state and shutting down...');
        orchestrator.stopAll();
        meetingOrchestrator.stopAll();
        scanner.stopWatching();
        httpServer.close(() => {
            console.log('✅ Goodbye!\n');
            process.exit(0);
        });
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    httpServer.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            const alt = config.port + 1;
            console.error(`\n❌ Port ${config.port} is already in use.`);
            console.error(`   To use a different port run:  npx company-os start --port ${alt}`);
            console.error(`   Or kill the existing process: npx kill-port ${config.port}\n`);
        }
        else {
            console.error(`\n❌ Server error: ${err.message}\n`);
        }
        orchestrator.stopAll();
        meetingOrchestrator.stopAll();
        scanner.stopWatching();
        process.exit(1);
    });
    httpServer.listen(config.port, () => {
        console.log(`\n✨ Company-OS is running!`);
        console.log(`   📊 Dashboard: http://localhost:${config.port}`);
        console.log(`   🏗️  Project: ${context.projectName} (${context.projectType})`);
        console.log(`   👥 Agents: ${orchestrator.getAllAgents().length}`);
        console.log(`   🏷️  Teams: ${orchestrator.getAllTeams().length}`);
        console.log(`\n   Press Ctrl+C to stop\n`);
    });
});
program
    .command('scan')
    .description('Scan project and generate context.json')
    .option('-p, --path <path>', 'Path to project to scan (default: current directory)')
    .action(async (opts) => {
    const projectPath = opts.path ? path.resolve(opts.path) : process.cwd();
    const config = await loadConfig(projectPath);
    console.log('🔍 Scanning project...');
    const scanner = new ProjectScanner_1.ProjectScanner(projectPath, config.scanIgnore);
    const analyzer = new FileAnalyzer_1.FileAnalyzer(projectPath);
    const contextBuilder = new ContextBuilder_1.ContextBuilder(projectPath, config.anthropicApiKey);
    const scanResult = await scanner.scan();
    const insights = analyzer.analyze(scanResult.files);
    const context = await contextBuilder.build(insights);
    console.log(`\n✅ Scan complete!`);
    console.log(`   Project: ${context.projectName}`);
    console.log(`   Type: ${context.projectType}`);
    console.log(`   Language: ${context.mainLanguage}`);
    console.log(`   Files: ${context.fileCount}`);
    console.log(`   Lines of code: ${context.linesOfCode}`);
    console.log(`   Frameworks: ${context.frameworks.join(', ') || 'none'}`);
    console.log(`   Security flags: ${context.securityFlags.length}`);
    console.log(`\n   Context saved to: .company-os/context.json\n`);
    process.exit(0);
});
program
    .command('report')
    .description('Generate executive report without visual interface')
    .action(async () => {
    const projectPath = process.cwd();
    const config = await loadConfig(projectPath);
    const contextBuilder = new ContextBuilder_1.ContextBuilder(projectPath, config.anthropicApiKey);
    const context = contextBuilder.load();
    if (!context) {
        console.error('❌ No context found. Run "company-os scan" first.');
        process.exit(1);
    }
    console.log('\n📋 COMPANY-OS EXECUTIVE REPORT');
    console.log('═'.repeat(50));
    console.log(`Project: ${context.projectName}`);
    console.log(`Generated: ${new Date(context.generatedAt).toLocaleString()}`);
    console.log('─'.repeat(50));
    console.log('\nPROJECT SUMMARY:');
    console.log(context.summary);
    console.log('\nTECH STACK:');
    console.log(`  Language: ${context.mainLanguage}`);
    console.log(`  Frameworks: ${context.frameworks.join(', ') || 'none'}`);
    console.log(`  Dependencies: ${context.dependencies.length}`);
    console.log('\nQUALITY:');
    console.log(`  Has Tests: ${context.hasTests ? '✅' : '❌'}`);
    console.log(`  Has CI: ${context.hasCI ? '✅' : '❌'}`);
    console.log(`  Has Docs: ${context.hasDocs ? '✅' : '❌'}`);
    console.log(`  Complexity: ${context.codeComplexityScore}/10`);
    if (context.securityFlags.length > 0) {
        console.log('\n⚠️  SECURITY FLAGS:');
        context.securityFlags.forEach((f) => console.log(`  - ${f}`));
    }
    console.log('═'.repeat(50) + '\n');
    process.exit(0);
});
// Discontinued CLI commands (ask, meeting)
// Since Company-OS runs as a passive visual engine, these actions should be performed directly
// via the Antigravity IDE standard interface (chat).
program.parse(process.argv);
//# sourceMappingURL=index.js.map