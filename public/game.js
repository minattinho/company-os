// ============================================================
// COMPANY-OS GAME — Main App, UI, WebSocket, Game Loop
// ============================================================
'use strict';

const { TILE, FLOOR_HEIGHT, FLOOR_WIDTH, OUTFIT_COLORS, HAIR_COLORS, SKIN_TONES,
        drawAgentSprite, ChatBubble, Camera, TileMap } = window.CompanyEngine;

// ─── STATE ────────────────────────────────────────────────────────────────────
let agents       = [];
let teams        = [];
let context      = null;
let selectedAgent = null;
let chatBubbles  = [];
let activeMeeting = null;
let meetingPhase  = 'idle';
let frameCount    = 0;
let paused        = false;

// ─── CANVAS SETUP ─────────────────────────────────────────────────────────────
const canvas = document.getElementById('game-canvas');
const ctx    = canvas.getContext('2d');
const HUD_H  = 52;
const STATUS_H = 44;
let W, H;

function resizeCanvas() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight - HUD_H - STATUS_H;
  if (camera) { camera.canvasW = W; camera.canvasH = H; }
}
window.addEventListener('resize', resizeCanvas);

// ─── CAMERA & MAP ─────────────────────────────────────────────────────────────
let camera  = null;
let tileMap = null;

function initMap() {
  tileMap = new TileMap(teams);
  camera  = new Camera(W, H);
  camera.targetY = tileMap.getMapHeight() / 2 - H / 2;
  camera.y = camera.targetY;
}

// ─── AGENT POSITIONS (auto-layout by floor) ───────────────────────────────────
function getAgentWorldPos(agent) {
  const totalFloors = tileMap ? tileMap.getTotalFloors() : 4;
  const floor = agent.floor ?? 0;
  const floorY = (totalFloors - 1 - (floor + 2)) * FLOOR_HEIGHT * TILE; // +2 offset for meeting room
  return {
    x: agent.position?.x ?? 200,
    y: floorY + (FLOOR_HEIGHT - 2) * TILE - 32,
  };
}

// ─── WEBSOCKET ────────────────────────────────────────────────────────────────
const socket = io();

socket.on('init', (data) => {
  // Cancela o timeout de fallback — conexão bem-sucedida
  if (window._loadingFallback) { clearTimeout(window._loadingFallback); window._loadingFallback = null; }

  agents  = data.agents  ?? [];
  teams   = data.teams   ?? [];
  context = data.context ?? null;
  activeMeeting = data.currentMeeting ?? null;
  if (tileMap) { tileMap.floors = teams; tileMap.invalidate(); }
  updateHUD();
  notify('🏢 Conectado', `${agents.length} agentes, ${teams.length} times`, 'success');
  setTimeout(hideLoading, 500);
});

socket.on('agent:created',  (a)  => { agents.push(a); updateHUD(); notify('New Agent', `${a.name} joined!`, 'success'); });
socket.on('agent:deleted',  (id) => { agents = agents.filter(a => a.id !== id); updateHUD(); });
socket.on('agent:update',   (a)  => { const i = agents.findIndex(x => x.id===a.id); if(i>=0) agents[i]=a; if(selectedAgent?.id===a.id) updatePanel(a); });
socket.on('agent:moved',    (d)  => { const a = agents.find(x => x.id===d.agentId); if(a){ a.teamId=d.newTeamId; a.floor=d.newFloor; } });

socket.on('agent:speak', (d) => {
  const a = agents.find(x => x.id === d.agentId);
  if (!a) return;
  const pos = getAgentWorldPos(a);
  chatBubbles.push(new ChatBubble(d.message, pos.x + 16, pos.y, 9000));
  chatBubbles = chatBubbles.slice(-6);
  addSpeechLog(a.name, d.message);
});

socket.on('team:created', (t) => {
  teams.push(t);
  if (tileMap) { tileMap.floors = teams; tileMap.invalidate(); }
  updateHUD();
});

socket.on('meeting:start', (d) => {
  activeMeeting = d.meeting; meetingPhase = 'convening';
  showMeetingInfo(d.meeting, 'Convening...');
  document.getElementById('meeting-overlay').classList.add('active-meeting');
});

