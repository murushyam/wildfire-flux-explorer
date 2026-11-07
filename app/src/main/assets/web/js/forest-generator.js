/**
 * forest-generator.js
 * Multi-component procedural instanced forest ecosystem for Three.js (r160 compatible).
 * Features:
 * - Anatomical tree geometry: organic tapered trunk with root flare, branch nodes, and procedural bark PBR.
 * - Multi-card foliage canopy with outward volumetric normals for 3D lighting.
 * - Custom GLSL vertex & fragment shader:
 *   - Height-weighted trunk sway (y^2) and high-frequency leaf flutter.
 *   - Spatial phase offset per tree instance (instanceMatrix[3].xz) for asynchronous natural sway.
 *   - Subsurface Scattering (SSS) back-light chlorophyll translucency.
 *   - Thermal scorching / fire burn transition (uBurnProgress: green -> desiccated brown -> charred carbon black with ember edges).
 * - Understory ladder fuels (shrubs/bamboo thickets) bridging surface fire to tree crowns.
 * - 2000-instance surface litter bed (pine needles, twigs, curled leaves).
 */

import * as THREE from 'three';
import { generateBarkTextures, generateFoliageTexture, generateLitterTexture } from './pbr-textures.js';

// ---------------------------------------------------------------------------
// Math & RNG Utilities
// ---------------------------------------------------------------------------

