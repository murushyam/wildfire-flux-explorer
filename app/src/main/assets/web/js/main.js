import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeWorld, buildSite, updateSystems, colorTerrain, setArrows, applyExplode, applyPerfTier as sceneApplyPerfTier } from './scene.js';
import { classify, drawHandSkeleton, Swipe } from './gestures.js';

const PHASES = ['pre', 'during', 'post'];
const PLABEL = { pre: 'Pre-fire', during: 'During fire', post: 'Post-fire' };

const state = {
  site: 0,
  phase: 0,
  variable: 'SH',
  paused: false,
  data: null,
  explode: 0,
  explodeTarget: 0,
  soloLayer: -1,
  fist: false,
  // Graphics tier: default to 'light' on startup as requested
  perfMode: localStorage.getItem('wf_perf_mode') || 'light',
  // Skeleton lines overlay: default to true when hand tracking active
  showSkeleton: localStorage.getItem('wf_show_skeleton') !== 'false',
  zenMode: false
};

const $ = id => document.getElementById(id);

// ---------------------------------------------------------------------------
// 1. Studio-Grade WebGL Renderer & Scene Initialization
// ---------------------------------------------------------------------------
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance'
});

// Studio lighting & tone mapping parameters
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
if (THREE.SRGBColorSpace) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

// Initial resolution clamp based on performance tier
const initialDpr = (state.perfMode === 'light') ? 1.0 : Math.min(window.devicePixelRatio || 1, 1.75);
renderer.setPixelRatio(initialDpr);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05080e);
scene.fog = new THREE.FogExp2(0x05080e, 0.015);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(16, 13, 16);

// OrbitControls with high-precision touch ergonomics
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.touches = {
  ONE: THREE.TOUCH.ROTATE,
  TWO: THREE.TOUCH.DOLLY_PAN
};
controls.maxPolarAngle = Math.PI / 2 + 0.15; // Allow subterranean duff and root cross-section view
controls.minDistance = 4.0;
controls.maxDistance = 55.0;
controls.target.set(0, 1.2, 0);

const world = makeWorld(scene, renderer);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------------------
// 2. Performance Tier Management (Light Default vs Full Mode)
// ---------------------------------------------------------------------------
function applyPerfTier(mode) {
  state.perfMode = mode;
  localStorage.setItem('wf_perf_mode', mode);
  const isLight = mode === 'light';

  // Apply to scene subsystems (DPR, shadowMap, volumetric fire, particles)
  sceneApplyPerfTier(world, mode);

  // Update UI toggle button in header
  const btn = $('perfToggleBtn');
  if (btn) {
    btn.classList.toggle('mode-full', !isLight);
    if ($('perfIcon')) $('perfIcon').textContent = isLight ? '⚡' : '💎';
    if ($('perfLabel')) $('perfLabel').textContent = isLight ? 'Light' : 'Full';
  }

  updateGestureStatusPill(isLight ? '⚡' : '💎', 'Graphics Mode', `Switched to ${isLight ? 'Light (60 FPS)' : 'Full (Studio)'}`);
}

// ---------------------------------------------------------------------------
// 3. Zen / Clean Full-Screen View Mode
// ---------------------------------------------------------------------------
function toggleZenView(force) {
  state.zenMode = (force !== undefined) ? force : !state.zenMode;
  document.body.classList.toggle('zen-mode', state.zenMode);

  const exitBtn = $('exitZenBtn');
  if (exitBtn) {
    exitBtn.style.display = state.zenMode ? 'flex' : 'none';
  }

  const zenIcon = $('zenBtn');
  if (zenIcon) {
    zenIcon.style.color = state.zenMode ? '#00d2ff' : '';
  }

  updateGestureStatusPill('👁', 'Zen View', state.zenMode ? 'Unobstructed 3D Forest Visuals' : 'Standard HUD View');
}

// ---------------------------------------------------------------------------
// 4. Real-time Gesture Guidance Feedback Status Pill
// ---------------------------------------------------------------------------
let statusPillTimer = null;
function updateGestureStatusPill(icon, name, action, pulsing = false) {
  const pill = $('gestureStatusPill');
  if (!pill) return;

  if ($('gesturePillIcon')) $('gesturePillIcon').textContent = icon || '🖐';
  if ($('gesturePillName')) $('gesturePillName').textContent = name || 'Ready';
  if ($('gesturePillAction')) $('gesturePillAction').textContent = action || 'Show hand to control';

  pill.classList.toggle('active', name !== 'Ready');
  pill.classList.toggle('pulsing', pulsing);

  clearTimeout(statusPillTimer);
  if (name !== 'Ready') {
    statusPillTimer = setTimeout(() => {
      pill.classList.remove('pulsing');
    }, 1500);
  }
}