socket.on('meeting:phase', (d) => {
  meetingPhase = d.phase;
  const labels = { opening:'Opening', discussion:'Discussion', deliberation:'Deliberation', conclusion:'Conclusion', closing:'Closing' };
  if(activeMeeting) document.getElementById('meeting-phase-text').textContent = labels[d.phase] ?? d.phase;
});

socket.on('meeting:conclusion', (d) => {
  const wb = document.getElementById('whiteboard-text');
  if(wb) wb.textContent = d.conclusion;
});

socket.on('meeting:end', () => {
  activeMeeting = null; meetingPhase = 'idle';
  hideMeetingInfo();
  document.getElementById('meeting-overlay').classList.remove('active-meeting');
});

socket.on('context:updated', (c) => { context = c; updateHUD(); });

socket.on('emergency:trigger', (d) => {
  const overlay = document.getElementById('meeting-overlay');
  overlay.classList.add('emergency');
  notify('⚠️ Emergency Meeting', d.reason, 'error');
  setTimeout(() => overlay.classList.remove('emergency'), 3000);
});

socket.on('user:message', (d) => addSpeechLog('You', d.message));

// ─── GAME LOOP ────────────────────────────────────────────────────────────────
function gameLoop() {
  requestAnimationFrame(gameLoop);
  if (paused) return;
  frameCount++;

  ctx.clearRect(0, 0, W, H);
  camera.update();

  ctx.save();
  camera.applyTransform(ctx);

  // Draw TileMap
  if (tileMap) tileMap.render(ctx, W);

  // Draw agents
  for (const agent of agents) {
    const pos = getAgentWorldPos(agent);
    const scale = 2;

    // Autonomous walk simulation
    if (agent.state === 'walking') {
      agent.position.x += (Math.random() > 0.5 ? 0.5 : -0.5);
      agent.position.x = Math.max(TILE * 2, Math.min(FLOOR_WIDTH * TILE - TILE * 4, agent.position.x));
    }

    drawAgentSprite(ctx, pos.x, pos.y, agent.avatar ?? {}, agent.state ?? 'idle', frameCount, scale);

    // Name label
    if (true) { // showNames always on
      ctx.save();
      ctx.fillStyle = 'rgba(13,13,26,0.75)';
      const name = agent.name.length > 12 ? agent.name.substring(0,10)+'…' : agent.name;
      const tw = ctx.measureText(name).width;
      ctx.fillRect(pos.x + 16 - tw/2 - 4, pos.y - 14, tw + 8, 14);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(name, pos.x + 16, pos.y - 3);
      ctx.restore();
    }

    // Selection ring
    if (selectedAgent?.id === agent.id) {
      ctx.save();
      ctx.strokeStyle = '#7c3aed';
      ctx.lineWidth = 2;
      ctx.setLineDash([4,3]);
      ctx.beginPath();
      ctx.ellipse(pos.x + 16, pos.y + 30, 18, 6, 0, 0, Math.PI*2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Draw chat bubbles
  chatBubbles = chatBubbles.filter(b => !b.isExpired());
  for (const bubble of chatBubbles) bubble.draw(ctx);

  ctx.restore();
}

// ─── INPUT ────────────────────────────────────────────────────────────────────
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const world = camera.screenToWorld(sx, sy);

  // Hit-test agents
  let hit = null;
  for (const agent of agents) {
    const pos = getAgentWorldPos(agent);
    const ax = pos.x, ay = pos.y;
    if (world.x >= ax && world.x <= ax+32 && world.y >= ay && world.y <= ay+32) {
      hit = agent; break;
    }
  }

  if (hit) {
    selectedAgent = hit;
    openPanel(hit);
    camera.follow(getAgentWorldPos(hit).x + 16, getAgentWorldPos(hit).y + 16);
  } else {
    // deselect only if panel open is not clicked
  }
});

// Keyboard shortcuts
window.addEventListener('keydown', (e) => {
  if (['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) return;
  switch(e.key.toLowerCase()) {
    case 'n': openNewAgentModal(); break;
    case 't': openNewTeamModal(); break;
    case 'r': triggerScan(); break;
    case 'm': openMeetingModal(); break;
    case 'escape': closeAllModals(); closePanel(); break;
    case ' ': paused = !paused; e.preventDefault(); break;
    case 'tab':
      if (agents.length) {
        const idx = selectedAgent ? agents.findIndex(a => a.id === selectedAgent.id) : -1;
        selectedAgent = agents[(idx + 1) % agents.length];
        openPanel(selectedAgent);
        camera.follow(getAgentWorldPos(selectedAgent).x + 16, getAgentWorldPos(selectedAgent).y + 16);
      }
      e.preventDefault();
      break;
    case 'arrowleft': camera.scroll(-32, 0); break;
    case 'arrowright': camera.scroll(32, 0); break;
    case 'arrowup': camera.scroll(0, -32); break;
    case 'arrowdown': camera.scroll(0, 32); break;
  }
});

// Scroll zoom
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  camera.zoomBy(e.deltaY < 0 ? 0.1 : -0.1);
}, { passive: false });

// Middle-click / drag to pan
let dragging = false, lastDragX = 0, lastDragY = 0;
canvas.addEventListener('mousedown', (e) => { if(e.button===1||e.button===2){ dragging=true; lastDragX=e.clientX; lastDragY=e.clientY; e.preventDefault(); } });
window.addEventListener('mousemove', (e) => { if(!dragging) return; camera.scroll((lastDragX-e.clientX)/camera.zoom, (lastDragY-e.clientY)/camera.zoom); lastDragX=e.clientX; lastDragY=e.clientY; });
window.addEventListener('mouseup', () => { dragging=false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());

// ─── HUD ──────────────────────────────────────────────────────────────────────
function updateHUD() {
  const name = context?.projectName ?? 'Project';
  document.getElementById('hud-project-name').textContent = `🏢 ${name}`;
  document.getElementById('hud-agent-count').textContent = agents.length;
  document.getElementById('hud-team-count').textContent = teams.length;
  if (context?.generatedAt) {
    const mins = Math.round((Date.now() - new Date(context.generatedAt)) / 60000);
    document.getElementById('hud-last-scan').textContent = `Last scan: ${mins < 1 ? 'just now' : mins + 'min ago'}`;
  }
}

// ─── SIDE PANEL ───────────────────────────────────────────────────────────────
function openPanel(agent) {
  selectedAgent = agent;
  document.getElementById('panel-name').textContent = agent.name;
  document.getElementById('panel-role').textContent = `${agent.role} · ${teams.find(t=>t.id===agent.teamId)?.name ?? 'No Team'}`;
  document.getElementById('panel-state').textContent = agent.state ?? 'idle';
  document.getElementById('panel-task').textContent = agent.currentTask ?? 'Idle';
  updatePanel(agent);

  // Mini avatar
  const miniCtx = document.getElementById('panel-avatar-canvas').getContext('2d');
  miniCtx.clearRect(0,0,48,48);
  miniCtx.scale(1.5,1.5);
  drawAgentSprite(miniCtx, 0, 0, agent.avatar??{}, 'idle', 0, 2);

  const memList = document.getElementById('panel-memory');
  memList.innerHTML = '';
  (agent.memory ?? []).slice(-5).reverse().forEach(m => {
    const el = document.createElement('div');
    el.className = 'memory-item';
    el.textContent = m.replace(/^\[.*?\]\s*/,'').substring(0,180);
    memList.appendChild(el);
  });

  const statusName = document.getElementById('selected-name');
  const statusRole = document.getElementById('selected-role');
  const statusTask = document.getElementById('selected-task');
  if(statusName) statusName.textContent = agent.name;
  if(statusRole) statusRole.textContent = agent.role;
  if(statusTask) statusTask.textContent = agent.currentTask ?? 'Idle';

  document.getElementById('agent-panel').classList.add('open');
}

function updatePanel(agent) {
  if(selectedAgent?.id !== agent.id) return;
  document.getElementById('panel-state').textContent = agent.state ?? 'idle';
  document.getElementById('panel-task').textContent = agent.currentTask ?? 'Idle';
}

function closePanel() {
  document.getElementById('agent-panel').classList.remove('open');
  selectedAgent = null;
}

document.getElementById('panel-close').addEventListener('click', closePanel);

document.getElementById('panel-send').addEventListener('click', async () => {
  if (!selectedAgent) return;
  const input = document.getElementById('panel-question');
  const q = input.value.trim();
  if (!q) return;
  input.value = '';
  input.disabled = true;
  document.getElementById('panel-send').textContent = '...';
  try {
    const res = await fetch(`/api/agents/${selectedAgent.id}/ask`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ question: q })
    });
    const data = await res.json();
    if (data.answer) addSpeechLog(selectedAgent.name, data.answer);
  } catch(e) { notify('Error', 'Failed to ask agent', 'error'); }
  finally {
    input.disabled = false;
    document.getElementById('panel-send').textContent = '→ Ask';
  }
});

