import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  makeWorld,
  buildSite,
  updateSystems,
  colorTerrain,
  setArrows,
  applyExplode,
  applyPerfTier as sceneApplyPerfTier,
  setWindMultiplier
} from './scene.js';
import {
  classify,
  detectHand,
  GestureStabilizer,
  drawHandSkeleton,
  drawScanningReticle,
  Swipe
} from './gestures.js';
import {
  parseVoiceCommand,
  buildNarrationScript,
  speakText,
  stopSpeaking
} from './voice-controller.js';

const PHASES = ['pre', 'during', 'post'];
const PLABEL = { pre: 'Pre-fire', during: 'During fire', post: 'Post-fire' };
const WIND_TIERS = [
  { mult: 1.0, label: '1x Normal' },
  { mult: 2.0, label: '2x Gale' },
  { mult: 3.0, label: '3x Firestorm' },
  { mult: 0.5, label: '0.5x Calm' }
];

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
  // Input Mode: 'without-camera' (default safe start) or 'with-camera'
  cameraMode: 'without-camera',
  cameraFacing: 'user',
  // Graphics tier: default to 'light' on startup as requested
  perfMode: localStorage.getItem('wf_perf_mode') || 'light',
  // Skeleton lines overlay: default to true when hand tracking active
  showSkeleton: localStorage.getItem('wf_show_skeleton') !== 'false',
  zenMode: false,
  // Wind & Flame Boost multiplier
  windTierIdx: 0,
  windMultiplier: 1.0,
  // Guided Scientific Auto-Tour
  autoTour: false,
  tourTime: 0,
  // Voice Recognition state
  voiceListening: false,
  speaking: false
};

const $ = id => document.getElementById(id);

// ---------------------------------------------------------------------------
// 1. Studio-Grade WebGL Renderer & Scene Initialization
// ---------------------------------------------------------------------------
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  preserveDrawingBuffer: true,
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
  state.perfMode = mode === 'full' ? 'full' : 'light';
  localStorage.setItem('wf_perf_mode', state.perfMode);
  const isLight = state.perfMode === 'light';

  // Apply to scene subsystems (DPR, shadowMap, volumetric fire, particles)
  sceneApplyPerfTier(world, state.perfMode);

  // Update UI toggle button in header
  const btn = $('perfToggleBtn');
  if (btn) {
    btn.classList.toggle('mode-full', !isLight);
    if ($('perfIcon')) $('perfIcon').textContent = isLight ? '⚡' : '💎';
    if ($('perfLabel')) $('perfLabel').textContent = isLight ? 'Light' : 'Full';
  }

  updateGestureStatusPill(
    isLight ? '⚡' : '💎',
    'Graphics Mode',
    `Switched to ${isLight ? 'Light (60 FPS)' : 'Full (Studio)'}`
  );
}

// ---------------------------------------------------------------------------
// 3. Zen / Clean Full-Screen View Mode
// ---------------------------------------------------------------------------
function toggleZenView(force) {
  state.zenMode = (force !== undefined) ? Boolean(force) : !state.zenMode;
  document.body.classList.toggle('zen-mode', state.zenMode);

  const exitBtn = $('exitZenBtn');
  if (exitBtn) {
    exitBtn.style.display = state.zenMode ? 'flex' : 'none';
  }

  const zenIcon = $('zenBtn');
  if (zenIcon) {
    zenIcon.style.color = state.zenMode ? '#00d2ff' : '';
  }

  updateGestureStatusPill(
    '👁',
    'Zen View',
    state.zenMode ? 'Unobstructed 3D Forest Visuals' : 'Standard HUD View'
  );
}

// ---------------------------------------------------------------------------
// 4. Real-time Gesture & Voice Feedback Status Pill
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
  if (pulsing) {
    statusPillTimer = setTimeout(() => {
      pill.classList.remove('pulsing');
    }, 1500);
  }
}

// ---------------------------------------------------------------------------
// 5. Two-Way Android WebView Integration
// Matching MainActivity.java lines 220 and 226
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

window.setCameraMode = function(mode) {
  setCameraMode(mode === 'with-camera' ? 'with-camera' : 'without-camera');
};

