/**
 * stratigraphy-dissection.js
 * Modular Three.js r160 ES module for the TakeApart.app Dissection Engine & Soil Stratigraphy Prism.
 *
 * Provides:
 * 1. createStratigraphyBlock(options):
 *    - 3D geological pedological soil prism block (20m x 20m x 3.5m depth).
 *    - 5 scientific pedological horizons (Oi, Oe/Oa, A, B, C) textured using
 *      generateStratigraphyTexture() from ./pbr-textures.js.
 *    - Top face with terrain micro-relief and PBR material.
 *    - Incandescent glowing subterranean duff ember veins in fire phase.
 * 2. StratigraphyController:
 *    - Manages 7 stratified layers (L0: Troposphere, L1: PBL, L2: Canopy, L3: Understory,
 *      L4: Litter, L5: Duff, L6: Geological Soil Block).
 *    - Spring-damper physics engine (k = 16.0, zeta = 0.75) with smooth explosion separation.
 *    - Interactive solo mode & holographic x-ray ghosting with Fresnel rim glow.
 *    - 3D callout data anchor points with research paper flux variables (SH, LH, GPP, AOD).
 * 3. Constants:
 *    - STRATA_DEFINITIONS, PEDOLOGICAL_HORIZONS, RESEARCH_PAPER_FLUXES.
 */

import * as THREE from 'three';
import { generateStratigraphyTexture } from './pbr-textures.js';

// ---------------------------------------------------------------------------
// Scientific Pedological Soil Horizons (0.0m to -3.5m depth)
// ---------------------------------------------------------------------------

export const PEDOLOGICAL_HORIZONS = [
  {
    code: 'Oi',
    name: 'Oi Horizon (Surface Litter)',
    depthRange: [0.0, 0.05],
    thickness: 0.05,
    unit: 'm',
    colorHex: '#442e1c',
    description: 'Loose surface litter: freshly fallen deciduous broadleaves (Shorea robusta), pine needles, and fine 1-hr/10-hr twigs.',
    combustionMode: 'Flaming combustion front (high rate of spread, rapid thermal release)'
  },
  {
    code: 'Oe/Oa',
    name: 'Oe/Oa Horizon (Duff / Smoldering Peat)',
    depthRange: [0.05, 0.35],
    thickness: 0.30,
    unit: 'm',
    colorHex: '#1c140e',
    description: 'Fermentation and humus layer: compacted acidic peat, partially decomposed organic matter, and subterranean ember holdover reservoir.',
    combustionMode: 'Smoldering combustion (flameless, incandescent glowing veins, high CO and PM2.5 emissions)'
  },
  {
    code: 'A',
    name: 'A Horizon (Topsoil)',
    depthRange: [0.35, 1.0],
    thickness: 0.65,
    unit: 'm',
    colorHex: '#342418',
    description: 'Organic-rich mineral topsoil permeated by living tree taproots and mycorrhizal root networks.',
    combustionMode: 'Thermal conduction zone (moisture vaporization, root baking)'
  },
  {
    code: 'B',
    name: 'B Horizon (Subsoil)',
    depthRange: [1.0, 2.2],
    thickness: 1.20,
    unit: 'm',
    colorHex: '#5f3420',
    description: 'Dense lateritic clay and silt horizon with weathered gravel pebbles and iron-aluminum sesquioxide accumulation.',
    combustionMode: 'Non-combustible mineral buffer'
  },
  {
    code: 'C',
    name: 'C Horizon (Parent Bedrock)',
    depthRange: [2.2, 3.5],
    thickness: 1.30,
    unit: 'm',
    colorHex: '#4b4642',
    description: 'Fractured metamorphic and sedimentary parent bedrock strata with structural joint fissures.',
    combustionMode: 'Geological bedrock foundation'
  }
];

// ---------------------------------------------------------------------------
// Scientific Stratigraphic Continuum Definitions (L0 to L6)
// ---------------------------------------------------------------------------