document.getElementById('panel-question')?.addEventListener('keydown', (e) => {
  if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); document.getElementById('panel-send').click(); }
});

// ─── MEETING INFO ─────────────────────────────────────────────────────────────
function showMeetingInfo(meeting, phase) {
  const panel = document.getElementById('meeting-info');
  const typeLabels = { daily:'Daily Standup', sprint:'Sprint Review', boardroom:'Board Meeting', emergency:'🚨 Emergency', retro:'Retrospective', custom:'Meeting' };
  document.getElementById('meeting-title').textContent = `📅 ${typeLabels[meeting.type] ?? meeting.type}`;
  document.getElementById('meeting-topic').textContent  = meeting.topic;
  document.getElementById('meeting-phase-text').textContent = phase;
  panel.classList.add('visible');
}

function hideMeetingInfo() {
  document.getElementById('meeting-info').classList.remove('visible');
}

// ─── SPEECH LOG ───────────────────────────────────────────────────────────────
function addSpeechLog(name, text) {
  const log = document.getElementById('speech-log');
  const el = document.createElement('div');
  el.className = 'speech-entry';
  el.innerHTML = `<div class="speech-agent">${name}</div><div class="speech-text">${text.substring(0,200)}</div>`;
  log.prepend(el);
  // Keep last 5
  while (log.children.length > 5) log.lastChild.remove();
  setTimeout(() => el.remove(), 12000);
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
function notify(title, text, type='info') {
  const container = document.getElementById('notifications');
  const el = document.createElement('div');
  el.className = `notification ${type}`;
  el.innerHTML = `<div class="notif-title">${title}</div><div class="notif-text">${text}</div>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ─── MODALS ───────────────────────────────────────────────────────────────────
let currentModal = null;

function closeAllModals() {
  if(currentModal) { currentModal.remove(); currentModal = null; }
}

function createModal(html) {
  closeAllModals();
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal">${html}</div>`;
  backdrop.addEventListener('click', (e) => { if(e.target===backdrop) closeAllModals(); });
  document.body.appendChild(backdrop);
  currentModal = backdrop;
  return backdrop;
}

// ── NEW AGENT MODAL ───────────────────────────────────────────────────────────
function openNewAgentModal() {
  const teamOptions = teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  const colorSwatches = OUTFIT_COLORS.map((c,i) =>
    `<div class="color-swatch" data-color="${c}" style="background:${c}"${i===0?' data-selected="1"':''} onclick="selectOutfitColor(this,'${c}')"></div>`
  ).join('');

  const html = `
    <div class="modal-header">
      <div><div class="modal-title">👤 New Employee</div><div class="modal-subtitle">Configure your AI agent</div></div>
      <button class="panel-close" onclick="closeAllModals()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Name</label>
          <input id="new-agent-name" class="form-input" placeholder="e.g. Alex Silva" />
        </div>
        <div class="form-group">
          <label class="form-label">Role / Position</label>
          <input id="new-agent-role" class="form-input" placeholder="e.g. CTO, QA Engineer" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Team / Department</label>
        ${teams.length > 0
          ? `<select id="new-agent-team" class="form-input">${teamOptions}</select>`
          : `<div style="font-size:13px;color:var(--text-muted)">No teams yet. <a href="#" onclick="closeAllModals();openNewTeamModal()" style="color:var(--accent)">Create a team first</a>.</div>`
        }
      </div>
      <div class="form-group">
        <label class="form-label">Focus & Personality</label>
        <textarea id="new-agent-prompt" class="form-input form-textarea" placeholder="Describe what this agent should focus on...\nExample: You are a security specialist. Focus on vulnerabilities, exposed API keys, and outdated dependencies."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Avatar Customization</label>
        <div class="avatar-customizer">
          <div class="avatar-preview">
            <canvas id="avatar-preview-canvas" width="64" height="64"></canvas>
          </div>
          <div class="avatar-options">
            <div>
              <div class="form-label" style="margin-bottom:6px">Outfit Color</div>
              <div class="color-grid">${colorSwatches}</div>
            </div>
            <div>
              <div class="form-label" style="margin-bottom:6px">Skin Tone</div>
              <div class="option-row">${[1,2,3,4].map(i=>`<button class="option-btn${i===1?' selected':''}" onclick="selectSkin(this,${i})">${i}</button>`).join('')}</div>
            </div>
            <div>
              <div class="form-label" style="margin-bottom:6px">Hair Style</div>
              <div class="option-row">${[1,2,3,4].map(i=>`<button class="option-btn${i===1?' selected':''}" onclick="selectHair(this,${i})">Style ${i}</button>`).join('')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeAllModals()">Cancel</button>
      <button class="btn btn-primary" onclick="submitNewAgent()">🚀 Hire Agent</button>
    </div>`;

  createModal(html);
  updateAvatarPreview();
}

window._avatar = { color: OUTFIT_COLORS[0], skinTone: 1, hairStyle: 1 };

function updateAvatarPreview() {
  const c = document.getElementById('avatar-preview-canvas');
  if (!c) return;
  const pctx = c.getContext('2d');
  pctx.clearRect(0,0,64,64);
  drawAgentSprite(pctx, 0, 8, window._avatar, 'idle', frameCount, 2);
}

window.selectOutfitColor = function(el, color) {
  document.querySelectorAll('.color-swatch').forEach(s => s.removeAttribute('data-selected'));
  el.setAttribute('data-selected','1');
  el.classList.add('selected');
  window._avatar.color = color;
  updateAvatarPreview();
};

window.selectSkin = function(el, val) {
  document.querySelectorAll('.option-btn').forEach(b => { if(b.textContent==val||b.textContent==(''+ val)) b.classList.remove('selected'); });
  el.classList.add('selected');
  window._avatar.skinTone = val;
  updateAvatarPreview();
};

window.selectHair = function(el, val) {
  window._avatar.hairStyle = val;
  el.closest('.option-row').querySelectorAll('.option-btn').forEach(b=>b.classList.remove('selected'));
  el.classList.add('selected');
  updateAvatarPreview();
};

window.submitNewAgent = async function() {
  const name   = document.getElementById('new-agent-name')?.value.trim();
  const role   = document.getElementById('new-agent-role')?.value.trim();
  const teamEl = document.getElementById('new-agent-team');
  const teamId = teamEl?.value;
  const prompt = document.getElementById('new-agent-prompt')?.value.trim();

  if (!name || !role) { notify('Missing fields', 'Name and Role are required', 'error'); return; }
  if (!teamId) { notify('No team', 'Please create a team first', 'error'); return; }

  try {
    const res = await fetch('/api/agents', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ name, role, teamId, avatar: window._avatar, customSystemPrompt: prompt ?? '' })
    });
    if (!res.ok) throw new Error(await res.text());
    closeAllModals();
    notify('Hired!', `${name} is joining the team`, 'success');
  } catch(e) { notify('Error', String(e), 'error'); }
};

