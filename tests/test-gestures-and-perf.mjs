// ==============================================================================
// TEST SUITE: 2-Stage Hand & Gesture Detection, Voice Actions, & Perf Tiers
// ==============================================================================

import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  HAND_CONNECTIONS,
  FINGERTIP_INDICES,
  detectHand,
  classify,
  GestureStabilizer,
  drawHandSkeleton,
  drawScanningReticle,
  Swipe
} from '../js/gestures.js';
import {
  parseVoiceCommand,
  parseVoiceCommands,
  buildNarrationScript,
  VOICE_COMMAND_GUIDE
} from '../js/voice-controller.js';
import { createVolumetricFire, createEmbers, createSmokePlume } from '../js/volumetric-fire.js';
import { applyPerfTier, setWindMultiplier } from '../js/scene.js';

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
console.log('   TEST SUITE: 2-STAGE HAND/GESTURE, VOICE ACTIONS & PERF TIERS       ');
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
// SUITE 1: Skeleton Topology & Stage-1 Hand Detection
// -----------------------------------------------------------------------------
console.log('--- SUITE 1: Skeleton Topology & Stage-1 Hand Detector ---');

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

it('detectHand() handles null, truncated, or NaN landmark arrays safely', () => {
  assert.equal(detectHand(null).detected, false);
  assert.equal(detectHand([]).detected, false);
  const bad = makeMockHand();
  bad[5] = { x: NaN, y: 0.5 };
  assert.equal(detectHand(bad).detected, false);
});

it('detectHand() extracts bounding box, palmCenter, handedness, and 5-finger states', () => {
  const lm = makeMockHand();
  extendFinger(lm, 8, 6, 0.20);  // Index
  extendFinger(lm, 12, 10, 0.18); // Middle
  const h = detectHand(lm, { handedness: 'Right', score: 0.98 });
  assert.equal(h.detected, true);
  assert.equal(h.handedness, 'Right');
  assert.equal(h.confidence, 98);
  assert.equal(h.fingers.index, true);
  assert.equal(h.fingers.middle, true);
  assert.equal(h.fingers.ring, false);
  assert.equal(h.fingers.pinky, false);
  assert(h.bbox.width > 0 && h.bbox.height > 0);
  assert(h.palmCenter && typeof h.palmCenter.x === 'number');
});

// -----------------------------------------------------------------------------
// SUITE 2: Stage-2 Multi-Gesture Recognition Matrix & Stabilizer
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 2: Stage-2 Multi-Gesture Recognition Matrix ---');

it('classify() handles null, empty, or truncated landmark arrays gracefully', () => {
  assert.equal(classify(null).name, 'none');
  assert.equal(classify([]).name, 'none');
  assert.equal(classify(new Array(10)).name, 'none');
});

it('classify() correctly recognizes PINCH with continuous normalized ratio', () => {
  const lm = makeMockHand();
  extendFinger(lm, 12, 10, 0.25);
  lm[4] = { x: 0.45, y: 0.50, z: 0.0 };
  lm[8] = { x: 0.46, y: 0.51, z: 0.0 };
  const g = classify(lm);
  assert.equal(g.name, 'pinch');
  assert(g.pinch < 0.35, `Expected pinch < 0.35, got ${g.pinch}`);
  assert(g.normRatio >= 0.0 && g.normRatio <= 1.0, `Expected normRatio in [0, 1], got ${g.normRatio}`);
});

it('classify() correctly recognizes FIST (all 4 fingers curled, thumb tucked)', () => {
  const lm = makeMockHand();
  lm[4] = { x: 0.44, y: 0.74, z: 0.0 };
  const g = classify(lm);
  assert.equal(g.name, 'fist');
});

