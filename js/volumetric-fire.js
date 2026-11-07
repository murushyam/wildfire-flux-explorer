/**
 * volumetric-fire.js
 * Modular Three.js r160 ES module for Volumetric Raymarched Fire,
 * Buoyant Cooling Embers, Aerodynamic Smoke Plumes, and Energy Flux Dynamics.
 *
 * Scientific Basis:
 * PhD research by M.S. Shyam Sunder (NIT Rourkela) on
 * "Decoding Atmosphere-Biosphere flux Nexus in the Phase of Wildfire using
 * AI techniques over Heterogeneous Forest Ecosystem",
 * Published in Physics and Chemistry of the Earth 141 (2025) 104177;
 * EGU24-106; Aerosol and Air Quality Research (2022).
 *
 * Provides:
 * 1. createVolumetricFire(burnCenter, burnRadius):
 *    - 3D GPU raymarched volumetric fire shader using bounding cylinder geometry.
 *    - 4-octave 3D Fractional Brownian Motion (fBm) turbulence.
 *    - Upward convective velocity (vy ~ 3.2 m/s) and wind shear tilt driven by SH and wind vector W.
 *    - Planckian Blackbody radiation spectrum (800K -> 2400K) mapping temperature to photorealistic flame color:
 *      deep cherry red (800K) -> vivid orange (1400K) -> brilliant yellow-white core (2200K) -> soot absorption periphery.
 *    - 36 raymarch steps (balanced for 60 FPS mobile fill-rate) with early opacity breakout (a > 0.96).
 *    - Uniforms: uTime, uWind, uFireIntensity (scaled by SH), uBurnCenter, uBurnRadius, uCameraPos.
 *
 * 2. createEmbers(burnCenter, count):
 *    - Dynamic particle system (600-800 embers) with additive blending and point-glow textures.
 *    - Upward sensible heat convective lift (vy = vy_base + 0.015 * SH), wind drift, and curl-noise turbulence.
 *    - Dynamic thermal cooling lifecycle:
 *      T(t) = 2200K * (1 - age/maxAge) => bright yellow-white -> vivid orange -> deep crimson -> black cinder ash.
 *
 * 3. createSmokePlume(burnCenter):
 *    - Aerodynamic convective smoke column scaling optical density directly from Aerosol Optical Depth (AOD_550).
 *    - Soft billowy particle blending with wind shear drift and pyrocumulus lofting through the PBL into the free troposphere.
 *
 * 4. createFluxArrows():
 *    - 3D animated energy flux vector arrows:
 *      - Upward orange/red Sensible Heat (SH, surges +32.7 to +40 W/m2 during fire)
 *      - Upward cyan Latent Heat / moisture (LH, collapses -33% during fire)
 *      - Downward green carbon uptake (GPP, photosynthetic sink into canopy)
 *      - Evapotranspiration (ET, water transpiration loss)
 *    - Scaled dynamically by active site and phase data.
 *
 * 5. Exported Mathematical Helpers:
 *    - blackbody(kelvin)
 *    - sampleDensity(relP, options)
 *    - calculateEmberState(initialPos, age, maxAge, sh, wind, time)
 *    - calculateFluxMetrics(site, phase)
 */

import * as THREE from 'three';

// ============================================================================
// 1. PURE MATHEMATICAL FUNCTIONS (Shared JS & Verification Core)
// ============================================================================

/**
 * Planckian Blackbody Radiation Spectrum Approximation (800K - 2400K).
 * Maps temperature in Kelvin to photorealistic flame color emission (RGB in [0, 1.4]).
 *
 * Progression:
 *   800K  -> Deep cherry red (r ~ 0.96, g = 0.0, b = 0.0)
 *   1400K -> Vivid radiant orange (r ~ 1.04, g ~ 0.42, b = 0.0)
 *   2200K -> Brilliant yellow-white core (r ~ 1.12, g ~ 1.20, b ~ 0.59)
 *   2400K -> Radiant incandescent white (r ~ 1.14, g ~ 1.20, b ~ 0.98)
 *
 * @param {number} kelvin - Temperature in Kelvin (clamped 600K to 3000K).
 * @returns {{ r: number, g: number, b: number }}
 */
export function blackbody(kelvin) {
  const safeKelvin = typeof kelvin === 'number' && !isNaN(kelvin) ? kelvin : 1400.0;
  const t = Math.max(600.0, Math.min(3000.0, safeKelvin)) / 1000.0;
  let r = 0.0;
  let g = 0.0;
  let b = 0.0;

  // Red channel
  if (t < 1.0) {
    r = Math.max(0.0, Math.min(1.4, t * 1.2));
  } else {
    r = Math.min(1.4, 1.0 + (t - 1.0) * 0.1);
  }

  // Green channel
  if (t < 0.9) {
    g = 0.0;
  } else {
    const primary = (t - 0.9) * 0.75;
    const secondary = Math.pow(Math.max(0.0, t - 1.2), 1.5) * 0.5;
    g = Math.max(0.0, Math.min(1.2, primary + secondary));
  }

  // Blue channel
  if (t < 1.5) {
    b = 0.0;
  } else {
    b = Math.max(0.0, Math.min(1.0, Math.pow((t - 1.5) * 1.1, 2.0)));
  }

  return { r, g, b };
}