// ── NEW TEAM MODAL ────────────────────────────────────────────────────────────
const TEAM_COLORS = ['#7c3aed','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899'];

function openNewTeamModal() {
  const swatches = TEAM_COLORS.map((c,i) =>
    `<div class="color-swatch${i===0?' selected':''}" style="background:${c}" onclick="this.closest('.modal').querySelectorAll('.color-swatch').forEach(s=>s.classList.remove('selected'));this.classList.add('selected');document.getElementById('new-team-color').value='${c}'"></div>`
  ).join('');

  const html = `
    <div class="modal-header">
      <div><div class="modal-title">🏢 New Team</div><div class="modal-subtitle">Create a department</div></div>
      <button class="panel-close" onclick="closeAllModals()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Team Name</label>
        <input id="new-team-name" class="form-input" placeholder="e.g. Engineering, Marketing, C-Level" />
      </div>
      <div class="form-group">
        <label class="form-label">Team Color</label>
        <input type="hidden" id="new-team-color" value="${TEAM_COLORS[0]}" />
        <div class="color-grid">${swatches}</div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeAllModals()">Cancel</button>
      <button class="btn btn-primary" onclick="submitNewTeam()">Create Team</button>
    </div>`;
  createModal(html);
}

window.submitNewTeam = async function() {
  const name  = document.getElementById('new-team-name')?.value.trim();
  const color = document.getElementById('new-team-color')?.value ?? TEAM_COLORS[0];
  if (!name) { notify('Missing field', 'Team name is required', 'error'); return; }
  try {
    const res = await fetch('/api/agents/teams', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ name, color })
    });
    if(!res.ok) throw new Error(await res.text());
    closeAllModals();
    notify('Team created!', name, 'success');
  } catch(e) { notify('Error', String(e), 'error'); }
};