it('classify() correctly recognizes THUMBS UP (thumb up, 4 fingers curled)', () => {
  const lm = makeMockHand();
  lm[1] = { x: 0.45, y: 0.70, z: 0.0 };
  lm[2] = { x: 0.42, y: 0.60, z: 0.0 };
  lm[3] = { x: 0.38, y: 0.45, z: 0.0 };
  lm[4] = { x: 0.35, y: 0.30, z: 0.0 };
  const g = classify(lm);
  assert.equal(g.name, 'thumbs_up');
});

it('classify() correctly recognizes PEACE / V-SIGN (Index & Middle extended, others curled)', () => {
  const lm = makeMockHand();
  lm[4] = { x: 0.25, y: 0.65, z: 0.0 };
  extendFinger(lm, 8, 6, 0.25);
  extendFinger(lm, 12, 10, 0.25);
  const g = classify(lm);
  assert.equal(g.name, 'peace');
});

it('classify() correctly recognizes THREE FINGERS (Index, Middle, Ring extended)', () => {
  const lm = makeMockHand();
  lm[4] = { x: 0.25, y: 0.65, z: 0.0 };
  extendFinger(lm, 8, 6, 0.25);
  extendFinger(lm, 12, 10, 0.25);
  extendFinger(lm, 16, 14, 0.25);
  const g = classify(lm);
  assert.equal(g.name, 'three');
});

it('classify() correctly recognizes POINT (Index extended alone)', () => {
  const lm = makeMockHand();
  lm[4] = { x: 0.25, y: 0.65, z: 0.0 };
  extendFinger(lm, 8, 6, 0.25);
  const g = classify(lm);
  assert.equal(g.name, 'point');
});

it('classify() correctly recognizes ROCK SIGN (Index + Pinky extended, Middle & Ring curled)', () => {
  const lm = makeMockHand();
  lm[4] = { x: 0.25, y: 0.65, z: 0.0 };
  extendFinger(lm, 8, 6, 0.25);   // Index
  extendFinger(lm, 20, 18, 0.25); // Pinky
  const g = classify(lm);
  assert.equal(g.name, 'rock');
});

