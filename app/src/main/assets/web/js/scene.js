import * as THREE from 'three';
import { createForest, createUnderstory, createSurfaceLitter } from './forest-generator.js';
import { createStratigraphyBlock, StratigraphyController, STRATA_DEFINITIONS } from './stratigraphy-dissection.js';
import { createVolumetricFire, createEmbers, createSmokePlume, createFluxArrows } from './volumetric-fire.js';

/**
 * Seedable linear congruential generator for deterministic procedural site features.
 */
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/**
 * 32-bit FNV-1a hash function for strings.
 */
function hash(str) {
  let h = 2166136261;
  for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/**
 * Harmonic micro-relief terrain height function H(x, z).
 */
export const H = (x, z, off = 0, relief = 1.0) => {
  return relief * (
    Math.sin(x * 0.35 + off) * 1.2 +
    Math.cos(z * 0.3 + off * 2.0) * 1.0 +
    Math.sin((x + z) * 0.8 + off) * 0.3
  );
};

/**
 * Configure studio-grade lighting and PBR tone mapping.
 */
export function setupStudioLighting(scene, renderer) {
  if (renderer) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    if (THREE.SRGBColorSpace) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1.0;
    renderer.setPixelRatio(Math.min(dpr, 1.75));
    if (renderer.shadowMap) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
  }

  // Soft ambient sky/ground fill
  const ambient = new THREE.HemisphereLight(0x384a60, 0x141a20, 1.1);
  ambient.name = 'StudioAmbientLight';
  scene.add(ambient);

  // Key directional sunlight with high-precision soft shadows
  const sunKey = new THREE.DirectionalLight(0xfff5e6, 2.4);
  sunKey.name = 'StudioSunKeyLight';
  sunKey.position.set(12, 22, 10);
  sunKey.castShadow = true;
  if (sunKey.shadow) {
    sunKey.shadow.mapSize.width = 1024;
    sunKey.shadow.mapSize.height = 1024;
    sunKey.shadow.camera.near = 0.5;
    sunKey.shadow.camera.far = 60;
    sunKey.shadow.camera.left = -16;
    sunKey.shadow.camera.right = 16;
    sunKey.shadow.camera.top = 16;
    sunKey.shadow.camera.bottom = -16;
    sunKey.shadow.bias = -0.0004;
    sunKey.shadow.normalBias = 0.02;
  }
  scene.add(sunKey);

  // Cool grazing rim light for edge highlights and foliage silhouettes
  const rimLight = new THREE.DirectionalLight(0x73a8ff, 1.6);
  rimLight.name = 'StudioRimLight';
  rimLight.position.set(-12, 10, -14);
  scene.add(rimLight);

  // Soft warm fill light from opposite angle to prevent pitch-black shadows
  const fillLight = new THREE.DirectionalLight(0xffeedd, 0.6);
  fillLight.name = 'StudioFillLight';
  fillLight.position.set(-6, 8, 8);
  scene.add(fillLight);

  return { ambient, sunKey, rimLight, fillLight };
}

/**
 * Initialize the 3D world container and studio environment.
 */
export function makeWorld(scene, renderer = null) {
  const world = {
    scene,
    renderer,
    group: new THREE.Group(),
    systems: {},
    stratigraphy: null,
    layers: null,
    forest: null,
    understory: null,
    litter: null,
    stratBlock: null,
    fire: null,
    embers: null,
    smoke: null,
    flux: null,
    site: null,
    burn: { x: 1.5, z: -1.0, r: 4.5 },
    H: (x, z) => 0
  };
  world.group.name = 'WorldRootGroup';
  scene.add(world.group);

  setupStudioLighting(scene, renderer);

  return world;
}

/**
 * Safely dispose a Three.js subsystem.
 */
function disposeSystem(sys) {
  if (!sys) return;
  try {
    if (typeof sys.dispose === 'function') {
      sys.dispose();
    } else if (sys.geometry && typeof sys.geometry.dispose === 'function') {
      sys.geometry.dispose();
    }
  } catch (err) {
    console.warn('System disposal warning:', err);
  }
}

/**
 * Reconstruct the 3D scene for the given ecological monitoring site.
 */
