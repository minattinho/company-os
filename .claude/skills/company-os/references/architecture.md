# Company-OS Architecture Reference

## Overview

Company-OS is a Node.js/TypeScript visual engine that renders a 2D virtual
office in the browser. It has three main layers:

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
│ glob+ignore │  │ BaseAgent ×N │  │ Passive visual   │
│ FileAnalyzer│  │ visual-only  │  │ coordination     │
│ContextBuild │  │ (no AI calls)│  │ (IDE-driven)     │
└─────────────┘  └──────────────┘  └──────────────────┘
                          ▲
                          │  REST API (curl)
               ┌──────────┴──────────┐
               │   Claude Code IDE   │
               │  generates all AI   │
               │  content, posts to  │
               │  server endpoints   │
               └─────────────────────┘
```

The IDE (Claude Code) sits above the server in the data flow.
**The server never calls any AI API.** It only renders what the IDE sends it.

## Source File Map

| File / Folder | Responsibility |
|---------------|---------------|
| `src/index.ts` | CLI entry point (commander.js), wires all subsystems |
| `src/types.ts` | Shared TypeScript interfaces and default config |
| `src/scanner/ProjectScanner.ts` | Walks files with `glob`, respects `.gitignore` via `ignore`, starts `chokidar` watcher |
| `src/scanner/FileAnalyzer.ts` | Derives language, frameworks, deps, complexity, security flags from raw file list |
| `src/scanner/ContextBuilder.ts` | Builds project summary via string interpolation of `FileAnalyzer` output; saves/loads `context.json`. No LLM calls. |
| `src/agents/BaseAgent.ts` | Holds agent data (name, role, memory, state, position). Provides `getPromptContext()` for the IDE and `recordAnswer()` to store IDE-generated responses. Think-loop is a no-op stub. |
| `src/agents/AgentOrchestrator.ts` | CRUD for agents and teams; persists to `agents.json` + `teams.json`; emits socket events |
| `src/agents/MeetingOrchestrator.ts` | Manages visual meeting lifecycle (convene → discussion → conclude). Triggered entirely by the IDE. |
| `src/api/server.ts` | Creates Express + socket.io server, wires all REST `/api/*` routes |
| `src/api/routes/` | Individual route handlers (agents, project, visual) |
| `src/utils/logger.ts` | Winston logger — file-only (no stdout pollution) |
| `public/` | Static HTML+JS for the Canvas dashboard, served by Express |

## Data Flow

1. **Startup** → `ProjectScanner.scan()` → `FileAnalyzer.analyze()` → `ContextBuilder.build()` (pure local analysis, no LLM) → writes `.company-os/context.json`
2. **Agent creation** (via dashboard or REST) → `AgentOrchestrator.createAgent()` → persists to `agents.json` → agent enters `arriving` state, transitions to `working` after 3 s
3. **IDE asks agent** → `GET /api/agents/:id/context` returns `{ systemPrompt, memory, currentTask }` → IDE generates response with its own model → `POST /api/agents/:id/speak` with `{ question, answer }` → `BaseAgent.recordAnswer()` stores to memory, emits `agent:speak` via socket.io → canvas renders speech bubble
4. **Meeting** → IDE calls `POST /api/visual/meetings/convoke` → server triggers walk-to-room animations → IDE posts each agent's generated speech via `POST /api/visual/meetings/speak` → IDE calls `POST /api/visual/meetings/conclude` → server saves meeting record to `meetings/`
5. **File change** → `chokidar` event → re-scan → new context pushed to all agents via `orchestrator.setProjectContext()`

## Passive Model Explained

`BaseAgent.startThinkLoop()` (`src/agents/BaseAgent.ts:169`) exists as a no-op
stub for API compatibility. It logs a debug message and returns immediately.
No timer is set, no AI call is ever made.

`ContextBuilder.build()` (`src/scanner/ContextBuilder.ts:53`) calls only
`buildFallbackSummary()` which is pure string interpolation — no LLM call.

Both `AgentOrchestrator` and `BaseAgent` accept an `anthropicApiKey` constructor
parameter. It is stored but never forwarded to any API call. The parameter
exists solely for forward-compatibility in case autonomous thinking is
re-enabled in a future version.

## Persistence

All runtime state is written to `.company-os/` at the project root
(automatically added to `.gitignore` on first run):

```
.company-os/
├── agents.json        { id, name, role, team, position, state, memory, createdAt }[]
├── teams.json         { id, name, color, floor, agentIds }[]
├── context.json       ProjectContext snapshot (from FileAnalyzer, no LLM)
├── meetings/          <timestamp>-<type>.json per concluded meeting
└── memories/          <agent-id>.json per agent (last 20 memory entries)
```

## Tech Stack

| Layer | Tech |
|-------|------|
| Runtime | Node.js 20+ |
| Language | TypeScript 5 (strict mode) |
| Server | Express.js 4 + socket.io 4 |
| File scanning | `glob` 11 + `ignore` 5 (honours `.gitignore`) |
| File watching | `chokidar` 3 |
| Config loading | `cosmiconfig` 9 |
| Logging | `winston` 3 (file transport only) |
| IDs | `uuid` v4 |
| Visual | HTML5 Canvas 2D API — no frameworks |

> Note: `@anthropic-ai/sdk` is listed in `package.json` but is not called
> in the current passive architecture. It is a leftover from the previous
> autonomous-agent design.
