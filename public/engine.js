// ============================================================
// COMPANY-OS ENGINE — Canvas 2D, Sprites, TileMap, Camera
// ============================================================

const TILE = 32;
const FLOOR_HEIGHT = 8;  // tiles tall per floor
const FLOOR_WIDTH  = 40; // tiles wide per floor

// Palette
const COLORS = {
  sky:       '#0d0d1a',
  wallDark:  '#1a1a2e',
  wallMid:   '#1e2040',
  floor:     '#252545',
  floorLine: '#2a2a50',
  desk:      '#3d2b1f',
  deskTop:   '#614233',
  monitor:   '#0d0d1a',
  screen:    '#00ffcc',
  plant:     '#1a4a1a',
  plantPot:  '#7c3d1e',
  chair:     '#2c2c4e',
  window:    '#b8d4e8',
  frameCol:  '#404060',
  stair:     '#2a2a42',
  meetingTbl:'#2d1b10',
  projector: '#111122',
  projScreen:'#e8f0ff',
  carpet:    '#1a1a35',
};

// Agent outfit colors (12 options)
const OUTFIT_COLORS = [
  '#4a90d9','#7c3aed','#06b6d4','#10b981','#f59e0b','#ef4444',
  '#ec4899','#8b5cf6','#14b8a6','#f97316','#6366f1','#84cc16',
];

// Hair colors
const HAIR_COLORS = ['#1a0a00','#8B4513','#FFD700','#C0C0C0'];

// Skin tones
const SKIN_TONES = ['#FDBCB4','#D4956A','#8B6355','#5C3D2E'];

// ─── SPRITE DRAWING ──────────────────────────────────────────────────────────

function drawAgentSprite(ctx, x, y, avatar, state, frame, scale=2) {
  const s = scale;
  const px = Math.round(x);
  const py = Math.round(y);

  const skin   = SKIN_TONES[(avatar.skinTone ?? 1) - 1] ?? SKIN_TONES[0];
  const outfit = avatar.color ?? OUTFIT_COLORS[0];
  const hair   = HAIR_COLORS[(avatar.hairStyle ?? 1) - 1] ?? HAIR_COLORS[0];

  ctx.save();

  const breathOffset = (state === 'idle' || state === 'seated') ? (Math.floor(frame * 0.5) % 2 === 0 ? 0 : -s) : 0;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(px + 8*s, py + 16*s, 6*s, 2*s, 0, 0, Math.PI*2);
  ctx.fill();

  // Legs / walking animation
  if (state === 'walking') {
    const legSwing = Math.sin(frame * 0.4) * 3 * s;
    // left leg
    ctx.fillStyle = outfit;
    ctx.fillRect(px + 4*s, py + 11*s, 3*s, 5*s + legSwing);
    // right leg
    ctx.fillRect(px + 9*s, py + 11*s, 3*s, 5*s - legSwing);
  } else if (state === 'seated' || state === 'listening' || state === 'talking') {
    ctx.fillStyle = outfit;
    ctx.fillRect(px + 4*s, py + 11*s, 3*s, 3*s);
    ctx.fillRect(px + 9*s, py + 11*s, 3*s, 3*s);
  } else {
    ctx.fillStyle = outfit;
    ctx.fillRect(px + 4*s, py + 11*s + breathOffset, 3*s, 5*s);
    ctx.fillRect(px + 9*s, py + 11*s + breathOffset, 3*s, 5*s);
  }

  // Shoes
  ctx.fillStyle = '#1a1a1a';
  if (state !== 'seated') {
    ctx.fillRect(px + 3*s, py + 15*s, 4*s, 2*s);
    ctx.fillRect(px + 9*s, py + 15*s, 4*s, 2*s);
  }

  // Body
  ctx.fillStyle = outfit;
  ctx.fillRect(px + 3*s, py + 6*s + breathOffset, 10*s, 6*s);

  // Arms
  if (state === 'working') {
    const typeFrame = Math.floor(frame * 0.5) % 2;
    ctx.fillStyle = skin;
    ctx.fillRect(px + 1*s, py + 7*s, 2*s, 4*s);
    ctx.fillRect(px + 13*s, py + 7*s + (typeFrame ? s : 0), 2*s, 4*s);
  } else if (state === 'talking') {
    const gestFrame = Math.floor(frame * 0.3) % 2;
    ctx.fillStyle = skin;
    ctx.fillRect(px + 0*s, py + 6*s, 2*s, 4*s + (gestFrame ? s : 0));
    ctx.fillRect(px + 14*s, py + 6*s, 2*s, 4*s - (gestFrame ? s : 0));
  } else {
    ctx.fillStyle = skin;
    ctx.fillRect(px + 1*s, py + 7*s, 2*s, 5*s);
    ctx.fillRect(px + 13*s, py + 7*s, 2*s, 5*s);
  }

  // Head
  ctx.fillStyle = skin;
  ctx.fillRect(px + 4*s, py + 1*s + breathOffset, 8*s, 6*s);

  // Hair
  ctx.fillStyle = hair;
  switch (avatar.hairStyle ?? 1) {
    case 1: ctx.fillRect(px+4*s, py, 8*s, 2*s); break;
    case 2: ctx.fillRect(px+3*s, py, 10*s, 2*s); ctx.fillRect(px+3*s, py+1*s, 1*s, 3*s); break;
    case 3: ctx.fillRect(px+4*s, py, 8*s, 3*s); ctx.fillRect(px+4*s, py+3*s, 2*s, 1*s); break;
    case 4: ctx.fillRect(px+5*s, py, 6*s, 2*s); break;
  }

  // Eyes
  ctx.fillStyle = '#111';
  ctx.fillRect(px+5*s, py+3*s+breathOffset, s, s);
  ctx.fillRect(px+10*s, py+3*s+breathOffset, s, s);

  // Think bubble
  if (state === 'thinking') {
    const dots = Math.floor(Date.now() / 500) % 3;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.roundRect(px + 16*s, py - 8*s, (14 + dots*4)*s, 8*s, 4*s);
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.font = `${8*s}px monospace`;
    ctx.fillText('.'.repeat(dots+1), px+18*s, py-2*s);
  }

  ctx.restore();
}

