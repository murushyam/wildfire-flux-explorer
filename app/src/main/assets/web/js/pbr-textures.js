/**
 * pbr-textures.js
 * High-performance, zero-download procedural Canvas2D PBR texture generator for Three.js.
 * Produces photorealistic albedo, normal (Sobel operator), roughness, and translucency maps
 * for bark, deciduous/conifer foliage, forest floor litter, and pedological soil stratigraphy.
 */

import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Procedural Math & Noise Utilities (Fast 2D Hash, Hermite Value Noise & fBm)
// ---------------------------------------------------------------------------

function hash21(x, y) {
  let n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function valueNoise2D(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  // Quintic Hermite interpolant for C2 continuity (eliminates grid artifacts)
  const ux = fx * fx * fx * (fx * (fx * 6.0 - 15.0) + 10.0);
  const uy = fy * fy * fy * (fy * (fy * 6.0 - 15.0) + 10.0);

  const a = hash21(ix, iy);
  const b = hash21(ix + 1.0, iy);
  const c = hash21(ix, iy + 1.0);
  const d = hash21(ix + 1.0, iy + 1.0);

  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function periodicNoise2D(x, y, periodX, periodY) {
  const px = ((x % periodX) + periodX) % periodX;
  const py = ((y % periodY) + periodY) % periodY;

  const ix0 = Math.floor(px);
  const iy0 = Math.floor(py);
  const ix1 = (ix0 + 1) % periodX;
  const iy1 = (iy0 + 1) % periodY;

  const fx = px - ix0;
  const fy = py - iy0;

  const ux = fx * fx * fx * (fx * (fx * 6.0 - 15.0) + 10.0);
  const uy = fy * fy * fy * (fy * (fy * 6.0 - 15.0) + 10.0);

  const a = hash21(ix0, iy0);
  const b = hash21(ix1, iy0);
  const c = hash21(ix0, iy1);
  const d = hash21(ix1, iy1);

  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function periodicFbm(x, y, periodX, periodY, octaves = 4, persistence = 0.5, lacunarity = 2.0) {
  let total = 0.0;
  let amplitude = 1.0;
  let maxAmp = 0.0;
  let freqX = 1.0;
  let freqY = 1.0;

  for (let i = 0; i < octaves; i++) {
    total += periodicNoise2D(x * freqX, y * freqY, periodX * freqX, periodY * freqY) * amplitude;
    maxAmp += amplitude;
    amplitude *= persistence;
    freqX *= lacunarity;
    freqY *= lacunarity;
  }
  return total / maxAmp;
}

// ---------------------------------------------------------------------------
// Canvas & Texture Helpers
// ---------------------------------------------------------------------------

function createCanvas(width, height) {
  if (typeof document !== 'undefined' && document.createElement) {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    return c;
  }
  // Headless / Node testing fallback
  return {
    width,
    height,
    getContext: () => ({
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
      putImageData: () => {},
      drawImage: () => {},
      fillRect: () => {},
    })
  };
}

function createTextureFromCanvas(canvas, wrap = true, isColor = false) {
  const tex = new THREE.CanvasTexture(canvas);
  if (wrap) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  if (isColor && THREE.SRGBColorSpace) {
    tex.colorSpace = THREE.SRGBColorSpace;
  } else if (!isColor && THREE.NoColorSpace) {
    tex.colorSpace = THREE.NoColorSpace;
  }
  tex.needsUpdate = true;
  return tex;
}

/**
 * Computes a seamless 3x3 Sobel tangent-space normal map from a height buffer.
 */
function generateSobelNormalMap(heightMap, width, height, strength = 2.5) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(width, height);
  const out = imgData.data;

  for (let y = 0; y < height; y++) {
    const yU = (y - 1 + height) % height;
    const yD = (y + 1) % height;

    for (let x = 0; x < width; x++) {
      const xL = (x - 1 + width) % width;
      const xR = (x + 1) % width;

      const idx = (y * width + x) * 4;

      const hTL = heightMap[yU * width + xL];
      const hT  = heightMap[yU * width + x];
      const hTR = heightMap[yU * width + xR];
      const hL  = heightMap[y * width + xL];
      const hR  = heightMap[y * width + xR];
      const hBL = heightMap[yD * width + xL];
      const hB  = heightMap[yD * width + x];
      const hBR = heightMap[yD * width + xR];

      // Sobel kernel horizontal & vertical gradients
      const dx = (hTR + 2.0 * hR + hBR) - (hTL + 2.0 * hL + hBL);
      const dy = (hBL + 2.0 * hB + hBR) - (hTL + 2.0 * hT + hTR);

      let nx = -dx * strength;
      let ny = -dy * strength;
      let nz = 1.0;

      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1.0;
      nx /= len;
      ny /= len;
      nz /= len;

      out[idx]     = Math.floor((nx * 0.5 + 0.5) * 255);
      out[idx + 1] = Math.floor((ny * 0.5 + 0.5) * 255);
      out[idx + 2] = Math.floor((nz * 0.5 + 0.5) * 255);
      out[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

// ---------------------------------------------------------------------------
// 1. Procedural Tree Bark PBR Generator (Shorea robusta / Scots Pine)
// ---------------------------------------------------------------------------

let cachedBarkTextures = null;
let cachedBarkSize = 0;

/**
 * Generates dark organic tree bark with vertical fissures, knot swells,
 * Sobel normal map, and roughness map.
 */
export function generateBarkTextures(options = {}) {
  const size = options.size || 256;
  if (cachedBarkTextures && !options.force && (!options.size || cachedBarkSize === size)) {
    return cachedBarkTextures;
  }

  const heightMap = new Float32Array(size * size);

  const albedoCanvas = createCanvas(size, size);
  const albedoCtx = albedoCanvas.getContext('2d');
  const albedoImg = albedoCtx.createImageData(size, size);
  const albedoData = albedoImg.data;

  const roughCanvas = createCanvas(size, size);
  const roughCtx = roughCanvas.getContext('2d');
  const roughImg = roughCtx.createImageData(size, size);
  const roughData = roughImg.data;

  // Periods for seamless wrapping
  const periodX = 16.0;
  const periodY = 32.0;

  for (let y = 0; y < size; y++) {
    const ny = (y / size) * periodY;

    for (let x = 0; x < size; x++) {
      const nx = (x / size) * periodX;
      const idx = (y * size + x) * 4;

      // Vertical bark striation with domain warping for organic wavy furrows
      const warp = periodicNoise2D(nx * 0.8, ny * 0.15, periodX * 0.8, periodY * 0.15) * 2.5;
      const warpedX = nx + warp;

      // Longitudinal ridges & furrows
      const furrowBase = Math.abs(Math.sin(warpedX * Math.PI));
      const furrow = Math.pow(furrowBase, 0.65);

      // High-frequency wood grain + microscopic flecks
      const grain = periodicFbm(nx * 3.0, ny * 12.0, periodX * 3.0, periodY * 12.0, 4, 0.55);
      const micro = (hash21(x, y) - 0.5) * 0.12;

      // Combined heightfield [0..1]
      const h = Math.max(0.0, Math.min(1.0, furrow * 0.7 + grain * 0.25 + micro));
      heightMap[y * size + x] = h;

      // Albedo: Dark fibrous organic bark with warm sienna crevices and weathered grey plates
      // Deep fissures: dark charcoal brown (r: 32, g: 22, b: 16)
      // Raised ridges: weathered organic bark (r: 88, g: 62, b: 44)
      const r = Math.floor(32 + h * 58 + micro * 30);
      const g = Math.floor(22 + h * 42 + micro * 22);
      const b = Math.floor(16 + h * 30 + micro * 15);

      albedoData[idx]     = Math.max(15, Math.min(130, r));
      albedoData[idx + 1] = Math.max(10, Math.min(100, g));
      albedoData[idx + 2] = Math.max(8,  Math.min(75,  b));
      albedoData[idx + 3] = 255;

      // Roughness: Furrows and crevices are ultra-matte (0.95), ridges slightly smoother (0.72)
      const roughVal = Math.floor((0.95 - h * 0.22 + micro * 0.5) * 255);
      roughData[idx]     = roughVal;
      roughData[idx + 1] = roughVal;
      roughData[idx + 2] = roughVal;
      roughData[idx + 3] = 255;
    }
  }

  albedoCtx.putImageData(albedoImg, 0, 0);
  roughCtx.putImageData(roughImg, 0, 0);

  // Generate Sobel normal map
  const normalCanvas = generateSobelNormalMap(heightMap, size, size, 3.2);

  const diffuseMap = createTextureFromCanvas(albedoCanvas, true, true);
  diffuseMap.repeat.set(2, 6);

  const normalMap = createTextureFromCanvas(normalCanvas, true, false);
  normalMap.repeat.set(2, 6);

  const roughnessMap = createTextureFromCanvas(roughCanvas, true, false);
  roughnessMap.repeat.set(2, 6);

  cachedBarkTextures = { diffuseMap, normalMap, roughnessMap };
  cachedBarkSize = size;
  return cachedBarkTextures;
}

// ---------------------------------------------------------------------------
// 2. Procedural Foliage Texture Generator (Broadleaf / Needle Tuft Cluster)
// ---------------------------------------------------------------------------

let cachedFoliageTextures = null;
let cachedFoliageSize = 0;

/**
 * Generates an organic botanical leaf cluster with sharp alpha cutout mask,
 * chlorophyll leaf veins, and backlit subsurface translucency map.
 */
export function generateFoliageTexture(options = {}) {
  const size = options.size || 256;
  if (cachedFoliageTextures && !options.force && (!options.size || cachedFoliageSize === size)) {
    return cachedFoliageTextures;
  }

  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  // Translucency map for SSS shader
  const transCanvas = createCanvas(size, size);
  const transCtx = transCanvas.getContext('2d');
  const transImg = transCtx.createImageData(size, size);
  const transData = transImg.data;

  // Alpha cutout mask canvas
  const alphaCanvas = createCanvas(size, size);
  const alphaCtx = alphaCanvas.getContext('2d');
  const alphaImg = alphaCtx.createImageData(size, size);
  const alphaData = alphaImg.data;

  // Define 6 botanical leaves arranged organically in a radial cluster
  const leaves = [
    { cx: 0.50, cy: 0.72, length: 0.38, width: 0.17, angle: -Math.PI / 2 },
    { cx: 0.44, cy: 0.62, length: 0.32, width: 0.15, angle: -Math.PI * 0.72 },
    { cx: 0.56, cy: 0.62, length: 0.32, width: 0.15, angle: -Math.PI * 0.28 },
    { cx: 0.38, cy: 0.45, length: 0.29, width: 0.14, angle: -Math.PI * 0.85 },
    { cx: 0.62, cy: 0.45, length: 0.29, width: 0.14, angle: -Math.PI * 0.15 },
    { cx: 0.50, cy: 0.34, length: 0.30, width: 0.13, angle: -Math.PI * 0.52 },
  ];

  for (let y = 0; y < size; y++) {
    const py = y / size;

    for (let x = 0; x < size; x++) {
      const px = x / size;
      const idx = (y * size + x) * 4;

      let inLeaf = false;
      let minLeafDist = 999.0;
      let leafLaminaDist = 0.0;
      let isVein = false;
      let leafProgress = 0.0;

      // Central twig stem
      const stemDist = Math.hypot(px - 0.5, py - 0.75);
      const isStem = Math.abs(px - 0.5) < 0.014 && py > 0.42 && py < 0.95;

      for (let li = 0; li < leaves.length; li++) {
        const leaf = leaves[li];
        // Coordinate frame aligned with leaf axis
        const dx = px - leaf.cx;
        const dy = py - leaf.cy;

        const cosA = Math.cos(leaf.angle);
        const sinA = Math.sin(leaf.angle);

        // Longitudinal axis along leaf spine (u in [0..1])
        const u = (dx * cosA + dy * sinA) / leaf.length;
        // Lateral axis across leaf blade (v in [-1..1])
        const v = (-dx * sinA + dy * cosA) / leaf.width;

        if (u >= 0.0 && u <= 1.0) {
          // Ovate leaf boundary function: wide near base, tapering to acute drip tip
          const leafShape = Math.sin(u * Math.PI) * (1.0 - u * 0.3);
          const distToEdge = Math.abs(v) - leafShape;

          if (distToEdge < 0.0) {
            inLeaf = true;
            leafProgress = u;
            leafLaminaDist = -distToEdge;

            // Primary central midrib vein
            if (Math.abs(v) < 0.045 * (1.0 - u * 0.6)) {
              isVein = true;
            }

            // Secondary arching lateral veins (spaced along spine at 45 deg)
            const veinSpacing = (u * 8.0) % 1.0;
            const veinAngle = Math.abs(v) * 0.6;
            if (Math.abs(veinSpacing - veinAngle) < 0.055 && u > 0.1 && u < 0.92) {
              isVein = true;
            }

            if (-distToEdge < minLeafDist) {
              minLeafDist = -distToEdge;
            }
          }
        }
      }

      if (inLeaf || isStem) {
        let r, g, b;
        let transR, transG, transB;

        if (isStem) {
          // Woody twig stem (brown/tan)
          r = 75; g = 52; b = 32;
          transR = 20; transG = 15; transB = 5;
        } else if (isVein) {
          // Lighter yellow-green chlorophyll vein
          r = 95; g = 168; b = 45;
          transR = 140; transG = 220; transB = 60;
        } else {
          // Lush photosynthetic lamina with micro-cellular noise
          const cellNoise = (hash21(x, y) - 0.5) * 18;
          // Gradient: deeper green at base, fresher green at margin
          const greenBase = 120 + Math.floor(leafLaminaDist * 40);
          r = Math.max(30, Math.min(85, 48 + cellNoise * 0.4));
          g = Math.max(80, Math.min(175, greenBase + cellNoise));
          b = Math.max(20, Math.min(65, 34 + cellNoise * 0.3));

          // Translucency: leaf blade is highly translucent to back-lighting
          transR = Math.floor(r * 1.8);
          transG = Math.floor(g * 1.6);
          transB = Math.floor(b * 1.2);
        }

        // Albedo & Cutout Alpha
        data[idx]     = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;

        // Translucency Map (glowing yellow-green for SSS)
        transData[idx]     = Math.min(255, transR);
        transData[idx + 1] = Math.min(255, transG);
        transData[idx + 2] = Math.min(255, transB);
        transData[idx + 3] = 255;

        // Alpha mask
        alphaData[idx]     = 255;
        alphaData[idx + 1] = 255;
        alphaData[idx + 2] = 255;
        alphaData[idx + 3] = 255;
      } else {
        // Transparent void
        data[idx]     = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 0;

        transData[idx]     = 0;
        transData[idx + 1] = 0;
        transData[idx + 2] = 0;
        transData[idx + 3] = 0;

        alphaData[idx]     = 0;
        alphaData[idx + 1] = 0;
        alphaData[idx + 2] = 0;
        alphaData[idx + 3] = 255;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  transCtx.putImageData(transImg, 0, 0);
  alphaCtx.putImageData(alphaImg, 0, 0);

  const map = createTextureFromCanvas(canvas, false, true);
  const translucencyMap = createTextureFromCanvas(transCanvas, false, false);
  const alphaMap = createTextureFromCanvas(alphaCanvas, false, false);

  cachedFoliageTextures = { map, alphaMap, translucencyMap };
  cachedFoliageSize = size;
  return cachedFoliageTextures;
}

// ---------------------------------------------------------------------------
// 3. Procedural Forest Floor Surface Litter Texture (Oi Horizon)
// ---------------------------------------------------------------------------

let cachedLitterTextures = null;
let cachedLitterSize = 0;

/**
 * Generates forest floor leaf litter (fallen pine needles, curled leaves,
 * twigs, decomposed organic matter) with Sobel normal and roughness maps.
 */
export function generateLitterTexture(options = {}) {
  const size = options.size || 256;
  if (cachedLitterTextures && !options.force && (!options.size || cachedLitterSize === size)) {
    return cachedLitterTextures;
  }

  const heightMap = new Float32Array(size * size);

  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  const roughCanvas = createCanvas(size, size);
  const roughCtx = roughCanvas.getContext('2d');
  const roughImg = roughCtx.createImageData(size, size);
  const roughData = roughImg.data;

  // Background decomposed organic humus base
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const n1 = periodicFbm(x * 0.05, y * 0.05, 25.6, 25.6, 4);
      const grain = (hash21(x, y) - 0.5) * 15;

      // Dark brown humus soil base
      const r = Math.max(20, Math.min(65, 42 + n1 * 25 + grain));
      const g = Math.max(14, Math.min(48, 28 + n1 * 18 + grain * 0.7));
      const b = Math.max(10, Math.min(36, 20 + n1 * 12));

      data[idx]     = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;

      heightMap[y * size + x] = n1 * 0.3;

      // Base soil roughness: high matte
      roughData[idx]     = 235;
      roughData[idx + 1] = 235;
      roughData[idx + 2] = 235;
      roughData[idx + 3] = 255;
    }
  }

  // Scatter fallen dry broadleaves across the canvas
  const numLeaves = 28;
  for (let i = 0; i < numLeaves; i++) {
    const lcx = (hash21(i * 17.3, 11.2) * size) | 0;
    const lcy = (hash21(i * 31.7, 73.4) * size) | 0;
    const lrad = 22 + (hash21(i * 5.1, 9.3) * 26) | 0;
    const lAngle = hash21(i * 13.9, 4.1) * Math.PI * 2;
    // Russet, ochre, or burnt sienna leaf shades
    const shadeType = hash21(i * 3.3, 8.7);
    const leafR = shadeType > 0.5 ? 120 + ((shadeType * 45) | 0) : 85 + ((shadeType * 35) | 0);
    const leafG = shadeType > 0.5 ? 75 + ((shadeType * 25) | 0) : 52 + ((shadeType * 20) | 0);
    const leafB = shadeType > 0.5 ? 40 + ((shadeType * 15) | 0) : 28 + ((shadeType * 12) | 0);

    const cosA = Math.cos(lAngle);
    const sinA = Math.sin(lAngle);

    for (let dy = -lrad; dy <= lrad; dy++) {
      for (let dx = -lrad; dx <= lrad; dx++) {
        // Rotated local coordinates
        const u = (dx * cosA + dy * sinA) / lrad;
        const v = (-dx * sinA + dy * cosA) / (lrad * 0.55);

        if (u * u + v * v <= 1.0) {
          const px = (lcx + dx + size) % size;
          const py = (lcy + dy + size) % size;
          const pidx = (py * size + px) * 4;

          const edgeFade = 1.0 - (u * u + v * v);
          const leafHeight = 0.45 + edgeFade * 0.45;

          if (leafHeight > heightMap[py * size + px]) {
            heightMap[py * size + px] = leafHeight;

            data[pidx]     = Math.min(255, leafR + ((edgeFade * 20) | 0));
            data[pidx + 1] = Math.min(255, leafG + ((edgeFade * 15) | 0));
            data[pidx + 2] = Math.min(255, leafB + ((edgeFade * 10) | 0));

            // Curled dried leaf has slightly lower roughness than crumbly soil
            const lr = Math.floor(190 + (1.0 - edgeFade) * 50);
            roughData[pidx]     = lr;
            roughData[pidx + 1] = lr;
            roughData[pidx + 2] = lr;
          }
        }
      }
    }
  }

  // Scatter criss-crossing fallen pine needles
  const numNeedles = 120;
  for (let i = 0; i < numNeedles; i++) {
    const x0 = hash21(i * 19.1, 41.3) * size;
    const y0 = hash21(i * 53.7, 17.9) * size;
    const length = 25.0 + hash21(i * 7.1, 2.3) * 35.0;
    const angle = hash21(i * 29.3, 83.1) * Math.PI * 2;

    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    for (let step = 0; step < length; step += 0.8) {
      const px = Math.floor((x0 + cosA * step + size * 2) % size);
      const py = Math.floor((y0 + sinA * step + size * 2) % size);
      const pidx = (py * size + px) * 4;

      heightMap[py * size + px] = Math.max(heightMap[py * size + px], 0.75);

      // Warm copper / orange-brown pine needle color
      data[pidx]     = 145;
      data[pidx + 1] = 88;
      data[pidx + 2] = 42;

      roughData[pidx]     = 180;
      roughData[pidx + 1] = 180;
      roughData[pidx + 2] = 180;
    }
  }

  // Scatter dried twigs
  const numTwigs = 18;
  for (let i = 0; i < numTwigs; i++) {
    const x0 = hash21(i * 71.3, 19.8) * size;
    const y0 = hash21(i * 23.5, 91.2) * size;
    const length = 35.0 + hash21(i * 11.3, 5.1) * 45.0;
    const angle = hash21(i * 47.1, 37.9) * Math.PI * 2;
    const width = 1.8 + hash21(i * 3.7, 1.1) * 2.2;

    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    for (let step = 0; step < length; step += 0.9) {
      const cx = x0 + cosA * step;
      const cy = y0 + sinA * step;

      for (let w = -width; w <= width; w += 0.9) {
        const px = Math.floor((cx - sinA * w + size * 2) % size);
        const py = Math.floor((cy + cosA * w + size * 2) % size);
        const pidx = (py * size + px) * 4;

        heightMap[py * size + px] = Math.max(heightMap[py * size + px], 0.92);

        data[pidx]     = 65;
        data[pidx + 1] = 48;
        data[pidx + 2] = 32;

        roughData[pidx]     = 210;
        roughData[pidx + 1] = 210;
        roughData[pidx + 2] = 210;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  roughCtx.putImageData(roughImg, 0, 0);

  const normalCanvas = generateSobelNormalMap(heightMap, size, size, 2.8);

  const diffuseMap = createTextureFromCanvas(canvas, true, true);
  diffuseMap.repeat.set(4, 4);

  const normalMap = createTextureFromCanvas(normalCanvas, true, false);
  normalMap.repeat.set(4, 4);

  const roughnessMap = createTextureFromCanvas(roughCanvas, true, false);
  roughnessMap.repeat.set(4, 4);

  cachedLitterTextures = { diffuseMap, normalMap, roughnessMap };
  cachedLitterSize = size;
  return cachedLitterTextures;
}

// ---------------------------------------------------------------------------
// 4. Procedural Pedological Stratigraphy Texture Generator (Soil Horizons)
// ---------------------------------------------------------------------------

let cachedStratigraphyTextures = null;
let cachedStratigraphyWidth = 0;
let cachedStratigraphyHeight = 0;

/**
 * Generates the 5-horizon pedological soil stratigraphy cross-section
 * matching soil science and the Similipal research paper:
 * 1. Oi Horizon (Surface Litter, 0 - 5%)
 * 2. Oe/Oa Horizon (Duff / Humus, 5 - 20% - smoldering peat zone)
 * 3. A Horizon (Topsoil with tree roots, 20 - 45%)
 * 4. B Horizon (Reddish clay / subsoil, 45 - 75%)
 * 5. C Horizon (Sedimentary bedrock strata, 75 - 100%)
 */
export function generateStratigraphyTexture(options = {}) {
  const width = options.width || options.size || 256;
  const height = options.height || options.size || 256;
  if (
    cachedStratigraphyTextures &&
    !options.force &&
    (!options.width || cachedStratigraphyWidth === width) &&
    (!options.height || cachedStratigraphyHeight === height)
  ) {
    return cachedStratigraphyTextures;
  }

  const heightMap = new Float32Array(width * height);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  const roughCanvas = createCanvas(width, height);
  const roughCtx = roughCanvas.getContext('2d');
  const roughImg = roughCtx.createImageData(width, height);
  const roughData = roughImg.data;

  for (let y = 0; y < height; y++) {
    // Relative depth from top (0.0) to bottom (1.0)
    const depth = y / height;

    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      // Natural wavy boundary between soil strata
      const boundaryWave = periodicFbm(x * 0.04, depth * 2.0, 20.48, 4.0, 3) * 0.06 - 0.03;
      const effectiveDepth = depth + boundaryWave;

      // Micro-sediment grain & porosity
      const grain = (hash21(x, y) - 0.5) * 16;
      const sedimentNoise = periodicFbm(x * 0.08, y * 0.08, 40.96, 40.96, 4);

      let r, g, b;
      let hVal;
      let roughVal;

      if (effectiveDepth < 0.06) {
        // ---------------------------------------------------------------
        // Oi Horizon: Surface Litter (0 - 5%)
        // Fallen broadleaves, twigs, decomposed organic matter
        // ---------------------------------------------------------------
        r = 68 + grain * 0.5;
        g = 46 + grain * 0.3;
        b = 28 + grain * 0.2;
        hVal = 0.85 + sedimentNoise * 0.15;
        roughVal = 240;
      } else if (effectiveDepth < 0.20) {
        // ---------------------------------------------------------------
        // Oe / Oa Horizon: Duff / Humus (5 - 20%)
        // Spongy, highly-compacted dark peat; active subterranean smoldering zone
        // ---------------------------------------------------------------
        const duffFactor = (effectiveDepth - 0.06) / 0.14;
        r = 28 + grain * 0.3 - duffFactor * 6;
        g = 20 + grain * 0.2 - duffFactor * 4;
        b = 14 + grain * 0.2 - duffFactor * 3;
        hVal = 0.55 + sedimentNoise * 0.2;
        roughVal = 245;
      } else if (effectiveDepth < 0.45) {
        // ---------------------------------------------------------------
        // A Horizon: Topsoil & Mineral Horizon (20 - 45%)
        // Dark rich organic mineral soil with fibrous root networks
        // ---------------------------------------------------------------
        r = 52 + grain * 0.4;
        g = 36 + grain * 0.3;
        b = 24 + grain * 0.2;
        hVal = 0.45 + sedimentNoise * 0.25;
        roughVal = 225;

        // Tree root network cross-sections (branching light tan lines)
        const root1 = Math.abs(Math.sin((x * 0.08) + Math.cos(y * 0.05) * 4.0));
        const root2 = Math.abs(Math.sin((x * 0.15) - (y * 0.08) * 2.0));
        if (root1 < 0.06 || root2 < 0.045) {
          // Fibrous root wood
          r = 135 + grain * 0.5;
          g = 105 + grain * 0.4;
          b = 72  + grain * 0.3;
          hVal = 0.75;
          roughVal = 180;
        }
      } else if (effectiveDepth < 0.72) {
        // ---------------------------------------------------------------
        // B Horizon: Subsoil (45 - 72%)
        // Weathered reddish-ochre lateritic clay and silt with gravel pebbles
        // ---------------------------------------------------------------
        const clayFactor = (effectiveDepth - 0.45) / 0.27;
        r = 95 + clayFactor * 18 + grain * 0.5;
        g = 52 + clayFactor * 10 + grain * 0.3;
        b = 32 + clayFactor * 6  + grain * 0.2;
        hVal = 0.35 + sedimentNoise * 0.35;
        roughVal = 210;

        // Weathered stone inclusions (grey/white pebbles)
        const pebbleNoise = periodicFbm(x * 0.12, y * 0.12, 61.44, 61.44, 3);
        if (pebbleNoise > 0.78) {
          r = 145 + grain * 0.5;
          g = 138 + grain * 0.5;
          b = 132 + grain * 0.5;
          hVal = 0.88;
          roughVal = 160;
        }
      } else {
        // ---------------------------------------------------------------
        // C Horizon: Fractured Bedrock (72 - 100%)
        // Metamorphic / sedimentary layered parent rock with horizontal fissures
        // ---------------------------------------------------------------
        const strataBanding = Math.sin(y * 0.18 + periodicFbm(x * 0.05, 0, 25.6, 1.0, 2) * 5.0);
        const strataColor = strataBanding * 0.5 + 0.5;

        // Rock base: weathered granite/gneiss grey-tan
        r = Math.floor(75 + strataColor * 32 + grain * 0.4);
        g = Math.floor(70 + strataColor * 28 + grain * 0.4);
        b = Math.floor(66 + strataColor * 24 + grain * 0.4);

        // Sedimentary joint cracks
        if (Math.abs(strataBanding) > 0.94) {
          r = 28; g = 26; b = 25; // Dark fissure crack
          hVal = 0.15;
          roughVal = 255;
        } else {
          hVal = 0.65 + strataColor * 0.25;
          roughVal = 175;
        }
      }

      data[idx]     = Math.max(0, Math.min(255, Math.floor(r)));
      data[idx + 1] = Math.max(0, Math.min(255, Math.floor(g)));
      data[idx + 2] = Math.max(0, Math.min(255, Math.floor(b)));
      data[idx + 3] = 255;

      heightMap[y * width + x] = hVal;

      roughData[idx]     = roughVal;
      roughData[idx + 1] = roughVal;
      roughData[idx + 2] = roughVal;
      roughData[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  roughCtx.putImageData(roughImg, 0, 0);

  const normalCanvas = generateSobelNormalMap(heightMap, width, height, 3.5);

  const diffuseMap = createTextureFromCanvas(canvas, false, true);
  const normalMap = createTextureFromCanvas(normalCanvas, false, false);
  const roughnessMap = createTextureFromCanvas(roughCanvas, false, false);

  cachedStratigraphyTextures = { diffuseMap, normalMap, roughnessMap };
  cachedStratigraphyWidth = width;
  cachedStratigraphyHeight = height;
  return cachedStratigraphyTextures;
}
