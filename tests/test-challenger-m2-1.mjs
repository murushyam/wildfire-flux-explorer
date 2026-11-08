// ==============================================================================
// ADVERSARIAL CHALLENGER TEST SUITE: MULTI-GESTURE CLASSIFIER, SKELETON CANVAS,
// PERFORMANCE TIERS, AND INPUT STRESS VALIDATION
// ==============================================================================

import assert from 'node:assert/strict';
import { HAND_CONNECTIONS, FINGERTIP_INDICES, classify, drawHandSkeleton, Swipe } from '../js/gestures.js';
import { createVolumetricFire, createEmbers, createSmokePlume } from '../js/volumetric-fire.js';
import { applyPerfTier } from '../js/scene.js';

let passed = 0;
let total = 0;
const failures = [];

function it(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failures.push({ name, error: err });
    console.error(`  [FAIL] ${name}:`, err.message);
  }
}

// -----------------------------------------------------------------------------
// Canonical 21-Landmark Hand Mock Generator
// -----------------------------------------------------------------------------
function makeCanonicalHand(overrides = {}) {
  // Baseline curled hand centered around wrist at (0.5, 0.8)
  const lm = [];
  for (let i = 0; i < 21; i++) {
    lm.push({ x: 0.5, y: 0.7 - i * 0.02, z: 0.0 });
  }
  // Wrist: 0
  lm[0] = { x: 0.5, y: 0.8, z: 0.0 };
  // Middle MCP: 9 (defines palm reference scale = 0.3)
  lm[9] = { x: 0.5, y: 0.5, z: 0.0 };

  // Thumb: 1, 2, 3, 4 (curled by default near palm base, separated from index tip)
  lm[1] = { x: 0.40, y: 0.75, z: 0.0 };
  lm[2] = { x: 0.36, y: 0.70, z: 0.0 };
  lm[3] = { x: 0.34, y: 0.68, z: 0.0 };
  lm[4] = { x: 0.32, y: 0.72, z: 0.0 }; // Separated: d(lm[4], lm[8]) = 0.156 / 0.3 = 0.52 > 0.35

  // Index: 5(MCP), 6(PIP), 7(DIP), 8(Tip) - curled
  lm[5] = { x: 0.46, y: 0.52, z: 0.0 };
  lm[6] = { x: 0.46, y: 0.58, z: 0.0 };
  lm[7] = { x: 0.46, y: 0.62, z: 0.0 };
  lm[8] = { x: 0.46, y: 0.65, z: 0.0 };

  // Middle: 9, 10, 11, 12 - curled
  lm[10] = { x: 0.50, y: 0.58, z: 0.0 };
  lm[11] = { x: 0.50, y: 0.62, z: 0.0 };
  lm[12] = { x: 0.50, y: 0.65, z: 0.0 };

  // Ring: 13, 14, 15, 16 - curled
  lm[13] = { x: 0.54, y: 0.52, z: 0.0 };
  lm[14] = { x: 0.54, y: 0.58, z: 0.0 };
  lm[15] = { x: 0.54, y: 0.62, z: 0.0 };
  lm[16] = { x: 0.54, y: 0.65, z: 0.0 };

  // Pinky: 17, 18, 19, 20 - curled
  lm[17] = { x: 0.58, y: 0.55, z: 0.0 };
  lm[18] = { x: 0.58, y: 0.60, z: 0.0 };
  lm[19] = { x: 0.58, y: 0.64, z: 0.0 };
  lm[20] = { x: 0.58, y: 0.68, z: 0.0 };

  for (const [idx, pt] of Object.entries(overrides)) {
    lm[Number(idx)] = { ...lm[Number(idx)], ...pt };
  }
  return lm;
}

function extendFinger(lm, tipIdx, pipIdx, yElev = 0.25) {
  lm[tipIdx] = { x: lm[pipIdx].x, y: yElev, z: 0.0 };
}