// ---------------------------------------------------------------------------
// 5. Two-Way Android WebView Integration
// Matching MainActivity.java lines 173 and 179
// ---------------------------------------------------------------------------
window.switchSite = function(siteId) {
  if (!state.data || !state.data.sites) return;
  const target = String(siteId).toLowerCase();
  const idx = state.data.sites.findIndex(s => s.id === target || (s.name && s.name.toLowerCase().includes(target)));
  if (idx !== -1) {
    setSite(idx);
    const sel = $('site');
    if (sel) sel.value = String(idx);
  }
};

window.switchPhase = function(phaseName) {
  const p = String(phaseName).toLowerCase();
  const idx = PHASES.indexOf(p);
  if (idx !== -1) {
    setPhase(idx);
  }
};

// ---------------------------------------------------------------------------
// 6. Data Query & Intensity Helpers
// ---------------------------------------------------------------------------
const site = () => state.data.sites[state.site];
const vals = (ph = PHASES[state.phase]) => site().values[ph];

function range(v) {
  const all = state.data.sites.flatMap(s => PHASES.map(p => s.values[p][v]));
  return [Math.min(...all), Math.max(...all)];
}

const norm = (v, x) => {
  const [a, b] = range(v);
  return b > a ? (x - a) / (b - a) : 0.5;
};

function intensities() {
  const v = vals();
  return {
    fire: PHASES[state.phase] === 'during' ? 0.35 + 0.65 * norm('SH', v.SH) : 0,
    aod: norm('AOD', v.AOD),
    up: 0.2 + 0.8 * norm(state.variable === 'SH' ? 'SH' : 'LH', state.variable === 'SH' ? v.SH : v.LH),
    gpp: 0.1 + 0.9 * norm('GPP', v.GPP)
  };
}

// ---------------------------------------------------------------------------
// 7. UI HUD & Stratum Callout Updates
// ---------------------------------------------------------------------------
function renderHUD() {
  const s = site();
  const meta = state.data.variables[state.variable] || { label: state.variable, unit: '', color: '#ffffff' };
  const currentVal = vals()[state.variable];

  // Timeline buttons
  if ($('timeline')) {
    $('timeline').innerHTML = PHASES.map((p, i) =>
      `<button data-p="${i}" class="${i === state.phase ? 'on' : ''}">${PLABEL[p]}</button>`
    ).join('');
  }

  // Variable selector buttons
  if ($('vars')) {
    $('vars').innerHTML = Object.keys(state.data.variables).map(k =>
      `<button data-v="${k}" class="${k === state.variable ? 'on' : ''}">${k}</button>`
    ).join('');
  }

  // Research findings note
  const pub = (s.published_findings || []).map(f => `• ${f.text} <i>(${f.source})</i>`).join('<br>');
  if ($('note')) {
    $('note').innerHTML = `<b>${s.name}</b> — ${s.event || ''}<br>` +
      `${meta.label} [${meta.unit}] = <b>${currentVal}</b>` +
      `${state.data.is_example ? ' (example data)' : ''}` +
      `${state.paused ? ' ⏸ PAUSED' : ''}` +
      `${pub ? '<br><br><b>Published findings:</b><br>' + pub : ''}`;
  }

  if ($('badge')) $('badge').style.display = state.data.is_example ? '' : 'none';
  if ($('warn')) $('warn').style.display = state.data.is_example ? '' : 'none';

  if ($('phaseVar')) {
    const explodePct = Math.round(state.explodeTarget * 100);
    $('phaseVar').textContent = `${s.name} · ${PLABEL[PHASES[state.phase]]} · ${state.variable}` +
      (state.explodeTarget > 0 ? ` · ${explodePct}% Dissected` : '');
  }

  // Color terrain & stratigraphy block
  colorTerrain(world, PHASES[state.phase]);

  // Focus active variable arrow
  const [a, b] = range(state.variable);
  setArrows(world, b > a ? (currentVal - a) / (b - a) : 0.5, meta.direction, meta.color, state.variable);

  drawChart();
  updateStratumCalloutCard();
}

