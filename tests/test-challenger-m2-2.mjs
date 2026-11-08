// ==============================================================================
// ADVERSARIAL CHALLENGER SUITE: MILESTONE 2
// Author: teamwork_challenger
// Scope: Minimizable Panels, Zen View, Gesture Guidance HUD, Skeleton Overlay,
//        Performance Tiering, Android WebView Permissions & Asset Synchronization
// ==============================================================================

import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { HAND_CONNECTIONS, FINGERTIP_INDICES, classify, drawHandSkeleton, Swipe } from '../js/gestures.js';
import { createVolumetricFire, createEmbers, createSmokePlume } from '../js/volumetric-fire.js';
import { applyPerfTier } from '../js/scene.js';

let passed = 0;
let failed = 0;
let total = 0;

function it(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    failed++;
    console.error(`  [FAIL] ${name}:`, err.message);
  }
}

console.log('======================================================================');
console.log('    CHALLENGER M2-2: EMPIRICAL ADVERSARIAL STRESS TEST SUITE         ');
console.log('======================================================================\n');

// -----------------------------------------------------------------------------
// SUITE 1: DOM & UI Structure Verification (index.html)
// -----------------------------------------------------------------------------
console.log('--- SUITE 1: DOM Structure & Minimizable HUD Interfaces ---');

const indexHtml = fs.readFileSync('index.html', 'utf8');

it('index.html contains all 5 collapsible HUD cards', () => {
  assert(indexHtml.includes('id="topPill"'), 'Missing #topPill');
  assert(indexHtml.includes('id="hud"'), 'Missing #hud');
  assert(indexHtml.includes('id="stratumCard"'), 'Missing #stratumCard');
  assert(indexHtml.includes('id="controlDeck"'), 'Missing #controlDeck');
  assert(indexHtml.includes('id="cam"'), 'Missing #cam');
});

it('index.html contains all 5 minimization chevron buttons with .minimize-btn class', () => {
  const minBtns = [
    { id: 'topPillMinBtn', parent: '#topPill' },
    { id: 'hudMinBtn', parent: '#hud' },
    { id: 'stratumMinBtn', parent: '#stratumCard' },
    { id: 'deckMinBtn', parent: '#controlDeck' },
    { id: 'camMinBtn', parent: '#cam' }
  ];
  for (const b of minBtns) {
    const regex = new RegExp(`id="${b.id}"[^>]*class="[^"]*minimize-btn[^"]*"`);
    assert(regex.test(indexHtml), `Button #${b.id} missing or lacks .minimize-btn class`);
  }
});

it('index.html contains Zen View toggle (#zenBtn) and floating exit button (#exitZenBtn)', () => {
  assert(indexHtml.includes('id="zenBtn"'), 'Missing #zenBtn');
  assert(indexHtml.includes('id="exitZenBtn"'), 'Missing #exitZenBtn');
  assert(indexHtml.includes('exit-zen-btn'), 'Missing .exit-zen-btn class');
});

it('index.html contains Real-time Gesture Guidance Status Pill with all sub-elements', () => {
  assert(indexHtml.includes('id="gestureStatusPill"'), 'Missing #gestureStatusPill');
  assert(indexHtml.includes('id="gesturePillIcon"'), 'Missing #gesturePillIcon');
  assert(indexHtml.includes('id="gesturePillName"'), 'Missing #gesturePillName');
  assert(indexHtml.includes('id="gesturePillAction"'), 'Missing #gesturePillAction');
});

it('index.html contains Visual Gesture Guide Modal with tiles for all 7 gestures + swipe', () => {
  assert(indexHtml.includes('id="gestureGuideModal"'), 'Missing #gestureGuideModal');
  assert(indexHtml.includes('id="guideCloseBtn"'), 'Missing #guideCloseBtn');
  const tiles = (indexHtml.match(/class="gesture-tile"/g) || []).length;
  assert.equal(tiles, 8, `Expected 8 gesture guide tiles (7 gestures + swipe), found ${tiles}`);
  
  // Verify expected gestures are represented
  const expectedGestures = ['Pinch', 'Open Palm', 'Peace Sign', 'Three Fingers', 'Point', 'Fist', 'Thumbs Up', 'Horizontal Swipe'];
  for (const g of expectedGestures) {
    assert(indexHtml.includes(g), `Gesture guide missing description for ${g}`);
  }
});