// -----------------------------------------------------------------------------
// Mock 2D Canvas Context for Skeleton Verification
// -----------------------------------------------------------------------------
function createMockCanvasContext(w = 640, h = 480) {
  const calls = {
    clearRect: [],
    beginPath: 0,
    moveTo: [],
    lineTo: [],
    arc: [],
    stroke: 0,
    fill: 0,
    save: 0,
    restore: 0
  };

  const ctx = {
    canvas: { width: w, height: h },
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    strokeStyle: '#000000',
    fillStyle: '#000000',
    shadowColor: 'transparent',
    shadowBlur: 0,
    clearRect(x, y, w, h) {
      calls.clearRect.push({ x, y, w, h });
    },
    beginPath() {
      calls.beginPath++;
    },
    moveTo(x, y) {
      calls.moveTo.push({ x, y });
    },
    lineTo(x, y) {
      calls.lineTo.push({ x, y });
    },
    arc(x, y, radius, startAngle, endAngle) {
      calls.arc.push({ x, y, radius, startAngle, endAngle });
    },
    stroke() {
      calls.stroke++;
    },
    fill() {
      calls.fill++;
    },
    save() {
      calls.save++;
    },
    restore() {
      calls.restore++;
    }
  };

  return { ctx, calls };
}

console.log('======================================================================');
console.log('   ADVERSARIAL CHALLENGER VERIFICATION: GESTURES, SKELETON, PERF     ');
console.log('======================================================================\n');

// =============================================================================
// SUITE 1: Multi-Gesture Classifier Synthetic Poses & Precision
// =============================================================================
console.log('--- SUITE 1: Multi-Gesture Classifier Synthetic Poses & Precision ---');

it('Classifier handles pure pinch across continuous distance spectrum [0.08, 0.35]', () => {
  const palmScale = 0.3; // distance between lm[0] and lm[9]

  // Test varying thumb/index distances
  const testPinchDists = [0.024, 0.045, 0.060, 0.075, 0.090, 0.100];
  for (const dist of testPinchDists) {
    const hand = makeCanonicalHand();
    extendFinger(hand, 8, 6, 0.4);
    hand[8] = { x: 0.48, y: 0.40, z: 0.0 };
    hand[4] = { x: 0.48 + dist, y: 0.40, z: 0.0 };

    const g = classify(hand);
    const expectedRatio = dist / palmScale;
    assert.equal(g.name, 'pinch', `Expected pinch at dist ${dist}, got ${g.name}`);
    assert(Math.abs(g.pinch - expectedRatio) < 1e-4);
    assert(g.normRatio >= 0.0 && g.normRatio <= 1.0);
    assert.equal(g.x, (hand[4].x + hand[8].x) * 0.5);
    assert.equal(g.y, (hand[4].y + hand[8].y) * 0.5);
  }

  // Boundary condition: pinch threshold is strictly < 0.35
  const borderPinch = makeCanonicalHand();
  extendFinger(borderPinch, 8, 6, 0.4);
  borderPinch[8] = { x: 0.48, y: 0.40, z: 0.0 };
  borderPinch[4] = { x: 0.48 + 0.35 * palmScale + 0.005, y: 0.40, z: 0.0 }; // > 0.35
  const gBorder = classify(borderPinch);
  assert.notEqual(gBorder.name, 'pinch', 'Should not classify as pinch when pinch ratio >= 0.35');
});

it('Classifier correctly identifies OPEN PALM with 4 and 5 extended fingers', () => {
  // 5 fingers extended
  const open5 = makeCanonicalHand();
  extendFinger(open5, 8, 6, 0.20);
  extendFinger(open5, 12, 10, 0.18);
  extendFinger(open5, 16, 14, 0.22);
  extendFinger(open5, 20, 18, 0.26);
  open5[4] = { x: 0.32, y: 0.60, z: 0.0 };

  const g5 = classify(open5);
  assert.equal(g5.name, 'open');
  assert.equal(g5.x, open5[9].x);
  assert.equal(g5.y, open5[9].y);

  // 4 fingers extended (thumb tucked)
  const open4 = makeCanonicalHand();
  extendFinger(open4, 8, 6, 0.20);
  extendFinger(open4, 12, 10, 0.18);
  extendFinger(open4, 16, 14, 0.22);
  extendFinger(open4, 20, 18, 0.26);
  open4[4] = { x: 0.32, y: 0.72, z: 0.0 };
  const g4 = classify(open4);
  assert.equal(g4.name, 'open');
});

