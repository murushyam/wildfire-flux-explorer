// MediaPipe 21-landmark hand gesture classifier & skeleton renderer.

export const HAND_CONNECTIONS = [
  // Palm base & arch
  [0, 1], [0, 5], [0, 17], [5, 9], [9, 13], [13, 17],
  // Thumb
  [1, 2], [2, 3], [3, 4],
  // Index finger
  [5, 6], [6, 7], [7, 8],
  // Middle finger
  [9, 10], [10, 11], [11, 12],
  // Ring finger
  [13, 14], [14, 15], [15, 16],
  // Pinky finger
  [17, 18], [18, 19], [19, 20]
];

export const FINGERTIP_INDICES = [4, 8, 12, 16, 20];

const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const extended = (lm, tip, pip) => d(lm[tip], lm[0]) > d(lm[pip], lm[0]) * 1.1;

/**
 * Classifies 21 normalized MediaPipe hand landmarks into distinct gestures:
 * - 'pinch': Thumb + index close together (normalized continuous ratio for TakeApart dissection)
 * - 'open': All 4/5 fingers extended (smooth camera orbit / hold to explode)
 * - 'fist': All fingers folded (camera reset / pause)
 * - 'peace': Index & middle extended (V-sign for cycling fire phases)
 * - 'three': Index, middle, ring extended (for cycling strata layers)
 * - 'point': Index extended alone (for selecting flux variable)
 * - 'thumbs_up': Thumb extended upward, other fingers curled (toggle Zen clean view)
 */
export function classify(lm) {
  if (!lm || lm.length < 21) return { name: 'none' };

  const palm = d(lm[0], lm[9]) || 1e-6;
  const pinch = d(lm[4], lm[8]) / palm;

  // Extension check for 4 fingers: Index (8), Middle (12), Ring (16), Pinky (20)
  const ext = [
    extended(lm, 8, 6),
    extended(lm, 12, 10),
    extended(lm, 16, 14),
    extended(lm, 20, 18)
  ];
  const n = ext.filter(Boolean).length;

  // Thumb extension: tip (4) extends beyond IP (3) and MCP (2) upward
  const thumbExt = d(lm[4], lm[0]) > d(lm[3], lm[0]) * 1.1 && lm[4].y < lm[3].y && lm[3].y < lm[2].y;

  // 1. Thumbs Up Gesture (Thumb extended upward, all 4 fingers curled)
  if (thumbExt && n === 0) {
    return { name: 'thumbs_up', x: lm[4].x, y: lm[4].y };
  }

  // 2. Fist Gesture (0 fingers extended, thumb curled)
  if (n === 0 && !thumbExt) {
    return { name: 'fist', x: lm[0].x, y: lm[0].y };
  }

  // 3. Pinch Gesture (Thumb tip + Index tip close together)
  if (pinch < 0.35) {
    const normRatio = Math.max(0.0, Math.min(1.0, (pinch - 0.08) / 0.27));
    return {
      name: 'pinch',
      pinch,
      normRatio,
      x: (lm[4].x + lm[8].x) * 0.5,
      y: (lm[4].y + lm[8].y) * 0.5
    };
  }

  // 4. Point Gesture (Index extended alone)
  if (ext[0] && !ext[1] && !ext[2] && !ext[3]) {
    return { name: 'point', x: lm[8].x, y: lm[8].y };
  }

  // 5. Peace / V-Sign (Index & Middle extended, Ring & Pinky curled)
  if (ext[0] && ext[1] && !ext[2] && !ext[3]) {
    return { name: 'peace', x: (lm[8].x + lm[12].x) * 0.5, y: (lm[8].y + lm[12].y) * 0.5 };
  }

  // 6. Three Fingers (Index, Middle, Ring extended, Pinky curled)
  if (ext[0] && ext[1] && ext[2] && !ext[3]) {
    return { name: 'three', x: lm[12].x, y: lm[12].y };
  }

  // 7. Open Palm (At least 4 fingers extended)
  if (n >= 4) {
    return { name: 'open', x: lm[9].x, y: lm[9].y };
  }

  return { name: 'other', x: lm[9].x, y: lm[9].y };
}

/**
 * Draws visible 21-point hand skeleton lines and landmark nodes on canvas.
 */
export function drawHandSkeleton(ctx, lm, gesture = null, options = {}) {
  if (!ctx || !ctx.canvas) return;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (!lm || lm.length < 21) return;

  // 1. Draw glowing neon skeletal connectors
  ctx.save();
  ctx.lineWidth = options.lineWidth || 3.0;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = options.connectorColor || 'rgba(0, 210, 255, 0.85)';
  ctx.shadowColor = options.glowColor || '#00d2ff';
  ctx.shadowBlur = options.shadowBlur || 8;

  for (let k = 0; k < HAND_CONNECTIONS.length; k++) {
    const [i, j] = HAND_CONNECTIONS[k];
    const p1 = lm[i];
    const p2 = lm[j];
    if (!p1 || !p2) continue;
    ctx.beginPath();
    ctx.moveTo(p1.x * w, p1.y * h);
    ctx.lineTo(p2.x * w, p2.y * h);
    ctx.stroke();
  }
  ctx.restore();

  // 2. Draw interior joint nodes
  ctx.save();
  ctx.fillStyle = options.jointColor || '#ffffff';
  for (let i = 0; i < 21; i++) {
    if (FINGERTIP_INDICES.includes(i)) continue;
    const pt = lm[i];
    if (!pt) continue;
    ctx.beginPath();
    ctx.arc(pt.x * w, pt.y * h, 3.0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 3. Draw accented glowing fingertip indicator dots
  ctx.save();
  for (let f = 0; f < FINGERTIP_INDICES.length; f++) {
    const idx = FINGERTIP_INDICES[f];
    const pt = lm[idx];
    if (!pt) continue;
    const isPinching = gesture && gesture.name === 'pinch' && (idx === 4 || idx === 8);
    const tipColor = isPinching ? '#ff9900' : (options.fingertipColor || '#00ffff');

    ctx.beginPath();
    ctx.arc(pt.x * w, pt.y * h, isPinching ? 6.5 : 4.8, 0, Math.PI * 2);
    ctx.fillStyle = tipColor;
    ctx.shadowColor = tipColor;
    ctx.shadowBlur = isPinching ? 12 : 7;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }

  // 4. Highlight pinch interaction line if active
  if (gesture && gesture.name === 'pinch' && lm[4] && lm[8]) {
    ctx.beginPath();
    ctx.moveTo(lm[4].x * w, lm[4].y * h);
    ctx.lineTo(lm[8].x * w, lm[8].y * h);
    ctx.strokeStyle = '#ffaa00';
    ctx.lineWidth = 4.0;
    ctx.shadowColor = '#ff6600';
    ctx.shadowBlur = 10;
    ctx.stroke();
  }
  ctx.restore();
}

// Swipe detector: fast horizontal palm motion within a short window.
export class Swipe {
  constructor(win = 350, dist = 0.22, cooldown = 850) {
    Object.assign(this, { win, dist, cooldown, h: [], last: 0 });
  }
  push(x, t) {
    this.h.push({ x, t });
    this.h = this.h.filter(p => t - p.t < this.win);
    if (t - this.last < this.cooldown || this.h.length < 3) return 0;
    const dx = x - this.h[0].x;
    if (Math.abs(dx) > this.dist) {
      this.last = t;
      this.h = [];
      return dx > 0 ? -1 : 1; // video preview is mirrored
    }
    return 0;
  }
}
