import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeWorld, buildSite, updateSystems, colorTerrain, setArrows, applyExplode } from './scene.js';
import { classify, Swipe } from './gestures.js';

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
  fist: false
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
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

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
// 2. Two-Way Android WebView Integration
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
// 3. Data Query & Intensity Helpers
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
// 4. UI HUD & Stratum Callout Updates
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
// 5. User Interaction Dispatchers
// ---------------------------------------------------------------------------
function setSite(i) {
  state.site = i;
  buildSite(world, site());
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
  else if (e.key === '+' || e.key === '=') zoomBy(0.05);
  else if (e.key === '-' || e.key === '_') zoomBy(-0.05);
  else if (e.key === 's' || e.key === 'S') {
    setSite((state.site + 1) % state.data.sites.length);
    if ($('site')) $('site').value = state.site;
  }
  else if (e.key === 'c' || e.key === 'C') $('camBtn')?.click();
  else if (e.key === 'Escape' || e.key === '0') setSoloStratum(-1);
  else if (/^[1-9]$/.test(e.key) && varKeys()[+e.key - 1]) setVar(varKeys()[+e.key - 1]);
});

// ---------------------------------------------------------------------------
// 6. MediaPipe Tasks Vision Hand Tracking (Lazy Loaded)
// ---------------------------------------------------------------------------
const swipe = new Swipe();
let landmarker, holdStart = null, lastOpen = null, lastPinch = null, lastPointT = 0;

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
      $('camBtn').style.display = 'none';
      $('gesture').textContent = 'Gesture active: open = swipe/hold, pinch = zoom, fist = pause, point = var';
    } catch (err) {
      $('gesture').textContent = 'Hand tracking unavailable: ' + err.message + ' — use mouse/touch.';
      $('camBtn').disabled = false;
    }
  };
}

function handFrame(t) {
  const v = $('video');
  if (!landmarker || !v || v.readyState < 2) return;
  const r = landmarker.detectForVideo(v, t);
  const lm = r.landmarks?.[0];
  if (!lm) { lastOpen = lastPinch = null; return; }

  const g = classify(lm);
  $('gesture').textContent = 'Gesture: ' + g.name;

  if (g.name === 'open') {
    const dir = swipe.push(g.x, t);
    if (dir) setPhase(state.phase + dir);
    if (lastOpen) { orbitBy(g.x - lastOpen.x, g.y - lastOpen.y); }
    // Open palm held still ~1 s toggles explode/collapse
    if (!holdStart || Math.hypot(g.x - holdStart.x, g.y - holdStart.y) > 0.04) {
      holdStart = { x: g.x, y: g.y, t };
    } else if (t - holdStart.t > 1000) {
      toggleExplode();
      holdStart = { x: g.x, y: g.y, t: t + 2000 };
    }
    lastOpen = g;
  } else {
    lastOpen = null;
    holdStart = null;
  }

  if (g.name === 'pinch') {
    if (lastPinch != null) zoomBy(g.pinch - lastPinch);
    lastPinch = g.pinch;
  } else {
    lastPinch = null;
  }

  if (g.name === 'fist' && !state.fist) {
    state.paused = !state.paused;
    renderHUD();
  }
  state.fist = g.name === 'fist';

  if (g.name === 'point' && t - lastPointT > 1200) {
    const k = varKeys();
    if (k.length > 0) {
      setVar(k[(Math.floor((1 - g.x) * k.length)) % k.length]);
      lastPointT = t;
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
// 7. Main Animation & Physics Loop
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
// 8. Bootstrap Application
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
    setSite(0);
    requestAnimationFrame(loop);
  } catch (err) {
    console.error('Failed to load sites data:', err);
  }
}

init();