function createRng(seed = 42) {
  let s = seed >>> 0;
  return function() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Merges multiple BufferGeometries with position, normal, and uv attributes
 * into a single unified BufferGeometry with zero external dependencies.
 */
function mergeGeometries(geometries) {
  let totalVertices = 0;
  let totalIndices = 0;

  for (const g of geometries) {
    totalVertices += g.attributes.position.count;
    totalIndices += g.index ? g.index.count : 0;
  }

  const positions = new Float32Array(totalVertices * 3);
  const normals = new Float32Array(totalVertices * 3);
  const uvs = new Float32Array(totalVertices * 2);
  const indices = new (totalVertices > 65535 ? Uint32Array : Uint16Array)(totalIndices);

  let vertexOffset = 0;
  let indexOffset = 0;

  for (const g of geometries) {
    const pos = g.attributes.position.array;
    const norm = g.attributes.normal.array;
    const uv = g.attributes.uv.array;
    const count = g.attributes.position.count;

    positions.set(pos, vertexOffset * 3);
    normals.set(norm, vertexOffset * 3);
    uvs.set(uv, vertexOffset * 2);

    if (g.index) {
      const idx = g.index.array;
      for (let i = 0; i < idx.length; i++) {
        indices[indexOffset + i] = idx[i] + vertexOffset;
      }
      indexOffset += idx.length;
    }

    vertexOffset += count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  if (totalIndices > 0) {
    merged.setIndex(new THREE.BufferAttribute(indices, 1));
  }
  return merged;
}

// ---------------------------------------------------------------------------
// 1. Procedural Tree Geometry Generators
// ---------------------------------------------------------------------------

/**
 * Creates an organic tapered trunk geometry with root flare, natural curvature,
 * knot swells, and secondary branch stubs.
 */
export function createTrunkGeometry() {
  const height = 2.4;
  const radiusTop = 0.04;
  const radiusBottom = 0.13;
  const radialSegments = 9;
  const heightSegments = 10;

  const mainTrunk = new THREE.CylinderGeometry(
    radiusTop,
    radiusBottom,
    height,
    radialSegments,
    heightSegments
  );
  // Shift pivot to base of trunk (root origin at y = 0)
  mainTrunk.translate(0, height * 0.5, 0);

  const pos = mainTrunk.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const h = y / height; // 0.0 at base to 1.0 at top

    // Root flare: fluted buttress roots widening near ground (h < 0.25)
    const flare = 1.0 + 1.35 * Math.exp(-h * 12.0);
    const angle = Math.atan2(pos.getZ(i), pos.getX(i));
    const flutes = 1.0 + Math.cos(angle * 4.0) * 0.18 * Math.exp(-h * 9.0);

    // Natural trunk lean / organic curvature
    const leanX = Math.sin(h * 2.2) * 0.10;
    const leanZ = (Math.cos(h * 1.8) - 1.0) * 0.06;

    // Knot / branch node swells
    const swell = Math.sin(h * 11.0) * 0.016;

    const scale = flare * flutes + swell;
    pos.setX(i, pos.getX(i) * scale + leanX);
    pos.setZ(i, pos.getZ(i) * scale + leanZ);
  }
  mainTrunk.computeVertexNormals();

  // Secondary scaffold branch stubs extending outward
  const branch1 = new THREE.CylinderGeometry(0.02, 0.04, 0.65, 6, 3);
  branch1.translate(0, 0.32, 0);
  branch1.rotateZ(Math.PI * 0.26);
  branch1.translate(0.18, 1.45, 0.04);
  branch1.computeVertexNormals();

  const branch2 = new THREE.CylinderGeometry(0.018, 0.035, 0.55, 6, 3);
  branch2.translate(0, 0.27, 0);
  branch2.rotateX(-Math.PI * 0.28);
  branch2.translate(-0.06, 1.82, 0.14);
  branch2.computeVertexNormals();

  const combinedTrunk = mergeGeometries([mainTrunk, branch1, branch2]);
  combinedTrunk.computeVertexNormals();
  return combinedTrunk;
}

/**
 * Creates hierarchical canopy foliage geometry with intersecting multi-card planes
 * and outward volumetric normals for realistic 3D volumetric light shading.
 */
export function createCanopyGeometry() {
  const cards = [];

  // Helper to create a single quad card oriented in 3D
  function makeQuadCard(width, height, cx, cy, cz, rotX, rotY, rotZ) {
    const geom = new THREE.PlaneGeometry(width, height, 1, 1);
    geom.rotateX(rotX);
    geom.rotateY(rotY);
    geom.rotateZ(rotZ);
    geom.translate(cx, cy, cz);
    return geom;
  }

  // 1. Apex Crown Cross (Upper canopy cluster)
  cards.push(makeQuadCard(1.20, 1.20, 0.0, 2.15, 0.0, 0, 0, 0));
  cards.push(makeQuadCard(1.20, 1.20, 0.0, 2.15, 0.0, 0, Math.PI * 0.5, 0));

  // 2. Mid-Canopy Cards (Angled in an organic dome)
  const midRadius = 0.45;
  const midHeight = 1.85;
  const numMid = 5;
  for (let i = 0; i < numMid; i++) {
    const theta = (i / numMid) * Math.PI * 2.0;
    const cx = Math.cos(theta) * midRadius;
    const cz = Math.sin(theta) * midRadius;
    cards.push(makeQuadCard(1.05, 1.05, cx, midHeight, cz, 0.28, theta + Math.PI * 0.5, 0.15));
  }

  // 3. Lower Canopy Scaffold Cards (Widest skirt)
  const lowerRadius = 0.65;
  const lowerHeight = 1.45;
  const numLower = 5;
  for (let i = 0; i < numLower; i++) {
    const theta = ((i + 0.5) / numLower) * Math.PI * 2.0;
    const cx = Math.cos(theta) * lowerRadius;
    const cz = Math.sin(theta) * lowerRadius;
    cards.push(makeQuadCard(0.95, 0.95, cx, lowerHeight, cz, 0.42, theta + Math.PI * 0.5, -0.2));
  }

  const mergedCanopy = mergeGeometries(cards);

  // Reorient normals outward from the canopy cluster center (0, 1.80, 0)
  // This produces spherical 3D volumetric lighting on flat foliage planes!
  const pos = mergedCanopy.attributes.position;
  const norm = mergedCanopy.attributes.normal;
  const center = new THREE.Vector3(0.0, 1.80, 0.0);
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).sub(center);
    if (v.lengthSq() > 0.0001) {
      v.normalize();
      norm.setXYZ(i, v.x, v.y, v.z);
    }
  }
  norm.needsUpdate = true;

  return mergedCanopy;
}

/**
 * Creates understory shrub geometry (ladder fuels) with multi-stem branching
 * and low-lying foliage clusters.
 */
