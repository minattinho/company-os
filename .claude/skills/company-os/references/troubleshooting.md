# Company-OS Troubleshooting

## Port Already in Use

**Error**: `❌ Port 3000 is already in use.`

**Fix**: Use a different port or kill the existing process:
```bash
npx company-os start --port 3001
# or kill the existing process:
npx kill-port 3000
```

---

## Agents Not Visible / Canvas is Empty

**Symptom**: The dashboard loads but no avatars appear.

**Fix**: Create at least one agent. Press `N` in the dashboard, or use the REST API:
```bash
# 1. Create a team
curl -s -X POST http://localhost:3000/api/teams \
  -H "Content-Type: application/json" \
  -d '{"name": "Engineering", "color": "#4A90D9"}'

# 2. Create an agent (use the teamId returned above)
curl -s -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{"name": "Alex", "role": "Backend Engineer", "teamId": "<team-id>"}'
```

---

## Agents Do Not Respond / Stay Silent

**Symptom**: Agents are visible but never say anything.

**Explanation**: Company-OS is a passive visual engine. Agents do not generate
speech on their own. All agent speech must be sent by Claude Code via
`POST /api/agents/:id/speak`.

Ask Claude Code to "make agent X speak about Y". Claude Code will generate the
response using its own model and post it to the server.

No `ANTHROPIC_API_KEY` is needed — the server never calls the Anthropic API.

---

## Context Not Found (for `report` command)

**Error**: `❌ No context found. Run "company-os scan" first.`

**Fix**: Run `npx company-os scan` before using the `report` command.

---

## `company-os` Command Not Found

**Fix options**:
1. Use `npx company-os <command>` (no global install needed).
2. Or install globally: `npm install -g company-os`
3. Or from source: `npm run build && node dist/index.js <command>`

---

## Build Errors (from source)

```bash
npm run clean  # removes dist/
npm run build  # recompiles TypeScript
node dist/index.js start
```

Make sure you have TypeScript 5.5+ and Node.js 20+ installed.

---

## Canvas or WebSocket Disconnects in the Dashboard

- Refresh the browser page — Socket.io will reconnect automatically.
- Hard-reload with `Ctrl+Shift+R` to clear cached assets.
- Check the terminal where `company-os start` is running for error messages.

---

## File Watcher Not Triggering Re-Scans

Company-OS uses `chokidar` to watch for file changes. If re-scans do not fire:
- Press **R** in the dashboard to manually trigger a scan.
- Or call `POST /api/project/scan` from the REST API:
  ```bash
  curl -s -X POST http://localhost:3000/api/project/scan
  ```
- On Windows, ensure antivirus software is not blocking file system events.

---

## Meeting Will Not Start

**Error**: `{ "error": "Meeting already in progress" }` (HTTP 409)

A meeting is already running. Check its current state:
```bash
curl -s http://localhost:3000/api/visual/meetings/current
```

If a meeting is stuck (e.g. the server was restarted mid-meeting), restarting
the server will clear it:
```bash
# Ctrl+C to stop, then:
npx company-os start
```