function drawChart() {
  const canvasElem = $('chart');
  if (!canvasElem) return;
  const ctx = canvasElem.getContext('2d');
  const W = canvasElem.width;
  const Hh = canvasElem.height;
  const v = state.variable;

  ctx.clearRect(0, 0, W, Hh);

  const ys = PHASES.map(p => site().values[p][v]);
  const mx = Math.max(...ys) * 1.15 || 1;

  ys.forEach((y, i) => {
    const barWidth = 72;
    const x = 20 + i * 95;
    const h = (y / mx) * (Hh - 32);

    ctx.fillStyle = i === state.phase ? '#388bfd' : '#21262d';
    ctx.beginPath();
    ctx.roundRect(x, Hh - 20 - h, barWidth, h, [4, 4, 0, 0]);
    ctx.fill();

    // Labels
    ctx.fillStyle = i === state.phase ? '#58a6ff' : '#8b949e';
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillText(PLABEL[PHASES[i]], x, Hh - 6);

    ctx.fillStyle = '#f0f6fc';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.fillText(String(y), x + 2, Hh - 24 - h);
  });
}

function updateStratumCalloutCard() {
  const card = $('stratumCard');
  if (!card) return;

  if (state.soloLayer === -1 || !world.stratigraphy) {
    card.style.display = 'none';
    return;
  }

  const callout = world.stratigraphy.getStratumCallout(state.soloLayer, PHASES[state.phase]);
  if (!callout) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';
  if ($('stratumTier')) $('stratumTier').textContent = callout.tierCode || `L${state.soloLayer}`;
  if ($('stratumTitle')) $('stratumTitle').textContent = `${callout.name} (${callout.scientificName || ''})`;
  if ($('stratumDesc')) {
    $('stratumDesc').textContent = `${callout.description} · Elevation: ${callout.altitudeRange} · Thickness: ${callout.thickness}`;
  }

  if ($('stratumMetrics')) {
    const fluxes = callout.researchPaperFluxes || {};
    $('stratumMetrics').innerHTML = `
      <div class="metric-pill">
        <span class="metric-name">Sensible Heat (SH)</span>
        <span class="metric-val">${fluxes.SH || '—'}</span>
      </div>
      <div class="metric-pill">
        <span class="metric-name">Latent Heat (LH)</span>
        <span class="metric-val">${fluxes.LH || '—'}</span>
      </div>
      <div class="metric-pill">
        <span class="metric-name">Carbon Sink (GPP)</span>
        <span class="metric-val">${fluxes.GPP || '—'}</span>
      </div>
      <div class="metric-pill">
        <span class="metric-name">Aerosol (AOD)</span>
        <span class="metric-val">${fluxes.AOD || '—'}</span>
      </div>
      <div class="metric-pill">
        <span class="metric-name">Bowen Ratio (β)</span>
        <span class="metric-val">${fluxes.bowenRatio || '—'}</span>
      </div>
      <div class="metric-pill">
        <span class="metric-name">Evaporative Frac (EF)</span>
        <span class="metric-val">${fluxes.evaporativeFraction || '—'}</span>
      </div>
    `;
  }
}

// ---------------------------------------------------------------------------
// 8. User Interaction Dispatchers
// ---------------------------------------------------------------------------
function setSite(i) {
  state.site = i;
  buildSite(world, site(), { perfMode: state.perfMode });
  if (world.stratigraphy) {
    world.stratigraphy.setExplode(state.explodeTarget, true);
    world.stratigraphy.setSoloLayer(state.soloLayer);
  }
  renderHUD();
}

function setPhase(i) {
  state.phase = (i + 3) % 3;
  renderHUD();
}

function setVar(k) {
  state.variable = k;
  if (world.flux && typeof world.flux.setVariableFocus === 'function') {
    world.flux.setVariableFocus(k);
  }
  renderHUD();
}

function setExplode(targetVal) {
  state.explodeTarget = Math.max(0.0, Math.min(1.0, targetVal));
  applyExplode(world, state.explodeTarget);
  const slider = $('explodeSlider');
  if (slider) slider.value = String(state.explodeTarget);
  renderHUD();
}

function toggleExplode() {
  setExplode(state.explodeTarget > 0.3 ? 0.0 : 1.0);
}

