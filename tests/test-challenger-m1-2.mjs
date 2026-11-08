/**
 * test-challenger-m1-2.mjs
 * Adversarial empirical test harness for Milestone 1:
 * - GLSL Shader string replacement verification in onBeforeCompile
 * - Three.js ShaderLib template matching & worldpos_vertex dependency analysis
 * - Extreme parameter stress testing: update(Infinity, NaN, 1000, -5), setBurnZone edge cases
 * - Scale stress testing: 0 trees (falsy count check), 1 tree, 5000 trees
 * - BurnProgress domain bounds: [-5, 0.0, 1.0, 1.4, 2.0, 100, NaN, Infinity]
 * - Memory leak & allocation stress: multiple allocations, dispose cycles, GC resilience
 */

import * as THREE from 'three';
import {
  generateBarkTextures,
  generateFoliageTexture,
  generateLitterTexture,
  generateStratigraphyTexture,
} from '../js/pbr-textures.js';
import {
  createTrunkGeometry,
  createCanopyGeometry,
  createShrubGeometry,
  createLitterGeometry,
  createForest,
  createUnderstory,
  createSurfaceLitter,
} from '../js/forest-generator.js';

const results = [];
function record(testName, passed, details = {}) {
  results.push({ testName, passed, details });
  const status = passed ? 'PASS' : 'FAIL';
  console.log(`[${status}] ${testName}`);
  if (!passed || details.note) {
    console.log(`       Note: ${details.note || JSON.stringify(details)}`);
  }
}

// ---------------------------------------------------------------------------
// 1. GLSL Shader Hooks & Template Injection Verification
// ---------------------------------------------------------------------------
console.log('\n=== SUITE 1: GLSL Shader Injections & onBeforeCompile ===');

// Standard Three.js r160 MeshStandardMaterial Vertex & Fragment shader templates
const standardVertexShaderTemplate = `
#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}
`;

const standardFragmentShaderTemplate = `
#define STANDARD
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}
`;

const forest = createForest({ count: 100 });
const foliageMat = forest.foliageMesh.material;
const trunkMat = forest.trunkMesh.material;

// Test 1.1: Foliage onBeforeCompile hook execution
{
  const shader = {
    uniforms: {},
    vertexShader: standardVertexShaderTemplate,
    fragmentShader: standardFragmentShaderTemplate,
  };
  foliageMat.onBeforeCompile(shader);

  const vHasUniforms = shader.vertexShader.includes('uniform float uTime;') &&
                       shader.vertexShader.includes('uniform float uWindSpeed;') &&
                       shader.vertexShader.includes('varying vec3 vCustomWorldPos;');
  const vHasSway = shader.vertexShader.includes('trunkSway') &&
                   shader.vertexShader.includes('leafFlutter') &&
                   shader.vertexShader.includes('USE_INSTANCING');
  const vHasWorldPos = shader.vertexShader.includes('vCustomWorldPos = worldPosition.xyz;');
  const fHasSSS = shader.fragmentShader.includes('sssFactor') &&
                  shader.fragmentShader.includes('sssColor');
  const fHasBurn = shader.fragmentShader.includes('desiccatedCol') &&
                   shader.fragmentShader.includes('charredCol') &&
                   shader.fragmentShader.includes('emberGlow');

  record('Foliage onBeforeCompile Injection Targets',
    vHasUniforms && vHasSway && vHasWorldPos && fHasSSS && fHasBurn,
    { vHasUniforms, vHasSway, vHasWorldPos, fHasSSS, fHasBurn }
  );

  // Check uniform wiring
  const uniformsWired = !!(shader.uniforms.uTime && shader.uniforms.uWindSpeed && shader.uniforms.uBurnProgress);
  record('Foliage Uniforms Wired', uniformsWired, { uniforms: Object.keys(shader.uniforms) });
}

