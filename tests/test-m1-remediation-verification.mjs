/**
 * test-m1-remediation-verification.mjs
 * Targeted verification for Reviewer M1-1 Findings Remediation:
 * - F-01: Safe World Position in Shaders (fallback when USE_SHADOWMAP/USE_ENVMAP not defined)
 * - F-02: Propagate Texture Options & 256 Fast Default
 * - F-03: Coherent Wind Sway Across Instance Rotations (localWindDir)
 * - F-04: Surface Litter Scorched Transition Smoothness & Domain Clamping
 * - Edge Cases: count nullish coalescing & null windDir safety
 */

import * as THREE from 'three';
import {
  generateBarkTextures,
  generateFoliageTexture,
  generateLitterTexture,
  generateStratigraphyTexture,
} from '../js/pbr-textures.js';
import {
  createForest,
  createUnderstory,
  createSurfaceLitter,
} from '../js/forest-generator.js';

let passed = 0;
let failed = 0;

function assert(cond, name) {
  if (cond) {
    passed++;
    console.log(`[PASS] ${name}`);
  } else {
    failed++;
    console.error(`[FAIL] ${name}`);
  }
}

console.log('=== TARGETED REMEDIATION VERIFICATION SUITE ===\n');

// 1. F-01 Verification: Safe World Position in Shaders
{
  const forest = createForest({ count: 10, textureSize: 128 });
  const foliageMat = forest.foliageMesh.material;
  const trunkMat = forest.trunkMesh.material;

  const mockShaderFoliage = {
    uniforms: {},
    vertexShader: `#include <common>\n#include <begin_vertex>\n#include <worldpos_vertex>`,
    fragmentShader: `#include <common>\n#include <dithering_fragment>`,
  };
  foliageMat.onBeforeCompile(mockShaderFoliage);

  assert(
    mockShaderFoliage.vertexShader.includes('#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP )') &&
    mockShaderFoliage.vertexShader.includes('vCustomWorldPos = (modelMatrix * customWorldPos).xyz;'),
    'F-01: Foliage shader has safe world position fallback when shadows/envmap disabled'
  );

  const mockShaderTrunk = {
    uniforms: {},
    vertexShader: `#include <common>\n#include <begin_vertex>\n#include <worldpos_vertex>`,
    fragmentShader: `#include <common>\n#include <dithering_fragment>`,
  };
  trunkMat.onBeforeCompile(mockShaderTrunk);

  assert(
    mockShaderTrunk.vertexShader.includes('#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP )') &&
    mockShaderTrunk.vertexShader.includes('vTrunkWorldPos = (modelMatrix * customWorldPos).xyz;'),
    'F-01: Trunk shader has safe world position fallback when shadows/envmap disabled'
  );

  forest.dispose();
}

// 2. F-02 Verification: Propagate Texture Options & 256 Fast Default
{
  // Standalone call with no options defaults to 256
  const barkDefault = generateBarkTextures({ force: true });
  assert(barkDefault.diffuseMap.image.width === 256, 'F-02: generateBarkTextures() defaults to 256');

  const foliageDefault = generateFoliageTexture({ force: true });
  assert(foliageDefault.map.image.width === 256, 'F-02: generateFoliageTexture() defaults to 256');

  const litterDefault = generateLitterTexture({ force: true });
  assert(litterDefault.diffuseMap.image.width === 256, 'F-02: generateLitterTexture() defaults to 256');

  // Propagated custom size via createForest
  const forestCustom = createForest({ count: 5, textureSize: 128, forceTextureRegen: true });
  // The textures used in materials should have size 128 if generated with 128
  const barkCustom = generateBarkTextures({ size: 128 });
  assert(barkCustom.diffuseMap.image.width === 128, 'F-02: Texture generator respects custom size 128');
  forestCustom.dispose();
}