export const STRATA_DEFINITIONS = [
  {
    index: 0,
    id: 'troposphere',
    tierCode: 'L0',
    name: 'Free Troposphere',
    scientificName: 'Free Troposphere & Synoptic Winds',
    altitudeRange: '+14.0m to +22.0m',
    thickness: '8.0 m',
    thicknessMeters: 8.0,
    baseElevation: 8.0,
    explodeOffset: 12.0,
    anchorOffset: [0, 18.0, 0],
    description: 'Upper boundary layer governed by synoptic pressure gradients and long-range pyrogenic aerosol transport. Capping inversion layer traps buoyant smoke column.',
    role: 'Aerosol optical dispersion (AOD) and synoptic wind forcing.',
    fluxVariables: {
      SH: '5 - 15 W/m² (residual)',
      LH: '0 - 10 W/m²',
      GPP: '0 gC/m²/d',
      AOD: '0.40 (pre) -> 1.45 (plume transport)'
    }
  },
  {
    index: 1,
    id: 'pbl',
    tierCode: 'L1',
    name: 'Planetary Boundary Layer',
    scientificName: 'Planetary Boundary Layer (PBL) & Convective Plume',
    altitudeRange: '+6.0m to +14.0m',
    thickness: '8.0 m',
    thicknessMeters: 8.0,
    baseElevation: 5.0,
    explodeOffset: 7.0,
    anchorOffset: [0, 11.0, 0],
    description: 'Turbulent convective boundary layer. Driven by massive Sensible Heat (SH) flux injection, forming strong thermal updrafts (w_up ~ 8-15 m/s) and pyrocumulus cloud development.',
    role: 'Convective heat transport and smoke plume expansion.',
    fluxVariables: {
      SH: '60 W/m² (pre) -> 145 W/m² (fire peak)',
      LH: '90 W/m² (pre) -> 55 W/m² (fire collapse)',
      GPP: '0 gC/m²/d',
      AOD: '0.40 -> 1.35 (dense smoke column)'
    }
  },
  {
    index: 2,
    id: 'canopy',
    tierCode: 'L2',
    name: 'Overstory Canopy',
    scientificName: 'Overstory Canopy (Shorea robusta mature crowns)',
    altitudeRange: '+1.5m to +6.0m',
    thickness: '4.5 m',
    thicknessMeters: 4.5,
    baseElevation: 0.0,
    explodeOffset: 4.0,
    anchorOffset: [0, 3.8, 0],
    description: 'Continuous dominant canopy of Shorea robusta (Sal) trees (height 18-30m, canopy bulk density 0.22 kg/m³). Primary site of photosynthetic carbon assimilation and foliar transpiration.',
    role: 'GPP carbon sink, latent heat dissipation, and crown fire fuel stratum.',
    fluxVariables: {
      SH: '45 W/m² (pre) -> 110 W/m² (fire scorch)',
      LH: '85 W/m² (pre) -> 35 W/m² (-58% drop)',
      GPP: '5.0 gC/m²/d (pre) -> 2.5 gC/m²/d (fire)',
      AOD: 'Canopy interception layer'
    }
  },
  {
    index: 3,
    id: 'understory',
    tierCode: 'L3',
    name: 'Understory & Ladder Fuels',
    scientificName: 'Understory Shrubs & Ladder Fuel Stratum',
    altitudeRange: '+0.3m to +1.5m',
    thickness: '1.2 m',
    thicknessMeters: 1.2,
    baseElevation: 0.0,
    explodeOffset: 2.0,
    anchorOffset: [0, 1.2, 0],
    description: 'Dense intermediate shrub stratum (Flemingia chappar, Woodfordia fruticosa) and bamboo thickets (Dendrocalamus strictus). Bridges surface ground fire into upper tree crowns.',
    role: 'Vertical ladder fire bridge and high-intensity flaming combustion.',
    fluxVariables: {
      SH: 'Local thermal bridge',
      LH: 'Rapid foliar desiccation',
      GPP: 'Understory carbon uptake',
      AOD: 'Intense localized ember generation'
    }
  },
  {
    index: 4,
    id: 'litter',
    tierCode: 'L4',
    name: 'Surface Litter (Oi Horizon)',
    scientificName: 'Surface Litter Horizon (Oi - 1-hr & 10-hr fine fuels)',
    altitudeRange: '0.0m to +0.3m',
    thickness: '0.05 m',
    thicknessMeters: 0.05,
    baseElevation: 0.0,
    explodeOffset: 0.6,
    anchorOffset: [0, 0.25, 0],
    description: 'Freshly fallen deciduous broadleaves (Shorea robusta), pine needles, and fine twig litter (fuel load 6-12 t/ha). Cured 1-hr fuels drive rapid flame front spread and fire line intensity.',
    role: 'Primary flaming front carrier and fast fire spread corridor.',
    fluxVariables: {
      SH: 'Peak ignition front (>140 W/m²)',
      LH: 'Rapid moisture vaporization',
      GPP: '0 gC/m²/d',
      AOD: 'Primary particulate emission source'
    }
  },
  {
    index: 5,
    id: 'duff',
    tierCode: 'L5',
    name: 'Duff Layer (Oe/Oa Horizon)',
    scientificName: 'Fermentation & Humus Horizon (Oe/Oa - Duff Ground Fuel)',
    altitudeRange: '-0.05m to -0.35m',
    thickness: '0.30 m',
    thicknessMeters: 0.30,
    baseElevation: 0.0,
    explodeOffset: -0.8,
    anchorOffset: [0, -0.2, 0],
    description: 'Compacted fermentation and humus layer (depth 5-35 cm). Sustains smoldering flameless combustion, glowing ember veins, high carbon monoxide emissions, and prolonged subterranean heat retention.',
    role: 'Smoldering combustion reservoir and root baking zone.',
    fluxVariables: {
      SH: 'Conductive ground heat',
      LH: 'Subsurface moisture steam',
      GPP: '0 gC/m²/d',
      AOD: 'Dense smoldering smoke (CO/PM2.5)'
    }
  },
  {
    index: 6,
    id: 'soil',
    tierCode: 'L6',
    name: 'Pedological Soil Block',
    scientificName: 'Mineral Soil & Bedrock Strata (A, B, C Horizons)',
    altitudeRange: '-0.35m to -3.5m',
    thickness: '3.15 m',
    thicknessMeters: 3.15,
    baseElevation: 0.0,
    explodeOffset: -2.8,
    anchorOffset: [0, -1.8, 10.0],
    description: 'Solid 3D geological cutaway: A-horizon (organic topsoil & root system), B-horizon (lateritic clay and silt with gravel pebbles), and C-horizon (fractured metamorphic parent bedrock).',
    role: 'Hydrological retention, root anchorage, and bedrock foundation.',
    fluxVariables: {
      SH: 'Thermal conduction buffer',
      LH: 'Deep root aquifer uptake',
      GPP: 'Mycorrhizal root respiration',
      AOD: '0'
    }
  }
];