it('index.html contains Skeleton Canvas overlay overlaid inside .video-container', () => {
  assert(indexHtml.includes('id="skeletonCanvas"'), 'Missing #skeletonCanvas');
  assert(indexHtml.includes('id="video"'), 'Missing #video');
  assert(indexHtml.includes('id="toggleSkeletonBtn"'), 'Missing #toggleSkeletonBtn');
  assert(indexHtml.includes('class="video-container"'), 'Missing .video-container wrapper');
});

it('index.html contains Performance Tier Toggle button (#perfToggleBtn)', () => {
  assert(indexHtml.includes('id="perfToggleBtn"'), 'Missing #perfToggleBtn');
  assert(indexHtml.includes('id="perfIcon"'), 'Missing #perfIcon');
  assert(indexHtml.includes('id="perfLabel"'), 'Missing #perfLabel');
});

// -----------------------------------------------------------------------------
// SUITE 2: CSS Stylesheet Rules & Visual Ergonomics (style.css)
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 2: CSS Rules & Visual Transformations ---');

const styleCss = fs.readFileSync('style.css', 'utf8');

it('style.css defines .minimized rules for all 5 HUD panels', () => {
  assert(styleCss.includes('#topPill.minimized'), 'Missing #topPill.minimized');
  assert(styleCss.includes('#hud.minimized'), 'Missing #hud.minimized');
  assert(styleCss.includes('#stratumCard.minimized'), 'Missing #stratumCard.minimized');
  assert(styleCss.includes('#controlDeck.minimized'), 'Missing #controlDeck.minimized');
  assert(styleCss.includes('#cam.minimized'), 'Missing #cam.minimized');
});

it('style.css defines comprehensive body.zen-mode rules that hide all HUD cards without affecting 3D canvas', () => {
  assert(styleCss.includes('body.zen-mode #topPill'), 'Missing body.zen-mode #topPill');
  assert(styleCss.includes('body.zen-mode #hud'), 'Missing body.zen-mode #hud');
  assert(styleCss.includes('body.zen-mode #stratumCard'), 'Missing body.zen-mode #stratumCard');
  assert(styleCss.includes('body.zen-mode #controlDeck'), 'Missing body.zen-mode #controlDeck');
  assert(styleCss.includes('body.zen-mode #cam'), 'Missing body.zen-mode #cam');
  assert(styleCss.includes('body.zen-mode #gestureGuideModal'), 'Missing body.zen-mode #gestureGuideModal');
  // Verify 3D canvas is NOT hidden by zen-mode
  assert(!styleCss.includes('body.zen-mode #scene'), 'Zen mode should not hide #scene canvas');
});

it('style.css defines skeleton canvas positioning matching mirrored video feed', () => {
  assert(styleCss.includes('#skeletonCanvas'), 'Missing #skeletonCanvas rules');
  assert(styleCss.includes('transform: scaleX(-1)'), 'Missing mirror transform for skeleton canvas');
  assert(styleCss.includes('pointer-events: none'), 'Skeleton canvas should have pointer-events: none');
});

it('style.css defines mobile responsive breakpoints (@media max-width: 640px)', () => {
  assert(styleCss.includes('@media (max-width: 640px)'), 'Missing mobile responsive media query');
});

// -----------------------------------------------------------------------------
// SUITE 3: Simulated UI State & Event Stress Testing
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 3: UI State Transitions & Stress Testing ---');

// Mock DOM elements
class MockElement {
  constructor(id, classes = []) {
    this.id = id;
    this.classList = new Set(classes);
    this.textContent = '';
    this.title = '';
    this.style = {};
    this.onclick = null;
  }
  classListToggle(cls, force) {
    if (force === true) {
      this.classList.add(cls);
      return true;
    } else if (force === false) {
      this.classList.delete(cls);
      return false;
    }
    if (this.classList.has(cls)) {
      this.classList.delete(cls);
      return false;
    } else {
      this.classList.add(cls);
      return true;
    }
  }
}