// ─── CHAT BUBBLE ─────────────────────────────────────────────────────────────

class ChatBubble {
  constructor(text, x, y, duration=8000) {
    this.text = text;
    this.x = x;
    this.y = y;
    this.duration = duration;
    this.createdAt = Date.now();
    this.displayedChars = 0;
    this.typewriterInterval = setInterval(() => {
      if (this.displayedChars < this.text.length) this.displayedChars++;
    }, 30);
  }

  isExpired() { return Date.now() - this.createdAt > this.duration; }

  draw(ctx) {
    if (this.isExpired()) { clearInterval(this.typewriterInterval); return; }
    const text = this.text.substring(0, this.displayedChars);
    const truncated = text.length > 120 ? text.substring(0,118)+'…' : text;
    const lines = this.wrapText(truncated, 200);

    const padding = 10;
    const lineH = 16;
    const w = 220;
    const h = lines.length * lineH + padding * 2;
    const bx = this.x - w/2;
    const by = this.y - h - 20;

    const alpha = Math.min(1, (this.duration - (Date.now()-this.createdAt)) / 1000);
    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha);

    // Bubble
    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(bx, by, w, h, 8);
    ctx.fill();
    ctx.stroke();

    // Tail
    ctx.beginPath();
    ctx.moveTo(this.x - 6, by + h);
    ctx.lineTo(this.x, by + h + 10);
    ctx.lineTo(this.x + 6, by + h);
    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    ctx.fill();

    // Text
    ctx.fillStyle = '#1a1a2e';
    ctx.font = '11px Inter, sans-serif';
    lines.forEach((line, i) => {
      ctx.fillText(line, bx + padding, by + padding + (i+1)*lineH - 4);
    });

    ctx.restore();
  }

  wrapText(text, maxW) {
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    // Estimate: ~6px per char
    for (const w of words) {
      if ((cur + w).length * 6 > maxW && cur) { lines.push(cur.trim()); cur = ''; }
      cur += w + ' ';
    }
    if (cur.trim()) lines.push(cur.trim());
    return lines;
  }
}

// ─── CAMERA ──────────────────────────────────────────────────────────────────

class Camera {
  constructor(canvasW, canvasH) {
    this.x = 0;
    this.y = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.zoom = 1;
    this.targetZoom = 1;
    this.canvasW = canvasW;
    this.canvasH = canvasH;
  }

  update() {
    this.x += (this.targetX - this.x) * 0.08;
    this.y += (this.targetY - this.y) * 0.08;
    this.zoom += (this.targetZoom - this.zoom) * 0.1;
  }

  follow(wx, wy) {
    this.targetX = wx - this.canvasW / (2 * this.targetZoom);
    this.targetY = wy - this.canvasH / (2 * this.targetZoom);
    this.clamp();
  }

  clamp() {
    const mapW = FLOOR_WIDTH * TILE;
    this.targetX = Math.max(0, Math.min(mapW - this.canvasW / this.targetZoom, this.targetX));
    this.targetY = Math.max(0, this.targetY);
  }