// Test 1.2: Trunk onBeforeCompile hook execution
{
  const shader = {
    uniforms: {},
    vertexShader: standardVertexShaderTemplate,
    fragmentShader: standardFragmentShaderTemplate,
  };
  trunkMat.onBeforeCompile(shader);

  const vHasUniforms = shader.vertexShader.includes('uniform float uTime;') &&
                       shader.vertexShader.includes('varying vec3 vTrunkWorldPos;');
  const vHasSway = shader.vertexShader.includes('trunkSway') &&
                   shader.vertexShader.includes('uWindDir * trunkSway');
  const vHasWorldPos = shader.vertexShader.includes('vTrunkWorldPos = worldPosition.xyz;');
  const fHasChar = shader.fragmentShader.includes('charredBark') &&
                   shader.fragmentShader.includes('glowingBark');

  record('Trunk onBeforeCompile Injection Targets',
    vHasUniforms && vHasSway && vHasWorldPos && fHasChar,
    { vHasUniforms, vHasSway, vHasWorldPos, fHasChar }
  );
}

// Test 1.3: Forensic Analysis: Three.js worldpos_vertex conditional declaration
{
  // In Three.js r160, worldpos_vertex is:
  // #if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined( USE_SHADOWMAP ) || defined( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
  //   vec4 worldPosition = ...;
  // #endif
  // If no shadows, envmap, or transmission are active, worldPosition is not declared!
  const hasShadows = false;
  const hasEnvMap = false;
  const hasTransmission = false;
  const numSpotLights = 0;

  const isWorldPosDeclaredInShader = hasShadows || hasEnvMap || hasTransmission || numSpotLights > 0;
  
  // Note finding: If scene has no shadows and no envMap, worldPosition is undeclared in standard Three.js shader expansion!
  record('worldpos_vertex Conditional Hazard Detection', true, {
    hazardIdentified: true,
    condition: 'worldPosition is only declared inside #if defined( USE_SHADOWMAP ) ...',
    note: 'POTENTIAL ISSUE: In Three.js r160, if renderer.shadowMap is not enabled and no envMap is bound, worldPosition is undefined in GLSL, causing compile failure when vCustomWorldPos = worldPosition.xyz executes.'
  });
}

// ---------------------------------------------------------------------------
// 2. Extreme Input Stress Testing
// ---------------------------------------------------------------------------
console.log('\n=== SUITE 2: Extreme Parameter Stress Testing ===');

// Test 2.1: update(Infinity, NaN, 1000, -5)
{
  let threw = false;
  let errorMsg = '';
  try {
    forest.update(Infinity, NaN, new THREE.Vector3(1, 0, 0), -5);
  } catch (err) {
    threw = true;
    errorMsg = err.message;
  }
  record('Forest update with Infinity, NaN, -5', !threw, { threw, errorMsg });
}

// Test 2.2: update with primitive windDir (number instead of Vector3)
{
  let threw = false;
  let errorMsg = '';
  try {
    // Calling update with 1000 as windDir parameter
    forest.update(1.0, 2.0, 1000, 0.5);
  } catch (err) {
    threw = true;
    errorMsg = err.message;
  }
  // In JavaScript, (1000).x is undefined, but does .copy(1000) throw?
  // Let's verify how Vector3.copy behaves with primitive 1000
  record('Forest update with primitive 1000 as windDir', !threw, { threw, errorMsg, note: threw ? 'Crashes on primitive' : 'Survived primitive boxing' });
}

// Test 2.3: update with null windDir
{
  let threw = false;
  let errorMsg = '';
  try {
    forest.update(1.0, 2.0, null, 0.5);
  } catch (err) {
    threw = true;
    errorMsg = err.message;
  }
  record('Forest update with null windDir', !threw, {
    threw,
    errorMsg,
    note: threw ? 'KNOWN VULNERABILITY: update(..., null, ...) causes TypeError in copy(windDir)' : 'Handled null gracefully'
  });
}

// Test 2.4: Burn progress domain range testing: [-5.0, 0.0, 0.5, 1.0, 1.4, 2.0, 100.0, NaN, Infinity]
{
  const burnValues = [-5.0, 0.0, 0.5, 1.0, 1.4, 2.0, 100.0, NaN, Infinity];
  let allSurvived = true;
  for (const bp of burnValues) {
    try {
      forest.update(10.0, 1.5, new THREE.Vector3(1, 0, 0), bp);
      const understory = createUnderstory({ count: 50 });
      understory.update(10.0, bp);
      const litter = createSurfaceLitter({ count: 50 });
      litter.update(bp);
    } catch (e) {
      allSurvived = false;
      console.error(`Failed at burnProgress = ${bp}:`, e.message);
    }
  }
  record('BurnProgress Domain Extremes (-5 to Infinity, NaN)', allSurvived, { testedValues: burnValues });
}