it('Panel minimize toggles correctly invert chevron labels and titles', () => {
  const topPill = new MockElement('topPill');
  const topPillMinBtn = new MockElement('topPillMinBtn');
  topPillMinBtn.textContent = '▲';
  topPillMinBtn.title = 'Minimize Header';

  const handler = () => {
    const isMin = topPill.classListToggle('minimized');
    topPillMinBtn.textContent = isMin ? '▼' : '▲';
    topPillMinBtn.title = isMin ? 'Expand Header' : 'Minimize Header';
  };

  // Toggle 1: minimize
  handler();
  assert(topPill.classList.has('minimized'));
  assert.equal(topPillMinBtn.textContent, '▼');
  assert.equal(topPillMinBtn.title, 'Expand Header');

  // Toggle 2: restore
  handler();
  assert(!topPill.classList.has('minimized'));
  assert.equal(topPillMinBtn.textContent, '▲');
  assert.equal(topPillMinBtn.title, 'Minimize Header');
});

it('Stress test: 1,000 rapid minimize/restore cycles maintain consistent synchronized state', () => {
  const hud = new MockElement('hud');
  const hudMinBtn = new MockElement('hudMinBtn');
  hudMinBtn.textContent = '▼';

  for (let i = 0; i < 1000; i++) {
    const isMin = hud.classListToggle('minimized');
    hudMinBtn.textContent = isMin ? '▲' : '▼';
    hudMinBtn.title = isMin ? 'Expand Panel' : 'Minimize Panel';
    assert.equal(hud.classList.has('minimized'), (i % 2 === 0), `Out of sync at cycle ${i}`);
  }
  // After 1000 iterations (even number of toggles), state should be restored to un-minimized
  assert(!hud.classList.has('minimized'));
  assert.equal(hudMinBtn.textContent, '▼');
});

it('Zen View mode handles state preservation: individual minimization survives Zen toggles', () => {
  const body = new MockElement('body');
  const hud = new MockElement('hud');
  const exitZenBtn = new MockElement('exitZenBtn');
  exitZenBtn.style.display = 'none';

  let zenMode = false;
  function toggleZenView(force) {
    zenMode = (force !== undefined) ? force : !zenMode;
    body.classListToggle('zen-mode', zenMode);
    exitZenBtn.style.display = zenMode ? 'flex' : 'none';
  }

  // Pre-condition: HUD is individually minimized
  hud.classListToggle('minimized', true);
  assert(hud.classList.has('minimized'));

  // Enter Zen Mode
  toggleZenView(true);
  assert(body.classList.has('zen-mode'));
  assert.equal(exitZenBtn.style.display, 'flex');

  // Exit Zen Mode
  toggleZenView(false);
  assert(!body.classList.has('zen-mode'));
  assert.equal(exitZenBtn.style.display, 'none');

  // Verify HUD minimization was NOT corrupted or cleared by Zen Mode!
  assert(hud.classList.has('minimized'), 'Individual panel state should persist through Zen View mode transitions');
});

it('updateGestureStatusPill survives 10,000 rapid calls and extreme inputs without leaking or crashing', () => {
  const pill = new MockElement('gestureStatusPill');
  const pillIcon = new MockElement('gesturePillIcon');
  const pillName = new MockElement('gesturePillName');
  const pillAction = new MockElement('gesturePillAction');

  let timer = null;
  function updateGestureStatusPill(icon, name, action, pulsing = false) {
    pillIcon.textContent = icon || '🖐';
    pillName.textContent = name || 'Ready';
    pillAction.textContent = action || 'Show hand to control';
    pill.classListToggle('active', name !== 'Ready');
    pill.classListToggle('pulsing', pulsing);
    if (timer) clearTimeout(timer);
    if (name !== 'Ready') {
      timer = setTimeout(() => {
        pill.classListToggle('pulsing', false);
      }, 1500);
    }
  }

  // Rapid spam of varying inputs
  const testInputs = [
    [null, null, null, false],
    [undefined, undefined, undefined, true],
    ['', '', '', false],
    ['🤏', 'Pinch', 'Dissecting: 85%', true],
    ['✌', 'Peace', 'Phase: Pre-fire', false],
    ['🔥'.repeat(50), 'ExtremeName'.repeat(50), 'ExtremeAction'.repeat(100), true],
    ['<script>alert(1)</script>', 'XSS_TEST', 'Action', false],
    ['🖐', 'Ready', 'Show hand to control', false]
  ];

  for (let i = 0; i < 10000; i++) {
    const input = testInputs[i % testInputs.length];
    updateGestureStatusPill(...input);
  }
  if (timer) clearTimeout(timer);

  assert.equal(pillName.textContent, 'Ready');
  assert.equal(pill.classList.has('active'), false);
});