it('classify() correctly recognizes CALL_ME / SHAKA (Thumb + Pinky extended)', () => {
  const lm = makeMockHand();
  lm[1] = { x: 0.45, y: 0.70, z: 0.0 };
  lm[2] = { x: 0.42, y: 0.60, z: 0.0 };
  lm[3] = { x: 0.38, y: 0.45, z: 0.0 };
  lm[4] = { x: 0.35, y: 0.30, z: 0.0 }; // Thumb up
  extendFinger(lm, 20, 18, 0.25);        // Pinky extended
  const g = classify(lm);
  assert.equal(g.name, 'call_me');
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

it('GestureStabilizer enforces 2-stage hand lock before firing gesture', () => {
  const stab = new GestureStabilizer(2, 2);
  const lmPeace = makeMockHand();
  lmPeace[4] = { x: 0.25, y: 0.65, z: 0.0 };
  extendFinger(lmPeace, 8, 6, 0.25);
  extendFinger(lmPeace, 12, 10, 0.25);

  // Frame 1: hand detected, not yet locked
  const f1 = stab.update(lmPeace);
  assert.equal(f1.hand.detected, true);
  assert.equal(f1.handLocked, false);
  assert.equal(f1.gesture.name, 'hand_detected');

  // Frame 2: hand locked, Stage-2 stabilizing (must NOT emit discrete gesture on frame 1 of Stage-2!)
  const f2 = stab.update(lmPeace);
  assert.equal(f2.handLocked, true);
  assert.equal(f2.rawGesture.name, 'peace');
  assert.equal(f2.gesture.name, 'hand_detected');
  assert.equal(f2.gesture.candidate, 'peace');
  assert.equal(f2.stability, 0.5);

  // Frame 3: stable gesture confirmed
  const f3 = stab.update(lmPeace);
  assert.equal(f3.gesture.name, 'peace');
  assert.equal(f3.stability, 1.0);

  // Hand leaves frame
  const f4 = stab.update(null);
  assert.equal(f4.hand.detected, false);
  assert.equal(f4.handLocked, false);
});

it('GestureStabilizer prevents 1-frame noisy discrete gesture misfire and coordinate jerk from open palm', () => {
  const stab = new GestureStabilizer(2, 2);
  const lmOpen = makeMockHand();
  lmOpen[4] = { x: 0.25, y: 0.40, z: 0.0 };
  extendFinger(lmOpen, 8, 6, 0.20);
  extendFinger(lmOpen, 12, 10, 0.18);
  extendFinger(lmOpen, 16, 14, 0.22);
  extendFinger(lmOpen, 20, 18, 0.26);

  const lmFist = makeMockHand();
  lmFist[4] = { x: 0.44, y: 0.74, z: 0.0 };

  // Frame 1: hand enters frame
  stab.update(lmOpen);
  // Frame 2: 1-frame noisy fist while hand locks
  const noisy = stab.update(lmFist);
  assert.equal(noisy.handLocked, true);
  assert.notEqual(noisy.gesture.name, 'fist', '1-frame noisy fist must not fire before minGestureFrames');

  // Frame 3: open palm is continuous and locks immediately
  const openLocked = stab.update(lmOpen);
  assert.equal(openLocked.gesture.name, 'open');

  // Frame 4: user starts curling into fist (frame 1 of fist) -> must not claim gesture is still 'open' with fist coords
  const curling = stab.update(lmFist);
  assert.equal(curling.gesture.name, 'hand_detected');
  assert.equal(curling.gesture.candidate, 'fist');
});

// -----------------------------------------------------------------------------
// SUITE 3: Canvas Skeleton Drawing, Scanning Reticle & Swipe Detector
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 3: Canvas Skeleton Drawing & Swipe Dynamics ---');

it('drawHandSkeleton() and drawScanningReticle() handle canvas draw calls safely', () => {
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

  drawScanningReticle(mockCtx);
  assert(calls.length > 5, 'Expected reticle draw calls');

  calls.length = 0;
  const lm = makeMockHand();
  drawHandSkeleton(mockCtx, lm, { name: 'open' });
  assert(calls.length > 50, `Expected >50 draw operations, got ${calls.length}`);
  assert.equal(calls[0][0], 'clearRect');
});

it('Swipe class detects horizontal velocity over window and handles cooldown', () => {
  const swipe = new Swipe(350, 0.20, 800);
  assert.equal(swipe.push(0.3, 1000), 0);
  assert.equal(swipe.push(0.35, 1050), 0);
  assert.equal(swipe.push(0.60, 1100), -1);
  assert.equal(swipe.push(0.10, 1200), 0);
});

// -----------------------------------------------------------------------------
// SUITE 4: Natural-Language Voice Command Parser & Narration
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 4: Voice Actions & Scientific Narration ---');

it('parseVoiceCommand() distinguishes "With camera" vs "Without camera"', () => {
  const withCam = parseVoiceCommand('Turn on with camera mode please');
  assert.equal(withCam.matched, true);
  assert.equal(withCam.intent, 'setCameraMode');
  assert.equal(withCam.param, 'with-camera');

  const withoutCam = parseVoiceCommand('Switch to without camera');
  assert.equal(withoutCam.matched, true);
  assert.equal(withoutCam.intent, 'setCameraMode');
  assert.equal(withoutCam.param, 'without-camera');

  const noCam = parseVoiceCommand('camera off');
  assert.equal(noCam.intent, 'setCameraMode');
  assert.equal(noCam.param, 'without-camera');

  assert.equal(parseVoiceCommand('turn on camera').param, 'with-camera');
  assert.equal(parseVoiceCommand('turn off camera').param, 'without-camera');
  assert.equal(parseVoiceCommand('turn off skeleton').param, false);
  assert.equal(parseVoiceCommand('stop auto tour').param, false);
  assert.equal(parseVoiceCommand('turn off zen mode').param, false);
});

it('parseVoiceCommand() disambiguates "sensible heat flux" / "latent heat flux" from Flux stratum and parses compound utterances', () => {
  assert.deepEqual(
    { i: parseVoiceCommand('sensible heat flux').intent, p: parseVoiceCommand('sensible heat flux').param },
    { i: 'setVar', p: 'SH' }
  );
  assert.deepEqual(
    { i: parseVoiceCommand('latent heat flux').intent, p: parseVoiceCommand('latent heat flux').param },
    { i: 'setVar', p: 'LH' }
  );
  assert.deepEqual(
    { i: parseVoiceCommand('carbon flux').intent, p: parseVoiceCommand('carbon flux').param },
    { i: 'setVar', p: 'GPP' }
  );

  const compound = parseVoiceCommand('without camera explode during fire');
  assert.equal(compound.matched, true);
  assert.equal(compound.actions.length, 3);
  assert.deepEqual(
    compound.actions.map(a => `${a.intent}:${a.param}`),
    ['setCameraMode:without-camera', 'setExplode:1', 'setPhase:1']
  );
  assert.equal(parseVoiceCommands('similipal during fire wind boost').length, 3);
});

it('parseVoiceCommand() parses dissection, phases, strata, variables, sites & boost commands', () => {
  assert.deepEqual(
    { i: parseVoiceCommand('explode layers').intent, p: parseVoiceCommand('explode layers').param },
    { i: 'setExplode', p: 1.0 }
  );
  assert.deepEqual(
    { i: parseVoiceCommand('assemble').intent, p: parseVoiceCommand('assemble').param },
    { i: 'setExplode', p: 0.0 }
  );
  assert.deepEqual(
    { i: parseVoiceCommand('during fire').intent, p: parseVoiceCommand('during fire').param },
    { i: 'setPhase', p: 1 }
  );
  assert.deepEqual(
    { i: parseVoiceCommand('solo canopy').intent, p: parseVoiceCommand('solo canopy').param },
    { i: 'setSoloStratum', p: 2 }
  );
  assert.deepEqual(
    { i: parseVoiceCommand('show duff').intent, p: parseVoiceCommand('show duff').param },
    { i: 'setSoloStratum', p: 5 }
  );
  assert.deepEqual(
    { i: parseVoiceCommand('sensible heat').intent, p: parseVoiceCommand('sensible heat').param },
    { i: 'setVar', p: 'SH' }
  );
  assert.deepEqual(
    { i: parseVoiceCommand('bandhavgarh').intent, p: parseVoiceCommand('bandhavgarh').param },
    { i: 'setSiteById', p: 'bandhavgarh' }
  );
  assert.equal(parseVoiceCommand('wind boost').intent, 'setWindBoost');
  assert.equal(parseVoiceCommand('start tour').intent, 'setTour');
  assert.equal(parseVoiceCommand('narrate findings').intent, 'narrate');
  assert.equal(parseVoiceCommand('full mode').param, 'full');
  assert.equal(parseVoiceCommand('light mode').param, 'light');
});

it('parseVoiceCommand() handles empty, null, or unrecognized phrases safely', () => {
  assert.equal(parseVoiceCommand(null).matched, false);
  assert.equal(parseVoiceCommand('   ').matched, false);
  assert.equal(parseVoiceCommand('abracadabra xyz').matched, false);
  assert(VOICE_COMMAND_GUIDE.length >= 4);
});

it('buildNarrationScript() generates scientific audio briefing with Bowen ratio', () => {
  const script = buildNarrationScript({
    site: { name: 'Similipal BR, Odisha' },
    phaseKey: 'during',
    phaseLabel: 'During fire',
    variable: 'SH',
    varMeta: { label: 'Sensible heat flux', unit: 'W m-2' },
    values: { SH: 100, LH: 50, GPP: 3, ET: 2, VPD: 4, AOD: 1.2 },
    explode: 0.75
  });
  assert(script.includes('Similipal BR, Odisha'));
  assert(script.includes('2.00'), 'Should compute Bowen ratio 100/50 = 2.00');
  assert(script.includes('75 percent'));
});

// -----------------------------------------------------------------------------
// SUITE 5: Performance Tier & Wind Boost Application
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 5: Performance Tier & Wind Boost Application ---');

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

it('applyPerfTier() and setWindMultiplier() orchestrate scene settings accurately', () => {
  let pixelRatioSet = null;
  const mockRenderer = {
    setPixelRatio: (dpr) => { pixelRatioSet = dpr; },
    shadowMap: { enabled: true }
  };
  const mockFire = { setPerfTier: (m) => { mockFire.tier = m; } };
  const mockEmbers = { setMaxActive: (n) => { mockEmbers.count = n; } };
  const mockSmoke = { setMaxActive: (n) => { mockSmoke.count = n; } };

  const mockWorld = {
    renderer: mockRenderer,
    fire: mockFire,
    embers: mockEmbers,
    smoke: mockSmoke,
    windMultiplier: 1.0
  };

  applyPerfTier(mockWorld, 'light');
  assert.equal(mockWorld.perfMode, 'light');
  assert.equal(pixelRatioSet, 1.0);
  assert.equal(mockRenderer.shadowMap.enabled, false);

  applyPerfTier(mockWorld, 'full');
  assert.equal(mockWorld.perfMode, 'full');
  assert.equal(mockRenderer.shadowMap.enabled, true);

  assert.equal(setWindMultiplier(mockWorld, 2.5), 2.5);
  assert.equal(mockWorld.windMultiplier, 2.5);
  assert.equal(setWindMultiplier(mockWorld, 99), 4.0, 'Should clamp max wind multiplier to 4.0');
  assert.equal(setWindMultiplier(mockWorld, 0.01), 0.2, 'Should clamp min wind multiplier to 0.2');
});

// -----------------------------------------------------------------------------
// SUITE 6: DOM Camera/No-Camera Options, 2-Stage Pipeline UI & Asset Sync
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 6: DOM Camera Options, 2-Stage Pipeline UI & Asset Sync ---');

it('index.html contains explicit With Camera and Without Camera buttons, 2-stage pipeline, and Voice drawer', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert(html.includes('id="withCamBtn"'), 'Missing #withCamBtn');
  assert(html.includes('id="withoutCamBtn"'), 'Missing #withoutCamBtn');
  assert(html.includes('id="stage1Step"'), 'Missing #stage1Step (Hand detection step)');
  assert(html.includes('id="fingerMatrix"'), 'Missing #fingerMatrix (5-finger extension pills)');
  assert(html.includes('id="stage2Step"'), 'Missing #stage2Step (Gesture recognition step)');
  assert(html.includes('id="voiceToggleBtn"'), 'Missing #voiceToggleBtn');
  assert(html.includes('id="voicePanel"'), 'Missing #voicePanel');
  assert(html.includes('id="windBoostBtn"'), 'Missing #windBoostBtn');
  assert(html.includes('id="tourToggleBtn"'), 'Missing #tourToggleBtn');
  assert(html.includes('id="snapshotBtn"'), 'Missing #snapshotBtn');
});

it('js/voice-controller.js is mirrored identically into app/src/main/assets/web/js/voice-controller.js', () => {
  const s1 = fs.readFileSync('js/voice-controller.js', 'utf8');
  const s2 = fs.readFileSync('app/src/main/assets/web/js/voice-controller.js', 'utf8');
  assert.equal(s1, s2, 'voice-controller.js must match Android asset copy');
});

console.log('\n======================================================================');
console.log(`TOTAL TESTS: ${total} | PASSED: ${passed} | FAILED: ${total - passed}`);
console.log('======================================================================');