export function buildSite(world, site) {
  // 1. Clean up previous subsystems
  if (world.stratBlock) disposeSystem(world.stratBlock);
  if (world.forest) disposeSystem(world.forest);
  if (world.understory) disposeSystem(world.understory);
  if (world.litter) disposeSystem(world.litter);
  if (world.fire) disposeSystem(world.fire);
  if (world.embers) disposeSystem(world.embers);
  if (world.smoke) disposeSystem(world.smoke);
  if (world.flux) disposeSystem(world.flux);
  if (world.stratigraphy) disposeSystem(world.stratigraphy);

  world.group.clear();
  world.site = site;

  // 2. Site parameters & micro-relief
  const r = rng(hash(site.id || 'similipal'));
  const off = r() * 10;
  const relief = site.relief ?? 1.0;
  const density = site.forest_density ?? 0.8;
  const burnZone = site.burn_zone || { x: 1.5, z: -1.0, r: 4.5 };
  const terrainH = (x, z) => H(x, z, off, relief);

  world.burn = burnZone;
  world.H = terrainH;

  // 3. Create 3D Solid Pedological Soil Stratigraphy Block (20m x 20m x 3.5m)
  const stratBlock = createStratigraphyBlock({
    width: 20,
    length: 20,
    depth: 3.5,
    terrainH,
    burnZone,
    textureSize: 256,
    segmentsX: 32,
    segmentsZ: 32,
    segmentsY: 10
  });
  world.stratBlock = stratBlock;

  // Extract Duff Peat Slab Mesh to Stratum L5
  const duffGroup = new THREE.Group();
  duffGroup.name = 'StratumGroup_Duff';
  if (stratBlock.duffMesh) {
    stratBlock.group.remove(stratBlock.duffMesh);
    duffGroup.add(stratBlock.duffMesh);
  }
  world.duffGroup = duffGroup;

  // 4. Create Procedural Multi-Component Forest (Canopy Stratum L2)
  const treeCount = Math.round(850 * density);
  const forest = createForest({
    count: treeCount,
    bounds: { minX: -9.2, maxX: 9.2, minZ: -9.2, maxZ: 9.2 },
    terrainH,
    burnZone,
    textureSize: 256,
    seed: hash(site.id + '_trees')
  });
  world.forest = forest;

  // 5. Create Understory Ladder Fuels & Shrubs (Stratum L3)
  const shrubCount = Math.round(420 * density);
  const understory = createUnderstory({
    count: shrubCount,
    bounds: { minX: -9.2, maxX: 9.2, minZ: -9.2, maxZ: 9.2 },
    terrainH,
    burnZone,
    textureSize: 256,
    seed: hash(site.id + '_shrubs')
  });
  world.understory = understory;

  // 6. Create Surface Litter Bed (Oi Horizon Fine Fuels - Stratum L4)
  const litter = createSurfaceLitter({
    count: 1200,
    bounds: { minX: -9.5, maxX: 9.5, minZ: -9.5, maxZ: 9.5 },
    terrainH,
    burnZone,
    textureSize: 256,
    seed: hash(site.id + '_litter')
  });
  world.litter = litter;

  // 7. Volumetric Raymarched Fire, Embers, Smoke Plume & Flux Arrows
  const burnElevation = terrainH(burnZone.x, burnZone.z);
  const burnCenter3D = { x: burnZone.x, y: burnElevation, z: burnZone.z };

  // 3D GPU raymarched volumetric fire volume
  const fire = createVolumetricFire(burnCenter3D, burnZone.r);
  world.fire = fire;

  // Convective buoyant cooling embers (Sensible Heat driven)
  const embers = createEmbers(burnCenter3D, 450);
  world.embers = embers;

  // Convective aerodynamic smoke plume (Aerosol Optical Depth driven)
  const smoke = createSmokePlume(burnCenter3D);
  world.smoke = smoke;

  // Atmosphere-Biosphere Flux Coupling Vector Arrows
  const flux = createFluxArrows();
  flux.setVariableFocus('SH'); // Default to focused variable to stay under draw call budget
  world.flux = flux;

  // 8. Assemble the 7 Ecological Strata with StratigraphyController
  const ctrl = new StratigraphyController({
    scene: world.group,
    springK: 16.0,
    springZeta: 0.75,
    explode: 0.0,
    autoCreateLayers: false
  });

  const attachStratum = (idx, grp) => {
    const prevGrp = ctrl.layers[idx]?.group;
    if (prevGrp && prevGrp.parent) {
      prevGrp.parent.remove(prevGrp);
    }
    ctrl.setLayerGroup(idx, grp);
    if (grp && !grp.parent) {
      world.group.add(grp);
    }
  };

  // Stratum 0 (L0: Troposphere - Upper atmosphere & Eddy covariance flux grid)
  attachStratum(0, flux.group);

  // Stratum 1 (L1: Planetary Boundary Layer - Convective pyrocumulus smoke plume)
  const pblGroup = new THREE.Group();
  pblGroup.name = 'StratumGroup_PBL';
  pblGroup.add(smoke.mesh);
  attachStratum(1, pblGroup);

  // Stratum 2 (L2: Overstory Canopy - Shorea robusta crown crowns)
  attachStratum(2, forest.group);

  // Stratum 3 (L3: Understory & Ladder Fuels - Bamboo thickets & shrubs)
  attachStratum(3, understory.group);

  // Stratum 4 (L4: Surface Litter - Fresh dry leaves, twigs & active flaming front)
  const litterLayerGroup = new THREE.Group();
  litterLayerGroup.name = 'StratumGroup_LitterAndFlames';
  litterLayerGroup.add(litter.group);
  litterLayerGroup.add(fire.mesh);
  litterLayerGroup.add(embers.mesh);
  attachStratum(4, litterLayerGroup);

  // Stratum 5 (L5: Duff Layer - Oe/Oa smoldering fermentation peat slab)
  attachStratum(5, duffGroup);

  // Stratum 6 (L6: Geological Soil Block - A/B/C pedological horizons & bedrock)
  attachStratum(6, stratBlock.group);

  world.stratigraphy = ctrl;
  world.layers = ctrl.layers; // Backwards-compatible reference

  // Register all active simulation subsystems in world.systems
  world.systems = {
    forest,
    understory,
    litter,
    stratBlock,
    fire,
    embers,
    smoke,
    flux,
    stratigraphy: ctrl
  };

  return world;
}