// ---------------------------------------------------------------------------
// Research Paper Energy Flux Matrix (Similipal Biosphere Reserve 2021)
// Reference: Shyam Sunder et al., Physics and Chemistry of the Earth 141 (2025)
// ---------------------------------------------------------------------------

export const RESEARCH_PAPER_FLUXES = {
  similipal2021: {
    citation: 'Shyam Sunder et al., Physics and Chemistry of the Earth 141 (2025) 104177',
    pre: {
      SH: 60.0, // W/m2
      LH: 90.0, // W/m2
      ET: 3.0,  // mm/day
      GPP: 5.0, // gC/m2/day
      VPD: 2.0, // kPa
      AOD: 0.40,
      bowenRatio: 0.67,
      evaporativeFraction: 0.60
    },
    during: {
      SH: 145.0, // W/m2 (+85 W/m2 surge)
      LH: 50.0,  // W/m2 (-33% drop)
      ET: 2.0,   // mm/day
      GPP: 2.5,  // gC/m2/day (-50% drop)
      VPD: 5.1,  // kPa (extreme aridity)
      AOD: 1.45, // (>3x surge)
      bowenRatio: 2.90,
      evaporativeFraction: 0.26
    },
    post: {
      SH: 75.0, // W/m2
      LH: 75.0, // W/m2
      ET: 2.5,  // mm/day (-53.3% recovery window)
      GPP: 4.0, // gC/m2/day
      VPD: 3.0, // kPa
      AOD: 0.60,
      bowenRatio: 1.00,
      evaporativeFraction: 0.50
    }
  }
};

// ---------------------------------------------------------------------------
// Holographic X-Ray Shader Injection
// ---------------------------------------------------------------------------

export function attachXRayFresnelShader(material, options = {}) {
  const fresnelColor = options.fresnelColor || new THREE.Color(0x4ca3ff);
  const fresnelPower = options.fresnelPower || 2.5;

  const prevCompile = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    if (prevCompile) prevCompile(shader, renderer);

    shader.uniforms.uXRayMode = { value: 0.0 };
    shader.uniforms.uXRayFresnelCol = { value: fresnelColor };
    shader.uniforms.uXRayFresnelPower = { value: fresnelPower };
    material.userData.shader = shader;

    if (!shader.fragmentShader.includes('vXRayNormal')) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
        varying vec3 vXRayNormal;
        varying vec3 vXRayViewDir;`
      );

      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vXRayNormal = normalize(normalMatrix * normal);
        vec4 mvPos = modelViewMatrix * vec4(transformed, 1.0);
        vXRayViewDir = normalize(-mvPos.xyz);`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
        varying vec3 vXRayNormal;
        varying vec3 vXRayViewDir;
        uniform float uXRayMode;
        uniform vec3 uXRayFresnelCol;
        uniform float uXRayFresnelPower;`
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        if (uXRayMode > 0.01) {
          float rim = 1.0 - max(0.0, dot(normalize(vXRayNormal), normalize(vXRayViewDir)));
          float fresnel = pow(rim, uXRayFresnelPower);
          vec3 ghost = uXRayFresnelCol * (0.4 + fresnel * 1.6);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, ghost, fresnel * 0.85 * uXRayMode);
        }`
      );
    }
  };

  return material;
}

// ---------------------------------------------------------------------------
// Pedological Stratigraphy Wall Material Generator
// ---------------------------------------------------------------------------