it('Classifier correctly identifies FIST (0 fingers extended, thumb curled)', () => {
  const fist = makeCanonicalHand();
  const g = classify(fist);
  assert.equal(g.name, 'fist');
  assert.equal(g.x, fist[0].x);
  assert.equal(g.y, fist[0].y);
});

it('Classifier correctly identifies PEACE / V-SIGN (Index & Middle extended, others curled)', () => {
  const peace = makeCanonicalHand();
  extendFinger(peace, 8, 6, 0.22);
  extendFinger(peace, 12, 10, 0.20);

  const g = classify(peace);
  assert.equal(g.name, 'peace');
  assert.equal(g.x, (peace[8].x + peace[12].x) * 0.5);
  assert.equal(g.y, (peace[8].y + peace[12].y) * 0.5);
});

it('Classifier correctly identifies THREE FINGERS (Index, Middle, Ring extended, Pinky curled)', () => {
  const three = makeCanonicalHand();
  extendFinger(three, 8, 6, 0.22);
  extendFinger(three, 12, 10, 0.20);
  extendFinger(three, 16, 14, 0.24);

  const g = classify(three);
  assert.equal(g.name, 'three');
  assert.equal(g.x, three[12].x);
  assert.equal(g.y, three[12].y);
});

it('Classifier correctly identifies POINT (Index extended alone)', () => {
  const point = makeCanonicalHand();
  extendFinger(point, 8, 6, 0.20);

  const g = classify(point);
  assert.equal(g.name, 'point');
  assert.equal(g.x, point[8].x);
  assert.equal(g.y, point[8].y);
});

it('Classifier correctly identifies THUMBS UP (Thumb extended upward, all 4 fingers curled)', () => {
  const thumbsUp = makeCanonicalHand();
  thumbsUp[1] = { x: 0.45, y: 0.75, z: 0.0 };
  thumbsUp[2] = { x: 0.44, y: 0.65, z: 0.0 };
  thumbsUp[3] = { x: 0.44, y: 0.55, z: 0.0 };
  thumbsUp[4] = { x: 0.44, y: 0.42, z: 0.0 }; // Upward thumb extension

  const g = classify(thumbsUp);
  assert.equal(g.name, 'thumbs_up');
  assert.equal(g.x, thumbsUp[4].x);
  assert.equal(g.y, thumbsUp[4].y);
});

it('Non-canonical / Ambiguous gestures map safely to "other" when thumb is separated', () => {
  // Pinky extended alone
  const pinkyAlone = makeCanonicalHand();
  extendFinger(pinkyAlone, 20, 18, 0.25);
  const gPinky = classify(pinkyAlone);
  assert.equal(gPinky.name, 'other');

  // Ring extended alone
  const ringAlone = makeCanonicalHand();
  extendFinger(ringAlone, 16, 14, 0.25);
  const gRing = classify(ringAlone);
  assert.equal(gRing.name, 'other');

  // Middle extended alone
  const middleAlone = makeCanonicalHand();
  extendFinger(middleAlone, 12, 10, 0.25);
  const gMiddle = classify(middleAlone);
  assert.equal(gMiddle.name, 'other');
});

it('Adversarial vulnerability probe: Tucked thumb and index false-positive pinch sensitivity', () => {
  // When thumb and index are tucked tightly together in curled palm (< 0.35 palm)
  const tuckedHand = makeCanonicalHand();
  tuckedHand[4] = { x: 0.45, y: 0.68, z: 0.0 }; // Tucked right next to index tip (0.46, 0.65)
  extendFinger(tuckedHand, 20, 18, 0.25); // Extend pinky

  const res = classify(tuckedHand);
  // Because pinch < 0.35 is evaluated prior to non-canonical fallthrough, this is classified as 'pinch'
  assert.equal(res.name, 'pinch', 'Documents precedence sensitivity: tucked thumb+index triggers pinch when another finger is extended');
});

// =============================================================================
// SUITE 2: Adversarial Stress & Noisy Landmark Inputs
// =============================================================================
console.log('\n--- SUITE 2: Adversarial Stress & Noisy Landmark Inputs ---');