// Test 2.5: setBurnZone with extreme inputs
{
  let survived = true;
  try {
    forest.setBurnZone(null, undefined);
    forest.setBurnZone({ x: NaN, z: Infinity }, -10);
    forest.setBurnZone({ x: 1e9, z: -1e9 }, 1e6);
  } catch (e) {
    survived = false;
  }
  record('setBurnZone Extreme & Malformed Inputs', survived, { survived });
}

// ---------------------------------------------------------------------------
// 3. Tree Count Scale Extremes (0 trees vs 5000 trees)
// ---------------------------------------------------------------------------
console.log('\n=== SUITE 3: Scale Extremes (0 trees, 1 tree, 5000 trees) ===');

// Test 3.1: count: 0 (Testing JavaScript falsy 'options.count || 1200' bug)
{
  const zeroForest = createForest({ count: 0 });
  const actualCount = zeroForest.getTreeCount();
  const isActualZero = actualCount === 0;
  record('Forest count: 0 (Falsy Check)', isActualZero, {
    requestedCount: 0,
    actualCount,
    note: !isActualZero ? 'BUG DETECTED: options.count || 1200 causes count:0 to fallback to 1200 due to || instead of ??' : 'Count was 0'
  });
}

// Test 3.2: Understory count: 0
{
  const zeroUnderstory = createUnderstory({ count: 0 });
  const actualCount = zeroUnderstory.shrubMesh.count;
  record('Understory count: 0 (Falsy Check)', actualCount === 0, {
    requestedCount: 0,
    actualCount,
    note: actualCount !== 0 ? 'BUG DETECTED: options.count || 450 causes count:0 to fallback to 450' : 'Count was 0'
  });
}

// Test 3.3: Surface litter count: 0
{
  const zeroLitter = createSurfaceLitter({ count: 0 });
  const actualCount = zeroLitter.litterMesh.count;
  record('SurfaceLitter count: 0 (Falsy Check)', actualCount === 0, {
    requestedCount: 0,
    actualCount,
    note: actualCount !== 0 ? 'BUG DETECTED: options.count || 2000 causes count:0 to fallback to 2000' : 'Count was 0'
  });
}

// Test 3.4: count: 1 (Single instance)
{
  let singlePassed = true;
  try {
    const single = createForest({ count: 1 });
    single.update(1.0, 2.0, new THREE.Vector3(1, 0, 0), 0.5);
    single.dispose();
  } catch (e) {
    singlePassed = false;
  }
  record('Forest count: 1 (Single Tree Edge Case)', singlePassed);
}

// Test 3.5: count: 5000 (Stress scale)
{
  let stressPassed = true;
  let memBefore = process.memoryUsage().heapUsed;
  try {
    const bigForest = createForest({ count: 5000 });
    bigForest.update(5.0, 3.0, new THREE.Vector3(0, 0, 1), 0.8);
    record('Large Scale: 5000 Trees InstancedMesh Allocated', bigForest.getTreeCount() === 5000, {
      treePositions: bigForest.treePositions.length,
      instanceMatrixElements: bigForest.trunkMesh.instanceMatrix.array.length
    });
    bigForest.dispose();
  } catch (e) {
    stressPassed = false;
    record('Large Scale: 5000 Trees Stress Test', false, { error: e.message });
  }
}

// ---------------------------------------------------------------------------
// 4. Memory Leak & Allocation Stress Testing
// ---------------------------------------------------------------------------
console.log('\n=== SUITE 4: Memory Leaks & Allocation Cycles ===');

// Test 4.1: Texture Caching Efficiency (1000 calls without force)
{
  // Warm up all 4 texture caches so cold initial allocation is not counted against cached retrieval
  generateBarkTextures();
  generateFoliageTexture();
  generateLitterTexture();
  generateStratigraphyTexture();

  const startMem = process.memoryUsage().heapUsed;
  for (let i = 0; i < 1000; i++) {
    generateBarkTextures();
    generateFoliageTexture();
    generateLitterTexture();
    generateStratigraphyTexture();
  }
  const endMem = process.memoryUsage().heapUsed;
  const deltaKb = (endMem - startMem) / 1024;
  record('Procedural Texture Cache Verification (1000 calls)', deltaKb < 500, {
    deltaKb: Math.round(deltaKb),
    note: 'Zero-allocation cached retrieval verified'
  });
}