// 3. F-03 Verification: Coherent Wind Sway (localWindDir)
{
  const forest = createForest({ count: 10, textureSize: 128 });
  const mockShaderFoliage = {
    uniforms: {},
    vertexShader: `#include <common>\n#include <begin_vertex>\n#include <worldpos_vertex>`,
    fragmentShader: `#include <common>\n#include <dithering_fragment>`,
  };
  forest.foliageMesh.material.onBeforeCompile(mockShaderFoliage);

  assert(
    mockShaderFoliage.vertexShader.includes('vec3 localWindDir = uWindDir * instRot;') &&
    mockShaderFoliage.vertexShader.includes('vec3 windOffset = (localWindDir + vec3(0.0, 0.15, 0.0))'),
    'F-03: Foliage shader transforms world wind into instance local coordinates'
  );

  const mockShaderTrunk = {
    uniforms: {},
    vertexShader: `#include <common>\n#include <begin_vertex>\n#include <worldpos_vertex>`,
    fragmentShader: `#include <common>\n#include <dithering_fragment>`,
  };
  forest.trunkMesh.material.onBeforeCompile(mockShaderTrunk);

  assert(
    mockShaderTrunk.vertexShader.includes('vec3 localWindDir = uWindDir * instRot;') &&
    mockShaderTrunk.vertexShader.includes('transformed += localWindDir * trunkSway;'),
    'F-03: Trunk shader transforms world wind into instance local coordinates'
  );

  forest.dispose();
}

// 4. F-04 Verification: Surface Litter Burn Transition Smoothness
{
  const litter = createSurfaceLitter({ count: 50, textureSize: 128 });
  litter.update(0.0);
  assert(litter.litterMesh.material.color.r === 1.0, 'F-04: Litter color is pure white at burnProgress 0.0');

  litter.update(0.5);
  const midR = litter.litterMesh.material.color.r;
  assert(midR > 0.2 && midR < 0.9, `F-04: Litter color smoothly darkens at 0.5 (r=${midR.toFixed(3)})`);

  litter.update(1.0);
  const burnedR = litter.litterMesh.material.color.r;
  assert(burnedR < 0.2, `F-04: Litter color reaches char level at 1.0 (r=${burnedR.toFixed(3)})`);

  // Robustness against NaN, Infinity, -1.0
  litter.update(NaN);
  assert(litter.litterMesh.material.color.r === 1.0, 'F-04: Litter safely handles NaN burnProgress without NaN corruption');

  litter.update(Infinity);
  assert(litter.litterMesh.material.color.r < 0.2, 'F-04: Litter safely clamps Infinity burnProgress to char color');

  litter.update(-2.0);
  assert(litter.litterMesh.material.color.r === 1.0, 'F-04: Litter safely resets to white for negative burnProgress');

  litter.dispose();
}

// 5. Additional Edge-Case Fixes
{
  const zeroForest = createForest({ count: 0 });
  assert(zeroForest.getTreeCount() === 0, 'Edge Case 1: createForest({ count: 0 }) produces 0 trees');
  zeroForest.dispose();

  const zeroUnderstory = createUnderstory({ count: 0 });
  assert(zeroUnderstory.shrubMesh.count === 0, 'Edge Case 1: createUnderstory({ count: 0 }) produces 0 shrubs');
  zeroUnderstory.dispose();

  const zeroLitter = createSurfaceLitter({ count: 0 });
  assert(zeroLitter.litterMesh.count === 0, 'Edge Case 1: createSurfaceLitter({ count: 0 }) produces 0 litter instances');
  zeroLitter.dispose();

  const forest = createForest({ count: 10, textureSize: 128 });
  let nullWindThrew = false;
  try {
    forest.update(1.0, 2.0, null, 0.5);
  } catch (e) {
    nullWindThrew = true;
  }
  assert(!nullWindThrew, 'Edge Case 2: forest.update with null windDir does not throw TypeError');
  forest.dispose();
}

console.log(`\n======================================================`);
console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log(`======================================================\n`);

if (failed > 0) {
  process.exit(1);
}
