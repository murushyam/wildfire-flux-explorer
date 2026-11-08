// MediaPipe 21-landmark two-stage Hand Detector, Gesture Classifier,
// Temporal Gesture Stabilizer & Neon Skeleton Renderer.

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
 * STAGE 1: Hand Presence & Anatomical Finger State Detection.
 * Detects whether a valid 21-point hand is present in the frame, computes its
 * bounding box, palm center, handedness, confidence score, and per-finger extension states
 * BEFORE gesture classification occurs.
 *
 * @param {Array<{x:number, y:number, z?:number}>} lm - 21 normalized hand landmarks.
 * @param {object} [meta={}] - Optional MediaPipe handedness/confidence metadata.
 * @returns {object} Stage-1 Hand Detection summary.
 */
export function detectHand(lm, meta = {}) {
  if (!lm || !Array.isArray(lm) || lm.length < 21) {
    return {
      detected: false,
      confidence: 0,
      handedness: 'Unknown',
      extendedCount: 0,
      fingers: { thumb: false, index: false, middle: false, ring: false, pinky: false },
      palmCenter: null,
      palmSize: 0,
      bbox: null
    };
  }

  // Validate coordinates are finite numbers
  for (let i = 0; i < 21; i++) {
    if (!lm[i] || typeof lm[i].x !== 'number' || typeof lm[i].y !== 'number' || Number.isNaN(lm[i].x) || Number.isNaN(lm[i].y)) {
      return {
        detected: false,
        confidence: 0,
        handedness: 'Unknown',
        extendedCount: 0,
        fingers: { thumb: false, index: false, middle: false, ring: false, pinky: false },
        palmCenter: null,
        palmSize: 0,
        bbox: null
      };
    }
  }

  let minX = 1.0, minY = 1.0, maxX = 0.0, maxY = 0.0;
  for (let i = 0; i < 21; i++) {
    const pt = lm[i];
    if (pt.x < minX) minX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y > maxY) maxY = pt.y;
  }

  const palmSize = d(lm[0], lm[9]) || 1e-6;
  const palmCenter = {
    x: (lm[0].x + lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 5.0,
    y: (lm[0].y + lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 5.0
  };

  // Finger extension detection
  const indexExt = extended(lm, 8, 6);
  const middleExt = extended(lm, 12, 10);
  const ringExt = extended(lm, 16, 14);
  const pinkyExt = extended(lm, 20, 18);

  // Thumb extension: either upward thumb extension or lateral abduction away from pinky MCP (17)
  const thumbUp = d(lm[4], lm[0]) > d(lm[3], lm[0]) * 1.1 && lm[4].y < lm[3].y && lm[3].y < lm[2].y;
  const thumbAbducted = d(lm[4], lm[17]) > d(lm[3], lm[17]) * 1.12 && d(lm[4], lm[0]) > d(lm[2], lm[0]) * 1.08;
  const thumbExt = Boolean(thumbUp || thumbAbducted);

  const fingers = {
    thumb: thumbExt,
    index: indexExt,
    middle: middleExt,
    ring: ringExt,
    pinky: pinkyExt
  };

  const extendedCount = [thumbExt, indexExt, middleExt, ringExt, pinkyExt].filter(Boolean).length;

  // Handedness from MediaPipe metadata or geometric fallback
  let handedness = meta.handedness || 'Right';
  if (!meta.handedness) {
    handedness = lm[5].x < lm[17].x ? 'Right' : 'Left';
  }

  const rawScore = typeof meta.score === 'number' ? meta.score : 0.96;
  const confidence = Math.round(Math.max(0.5, Math.min(0.99, rawScore)) * 100);

  const pad = 0.035;
  const bbox = {
    minX: Math.max(0, minX - pad),
    minY: Math.max(0, minY - pad),
    maxX: Math.min(1, maxX + pad),
    maxY: Math.min(1, maxY + pad),
    width: Math.min(1, maxX + pad) - Math.max(0, minX - pad),
    height: Math.min(1, maxY + pad) - Math.max(0, minY - pad)
  };

  return {
    detected: true,
    confidence,
    handedness,
    extendedCount,
    fingers,
    palmCenter,
    palmSize,
    bbox
  };
}

/**
 * STAGE 2: Gesture Classification from 21 Normalized MediaPipe Landmarks.
 * Classifies a detected hand into distinct actionable gestures:
 * - 'pinch': Thumb + index close together (normalized continuous ratio for TakeApart dissection)
 * - 'open': All 4/5 fingers extended (smooth camera orbit / swipe site / hold to explode)
 * - 'fist': All fingers folded (camera reset / pause)
 * - 'peace': Index & middle extended (V-sign for cycling fire phases)
 * - 'three': Index, middle, ring extended (for cycling strata layers)
 * - 'point': Index extended alone (for selecting flux variable)
 * - 'thumbs_up': Thumb extended upward, other fingers curled (toggle Zen clean view)
 * - 'rock': Index & pinky extended, middle & ring curled (cycle Wind & Flame Boost)
 * - 'call_me': Thumb & pinky extended, index/middle/ring curled (trigger Voice Narration)
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
  const thumbShaka = thumbExt || (
    d(lm[4], lm[17]) > d(lm[3], lm[17]) * 1.15 &&
    d(lm[4], lm[0]) > d(lm[3], lm[0]) * 1.08 &&
    lm[4].y < lm[3].y
  );

  // 1. Thumbs Up Gesture (Thumb extended upward, all 4 fingers curled)
  if (thumbExt && n === 0) {
    return { name: 'thumbs_up', x: lm[4].x, y: lm[4].y };
  }

  // 2. Call-Me / Shaka Gesture (Thumb + Pinky extended, Index/Middle/Ring curled) -> Audio Narration
  if (thumbShaka && !ext[0] && !ext[1] && !ext[2] && ext[3]) {
    return { name: 'call_me', x: lm[0].x, y: lm[0].y };
  }

  // 3. Fist Gesture (0 fingers extended, thumb curled)
  if (n === 0 && !thumbExt) {
    return { name: 'fist', x: lm[0].x, y: lm[0].y };
  }

  // 4. Pinch Gesture (Thumb tip + Index tip close together)
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

  // 5. Point Gesture (Index extended alone)
  if (ext[0] && !ext[1] && !ext[2] && !ext[3]) {
    return { name: 'point', x: lm[8].x, y: lm[8].y };
  }

  // 6. Peace / V-Sign (Index & Middle extended, Ring & Pinky curled)
  if (ext[0] && ext[1] && !ext[2] && !ext[3]) {
    return { name: 'peace', x: (lm[8].x + lm[12].x) * 0.5, y: (lm[8].y + lm[12].y) * 0.5 };
  }

  // 7. Rock / Horns Sign (Index & Pinky extended, Middle & Ring curled) -> Wind Boost
  if (ext[0] && !ext[1] && !ext[2] && ext[3]) {
    return { name: 'rock', x: lm[9].x, y: lm[9].y };
  }

  // 8. Three Fingers (Index, Middle, Ring extended, Pinky curled)
  if (ext[0] && ext[1] && ext[2] && !ext[3]) {
    return { name: 'three', x: lm[12].x, y: lm[12].y };
  }

  // 9. Open Palm (At least 4 fingers extended)
  if (n >= 4) {
    return { name: 'open', x: lm[9].x, y: lm[9].y };
  }

  return { name: 'other', x: lm[9].x, y: lm[9].y };
}

/**
 * Two-stage temporal stabilizer:
 * 1. Confirms Stage-1 Hand Lock over `minHandFrames` consecutive frames.
 * 2. Smooths Stage-2 discrete gesture classification over `minGestureFrames` to prevent
 *    accidental misfires while keeping continuous gestures ('open', 'pinch') immediate.
 */
export class GestureStabilizer {
  constructor(minHandFrames = 2, minGestureFrames = 2) {
    this.minHandFrames = minHandFrames;
    this.minGestureFrames = minGestureFrames;
    this.handFrames = 0;
    this.candidateGesture = 'none';
    this.gestureFrames = 0;
    this.stableGesture = 'none';
  }

  update(lm, meta = {}) {
    const hand = detectHand(lm, meta);
    if (!hand.detected) {
      this.handFrames = 0;
      this.candidateGesture = 'none';
      this.gestureFrames = 0;
      this.stableGesture = 'none';
      return {
        hand,
        handLocked: false,
        rawGesture: { name: 'none' },
        gesture: { name: 'none' },
        stability: 0
      };
    }

    this.handFrames++;
    const handLocked = this.handFrames >= this.minHandFrames;
    const rawGesture = classify(lm);

    if (!handLocked) {
      return {
        hand,
        handLocked: false,
        rawGesture,
        gesture: { name: 'hand_detected', x: hand.palmCenter.x, y: hand.palmCenter.y },
        stability: Math.min(1, this.handFrames / this.minHandFrames)
      };
    }

    // Continuous gestures ('open' and 'pinch') pass through with zero lag once hand is locked
    if (rawGesture.name === 'open' || rawGesture.name === 'pinch') {
      this.candidateGesture = rawGesture.name;
      this.gestureFrames = this.minGestureFrames;
      this.stableGesture = rawGesture.name;
      return {
        hand,
        handLocked: true,
        rawGesture,
        gesture: rawGesture,
        stability: 1.0
      };
    }

    // Neutral / unclassified hand pose resets discrete candidate streak
    if (rawGesture.name === 'other' || rawGesture.name === 'none') {
      this.candidateGesture = rawGesture.name;
      this.gestureFrames = 0;
      this.stableGesture = 'none';
      return {
        hand,
        handLocked: true,
        rawGesture,
        gesture: rawGesture,
        stability: 0.25
      };
    }

    if (rawGesture.name === this.candidateGesture) {
      this.gestureFrames++;
    } else {
      this.candidateGesture = rawGesture.name;
      this.gestureFrames = 1;
    }

    const stability = Math.min(1.0, this.gestureFrames / this.minGestureFrames);
    if (this.gestureFrames >= this.minGestureFrames) {
      this.stableGesture = rawGesture.name;
    }

    // Enforce Stage-2 stabilization: do not emit unconfirmed discrete gesture on frame 1
    const activeGesture = (this.gestureFrames >= this.minGestureFrames)
      ? rawGesture
      : {
          name: 'hand_detected',
          candidate: rawGesture.name,
          x: hand.palmCenter.x,
          y: hand.palmCenter.y
        };

    return {
      hand,
      handLocked: true,
      rawGesture,
      gesture: activeGesture,
      stability
    };
  }

  reset() {
    this.handFrames = 0;
    this.candidateGesture = 'none';
    this.gestureFrames = 0;
    this.stableGesture = 'none';
  }
}

/**
 * Draws a subtle camera scanning reticle when in "With Camera" mode waiting for a hand.
 */
export function drawScanningReticle(ctx) {
  if (!ctx || !ctx.canvas) return;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);

  ctx.save();
  ctx.strokeStyle = 'rgba(0, 210, 255, 0.35)';
  ctx.lineWidth = 2.0;
  const mx = w * 0.22;
  const my = h * 0.18;
  const bw = w * 0.56;
  const bh = h * 0.64;
  const len = Math.min(w, h) * 0.06;

  // 4 corner brackets
  ctx.beginPath();
  // Top-left
  ctx.moveTo(mx, my + len); ctx.lineTo(mx, my); ctx.lineTo(mx + len, my);
  // Top-right
  ctx.moveTo(mx + bw - len, my); ctx.lineTo(mx + bw, my); ctx.lineTo(mx + bw, my + len);
  // Bottom-left
  ctx.moveTo(mx, my + bh - len); ctx.lineTo(mx, my + bh); ctx.lineTo(mx + len, my + bh);
  // Bottom-right
  ctx.moveTo(mx + bw - len, my + bh); ctx.lineTo(mx + bw, my + bh); ctx.lineTo(mx + bw, my + bh - len);
  ctx.stroke();

  // Center crosshair dot
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.5, 4.0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 210, 255, 0.4)';
  ctx.fill();
  ctx.restore();
}