/**
 * 3D Simplex-like continuous hash noise for JS unit verification.
 */
function hash3D(x, y, z) {
  const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

export function snoise3D(p) {
  const ix = Math.floor(p.x), iy = Math.floor(p.y), iz = Math.floor(p.z);
  const fx = p.x - ix, fy = p.y - iy, fz = p.z - iz;
  const wx = fx * fx * (3.0 - 2.0 * fx);
  const wy = fy * fy * (3.0 - 2.0 * fy);
  const wz = fz * fz * (3.0 - 2.0 * fz);

  const c000 = hash3D(ix, iy, iz);
  const c100 = hash3D(ix + 1, iy, iz);
  const c010 = hash3D(ix, iy + 1, iz);
  const c110 = hash3D(ix + 1, iy + 1, iz);
  const c001 = hash3D(ix, iy, iz + 1);
  const c101 = hash3D(ix + 1, iy, iz + 1);
  const c011 = hash3D(ix, iy + 1, iz + 1);
  const c111 = hash3D(ix + 1, iy + 1, iz + 1);

  const x00 = c000 * (1 - wx) + c100 * wx;
  const x10 = c010 * (1 - wx) + c110 * wx;
  const x01 = c001 * (1 - wx) + c101 * wx;
  const x11 = c011 * (1 - wx) + c111 * wx;

  const y0 = x00 * (1 - wy) + x10 * wy;
  const y1 = x01 * (1 - wy) + x11 * wy;

  return (y0 * (1 - wz) + y1 * wz) * 2.0 - 1.0;
}

/**
 * 4-Octave Fractional Brownian Motion (fBm).
 */
export function fbm3D(p) {
  let total = 0.0;
  let amp = 0.55;
  let freq = 1.0;
  for (let i = 0; i < 4; i++) {
    total += amp * snoise3D({ x: p.x * freq, y: p.y * freq, z: p.z * freq });
    freq *= 2.1;
    amp *= 0.48;
  }
  return total;
}

/**
 * Evaluates the 3D flame density field at a relative position vector.
 *
 * @param {{x: number, y: number, z: number}} relPos - Position relative to burn center.
 * @param {object} options
 * @param {number} [options.time=0] - Current simulation time.
 * @param {{x: number, y: number, z: number}} [options.wind={x:1,y:0,z:0.3}] - Wind vector.
 * @param {number} [options.intensity=1] - Flame intensity factor.
 * @param {number} [options.burnRadius=5] - Active burn zone radius.
 * @param {number} [options.flameHeight=4.5] - Convective flame height.
 * @returns {number} Density value in [0.0, 1.0].
 */
export function sampleDensity(relPos, options = {}) {
  const time = options.time || 0.0;
  const wind = options.wind || { x: 1.0, y: 0.0, z: 0.3 };
  const intensity = Math.max(0.0, options.intensity !== undefined ? options.intensity : 1.0);
  const burnRadius = Math.max(0.1, options.burnRadius || 5.0);
  const flameHeight = Math.max(0.1, options.flameHeight || 4.5);

  const r = Math.sqrt(relPos.x * relPos.x + relPos.z * relPos.z) / burnRadius;
  const h = relPos.y / flameHeight;

  // Upward convection velocity vy ~ 3.2 m/s + wind shear tilt
  const convY = relPos.y - time * 3.2;
  const convX = relPos.x - wind.x * (time * 1.5 + relPos.y * 0.4);
  const convZ = relPos.z - wind.z * (time * 1.5 + relPos.y * 0.4);

  // Domain warping for turbulent flame tongues
  const warp = snoise3D({ x: convX * 0.8, y: convY * 0.8 - time * 1.2, z: convZ * 0.8 });
  const warpedPos = {
    x: convX * 1.4 + warp * 0.6,
    y: convY * 1.4 + warp * 0.6,
    z: convZ * 1.4 + warp * 0.6
  };

  const n = fbm3D(warpedPos);

  // Radial flame envelope (smoothstep from boundary inwards)
  const radialMask = Math.max(0.0, Math.min(1.0, (1.05 - r) / 0.85));

  // Vertical flame taper (tapers to tip)
  const vBottom = Math.max(0.0, Math.min(1.0, (relPos.y + 0.2) / 0.4));
  const vTop = Math.max(0.0, Math.min(1.0, (1.05 - h) / 0.75));
  const verticalMask = vBottom * vTop;

  const rawDensity = (n * 0.5 + 0.5) * radialMask * verticalMask * intensity;
  return Math.max(0.0, Math.min(1.0, rawDensity));
}

/**
 * Calculates dynamic ember state at a specific age according to physical Sensible Heat (SH)
 * updraft and thermal cooling lifecycle: T(t) = 2200K * (1 - age/maxAge).
 */
export function calculateEmberState(initialPos, age, maxAge, sh = 100.0, wind = { x: 1.0, z: 0.3 }, time = 0.0) {
  const safeMaxAge = Math.max(0.1, maxAge);
  const normAge = Math.max(0.0, Math.min(1.0, age / safeMaxAge));
  const isDead = age >= safeMaxAge;

  // Convective lift: vy = vy_base + 0.015 * SH
  const vyBase = 1.8;
  const vy = vyBase + 0.015 * Math.max(0.0, sh);

  // Upward trajectory with slight sinusoidal flutter
  const y = initialPos.y + vy * age + Math.sin(time * 3.5 + initialPos.x) * 0.15;

  // Downwind parabolic drift
  const x = initialPos.x + (wind.x || 0.0) * age * (1.1 + normAge * 0.6);
  const z = initialPos.z + (wind.z || 0.0) * age * (1.1 + normAge * 0.6);

  // High-frequency curl turbulence
  const turbX = Math.sin(y * 2.2 + time * 3.0 + initialPos.z) * 0.35 * (1.0 + normAge);
  const turbZ = Math.cos(y * 2.2 + time * 2.8 + initialPos.x) * 0.35 * (1.0 + normAge);

  // Dynamic thermal cooling: T(t) = 2200K * (1 - normAge)
  const temperature = Math.max(300.0, 2200.0 * (1.0 - normAge));
  const rgb = blackbody(temperature);

  // Alpha fade out near burnout
  const alpha = normAge > 0.85 ? (1.0 - normAge) / 0.15 : 1.0;

  return {
    position: { x: x + turbX, y, z: z + turbZ },
    temperature,
    color: rgb,
    alpha: Math.max(0.0, alpha),
    isDead
  };
}

/**
 * Calculates scientific flux arrow lengths, orientations, and colors
 * directly from research paper parameters (SH, LH, GPP, ET) across phases.
 */
export function calculateFluxMetrics(site, phase = 'during') {
  const safePhase = (phase || 'during').toLowerCase();
  const siteValues = (site && site.values && site.values[safePhase]) || {
    SH: 100, LH: 60, GPP: 3.0, ET: 2.0, VPD: 4.0, AOD: 1.2
  };

  // 1. Sensible Heat (SH): Upward convective thermal updraft
  // Base ~60 W/m2 -> surges to 100-145 W/m2 during fire (+32.7 to +40 W/m2)
  const shVal = siteValues.SH !== undefined ? siteValues.SH : 100;
  const shNorm = Math.max(0.0, Math.min(1.0, (shVal - 30.0) / 130.0));
  const shLength = 0.6 + shNorm * 3.2;

  // 2. Latent Heat (LH): Upward evaporative cooling moisture flux
  // Base ~90 W/m2 -> collapses to 50-60 W/m2 during fire (-33% drop)
  const lhVal = siteValues.LH !== undefined ? siteValues.LH : 60;
  const lhNorm = Math.max(0.0, Math.min(1.0, (lhVal - 20.0) / 100.0));
  const lhLength = 0.5 + lhNorm * 2.8;

  // 3. Gross Primary Productivity (GPP): Downward photosynthetic carbon uptake into canopy
  // Drops from ~5.0 gC/m2/d down to ~2.5-3.0 during fire
  const gppVal = siteValues.GPP !== undefined ? siteValues.GPP : 3.0;
  const gppNorm = Math.max(0.0, Math.min(1.0, gppVal / 6.0));
  const gppLength = 0.5 + gppNorm * 2.6;

  // 4. Evapotranspiration (ET): Upward canopy transpiration loss (mm/d)
  const etVal = siteValues.ET !== undefined ? siteValues.ET : 2.0;
  const etNorm = Math.max(0.0, Math.min(1.0, etVal / 4.0));
  const etLength = 0.4 + etNorm * 2.2;

  // 5. Aerosol Optical Depth (AOD_550): Surges >3x during fire (0.4 -> 1.2+)
  const aodVal = siteValues.AOD !== undefined ? siteValues.AOD : 1.2;

  return {
    SH: { value: shVal, normalized: shNorm, length: shLength, direction: 'up', color: '#ff5722' },
    LH: { value: lhVal, normalized: lhNorm, length: lhLength, direction: 'up', color: '#00e5ff' },
    GPP: { value: gppVal, normalized: gppNorm, length: gppLength, direction: 'down', color: '#76ff03' },
    ET: { value: etVal, normalized: etNorm, length: etLength, direction: 'up', color: '#4fc3f7' },
    AOD: { value: aodVal }
  };
}

// ============================================================================
// 2. GLSL SHADER SOURCES (Optimized for Mobile WebGL & ACES Filmic Tone Mapping)
// ============================================================================

export const FIRE_VERTEX_SHADER = /* glsl */ `
  varying vec3 vWorldPosition;
  varying vec3 vLocalPosition;

  void main() {
    vLocalPosition = position;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const FIRE_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  varying vec3 vWorldPosition;
  varying vec3 vLocalPosition;

  uniform vec3 uCameraPos;
  uniform float uTime;
  uniform vec3 uWind;          // Wind velocity vector W
  uniform float uFireIntensity;// Scaled by Sensible Heat (SH)
  uniform vec3 uBurnCenter;
  uniform float uBurnRadius;
  uniform float uFlameHeight;

  // 3D Simplex noise generator
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  // 4-Octave Fractional Brownian Motion with Convective Wind Updraft
  float fbm(vec3 p) {
    float total = 0.0;
    float amp = 0.55;
    float freq = 1.0;
    for (int i = 0; i < 4; i++) {
      total += amp * snoise(p * freq);
      freq *= 2.1;
      amp *= 0.48;
    }
    return total;
  }

  // Physical Planckian Blackbody Radiation Spectrum (800K -> 2400K)
  vec3 blackbodyEmission(float kelvin) {
    float t = clamp(kelvin, 600.0, 3000.0) / 1000.0;
    vec3 col;
    // Red channel: deep cherry glow
    col.r = clamp(t < 1.0 ? t * 1.2 : 1.0 + (t - 1.0) * 0.1, 0.0, 1.4);
    // Green channel: vivid orange through yellow
    col.g = clamp(t < 0.9 ? 0.0 : (t - 0.9) * 0.75 + pow(max(0.0, t - 1.2), 1.5) * 0.5, 0.0, 1.2);
    // Blue channel: radiant white core
    col.b = clamp(t < 1.5 ? 0.0 : pow((t - 1.5) * 1.1, 2.0), 0.0, 1.0);
    return col;
  }

  // Evaluate flame density field in world coordinates relative to burn center
  float evaluateDensity(vec3 p) {
    vec3 rel = p - uBurnCenter;
    float r = length(rel.xz) / max(0.1, uBurnRadius);
    float h = rel.y / max(0.1, uFlameHeight);

    // Convective upward velocity (vy ~ 3.2 m/s) and wind shear tilt
    vec3 convPos = rel;
    convPos.y -= uTime * 3.2;
    convPos.xz -= uWind.xz * (uTime * 1.5 + rel.y * 0.4);

    // Turbulent domain warping
    float warp = snoise(convPos * 0.8 + vec3(0.0, -uTime * 1.2, 0.0));
    vec3 warpedPos = convPos * 1.4 + vec3(warp * 0.6);

    float n = fbm(warpedPos);

    // Radial flame envelope
    float radialMask = smoothstep(1.05, 0.15, r);

    // Vertical flame taper
    float verticalMask = smoothstep(-0.2, 0.25, rel.y) * smoothstep(1.05, 0.25, h);

    float density = (n * 0.5 + 0.5) * radialMask * verticalMask * uFireIntensity;
    return clamp(density, 0.0, 1.0);
  }

  void main() {
    vec3 rayOrigin = vWorldPosition;
    vec3 rayDir = normalize(vWorldPosition - uCameraPos);

    // Raymarch steps (dynamic: 16 in Light mode, 36 in Full mode)
    #ifndef STEPS
    #define STEPS 16
    #endif
    const int STEPS_COUNT = STEPS;
    float maxDist = uBurnRadius * 2.2;
    float stepLength = maxDist / float(STEPS_COUNT);

    vec4 accumColor = vec4(0.0);
    vec3 p = rayOrigin;

    for (int i = 0; i < STEPS_COUNT; i++) {
      vec3 rel = p - uBurnCenter;
      float r = length(rel.xz) / max(0.1, uBurnRadius);
      float h = rel.y / max(0.1, uFlameHeight);

      if (r <= 1.05 && h >= -0.15 && h <= 1.05) {
        float d = evaluateDensity(p);
        if (d > 0.02) {
          // Temperature mapped from core density and vertical height: 800K -> 2400K
          float temp = 800.0 + d * 1400.0 + (1.0 - clamp(h, 0.0, 1.0)) * 200.0;
          vec3 emission = blackbodyEmission(temp);

          // Extinction & volumetric opacity
          float stepAlpha = clamp(d * stepLength * 4.2, 0.0, 1.0);

          // Front-to-back volumetric integration
          accumColor.rgb += (1.0 - accumColor.a) * emission * stepAlpha * 1.6;
          accumColor.a += (1.0 - accumColor.a) * stepAlpha;

          // Early opacity breakout optimization
          if (accumColor.a > 0.96) break;
        }
      }
      p += rayDir * stepLength;
    }

    if (accumColor.a <= 0.01) discard;

    // Soot absorption periphery
    vec3 sootColor = vec3(0.06, 0.05, 0.05);
    float normH = clamp((vWorldPosition.y - uBurnCenter.y) / max(0.1, uFlameHeight), 0.0, 1.0);
    accumColor.rgb = mix(accumColor.rgb, sootColor, smoothstep(0.65, 1.0, normH) * 0.35);

    gl_FragColor = vec4(accumColor.rgb, accumColor.a);
  }
`;

// ============================================================================
// 3. PROCEDURAL TEXTURES (Offscreen Canvas2D)
// ============================================================================

/**
 * Generates an incandescent point-glow canvas texture for particle blending.
 */
function createPointGlowTexture() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.25, 'rgba(255, 200, 100, 0.85)');
  grad.addColorStop(0.6, 'rgba(255, 70, 15, 0.45)');
  grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/**
 * Generates a soft billowing smoke puff canvas texture.
 */