function setSoloStratum(index) {
  state.soloLayer = index;
  if (world.stratigraphy) {
    world.stratigraphy.setSoloLayer(index);
  }
  // Update tabs active state
  if ($('strataTabs')) {
    const tabs = $('strataTabs').querySelectorAll('.stratum-tab');
    tabs.forEach(tab => {
      const tabIdx = parseInt(tab.dataset.stratum, 10);
      if (tabIdx === index) tab.classList.add('on');
      else tab.classList.remove('on');
    });
  }
  renderHUD();
}

// Wire Scrubber & Tactile Buttons
if ($('explodeSlider')) {
  $('explodeSlider').oninput = e => setExplode(parseFloat(e.target.value));
}
if ($('explodeBtn')) {
  $('explodeBtn').onclick = () => toggleExplode();
}
if ($('strataTabs')) {
  $('strataTabs').onclick = e => {
    const btn = e.target.closest('.stratum-tab');
    if (btn && btn.dataset.stratum !== undefined) {
      setSoloStratum(parseInt(btn.dataset.stratum, 10));
    }
  };
}
if ($('stratumCloseBtn')) {
  $('stratumCloseBtn').onclick = () => setSoloStratum(-1);
}
if ($('hudToggleBtn')) {
  $('hudToggleBtn').onclick = () => $('hud')?.classList.toggle('collapsed');
}
if ($('hudCloseBtn')) {
  $('hudCloseBtn').onclick = () => $('hud')?.classList.add('collapsed');
}
if ($('resetCamBtn')) {
  $('resetCamBtn').onclick = () => {
    camera.position.set(16, 13, 16);
    controls.target.set(0, 1.2, 0);
    controls.update();
    updateGestureStatusPill('🎥', 'Camera Reset', 'Returned to Home Perspective');
  };
}

// Wire Minimization Chevrons
if ($('topPillMinBtn')) {
  $('topPillMinBtn').onclick = () => {
    const p = $('topPill');
    if (!p) return;
    const isMin = p.classList.toggle('minimized');
    $('topPillMinBtn').textContent = isMin ? '▼' : '▲';
    $('topPillMinBtn').title = isMin ? 'Expand Header' : 'Minimize Header';
  };
}
if ($('hudMinBtn')) {
  $('hudMinBtn').onclick = () => {
    const h = $('hud');
    if (!h) return;
    const isMin = h.classList.toggle('minimized');
    $('hudMinBtn').textContent = isMin ? '▲' : '▼';
    $('hudMinBtn').title = isMin ? 'Expand Panel' : 'Minimize Panel';
  };
}
if ($('stratumMinBtn')) {
  $('stratumMinBtn').onclick = () => {
    const s = $('stratumCard');
    if (!s) return;
    const isMin = s.classList.toggle('minimized');
    $('stratumMinBtn').textContent = isMin ? '▲' : '▼';
    $('stratumMinBtn').title = isMin ? 'Expand Details' : 'Minimize Details';
  };
}
if ($('deckMinBtn')) {
  $('deckMinBtn').onclick = () => {
    const d = $('controlDeck');
    if (!d) return;
    const isMin = d.classList.toggle('minimized');
    $('deckMinBtn').textContent = isMin ? '▲' : '▼';
    $('deckMinBtn').title = isMin ? 'Expand Control Deck' : 'Minimize Control Deck';
  };
}
if ($('camMinBtn')) {
  $('camMinBtn').onclick = () => {
    const c = $('cam');
    if (!c) return;
    const isMin = c.classList.toggle('minimized');
    $('camMinBtn').textContent = isMin ? '▲' : '▼';
    $('camMinBtn').title = isMin ? 'Expand Camera' : 'Minimize Camera';
  };
}
if ($('camCloseBtn')) {
  $('camCloseBtn').onclick = () => {
    $('cam')?.classList.remove('active');
  };
}