  applyTransform(ctx) {
    ctx.setTransform(this.zoom, 0, 0, this.zoom, -this.x * this.zoom, -this.y * this.zoom);
  }

  screenToWorld(sx, sy) {
    return {
      x: sx / this.zoom + this.x,
      y: sy / this.zoom + this.y,
    };
  }

  scroll(dx, dy) {
    this.targetX += dx;
    this.targetY += dy;
    this.clamp();
  }

  zoomBy(delta) {
    this.targetZoom = Math.max(0.5, Math.min(3, this.targetZoom + delta));
  }
}

// ─── TILEMAP ─────────────────────────────────────────────────────────────────

class TileMap {
  constructor(floors) {
    this.floors = floors; // array of {id, name, color, floor}
    this.offscreenCanvas = null;
    this.dirty = true;
  }

  getFloorY(floorIndex) {
    // Floor 0 = bottom. Higher floors draw upwards.
    // Meeting room gets floor slot 0.5 (between 0 and 1) — we draw it between floor 0 and 1
    return (this.getTotalFloors() - 1 - floorIndex) * FLOOR_HEIGHT * TILE;
  }

  getTotalFloors() {
    return Math.max(3, this.floors.length + 1); // +1 for meeting room
  }

  getMapHeight() {
    return this.getTotalFloors() * FLOOR_HEIGHT * TILE;
  }

  invalidate() { this.dirty = true; }

  render(ctx, canvasW) {
    if (this.dirty || !this.offscreenCanvas) {
      this.redraw(canvasW);
      this.dirty = false;
    }
    ctx.drawImage(this.offscreenCanvas, 0, 0);
  }

  redraw(canvasW) {
    const h = this.getMapHeight();
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width  = FLOOR_WIDTH * TILE;
    this.offscreenCanvas.height = h;
    const ctx = this.offscreenCanvas.getContext('2d');

    // Background
    ctx.fillStyle = COLORS.sky;
    ctx.fillRect(0, 0, FLOOR_WIDTH * TILE, h);

    const totalFloors = this.getTotalFloors();

    for (let fi = 0; fi < totalFloors; fi++) {
      const fy = (totalFloors - 1 - fi) * FLOOR_HEIGHT * TILE;
      const isMeeting = fi === 1; // meeting room always floor 1
      const teamFloor = fi >= 2 ? this.floors[fi - 2] : null;
      const tint = teamFloor ? teamFloor.color : (isMeeting ? '#1a1055' : '#12112a');

      this.drawFloor(ctx, fy, tint, isMeeting, fi);
    }
  }

  drawFloor(ctx, fy, tint, isMeeting, fi) {
    const W = FLOOR_WIDTH * TILE;
    const H = FLOOR_HEIGHT * TILE;

    // Floor background
    ctx.fillStyle = tint;
    ctx.globalAlpha = 0.3;
    ctx.fillRect(0, fy, W, H);
    ctx.globalAlpha = 1;

    // Ceiling/floor divider
    ctx.fillStyle = COLORS.wallMid;
    ctx.fillRect(0, fy, W, TILE);

    // Floor tile pattern
    ctx.fillStyle = COLORS.floor;
    ctx.fillRect(0, fy + (H - TILE), W, TILE);
    ctx.fillStyle = COLORS.floorLine;
    for (let x = 0; x < FLOOR_WIDTH; x++) {
      ctx.fillRect(x * TILE, fy + H - TILE, 1, TILE);
    }

    // Left/right walls
    ctx.fillStyle = COLORS.wallDark;
    ctx.fillRect(0, fy, TILE, H);
    ctx.fillRect(W - TILE, fy, TILE, H);

    // Windows (every 5 tiles on outer walls)
    ctx.fillStyle = COLORS.window;
    ctx.globalAlpha = 0.6;
    for (let x = 3; x < FLOOR_WIDTH - 3; x += 6) {
      const wy = fy + TILE + 4;
      ctx.fillRect(x * TILE + 4, wy, TILE * 2 - 8, TILE * 2 - 4);
    }
    ctx.globalAlpha = 1;
    // Window frames
    ctx.fillStyle = COLORS.frameCol;
    for (let x = 3; x < FLOOR_WIDTH - 3; x += 6) {
      const wy = fy + TILE + 4;
      ctx.strokeStyle = COLORS.frameCol;
      ctx.lineWidth = 2;
      ctx.strokeRect(x * TILE + 4, wy, TILE * 2 - 8, TILE * 2 - 4);
      ctx.fillRect(x * TILE + TILE / 2, wy, 2, TILE * 2 - 4); // vertical divider
    }

    // Stairs (right side)
    ctx.fillStyle = COLORS.stair;
    for (let s = 0; s < 4; s++) {
      ctx.fillRect(W - TILE * 3 + s * 4, fy + H - TILE - s * 8, TILE * 2, 8);
    }

    // Meeting room special decor
    if (isMeeting) {
      this.drawMeetingRoom(ctx, fy);
    } else {
      this.drawOfficeDecor(ctx, fy, fi);
    }
  }

