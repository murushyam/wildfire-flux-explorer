// ==============================================================================
// TEST SUITE: Multi-Gesture Recognition, Hand Skeleton, & Performance Tiers
// ==============================================================================

import assert from 'node:assert/strict';
import { HAND_CONNECTIONS, FINGERTIP_INDICES, classify, drawHandSkeleton, Swipe } from '../js/gestures.js';
import { createVolumetricFire, createEmbers, createSmokePlume } from '../js/volumetric-fire.js';
import { applyPerfTier } from '../js/scene.js';

let passed = 0;
let total = 0;

function it(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
    throw err;
  }
}

console.log('======================================================================');
console.log('   TEST SUITE: GESTURE CLASSIFIER, SKELETON TOPOLOGY & PERF TIERS    ');
console.log('======================================================================\n');

// -----------------------------------------------------------------------------
// Helper to construct synthetic 21 MediaPipe hand landmarks
// -----------------------------------------------------------------------------
function makeMockHand(overrides = {}) {
  // Default: baseline relaxed curled hand centered around wrist (0.5, 0.8)
  const lm = [];
  for (let i = 0; i < 21; i++) {
    lm.push({ x: 0.5, y: 0.7 - i * 0.02, z: 0.0 });
  }
  // Wrist: 0
  lm[0] = { x: 0.5, y: 0.8, z: 0.0 };
  // Middle MCP: 9 (defines palm scale: distance 0.3)
  lm[9] = { x: 0.5, y: 0.5, z: 0.0 };

  // Thumb: 1, 2, 3, 4 (curled / tucked near palm base by default)
  lm[1] = { x: 0.45, y: 0.75, z: 0.0 };
  lm[2] = { x: 0.44, y: 0.70, z: 0.0 };
  lm[3] = { x: 0.44, y: 0.68, z: 0.0 };
  lm[4] = { x: 0.44, y: 0.72, z: 0.0 };

  // Index: 5(MCP), 6(PIP), 7(DIP), 8(Tip)
  lm[5] = { x: 0.46, y: 0.52, z: 0.0 };
  lm[6] = { x: 0.46, y: 0.58, z: 0.0 }; // Curled: tip closer to wrist than PIP
  lm[7] = { x: 0.46, y: 0.62, z: 0.0 };
  lm[8] = { x: 0.46, y: 0.65, z: 0.0 };

  // Middle: 9, 10, 11, 12
  lm[10] = { x: 0.50, y: 0.58, z: 0.0 };
  lm[11] = { x: 0.50, y: 0.62, z: 0.0 };
  lm[12] = { x: 0.50, y: 0.65, z: 0.0 };

  // Ring: 13, 14, 15, 16
  lm[13] = { x: 0.54, y: 0.52, z: 0.0 };
  lm[14] = { x: 0.54, y: 0.58, z: 0.0 };
  lm[15] = { x: 0.54, y: 0.62, z: 0.0 };
  lm[16] = { x: 0.54, y: 0.65, z: 0.0 };

  // Pinky: 17, 18, 19, 20
  lm[17] = { x: 0.58, y: 0.55, z: 0.0 };
  lm[18] = { x: 0.58, y: 0.60, z: 0.0 };
  lm[19] = { x: 0.58, y: 0.64, z: 0.0 };
  lm[20] = { x: 0.58, y: 0.68, z: 0.0 };

  // Apply overrides
  for (const [idx, pt] of Object.entries(overrides)) {
    lm[Number(idx)] = { ...lm[Number(idx)], ...pt };
  }
  return lm;
}

// Helper to extend a finger (tip farther from wrist than PIP)
function extendFinger(lm, tipIdx, pipIdx, yElev = 0.25) {
  lm[tipIdx] = { x: lm[pipIdx].x, y: yElev, z: 0.0 };
}

// -----------------------------------------------------------------------------
// SUITE 1: Skeleton Topology & Constants
// -----------------------------------------------------------------------------
console.log('--- SUITE 1: Skeleton Topology & Connections ---');

it('HAND_CONNECTIONS contains exactly 21 anatomical bone connector pairs', () => {
  assert.equal(HAND_CONNECTIONS.length, 21);
  for (const [a, b] of HAND_CONNECTIONS) {
    assert(Number.isInteger(a) && a >= 0 && a <= 20, `Invalid index ${a}`);
    assert(Number.isInteger(b) && b >= 0 && b <= 20, `Invalid index ${b}`);
    assert.notEqual(a, b, 'Connection cannot connect a joint to itself');
  }
});

it('FINGERTIP_INDICES contains 5 standard MediaPipe fingertips [4, 8, 12, 16, 20]', () => {
  assert.deepEqual(FINGERTIP_INDICES, [4, 8, 12, 16, 20]);
});