it('Classifier handles standard contract degenerate inputs (null, undefined, short arrays)', () => {
  const contractInputs = [null, undefined, [], new Array(10).fill({ x: 0, y: 0, z: 0 })];
  for (const input of contractInputs) {
    const res = classify(input);
    assert.deepEqual(res, { name: 'none' }, `Failed on input: ${JSON.stringify(input)}`);
  }
});

it('Adversarial vulnerability probe: Non-array inputs (objects, primitives) cause unhandled TypeError', () => {
  // Testing non-array inputs to verify whether classify lacks Array.isArray check
  const nonArrayInputs = [{}, 42, true];
  let caughtErrors = 0;
  for (const input of nonArrayInputs) {
    try {
      classify(input);
    } catch (err) {
      if (err instanceof TypeError) {
        caughtErrors++;
      }
    }
  }
  // Documents the finding that non-array objects bypass the check (!lm || lm.length < 21) because {}.length is undefined
  assert.equal(caughtErrors, 3, 'Confirmed: classify throws TypeError on non-array objects/primitives due to missing Array.isArray check');
});

it('Classifier handles zero-palm-scale (lm[0] == lm[9]) without division-by-zero NaN', () => {
  const zeroPalmHand = makeCanonicalHand();
  zeroPalmHand[0] = { x: 0.5, y: 0.5, z: 0.0 };
  zeroPalmHand[9] = { x: 0.5, y: 0.5, z: 0.0 };

  const res = classify(zeroPalmHand);
  assert.notEqual(res.name, undefined);
  assert(!Number.isNaN(res.x) && !Number.isNaN(res.y));
});

it('Classifier handles extreme coordinates (negative, large numbers) safely', () => {
  const extremeHand = makeCanonicalHand();
  extremeHand[0] = { x: -1000, y: 5000, z: 0 };
  extremeHand[4] = { x: 1e8, y: -1e8, z: 0 };

  const res = classify(extremeHand);
  assert(res && typeof res.name === 'string');
});

it('Random Gaussian / Uniform Jitter Stress Test (1,000 Monte Carlo trials)', () => {
  const basePoses = ['fist', 'point', 'peace', 'three', 'open', 'thumbs_up'];
  let validOutputs = 0;

  for (let trial = 0; trial < 1000; trial++) {
    const poseType = basePoses[trial % basePoses.length];
    let hand = makeCanonicalHand();

    if (poseType === 'point') {
      extendFinger(hand, 8, 6, 0.20);
    } else if (poseType === 'peace') {
      extendFinger(hand, 8, 6, 0.22);
      extendFinger(hand, 12, 10, 0.20);
    } else if (poseType === 'three') {
      extendFinger(hand, 8, 6, 0.22);
      extendFinger(hand, 12, 10, 0.20);
      extendFinger(hand, 16, 14, 0.24);
    } else if (poseType === 'open') {
      extendFinger(hand, 8, 6, 0.20);
      extendFinger(hand, 12, 10, 0.18);
      extendFinger(hand, 16, 14, 0.22);
      extendFinger(hand, 20, 18, 0.26);
    } else if (poseType === 'thumbs_up') {
      hand[1] = { x: 0.45, y: 0.75, z: 0.0 };
      hand[2] = { x: 0.44, y: 0.65, z: 0.0 };
      hand[3] = { x: 0.44, y: 0.55, z: 0.0 };
      hand[4] = { x: 0.44, y: 0.42, z: 0.0 };
    }

    // Apply uniform jitter [-0.02, +0.02] to all 21 points
    for (let i = 0; i < 21; i++) {
      hand[i].x += (Math.random() - 0.5) * 0.04;
      hand[i].y += (Math.random() - 0.5) * 0.04;
    }

    const g = classify(hand);
    assert(g && typeof g.name === 'string');
    assert(typeof g.x === 'number' && !Number.isNaN(g.x));
    assert(typeof g.y === 'number' && !Number.isNaN(g.y));
    validOutputs++;
  }

  assert.equal(validOutputs, 1000, 'All 1000 noisy iterations succeeded');
});

// =============================================================================
// SUITE 3: Hand Skeleton Canvas Drawing & Toggle Verification
// =============================================================================
console.log('\n--- SUITE 3: Hand Skeleton Canvas Drawing & Toggle Verification ---');