  drawMeetingRoom(ctx, fy) {
    const W = FLOOR_WIDTH * TILE;
    const H = FLOOR_HEIGHT * TILE;
    const cx = W / 2;
    const cy = fy + H / 2;

    // Carpet
    ctx.fillStyle = COLORS.carpet;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy + TILE, TILE * 8, TILE * 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Oval meeting table
    ctx.fillStyle = COLORS.meetingTbl;
    ctx.beginPath();
    ctx.ellipse(cx, cy + TILE, TILE * 6, TILE * 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5d3620';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Projector screen (left wall)
    ctx.fillStyle = COLORS.projScreen;
    ctx.fillRect(TILE * 2, fy + TILE * 2, TILE * 4, TILE * 2.5);
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 2;
    ctx.strokeRect(TILE * 2, fy + TILE * 2, TILE * 4, TILE * 2.5);

    // Projector label
    ctx.fillStyle = '#888';
    ctx.font = '10px Inter';
    ctx.fillText('PROJECTOR', TILE * 2 + 8, fy + TILE * 2 + 14);

    // Whiteboard (right wall)
    ctx.fillStyle = '#f8f8ff';
    ctx.fillRect(W - TILE * 7, fy + TILE * 2, TILE * 4, TILE * 2.5);
    ctx.strokeStyle = '#ddd';
    ctx.strokeRect(W - TILE * 7, fy + TILE * 2, TILE * 4, TILE * 2.5);
    ctx.fillStyle = '#aaa';
    ctx.fillText('WHITEBOARD', W - TILE * 7 + 4, fy + TILE * 2 + 14);
  }

  drawOfficeDecor(ctx, fy, fi) {
    const H = FLOOR_HEIGHT * TILE;
    const floorY = fy + H - TILE;

    // Desks (every 5 tiles starting at tile 3)
    for (let d = 0; d < 6; d++) {
      const dx = (3 + d * 5) * TILE;
      if (dx > (FLOOR_WIDTH - 5) * TILE) break;
      this.drawDesk(ctx, dx, floorY - TILE * 3);
    }

    // Plant (near windows)
    this.drawPlant(ctx, 2 * TILE, floorY - TILE * 2);
    this.drawPlant(ctx, (FLOOR_WIDTH - 4) * TILE, floorY - TILE * 2);
  }

  drawDesk(ctx, x, y) {
    // Desk surface
    ctx.fillStyle = COLORS.deskTop;
    ctx.fillRect(x, y + TILE, TILE * 3, 8);
    // Desk body
    ctx.fillStyle = COLORS.desk;
    ctx.fillRect(x, y + TILE + 8, TILE * 3, TILE - 8);
    // Monitor
    ctx.fillStyle = COLORS.monitor;
    ctx.fillRect(x + TILE + 4, y, TILE - 8, TILE - 4);
    ctx.fillStyle = COLORS.screen;
    ctx.globalAlpha = 0.7;
    ctx.fillRect(x + TILE + 6, y + 2, TILE - 12, TILE - 8);
    ctx.globalAlpha = 1;
    // Monitor stand
    ctx.fillStyle = '#555';
    ctx.fillRect(x + TILE + TILE/2 - 2, y + TILE - 4, 4, 8);
    // Chair
    ctx.fillStyle = COLORS.chair;
    ctx.fillRect(x + TILE - 4, y + TILE * 2, TILE + 8, 8);
    ctx.fillRect(x + TILE, y + TILE * 2 + 8, TILE, TILE);
  }

  drawPlant(ctx, x, y) {
    ctx.fillStyle = COLORS.plantPot;
    ctx.fillRect(x + 4, y + TILE, TILE - 8, 12);
    ctx.fillStyle = COLORS.plant;
    ctx.beginPath();
    ctx.arc(x + TILE/2, y + TILE/2, TILE/2 - 2, 0, Math.PI*2);
    ctx.fill();
  }
}

// Export to global scope
window.CompanyEngine = {
  TILE, FLOOR_HEIGHT, FLOOR_WIDTH, COLORS, OUTFIT_COLORS, HAIR_COLORS, SKIN_TONES,
  drawAgentSprite, ChatBubble, Camera, TileMap,
};