function createSmokePuffTexture() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0.0, 'rgba(230, 225, 220, 0.95)');
  grad.addColorStop(0.35, 'rgba(180, 175, 170, 0.65)');
  grad.addColorStop(0.7, 'rgba(120, 115, 110, 0.25)');
  grad.addColorStop(1.0, 'rgba(50, 48, 45, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// ============================================================================
// 4. VOLUMETRIC RAYMARCHED FIRE
// ============================================================================

/**
 * Creates the 3D GPU raymarched volumetric fire volume.
 *
 * @param {{x: number, y: number, z: number}} burnCenter - Center coordinate of active burn zone.
 * @param {number} [burnRadius=5.0] - Active burn zone radius in scene units.
 * @returns {object} { mesh, material, update, setBurnCenter, setBurnRadius, dispose }
 */
export function createVolumetricFire(burnCenter = { x: 1.5, y: 0.0, z: -1.0 }, burnRadius = 5.0) {
  const center = {
    x: burnCenter.x !== undefined ? burnCenter.x : 1.5,
    y: burnCenter.y !== undefined ? burnCenter.y : 0.0,
    z: burnCenter.z !== undefined ? burnCenter.z : -1.0
  };
  const radius = Math.max(0.5, burnRadius || 5.0);
  const flameHeight = 4.5;

  // Bounding cylinder enclosing the active fire volume
  const geom = new THREE.CylinderGeometry(radius * 1.15, radius * 1.15, flameHeight * 1.25, 32, 1, true);
  // Center cylinder geometry on vertical flame midpoint
  geom.translate(0, flameHeight * 0.5, 0);

  const material = new THREE.ShaderMaterial({
    defines: {
      STEPS: 16
    },
    vertexShader: FIRE_VERTEX_SHADER,
    fragmentShader: FIRE_FRAGMENT_SHADER,
    uniforms: {
      uTime: { value: 0.0 },
      uWind: { value: new THREE.Vector3(1.0, 0.0, 0.3) },
      uFireIntensity: { value: 1.0 },
      uBurnCenter: { value: new THREE.Vector3(center.x, center.y, center.z) },
      uBurnRadius: { value: radius },
      uFlameHeight: { value: flameHeight },
      uCameraPos: { value: new THREE.Vector3(0, 8, 16) }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide
  });

  const mesh = new THREE.Mesh(geom, material);
  mesh.name = 'VolumetricFire';
  mesh.position.set(center.x, center.y, center.z);

  return {
    mesh,
    material,
    update(time = 0.0, wind = { x: 1.0, y: 0.0, z: 0.3 }, intensity = 1.0, cameraPos = null) {
      material.uniforms.uTime.value = time;
      if (wind) {
        material.uniforms.uWind.value.set(
          wind.x !== undefined ? wind.x : 1.0,
          wind.y !== undefined ? wind.y : 0.0,
          wind.z !== undefined ? wind.z : 0.3
        );
      }
      material.uniforms.uFireIntensity.value = Math.max(0.0, intensity);
      if (cameraPos) {
        material.uniforms.uCameraPos.value.set(cameraPos.x, cameraPos.y, cameraPos.z);
      }
      mesh.visible = intensity > 0.01;
    },
    setBurnCenter(x, y, z) {
      center.x = x; center.y = y; center.z = z;
      mesh.position.set(x, y, z);
      material.uniforms.uBurnCenter.value.set(x, y, z);
    },
    setBurnRadius(r) {
      const safeR = Math.max(0.5, r);
      material.uniforms.uBurnRadius.value = safeR;
    },
    setSteps(stepCount) {
      const s = Math.max(8, Math.min(64, stepCount));
      if (!material.defines || material.defines.STEPS !== s) {
        material.defines = material.defines || {};
        material.defines.STEPS = s;
        material.needsUpdate = true;
      }
    },
    setPerfTier(tier) {
      this.setSteps(tier === 'full' ? 36 : 16);
    },
    dispose() {
      geom.dispose();
      material.dispose();
    }
  };
}

// ============================================================================
// 5. BUOYANT COOLING EMBERS (Sensible Heat Updraft & Lifecycle)
// ============================================================================

/**
 * Creates dynamic ember particle system (600-800 particles).
 *
 * @param {{x: number, y: number, z: number}} burnCenter - Active burn zone center.
 * @param {number} [count=700] - Total ember particles (600-800).
 * @returns {object} { mesh, material, update, setBurnCenter, dispose }
 */
export function createEmbers(burnCenter = { x: 1.5, y: 0.0, z: -1.0 }, count = 700) {
  const emberCount = Math.max(10, Math.min(2000, count || 700));
  const center = {
    x: burnCenter.x !== undefined ? burnCenter.x : 1.5,
    y: burnCenter.y !== undefined ? burnCenter.y : 0.0,
    z: burnCenter.z !== undefined ? burnCenter.z : -1.0
  };

  const geom = new THREE.PlaneGeometry(0.08, 0.08);
  const glowTexture = createPointGlowTexture();

  const material = new THREE.MeshBasicMaterial({
    map: glowTexture,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });

  const mesh = new THREE.InstancedMesh(geom, material, emberCount);
  mesh.name = 'BuoyantEmbers';

  // State buffers
  const initialPositions = new Float32Array(emberCount * 3);
  const ages = new Float32Array(emberCount);
  const maxAges = new Float32Array(emberCount);
  const seeds = new Float32Array(emberCount);

  function resetEmber(i, randomizeAge = false) {
    // Spawn within burn perimeter
    const r = Math.sqrt(Math.random()) * 4.2;
    const theta = Math.random() * Math.PI * 2.0;
    initialPositions[i * 3] = center.x + r * Math.cos(theta);
    initialPositions[i * 3 + 1] = center.y + Math.random() * 0.3;
    initialPositions[i * 3 + 2] = center.z + r * Math.sin(theta);

    maxAges[i] = 2.0 + Math.random() * 2.5;
    ages[i] = randomizeAge ? Math.random() * maxAges[i] : 0.0;
    seeds[i] = Math.random() * 100.0;
  }

  for (let i = 0; i < emberCount; i++) {
    resetEmber(i, true);
  }

  const dummyMatrix = new THREE.Matrix4();
  const dummyColor = new THREE.Color();

  return {
    mesh,
    material,
    update(dt = 0.016, time = 0.0, wind = { x: 1.0, z: 0.3 }, intensity = 1.0, sh = 100.0) {
      if (intensity <= 0.01) {
        mesh.visible = false;
        return;
      }
      mesh.visible = true;

      const safeDt = Math.max(0.001, Math.min(0.1, dt));
      const effectiveSH = sh !== undefined ? sh : (60.0 + intensity * 85.0);

      for (let i = 0; i < emberCount; i++) {
        ages[i] += safeDt;
        if (ages[i] >= maxAges[i]) {
          resetEmber(i, false);
        }

        const initPos = {
          x: initialPositions[i * 3],
          y: initialPositions[i * 3 + 1],
          z: initialPositions[i * 3 + 2]
        };

        const state = calculateEmberState(initPos, ages[i], maxAges[i], effectiveSH, wind, time + seeds[i]);

        // Scale pulses with thermal age
        const scale = (1.0 - (ages[i] / maxAges[i]) * 0.5) * (0.8 + 0.4 * Math.sin(time * 8.0 + seeds[i]));
        dummyMatrix.makeScale(scale, scale, scale);
        dummyMatrix.elements[12] = state.position.x;
        dummyMatrix.elements[13] = state.position.y;
        dummyMatrix.elements[14] = state.position.z;
        mesh.setMatrixAt(i, dummyMatrix);

        const cr = state.color.r * state.alpha * intensity;
        const cg = state.color.g * state.alpha * intensity;
        const cb = state.color.b * state.alpha * intensity;
        if (typeof dummyColor.setRGB === 'function') {
          dummyColor.setRGB(cr, cg, cb);
        } else {
          dummyColor.r = cr; dummyColor.g = cg; dummyColor.b = cb;
        }
        if (typeof mesh.setColorAt === 'function') {
          mesh.setColorAt(i, dummyColor);
        }
      }

      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    setBurnCenter(x, y, z) {
      center.x = x; center.y = y; center.z = z;
    },
    setMaxActive(n) {
      mesh.count = Math.max(1, Math.min(emberCount, n || emberCount));
    },
    dispose() {
      geom.dispose();
      material.dispose();
      if (glowTexture) glowTexture.dispose();
    }
  };
}

// ============================================================================
// 6. AERODYNAMIC SMOKE PLUME (AOD Coupling & Convective Lofting)
// ============================================================================

/**
 * Creates convective aerodynamic smoke plume scaling optical density with AOD_550.
 *
 * @param {{x: number, y: number, z: number}} burnCenter - Active burn zone center.
 * @param {number} [count=320] - Number of billowing smoke puffs.
 * @returns {object} { mesh, material, update, setBurnCenter, dispose }
 */
export function createSmokePlume(burnCenter = { x: 1.5, y: 0.0, z: -1.0 }, count = 320) {
  const puffCount = Math.max(10, Math.min(1000, count || 320));
  const center = {
    x: burnCenter.x !== undefined ? burnCenter.x : 1.5,
    y: burnCenter.y !== undefined ? burnCenter.y : 0.0,
    z: burnCenter.z !== undefined ? burnCenter.z : -1.0
  };

  const geom = new THREE.PlaneGeometry(1.0, 1.0);
  const puffTexture = createSmokePuffTexture();

  const material = new THREE.MeshBasicMaterial({
    map: puffTexture,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
    opacity: 0.75
  });

  const mesh = new THREE.InstancedMesh(geom, material, puffCount);
  mesh.name = 'AerodynamicSmokePlume';

  const initialPositions = new Float32Array(puffCount * 3);
  const progress = new Float32Array(puffCount);
  const speeds = new Float32Array(puffCount);
  const seeds = new Float32Array(puffCount);

  function resetPuff(i, randomize = false) {
    const r = Math.sqrt(Math.random()) * 2.8;
    const theta = Math.random() * Math.PI * 2.0;
    initialPositions[i * 3] = center.x + r * Math.cos(theta);
    initialPositions[i * 3 + 1] = center.y + Math.random() * 0.5;
    initialPositions[i * 3 + 2] = center.z + r * Math.sin(theta);

    progress[i] = randomize ? Math.random() : 0.0;
    speeds[i] = 0.08 + Math.random() * 0.06;
    seeds[i] = Math.random() * 50.0;
  }

  for (let i = 0; i < puffCount; i++) {
    resetPuff(i, true);
  }

  const dummyMatrix = new THREE.Matrix4();
  const dummyColor = new THREE.Color();

  return {
    mesh,
    material,
    update(dt = 0.016, time = 0.0, wind = { x: 1.0, z: 0.3 }, aod = 1.2) {
      const safeDt = Math.max(0.001, Math.min(0.1, dt));
      // Optical density coupling with Aerosol Optical Depth (AOD_550)
      const safeAOD = Math.max(0.1, aod !== undefined ? aod : 1.2);
      const opticalDensity = Math.min(0.92, Math.max(0.08, safeAOD * 0.65));
      material.opacity = opticalDensity;

      for (let i = 0; i < puffCount; i++) {
        progress[i] += speeds[i] * safeDt;
        if (progress[i] >= 1.0) {
          resetPuff(i, false);
        }

        const p = progress[i];
        // Vertical pyrocumulus lofting through PBL (height up to 18m)
        const y = initialPositions[i * 3 + 1] + p * 18.0;

        // Wind shear: horizontal drift increases with altitude
        const shearFactor = 0.4 + p * 2.2;
        const driftX = (wind.x || 1.0) * p * 12.0 * shearFactor;
        const driftZ = (wind.z || 0.3) * p * 12.0 * shearFactor;

        // Swirling billows
        const billowX = Math.sin(p * 6.28 + time * 0.8 + seeds[i]) * (0.4 + p * 1.5);
        const billowZ = Math.cos(p * 5.14 + time * 0.7 + seeds[i]) * (0.4 + p * 1.5);

        // Aerodynamic expansion from narrow column (0.8m) to wide plume (5.2m)
        const scale = 0.8 + p * 4.6;

        dummyMatrix.makeScale(scale, scale, scale);
        dummyMatrix.elements[12] = initialPositions[i * 3] + driftX + billowX;
        dummyMatrix.elements[13] = y;
        dummyMatrix.elements[14] = initialPositions[i * 3 + 2] + driftZ + billowZ;
        mesh.setMatrixAt(i, dummyMatrix);

        // Color transition: dark charcoal soot near base -> pyrocumulus grey/white at top
        const darkness = Math.max(0.22, 0.45 - p * 0.25);
        const sootR = darkness + Math.sin(seeds[i]) * 0.02;
        const sootG = darkness * 0.96;
        const sootB = darkness * 0.92;
        if (typeof dummyColor.setRGB === 'function') {
          dummyColor.setRGB(sootR, sootG, sootB);
        } else {
          dummyColor.r = sootR; dummyColor.g = sootG; dummyColor.b = sootB;
        }
        if (typeof mesh.setColorAt === 'function') {
          mesh.setColorAt(i, dummyColor);
        }
      }

      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    setBurnCenter(x, y, z) {
      center.x = x; center.y = y; center.z = z;
    },
    setMaxActive(n) {
      mesh.count = Math.max(1, Math.min(puffCount, n || puffCount));
    },
    dispose() {
      geom.dispose();
      material.dispose();
      if (puffTexture) puffTexture.dispose();
    }
  };
}

// ============================================================================
// 7. 3D ATMOSPHERE-BIOSPHERE FLUX VECTOR ARROWS
// ============================================================================

/**
 * Creates 3D animated energy flux vector arrows for SH, LH, GPP, and ET.
 * Scaled dynamically by active site and phase data.
 *
 * @returns {object} { group, update, setVariableFocus, dispose }
 */
export function createFluxArrows() {
  const group = new THREE.Group();
  group.name = 'FluxVectorArrows';

  // 4 Scientific flux stations across the landscape:
  // Center (Burn Zone), West Canopy, East Canopy, North Ridge
  const stations = [
    { name: 'BurnCenter', x: 1.5, y: 0.8, z: -1.0 },
    { name: 'WestCanopy', x: -5.0, y: 1.0, z: 0.0 },
    { name: 'EastCanopy', x: 5.0, y: 0.9, z: 2.0 },
    { name: 'NorthCanopy', x: 0.0, y: 1.2, z: 5.0 }
  ];

  const arrowRegistry = [];

  stations.forEach((st, stIdx) => {
    // 1. Sensible Heat (SH) arrow: orange-red, upward
    const shArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(st.x - 0.4, st.y, st.z),
      1.5,
      0xff5722,
      0.35,
      0.22
    );
    shArrow.userData = { variable: 'SH', basePos: new THREE.Vector3(st.x - 0.4, st.y, st.z), direction: 'up', station: st.name };
    group.add(shArrow);
    arrowRegistry.push(shArrow);

    // 2. Latent Heat (LH) arrow: cyan, upward
    const lhArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(st.x + 0.4, st.y, st.z),
      1.5,
      0x00e5ff,
      0.35,
      0.22
    );
    lhArrow.userData = { variable: 'LH', basePos: new THREE.Vector3(st.x + 0.4, st.y, st.z), direction: 'up', station: st.name };
    group.add(lhArrow);
    arrowRegistry.push(lhArrow);

    // 3. Gross Primary Productivity (GPP) arrow: green, downward (photosynthetic sink into canopy)
    const gppArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(st.x, st.y + 2.8, st.z - 0.4),
      1.5,
      0x76ff03,
      0.35,
      0.22
    );
    gppArrow.userData = { variable: 'GPP', basePos: new THREE.Vector3(st.x, st.y + 2.8, st.z - 0.4), direction: 'down', station: st.name };
    group.add(gppArrow);
    arrowRegistry.push(gppArrow);

    // 4. Evapotranspiration (ET) arrow: sky blue, upward
    const etArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(st.x, st.y, st.z + 0.4),
      1.2,
      0x4fc3f7,
      0.30,
      0.18
    );
    etArrow.userData = { variable: 'ET', basePos: new THREE.Vector3(st.x, st.y, st.z + 0.4), direction: 'up', station: st.name };
    group.add(etArrow);
    arrowRegistry.push(etArrow);
  });

  let activeFocus = null;

  return {
    group,
    arrowRegistry,
    update(site = null, phase = 'during', time = 0.0) {
      const metrics = calculateFluxMetrics(site, phase);

      arrowRegistry.forEach((arrow) => {
        const varName = arrow.userData.variable;
        const metric = metrics[varName];
        if (!metric) return;

        // Subtle biological energy pulsation
        const pulse = 1.0 + 0.08 * Math.sin(time * 3.5 + arrow.userData.basePos.x);
        const finalLength = metric.length * pulse;

        arrow.setLength(finalLength, Math.min(0.4, finalLength * 0.25), Math.min(0.25, finalLength * 0.15));

        // Downward arrows adjust base so tip points towards canopy
        if (arrow.userData.direction === 'down') {
          arrow.position.set(
            arrow.userData.basePos.x,
            arrow.userData.basePos.y + (finalLength - 1.5) * 0.5,
            arrow.userData.basePos.z
          );
        } else {
          arrow.position.copy(arrow.userData.basePos);
        }

        // Variable solo focus highlighting
        if (activeFocus && activeFocus !== varName) {
          arrow.visible = false;
        } else {
          arrow.visible = true;
        }
      });
    },
    setVariableFocus(varName = null) {
      activeFocus = varName;
      arrowRegistry.forEach((arrow) => {
        if (!activeFocus || arrow.userData.variable === activeFocus) {
          arrow.visible = true;
        } else {
          arrow.visible = false;
        }
      });
    },
    dispose() {
      arrowRegistry.forEach((arrow) => {
        if (arrow.line && arrow.line.geometry) arrow.line.geometry.dispose();
        if (arrow.line && arrow.line.material) arrow.line.material.dispose();
        if (arrow.cone && arrow.cone.geometry) arrow.cone.geometry.dispose();
        if (arrow.cone && arrow.cone.material) arrow.cone.material.dispose();
      });
      if (typeof group.clear === 'function') {
        group.clear();
      } else {
        while (group.children.length > 0) group.remove(group.children[0]);
      }
    }
  };
}