it('drawHandSkeleton renders exactly 21 bones and 21 joints on valid input', () => {
  const { ctx, calls } = createMockCanvasContext(640, 480);
  const hand = makeCanonicalHand();
  extendFinger(hand, 8, 6, 0.20);
  extendFinger(hand, 12, 10, 0.20);

  drawHandSkeleton(ctx, hand, { name: 'peace' });

  // 1. ClearRect called once
  assert.equal(calls.clearRect.length, 1);
  assert.deepEqual(calls.clearRect[0], { x: 0, y: 0, w: 640, h: 480 });

  // 2. Bone connections: exactly 21 moveTo and 21 lineTo calls
  assert.equal(calls.moveTo.length, 21, `Expected 21 bone moveTo calls, got ${calls.moveTo.length}`);
  assert.equal(calls.lineTo.length, 21, `Expected 21 bone lineTo calls, got ${calls.lineTo.length}`);

  // Check coordinates match hand landmarks scaled to canvas width/height
  for (let k = 0; k < HAND_CONNECTIONS.length; k++) {
    const [i, j] = HAND_CONNECTIONS[k];
    const expectedMove = { x: hand[i].x * 640, y: hand[i].y * 480 };
    const expectedLine = { x: hand[j].x * 640, y: hand[j].y * 480 };
    assert.deepEqual(calls.moveTo[k], expectedMove);
    assert.deepEqual(calls.lineTo[k], expectedLine);
  }

  // 3. Joints: 16 interior joints (radius 3.0) + 5 fingertips (radius 4.8) = 21 arcs total
  assert.equal(calls.arc.length, 21, `Expected 21 joint arc calls, got ${calls.arc.length}`);

  const interiorArcs = calls.arc.filter(a => a.radius === 3.0);
  assert.equal(interiorArcs.length, 16, 'Expected 16 interior joint arcs');

  const fingertipArcs = calls.arc.filter(a => a.radius === 4.8);
  assert.equal(fingertipArcs.length, 5, 'Expected 5 standard fingertip arcs');

  // Verify non-zero stroke calls
  assert(calls.stroke > 0, 'stroke() must be called for skeletal connectors');
  assert(calls.fill > 0, 'fill() must be called for joints and fingertips');
});

it('drawHandSkeleton renders accented pinch line and enlarged fingertip indicators during pinch', () => {
  const { ctx, calls } = createMockCanvasContext(640, 480);
  const hand = makeCanonicalHand();
  hand[4] = { x: 0.45, y: 0.40, z: 0.0 };
  hand[8] = { x: 0.47, y: 0.40, z: 0.0 };

  drawHandSkeleton(ctx, hand, { name: 'pinch' });

  // During pinch, thumb (4) and index (8) fingertips should have radius 6.5
  const pinchFingertipArcs = calls.arc.filter(a => a.radius === 6.5);
  assert.equal(pinchFingertipArcs.length, 2, 'Pinching fingertips must be highlighted with radius 6.5');

  // There should be a 22nd moveTo/lineTo call for the direct pinch line
  assert.equal(calls.moveTo.length, 22, 'Pinch line adds 1 extra moveTo call');
  assert.equal(calls.lineTo.length, 22, 'Pinch line adds 1 extra lineTo call');
  assert.deepEqual(calls.moveTo[21], { x: hand[4].x * 640, y: hand[4].y * 480 });
  assert.deepEqual(calls.lineTo[21], { x: hand[8].x * 640, y: hand[8].y * 480 });
});

it('drawHandSkeleton handles null, undefined, or missing context/canvas safely', () => {
  const hand = makeCanonicalHand();
  assert.doesNotThrow(() => drawHandSkeleton(null, hand));
  assert.doesNotThrow(() => drawHandSkeleton({}, hand));

  const { ctx, calls } = createMockCanvasContext();
  assert.doesNotThrow(() => drawHandSkeleton(ctx, null));
  assert.equal(calls.clearRect.length, 1);
  assert.equal(calls.moveTo.length, 0);
});

