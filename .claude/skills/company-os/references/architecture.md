# Company-OS Architecture Reference

## Overview

Company-OS is a Node.js/TypeScript SDK that you install inside (or alongside) any project to get an AI-powered virtual office. It has three main layers:

```
┌──────────────────────────────────────────────────────────────┐
│                     HTML5 Canvas UI                          │
│  (Terraria-style 2D office rendered with Canvas 2D API)      │
│  socket.io client ← WebSocket → socket.io server            │
└──────────────────────────────────────────────────────────────┘
                          ▲
                          │  HTTP + WebSocket
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                   Express.js Server                          │
│  REST routes: /api/agents, /api/project, /api/visual/…      │
│  socket.io server (real-time agent state → dashboard)        │
└──────────────────────────────────────────────────────────────┘
                          ▲
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌─────────────┐  ┌──────────────┐  ┌──────────────────┐
│  Project    │  │   Agent      │  │  Meeting         │
│  Scanner    │  │ Orchestrator │  │  Orchestrator    │
│             │  │              │  │                  │
│ glob+ignore │  │ BaseAgent ×N │  │ Scheduled &      │
│ FileAnalyzer│  │ Claude API   │  │ emergency        │
│ContextBuild │  │ per-agent    │  │ meetings         │
└─────────────┘  └──────────────┘  └──────────────────┘
```

## Source File Map

| File / Folder | Responsibility |
|---------------|---------------|
| `src/index.ts` | CLI entry point (commander.js), wires all subsystems |
| `src/types.ts` | Shared TypeScript interfaces and default config |
| `src/scanner/ProjectScanner.ts` | Walks files with `glob`, respects `.gitignore` via `ignore`, starts `chokidar` watcher |
| `src/scanner/FileAnalyzer.ts` | Derives language, frameworks, deps, complexity, security flags from raw file list |
| `src/scanner/ContextBuilder.ts` | Calls Claude to write a natural-language project summary; saves/loads `context.json` |
| `src/agents/BaseAgent.ts` | Individual agent: holds memory, calls Claude on a timer, exposes `ask()` |
| `src/agents/AgentOrchestrator.ts` | Manages the agent registry (CRUD), loads/saves `agents.json` + `teams.json` |
| `src/agents/MeetingOrchestrator.ts` | Schedules daily/sprint/boardroom meetings; handles emergency triggers |
| `src/api/server.ts` | Creates Express + socket.io server, wires all REST `/api/*` routes |
| `src/api/routes/` | Individual route handlers (agents, project, visual, team) |
| `src/utils/logger.ts` | Winston logger — file-only (no stdout pollution) |
| `public/` | Static HTML+JS for the Canvas dashboard, served by Express |

## Data Flow

1. **Startup** → `ProjectScanner.scan()` → `FileAnalyzer.analyze()` → `ContextBuilder.build()` (calls Claude) → writes `.company-os/context.json`
2. **Agent creation** (via dashboard or REST) → `AgentOrchestrator.createAgent()` → persists to `agents.json` → agent starts autonomous think-loop
3. **Agent think-loop** → `BaseAgent` calls Claude every N minutes → updates memory → emits `agent:update` via socket.io → canvas re-renders
4. **Meeting** → `MeetingOrchestrator.convokeMeeting()` → gathers context from all agents → single Claude call for synthesis → saves to `meetings/` → emits `meeting:start/end`
5. **File change** → `chokidar` event → re-scan → new context pushed to all agents via `orchestrator.setProjectContext()`

## LLM Usage

- **Model**: `claude-sonnet-4-20250514`
- **Context builder**: one call per scan to summarise the project
- **Agent think**: one call per agent per `agentThinkInterval` minutes
- **Meeting**: one call per meeting (multi-agent context concatenated)
- **Rate limiting**: handled by the Anthropic SDK (automatic retries + exponential back-off)

## Persistence

All runtime state is written to `.company-os/` at the project root:

```
.company-os/
├── agents.json        { id, name, role, team, focus, createdAt }[]
├── teams.json         { id, name, color }[]
├── context.json       ProjectContext snapshot
├── meetings/          <meeting-id>.json per meeting record
└── memories/          <agent-id>.json per agent memory (last N thoughts)
```

## Configuration Resolution Order

1. `ANTHROPIC_API_KEY` env var (highest priority)
2. `company-os.config.js` (or `.company-osrc`, `package.json#company-os`) — loaded by `cosmiconfig`
3. Hard-coded defaults in `src/types.ts → defaultConfig`

## Tech Stack

| Layer | Tech |
|-------|------|
| Runtime | Node.js 20+ |
| Language | TypeScript 5 (strict mode) |
| LLM | Anthropic Claude (`@anthropic-ai/sdk`) |
| Server | Express.js 4 + socket.io 4 |
| File scanning | `glob` 11 + `ignore` 5 (honours `.gitignore`) |
| File watching | `chokidar` 3 |
| Config loading | `cosmiconfig` 9 |
| Logging | `winston` 3 (file transport only) |
| IDs | `uuid` v4 |
| Visual | HTML5 Canvas 2D API — no frameworks |