/**
 * Draws visible Stage-1 Hand Detection bounding box + Stage-2 21-point hand skeleton lines
 * and landmark nodes on canvas.
 */
export function drawHandSkeleton(ctx, lm, gesture = null, options = {}) {
  if (!ctx || !ctx.canvas) return;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (!lm || lm.length < 21) return;

  // Stage 0/1: Draw Hand Detection Bounding Corner Brackets & Palm Core Reticle when showHandBox is enabled
  const handInfo = options.handInfo || (options.showHandBox ? detectHand(lm) : null);
  if (handInfo && handInfo.detected && handInfo.bbox && options.showHandBox === true) {
    const bx = handInfo.bbox.minX * w;
    const by = handInfo.bbox.minY * h;
    const bw = handInfo.bbox.width * w;
    const bh = handInfo.bbox.height * h;
    const corner = Math.max(8, Math.min(bw, bh) * 0.18);

    ctx.save();
    ctx.strokeStyle = 'rgba(63, 185, 80, 0.85)';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    // Top-left bracket
    ctx.moveTo(bx, by + corner); ctx.lineTo(bx, by); ctx.lineTo(bx + corner, by);
    // Top-right bracket
    ctx.moveTo(bx + bw - corner, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + corner);
    // Bottom-left bracket
    ctx.moveTo(bx, by + bh - corner); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + corner, by + bh);
    // Bottom-right bracket
    ctx.moveTo(bx + bw - corner, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - corner);
    ctx.stroke();

    // Palm center target ring
    if (handInfo.palmCenter) {
      ctx.beginPath();
      ctx.arc(handInfo.palmCenter.x * w, handInfo.palmCenter.y * h, 5.5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(63, 185, 80, 0.9)';
      ctx.stroke();
    }
    ctx.restore();
  }

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
