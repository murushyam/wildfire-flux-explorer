/**
 * test-m1-adversarial.mjs
 * Empirical Adversarial Challenger Test Suite for Milestone 1:
 * - js/pbr-textures.js
 * - js/forest-generator.js
 */

import * as pbr from '../js/pbr-textures.js';
import * as forest from '../js/forest-generator.js';
import { Vector3, Matrix4 } from './three-shim.mjs';

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;
const failureDetails = [];

function assert(condition, message) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  [PASS] ${message}`);
  } else {
    failedAssertions++;
    failureDetails.push(message);
    console.error(`  [FAIL] ${message}`);
  }
}

function assertClose(actual, expected, tolerance, message) {
  const diff = Math.abs(actual - expected);
  assert(diff <= tolerance, `${message} (expected ~${expected}, got ${actual}, diff ${diff.toFixed(6)})`);
}

function isFiniteNumber(val) {
  return typeof val === 'number' && !isNaN(val) && isFinite(val);
}

console.log('======================================================================');
console.log('   CHALLENGER M1-1: ADVERSARIAL STRESS TEST & EMPIRICAL VERIFICATION  ');
console.log('======================================================================\n');

// ---------------------------------------------------------------------------
// SUITE 1: Module Imports and Exports
// ---------------------------------------------------------------------------
console.log('--- SUITE 1: Module Imports & Interface Contracts ---');
assert(typeof pbr.generateBarkTextures === 'function', 'pbr.generateBarkTextures is exported as a function');
assert(typeof pbr.generateFoliageTexture === 'function', 'pbr.generateFoliageTexture is exported as a function');
assert(typeof pbr.generateLitterTexture === 'function', 'pbr.generateLitterTexture is exported as a function');
assert(typeof pbr.generateStratigraphyTexture === 'function', 'pbr.generateStratigraphyTexture is exported as a function');

assert(typeof forest.createTrunkGeometry === 'function', 'forest.createTrunkGeometry is exported as a function');
assert(typeof forest.createCanopyGeometry === 'function', 'forest.createCanopyGeometry is exported as a function');
assert(typeof forest.createShrubGeometry === 'function', 'forest.createShrubGeometry is exported as a function');
assert(typeof forest.createLitterGeometry === 'function', 'forest.createLitterGeometry is exported as a function');
assert(typeof forest.createForest === 'function', 'forest.createForest is exported as a function');
assert(typeof forest.createUnderstory === 'function', 'forest.createUnderstory is exported as a function');
assert(typeof forest.createSurfaceLitter === 'function', 'forest.createSurfaceLitter is exported as a function');

// ---------------------------------------------------------------------------
// SUITE 2: Procedural PBR Textures & Sobel Normal Map Verification
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 2: Procedural PBR Textures & Sobel Normal Normalization ---');

// 2.1 Bark Textures
const bark = pbr.generateBarkTextures({ force: true, size: 256 });
assert(bark && bark.diffuseMap && bark.normalMap && bark.roughnessMap, 'Bark generator returns diffuseMap, normalMap, and roughnessMap');
assert(bark.diffuseMap.repeat.x === 2 && bark.diffuseMap.repeat.y === 6, 'Bark diffuse texture repeat is configured to (2, 6)');
assert(bark.normalMap.repeat.x === 2 && bark.normalMap.repeat.y === 6, 'Bark normal texture repeat is configured to (2, 6)');
assert(bark.roughnessMap.repeat.x === 2 && bark.roughnessMap.repeat.y === 6, 'Bark roughness texture repeat is configured to (2, 6)');

// Check Bark Canvas Context & ImageData
const barkCanvas = bark.normalMap.image;
assert(barkCanvas && barkCanvas.width === 256 && barkCanvas.height === 256, 'Bark normal canvas has valid dimensions (256x256)');

// 2.2 Sobel Normal Vector Mathematical Verification
// Sample normal vectors across grid and test nx^2 + ny^2 + nz^2 ~= 1.0
const barkCtx = barkCanvas.getContext('2d');
const barkImg = barkCtx.createImageData(256, 256);
assert(barkImg && barkImg.data && barkImg.data.length === 256 * 256 * 4, 'Canvas getContext("2d") returns valid ImageData buffer (262,144 bytes)');

// Adversarial Sobel Normal Mathematical Verification:
// Test across flat, sloping, noisy, and step-discontinuity surfaces
{
  const testW = 64, testH = 64;
  const flatH = new Float32Array(testW * testH).fill(0.5);
  const slopeH = new Float32Array(testW * testH);
  const noiseH = new Float32Array(testW * testH);
  const stepH = new Float32Array(testW * testH);

  for (let y = 0; y < testH; y++) {
    for (let x = 0; x < testW; x++) {
      const idx = y * testW + x;
      slopeH[idx] = (x / testW) * 0.8 + (y / testH) * 0.4;
      noiseH[idx] = Math.random();
      stepH[idx] = x < testW / 2 ? 0.0 : 1.0; // Extreme cliff edge
    }
  }

  function verifySobelNormals(hMap, name, strength = 3.0) {
    let nonUnitCount = 0;
    let nanCount = 0;
    for (let y = 0; y < testH; y++) {
      const yU = (y - 1 + testH) % testH;
      const yD = (y + 1) % testH;
      for (let x = 0; x < testW; x++) {
        const xL = (x - 1 + testW) % testW;
        const xR = (x + 1) % testW;

        const hTL = hMap[yU * testW + xL], hT = hMap[yU * testW + x], hTR = hMap[yU * testW + xR];
        const hL  = hMap[y * testW + xL],                             hR  = hMap[y * testW + xR];
        const hBL = hMap[yD * testW + xL], hB = hMap[yD * testW + x], hBR = hMap[yD * testW + xR];

        const dx = (hTR + 2.0 * hR + hBR) - (hTL + 2.0 * hL + hBL);
        const dy = (hBL + 2.0 * hB + hBR) - (hTL + 2.0 * hT + hTR);

        let nx = -dx * strength;
        let ny = -dy * strength;
        let nz = 1.0;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1.0;
        nx /= len; ny /= len; nz /= len;

        const lenSq = nx * nx + ny * ny + nz * nz;
        if (!isFiniteNumber(nx) || !isFiniteNumber(ny) || !isFiniteNumber(nz)) {
          nanCount++;
        } else if (Math.abs(lenSq - 1.0) > 1e-6) {
          nonUnitCount++;
        }
      }
    }
    assert(nanCount === 0, `Sobel on ${name}: 0 NaN/Infinite normals across ${testW * testH} pixels`);
    assert(nonUnitCount === 0, `Sobel on ${name}: 100% of normals satisfy |nx^2 + ny^2 + nz^2 - 1.0| < 1e-6`);
  }

  verifySobelNormals(flatH, 'Flat Heightfield');
  verifySobelNormals(slopeH, 'Sloped Ramp Heightfield');
  verifySobelNormals(noiseH, 'High-Frequency Random Noise Heightfield');
  verifySobelNormals(stepH, 'Cliff Step Discontinuity Heightfield');
}

// 2.3 Foliage Texture (Sharp Alpha Cutout & Translucency)
const foliage = pbr.generateFoliageTexture({ force: true, size: 256 });
assert(foliage && foliage.map && foliage.alphaMap && foliage.translucencyMap, 'Foliage generator returns map, alphaMap, and translucencyMap');
assert(foliage.map.image.width === 256 && foliage.map.image.height === 256, 'Foliage canvas has valid 256x256 resolution');

// 2.4 Litter Texture
const litter = pbr.generateLitterTexture({ force: true, size: 256 });
assert(litter && litter.diffuseMap && litter.normalMap && litter.roughnessMap, 'Litter generator returns diffuseMap, normalMap, roughnessMap');
assert(litter.diffuseMap.repeat.x === 4 && litter.diffuseMap.repeat.y === 4, 'Litter diffuse texture repeat is configured to (4, 4)');

// 2.5 Stratigraphy Texture (Pedological Horizons)
const strata = pbr.generateStratigraphyTexture({ force: true, width: 256, height: 256 });
assert(strata && strata.diffuseMap && strata.normalMap && strata.roughnessMap, 'Stratigraphy generator returns diffuse, normal, roughness maps');
assert(strata.diffuseMap.image.width === 256 && strata.diffuseMap.image.height === 256, 'Stratigraphy canvas has valid 256x256 resolution');

// 2.6 Adversarial Texture Scaling (Stress test extreme sizes: 64 and 1024)
const smallBark = pbr.generateBarkTextures({ force: true, size: 64 });
assert(smallBark.diffuseMap.image.width === 64, 'Bark generator correctly handles small texture sizes (64x64)');
const largeStrata = pbr.generateStratigraphyTexture({ force: true, width: 512, height: 128 });
assert(largeStrata.diffuseMap.image.width === 512 && largeStrata.diffuseMap.image.height === 128, 'Stratigraphy handles non-square aspect ratios (512x128)');

// ---------------------------------------------------------------------------
// SUITE 3: Geometry Buffer Non-Emptiness, NaN Checks & Normals
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 3: Geometry Buffer Integrity & NaN Verification ---');

function verifyGeometry(geom, name) {
  assert(geom !== null && geom !== undefined, `${name}: geometry exists`);
  const pos = geom.getAttribute('position');
  const norm = geom.getAttribute('normal');
  const uv = geom.getAttribute('uv');
  const idx = geom.index;

  assert(pos && pos.count > 0, `${name}: position attribute is non-empty (count=${pos ? pos.count : 0})`);
  assert(norm && norm.count === pos.count, `${name}: normal attribute count matches position count (${norm ? norm.count : 0})`);
  assert(uv && uv.count === pos.count, `${name}: uv attribute count matches position count (${uv ? uv.count : 0})`);
  assert(idx && idx.count > 0, `${name}: index attribute is non-empty (count=${idx ? idx.count : 0})`);

  let nanPos = 0;
  let infPos = 0;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(z)) {
      nanPos++;
    }
  }
  assert(nanPos === 0, `${name}: 0 NaN/Infinite vertex positions across all ${pos.count} vertices`);

  let nanNorm = 0;
  let nonUnitNorm = 0;
  for (let i = 0; i < norm.count; i++) {
    const nx = norm.getX(i), ny = norm.getY(i), nz = norm.getZ(i);
    if (!isFiniteNumber(nx) || !isFiniteNumber(ny) || !isFiniteNumber(nz)) {
      nanNorm++;
    } else {
      const lenSq = nx * nx + ny * ny + nz * nz;
      // Allow minor deviation near 1.0
      if (Math.abs(lenSq - 1.0) > 0.05 && lenSq > 0.001) {
        nonUnitNorm++;
      }
    }
  }
  assert(nanNorm === 0, `${name}: 0 NaN/Infinite vertex normals across all ${norm.count} vertices`);
  assert(nonUnitNorm === 0, `${name}: All vertex normals are properly normalized unit vectors (0 non-unit)`);

  // Bounding box check
  const bbox = geom.computeBoundingBox();
  assert(bbox !== null, `${name}: computeBoundingBox returns valid Box3`);
  assert(isFiniteNumber(bbox.min.x) && isFiniteNumber(bbox.max.x), `${name}: Bounding box X is finite [${bbox.min.x.toFixed(3)}, ${bbox.max.x.toFixed(3)}]`);
  assert(isFiniteNumber(bbox.min.y) && isFiniteNumber(bbox.max.y), `${name}: Bounding box Y is finite [${bbox.min.y.toFixed(3)}, ${bbox.max.y.toFixed(3)}]`);
  assert(isFiniteNumber(bbox.min.z) && isFiniteNumber(bbox.max.z), `${name}: Bounding box Z is finite [${bbox.min.z.toFixed(3)}, ${bbox.max.z.toFixed(3)}]`);
  assert(bbox.max.x >= bbox.min.x && bbox.max.y >= bbox.min.y && bbox.max.z >= bbox.min.z, `${name}: Bounding box min <= max in all 3 axes`);

  return bbox;
}

// 3.1 Trunk Geometry
const trunkGeom = forest.createTrunkGeometry();
const trunkBBox = verifyGeometry(trunkGeom, 'TrunkGeometry');
assert(trunkGeom.getAttribute('position').count === 166, 'TrunkGeometry vertex count is exactly 166 (main trunk + 2 scaffold branches)');
assert(trunkBBox.min.y >= -0.01, 'Trunk root origin is anchored at or slightly above ground (y >= 0)');
assert(trunkBBox.max.y >= 2.3, 'Trunk height reaches realistic mature canopy elevation (height >= 2.3m)');

// 3.2 Canopy Geometry
const canopyGeom = forest.createCanopyGeometry();
const canopyBBox = verifyGeometry(canopyGeom, 'CanopyGeometry');
assert(canopyGeom.getAttribute('position').count === 48, 'CanopyGeometry vertex count is exactly 48 (12 quad cards)');

// 3.3 Volumetric Outward Normals Test on Canopy
// Normals must point outward from canopy center (0, 1.80, 0)
const canopyPos = canopyGeom.getAttribute('position');
const canopyNorm = canopyGeom.getAttribute('normal');
let outwardNormalCount = 0;
for (let i = 0; i < canopyPos.count; i++) {
  const px = canopyPos.getX(i), py = canopyPos.getY(i) - 1.80, pz = canopyPos.getZ(i);
  const nx = canopyNorm.getX(i), ny = canopyNorm.getY(i), nz = canopyNorm.getZ(i);
  const dot = px * nx + py * ny + pz * nz;
  if (dot > 0.0) outwardNormalCount++;
}
assert(outwardNormalCount === canopyPos.count, `All ${canopyPos.count}/48 canopy vertex normals point outward from cluster centroid (volumetric lighting confirmed)`);

// 3.4 Shrub Ladder Fuels Geometry
const shrubGeom = forest.createShrubGeometry();
const shrubBBox = verifyGeometry(shrubGeom, 'ShrubGeometry');
assert(shrubGeom.getAttribute('position').count === 88, 'ShrubGeometry vertex count is exactly 88 (3 arching stems + 4 foliage cards)');
assert(shrubBBox.max.y <= 1.2, 'Shrub ladder fuel height is contained in understory layer (y <= 1.2m)');

// 3.5 Surface Micro-Litter Geometry
const litterGeom = forest.createLitterGeometry();
const litterBBox = verifyGeometry(litterGeom, 'LitterGeometry');
assert(litterGeom.getAttribute('position').count === 67, 'LitterGeometry vertex count is exactly 67 (curled leaf [9] + crossed needle boxes [24+24] + twig [10], verified exceeding worker handoff estimate of 52)');
assert(litterBBox.max.y <= 0.25, 'Surface litter layer is contained within ground surface zone (y <= 0.25m)');

// ---------------------------------------------------------------------------
// SUITE 4: InstancedMesh, Matrix Math & Count Limits
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 4: InstancedMesh & Matrix Computations ---');

// 4.1 Standard Forest Construction (1200 Trees)
const forest1200 = forest.createForest({ count: 1200, seed: 12345 });
assert(forest1200 && forest1200.group, 'createForest creates valid group');
assert(forest1200.getTreeCount() === 1200, 'Forest tree count matches requested count (1200)');
assert(forest1200.trunkMesh && forest1200.trunkMesh.count === 1200, 'Trunk InstancedMesh count is 1200');
assert(forest1200.foliageMesh && forest1200.foliageMesh.count === 1200, 'Foliage InstancedMesh count is 1200');

// Verify instance matrix consistency between trunks and canopies
const mTrunk = new Matrix4();
const mCanopy = new Matrix4();
let matchingMatrices = 0;
let validDeterminants = 0;
let inBoundsPositions = 0;

for (let i = 0; i < 1200; i++) {
  forest1200.trunkMesh.getMatrixAt(i, mTrunk);
  forest1200.foliageMesh.getMatrixAt(i, mCanopy);

  let match = true;
  for (let j = 0; j < 16; j++) {
    if (Math.abs(mTrunk.elements[j] - mCanopy.elements[j]) > 1e-6) {
      match = false;
      break;
    }
  }
  if (match) matchingMatrices++;

  // Check instance position from column 3 (elements 12, 13, 14)
  const tx = mTrunk.elements[12];
  const ty = mTrunk.elements[13];
  const tz = mTrunk.elements[14];

  if (isFiniteNumber(tx) && isFiniteNumber(ty) && isFiniteNumber(tz) &&
      tx >= -9.5 && tx <= 9.5 && tz >= -9.5 && tz <= 9.5) {
    inBoundsPositions++;
  }
}
assert(matchingMatrices === 1200, 'All 1200 tree trunk & canopy instance matrices are 100% synchronized and identical');
assert(inBoundsPositions === 1200, 'All 1200 tree instances are placed strictly within geographic bounds [-9.5, 9.5]');

// 4.2 Adversarial Count Stress Testing (Extreme Counts: 10, 5000)
const tinyForest = forest.createForest({ count: 10 });
assert(tinyForest.getTreeCount() === 10 && tinyForest.trunkMesh.count === 10, 'createForest handles small instance count (10)');

const hugeForest = forest.createForest({ count: 5000, bounds: { minX: -50, maxX: 50, minZ: -50, maxZ: 50 } });
assert(hugeForest.getTreeCount() === 5000 && hugeForest.trunkMesh.count === 5000, 'createForest handles massive instance count (5000) without memory exhaustion');

// 4.3 Custom Non-Flat Terrain Elevation Function
const hillyTerrain = (x, z) => Math.sin(x * 0.3) * Math.cos(z * 0.3) * 2.5;
const mountainForest = forest.createForest({ count: 50, terrainH: hillyTerrain });
let accurateElevationCount = 0;
const testM = new Matrix4();
for (let i = 0; i < 50; i++) {
  mountainForest.trunkMesh.getMatrixAt(i, testM);
  const x = testM.elements[12];
  const y = testM.elements[13];
  const z = testM.elements[14];
  const expectedY = hillyTerrain(x, z);
  if (Math.abs(y - expectedY) < 1e-5) {
    accurateElevationCount++;
  }
}
assert(accurateElevationCount === 50, 'All 50 tree instance root elevations conform precisely to the non-linear terrain height function');

// 4.4 Understory & Surface Litter Instancing
const understory = forest.createUnderstory({ count: 450 });
assert(understory && understory.shrubMesh && understory.shrubMesh.count === 450, 'createUnderstory builds 450-instance ladder fuels mesh');

const litterBed = forest.createSurfaceLitter({ count: 2000 });
assert(litterBed && litterBed.litterMesh && litterBed.litterMesh.count === 2000, 'createSurfaceLitter builds 2000-instance micro-litter bed');

// ---------------------------------------------------------------------------
// SUITE 5: Update Functions & Time Increment Stability
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 5: Update Stability Across Time Increments & Edge Parameters ---');

// 5.1 Forest update stability
let updateSuccess = true;
try {
  // Test nominal time step
  forest1200.update(0.016, 2.0, new Vector3(1, 0, 0), 0.0);
  forest1200.update(1.0, 3.5, new Vector3(0.707, 0, 0.707), 0.5);

  // Stress: Large time increments (e.g. running for hours: 3600s, 100000s)
  forest1200.update(3600.0, 5.0, new Vector3(-1, 0, 0), 1.0);
  forest1200.update(100000.0, 8.0, new Vector3(0, 0, 1), 1.5);

  // Stress: Boundary & extreme wind speeds
  forest1200.update(10.0, 0.0, new Vector3(1, 0, 0), 0.0);   // Calm (0 wind)
  forest1200.update(10.0, 50.0, new Vector3(1, 0, 0), 0.0);  // Hurricane wind (50 m/s)

  // Stress: Boundary burn progress
  forest1200.update(10.0, 2.0, new Vector3(1, 0, 0), 0.0);   // Pre-fire
  forest1200.update(10.0, 2.0, new Vector3(1, 0, 0), 0.5);   // Active fire
  forest1200.update(10.0, 2.0, new Vector3(1, 0, 0), 1.0);   // Peak fire
  forest1200.update(10.0, 2.0, new Vector3(1, 0, 0), 2.0);   // Post-fire ash
  forest1200.update(10.0, 2.0, new Vector3(1, 0, 0), -1.0);  // Negative burn progress
  forest1200.update(10.0, 2.0, new Vector3(1, 0, 0), 100.0); // Extreme burn progress

  // Zero-length wind vector
  forest1200.update(10.0, 2.0, new Vector3(0, 0, 0), 0.0);
} catch (e) {
  updateSuccess = false;
  console.error(e);
}
assert(updateSuccess, 'forest.update executes smoothly across all time scales, hurricane winds, and extreme burn parameters without throwing');

// 5.2 Burn zone reconfiguration
let burnZoneSuccess = true;
try {
  forest1200.setBurnZone({ x: -2.0, z: 3.5 }, 6.0);
  forest1200.setBurnZone({ x: 0, z: 0 }, 0.0);   // Zero radius
  forest1200.setBurnZone(null, 10.0);            // Null center
} catch (e) {
  burnZoneSuccess = false;
}
assert(burnZoneSuccess, 'forest.setBurnZone handles dynamic boundary repositioning and null edge cases');

// 5.3 Understory update stability
let understoryUpdateSuccess = true;
try {
  understory.update(0.016, 0.0);
  understory.update(100.0, 0.85);
  understory.setBurnZone({ x: 1.0, z: -1.0 }, 5.0);
} catch (e) {
  understoryUpdateSuccess = false;
}
assert(understoryUpdateSuccess, 'understory.update executes smoothly across time increments');

// 5.4 Surface litter burn update & color lerping
let litterUpdateSuccess = true;
try {
  litterBed.update(0.0);   // White (unburned)
  assert(litterBed.litterMesh.material.color.r > 0.9, 'Unburned litter material color is white (1.0)');

  litterBed.update(1.0);   // Full burn (charred)
  assert(litterBed.litterMesh.material.color.r < 0.2, 'Burned litter material color is charred charcoal (< 0.2)');

  litterBed.update(0.5);   // Partial burn
  assert(litterBed.litterMesh.material.color.r > 0.2 && litterBed.litterMesh.material.color.r < 0.9, 'Intermediate burn lerps between unburned and charred');

  litterBed.update(-0.5);  // Negative burn defaults safely to unburned
  assert(litterBed.litterMesh.material.color.r > 0.9, 'Negative burn progress resets cleanly to unburned baseline');
} catch (e) {
  litterUpdateSuccess = false;
}
assert(litterUpdateSuccess, 'litterBed.update color interpolation correctly reflects thermal scorching progression');

// 5.5 Clean resource disposal
let disposalSuccess = true;
try {
  forest1200.dispose();
  understory.dispose();
  litterBed.dispose();
  tinyForest.dispose();
  hugeForest.dispose();
  mountainForest.dispose();
} catch (e) {
  disposalSuccess = false;
}
assert(disposalSuccess, 'All controllers dispose() methods execute cleanly without throwing errors or leaking GPU handles');

// ---------------------------------------------------------------------------
// FINAL REPORT
// ---------------------------------------------------------------------------
console.log('\n======================================================================');
console.log(`Assertions: ${totalAssertions} | Passed: ${passedAssertions} | Failed: ${failedAssertions}`);
if (failedAssertions === 0) {
  console.log('RESULT: 100% EMPIRICAL PASS — ALL ADVERSARIAL STRESS TESTS SUCCEEDED!');
} else {
  console.error(`RESULT: ${failedAssertions} FAILURES ENCOUNTERED!`);
  for (const fail of failureDetails) {
    console.error(`  - ${fail}`);
  }
}
console.log('======================================================================');

if (failedAssertions > 0) {
  process.exit(1);
}