/**
 * Per-frame animation and simulation update loop.
 */
export function updateSystems(world, k, dt, time = 0, options = {}) {
  const safeDt = Math.max(0.001, Math.min(0.06, dt || 0.016));
  const t = typeof time === 'number' ? time : performance.now() * 0.001;

  const phase = options.phase || 'during';
  const site = options.site || world.site;
  const variable = options.variable || 'SH';
  const cameraPos = options.cameraPos || null;

  // Dynamic wind vector with gentle turbulence
  const windAngle = t * 0.15;
  const windSpeed = 1.8 + 0.4 * Math.sin(t * 0.3);
  const windDir = new THREE.Vector3(Math.cos(windAngle), 0, Math.sin(windAngle)).normalize();
  const wind2D = { x: windDir.x * windSpeed, z: windDir.z * windSpeed };

  // Calculate burn progress from phase (0 = green/pre, 0.65 = burning, 1.0 = charred/post)
  let burnProgress = 0.0;
  let fireIntensity = 0.0;
  if (phase === 'during') {
    burnProgress = 0.65;
    fireIntensity = k && typeof k.fire === 'number' ? k.fire : 1.0;
  } else if (phase === 'post') {
    burnProgress = 1.0;
    fireIntensity = 0.0;
  } else {
    burnProgress = 0.0;
    fireIntensity = 0.0;
  }

  // Sensible Heat (SH) for convective ember lofting
  let shValue = 100.0;
  let aodValue = 1.2;
  if (site && site.values && site.values[phase]) {
    shValue = site.values[phase].SH ?? 100.0;
    aodValue = site.values[phase].AOD ?? 1.2;
  } else if (k && typeof k.aod === 'number') {
    aodValue = 0.4 + k.aod * 1.0;
  }

  // 1. Update Stratigraphy Soil Block
  if (world.stratBlock && typeof world.stratBlock.update === 'function') {
    const explodeVal = world.stratigraphy ? world.stratigraphy.getExplode() : 0.0;
    world.stratBlock.update(t, phase, explodeVal);
  }

  // 2. Update Realistic Forest Canopy (wind sway & SSS)
  if (world.forest && typeof world.forest.update === 'function') {
    world.forest.update(t, windSpeed, windDir, burnProgress);
  }

  // 3. Update Understory Ladder Fuels
  if (world.understory && typeof world.understory.update === 'function') {
    world.understory.update(t, burnProgress);
  }

  // 4. Update Surface Litter Bed
  if (world.litter && typeof world.litter.update === 'function') {
    world.litter.update(burnProgress);
  }

  // 5. Update 3D GPU Raymarched Volumetric Fire
  if (world.fire) {
    if (fireIntensity > 0.01) {
      world.fire.mesh.visible = true;
      world.fire.update(t, { x: wind2D.x * 0.4, y: 0.0, z: wind2D.z * 0.4 }, fireIntensity, cameraPos);
    } else {
      world.fire.mesh.visible = false;
    }
  }

  // 6. Update Buoyant Cooling Embers
  if (world.embers) {
    if (fireIntensity > 0.01) {
      world.embers.mesh.visible = true;
      world.embers.update(safeDt, t, wind2D, fireIntensity, shValue);
    } else {
      world.embers.mesh.visible = false;
    }
  }

  // 7. Update Aerodynamic Convective Smoke Plume
  if (world.smoke) {
    world.smoke.update(safeDt, t, wind2D, aodValue);
  }

  // 8. Update Atmosphere-Biosphere Flux Coupling Vector Arrows
  if (world.flux && typeof world.flux.update === 'function') {
    world.flux.update(site, phase, t);
    if (variable) {
      world.flux.setVariableFocus(variable);
    }
  }

  // 9. Update Stratigraphy Spring-Damper Physics Engine
  if (world.stratigraphy && typeof world.stratigraphy.update === 'function') {
    world.stratigraphy.update(safeDt);
  }
}

/**
 * Update phase state across soil, forest, duff, and fire subsystems.
 */
export function colorTerrain(world, phase) {
  if (world.stratBlock && typeof world.stratBlock.setPhase === 'function') {
    world.stratBlock.setPhase(phase);
  }
}

/**
 * Configure flux vector arrows focus and color.
 */
export function setArrows(world, s, dir, color, variableName = null) {
  if (world.flux && typeof world.flux.setVariableFocus === 'function') {
    world.flux.setVariableFocus(variableName || 'SH');
  }
}

/**
 * Drive the StratigraphyController vertical axial explosion.
 */
export function applyExplode(world, e) {
  if (world.stratigraphy && typeof world.stratigraphy.setExplodeTarget === 'function') {
    world.stratigraphy.setExplodeTarget(e);
  }
}
