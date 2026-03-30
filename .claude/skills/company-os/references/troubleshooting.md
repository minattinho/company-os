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

## No ANTHROPIC_API_KEY

**Error**: The agents think but never respond, or you see authentication errors in logs.

**Fix**:
1. Create a `.env` file at the project root.
2. Add: `ANTHROPIC_API_KEY=sk-ant-...your-key...`
3. Restart with `npx company-os start`.

You can get a key at https://console.anthropic.com.

---

## No Agents Found (for `ask` or `meeting` commands)

**Error**: `❌ No agents found. Start company-os first and create some agents.`

**Fix**: Run `npx company-os start`, open the dashboard, and create at least one agent using the **+ New Agent** button or the REST API.

---

## Context Not Found (for `report` command)

**Error**: `❌ No context found. Run "company-os scan" first.`

**Fix**: Run `npx company-os scan` before `report`.

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

## Agents Not Thinking / Silent

- Agents think every `agentThinkInterval` minutes (default: 5). Wait or lower the interval in `company-os.config.js`.
- Check `.company-os/` logs (Winston writes to files, not stdout).
- Verify `ANTHROPIC_API_KEY` is valid and has quota.

---

## File Watcher Not Triggering Re-Scans

Company-OS uses `chokidar` to watch for file changes. If re-scans don't fire:
- Press **R** in the dashboard to manually trigger a scan.
- Or call `POST /api/project/scan` from the REST API.
- On Windows, ensure antivirus software isn't blocking file system events.