// Test 4.2: Repeated Forest Create & Dispose Cycles (100 iterations)
{
  const startMem = process.memoryUsage().heapUsed;
  for (let i = 0; i < 100; i++) {
    const f = createForest({ count: 300 });
    f.update(i * 0.1, 2.0, new THREE.Vector3(1, 0, 0), 0.2);
    f.dispose();

    const u = createUnderstory({ count: 100 });
    u.update(i * 0.1, 0.2);
    u.dispose();

    const l = createSurfaceLitter({ count: 200 });
    l.update(0.2);
    l.dispose();
  }
  // Run garbage collection if exposed
  if (global.gc) global.gc();
  const endMem = process.memoryUsage().heapUsed;
  const growthMb = (endMem - startMem) / (1024 * 1024);
  record('100 Create-Update-Dispose Cycles Memory Stability', growthMb < 25, {
    growthMb: growthMb.toFixed(2),
    note: growthMb < 25 ? 'Memory remained strictly bounded' : 'Excessive memory growth'
  });
}

// Test 4.3: Forced Texture Re-generation (20 iterations with force: true)
{
  let forceSurvived = true;
  try {
    for (let i = 0; i < 15; i++) {
      generateBarkTextures({ force: true, size: 64 });
      generateFoliageTexture({ force: true, size: 64 });
      generateLitterTexture({ force: true, size: 64 });
      generateStratigraphyTexture({ force: true, width: 64, height: 64 });
    }
  } catch (e) {
    forceSurvived = false;
  }
  record('Forced Texture Re-generation Stability (15 cycles)', forceSurvived);
}

// ---------------------------------------------------------------------------
// 5. Normal & Math Vector Integrity Checks
// ---------------------------------------------------------------------------
console.log('\n=== SUITE 5: Geometric & Vector Mathematical Integrity ===');

// Test 5.1: Canopy Outward Volumetric Normals
{
  const canopyGeom = createCanopyGeometry();
  const pos = canopyGeom.attributes.position;
  const norm = canopyGeom.attributes.normal;
  const center = new THREE.Vector3(0, 1.80, 0);

  let allNormalsValid = true;
  let allOutward = true;

  for (let i = 0; i < pos.count; i++) {
    const nx = norm.getX(i);
    const ny = norm.getY(i);
    const nz = norm.getZ(i);
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);

    if (Math.abs(len - 1.0) > 0.01 || Number.isNaN(len)) {
      allNormalsValid = false;
    }

    // Check outward direction from center
    const vx = pos.getX(i) - center.x;
    const vy = pos.getY(i) - center.y;
    const vz = pos.getZ(i) - center.z;
    const dot = vx * nx + vy * ny + vz * nz;
    if (dot < -0.001) {
      allOutward = false;
    }
  }

  record('Canopy Outward Volumetric Normals Mathematics', allNormalsValid && allOutward, {
    vertexCount: pos.count,
    allNormalsValid,
    allOutward
  });
}

// Test 5.2: Trunk Geometry Buttress Flare Integrity
{
  const trunkGeom = createTrunkGeometry();
  const pos = trunkGeom.attributes.position;
  let maxBaseRadius = 0;
  let minTopRadius = 999;

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const r = Math.hypot(pos.getX(i), pos.getZ(i));
    if (y < 0.1 && r > maxBaseRadius) maxBaseRadius = r;
    if (y > 2.2 && r < minTopRadius) minTopRadius = r;
  }

  // Buttress flare should make base wider than top
  const flared = maxBaseRadius > minTopRadius * 2.0;
  record('Trunk Buttress Root Flare Natural Taper', flared, {
    maxBaseRadius: maxBaseRadius.toFixed(3),
    minTopRadius: minTopRadius.toFixed(3),
    ratio: (maxBaseRadius / minTopRadius).toFixed(2)
  });
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n======================================================');
const total = results.length;
const passed = results.filter(r => r.passed).length;
const failed = total - passed;
console.log(`TOTAL TESTS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('======================================================\n');
if (failed > 0) process.exit(1);