// Wire Mode Toggles: Performance Tier, Zen View, Gesture Guide
if ($('perfToggleBtn')) {
  $('perfToggleBtn').onclick = () => {
    const nextMode = state.perfMode === 'light' ? 'full' : 'light';
    applyPerfTier(nextMode);
  };
}
if ($('zenBtn')) {
  $('zenBtn').onclick = () => toggleZenView();
}
if ($('exitZenBtn')) {
  $('exitZenBtn').onclick = () => toggleZenView(false);
}
if ($('gestureGuideBtn')) {
  $('gestureGuideBtn').onclick = () => {
    const m = $('gestureGuideModal');
    if (m) m.style.display = (m.style.display === 'none') ? 'block' : 'none';
  };
}
if ($('guideCloseBtn')) {
  $('guideCloseBtn').onclick = () => {
    if ($('gestureGuideModal')) $('gestureGuideModal').style.display = 'none';
  };
}

// Skeleton Toggle Button
if ($('toggleSkeletonBtn')) {
  $('toggleSkeletonBtn').onclick = () => {
    state.showSkeleton = !state.showSkeleton;
    localStorage.setItem('wf_show_skeleton', state.showSkeleton);
    $('toggleSkeletonBtn').textContent = state.showSkeleton ? '🦴 Skeleton: ON' : '🦴 Skeleton: OFF';
    $('toggleSkeletonBtn').classList.toggle('on', state.showSkeleton);

    const canvas = $('skeletonCanvas');
    if (canvas && !state.showSkeleton) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };
}

if ($('timeline')) $('timeline').onclick = e => e.target.dataset.p && setPhase(+e.target.dataset.p);
if ($('vars')) $('vars').onclick = e => e.target.dataset.v && setVar(e.target.dataset.v);
if ($('site')) $('site').onchange = e => setSite(+e.target.value);

const varKeys = () => (state.data ? Object.keys(state.data.variables) : []);

// Keyboard shortcuts
addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') setPhase(state.phase + 1);
  else if (e.key === 'ArrowLeft') setPhase(state.phase - 1);
  else if (e.key === ' ') { state.paused = !state.paused; renderHUD(); }
  else if (e.key === 'e' || e.key === 'E') toggleExplode();
  else if (e.key === 'z' || e.key === 'Z') toggleZenView();
  else if (e.key === '+' || e.key === '=') zoomBy(0.05);
  else if (e.key === '-' || e.key === '_') zoomBy(-0.05);
  else if (e.key === 's' || e.key === 'S') {
    setSite((state.site + 1) % state.data.sites.length);
    if ($('site')) $('site').value = state.site;
  }
  else if (e.key === 'c' || e.key === 'C') $('camBtn')?.click();
  else if (e.key === 'g' || e.key === 'G') $('gestureGuideBtn')?.click();
  else if (e.key === 'Escape' || e.key === '0') {
    if ($('gestureGuideModal')?.style.display === 'block') {
      $('gestureGuideModal').style.display = 'none';
    } else if (state.zenMode) {
      toggleZenView(false);
    } else {
      setSoloStratum(-1);
    }
  }
  else if (/^[1-9]$/.test(e.key) && varKeys()[+e.key - 1]) setVar(varKeys()[+e.key - 1]);
});

// ---------------------------------------------------------------------------
// 9. MediaPipe Tasks Vision Hand Tracking & Skeleton Lines
// ---------------------------------------------------------------------------
const swipe = new Swipe();
let landmarker = null;
let holdStart = null;
let lastOpen = null;
let lastPinch = null;
let lastPointT = 0;
let lastPeaceT = 0;
let lastThreeT = 0;
let lastFistT = 0;
let lastThumbsUpT = 0;
let lastMediaPipeInferTime = 0;

if ($('camBtn')) {
  $('camBtn').onclick = async () => {
    $('camBtn').disabled = true;
    $('cam')?.classList.add('active');
    $('gesture').textContent = 'Loading MediaPipe hand model…';
    try {
      const { FilesetResolver, HandLandmarker } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs');
      const fs = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
      landmarker = await HandLandmarker.createFromOptions(fs, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numHands: 1
      });
      const v = $('video');
      v.srcObject = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      await v.play();
      v.style.display = 'block';

      // Initialize skeleton overlay canvas dimensions
      const skelCanvas = $('skeletonCanvas');
      if (skelCanvas) {
        skelCanvas.width = v.videoWidth || 640;
        skelCanvas.height = v.videoHeight || 480;
      }

      $('camBtn').style.display = 'none';
      $('gesture').textContent = 'Gesture active: open = orbit, pinch = dissect/zoom, peace = phase, 3-finger = strata, fist = reset';
      updateGestureStatusPill('🖐', 'Tracking Active', 'Hand gestures connected');
    } catch (err) {
      $('gesture').textContent = 'Hand tracking unavailable: ' + err.message + ' — use mouse/touch.';
      $('camBtn').disabled = false;
      updateGestureStatusPill('⚠️', 'Tracking Failed', err.message);
    }
  };
}

