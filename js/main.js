import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeWorld, buildSite, updateSystems } from './scene.js';
import { classify, Swipe } from './gestures.js';

const PHASES = ['pre', 'during', 'post'], PLABEL = { pre: 'Pre-fire', during: 'During fire', post: 'Post-fire' };
const state = { site: 0, phase: 0, variable: 'SH', paused: false, data: null };
const $ = id => document.getElementById(id);

const renderer = new THREE.WebGLRenderer({ canvas: $('scene'), antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0f14); scene.fog = new THREE.Fog(0x0b0f14, 20, 45);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200); camera.position.set(14, 11, 14);
const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; // mouse/touch fallback
const world = makeWorld(scene);
function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

const site = () => state.data.sites[state.site];
const vals = (ph = PHASES[state.phase]) => site().values[ph];
function range(v) { const all = state.data.sites.flatMap(s => PHASES.map(p => s.values[p][v])); return [Math.min(...all), Math.max(...all)]; }
const norm = (v, x) => { const [a, b] = range(v); return b > a ? (x - a) / (b - a) : 0.5; };

function intensities() {
  const v = vals();
  return { fire: PHASES[state.phase] === 'during' ? 0.3 + 0.7 * norm('SH', v.SH) : 0, aod: norm('AOD', v.AOD),
           up: 0.2 + 0.8 * norm(state.variable === 'SH' ? 'SH' : 'LH', state.variable === 'SH' ? v.SH : v.LH), gpp: 0.1 + 0.9 * norm('GPP', v.GPP) };
}

function renderHUD() {
  const s = site();
  $('timeline').innerHTML = PHASES.map((p, i) => `<button data-p="${i}" class="${i === state.phase ? 'on' : ''}">${PLABEL[p]}</button>`).join('');
  $('vars').innerHTML = Object.keys(state.data.variables).map(k => `<button data-v="${k}" class="${k === state.variable ? 'on' : ''}">${k}</button>`).join('');
  const meta = state.data.variables[state.variable];
  const pub = (s.published_findings || []).map(f => `• ${f.text} <i>(${f.source})</i>`).join('<br>');
  $('note').innerHTML = `<b>${s.name}</b> — ${s.event || ''}<br>${meta.label} [${meta.unit}] = ${vals()[state.variable]}${state.data.is_example ? ' (example)' : ''}${state.paused ? ' ⏸' : ''}${pub ? '<br><br>Published findings:<br>' + pub : ''}`;
  $('badge').style.display = state.data.is_example ? '' : 'none';
  drawChart();
}
function drawChart() {
  const c = $('chart').getContext('2d'), W = 300, Hh = 140, v = state.variable; c.clearRect(0, 0, W, Hh);
  const ys = PHASES.map(p => site().values[p][v]); const mx = Math.max(...ys) * 1.15 || 1;
  ys.forEach((y, i) => { const h = (y / mx) * (Hh - 30); c.fillStyle = i === state.phase ? '#1f6feb' : '#30363d';
    c.fillRect(20 + i * 95, Hh - 20 - h, 70, h); c.fillStyle = '#e6edf3'; c.font = '11px sans-serif';
    c.fillText(PLABEL[PHASES[i]], 20 + i * 95, Hh - 6); c.fillText(String(y), 20 + i * 95, Hh - 24 - h); });
}

function setSite(i) { state.site = i; buildSite(world, site()); renderHUD(); }
function setPhase(i) { state.phase = (i + 3) % 3; renderHUD(); }
function setVar(k) { state.variable = k; renderHUD(); }
const varKeys = () => Object.keys(state.data.variables);

$('timeline').onclick = e => e.target.dataset.p && setPhase(+e.target.dataset.p);
$('vars').onclick = e => e.target.dataset.v && setVar(e.target.dataset.v);
$('site').onchange = e => setSite(+e.target.value);
addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') setPhase(state.phase + 1); else if (e.key === 'ArrowLeft') setPhase(state.phase - 1);
  else if (e.key === ' ') { state.paused = !state.paused; renderHUD(); }
  else if (/^[1-9]$/.test(e.key) && varKeys()[+e.key - 1]) setVar(varKeys()[+e.key - 1]);
});

// ---- Hand tracking (MediaPipe Tasks Vision, loaded lazily on user click) ----
const swipe = new Swipe(); let landmarker, lastOpen = null, lastPinch = null, lastPointT = 0;
$('camBtn').onclick = async () => {
  $('camBtn').disabled = true; $('gesture').textContent = 'Loading hand model…';
  try {
    const { FilesetResolver, HandLandmarker } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs');
    const fs = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
    landmarker = await HandLandmarker.createFromOptions(fs, { baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', delegate: 'GPU' },
      runningMode: 'VIDEO', numHands: 1 });
    const v = $('video'); v.srcObject = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
    await v.play(); v.style.display = 'block'; $('camBtn').style.display = 'none';
  } catch (err) { $('gesture').textContent = 'Hand tracking unavailable: ' + err.message + ' — use mouse/keys.'; $('camBtn').disabled = false; }
};
function handFrame(t) {
  const v = $('video'); if (!landmarker || v.readyState < 2) return;
  const r = landmarker.detectForVideo(v, t); const lm = r.landmarks?.[0];
  if (!lm) { lastOpen = lastPinch = null; return; }
  const g = classify(lm); $('gesture').textContent = 'Gesture: ' + g.name;
  if (g.name === 'open') {
    const dir = swipe.push(g.x, t); if (dir) setPhase(state.phase + dir);
    if (lastOpen) { orbitBy(g.x - lastOpen.x, g.y - lastOpen.y); }
    lastOpen = g;
  } else lastOpen = null;
  if (g.name === 'pinch') { if (lastPinch != null) zoomBy(g.pinch - lastPinch); lastPinch = g.pinch; } else lastPinch = null;
  if (g.name === 'fist' && !state.fist) { state.paused = !state.paused; renderHUD(); }
  state.fist = g.name === 'fist';
  if (g.name === 'point' && t - lastPointT > 1200) { const k = varKeys(); setVar(k[(Math.floor((1 - g.x) * k.length)) % k.length]); lastPointT = t; }
}
const sph = new THREE.Spherical();
function orbitBy(dx, dy) { const o = camera.position.clone().sub(controls.target); sph.setFromVector3(o);
  sph.theta += dx * 4; sph.phi = Math.min(1.45, Math.max(0.2, sph.phi - dy * 3)); camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sph)); }
function zoomBy(d) { const o = camera.position.clone().sub(controls.target); o.multiplyScalar(Math.min(1.1, Math.max(0.9, 1 - d * 2)));
  if (o.length() > 6 && o.length() < 40) camera.position.copy(controls.target).add(o); }

let prev = performance.now();
function loop(t) {
  requestAnimationFrame(loop); const dt = Math.min(0.05, (t - prev) / 1000); prev = t;
  try { handFrame(t); } catch (e) { console.warn(e); }
  if (!state.paused && state.data) updateSystems(world, intensities(), dt);
  controls.update(); renderer.render(scene, camera);
}

state.data = await (await fetch('data/sites.json')).json();
$('site').innerHTML = state.data.sites.map((s, i) => `<option value="${i}">${s.name}</option>`).join('');
setSite(0); requestAnimationFrame(loop);