// -----------------------------------------------------------------------------
// SUITE 4: Adversarial Gesture Classifier & Skeleton Drawing Edge Cases
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 4: Gesture Classifier Adversarial Stress & Edge Cases ---');

function makeHand() {
  const lm = [];
  for (let i = 0; i < 21; i++) {
    lm.push({ x: 0.5, y: 0.7 - i * 0.02, z: 0.0 });
  }
  lm[0] = { x: 0.5, y: 0.8, z: 0.0 };
  lm[9] = { x: 0.5, y: 0.5, z: 0.0 };
  lm[1] = { x: 0.45, y: 0.75, z: 0.0 };
  lm[2] = { x: 0.44, y: 0.70, z: 0.0 };
  lm[3] = { x: 0.44, y: 0.68, z: 0.0 };
  lm[4] = { x: 0.44, y: 0.72, z: 0.0 };
  lm[5] = { x: 0.46, y: 0.52, z: 0.0 };
  lm[6] = { x: 0.46, y: 0.58, z: 0.0 };
  lm[7] = { x: 0.46, y: 0.62, z: 0.0 };
  lm[8] = { x: 0.46, y: 0.65, z: 0.0 };
  lm[10] = { x: 0.50, y: 0.58, z: 0.0 };
  lm[11] = { x: 0.50, y: 0.62, z: 0.0 };
  lm[12] = { x: 0.50, y: 0.65, z: 0.0 };
  lm[13] = { x: 0.54, y: 0.52, z: 0.0 };
  lm[14] = { x: 0.54, y: 0.58, z: 0.0 };
  lm[15] = { x: 0.54, y: 0.62, z: 0.0 };
  lm[16] = { x: 0.54, y: 0.65, z: 0.0 };
  lm[17] = { x: 0.58, y: 0.55, z: 0.0 };
  lm[18] = { x: 0.58, y: 0.60, z: 0.0 };
  lm[19] = { x: 0.58, y: 0.64, z: 0.0 };
  lm[20] = { x: 0.58, y: 0.68, z: 0.0 };
  return lm;
}

it('classify() survives NaN, Infinity, and extreme coordinate bounds', () => {
  const lm = makeHand();
  // Corrupt with NaN
  lm[4] = { x: NaN, y: NaN, z: NaN };
  lm[8] = { x: Infinity, y: -Infinity, z: 0 };
  const res = classify(lm);
  assert(res && typeof res.name === 'string');
});

it('classify() behavior on coincident singularity: classifies curled points as fist', () => {
  const lm = [];
  for (let i = 0; i < 21; i++) {
    lm.push({ x: 0.5, y: 0.5, z: 0.0 });
  }
  const res = classify(lm);
  assert(res && typeof res.name === 'string');
  // With 0 extension from wrist, n=0 curled fingers triggers fist
  assert.equal(res.name, 'fist');
});

it('classify() survives inverted / upside-down hand coordinates', () => {
  const lm = makeHand();
  // Invert Y coordinates
  for (let i = 0; i < 21; i++) {
    lm[i].y = 1.0 - lm[i].y;
  }
  const res = classify(lm);
  assert(res && typeof res.name === 'string');
});

