// Pure gesture classifier for MediaPipe 21-landmark hands (normalized coords).
const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const extended = (lm, tip, pip) => d(lm[tip], lm[0]) > d(lm[pip], lm[0]) * 1.1;

export function classify(lm) {
  const palm = d(lm[0], lm[9]) || 1e-6;
  const pinch = d(lm[4], lm[8]) / palm;
  const ext = [[8, 6], [12, 10], [16, 14], [20, 18]].map(([t, p]) => extended(lm, t, p));
  const n = ext.filter(Boolean).length;
  if (pinch < 0.35) return { name: 'pinch', pinch };
  if (n === 0) return { name: 'fist' };
  if (ext[0] && n === 1) return { name: 'point', x: lm[8].x, y: lm[8].y };
  if (n >= 4) return { name: 'open', x: lm[9].x, y: lm[9].y };
  return { name: 'other' };
}

// Swipe detector: fast horizontal palm motion within a short window.
export class Swipe {
  constructor(win = 350, dist = 0.25, cooldown = 900) { Object.assign(this, { win, dist, cooldown, h: [], last: 0 }); }
  push(x, t) {
    this.h.push({ x, t });
    this.h = this.h.filter(p => t - p.t < this.win);
    if (t - this.last < this.cooldown || this.h.length < 3) return 0;
    const dx = x - this.h[0].x;
    if (Math.abs(dx) > this.dist) { this.last = t; this.h = []; return dx > 0 ? -1 : 1; } // video is mirrored
    return 0;
  }
}