export function createShrubGeometry() {
  const parts = [];

  // Thin arching woody stems
  const stem1 = new THREE.CylinderGeometry(0.012, 0.024, 0.85, 5, 3);
  stem1.translate(0, 0.42, 0);
  stem1.rotateZ(0.24);
  parts.push(stem1);

  const stem2 = new THREE.CylinderGeometry(0.010, 0.022, 0.75, 5, 3);
  stem2.translate(0, 0.37, 0);
  stem2.rotateX(-0.28);
  stem2.rotateZ(-0.22);
  parts.push(stem2);

  const stem3 = new THREE.CylinderGeometry(0.011, 0.020, 0.80, 5, 3);
  stem3.translate(0, 0.40, 0);
  stem3.rotateX(0.25);
  parts.push(stem3);

  // Dense low-lying foliage cards
  function makeShrubCard(w, h, cx, cy, cz, rx, ry, rz) {
    const q = new THREE.PlaneGeometry(w, h, 1, 1);
    q.rotateX(rx);
    q.rotateY(ry);
    q.rotateZ(rz);
    q.translate(cx, cy, cz);
    return q;
  }

  parts.push(makeShrubCard(0.70, 0.70, 0.0, 0.55, 0.0, 0, 0, 0));
  parts.push(makeShrubCard(0.70, 0.70, 0.0, 0.55, 0.0, 0, Math.PI * 0.5, 0));
  parts.push(makeShrubCard(0.65, 0.65, 0.22, 0.45, 0.15, 0.35, 0.8, 0.1));
  parts.push(makeShrubCard(0.65, 0.65, -0.20, 0.48, -0.18, -0.32, -0.6, 0.15));

  const shrubGeom = mergeGeometries(parts);

  // Volumetric outward normals from shrub center (0, 0.45, 0)
  const pos = shrubGeom.attributes.position;
  const norm = shrubGeom.attributes.normal;
  const center = new THREE.Vector3(0, 0.45, 0);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).sub(center);
    if (v.lengthSq() > 0.0001) {
      v.normalize();
      norm.setXYZ(i, v.x, v.y, v.z);
    }
  }
  norm.needsUpdate = true;
  return shrubGeom;
}

/**
 * Creates surface micro-litter geometry (fallen broadleaf, needle pair, twig).
 */
export function createLitterGeometry() {
  const parts = [];

  // Fallen curved broadleaf
  const leaf = new THREE.PlaneGeometry(0.22, 0.14, 2, 2);
  leaf.rotateX(-Math.PI * 0.48);
  const lpos = leaf.attributes.position;
  // Curl leaf margins
  for (let i = 0; i < lpos.count; i++) {
    const x = lpos.getX(i);
    lpos.setY(i, lpos.getY(i) + Math.abs(x) * 0.04);
  }
  leaf.computeVertexNormals();
  parts.push(leaf);

  // Pine needle pair (thin crossed prisms)
  const needle1 = new THREE.BoxGeometry(0.24, 0.006, 0.012);
  needle1.rotateY(0.6);
  needle1.translate(0.05, 0.012, 0.04);
  parts.push(needle1);

  const needle2 = new THREE.BoxGeometry(0.22, 0.006, 0.012);
  needle2.rotateY(-0.45);
  needle2.translate(-0.04, 0.014, -0.03);
  parts.push(needle2);

  // Fallen twig
  const twig = new THREE.CylinderGeometry(0.008, 0.012, 0.28, 4);
  twig.rotateZ(Math.PI * 0.5);
  twig.rotateY(1.2);
  twig.translate(0.0, 0.016, 0.08);
  parts.push(twig);

  const merged = mergeGeometries(parts);
  merged.computeVertexNormals();
  return merged;
}

// ---------------------------------------------------------------------------
// 2. Custom GLSL Shader Hooks (SSS Translucency, Wind Sway, Thermal Scorching)
// ---------------------------------------------------------------------------

/**
 * Injects custom vertex wind sway and fragment SSS/thermal scorching into
 * a Three.js MeshStandardMaterial.
 */