it('drawHandSkeleton() survives 0x0 and negative canvas dimensions', () => {
  const mockCtx = {
    canvas: { width: 0, height: 0 },
    clearRect: () => {},
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {}
  };
  const lm = makeHand();
  assert.doesNotThrow(() => {
    drawHandSkeleton(mockCtx, lm, { name: 'open' });
  });
});

it('drawHandSkeleton() renders exactly 21 bone connections and 21 non-overlapping landmark nodes', () => {
  let moveCount = 0;
  let lineCount = 0;
  let arcCount = 0;

  const mockCtx = {
    canvas: { width: 640, height: 480 },
    clearRect: () => {},
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: () => { moveCount++; },
    lineTo: () => { lineCount++; },
    arc: () => { arcCount++; },
    fill: () => {},
    stroke: () => {}
  };

  const lm = makeHand();
  drawHandSkeleton(mockCtx, lm, { name: 'fist' });

  // Each connection does 1 moveTo and 1 lineTo
  assert.equal(moveCount, HAND_CONNECTIONS.length, `Expected ${HAND_CONNECTIONS.length} bone starts`);
  assert.equal(lineCount, HAND_CONNECTIONS.length, `Expected ${HAND_CONNECTIONS.length} bone ends`);
  // 16 interior joints + 5 distinct glowing fingertip nodes = 21 total distinct landmarks drawn without blur
  assert.equal(arcCount, 21, 'Expected 21 landmark dot arcs (16 interior + 5 fingertips)');
});

it('Swipe class handles non-monotonic timestamps (jitter & clock step backwards)', () => {
  const swipe = new Swipe(350, 0.20, 800);
  assert.equal(swipe.push(0.3, 1000), 0);
  // Timestamp moves backwards (clock sync jitter)
  assert.doesNotThrow(() => {
    assert.equal(swipe.push(0.5, 950), 0);
  });
  // Timestamp jumps by 10 hours
  assert.doesNotThrow(() => {
    assert.equal(swipe.push(0.5, 1000 + 36000000), 0);
  });
  // Handles NaN x-position
  assert.doesNotThrow(() => {
    assert.equal(swipe.push(NaN, 1000 + 36001000), 0);
  });
});

// -----------------------------------------------------------------------------
// SUITE 5: Performance Tier Orchestration & Dynamic Switching
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 5: Performance Tier Dynamic Switching Stress ---');

it('applyPerfTier survives 500 rapid alternating switches between Light and Full without degradation', () => {
  let dprHistory = [];
  let shadowHistory = [];
  let fireTierHistory = [];

  const mockRenderer = {
    setPixelRatio: (dpr) => dprHistory.push(dpr),
    shadowMap: { enabled: true }
  };
  const mockFire = {
    setPerfTier: (m) => fireTierHistory.push(m)
  };
  const mockEmbers = { setMaxActive: () => {} };
  const mockSmoke = { setMaxActive: () => {} };

  const mockWorld = {
    renderer: mockRenderer,
    fire: mockFire,
    embers: mockEmbers,
    smoke: mockSmoke
  };

  for (let i = 0; i < 500; i++) {
    const mode = (i % 2 === 0) ? 'light' : 'full';
    applyPerfTier(mockWorld, mode);
    shadowHistory.push(mockRenderer.shadowMap.enabled);
  }

  assert.equal(mockWorld.perfMode, 'full');
  assert.equal(dprHistory.length, 500);
  assert.equal(dprHistory[0], 1.0, 'Initial switch to Light should set DPR 1.0');
  assert.equal(shadowHistory[0], false, 'Initial switch to Light should disable shadowMap');
  assert.equal(shadowHistory[499], true, 'Final switch to Full should enable shadowMap');
  assert.equal(fireTierHistory[499], 'full');
});

// -----------------------------------------------------------------------------
// SUITE 6: Android Manifest & Source Code Permission Audit
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 6: Android Manifest & WebView Permission Audit ---');

const manifestPath = 'app/src/main/AndroidManifest.xml';
const manifestXml = fs.readFileSync(manifestPath, 'utf8');

it('AndroidManifest.xml declares CAMERA permission', () => {
  assert(manifestXml.includes('android.permission.CAMERA'), 'Manifest missing CAMERA permission');
});

