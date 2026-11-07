/**
 * High-fidelity Three.js (r160) standalone ES module shim for Node.js verification & stress testing.
 * Implements complete vector/matrix mathematics, geometry generators, materials, and instancing.
 */

export const RepeatWrapping = 1000;
export const ClampToEdgeWrapping = 1001;
export const MirroredRepeatWrapping = 1002;
export const SRGBColorSpace = 'srgb';
export const NoColorSpace = '';
export const DoubleSide = 2;
export const FrontSide = 0;
export const BackSide = 1;
export const NormalBlending = 0;
export const AdditiveBlending = 1;

export class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }
  copy(v) {
    this.x = v.x;
    this.y = v.y;
    return this;
  }
  clone() {
    return new Vector2(this.x, this.y);
  }
}

export class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  copy(v) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }
  clone() {
    return new Vector3(this.x, this.y, this.z);
  }
  add(v) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }
  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }
  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }
  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }
  length() {
    return Math.sqrt(this.lengthSq());
  }
  normalize() {
    const l = this.length();
    if (l > 0.000000001) {
      this.x /= l;
      this.y /= l;
      this.z /= l;
    } else {
      this.x = 0;
      this.y = 0;
      this.z = 0;
    }
    return this;
  }
  cross(v) {
    const x = this.y * v.z - this.z * v.y;
    const y = this.z * v.x - this.x * v.z;
    const z = this.x * v.y - this.y * v.x;
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  applyMatrix4(m) {
    const x = this.x, y = this.y, z = this.z;
    const e = m.elements;
    const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
    this.x = (e[0] * x + e[4] * y + e[8]  * z + e[12]) * w;
    this.y = (e[1] * x + e[5] * y + e[9]  * z + e[13]) * w;
    this.z = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
    return this;
  }
}

export class Euler {
  constructor(x = 0, y = 0, z = 0, order = 'XYZ') {
    this.x = x;
    this.y = y;
    this.z = z;
    this.order = order;
  }
}