// -----------------------------------------------------------------------------
// SUITE 2: Multi-Gesture Recognition Classification
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 2: Multi-Gesture Recognition Matrix ---');

it('classify() handles null, empty, or truncated landmark arrays gracefully', () => {
  assert.equal(classify(null).name, 'none');
  assert.equal(classify([]).name, 'none');
  assert.equal(classify(new Array(10)).name, 'none');
});

it('classify() correctly recognizes PINCH with continuous normalized ratio', () => {
  const lm = makeMockHand();
  // In a pinch, fingers (e.g. middle/ring/pinky) are open or index is in pinch position
  extendFinger(lm, 12, 10, 0.25);
  // Place thumb tip 4 and index tip 8 very close together (distance 0.03 vs palm 0.3 = ratio 0.10)
  lm[4] = { x: 0.45, y: 0.50, z: 0.0 };
  lm[8] = { x: 0.46, y: 0.51, z: 0.0 };
  const g = classify(lm);
  assert.equal(g.name, 'pinch');
  assert(g.pinch < 0.35, `Expected pinch < 0.35, got ${g.pinch}`);
  assert(g.normRatio >= 0.0 && g.normRatio <= 1.0, `Expected normRatio in [0, 1], got ${g.normRatio}`);
});

it('classify() correctly recognizes FIST (all 4 fingers curled, thumb tucked)', () => {
  const lm = makeMockHand();
  // Keep all fingers curled close to palm, thumb tucked
  lm[4] = { x: 0.44, y: 0.74, z: 0.0 };
  const g = classify(lm);
  assert.equal(g.name, 'fist');
});

it('classify() correctly recognizes THUMBS UP (thumb up, 4 fingers curled)', () => {
  const lm = makeMockHand();
  // Extend thumb upward above palm: 4 above 3, 3 above 2
  lm[1] = { x: 0.45, y: 0.70, z: 0.0 };
  lm[2] = { x: 0.42, y: 0.60, z: 0.0 };
  lm[3] = { x: 0.38, y: 0.45, z: 0.0 };
  lm[4] = { x: 0.35, y: 0.30, z: 0.0 };
  const g = classify(lm);
  assert.equal(g.name, 'thumbs_up');
});

it('classify() correctly recognizes PEACE / V-SIGN (Index & Middle extended, others curled)', () => {
  const lm = makeMockHand();
  // Separate thumb from index tip to avoid pinch trigger
  lm[4] = { x: 0.25, y: 0.65, z: 0.0 };
  extendFinger(lm, 8, 6, 0.25);   // Extend Index
  extendFinger(lm, 12, 10, 0.25); // Extend Middle
  const g = classify(lm);
  assert.equal(g.name, 'peace');
});

it('classify() correctly recognizes THREE FINGERS (Index, Middle, Ring extended)', () => {
  const lm = makeMockHand();
  lm[4] = { x: 0.25, y: 0.65, z: 0.0 };
  extendFinger(lm, 8, 6, 0.25);   // Extend Index
  extendFinger(lm, 12, 10, 0.25); // Extend Middle
  extendFinger(lm, 16, 14, 0.25); // Extend Ring
  const g = classify(lm);
  assert.equal(g.name, 'three');
});

it('classify() correctly recognizes POINT (Index extended alone)', () => {
  const lm = makeMockHand();
  lm[4] = { x: 0.25, y: 0.65, z: 0.0 };
  extendFinger(lm, 8, 6, 0.25);   // Extend Index only
  const g = classify(lm);
  assert.equal(g.name, 'point');
});

it('classify() correctly recognizes OPEN PALM (all fingers extended)', () => {
  const lm = makeMockHand();
  lm[4] = { x: 0.25, y: 0.40, z: 0.0 };
  extendFinger(lm, 8, 6, 0.20);
  extendFinger(lm, 12, 10, 0.18);
  extendFinger(lm, 16, 14, 0.22);
  extendFinger(lm, 20, 18, 0.26);
  const g = classify(lm);
  assert.equal(g.name, 'open');
});

// -----------------------------------------------------------------------------
// SUITE 3: Skeleton Canvas Renderer & Swipe Detector
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 3: Canvas Skeleton Drawing & Swipe Dynamics ---');