export function createStratigraphyMaterial(options = {}) {
  const textureSize = options.textureSize || 256;
  const textures = options.textures || generateStratigraphyTexture({ size: textureSize });
  const burnZone = options.burnZone || { x: 1.5, z: 0.0, r: 5.0 };
  const phase = options.phase || 'pre';

  const sideMaterial = new THREE.MeshStandardMaterial({
    map: textures.diffuseMap,
    normalMap: textures.normalMap,
    roughnessMap: textures.roughnessMap,
    roughness: 0.88,
    metalness: 0.05,
    side: THREE.DoubleSide
  });

  // Attach X-Ray fresnel capabilities
  attachXRayFresnelShader(sideMaterial, {
    fresnelColor: new THREE.Color(0x56aaff),
    fresnelPower: 2.2
  });

  // Inject glowing subterranean duff ember veins into side cross-section
  const baseCompile = sideMaterial.onBeforeCompile;
  sideMaterial.onBeforeCompile = (shader, renderer) => {
    if (baseCompile) baseCompile(shader, renderer);

    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uPhase = { value: phase === 'during' ? 1.0 : (phase === 'post' ? 2.0 : 0.0) };
    shader.uniforms.uBurnCenter = { value: new THREE.Vector3(burnZone.x, 0, burnZone.z) };
    shader.uniforms.uBurnRadius = { value: burnZone.r };
    shader.uniforms.uSmolderIntensity = { value: 1.0 };
    sideMaterial.userData.shader = shader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
      varying vec3 vStratWorldPos;`
    );

    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
      vStratWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
      varying vec3 vStratWorldPos;
      uniform float uTime;
      uniform float uPhase;
      uniform vec3 uBurnCenter;
      uniform float uBurnRadius;
      uniform float uSmolderIntensity;`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
      // Subterranean duff smoldering veins in Oe/Oa horizon (-0.05m to -0.35m depth)
      if (uPhase > 0.5) {
        float duffMask = smoothstep(0.0, -0.07, vStratWorldPos.y) * smoothstep(-0.45, -0.30, vStratWorldPos.y);
        if (duffMask > 0.01) {
          float distToBurn = length(vStratWorldPos.xz - uBurnCenter.xz);
          float burnMask = smoothstep(uBurnRadius * 1.35, uBurnRadius * 0.45, distToBurn);
          if (burnMask > 0.01) {
            float pulse = sin(uTime * 2.8 + vStratWorldPos.x * 4.5 + vStratWorldPos.y * 12.0) * 0.35 + 0.65;
            float veinNoise = sin(vStratWorldPos.x * 7.0) * cos(vStratWorldPos.z * 7.0 + vStratWorldPos.y * 16.0);
            float vein = smoothstep(0.18, 0.78, veinNoise);
            vec3 emberCol = mix(vec3(0.92, 0.22, 0.02), vec3(1.0, 0.68, 0.12), pulse);
            if (uPhase > 1.5) {
              // Post-fire: cooler, residual deep embers
              emberCol = mix(vec3(0.55, 0.12, 0.02), vec3(0.82, 0.28, 0.06), pulse);
            }
            gl_FragColor.rgb += emberCol * duffMask * burnMask * vein * 1.9 * uSmolderIntensity;
          }
        }
      }`
    );
  };

  return { material: sideMaterial, textures };
}

// ---------------------------------------------------------------------------
// 3D Geological Soil Prism Block Constructor
// ---------------------------------------------------------------------------

export function createStratigraphyBlock(options = {}) {
  const width = options.width || 20.0;
  const length = options.length || 20.0;
  const depth = options.depth || 3.5;
  const segmentsX = options.segmentsX || options.segments || 40;
  const segmentsZ = options.segmentsZ || options.segments || 40;
  const segmentsY = options.segmentsY || 24;

  const relief = options.relief !== undefined ? options.relief : 1.0;
  const reliefOffset = options.reliefOffset || 0.0;
  const burnZone = options.burnZone || { x: 1.5, z: 0.0, r: 5.0 };
  let currentPhase = options.phase || 'pre';

  // Relief function H(x, z)
  const defaultH = (x, z) => relief * (
    Math.sin(x * 0.35 + reliefOffset) * 1.2 +
    Math.cos(z * 0.3 + reliefOffset * 2.0) * 1.0 +
    Math.sin((x + z) * 0.8 + reliefOffset) * 0.3
  );
  const H = typeof options.heightFunc === 'function' ? options.heightFunc : defaultH;

  const group = new THREE.Group();
  group.name = 'StratigraphySoilPrismBlock';

  // 1. Top Face: Terrain micro-relief heightfield with PBR material
  const topGeo = new THREE.PlaneGeometry(width, length, segmentsX, segmentsZ);
  topGeo.rotateX(-Math.PI / 2);

  const topPos = topGeo.attributes.position;
  const topColors = new Float32Array(topPos.count * 3);

  for (let i = 0; i < topPos.count; i++) {
    const x = topPos.getX(i);
    const z = topPos.getZ(i);
    topPos.setY(i, H(x, z));
  }
  topGeo.computeVertexNormals();
  topGeo.setAttribute('color', new THREE.BufferAttribute(topColors, 3));

  const topMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.08,
    side: THREE.FrontSide
  });
  attachXRayFresnelShader(topMaterial, {
    fresnelColor: new THREE.Color(0x4ca3ff),
    fresnelPower: 2.2
  });

  const topMesh = new THREE.Mesh(topGeo, topMaterial);
  topMesh.name = 'StratigraphyTopTerrainMesh';
  topMesh.receiveShadow = true;
  group.add(topMesh);

  // Helper to color top terrain based on phase & burn zone
  function updateTopColors(phase) {
    currentPhase = phase;
    const colAttr = topGeo.attributes.color;
    const p = topGeo.attributes.position;
    const c = new THREE.Color();

    const green = new THREE.Color(0x3b5d2a);
    const burnt = new THREE.Color(0x241810);
    const ember = new THREE.Color(0xff4500);

    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const y = p.getY(i);
      const dist = Math.hypot(x - burnZone.x, z - burnZone.z);
      const inside = dist < burnZone.r + Math.sin(x * 1.2 + z) * 0.5;

      c.copy(green);
      // Subtle elevation shading
      c.r = Math.max(0, Math.min(1, c.r + y * 0.02));
      c.g = Math.max(0, Math.min(1, c.g + y * 0.025));

      if (inside) {
        if (phase === 'during') {
          const coreDist = dist / burnZone.r;
          const emberMix = (1.0 - coreDist) * 0.8 + 0.2;
          c.lerpColors(burnt, ember, emberMix);
        } else if (phase === 'post') {
          c.copy(burnt);
        }
      }

      colAttr.setXYZ(i, c.r, c.g, c.b);
    }
    colAttr.needsUpdate = true;
  }
  updateTopColors(currentPhase);

  // 2. Vertical Side Skirts: 4 walls with pedological stratigraphy texture
  const { material: sideMaterial, textures: stratTextures } = createStratigraphyMaterial({
    textureSize: options.textureSize || 256,
    burnZone,
    phase: currentPhase
  });

  // Construct continuous vertical skirts matching terrain boundary H(x, z) exactly
  const sidesGeo = new THREE.BufferGeometry();

  // 4 perimeter edges: [startX, startZ, endX, endZ, normalX, normalZ]
  const halfW = width * 0.5;
  const halfL = length * 0.5;

  const edges = [
    // North edge: -halfW to +halfW at -halfL (facing -Z)
    { x0: -halfW, z0: -halfL, x1:  halfW, z1: -halfL, nx: 0, nz: -1, segs: segmentsX },
    // East edge: -halfL to +halfL at +halfW (facing +X)
    { x0:  halfW, z0: -halfL, x1:  halfW, z1:  halfL, nx: 1, nz:  0, segs: segmentsZ },
    // South edge: +halfW to -halfW at +halfL (facing +Z)
    { x0:  halfW, z0:  halfL, x1: -halfW, z1:  halfL, nx: 0, nz:  1, segs: segmentsX },
    // West edge: +halfL to -halfL at -halfW (facing -X)
    { x0: -halfW, z0:  halfL, x1: -halfW, z1: -halfL, nx: -1, nz: 0, segs: segmentsZ }
  ];

  let totalVerts = 0;
  for (const e of edges) totalVerts += (e.segs + 1) * (segmentsY + 1);

  const sidePositions = new Float32Array(totalVerts * 3);
  const sideNormals = new Float32Array(totalVerts * 3);
  const sideUvs = new Float32Array(totalVerts * 2);
  const sideIndices = [];

  let vertOffset = 0;

  for (let edgeIdx = 0; edgeIdx < edges.length; edgeIdx++) {
    const e = edges[edgeIdx];
    const baseIndex = vertOffset;
    const M = e.segs;
    const K = segmentsY;

    for (let k = 0; k <= K; k++) {
      const sy = k / K; // 0 at top, 1 at bottom
      for (let m = 0; m <= M; m++) {
        const sm = m / M; // 0 to 1 along wall
        const x = e.x0 + sm * (e.x1 - e.x0);
        const z = e.z0 + sm * (e.z1 - e.z0);

        const yTop = H(x, z);
        const yBottom = -depth;
        const y = yTop * (1.0 - sy) + yBottom * sy;

        const idx = (vertOffset) * 3;
        sidePositions[idx]     = x;
        sidePositions[idx + 1] = y;
        sidePositions[idx + 2] = z;

        sideNormals[idx]     = e.nx;
        sideNormals[idx + 1] = 0;
        sideNormals[idx + 2] = e.nz;

        const uvIdx = (vertOffset) * 2;
        sideUvs[uvIdx]     = sm;
        sideUvs[uvIdx + 1] = sy; // 0 at Oi top, 1 at C bedrock bottom

        vertOffset++;
      }
    }

    // Indices for this side wall
    for (let k = 0; k < K; k++) {
      for (let m = 0; m < M; m++) {
        const v00 = baseIndex + k * (M + 1) + m;
        const v10 = baseIndex + k * (M + 1) + (m + 1);
        const v01 = baseIndex + (k + 1) * (M + 1) + m;
        const v11 = baseIndex + (k + 1) * (M + 1) + (m + 1);

        // Standard counter-clockwise outward winding
        sideIndices.push(v00, v01, v10);
        sideIndices.push(v10, v01, v11);
      }
    }
  }

  sidesGeo.setAttribute('position', new THREE.BufferAttribute(sidePositions, 3));
  sidesGeo.setAttribute('normal', new THREE.BufferAttribute(sideNormals, 3));
  sidesGeo.setAttribute('uv', new THREE.BufferAttribute(sideUvs, 2));
  sidesGeo.setIndex(sideIndices);
  sidesGeo.computeVertexNormals();

  const sidesMesh = new THREE.Mesh(sidesGeo, sideMaterial);
  sidesMesh.name = 'StratigraphySideWallsMesh';
  sidesMesh.receiveShadow = true;
  group.add(sidesMesh);

  // 3. Bedrock Base Plate (Bottom Face at y = -depth)
  const bottomGeo = new THREE.PlaneGeometry(width, length);
  bottomGeo.rotateX(Math.PI / 2); // Normal pointing down (0, -1, 0)
  bottomGeo.translate(0, -depth, 0);

  const bottomMaterial = new THREE.MeshStandardMaterial({
    color: 0x302d2b,
    roughness: 0.95,
    metalness: 0.1,
    side: THREE.FrontSide
  });
  attachXRayFresnelShader(bottomMaterial, {
    fresnelColor: new THREE.Color(0x3880ff),
    fresnelPower: 2.0
  });

  const bottomMesh = new THREE.Mesh(bottomGeo, bottomMaterial);
  bottomMesh.name = 'StratigraphyBottomBedrockMesh';
  group.add(bottomMesh);

  // 4. Subterranean Duff Peat Slab Mesh (Oe/Oa Horizon at y = -0.2m)
  const duffGeo = new THREE.PlaneGeometry(width * 0.99, length * 0.99, 16, 16);
  duffGeo.rotateX(-Math.PI / 2);
  duffGeo.translate(0, -0.2, 0);

  const duffMaterial = new THREE.MeshStandardMaterial({
    color: 0x1f150e,
    roughness: 0.92,
    metalness: 0.05,
    side: THREE.DoubleSide
  });
  attachXRayFresnelShader(duffMaterial, {
    fresnelColor: new THREE.Color(0xff7722),
    fresnelPower: 2.0
  });

  const duffMesh = new THREE.Mesh(duffGeo, duffMaterial);
  duffMesh.name = 'StratigraphyDuffSlabMesh';
  group.add(duffMesh);

  // Primary soilMesh handle pointing to the top terrain surface
  const soilMesh = topMesh;

  // Runtime Update function
  function update(time, phase, explode = 0.0) {
    if (phase && phase !== currentPhase) {
      updateTopColors(phase);
      if (sideMaterial.userData.shader && sideMaterial.userData.shader.uniforms.uPhase) {
        sideMaterial.userData.shader.uniforms.uPhase.value =
          phase === 'during' ? 1.0 : (phase === 'post' ? 2.0 : 0.0);
      }
    }

    if (sideMaterial.userData.shader && sideMaterial.userData.shader.uniforms.uTime) {
      sideMaterial.userData.shader.uniforms.uTime.value = time || 0.0;
    }

    // Duff slab smoldering pulsation during fire phase
    if (currentPhase === 'during') {
      const pulse = Math.sin(time * 3.0) * 0.2 + 0.8;
      duffMaterial.color.setRGB(0.28 * pulse, 0.12 * pulse, 0.04);
    } else if (currentPhase === 'post') {
      duffMaterial.color.setHex(0x18120c);
    } else {
      duffMaterial.color.setHex(0x1f150e);
    }
  }

  function setPhase(phase) {
    update(0, phase, 0);
  }

  function setBurnZone(center, radius) {
    burnZone.x = center.x || 0;
    burnZone.z = center.z || 0;
    burnZone.r = radius || 4.0;
    updateTopColors(currentPhase);
    if (sideMaterial.userData.shader) {
      const u = sideMaterial.userData.shader.uniforms;
      if (u.uBurnCenter) u.uBurnCenter.value.set(burnZone.x, 0, burnZone.z);
      if (u.uBurnRadius) u.uBurnRadius.value = burnZone.r;
    }
  }

  function dispose() {
    topGeo.dispose();
    topMaterial.dispose();
    sidesGeo.dispose();
    sideMaterial.dispose();
    bottomGeo.dispose();
    bottomMaterial.dispose();
    duffGeo.dispose();
    duffMaterial.dispose();
    if (stratTextures) {
      if (stratTextures.diffuseMap?.dispose) stratTextures.diffuseMap.dispose();
      if (stratTextures.normalMap?.dispose) stratTextures.normalMap.dispose();
      if (stratTextures.roughnessMap?.dispose) stratTextures.roughnessMap.dispose();
    }
  }

  return {
    group,
    soilMesh,
    topMesh,
    sidesMesh,
    bottomMesh,
    duffMesh,
    update,
    setPhase,
    setBurnZone,
    dispose,
    H,
    dimensions: { width, length, depth }
  };
}

// ---------------------------------------------------------------------------
// StratigraphyController: TakeApart.app 7-Stratum Dissection Engine
// ---------------------------------------------------------------------------

export class StratigraphyController {
  /**
   * @param {Object} options
   * @param {THREE.Scene|THREE.Group} [options.scene]
   * @param {Array} [options.layers]
   * @param {number} [options.springK=16.0] Spring stiffness
   * @param {number} [options.springZeta=0.75] Damping ratio (0.75 = sub-critically damped)
   * @param {number} [options.explode=0.0] Initial explosion factor (0.0 to 1.0)
   * @param {boolean} [options.autoCreateLayers=true] Auto-scaffold visual placeholders
   */
  constructor(options = {}) {
    this.scene = options.scene || null;
    this.springK = options.springK !== undefined ? options.springK : 16.0;
    this.springZeta = options.springZeta !== undefined ? options.springZeta : 0.75;

    // Derived critical damping constant: c = 2 * zeta * sqrt(k) = 2 * 0.75 * 4.0 = 6.0
    this.omegaN = Math.sqrt(this.springK);
    this.dampingC = 2.0 * this.springZeta * this.omegaN;

    this.explode = Math.max(0.0, Math.min(1.0, options.explode || 0.0));
    this.targetExplode = this.explode;
    this.velocity = 0.0;

    this.activeSoloIndex = -1; // -1: all layers active
    this.currentPhase = options.phase || 'pre';

    // Initialize 7 strata
    this.layers = [];
    this._initStrata(options.layers, options.autoCreateLayers !== false);
  }

  _initStrata(customLayers = null, autoCreate = true) {
    for (let i = 0; i < STRATA_DEFINITIONS.length; i++) {
      const meta = STRATA_DEFINITIONS[i];
      let group = null;

      if (customLayers && customLayers[i]) {
        group = customLayers[i].group || customLayers[i];
      } else if (autoCreate) {
        group = this._createDefaultStratumGroup(meta);
      } else {
        group = new THREE.Group();
      }

      if (group) {
        group.name = `Stratum_${meta.tierCode}_${meta.id}`;
        group.position.y = meta.baseElevation;
        if (this.scene && !group.parent) {
          this.scene.add(group);
        }
      }

      this.layers.push({
        index: i,
        id: meta.id,
        tierCode: meta.tierCode,
        name: meta.name,
        scientificName: meta.scientificName,
        altitudeRange: meta.altitudeRange,
        thickness: meta.thickness,
        thicknessMeters: meta.thicknessMeters,
        baseElevation: meta.baseElevation,
        explodeOffset: meta.explodeOffset,
        anchorOffset: new THREE.Vector3(...meta.anchorOffset),
        description: meta.description,
        role: meta.role,
        fluxVariables: meta.fluxVariables,
        group: group,
        userData: {}
      });
    }
  }

  _createDefaultStratumGroup(meta) {
    const grp = new THREE.Group();

    if (meta.index === 0) {
      // L0: Free Troposphere bounding atmospheric ceiling
      const mat = new THREE.MeshBasicMaterial({
        color: 0x99ccff,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      attachXRayFresnelShader(mat, { fresnelColor: new THREE.Color(0x88ccff) });
      const slab = new THREE.Mesh(new THREE.BoxGeometry(20, 0.1, 20), mat);
      slab.name = 'TroposphereSlab';
      grp.add(slab);
    } else if (meta.index === 1) {
      // L1: Planetary Boundary Layer atmospheric volume
      const mat = new THREE.MeshBasicMaterial({
        color: 0x7799ee,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      attachXRayFresnelShader(mat, { fresnelColor: new THREE.Color(0x6699ff) });
      const slab = new THREE.Mesh(new THREE.BoxGeometry(20, 0.1, 20), mat);
      slab.name = 'PBLSlab';
      grp.add(slab);
    }

    return grp;
  }

  // -------------------------------------------------------------------------
  // Layer Association Helpers
  // -------------------------------------------------------------------------

  setLayerGroup(index, group) {
    if (index >= 0 && index < this.layers.length) {
      this.layers[index].group = group;
      if (group) {
        group.position.y = this.layers[index].baseElevation + this.explode * this.layers[index].explodeOffset;
      }
      this._applyLayerVisibility();
    }
  }

  registerLayer(index, group, metadataOverrides = {}) {
    if (index >= 0 && index < this.layers.length) {
      this.setLayerGroup(index, group);
      Object.assign(this.layers[index], metadataOverrides);
    }
  }

  bindStratigraphyBlock(stratBlock) {
    if (stratBlock && stratBlock.group) {
      // L6 is the Geological Soil Block
      this.setLayerGroup(6, stratBlock.group);
      stratBlock.group.position.y = this.layers[6].baseElevation + this.explode * this.layers[6].explodeOffset;
    }
  }

  bindForest(canopyGroup, understoryGroup, litterGroup) {
    if (canopyGroup) this.setLayerGroup(2, canopyGroup);
    if (understoryGroup) this.setLayerGroup(3, understoryGroup);
    if (litterGroup) this.setLayerGroup(4, litterGroup);
  }

  // -------------------------------------------------------------------------
  // Spring-Damper Physics Engine
  // -------------------------------------------------------------------------

  setExplodeTarget(val) {
    this.targetExplode = Math.max(0.0, Math.min(1.0, Number(val) || 0.0));
  }

  setExplode(val, immediate = false) {
    const clamped = Math.max(0.0, Math.min(1.0, Number(val) || 0.0));
    this.targetExplode = clamped;
    if (immediate) {
      this.explode = clamped;
      this.velocity = 0.0;
      this._applyLayerPositions();
    }
  }

  getExplode() {
    return this.explode;
  }

  getTargetExplode() {
    return this.targetExplode;
  }

  update(dt = 0.016) {
    const clampedDt = Math.min(Math.max(dt || 0.0, 0.0), 0.1);

    if (clampedDt > 0.0) {
      // 2-substep numerical integration to prevent numerical divergence
      const subSteps = clampedDt > 0.02 ? 2 : 1;
      const sdt = clampedDt / subSteps;

      for (let s = 0; s < subSteps; s++) {
        const displacement = this.explode - this.targetExplode;
        // Hooke's Law + viscous damping: F = -k * x - c * v
        const springForce = -this.springK * displacement - this.dampingC * this.velocity;
        this.velocity += springForce * sdt;
        this.explode += this.velocity * sdt;
      }
    }

    // Clean snap to rest when near equilibrium
    if (this.targetExplode === 0.0 && this.explode <= 0.001) {
      this.explode = 0.0;
      this.velocity = 0.0;
    } else if (Math.abs(this.explode - this.targetExplode) < 0.002 && Math.abs(this.velocity) < 0.015) {
      this.explode = this.targetExplode;
      this.velocity = 0.0;
    }

    this._applyLayerPositions();
    return this.explode;
  }

  _applyLayerPositions() {
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      if (layer && layer.group) {
        layer.group.position.y = layer.baseElevation + this.explode * layer.explodeOffset;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Solo Mode & Holographic X-Ray Ghosting
  // -------------------------------------------------------------------------

  setSoloLayer(index) {
    const prev = this.activeSoloIndex;
    const target = Number(index);
    this.activeSoloIndex = (target >= 0 && target < this.layers.length) ? target : -1;
    this._applyLayerVisibility();
    return this.activeSoloIndex;
  }

  getSoloLayer() {
    return this.activeSoloIndex;
  }

  isLayerSolo(index) {
    return this.activeSoloIndex === index;
  }

  isLayerGhosted(index) {
    return this.activeSoloIndex !== -1 && this.activeSoloIndex !== index;
  }

  _applyLayerVisibility() {
    const soloIdx = this.activeSoloIndex;

    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      if (!layer || !layer.group) continue;

      const isSolo = (soloIdx === -1) || (soloIdx === i);

      layer.group.traverse((child) => {
        if (child.isMesh && child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];

          for (const mat of materials) {
            // Cache initial baseline properties
            if (!mat.userData.__origPbr) {
              mat.userData.__origPbr = {
                opacity: mat.opacity !== undefined ? mat.opacity : 1.0,
                transparent: mat.transparent !== undefined ? mat.transparent : false,
                depthWrite: mat.depthWrite !== undefined ? mat.depthWrite : true
              };
            }

            const orig = mat.userData.__origPbr;

            if (isSolo) {
              // Target stratum: 100% PBR opacity & full depth buffer writing
              mat.opacity = orig.opacity;
              mat.transparent = orig.transparent;
              mat.depthWrite = true;

              if (mat.userData.shader && mat.userData.shader.uniforms.uXRayMode) {
                mat.userData.shader.uniforms.uXRayMode.value = 0.0;
              }
            } else {
              // Inactive stratum: Holographic ghost x-ray mode (10% opacity, depthWrite=false)
              mat.transparent = true;
              mat.opacity = 0.10;
              mat.depthWrite = false;

              if (mat.userData.shader && mat.userData.shader.uniforms.uXRayMode) {
                mat.userData.shader.uniforms.uXRayMode.value = 1.0;
              }
            }
            mat.needsUpdate = true;
          }
        }
      });
    }
  }

  // -------------------------------------------------------------------------
  // 3D Callout Data Anchor Points
  // -------------------------------------------------------------------------

  getAnchorPosition(index, target = new THREE.Vector3()) {
    const layer = this.layers[index];
    if (!layer) return target.set(0, 0, 0);

    target.copy(layer.anchorOffset);
    if (layer.group) {
      if (typeof layer.group.updateMatrixWorld === 'function') {
        layer.group.updateMatrixWorld(true);
      }
      layer.group.localToWorld(target);
    }
    return target;
  }

  getAllAnchorPositions() {
    return this.layers.map((layer, i) => ({
      index: i,
      id: layer.id,
      tierCode: layer.tierCode,
      name: layer.name,
      worldPosition: this.getAnchorPosition(i)
    }));
  }

  getStratumMetadata(index) {
    return this.layers[index] || null;
  }

  getStratumCallout(index, phase = this.currentPhase) {
    const layer = this.layers[index];
    if (!layer) return null;

    const fluxTable = RESEARCH_PAPER_FLUXES.similipal2021[phase] || RESEARCH_PAPER_FLUXES.similipal2021.pre;

    return {
      index: layer.index,
      id: layer.id,
      tierCode: layer.tierCode,
      name: layer.name,
      scientificName: layer.scientificName,
      altitudeRange: layer.altitudeRange,
      thickness: layer.thickness,
      thicknessMeters: layer.thicknessMeters,
      description: layer.description,
      role: layer.role,
      baseElevation: layer.baseElevation,
      currentElevation: layer.group ? layer.group.position.y : layer.baseElevation,
      worldAnchor: this.getAnchorPosition(index),
      fluxVariables: layer.fluxVariables,
      researchPaperFluxes: {
        phase: phase,
        SH: `${fluxTable.SH} W/m²`,
        LH: `${fluxTable.LH} W/m²`,
        GPP: `${fluxTable.GPP} gC/m²/d`,
        AOD: `${fluxTable.AOD}`,
        bowenRatio: `${fluxTable.bowenRatio}`,
        evaporativeFraction: `${fluxTable.evaporativeFraction}`
      },
      isSolo: this.isLayerSolo(index),
      isGhosted: this.isLayerGhosted(index)
    };
  }

  getAllStrataData(phase = this.currentPhase) {
    return this.layers.map((_, i) => this.getStratumCallout(i, phase));
  }

  dispose() {
    this.setSoloLayer(-1);
    for (const layer of this.layers) {
      if (layer.group && this.scene) {
        this.scene.remove(layer.group);
      }
    }
    this.layers = [];
  }
}