export class Matrix4 {
  constructor() {
    this.elements = new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]);
  }
  identity() {
    this.elements.set([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]);
    return this;
  }
  makeTranslation(x, y, z) {
    this.elements.set([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      x, y, z, 1
    ]);
    return this;
  }
  makeScale(x, y, z) {
    this.elements.set([
      x, 0, 0, 0,
      0, y, 0, 0,
      0, 0, z, 0,
      0, 0, 0, 1
    ]);
    return this;
  }
  makeRotationY(theta) {
    const c = Math.cos(theta), s = Math.sin(theta);
    this.elements.set([
       c, 0, -s, 0,
       0, 1,  0, 0,
       s, 0,  c, 0,
       0, 0,  0, 1
    ]);
    return this;
  }
  makeRotationFromEuler(euler) {
    const x = euler.x, y = euler.y, z = euler.z;
    const a = Math.cos(x), b = Math.sin(x);
    const c = Math.cos(y), d = Math.sin(y);
    const e = Math.cos(z), f = Math.sin(z);
    const te = this.elements;

    if (euler.order === 'YXZ') {
      const ce = c * e, cf = c * f, de = d * e, df = d * f;
      te[0] = ce + df * b;
      te[4] = de * b - cf;
      te[8] = a * d;
      te[12] = 0;

      te[1] = a * f;
      te[5] = a * e;
      te[9] = -b;
      te[13] = 0;

      te[2] = cf * b - de;
      te[6] = df + ce * b;
      te[10] = a * c;
      te[14] = 0;

      te[3] = 0; te[7] = 0; te[11] = 0; te[15] = 1;
    } else {
      // Default XYZ
      const ae = a * e, af = a * f, be = b * e, bf = b * f;
      te[0] = c * e;
      te[4] = -c * f;
      te[8] = d;
      te[12] = 0;

      te[1] = af + be * d;
      te[5] = ae - bf * d;
      te[9] = -b * c;
      te[13] = 0;

      te[2] = bf - ae * d;
      te[6] = be + af * d;
      te[10] = a * c;
      te[14] = 0;

      te[3] = 0; te[7] = 0; te[11] = 0; te[15] = 1;
    }
    return this;
  }
  multiply(m) {
    return this.multiplyMatrices(this, m);
  }
  multiplyMatrices(a, b) {
    const ae = a.elements;
    const be = b.elements;
    const te = this.elements;

    const a11 = ae[0], a12 = ae[4], a13 = ae[8],  a14 = ae[12];
    const a21 = ae[1], a22 = ae[5], a23 = ae[9],  a24 = ae[13];
    const a31 = ae[2], a32 = ae[6], a33 = ae[10], a34 = ae[14];
    const a41 = ae[3], a42 = ae[7], a43 = ae[11], a44 = ae[15];

    const b11 = be[0], b12 = be[4], b13 = be[8],  b14 = be[12];
    const b21 = be[1], b22 = be[5], b23 = be[9],  b24 = be[13];
    const b31 = be[2], b32 = be[6], b33 = be[10], b34 = be[14];
    const b41 = be[3], b42 = be[7], b43 = be[11], b44 = be[15];

    te[0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
    te[4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
    te[8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
    te[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;

    te[1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
    te[5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
    te[9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
    te[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;

    te[2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
    te[6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
    te[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
    te[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;

    te[3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
    te[7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
    te[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
    te[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;

    return this;
  }
}

export class Color {
  constructor(r = 1, g, b) {
    if (typeof r === 'number' && g === undefined && b === undefined) {
      if (r > 1) {
        this.setHex(r);
      } else {
        this.r = r;
        this.g = r;
        this.b = r;
      }
    } else {
      this.r = r;
      this.g = g !== undefined ? g : 1;
      this.b = b !== undefined ? b : 1;
    }
  }
  setHex(hex) {
    hex = Math.floor(hex);
    this.r = ((hex >> 16) & 255) / 255;
    this.g = ((hex >> 8) & 255) / 255;
    this.b = (hex & 255) / 255;
    return this;
  }
  lerpColors(c1, c2, alpha) {
    this.r = c1.r + (c2.r - c1.r) * alpha;
    this.g = c1.g + (c2.g - c1.g) * alpha;
    this.b = c1.b + (c2.b - c1.b) * alpha;
    return this;
  }
}

export class BufferAttribute {
  constructor(array, itemSize, normalized = false) {
    this.array = array;
    this.itemSize = itemSize;
    this.count = array.length / itemSize;
    this.normalized = normalized;
    this.needsUpdate = false;
  }
  getX(index) {
    return this.array[index * this.itemSize];
  }
  getY(index) {
    return this.array[index * this.itemSize + 1];
  }
  getZ(index) {
    return this.array[index * this.itemSize + 2];
  }
  setX(index, x) {
    this.array[index * this.itemSize] = x;
    return this;
  }
  setY(index, y) {
    this.array[index * this.itemSize + 1] = y;
    return this;
  }
  setZ(index, z) {
    this.array[index * this.itemSize + 2] = z;
    return this;
  }
  setXYZ(index, x, y, z) {
    const idx = index * this.itemSize;
    this.array[idx] = x;
    this.array[idx + 1] = y;
    this.array[idx + 2] = z;
    return this;
  }
}

export class Box3 {
  constructor(min = new Vector3(+Infinity, +Infinity, +Infinity), max = new Vector3(-Infinity, -Infinity, -Infinity)) {
    this.min = min;
    this.max = max;
  }
  setFromBufferAttribute(attribute) {
    let minX = +Infinity, minY = +Infinity, minZ = +Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < attribute.count; i++) {
      const x = attribute.getX(i);
      const y = attribute.getY(i);
      const z = attribute.getZ(i);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }
    this.min.set(minX, minY, minZ);
    this.max.set(maxX, maxY, maxZ);
    return this;
  }
}

export class BufferGeometry {
  constructor() {
    this.attributes = {};
    this.index = null;
    this.boundingBox = null;
  }
  setAttribute(name, attribute) {
    this.attributes[name] = attribute;
    return this;
  }
  getAttribute(name) {
    return this.attributes[name];
  }
  setIndex(index) {
    if (Array.isArray(index)) {
      this.index = new BufferAttribute(new Uint16Array(index), 1);
    } else {
      this.index = index;
    }
    return this;
  }
  translate(x, y, z) {
    const pos = this.attributes.position;
    if (pos) {
      for (let i = 0; i < pos.count; i++) {
        pos.setXYZ(i, pos.getX(i) + x, pos.getY(i) + y, pos.getZ(i) + z);
      }
      pos.needsUpdate = true;
    }
    return this;
  }
  rotateX(angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const pos = this.attributes.position;
    if (pos) {
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i), z = pos.getZ(i);
        pos.setY(i, y * c - z * s);
        pos.setZ(i, y * s + z * c);
      }
      pos.needsUpdate = true;
    }
    return this;
  }
  rotateY(angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const pos = this.attributes.position;
    if (pos) {
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        pos.setX(i, x * c + z * s);
        pos.setZ(i, -x * s + z * c);
      }
      pos.needsUpdate = true;
    }
    return this;
  }
  rotateZ(angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const pos = this.attributes.position;
    if (pos) {
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i);
        pos.setX(i, x * c - y * s);
        pos.setY(i, x * s + y * c);
      }
      pos.needsUpdate = true;
    }
    return this;
  }
  computeVertexNormals() {
    const pos = this.attributes.position;
    if (!pos) return;
    let norm = this.attributes.normal;
    if (!norm || norm.count !== pos.count) {
      norm = new BufferAttribute(new Float32Array(pos.count * 3), 3);
      this.setAttribute('normal', norm);
    } else {
      norm.array.fill(0);
    }

    const pA = new Vector3(), pB = new Vector3(), pC = new Vector3();
    const cb = new Vector3(), ab = new Vector3();

    if (this.index) {
      const idx = this.index.array;
      for (let i = 0; i < idx.length; i += 3) {
        const vA = idx[i], vB = idx[i + 1], vC = idx[i + 2];
        pA.set(pos.getX(vA), pos.getY(vA), pos.getZ(vA));
        pB.set(pos.getX(vB), pos.getY(vB), pos.getZ(vB));
        pC.set(pos.getX(vC), pos.getY(vC), pos.getZ(vC));

        cb.subVectors(pC, pB);
        ab.subVectors(pA, pB);
        cb.cross(ab);

        norm.setXYZ(vA, norm.getX(vA) + cb.x, norm.getY(vA) + cb.y, norm.getZ(vA) + cb.z);
        norm.setXYZ(vB, norm.getX(vB) + cb.x, norm.getY(vB) + cb.y, norm.getZ(vB) + cb.z);
        norm.setXYZ(vC, norm.getX(vC) + cb.x, norm.getY(vC) + cb.y, norm.getZ(vC) + cb.z);
      }
    } else {
      for (let i = 0; i < pos.count; i += 3) {
        pA.set(pos.getX(i), pos.getY(i), pos.getZ(i));
        pB.set(pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1));
        pC.set(pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));

        cb.subVectors(pC, pB);
        ab.subVectors(pA, pB);
        cb.cross(ab);

        norm.setXYZ(i, cb.x, cb.y, cb.z);
        norm.setXYZ(i + 1, cb.x, cb.y, cb.z);
        norm.setXYZ(i + 2, cb.x, cb.y, cb.z);
      }
    }

    const v = new Vector3();
    for (let i = 0; i < norm.count; i++) {
      v.set(norm.getX(i), norm.getY(i), norm.getZ(i)).normalize();
      norm.setXYZ(i, v.x, v.y, v.z);
    }
    norm.needsUpdate = true;
  }
  computeBoundingBox() {
    if (!this.boundingBox) this.boundingBox = new Box3();
    if (this.attributes.position) {
      this.boundingBox.setFromBufferAttribute(this.attributes.position);
    }
    return this.boundingBox;
  }
  dispose() {}
}
Vector3.prototype.subVectors = function(a, b) {
  this.x = a.x - b.x;
  this.y = a.y - b.y;
  this.z = a.z - b.z;
  return this;
};

export class PlaneGeometry extends BufferGeometry {
  constructor(width = 1, height = 1, widthSegments = 1, heightSegments = 1) {
    super();
    const widthHalf = width / 2;
    const heightHalf = height / 2;
    const gridX = Math.floor(widthSegments) || 1;
    const gridY = Math.floor(heightSegments) || 1;
    const gridX1 = gridX + 1;
    const gridY1 = gridY + 1;
    const segment_width = width / gridX;
    const segment_height = height / gridY;

    const indices = [];
    const vertices = [];
    const normals = [];
    const uvs = [];

    for (let iy = 0; iy < gridY1; iy++) {
      const y = iy * segment_height - heightHalf;
      for (let ix = 0; ix < gridX1; ix++) {
        const x = ix * segment_width - widthHalf;
        vertices.push(x, -y, 0);
        normals.push(0, 0, 1);
        uvs.push(ix / gridX, 1 - (iy / gridY));
      }
    }

    for (let iy = 0; iy < gridY; iy++) {
      for (let ix = 0; ix < gridX; ix++) {
        const a = ix + gridX1 * iy;
        const b = ix + gridX1 * (iy + 1);
        const c = (ix + 1) + gridX1 * (iy + 1);
        const d = (ix + 1) + gridX1 * iy;
        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }

    this.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3));
    this.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
    this.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
    this.setIndex(new BufferAttribute(new Uint16Array(indices), 1));
  }
}

export class CylinderGeometry extends BufferGeometry {
  constructor(radiusTop = 1, radiusBottom = 1, height = 1, radialSegments = 8, heightSegments = 1, openEnded = false) {
    super();
    radialSegments = Math.floor(radialSegments);
    heightSegments = Math.floor(heightSegments);

    const indices = [];
    const vertices = [];
    const normals = [];
    const uvs = [];

    let index = 0;
    const indexArray = [];
    const halfHeight = height / 2;

    const slope = (radiusBottom - radiusTop) / height;

    for (let y = 0; y <= heightSegments; y++) {
      const indexRow = [];
      const v = y / heightSegments;
      const radius = v * (radiusBottom - radiusTop) + radiusTop;

      for (let x = 0; x <= radialSegments; x++) {
        const u = x / radialSegments;
        const theta = u * Math.PI * 2;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        vertices.push(radius * sinTheta, -v * height + halfHeight, radius * cosTheta);

        const normal = new Vector3(sinTheta, slope, cosTheta).normalize();
        normals.push(normal.x, normal.y, normal.z);
        uvs.push(u, 1 - v);

        indexRow.push(index++);
      }
      indexArray.push(indexRow);
    }

    for (let x = 0; x < radialSegments; x++) {
      for (let y = 0; y < heightSegments; y++) {
        const a = indexArray[y][x];
        const b = indexArray[y + 1][x];
        const c = indexArray[y + 1][x + 1];
        const d = indexArray[y][x + 1];
        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }

    this.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3));
    this.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
    this.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
    this.setIndex(new BufferAttribute(new Uint16Array(indices), 1));
  }
}

export class BoxGeometry extends BufferGeometry {
  constructor(width = 1, height = 1, depth = 1) {
    super();
    const w = width / 2, h = height / 2, d = depth / 2;
    const vertices = [
      // front
      -w, -h,  d,   w, -h,  d,   w,  h,  d,  -w,  h,  d,
      // back
       w, -h, -d,  -w, -h, -d,  -w,  h, -d,   w,  h, -d,
      // top
      -w,  h,  d,   w,  h,  d,   w,  h, -d,  -w,  h, -d,
      // bottom
      -w, -h, -d,   w, -h, -d,   w, -h,  d,  -w, -h,  d,
      // right
       w, -h,  d,   w, -h, -d,   w,  h, -d,   w,  h,  d,
      // left
      -w, -h, -d,  -w, -h,  d,  -w,  h,  d,  -w,  h, -d
    ];
    const normals = [
      0,0,1,  0,0,1,  0,0,1,  0,0,1,
      0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1,
      0,1,0,  0,1,0,  0,1,0,  0,1,0,
      0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0,
      1,0,0,  1,0,0,  1,0,0,  1,0,0,
      -1,0,0, -1,0,0, -1,0,0, -1,0,0
    ];
    const uvs = [];
    for (let f = 0; f < 6; f++) {
      uvs.push(0,0, 1,0, 1,1, 0,1);
    }
    const indices = [];
    for (let f = 0; f < 6; f++) {
      const o = f * 4;
      indices.push(o, o+1, o+2, o, o+2, o+3);
    }

    this.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3));
    this.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3));
    this.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
    this.setIndex(new BufferAttribute(new Uint16Array(indices), 1));
  }
}

export class CanvasTexture {
  constructor(canvas) {
    this.image = canvas;
    this.wrapS = ClampToEdgeWrapping;
    this.wrapT = ClampToEdgeWrapping;
    this.repeat = new Vector2(1, 1);
    this.colorSpace = NoColorSpace;
    this.needsUpdate = false;
  }
}

export class MeshStandardMaterial {
  constructor(params = {}) {
    this.color = new Color(0xffffff);
    this.roughness = 1.0;
    this.metalness = 0.0;
    this.side = FrontSide;
    this.transparent = false;
    this.alphaTest = 0.0;
    this.map = null;
    this.normalMap = null;
    this.roughnessMap = null;
    Object.assign(this, params);
  }
  dispose() {}
}

export class InstancedMesh {
  constructor(geometry, material, count) {
    this.geometry = geometry;
    this.material = material;
    this.count = count;
    this.instanceMatrix = new BufferAttribute(new Float32Array(count * 16), 16);
    this.castShadow = false;
    this.receiveShadow = false;
    this.name = '';
  }
  setMatrixAt(index, matrix) {
    this.instanceMatrix.array.set(matrix.elements, index * 16);
  }
  getMatrixAt(index, matrix) {
    const offset = index * 16;
    for (let i = 0; i < 16; i++) {
      matrix.elements[i] = this.instanceMatrix.array[offset + i];
    }
  }
}

export class Group {
  constructor() {
    this.children = [];
    this.name = '';
  }
  add(object) {
    this.children.push(object);
    return this;
  }
  remove(object) {
    const idx = this.children.indexOf(object);
    if (idx !== -1) this.children.splice(idx, 1);
    return this;
  }
}

export class ShaderMaterial {
  constructor(params = {}) {
    this.uniforms = params.uniforms || {};
    this.defines = params.defines || {};
    this.vertexShader = params.vertexShader || '';
    this.fragmentShader = params.fragmentShader || '';
    this.transparent = params.transparent || false;
    this.needsUpdate = false;
    Object.assign(this, params);
  }
  dispose() {}
}

export class MeshBasicMaterial {
  constructor(params = {}) {
    this.color = new Color(0xffffff);
    this.map = params.map || null;
    this.transparent = params.transparent || false;
    Object.assign(this, params);
  }
  dispose() {}
}

export class Mesh {
  constructor(geometry, material) {
    this.geometry = geometry;
    this.material = material;
    this.position = new Vector3();
    this.rotation = { x: 0, y: 0, z: 0 };
    this.scale = new Vector3(1, 1, 1);
    this.visible = true;
    this.name = '';
  }
  dispose() {}
}