window.runVoiceCommand = function(transcript) {
  return executeVoiceTranscript(transcript);
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
  if (!state.data) return;
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
// 8. User Interaction Dispatchers & Boost Controls
// ---------------------------------------------------------------------------
function setSite(i) {
  state.site = (i + state.data.sites.length) % state.data.sites.length;
  buildSite(world, site(), { perfMode: state.perfMode });
  setWindMultiplier(world, state.windMultiplier);
  if (world.stratigraphy) {
    world.stratigraphy.setExplode(state.explodeTarget, true);
    world.stratigraphy.setSoloLayer(state.soloLayer);
  }
  if ($('site')) $('site').value = String(state.site);
  renderHUD();
}

function setPhase(i) {
  state.phase = (i + 3) % 3;
  renderHUD();
}

function setVar(k) {
  if (!state.data?.variables?.[k]) return;
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
  const btn = $('explodeBtn');
  if (btn) {
    btn.classList.toggle('on', state.explodeTarget > 0.3);
  }
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

function cycleWindBoost(explicitMult) {
  if (typeof explicitMult === 'number') {
    state.windMultiplier = explicitMult;
    const found = WIND_TIERS.findIndex(w => Math.abs(w.mult - explicitMult) < 0.1);
    state.windTierIdx = found !== -1 ? found : 0;
  } else {
    state.windTierIdx = (state.windTierIdx + 1) % WIND_TIERS.length;
    state.windMultiplier = WIND_TIERS[state.windTierIdx].mult;
  }
  setWindMultiplier(world, state.windMultiplier);
  const tierLabel = WIND_TIERS[state.windTierIdx]?.label || `${state.windMultiplier}x`;
  const btn = $('windBoostBtn');
  if (btn) {
    btn.textContent = `🌬 Wind: ${state.windMultiplier}x`;
    btn.classList.toggle('on', state.windMultiplier > 1.0);
  }
  updateGestureStatusPill('🌬', 'Wind Boost', `Canopy & Flame Shear: ${tierLabel}`, true);
}

function toggleAutoTour(force) {
  state.autoTour = (force !== undefined) ? Boolean(force) : !state.autoTour;
  state.tourTime = 0;
  const btn = $('tourToggleBtn');
  if (btn) {
    btn.classList.toggle('on', state.autoTour);
    btn.textContent = state.autoTour ? '⏹ Stop Tour' : '🎬 Auto-Tour';
  }
  updateGestureStatusPill(
    '🎬',
    'Scientific Tour',
    state.autoTour ? 'Automated 3D Dissection & Phase Tour Active' : 'Auto-Tour Stopped',
    true
  );
}

function resetCameraHome() {
  camera.position.set(16, 13, 16);
  controls.target.set(0, 1.2, 0);
  controls.update();
  updateGestureStatusPill('🎥', 'Camera Reset', 'Returned to Home Perspective', true);
}

function captureSnapshot() {
  try {
    renderer.render(scene, camera);
    const dataUrl = renderer.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    const siteId = site()?.id || 'forest';
    const ph = PHASES[state.phase] || 'fire';
    a.href = dataUrl;
    a.download = `wildfire-flux-${siteId}-${ph}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    updateGestureStatusPill('📸', 'Snapshot Saved', `Captured ${site()?.name || '3D Scene'}`, true);
  } catch (err) {
    updateGestureStatusPill('📸', 'Snapshot', 'Frame captured in viewport', true);
  }
}

function narrateCurrentState() {
  if (!state.data) return;
  const s = site();
  const phaseKey = PHASES[state.phase];
  const varMeta = state.data.variables[state.variable] || { label: state.variable, unit: '' };
  const stratumCallout = (state.soloLayer !== -1 && world.stratigraphy)
    ? world.stratigraphy.getStratumCallout(state.soloLayer, phaseKey)
    : null;

  const script = buildNarrationScript({
    site: s,
    phaseKey,
    phaseLabel: PLABEL[phaseKey],
    variable: state.variable,
    varMeta,
    values: vals(),
    explode: state.explodeTarget,
    stratumCallout
  });

  const ok = speakText(script, {
    onEnd: () => {
      state.speaking = false;
    }
  });
  state.speaking = ok;
  if ($('voiceTranscriptText')) {
    $('voiceTranscriptText').textContent = `🔊 "${script}"`;
  }
  updateGestureStatusPill('🔊', 'Audio Briefing', `${s.name} · ${PLABEL[phaseKey]} (${state.variable})`, true);
}

// ---------------------------------------------------------------------------
// 9. Explicit "With Camera" vs "Without Camera" Input Mode & 2-Stage Pipeline
// ---------------------------------------------------------------------------
const swipe = new Swipe();
const gestureStabilizer = new GestureStabilizer(2, 2);
let landmarker = null;
let landmarkerPromise = null;
let cameraSessionId = 0;
let holdStart = null;
let lastOpen = null;
let lastPinch = null;
let lastPointT = 0;
let lastPeaceT = 0;
let lastThreeT = 0;
let lastFistT = 0;
let lastThumbsUpT = 0;
let lastRockT = 0;
let lastCallMeT = 0;
let lastMediaPipeInferTime = 0;
let lastDetectTimestamp = 0;

function updateFingerPillsUI(fingers = {}) {
  const container = $('fingerMatrix');
  if (!container) return;
  const pills = container.querySelectorAll('.finger-pill');
  pills.forEach(p => {
    const f = p.dataset.finger;
    p.classList.toggle('ext', Boolean(fingers[f]));
  });
}

function updatePipelineUI(handInfo, gestureInfo, stability = 0) {
  const stage1 = $('stage1Step');
  const stage2 = $('stage2Step');
  const handTxt = $('handDetectStatus');
  const gestTxt = $('gestureDetectStatus');
  const fill = $('gestureStabilityFill');

  if (!handInfo || !handInfo.detected) {
    stage1?.classList.remove('locked');
    stage2?.classList.remove('locked');
    if (handTxt) handTxt.textContent = 'Scanning for hand…';
    if (gestTxt) gestTxt.textContent = 'Show hand first';
    if (fill) fill.style.width = '0%';
    updateFingerPillsUI({});
    return;
  }

  stage1?.classList.add('locked');
  if (handTxt) {
    handTxt.textContent = `✓ ${handInfo.handedness} Hand (${handInfo.confidence}% · ${handInfo.extendedCount}/5 digits)`;
  }
  updateFingerPillsUI(handInfo.fingers);

  const gName = gestureInfo?.name || 'none';
  if (gName !== 'none' && gName !== 'hand_detected') {
    stage2?.classList.add('locked');
  } else {
    stage2?.classList.remove('locked');
  }

  const GESTURE_LABELS = {
    hand_detected: gestureInfo?.candidate ? `Stabilizing (${gestureInfo.candidate})…` : 'Locking onto hand…',
    open: '🖐 Open Palm → Orbit / Hold Explode',
    pinch: '🤏 Pinch → Scrub Dissection',
    peace: '✌ Peace → Cycle Fire Phase',
    three: '🤟 3-Fingers → Solo Strata',
    point: '☝ Point → Cycle Flux Variable',
    fist: '✊ Fist → Reset & Pause',
    thumbs_up: '👍 Thumbs Up → Zen View',
    rock: '🤘 Rock Sign → Wind Boost',
    call_me: '🤙 Shaka → Audio Narrate',
    other: '🖐 Hand Tracked → Form Gesture'
  };
  if (gestTxt) {
    gestTxt.textContent = GESTURE_LABELS[gName] || `Gesture: ${gName}`;
  }
  if (fill) {
    fill.style.width = `${Math.round(Math.max(0.15, stability) * 100)}%`;
  }
}

function stopMediaStreamTracks(stream) {
  if (!stream) return;
  try {
    const tracks = stream.getTracks ? stream.getTracks() : [];
    tracks.forEach(t => t.stop());
  } catch (e) {
    // ignore
  }
}

function stopCameraStream() {
  const v = $('video');
  if (v && v.srcObject) {
    stopMediaStreamTracks(v.srcObject);
    v.srcObject = null;
  }
  if (v) v.style.display = 'none';
  const skelCanvas = $('skeletonCanvas');
  if (skelCanvas) {
    const ctx = skelCanvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, skelCanvas.width, skelCanvas.height);
  }
  gestureStabilizer.reset();
  updatePipelineUI(null, null, 0);
  lastOpen = lastPinch = holdStart = null;
}

async function ensureLandmarkerLoaded() {
  if (landmarker) return landmarker;
  if (landmarkerPromise) return landmarkerPromise;
  landmarkerPromise = (async () => {
    try {
      const { FilesetResolver, HandLandmarker } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs');
      const fs = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
      const modelUrl = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

      try {
        landmarker = await HandLandmarker.createFromOptions(fs, {
          baseOptions: { modelAssetPath: modelUrl, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numHands: 1
        });
      } catch (gpuErr) {
        console.warn('GPU delegate unavailable, falling back to CPU:', gpuErr);
        landmarker = await HandLandmarker.createFromOptions(fs, {
          baseOptions: { modelAssetPath: modelUrl, delegate: 'CPU' },
          runningMode: 'VIDEO',
          numHands: 1
        });
      }
      return landmarker;
    } finally {
      landmarkerPromise = null;
    }
  })();
  return landmarkerPromise;
}

async function startCameraTracking() {
  const sessionId = ++cameraSessionId;
  const isStale = () => sessionId !== cameraSessionId || state.cameraMode !== 'with-camera';

  const camCard = $('cam');
  if (camCard) {
    camCard.classList.add('active');
    camCard.classList.remove('minimized');
    if ($('camMinBtn')) $('camMinBtn').textContent = '▼';
  }

  if ($('camBtn')) {
    $('camBtn').disabled = true;
    $('camBtn').textContent = '⏳ Starting Camera…';
  }
  if ($('handDetectStatus')) $('handDetectStatus').textContent = 'Loading MediaPipe model…';
  if ($('gesture')) $('gesture').textContent = 'Initializing camera & 21-point hand detector…';

  let stream = null;
  try {
    // 1. Acquire camera stream first so user gets immediate permission prompt & preview
    stopCameraStream();
    const v = $('video');
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: state.cameraFacing || 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });
    } catch (constraintErr) {
      if (isStale()) return;
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }

    if (isStale()) {
      stopMediaStreamTracks(stream);
      return;
    }

    v.srcObject = stream;
    await v.play();
    if (isStale()) {
      stopMediaStreamTracks(stream);
      stopCameraStream();
      return;
    }

    v.style.display = 'block';
    const isMirrored = (state.cameraFacing !== 'environment');
    v.style.transform = isMirrored ? 'scaleX(-1)' : 'none';

    const skelCanvas = $('skeletonCanvas');
    if (skelCanvas) {
      skelCanvas.width = v.videoWidth || 640;
      skelCanvas.height = v.videoHeight || 480;
      skelCanvas.style.transform = isMirrored ? 'scaleX(-1)' : 'none';
      const ctx = skelCanvas.getContext('2d');
      if (ctx) drawScanningReticle(ctx);
    }

    // 2. Load MediaPipe HandLandmarker model (GPU with CPU fallback)
    await ensureLandmarkerLoaded();
    if (isStale()) {
      stopMediaStreamTracks(stream);
      stopCameraStream();
      return;
    }

    if ($('camBtn')) {
      $('camBtn').style.display = 'none';
      $('camBtn').disabled = false;
    }
    if ($('handDetectStatus')) $('handDetectStatus').textContent = 'Scanning for hand…';
    if ($('gestureDetectStatus')) $('gestureDetectStatus').textContent = 'Show hand first';
    if ($('gesture')) {
      $('gesture').textContent = 'Step 1: Show hand in frame. Step 2: Open = orbit, Pinch = dissect, Peace = phase, 3-Finger = strata, Point = var.';
    }
    updateGestureStatusPill('📷', 'With Camera Active', 'Step 1: Show hand in camera frame to lock', true);
  } catch (err) {
    stopMediaStreamTracks(stream);
    stopCameraStream();
    if (isStale()) return;
    const msg = err?.message || 'Camera access denied or unavailable';
    if ($('handDetectStatus')) $('handDetectStatus').textContent = 'Camera unavailable';
    if ($('gestureDetectStatus')) $('gestureDetectStatus').textContent = 'Use Without-Camera mode';
    if ($('gesture')) {
      $('gesture').textContent = `Camera error: ${msg}. You can retry or click "Without Camera" for touch/mouse/voice control.`;
    }
    if ($('camBtn')) {
      $('camBtn').style.display = 'inline-flex';
      $('camBtn').disabled = false;
      $('camBtn').textContent = '🔄 Retry Camera Detection';
    }
    updateGestureStatusPill('⚠️', 'Camera Unavailable', `${msg} — Touch & Voice remain active`, true);
  }
}

function setCameraMode(mode) {
  const useCam = (mode === 'with-camera');
  state.cameraMode = useCam ? 'with-camera' : 'without-camera';

  if ($('withCamBtn')) $('withCamBtn').classList.toggle('on', useCam);
  if ($('withoutCamBtn')) $('withoutCamBtn').classList.toggle('on', !useCam);

  if (useCam) {
    startCameraTracking();
  } else {
    ++cameraSessionId;
    stopCameraStream();
    $('cam')?.classList.remove('active');
    if ($('camBtn')) {
      $('camBtn').style.display = 'inline-flex';
      $('camBtn').disabled = false;
      $('camBtn').textContent = '📷 Start Camera Detection';
    }
    updateGestureStatusPill('🖱', 'Without Camera', 'Touch, Mouse, Virtual Deck & Voice active', true);
  }
}

function flipCamera() {
  state.cameraFacing = (state.cameraFacing === 'user') ? 'environment' : 'user';
  if (state.cameraMode === 'with-camera') {
    startCameraTracking();
  }
}

function setSkeletonVisible(show) {
  state.showSkeleton = Boolean(show);
  localStorage.setItem('wf_show_skeleton', state.showSkeleton);
  if ($('toggleSkeletonBtn')) {
    $('toggleSkeletonBtn').textContent = state.showSkeleton ? '🦴 Skeleton: ON' : '🦴 Skeleton: OFF';
    $('toggleSkeletonBtn').classList.toggle('on', state.showSkeleton);
  }
  const skelCanvas = $('skeletonCanvas');
  if (skelCanvas && !state.showSkeleton) {
    const ctx = skelCanvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, skelCanvas.width, skelCanvas.height);
  }
}

// ---------------------------------------------------------------------------
// 10. Voice Actions & Web Speech Recognition Engine
// ---------------------------------------------------------------------------
let recognition = null;

function updateVoiceUI(statusLabel, transcriptMsg, isListening = state.voiceListening) {
  if ($('voiceToggleBtn')) {
    $('voiceToggleBtn').classList.toggle('listening', isListening);
    if ($('voiceLabel')) $('voiceLabel').textContent = isListening ? 'Listening…' : 'Voice';
  }
  if ($('voicePanelDot')) {
    $('voicePanelDot').classList.toggle('listening', isListening);
  }
  if ($('voiceListenBtn')) {
    $('voiceListenBtn').textContent = isListening ? '⏹ Stop Mic' : '🎙 Start Mic';
    $('voiceListenBtn').classList.toggle('on', isListening);
  }
  if ($('voiceStateBadge') && statusLabel) {
    $('voiceStateBadge').textContent = statusLabel;
    $('voiceStateBadge').classList.toggle('listening', isListening);
  }
  if ($('voiceTranscriptText') && transcriptMsg) {
    $('voiceTranscriptText').textContent = transcriptMsg;
  }
}

function dispatchSingleVoiceAction(action) {
  switch (action.intent) {
    case 'setCameraMode':
      setCameraMode(action.param);
      break;
    case 'flipCamera':
      flipCamera();
      break;
    case 'setSkeleton':
      setSkeletonVisible(action.param);
      break;
    case 'setExplode':
      setExplode(action.param);
      break;
    case 'setPhase':
      setPhase(action.param);
      break;
    case 'cyclePhase':
      setPhase(state.phase + 1);
      break;
    case 'setSoloStratum':
      setSoloStratum(action.param);
      break;
    case 'setVar':
      setVar(action.param);
      break;
    case 'setSiteById':
      window.switchSite(action.param);
      break;
    case 'cycleSite':
      setSite(state.site + 1);
      break;
    case 'setWindBoost':
      if (action.param === 'cycle') cycleWindBoost();
      else cycleWindBoost(Number(action.param) || 1.0);
      break;
    case 'setTour':
      toggleAutoTour(action.param);
      break;
    case 'narrate':
      narrateCurrentState();
      break;
    case 'stopNarration':
      stopSpeaking();
      state.speaking = false;
      break;
    case 'setPerfTier':
      applyPerfTier(action.param);
      break;
    case 'setZen':
      toggleZenView(action.param);
      break;
    case 'setPaused':
      state.paused = Boolean(action.param);
      renderHUD();
      break;
    case 'resetCamera':
      resetCameraHome();
      break;
    case 'zoom':
      zoomBy(Number(action.param) || 0.15);
      break;
    case 'snapshot':
      captureSnapshot();
      break;
    case 'openGuide':
      if ($('gestureGuideModal')) $('gestureGuideModal').style.display = 'block';
      break;
  }
}

function executeVoiceTranscript(rawText) {
  const cmd = parseVoiceCommand(rawText);
  if (!cmd.matched) {
    updateVoiceUI(state.voiceListening ? 'LISTENING' : 'READY', cmd.description);
    updateGestureStatusPill(cmd.icon, cmd.label, cmd.description);
    return cmd;
  }

  const actions = Array.isArray(cmd.actions) && cmd.actions.length > 0 ? cmd.actions : [cmd];
  for (const act of actions) {
    dispatchSingleVoiceAction(act);
  }

  const summaryLabel = actions.length > 1
    ? actions.map(a => a.label).join(' + ')
    : cmd.label;
  const summaryDesc = actions.length > 1
    ? `Executed ${actions.length} voice actions (${summaryLabel})`
    : cmd.description;

  updateVoiceUI(
    state.voiceListening ? 'EXECUTED' : 'DONE',
    `✓ "${cmd.transcript}" → ${summaryLabel}: ${summaryDesc}`
  );
  updateGestureStatusPill(cmd.icon, `Voice: ${summaryLabel}`, summaryDesc, true);
  return cmd;
}

function toggleVoiceMic(force) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const targetState = (force !== undefined) ? Boolean(force) : !state.voiceListening;

  if (!targetState) {
    state.voiceListening = false;
    if (recognition) {
      try { recognition.stop(); } catch (e) {}
    }
    updateVoiceUI('READY', 'Microphone stopped. Tap a command chip or click Start Mic.', false);
    updateGestureStatusPill('🎙', 'Voice Standby', 'Tap Voice or press V to speak commands');
    return;
  }

  if (!SpeechRecognition) {
    state.voiceListening = false;
    updateVoiceUI(
      'CHIP / TEXT MODE',
      'Browser SpeechRecognition unavailable — use the command input box or 1-tap Voice Chips below!',
      false
    );
    updateGestureStatusPill('🎙', 'Voice Command Deck', 'Use quick voice chips or command input box', true);
    return;
  }

  try {
    if (!recognition) {
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        state.voiceListening = true;
        updateVoiceUI('LISTENING', 'Listening… Say "Explode", "During fire", "With camera", or "Wind boost"', true);
        updateGestureStatusPill('🎙', 'Listening…', 'Speak any wildfire explorer command', true);
      };

      recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const text = res[0].transcript.trim();
          if (res.isFinal) {
            executeVoiceTranscript(text);
          } else {
            interim += text + ' ';
          }
        }
        if (interim.trim()) {
          updateVoiceUI('HEARING…', `"${interim.trim()}…"`, true);
        }
      };

      recognition.onerror = (ev) => {
        if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
          state.voiceListening = false;
          updateVoiceUI('MIC BLOCKED', 'Microphone permission denied — use Command Input or Voice Chips below.', false);
        }
      };

      recognition.onend = () => {
        if (state.voiceListening) {
          try { recognition.start(); } catch (e) {
            state.voiceListening = false;
            updateVoiceUI('READY', 'Voice session ended. Click Start Mic to resume.', false);
          }
        } else {
          updateVoiceUI('READY', 'Voice standby.', false);
        }
      };
    }

    state.voiceListening = true;
    recognition.start();
  } catch (err) {
    state.voiceListening = false;
    updateVoiceUI('READY', `Mic status: ${err.message}. Use Voice Chips or text input below.`, false);
  }
}

// ---------------------------------------------------------------------------
// 11. Wire UI Event Listeners
// ---------------------------------------------------------------------------
// Explicit With Camera / Without Camera Buttons
if ($('withCamBtn')) {
  $('withCamBtn').onclick = () => setCameraMode('with-camera');
}
if ($('withoutCamBtn')) {
  $('withoutCamBtn').onclick = () => setCameraMode('without-camera');
}
if ($('switchNoCamBtn')) {
  $('switchNoCamBtn').onclick = () => setCameraMode('without-camera');
}
if ($('camBtn')) {
  $('camBtn').onclick = () => setCameraMode('with-camera');
}
if ($('flipCamBtn')) {
  $('flipCamBtn').onclick = () => flipCamera();
}

// Voice Panel Controls
if ($('voiceToggleBtn')) {
  $('voiceToggleBtn').onclick = () => {
    const panel = $('voicePanel');
    if (!panel) return;
    const isHidden = panel.style.display === 'none';
    panel.style.display = isHidden ? 'flex' : 'none';
    panel.classList.remove('minimized');
    if (isHidden && !state.voiceListening) {
      toggleVoiceMic(true);
    }
  };
}
if ($('voiceListenBtn')) {
  $('voiceListenBtn').onclick = () => toggleVoiceMic();
}
if ($('voiceSpeakBtn')) {
  $('voiceSpeakBtn').onclick = () => narrateCurrentState();
}
if ($('narrateHudBtn')) {
  $('narrateHudBtn').onclick = () => narrateCurrentState();
}
if ($('voiceMinBtn')) {
  $('voiceMinBtn').onclick = () => {
    const p = $('voicePanel');
    if (!p) return;
    const isMin = p.classList.toggle('minimized');
    $('voiceMinBtn').textContent = isMin ? '▲' : '▼';
  };
}
if ($('voiceCloseBtn')) {
  $('voiceCloseBtn').onclick = () => {
    if ($('voicePanel')) $('voicePanel').style.display = 'none';
  };
}
if ($('voiceRunBtn')) {
  $('voiceRunBtn').onclick = () => {
    const inp = $('voiceTextInput');
    if (inp && inp.value.trim()) {
      executeVoiceTranscript(inp.value.trim());
      inp.value = '';
    }
  };
}
if ($('voiceTextInput')) {
  $('voiceTextInput').addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter' && $('voiceTextInput').value.trim()) {
      executeVoiceTranscript($('voiceTextInput').value.trim());
      $('voiceTextInput').value = '';
    }
  });
}
if ($('voiceQuickChips')) {
  $('voiceQuickChips').onclick = e => {
    const chip = e.target.closest('.voice-chip');
    if (chip && chip.dataset.voice) {
      executeVoiceTranscript(chip.dataset.voice);
    }
  };
}

// Scrubber, Strata, Boost & Tour Buttons
if ($('explodeSlider')) {
  $('explodeSlider').oninput = e => setExplode(parseFloat(e.target.value));
}
if ($('explodeBtn')) {
  $('explodeBtn').onclick = () => toggleExplode();
}
if ($('windBoostBtn')) {
  $('windBoostBtn').onclick = () => cycleWindBoost();
}
if ($('tourToggleBtn')) {
  $('tourToggleBtn').onclick = () => toggleAutoTour();
}
if ($('snapshotBtn')) {
  $('snapshotBtn').onclick = () => captureSnapshot();
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
  $('resetCamBtn').onclick = () => resetCameraHome();
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
  $('camCloseBtn').onclick = () => setCameraMode('without-camera');
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
  $('toggleSkeletonBtn').onclick = () => setSkeletonVisible(!state.showSkeleton);
}

if ($('timeline')) $('timeline').onclick = e => e.target.dataset.p && setPhase(+e.target.dataset.p);
if ($('vars')) $('vars').onclick = e => e.target.dataset.v && setVar(e.target.dataset.v);
if ($('site')) $('site').onchange = e => setSite(+e.target.value);

const varKeys = () => (state.data ? Object.keys(state.data.variables) : []);

// Keyboard shortcuts
addEventListener('keydown', e => {
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  if (e.key === 'ArrowRight') setPhase(state.phase + 1);
  else if (e.key === 'ArrowLeft') setPhase(state.phase - 1);
  else if (e.key === ' ') { state.paused = !state.paused; renderHUD(); }
  else if (e.key === 'e' || e.key === 'E') toggleExplode();
  else if (e.key === 'z' || e.key === 'Z') toggleZenView();
  else if (e.key === 'w' || e.key === 'W') cycleWindBoost();
  else if (e.key === 't' || e.key === 'T') toggleAutoTour();
  else if (e.key === 'v' || e.key === 'V') $('voiceToggleBtn')?.click();
  else if (e.key === 'n' || e.key === 'N') narrateCurrentState();
  else if (e.key === 'p' || e.key === 'P') captureSnapshot();
  else if (e.key === '+' || e.key === '=') zoomBy(0.05);
  else if (e.key === '-' || e.key === '_') zoomBy(-0.05);
  else if (e.key === 's' || e.key === 'S') {
    setSite((state.site + 1) % state.data.sites.length);
  }
  else if (e.key === 'c' || e.key === 'C') {
    setCameraMode(state.cameraMode === 'with-camera' ? 'without-camera' : 'with-camera');
  }
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
// 12. Per-Frame 2-Stage Hand & Gesture Processing
// ---------------------------------------------------------------------------
function handFrame(t) {
  if (state.cameraMode !== 'with-camera') return;
  const v = $('video');
  if (!landmarker || !v || v.readyState < 2) return;

  // In Light mode: throttle inference to ~20 FPS (min 48ms interval) to keep mobile cool
  const minInterval = (state.perfMode === 'light') ? 48 : 0;
  if (t - lastMediaPipeInferTime < minInterval) return;
  lastMediaPipeInferTime = t;

  const skelCanvas = $('skeletonCanvas');
  const ctx = skelCanvas?.getContext('2d');
  if (skelCanvas && (skelCanvas.width !== (v.videoWidth || 640) || skelCanvas.height !== (v.videoHeight || 480))) {
    skelCanvas.width = v.videoWidth || 640;
    skelCanvas.height = v.videoHeight || 480;
  }

  // Strictly monotonic timestamp for MediaPipe detectForVideo
  const detectTs = Math.max(lastDetectTimestamp + 1, Math.floor(t));
  lastDetectTimestamp = detectTs;

  const r = landmarker.detectForVideo(v, detectTs);
  const lm = r.landmarks?.[0];
  const handedMeta = r.handednesses?.[0]?.[0] || r.handedness?.[0]?.[0] || {};

  // Run 2-Stage Hand -> Gesture Stabilizer
  const tracked = gestureStabilizer.update(lm, {
    handedness: handedMeta.categoryName || handedMeta.displayName,
    score: handedMeta.score
  });

  if (!tracked.hand.detected) {
    lastOpen = lastPinch = holdStart = null;
    if (ctx && skelCanvas) {
      if (state.showSkeleton) drawScanningReticle(ctx);
      else ctx.clearRect(0, 0, skelCanvas.width, skelCanvas.height);
    }
    updatePipelineUI(null, null, 0);
    updateGestureStatusPill('📷', 'Step 1: Scanning', 'Hold hand in camera view to detect');
    return;
  }

  const g = tracked.gesture;
  updatePipelineUI(tracked.hand, g, tracked.stability);

  // Render Stage-1 Hand Bounding Box + Stage-2 21-point Finger Skeleton Lines
  if (ctx && skelCanvas) {
    if (state.showSkeleton) {
      drawHandSkeleton(ctx, lm, g, { handInfo: tracked.hand, showHandBox: true });
    } else {
      ctx.clearRect(0, 0, skelCanvas.width, skelCanvas.height);
    }
  }

  // Wait until Stage 1 Hand Lock is confirmed before firing Stage 2 Gesture actions
  if (!tracked.handLocked) {
    $('gesture').textContent = `Step 1: Hand Detected (${tracked.hand.confidence}%) — locking…`;
    updateGestureStatusPill('🖐', 'Hand Detected', 'Locking onto hand landmarks…');
    return;
  }

  $('gesture').textContent = `Hand Locked (${tracked.hand.handedness}) · Gesture: ${g.name.toUpperCase()}`;

  // 1. PINCH: Continuous TakeApart layer dissection scrubber & zoom
  if (g.name === 'pinch') {
    const ratio = g.normRatio !== undefined ? g.normRatio : 0.5;
    setExplode(1.0 - ratio);

    if (lastPinch != null && g.pinch !== undefined) {
      zoomBy((g.pinch - lastPinch) * 0.8);
    }
    lastPinch = g.pinch;
    const pct = Math.round((1.0 - ratio) * 100);
    updateGestureStatusPill('🤏', 'Pinch Gesture', `Dissecting Layers: ${pct}% Exploded`, true);
  } else {
    lastPinch = null;
  }

  // 2. OPEN PALM: Smooth 3D Orbit & Hold-to-Explode
  if (g.name === 'open') {
    const dir = swipe.push(g.x, t);
    if (dir) {
      setSite((state.site + dir + state.data.sites.length) % state.data.sites.length);
      updateGestureStatusPill('↔🖐', 'Swipe Gesture', `Site: ${site().name}`, true);
    } else if (lastOpen) {
      orbitBy(g.x - lastOpen.x, g.y - lastOpen.y);
      updateGestureStatusPill('🖐', 'Open Palm', `Orbiting 3D Forest (${tracked.hand.extendedCount} fingers)`);
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
      resetCameraHome();
      state.paused = !state.paused;
      renderHUD();
      updateGestureStatusPill('✊', 'Fist Gesture', `Reset View · Simulation ${state.paused ? 'PAUSED' : 'ACTIVE'}`, true);
    }
  }

  // 4. PEACE SIGN (V-Sign): Cycle Fire Phase (Pre -> During -> Post)
  if (g.name === 'peace') {
    if (t - lastPeaceT > 1000) {
      lastPeaceT = t;
      setPhase(state.phase + 1);
      updateGestureStatusPill('✌', 'Peace Gesture', `Fire Phase: ${PLABEL[PHASES[state.phase]]}`, true);
    }
  }

  // 5. THREE FINGERS: Solo / Cycle Strata Layers
  if (g.name === 'three') {
    if (t - lastThreeT > 900) {
      lastThreeT = t;
      const strataCycle = [-1, 2, 3, 4, 5, 6, 0];
      const curIdx = strataCycle.indexOf(state.soloLayer);
      const nextStratum = strataCycle[(curIdx + 1) % strataCycle.length];
      setSoloStratum(nextStratum);
      const names = {
        '-1': 'All Layers',
        '2': 'Overstory Canopy',
        '3': 'Understory',
        '4': 'Surface Litter',
        '5': 'Duff Peat',
        '6': 'Mineral Soil',
        '0': 'Atmospheric Flux'
      };
      updateGestureStatusPill('🤟', '3-Finger Gesture', `Stratum: ${names[String(nextStratum)] || 'Layer ' + nextStratum}`, true);
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
        updateGestureStatusPill('☝', 'Point Gesture', `Variable: ${nextVar}`, true);
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

  // 8. ROCK SIGN (Index + Pinky): Cycle Wind & Flame Boost
  if (g.name === 'rock') {
    if (t - lastRockT > 1100) {
      lastRockT = t;
      cycleWindBoost();
    }
  }

  // 9. CALL-ME / SHAKA (Thumb + Pinky): Speak Scientific Audio Briefing
  if (g.name === 'call_me') {
    if (t - lastCallMeT > 2200) {
      lastCallMeT = t;
      narrateCurrentState();
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
// 13. Main Animation, Auto-Tour & Physics Loop
// ---------------------------------------------------------------------------
let prev = performance.now();
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (t - prev) / 1000);
  prev = t;

  try { handFrame(t); } catch (e) { console.warn(e); }

  if (state.data) {
    // Guided Scientific Auto-Tour progression
    if (state.autoTour && !state.paused) {
      state.tourTime += dt;
      orbitBy(dt * 0.08, 0);
      // Smooth sinusoidal TakeApart dissection wave during tour
      const targetExp = 0.5 - 0.5 * Math.cos(state.tourTime * 0.45);
      state.explodeTarget = targetExp;
      applyExplode(world, state.explodeTarget);

      // Cycle fire phase every 7 seconds during tour
      const tourPhase = Math.floor(state.tourTime / 7.0) % 3;
      if (tourPhase !== state.phase) {
        setPhase(tourPhase);
      }
    }

    if (!state.paused) {
      updateSystems(world, intensities(), dt, t * 0.001, {
        phase: PHASES[state.phase],
        site: site(),
        variable: state.variable,
        cameraPos: camera.position,
        windMultiplier: state.windMultiplier
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
// 14. Bootstrap Application
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

    // Sync initial skeleton toggle button state
    setSkeletonVisible(state.showSkeleton);

    setSite(0);
    updateGestureStatusPill('🖱', 'Without Camera', 'Touch/Mouse active · Tap "With Camera" or "Voice"');
    requestAnimationFrame(loop);
  } catch (err) {
    console.error('Failed to load sites data:', err);
  }
}

init();