// ── MEETING MODAL ─────────────────────────────────────────────────────────────
function openMeetingModal() {
  const teamChecks = teams.map(t =>
    `<label style="display:flex;gap:8px;align-items:center;font-size:13px;cursor:pointer">
      <input type="checkbox" value="${t.id}" checked style="accent-color:var(--accent)"> ${t.name}
    </label>`
  ).join('');

  const html = `
    <div class="modal-header">
      <div><div class="modal-title">📅 Call a Meeting</div></div>
      <button class="panel-close" onclick="closeAllModals()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Meeting Type</label>
        <select id="meeting-type" class="form-input">
          <option value="daily">Daily Standup</option>
          <option value="sprint">Sprint Review</option>
          <option value="boardroom">Board Meeting</option>
          <option value="custom" selected>Custom</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Topic</label>
        <textarea id="meeting-topic-input" class="form-input form-textarea" placeholder="What should the team discuss?"></textarea>
      </div>
      ${teams.length > 0 ? `
      <div class="form-group">
        <label class="form-label">Participants</label>
        <div style="display:flex;flex-direction:column;gap:8px">${teamChecks}</div>
      </div>` : ''}
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeAllModals()">Cancel</button>
      <button class="btn btn-amber" onclick="submitMeeting()">📅 Call Meeting</button>
    </div>`;
  createModal(html);
}