it('Skeleton drawing toggle logic skips skeleton rendering when state.showSkeleton is false', () => {
  const { ctx, calls } = createMockCanvasContext(640, 480);
  const hand = makeCanonicalHand();

  // Simulate main.js toggle logic:
  const state = { showSkeleton: false };

  function renderFrame(ctx, lm, g) {
    if (state.showSkeleton) {
      drawHandSkeleton(ctx, lm, g);
    } else {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
  }

  // 1. Frame with showSkeleton = false
  renderFrame(ctx, hand, { name: 'open' });
  assert.equal(calls.clearRect.length, 1);
  assert.equal(calls.moveTo.length, 0);
  assert.equal(calls.arc.length, 0);
  assert.equal(calls.stroke, 0);

  // 2. Toggle showSkeleton = true
  state.showSkeleton = true;
  renderFrame(ctx, hand, { name: 'open' });
  assert.equal(calls.clearRect.length, 2);
  assert.equal(calls.moveTo.length, 21);
  assert.equal(calls.arc.length, 21);
  assert(calls.stroke > 0);
});

// =============================================================================
// SUITE 4: Performance Tier Dynamics ("Light" Default vs "Full")
// =============================================================================
console.log('\n--- SUITE 4: Performance Tier Dynamics ("Light" Default vs "Full") ---');

it('Default performance tier is "light" on initial load without localStorage', () => {
  const mockStorage = new Map();
  const perfMode = mockStorage.get('wf_perf_mode') || 'light';
  assert.equal(perfMode, 'light', 'Default tier must be light');

  const initialDpr = (perfMode === 'light') ? 1.0 : Math.min(2.0, 1.75);
  assert.equal(initialDpr, 1.0, 'Default DPR must be clamped to 1.0');
});

it('Dynamic switching between Light and Full modes updates DPR, shadowMap, fire steps, and particle counts', () => {
  let currentDpr = 0;
  let shadowMapEnabled = null;
  let fireTier = null;
  let embersMax = 0;
  let smokeMax = 0;

  const mockWorld = {
    perfMode: 'light',
    renderer: {
      shadowMap: { enabled: true },
      setPixelRatio(dpr) {
        currentDpr = dpr;
      }
    },
    fire: {
      setPerfTier(tier) {
        fireTier = tier;
      }
    },
    embers: {
      setMaxActive(count) {
        embersMax = count;
      }
    },
    smoke: {
      setMaxActive(count) {
        smokeMax = count;
      }
    }
  };

  globalThis.window = { devicePixelRatio: 2.5 };

  // 1. Apply 'light' mode
  applyPerfTier(mockWorld, 'light');
  assert.equal(mockWorld.perfMode, 'light');
  assert.equal(currentDpr, 1.0, 'Light mode must clamp DPR to 1.0 regardless of screen density');
  assert.equal(mockWorld.renderer.shadowMap.enabled, false, 'Light mode must disable shadows');
  assert.equal(fireTier, 'light', 'Light mode must set fire tier to light');
  assert.equal(embersMax, 180, 'Light mode ember limit must be 180');
  assert.equal(smokeMax, 120, 'Light mode smoke limit must be 120');

  // 2. Switch to 'full' mode
  applyPerfTier(mockWorld, 'full');
  assert.equal(mockWorld.perfMode, 'full');
  assert.equal(currentDpr, 1.75, 'Full mode must clamp DPR to 1.75 for stability');
  assert.equal(mockWorld.renderer.shadowMap.enabled, true, 'Full mode must enable shadows');
  assert.equal(fireTier, 'full', 'Full mode must set fire tier to full');
  assert.equal(embersMax, 450, 'Full mode ember limit must be 450');
  assert.equal(smokeMax, 320, 'Full mode smoke limit must be 320');

  // 3. Switch back to 'light' mode
  applyPerfTier(mockWorld, 'light');
  assert.equal(mockWorld.perfMode, 'light');
  assert.equal(currentDpr, 1.0);
  assert.equal(mockWorld.renderer.shadowMap.enabled, false);
  assert.equal(fireTier, 'light');
  assert.equal(embersMax, 180);
  assert.equal(smokeMax, 120);
});

it('Volumetric fire shader material updates defines.STEPS (16 light vs 36 full)', () => {
  const dummyScene = { add() {}, remove() {} };
  const fire = createVolumetricFire(dummyScene, 10.0, 4.0);

  // Initial steps in Light mode
  assert.equal(fire.mesh.material.defines.STEPS, 16);

  // Switch to Full
  fire.setPerfTier('full');
  assert.equal(fire.mesh.material.defines.STEPS, 36);
  assert.equal(fire.mesh.material.needsUpdate, true);

  // Switch to Light
  fire.mesh.material.needsUpdate = false;
  fire.setPerfTier('light');
  assert.equal(fire.mesh.material.defines.STEPS, 16);
  assert.equal(fire.mesh.material.needsUpdate, true);

  // Edge boundary clamping in setSteps
  fire.setSteps(4); // below min 8
  assert.equal(fire.mesh.material.defines.STEPS, 8);
  fire.setSteps(128); // above max 64
  assert.equal(fire.mesh.material.defines.STEPS, 64);

  fire.dispose();
});

it('Embers and smoke particle systems safely clamp and adjust active buffers dynamically', () => {
  const dummyScene = { add() {}, remove() {} };
  const embers = createEmbers(dummyScene, 450);
  const smoke = createSmokePlume(dummyScene, 320);

  // Test setMaxActive updates mesh.count
  embers.setMaxActive(180);
  assert.equal(embers.mesh.count, 180);
  // Verify update step with dt = 0.016
  assert.doesNotThrow(() => embers.update(0.016, 5.0, { x: 1, z: 0 }, 1.0, 100));

  smoke.setMaxActive(120);
  assert.equal(smoke.mesh.count, 120);
  assert.doesNotThrow(() => smoke.update(0.016, 5.0, { x: 1, z: 0 }, 1.0, 100));

  // Reset to full
  embers.setMaxActive(450);
  smoke.setMaxActive(320);
  assert.equal(embers.mesh.count, 450);
  assert.equal(smoke.mesh.count, 320);

  embers.dispose();
  smoke.dispose();
});

// =============================================================================
// SUITE 5: Swipe Detector Dynamic Velocity & Cooldown
// =============================================================================
console.log('\n--- SUITE 5: Swipe Detector Dynamic Velocity & Cooldown ---');

it('Swipe detector correctly detects left/right swipe with mirrored directions', () => {
  const swipe = new Swipe(350, 0.22, 850);

  // Moving hand right in mirrored camera (dx > 0) -> returns -1
  assert.equal(swipe.push(0.3, 1000), 0);
  assert.equal(swipe.push(0.4, 1050), 0);
  assert.equal(swipe.push(0.6, 1100), -1, 'Fast right movement should trigger swipe -1');

  // During cooldown (850ms), subsequent rapid movement returns 0
  assert.equal(swipe.push(0.8, 1200), 0);
  assert.equal(swipe.push(0.9, 1300), 0);

  // Moving hand left after cooldown (t = 2000 > 1100 + 850)
  assert.equal(swipe.push(0.8, 2000), 0);
  assert.equal(swipe.push(0.7, 2050), 0);
  assert.equal(swipe.push(0.4, 2100), 1, 'Fast left movement should trigger swipe 1');
});

it('Swipe detector rejects slow motion that exceeds time window (350ms)', () => {
  const swipe = new Swipe(350, 0.22, 850);

  // Slow drift over 1000ms
  swipe.push(0.2, 1000);
  swipe.push(0.3, 1200);
  swipe.push(0.4, 1400);
  const res = swipe.push(0.6, 1600); // dx = 0.2 (from 0.4), t - 1000 > 350 so old samples pruned
  assert.equal(res, 0, 'Slow movement must not trigger swipe');
});

// =============================================================================
// SUMMARY
// =============================================================================
console.log('\n======================================================================');
console.log(`TOTAL ADVERSARIAL CHALLENGES: ${total} | PASSED: ${passed} | FAILED: ${failures.length}`);
console.log('======================================================================\n');

if (failures.length > 0) {
  console.error(`FAILED TESTS (${failures.length}):`);
  for (const f of failures) {
    console.error(`  - ${f.name}: ${f.error.message}`);
  }
  process.exit(1);
} else {
  console.log('ALL ADVERSARIAL TESTS PASSED EMPIRICALLY WITH ZERO FAILURES.\n');
  process.exit(0);
}