function applyFoliageShaderHooks(material, sharedUniforms) {
  material.customProgramCacheKey = () => 'foliage_sss_wind_burn_v1';

  material.onBeforeCompile = (shader) => {
    // Wire uniforms
    shader.uniforms.uTime = sharedUniforms.uTime;
    shader.uniforms.uWindSpeed = sharedUniforms.uWindSpeed;
    shader.uniforms.uWindDir = sharedUniforms.uWindDir;
    shader.uniforms.uBurnProgress = sharedUniforms.uBurnProgress;
    shader.uniforms.uBurnCenter = sharedUniforms.uBurnCenter;
    shader.uniforms.uBurnRadius = sharedUniforms.uBurnRadius;
    shader.uniforms.uSunDir = sharedUniforms.uSunDir;

    // --- Vertex Shader Injections ---
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
      uniform float uTime;
      uniform float uWindSpeed;
      uniform vec3 uWindDir;
      uniform float uBurnProgress;
      uniform vec3 uBurnCenter;
      uniform float uBurnRadius;
      varying vec3 vCustomWorldPos;
      varying vec3 vCustomWorldNorm;
      varying float vBurnFactor;
      `
    );

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
      vec3 instPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      #else
      vec3 instPos = vec3(0.0);
      #endif

      // Asynchronous spatial phase offset per tree instance
      float spatialPhase = dot(instPos.xz, vec2(0.183, 0.237));

      // Calculate proximity to active wildfire burn zone
      float distToBurn = length(instPos.xz - uBurnCenter.xz);
      float inBurnZone = 1.0 - smoothstep(uBurnRadius * 0.45, uBurnRadius * 1.15, distToBurn);
      vBurnFactor = inBurnZone * clamp(uBurnProgress, 0.0, 2.0);

      // Hierarchical Wind: trunk sway (y^2) + high-frequency leaf flutter (y)
      float h = max(0.0, transformed.y);
      float hWeight = (h * h) * 0.18;
      float trunkSway = sin(uTime * uWindSpeed * 2.2 + spatialPhase) * 0.09 * hWeight;
      float leafFlutter = sin(uTime * 7.5 + dot(transformed, vec3(5.2)) + spatialPhase * 2.0) * 0.035 * h;

      #ifdef USE_INSTANCING
      // Transform world wind vector into instance local space
      // Using inverse/transpose of the 3x3 rotation component of instanceMatrix
      mat3 instRot = mat3(instanceMatrix);
      // For orthonormal rotation matrices, inverse is transpose:
      vec3 localWindDir = uWindDir * instRot;
      #else
      vec3 localWindDir = uWindDir;
      #endif

      vec3 windOffset = (localWindDir + vec3(0.0, 0.15, 0.0)) * (trunkSway + leafFlutter);
      transformed += windOffset;
      `
    );

    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
      #if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
        vCustomWorldPos = worldPosition.xyz;
      #else
        vec4 customWorldPos = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          customWorldPos = instanceMatrix * customWorldPos;
        #endif
        vCustomWorldPos = (modelMatrix * customWorldPos).xyz;
      #endif
      #ifdef USE_INSTANCING
        vCustomWorldNorm = normalize((modelMatrix * instanceMatrix * vec4(normal, 0.0)).xyz);
      #else
        vCustomWorldNorm = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
      #endif
      `
    );

    // --- Fragment Shader Injections ---
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
      uniform float uTime;
      uniform float uBurnProgress;
      uniform vec3 uSunDir;
      varying vec3 vCustomWorldPos;
      varying vec3 vCustomWorldNorm;
      varying float vBurnFactor;
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `
      // 1. Subsurface Scattering (SSS) Back-lit Chlorophyll Translucency
      vec3 sunDir = normalize(uSunDir);
      vec3 viewDir = normalize(cameraPosition - vCustomWorldPos);
      float sssDot = max(0.0, dot(viewDir, -sunDir));
      float sssFactor = pow(sssDot, 2.2) * 0.55;
      vec3 sssColor = vec3(0.40, 0.76, 0.16) * sssFactor;
      gl_FragColor.rgb += sssColor * (1.0 - clamp(vBurnFactor * 1.5, 0.0, 1.0));

      // 2. Thermal Scorching / Fire Burn Transition
      if (vBurnFactor > 0.01) {
        vec3 desiccatedCol = vec3(0.52, 0.35, 0.14); // Turgor loss & dried brown
        vec3 charredCol    = vec3(0.08, 0.07, 0.06); // Charred carbon soot
        vec3 emberGlow     = vec3(1.0, 0.30, 0.02); // Glowing thermal perimeter

        float burnStage = clamp(vBurnFactor, 0.0, 1.5);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, desiccatedCol, clamp(burnStage * 1.8, 0.0, 1.0));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, charredCol, clamp((burnStage - 0.45) * 1.8, 0.0, 1.0));

        // Glowing active ember fringes during active fire
        if (uBurnProgress > 0.1 && uBurnProgress < 1.35) {
          float emberEdge = smoothstep(0.25, 0.65, vBurnFactor) * (1.0 - smoothstep(0.70, 0.98, vBurnFactor));
          float pulse = sin(uTime * 14.0 + dot(vCustomWorldPos, vec3(6.0))) * 0.5 + 0.5;
          gl_FragColor.rgb += emberGlow * emberEdge * pulse * 1.4;
        }

        // Post-fire defoliation thinning
        if (uBurnProgress >= 1.4) {
          gl_FragColor.rgb *= 0.65;
        }
      }
      #include <dithering_fragment>
      `
    );
  };
}

/**
 * Injects trunk wind sway and bark charring shader hooks.
 */
function applyTrunkShaderHooks(material, sharedUniforms) {
  material.customProgramCacheKey = () => 'trunk_wind_burn_v1';

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = sharedUniforms.uTime;
    shader.uniforms.uWindSpeed = sharedUniforms.uWindSpeed;
    shader.uniforms.uWindDir = sharedUniforms.uWindDir;
    shader.uniforms.uBurnProgress = sharedUniforms.uBurnProgress;
    shader.uniforms.uBurnCenter = sharedUniforms.uBurnCenter;
    shader.uniforms.uBurnRadius = sharedUniforms.uBurnRadius;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
      uniform float uTime;
      uniform float uWindSpeed;
      uniform vec3 uWindDir;
      uniform float uBurnProgress;
      uniform vec3 uBurnCenter;
      uniform float uBurnRadius;
      varying vec3 vTrunkWorldPos;
      varying float vTrunkBurn;
      `
    );

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
      vec3 instPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      #else
      vec3 instPos = vec3(0.0);
      #endif

      float spatialPhase = dot(instPos.xz, vec2(0.183, 0.237));
      float distToBurn = length(instPos.xz - uBurnCenter.xz);
      float inBurnZone = 1.0 - smoothstep(uBurnRadius * 0.45, uBurnRadius * 1.15, distToBurn);
      vTrunkBurn = inBurnZone * clamp(uBurnProgress, 0.0, 2.0);

      // Cohesive trunk sway matching canopy displacement
      float h = max(0.0, transformed.y);
      float hWeight = (h * h) * 0.18;
      float trunkSway = sin(uTime * uWindSpeed * 2.2 + spatialPhase) * 0.09 * hWeight;

      #ifdef USE_INSTANCING
      // Transform world wind vector into instance local space
      // Using inverse/transpose of the 3x3 rotation component of instanceMatrix
      mat3 instRot = mat3(instanceMatrix);
      // For orthonormal rotation matrices, inverse is transpose:
      vec3 localWindDir = uWindDir * instRot;
      #else
      vec3 localWindDir = uWindDir;
      #endif

      transformed += localWindDir * trunkSway; // coherent uWindDir * trunkSway in local instance space
      `
    );

    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
      #if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
        vTrunkWorldPos = worldPosition.xyz;
      #else
        vec4 customWorldPos = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          customWorldPos = instanceMatrix * customWorldPos;
        #endif
        vTrunkWorldPos = (modelMatrix * customWorldPos).xyz;
      #endif
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
      uniform float uTime;
      uniform float uBurnProgress;
      varying vec3 vTrunkWorldPos;
      varying float vTrunkBurn;
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `
      if (vTrunkBurn > 0.01) {
        vec3 charredBark = vec3(0.10, 0.08, 0.07);
        vec3 glowingBark = vec3(0.95, 0.25, 0.02);

        float stage = clamp(vTrunkBurn, 0.0, 1.5);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, charredBark, clamp(stage * 1.5, 0.0, 1.0));

        // Base trunk ember glow where surface flames lick the tree trunk base
        if (uBurnProgress > 0.1 && uBurnProgress < 1.35) {
          float baseFactor = smoothstep(1.5, 0.0, vTrunkWorldPos.y);
          float emberPulse = sin(uTime * 10.0 + dot(vTrunkWorldPos, vec3(8.0))) * 0.5 + 0.5;
          gl_FragColor.rgb += glowingBark * vTrunkBurn * baseFactor * emberPulse * 0.8;
        }
      }
      #include <dithering_fragment>
      `
    );
  };
}

// ---------------------------------------------------------------------------
// 3. High-Level Forest & Understory Constructors
// ---------------------------------------------------------------------------

/**
 * Creates a photorealistic, studio-grade procedural forest ecosystem.
 *
 * @param {Object} options
 * @param {number} [options.count=1200] Number of trees
 * @param {Object} [options.bounds] Geographic bounds { minX, maxX, minZ, maxZ }
 * @param {Function} [options.terrainH] Terrain height function H(x, z)
 * @param {Object} [options.burnZone] Active wildfire perimeter { x, z, r }
 * @param {number} [options.seed=42] Deterministic RNG seed
 * @returns {Object} Forest ecosystem controller { group, update, setBurnZone, ... }
 */
export function createForest(options = {}) {
  const count = options.count ?? 1200;
  const bounds = options.bounds || { minX: -9.5, maxX: 9.5, minZ: -9.5, maxZ: 9.5 };
  const terrainH = options.terrainH || (() => 0.0);
  const burnZone = options.burnZone || { x: 1.5, z: 0.0, r: 4.5 };
  const seed = options.seed ?? 42;

  const rng = createRng(seed);
  const group = new THREE.Group();
  group.name = 'ForestEcosystem';

  // Shared uniforms across forest materials
  const sharedUniforms = {
    uTime: { value: 0.0 },
    uWindSpeed: { value: 1.8 },
    uWindDir: { value: new THREE.Vector3(1.0, 0.0, 0.35).normalize() },
    uBurnProgress: { value: 0.0 },
    uBurnCenter: { value: new THREE.Vector3(burnZone.x, 0.0, burnZone.z) },
    uBurnRadius: { value: burnZone.r },
    uSunDir: { value: new THREE.Vector3(5.0, 10.0, 3.0).normalize() },
  };

  // Generate or retrieve procedural textures with fast 256 default
  const texOptions = { size: options.textureSize || 256 };
  const barkTex = generateBarkTextures(texOptions);
  const foliageTex = generateFoliageTexture(texOptions);

  // 1. Trunk InstancedMesh (PBR Material + Sobel Normal + Roughness)
  const trunkGeometry = createTrunkGeometry();
  const trunkMaterial = new THREE.MeshStandardMaterial({
    map: barkTex.diffuseMap,
    normalMap: barkTex.normalMap,
    roughnessMap: barkTex.roughnessMap,
    roughness: 0.88,
    metalness: 0.02,
  });
  applyTrunkShaderHooks(trunkMaterial, sharedUniforms);

  const trunkMesh = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, count);
  trunkMesh.name = 'TreeTrunks';
  trunkMesh.castShadow = true;
  trunkMesh.receiveShadow = true;

  // 2. Foliage Canopy InstancedMesh (SSS Translucency + Wind Flutter Shader)
  const canopyGeometry = createCanopyGeometry();
  const foliageMaterial = new THREE.MeshStandardMaterial({
    map: foliageTex.map,
    alphaTest: 0.45,
    transparent: true,
    side: THREE.DoubleSide,
    roughness: 0.65,
    metalness: 0.01,
  });
  applyFoliageShaderHooks(foliageMaterial, sharedUniforms);

  const foliageMesh = new THREE.InstancedMesh(canopyGeometry, foliageMaterial, count);
  foliageMesh.name = 'TreeCanopies';
  foliageMesh.castShadow = true;
  foliageMesh.receiveShadow = true;

  // Position instances organically across terrain
  const dummyMatrix = new THREE.Matrix4();
  const rotMatrix = new THREE.Matrix4();
  const scaleMatrix = new THREE.Matrix4();
  const transMatrix = new THREE.Matrix4();
  const treePositions = [];

  const spanX = bounds.maxX - bounds.minX;
  const spanZ = bounds.maxZ - bounds.minZ;

  for (let i = 0; i < count; i++) {
    // Jittered natural distribution
    const x = bounds.minX + rng() * spanX;
    const z = bounds.minZ + rng() * spanZ;
    const y = terrainH(x, z);

    // Tree scale variation (saplings to mature giants)
    const scale = 0.72 + rng() * 0.58;

    // Random yaw rotation + subtle tilt conforming to slope
    const yaw = rng() * Math.PI * 2.0;
    const pitch = (rng() - 0.5) * 0.10;
    const roll = (rng() - 0.5) * 0.10;

    dummyMatrix.identity();
    transMatrix.makeTranslation(x, y, z);
    rotMatrix.makeRotationFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ'));
    scaleMatrix.makeScale(scale, scale, scale);

    dummyMatrix.multiply(transMatrix).multiply(rotMatrix).multiply(scaleMatrix);

    trunkMesh.setMatrixAt(i, dummyMatrix);
    foliageMesh.setMatrixAt(i, dummyMatrix);
    treePositions.push([x, y, z]);
  }

  trunkMesh.instanceMatrix.needsUpdate = true;
  foliageMesh.instanceMatrix.needsUpdate = true;

  group.add(trunkMesh);
  group.add(foliageMesh);

  return {
    group,
    trunkMesh,
    foliageMesh,
    treePositions,
    /**
     * Updates time, wind, and wildfire burn progression on GPU shaders.
     */
    update(time, windSpeed, windDir, burnProgress) {
      if (time !== undefined) sharedUniforms.uTime.value = time;
      if (windSpeed !== undefined) sharedUniforms.uWindSpeed.value = windSpeed;
      if (windDir) {
        if (windDir.x !== undefined) {
          sharedUniforms.uWindDir.value.copy(windDir).normalize();
        }
      }
      if (burnProgress !== undefined) {
        sharedUniforms.uBurnProgress.value = burnProgress;
      }
    },
    setBurnZone(center, radius) {
      if (center) {
        sharedUniforms.uBurnCenter.value.set(center.x, 0.0, center.z);
      }
      if (radius !== undefined) {
        sharedUniforms.uBurnRadius.value = radius;
      }
    },
    getTreeCount() {
      return count;
    },
    dispose() {
      trunkGeometry.dispose();
      trunkMaterial.dispose();
      canopyGeometry.dispose();
      foliageMaterial.dispose();
    }
  };
}

/**
 * Creates instanced understory ladder fuels (shrubs, saplings, bamboo thickets)
 * that bridge surface fires into tree crowns.
 *
 * @param {Object} options
 * @returns {Object} Understory controller { group, update, setBurnZone }
 */
export function createUnderstory(options = {}) {
  const count = options.count ?? 450;
  const bounds = options.bounds || { minX: -9.5, maxX: 9.5, minZ: -9.5, maxZ: 9.5 };
  const terrainH = options.terrainH || (() => 0.0);
  const burnZone = options.burnZone || { x: 1.5, z: 0.0, r: 4.5 };
  const seed = (options.seed ?? 42) + 101;

  const rng = createRng(seed);
  const group = new THREE.Group();
  group.name = 'UnderstoryLadderFuels';

  const sharedUniforms = {
    uTime: { value: 0.0 },
    uWindSpeed: { value: 1.8 },
    uWindDir: { value: new THREE.Vector3(1.0, 0.0, 0.35).normalize() },
    uBurnProgress: { value: 0.0 },
    uBurnCenter: { value: new THREE.Vector3(burnZone.x, 0.0, burnZone.z) },
    uBurnRadius: { value: burnZone.r },
    uSunDir: { value: new THREE.Vector3(5.0, 10.0, 3.0).normalize() },
  };

  const texOptions = { size: options.textureSize || 256 };
  const foliageTex = generateFoliageTexture(texOptions);
  const shrubGeometry = createShrubGeometry();
  const shrubMaterial = new THREE.MeshStandardMaterial({
    map: foliageTex.map,
    alphaTest: 0.42,
    transparent: true,
    side: THREE.DoubleSide,
    roughness: 0.72,
    metalness: 0.02,
  });
  applyFoliageShaderHooks(shrubMaterial, sharedUniforms);

  const shrubMesh = new THREE.InstancedMesh(shrubGeometry, shrubMaterial, count);
  shrubMesh.name = 'ShrubLadderFuels';
  shrubMesh.castShadow = true;
  shrubMesh.receiveShadow = true;

  const dummyMatrix = new THREE.Matrix4();
  const rotMatrix = new THREE.Matrix4();
  const scaleMatrix = new THREE.Matrix4();
  const transMatrix = new THREE.Matrix4();

  const spanX = bounds.maxX - bounds.minX;
  const spanZ = bounds.maxZ - bounds.minZ;

  for (let i = 0; i < count; i++) {
    const x = bounds.minX + rng() * spanX;
    const z = bounds.minZ + rng() * spanZ;
    const y = terrainH(x, z);

    const scale = 0.65 + rng() * 0.70;
    const yaw = rng() * Math.PI * 2.0;

    dummyMatrix.identity();
    transMatrix.makeTranslation(x, y, z);
    rotMatrix.makeRotationY(yaw);
    scaleMatrix.makeScale(scale, scale, scale);
    dummyMatrix.multiply(transMatrix).multiply(rotMatrix).multiply(scaleMatrix);

    shrubMesh.setMatrixAt(i, dummyMatrix);
  }

  shrubMesh.instanceMatrix.needsUpdate = true;
  group.add(shrubMesh);

  return {
    group,
    shrubMesh,
    update(time, burnProgress) {
      sharedUniforms.uTime.value = time;
      if (burnProgress !== undefined) {
        sharedUniforms.uBurnProgress.value = burnProgress;
      }
    },
    setBurnZone(center, radius) {
      if (center) {
        sharedUniforms.uBurnCenter.value.set(center.x, 0.0, center.z);
      }
      if (radius !== undefined) {
        sharedUniforms.uBurnRadius.value = radius;
      }
    },
    dispose() {
      shrubGeometry.dispose();
      shrubMaterial.dispose();
    }
  };
}

/**
 * Creates 2000-instance surface litter bed (pine needles, fallen broadleaves,
 * twigs) scattered across the forest floor for micro-roughness.
 *
 * @param {Object} options
 * @returns {Object} Surface litter controller { group, update, setBurnZone }
 */
export function createSurfaceLitter(options = {}) {
  const count = options.count ?? 2000;
  const bounds = options.bounds || { minX: -9.8, maxX: 9.8, minZ: -9.8, maxZ: 9.8 };
  const terrainH = options.terrainH || (() => 0.0);
  const burnZone = options.burnZone || { x: 1.5, z: 0.0, r: 4.5 };
  const seed = (options.seed ?? 42) + 202;

  const rng = createRng(seed);
  const group = new THREE.Group();
  group.name = 'SurfaceLitterBed';

  const texOptions = { size: options.textureSize || 256 };
  const litterTex = generateLitterTexture(texOptions);
  const litterGeometry = createLitterGeometry();
  const litterMaterial = new THREE.MeshStandardMaterial({
    map: litterTex.diffuseMap,
    normalMap: litterTex.normalMap,
    roughnessMap: litterTex.roughnessMap,
    roughness: 0.92,
    metalness: 0.01,
  });

  const litterMesh = new THREE.InstancedMesh(litterGeometry, litterMaterial, count);
  litterMesh.name = 'LitterInstances';
  litterMesh.receiveShadow = true;

  const dummyMatrix = new THREE.Matrix4();
  const rotMatrix = new THREE.Matrix4();
  const scaleMatrix = new THREE.Matrix4();
  const transMatrix = new THREE.Matrix4();
  const litterPositions = [];

  const spanX = bounds.maxX - bounds.minX;
  const spanZ = bounds.maxZ - bounds.minZ;

  for (let i = 0; i < count; i++) {
    const x = bounds.minX + rng() * spanX;
    const z = bounds.minZ + rng() * spanZ;
    const y = terrainH(x, z);

    const scale = 0.70 + rng() * 0.75;
    const yaw = rng() * Math.PI * 2.0;
    const pitch = (rng() - 0.5) * 0.15;
    const roll = (rng() - 0.5) * 0.15;

    dummyMatrix.identity();
    transMatrix.makeTranslation(x, y, z);
    rotMatrix.makeRotationFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ'));
    scaleMatrix.makeScale(scale, scale, scale);
    dummyMatrix.multiply(transMatrix).multiply(rotMatrix).multiply(scaleMatrix);

    litterMesh.setMatrixAt(i, dummyMatrix);
    litterPositions.push({ x, z, inBurn: Math.hypot(x - burnZone.x, z - burnZone.z) < burnZone.r });
  }

  litterMesh.instanceMatrix.needsUpdate = true;
  group.add(litterMesh);

  return {
    group,
    litterMesh,
    update(burnProgress) {
      if (burnProgress !== undefined && !Number.isNaN(burnProgress) && burnProgress > 0.0) {
        // Smooth continuous clamped transition towards charred ash color (0x181412)
        const progress = Math.max(0.0, Math.min(1.0, Number.isFinite(burnProgress) ? burnProgress : 1.0));
        const charColor = new THREE.Color(0x181412);
        const normalColor = new THREE.Color(0xffffff);
        litterMaterial.color.lerpColors(normalColor, charColor, progress);
      } else {
        litterMaterial.color.setHex(0xffffff);
      }
    },
    setBurnZone(center, radius) {
      if (center) {
        burnZone.x = center.x;
        burnZone.z = center.z;
      }
      if (radius !== undefined) {
        burnZone.r = radius;
      }
    },
    dispose() {
      litterGeometry.dispose();
      litterMaterial.dispose();
    }
  };
}