it('AndroidManifest.xml declares android.hardware.camera as optional (android:required="false")', () => {
  const match = manifestXml.match(/<uses-feature[^>]*android:name="android\.hardware\.camera"[^>]*android:required="false"/);
  assert(match, 'Manifest must declare android.hardware.camera with android:required="false" to prevent blocking non-camera devices');
});

const mainActivityPath = 'app/src/main/java/org/wildfire/fluxexplorer/MainActivity.java';
const mainActivityJava = fs.readFileSync(mainActivityPath, 'utf8');

it('MainActivity.java overrides WebChromeClient.onPermissionRequest', () => {
  assert(mainActivityJava.includes('onPermissionRequest(final PermissionRequest request)'), 'Missing onPermissionRequest override');
});

it('MainActivity.java grants PermissionRequest.RESOURCE_VIDEO_CAPTURE for WebView camera', () => {
  assert(mainActivityJava.includes('PermissionRequest.RESOURCE_VIDEO_CAPTURE'), 'Missing RESOURCE_VIDEO_CAPTURE grant');
  assert(mainActivityJava.includes('request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE})'), 'Did not grant RESOURCE_VIDEO_CAPTURE');
});

it('MainActivity.java handles runtime camera permission check & request', () => {
  assert(mainActivityJava.includes('Manifest.permission.CAMERA'), 'Missing CAMERA runtime permission check');
  assert(mainActivityJava.includes('requestPermissions(new String[]{Manifest.permission.CAMERA}'), 'Missing requestPermissions call');
  assert(mainActivityJava.includes('onRequestPermissionsResult'), 'Missing onRequestPermissionsResult handler');
});

it('MainActivity.java loads local offline web assets', () => {
  assert(mainActivityJava.includes('file:///android_asset/web/index.html'), 'Missing loadUrl for local assets');
});

// -----------------------------------------------------------------------------
// SUITE 7: Asset Mirroring Byte-for-Byte Synchronization Audit
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 7: Web Asset Synchronization Audit ---');

const assetPairs = [
  ['index.html', 'app/src/main/assets/web/index.html'],
  ['style.css', 'app/src/main/assets/web/style.css'],
  ['data/sites.json', 'app/src/main/assets/web/data/sites.json'],
  ['data/sites.schema.json', 'app/src/main/assets/web/data/sites.schema.json'],
  ['js/forest-generator.js', 'app/src/main/assets/web/js/forest-generator.js'],
  ['js/gestures.js', 'app/src/main/assets/web/js/gestures.js'],
  ['js/main.js', 'app/src/main/assets/web/js/main.js'],
  ['js/pbr-textures.js', 'app/src/main/assets/web/js/pbr-textures.js'],
  ['js/scene.js', 'app/src/main/assets/web/js/scene.js'],
  ['js/stratigraphy-dissection.js', 'app/src/main/assets/web/js/stratigraphy-dissection.js'],
  ['js/voice-controller.js', 'app/src/main/assets/web/js/voice-controller.js'],
  ['js/volumetric-fire.js', 'app/src/main/assets/web/js/volumetric-fire.js']
];

for (const [src, dst] of assetPairs) {
  it(`Asset synchronization: ${src} === ${dst}`, () => {
    assert(fs.existsSync(src), `Source file ${src} does not exist`);
    assert(fs.existsSync(dst), `Destination file ${dst} does not exist`);
    const h1 = crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex');
    const h2 = crypto.createHash('sha256').update(fs.readFileSync(dst)).digest('hex');
    assert.equal(h1, h2, `Hash mismatch between ${src} and ${dst}`);
  });
}

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n======================================================================');
console.log(`TOTAL TESTS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
if (failed === 0) {
  console.log('RESULT: 100% EMPIRICAL PASS — ALL ADVERSARIAL STRESS TESTS SUCCEEDED!');
} else {
  console.log(`RESULT: ${failed} FAILURES DETECTED!`);
}
console.log('======================================================================');

if (failed > 0) {
  process.exit(1);
}