function handFrame(t) {
  const v = $('video');
  if (!landmarker || !v || v.readyState < 2) return;

  // In Light mode: throttle inference to ~18-20 FPS (min 50ms interval) to prevent mobile phone overheating
  const minInterval = (state.perfMode === 'light') ? 50 : 0;
  if (t - lastMediaPipeInferTime < minInterval) return;
  lastMediaPipeInferTime = t;

  const skelCanvas = $('skeletonCanvas');
  const ctx = skelCanvas?.getContext('2d');
  if (skelCanvas && (skelCanvas.width !== v.videoWidth || skelCanvas.height !== v.videoHeight)) {
    skelCanvas.width = v.videoWidth || 640;
    skelCanvas.height = v.videoHeight || 480;
  }

  const r = landmarker.detectForVideo(v, t);
  const lm = r.landmarks?.[0];

  if (!lm) {
    lastOpen = lastPinch = null;
    if (ctx && skelCanvas) ctx.clearRect(0, 0, skelCanvas.width, skelCanvas.height);
    updateGestureStatusPill('🖐', 'Ready', 'Show hand to control');
    return;
  }

  // Classify recognized hand gesture
  const g = classify(lm);
  $('gesture').textContent = 'Gesture: ' + g.name;

  // Render visible 21-point hand skeleton lines & glowing joints if enabled
  if (ctx && skelCanvas) {
    if (state.showSkeleton) {
      drawHandSkeleton(ctx, lm, g);
    } else {
      ctx.clearRect(0, 0, skelCanvas.width, skelCanvas.height);
    }
  }

  // 1. PINCH: Continuous TakeApart layer dissection scrubber & zoom
  if (g.name === 'pinch') {
    const ratio = g.normRatio !== undefined ? g.normRatio : 0.5;
    // Map pinch ratio directly to explode dissection slider
    setExplode(1.0 - ratio);

    if (lastPinch != null) {
      zoomBy((g.pinch - lastPinch) * 0.8);
    }
    lastPinch = g.pinch;
    const pct = Math.round((1.0 - ratio) * 100);
    updateGestureStatusPill('🤏', 'Pinch', `Dissecting Layers: ${pct}% Exploded`, true);
  } else {
    lastPinch = null;
  }

  // 2. OPEN PALM: Smooth 3D Orbit & Hold-to-Explode
  if (g.name === 'open') {
    const dir = swipe.push(g.x, t);
    if (dir) {
      setSite((state.site + dir + state.data.sites.length) % state.data.sites.length);
      if ($('site')) $('site').value = state.site;
      updateGestureStatusPill('↔🖐', 'Swipe', `Site: ${site().name}`, true);
    } else if (lastOpen) {
      orbitBy(g.x - lastOpen.x, g.y - lastOpen.y);
      updateGestureStatusPill('🖐', 'Open Palm', 'Orbiting 3D Forest');
    }

    // Open palm held stationary for 1.0s toggles explode/assemble
    if (!holdStart || Math.hypot(g.x - holdStart.x, g.y - holdStart.y) > 0.04) {
      holdStart = { x: g.x, y: g.y, t };
    } else if (t - holdStart.t > 1000) {
      toggleExplode();
      holdStart = { x: g.x, y: g.y, t: t + 2000 };
      updateGestureStatusPill('⏱🖐', 'Hold Explode', `TakeApart: ${state.explodeTarget > 0.3 ? 'Exploded' : 'Assembled'}`, true);
    }
    lastOpen = g;
  } else {
    lastOpen = null;
    holdStart = null;
  }

  // 3. FIST: Camera Home Pose Reset & Simulation Pause/Resume
  if (g.name === 'fist') {
    if (t - lastFistT > 1000) {
      lastFistT = t;
      camera.position.set(16, 13, 16);
      controls.target.set(0, 1.2, 0);
      controls.update();
      state.paused = !state.paused;
      renderHUD();
      updateGestureStatusPill('✊', 'Fist', `Reset View · Simulation ${state.paused ? 'PAUSED' : 'ACTIVE'}`, true);
    }
  }

  // 4. PEACE SIGN (V-Sign): Cycle Fire Phase (Pre -> During -> Post)
  if (g.name === 'peace') {
    if (t - lastPeaceT > 1000) {
      lastPeaceT = t;
      setPhase(state.phase + 1);
      updateGestureStatusPill('✌', 'Peace', `Fire Phase: ${PLABEL[PHASES[state.phase]]}`, true);
    }
  }

  // 5. THREE FINGERS: Solo / Cycle Strata Layers (Canopy, Understory, Litter, Duff, Soil, Flux)
  if (g.name === 'three') {
    if (t - lastThreeT > 900) {
      lastThreeT = t;
      const strataCycle = [-1, 2, 3, 4, 5, 6, 0];
      const curIdx = strataCycle.indexOf(state.soloLayer);
      const nextStratum = strataCycle[(curIdx + 1) % strataCycle.length];
      setSoloStratum(nextStratum);
      const names = { '-1': 'All Layers', '2': 'Overstory Canopy', '3': 'Understory', '4': 'Surface Litter', '5': 'Duff Peat', '6': 'Mineral Soil', '0': 'Atmospheric Flux' };
      updateGestureStatusPill('🤟', 'Three Fingers', `Stratum: ${names[String(nextStratum)] || 'Layer ' + nextStratum}`, true);
    }
  }

  // 6. POINT (Index alone): Cycle / Focus Energy Flux Variable
  if (g.name === 'point') {
    if (t - lastPointT > 850) {
      lastPointT = t;
      const k = varKeys();
      if (k.length > 0) {
        const curIdx = k.indexOf(state.variable);
        const nextVar = k[(curIdx + 1) % k.length];
        setVar(nextVar);
        updateGestureStatusPill('☝', 'Point', `Variable: ${nextVar}`, true);
      }
    }
  }

  // 7. THUMBS UP: Toggle Zen Clean View Mode
  if (g.name === 'thumbs_up') {
    if (t - lastThumbsUpT > 1200) {
      lastThumbsUpT = t;
      toggleZenView();
      updateGestureStatusPill('👍', 'Thumbs Up', `Zen View: ${state.zenMode ? 'ENABLED' : 'DISABLED'}`, true);
    }
  }
}