it('drawHandSkeleton() handles canvas draw calls safely without throwing', () => {
  const calls = [];
  const mockCtx = {
    canvas: { width: 640, height: 480 },
    clearRect: (...args) => calls.push(['clearRect', ...args]),
    save: () => calls.push(['save']),
    restore: () => calls.push(['restore']),
    beginPath: () => calls.push(['beginPath']),
    moveTo: (...args) => calls.push(['moveTo', ...args]),
    lineTo: (...args) => calls.push(['lineTo', ...args]),
    arc: (...args) => calls.push(['arc', ...args]),
    fill: () => calls.push(['fill']),
    stroke: () => calls.push(['stroke']),
    set lineWidth(v) {},
    set lineCap(v) {},
    set lineJoin(v) {},
    set strokeStyle(v) {},
    set fillStyle(v) {},
    set shadowColor(v) {},
    set shadowBlur(v) {}
  };

  const lm = makeMockHand();
  drawHandSkeleton(mockCtx, lm, { name: 'open' });
  assert(calls.length > 50, `Expected >50 draw operations, got ${calls.length}`);
  assert.equal(calls[0][0], 'clearRect');
});

it('Swipe class detects horizontal velocity over window and handles cooldown', () => {
  const swipe = new Swipe(350, 0.20, 800);
  assert.equal(swipe.push(0.3, 1000), 0);
  assert.equal(swipe.push(0.35, 1050), 0);
  // Fast sweep to 0.60 (dx = +0.30 > 0.20): returns -1 due to video mirror
  assert.equal(swipe.push(0.60, 1100), -1);
  // In cooldown period: should return 0
  assert.equal(swipe.push(0.10, 1200), 0);
});

// -----------------------------------------------------------------------------
// SUITE 4: Performance Tier Modes (Light vs Full)
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 4: Performance Tier Application ---');

it('createVolumetricFire supports dynamic raymarching steps via setPerfTier()', () => {
  const fire = createVolumetricFire({ x: 0, y: 0, z: 0 }, 5.0);
  assert(fire && fire.material && fire.material.defines);
  assert.equal(fire.material.defines.STEPS, 16, 'Default steps should be 16 (Light Mode)');

  fire.setPerfTier('full');
  assert.equal(fire.material.defines.STEPS, 36, 'Full mode steps should be 36');

  fire.setPerfTier('light');
  assert.equal(fire.material.defines.STEPS, 16, 'Light mode steps should return to 16');

  fire.dispose();
});

it('createEmbers and createSmokePlume support dynamic setMaxActive() without reallocating buffers', () => {
  const embers = createEmbers({ x: 0, y: 0, z: 0 }, 450);
  assert(typeof embers.setMaxActive === 'function');
  embers.setMaxActive(180);
  assert.equal(embers.mesh.count, 180, 'Light mode ember count should be clamped to 180');
  embers.setMaxActive(450);
  assert.equal(embers.mesh.count, 450, 'Full mode ember count should be 450');
  embers.dispose();

  const smoke = createSmokePlume({ x: 0, y: 0, z: 0 }, 320);
  assert(typeof smoke.setMaxActive === 'function');
  smoke.setMaxActive(120);
  assert.equal(smoke.mesh.count, 120, 'Light mode smoke puff count should be 120');
  smoke.setMaxActive(320);
  assert.equal(smoke.mesh.count, 320, 'Full mode smoke puff count should be 320');
  smoke.dispose();
});

it('applyPerfTier() correctly orchestrates light mode (DPR 1.0, shadow off, steps 16)', () => {
  let pixelRatioSet = null;
  let shadowMapEnabled = null;

  const mockRenderer = {
    setPixelRatio: (dpr) => { pixelRatioSet = dpr; },
    shadowMap: { enabled: true }
  };
  const mockFire = {
    setPerfTier: (m) => { mockFire.tier = m; }
  };
  const mockEmbers = {
    setMaxActive: (n) => { mockEmbers.count = n; }
  };
  const mockSmoke = {
    setMaxActive: (n) => { mockSmoke.count = n; }
  };

  const mockWorld = {
    renderer: mockRenderer,
    fire: mockFire,
    embers: mockEmbers,
    smoke: mockSmoke
  };

  // 1. Apply Light mode
  applyPerfTier(mockWorld, 'light');
  assert.equal(mockWorld.perfMode, 'light');
  assert.equal(pixelRatioSet, 1.0, 'DPR should be 1.0 in Light mode');
  assert.equal(mockRenderer.shadowMap.enabled, false, 'Shadow map should be disabled in Light mode');
  assert.equal(mockFire.tier, 'light');
  assert.equal(mockEmbers.count, 180);
  assert.equal(mockSmoke.count, 120);

  // 2. Apply Full mode
  applyPerfTier(mockWorld, 'full');
  assert.equal(mockWorld.perfMode, 'full');
  assert.equal(mockRenderer.shadowMap.enabled, true, 'Shadow map should be enabled in Full mode');
  assert.equal(mockFire.tier, 'full');
  assert.equal(mockEmbers.count, 450);
  assert.equal(mockSmoke.count, 320);
});

console.log('\n======================================================================');
console.log(`TOTAL TESTS: ${total} | PASSED: ${passed} | FAILED: ${total - passed}`);
console.log('======================================================================');