window.submitMeeting = async function() {
  const type  = document.getElementById('meeting-type')?.value ?? 'custom';
  const topic = document.getElementById('meeting-topic-input')?.value.trim();
  if (!topic) { notify('Missing topic', 'Please describe what to discuss', 'error'); return; }
  try {
    await fetch('/api/visual/meetings/convoke', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ type, topic, attendees:'all' })
    });
    closeAllModals();
    notify('Meeting called!', topic.substring(0,50), 'success');
  } catch(e) { notify('Error', String(e), 'error'); }
};

// ─── BUTTONS ──────────────────────────────────────────────────────────────────
document.getElementById('btn-new-agent').addEventListener('click', openNewAgentModal);
document.getElementById('btn-new-team').addEventListener('click', openNewTeamModal);
document.getElementById('btn-meeting').addEventListener('click', openMeetingModal);
document.getElementById('btn-report').addEventListener('click', () => window.open('/api/project/context', '_blank'));
document.getElementById('btn-settings').addEventListener('click', () => notify('Settings', 'Edit company-os.config.js to configure', 'info'));
document.getElementById('btn-rescan').addEventListener('click', triggerScan);

async function triggerScan() {
  notify('Scanning...', 'Re-scanning project files', 'info');
  try {
    await fetch('/api/project/scan', { method:'POST' });
  } catch(e) { notify('Scan error', String(e), 'error'); }
}

// ─── LOADING ──────────────────────────────────────────────────────────────────
function hideLoading() {
  const el = document.getElementById('loading-screen');
  if (el) { el.classList.add('hidden'); setTimeout(() => el.remove(), 600); }
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
(function init() {
  resizeCanvas();
  initMap();
  gameLoop();

  // Update loading text
  const texts = ['Booting AI systems...','Loading office assets...','Connecting agents...','Ready!'];
  let ti = 0;
  const lt = document.getElementById('loading-text');
  const ltInterval = setInterval(() => {
    if (lt) lt.textContent = texts[ti % texts.length];
    ti++;
    if (ti >= texts.length) clearInterval(ltInterval);
  }, 600);
})();