const sph = new THREE.Spherical();
function orbitBy(dx, dy) {
  const o = camera.position.clone().sub(controls.target);
  sph.setFromVector3(o);
  sph.theta += dx * 4;
  sph.phi = Math.min(1.45, Math.max(0.2, sph.phi - dy * 3));
  camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sph));
}

function zoomBy(d) {
  const o = camera.position.clone().sub(controls.target);
  o.multiplyScalar(Math.min(1.1, Math.max(0.9, 1 - d * 2)));
  if (o.length() > 4 && o.length() < 55) {
    camera.position.copy(controls.target).add(o);
  }
}

// ---------------------------------------------------------------------------
// 10. Main Animation & Physics Loop
// ---------------------------------------------------------------------------
let prev = performance.now();
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (t - prev) / 1000);
  prev = t;

  try { handFrame(t); } catch (e) { console.warn(e); }

  if (state.data) {
    if (!state.paused) {
      updateSystems(world, intensities(), dt, t * 0.001, {
        phase: PHASES[state.phase],
        site: site(),
        variable: state.variable,
        cameraPos: camera.position
      });
    } else if (world.stratigraphy) {
      world.stratigraphy.update(dt);
    }

    // Sync scrubber input with current spring explosion if user is not dragging
    const slider = $('explodeSlider');
    if (slider && document.activeElement !== slider && world.stratigraphy) {
      slider.value = world.stratigraphy.getExplode().toFixed(2);
    }
  }

  controls.update();
  renderer.render(scene, camera);
}

// ---------------------------------------------------------------------------
// 11. Bootstrap Application
// ---------------------------------------------------------------------------
async function init() {
  try {
    const res = await fetch('data/sites.json');
    state.data = await res.json();
    if ($('site')) {
      $('site').innerHTML = state.data.sites.map((s, i) =>
        `<option value="${i}">${s.name}</option>`
      ).join('');
    }

    // Apply startup performance tier (Default Light mode!)
    applyPerfTier(state.perfMode);

    setSite(0);
    requestAnimationFrame(loop);
  } catch (err) {
    console.error('Failed to load sites data:', err);
  }
}

init();
