import * as THREE from 'three';

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function hash(str) { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

export function makeWorld(scene) {
  const world = { group: new THREE.Group(), systems: {} };
  scene.add(world.group);
  scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x203010, 1.0));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.position.set(5, 10, 3); scene.add(sun);
  return world;
}

const H = (x, z, r, relief) => relief * (Math.sin(x * 0.35 + r) * 1.2 + Math.cos(z * 0.3 + r * 2) * 1.0 + Math.sin((x + z) * 0.8 + r) * 0.3);

export function buildSite(world, site) {
  world.group.clear();
  const r = rng(hash(site.id)); const off = r() * 10; const relief = site.relief ?? 1;
  const geo = new THREE.PlaneGeometry(20, 20, 80, 80); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, H(p.getX(i), p.getZ(i), off, relief));
  geo.computeVertexNormals();
  world.terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x3b5d2a, flatShading: true }));
  world.group.add(world.terrain);
  const N = Math.round(1500 * (site.forest_density ?? 0.8));
  const tree = new THREE.ConeGeometry(0.15, 0.6, 5); tree.translate(0, 0.3, 0);
  world.trees = new THREE.InstancedMesh(tree, new THREE.MeshStandardMaterial({ color: 0x2f7d32 }), N);
  const m = new THREE.Matrix4(); world.treePos = [];
  for (let i = 0; i < N; i++) {
    const x = (r() - 0.5) * 19, z = (r() - 0.5) * 19, y = H(x, z, off, relief), s = 0.6 + r() * 0.8;
    m.makeScale(s, s, s).setPosition(x, y, z); world.trees.setMatrixAt(i, m); world.treePos.push([x, y, z]);
  }
  world.group.add(world.trees);
  world.systems = {
    fire: particles(world, 1500, 0xff5a1f, 0.12),
    smoke: particles(world, 2500, 0x8a8a8a, 0.25, 0.35),
    up: particles(world, 1200, 0x4fc3f7, 0.08),   // LH / ET / SH upward
    down: particles(world, 800, 0x76ff03, 0.08),   // GPP uptake
  };
}

function particles(world, n, color, size, opacity = 0.9) {
  const g = new THREE.BufferGeometry(); const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) seed(world, pos, i);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size, transparent: true, opacity, depthWrite: false }));
  pts.userData = { n, active: 0 }; world.group.add(pts); return pts;
}
function seed(world, pos, i) {
  const t = world.treePos[(Math.random() * world.treePos.length) | 0] || [0, 0, 0];
  pos[i * 3] = t[0]; pos[i * 3 + 1] = t[1] + Math.random() * 4; pos[i * 3 + 2] = t[2];
}

// Map normalized intensities (0..1) to visible particle counts; animate.
export function updateSystems(world, k, dt) {
  const { fire, smoke, up, down } = world.systems; if (!fire) return;
  const set = (s, f) => { s.userData.active = Math.floor(s.userData.n * Math.max(0, Math.min(1, f))); s.geometry.setDrawRange(0, s.userData.active); };
  set(fire, k.fire); set(smoke, k.aod); set(up, k.up); set(down, k.gpp);
  move(world, fire, 2.0 * dt, 1.5); move(world, smoke, 0.8 * dt, 6, 0.3 * dt); move(world, up, 1.6 * dt, 5); move(world, down, -1.2 * dt, 5);
}
function move(world, s, vy, top, drift = 0) {
  const p = s.geometry.attributes.position.array;
  for (let i = 0; i < s.userData.active; i++) {
    p[i * 3 + 1] += vy; p[i * 3] += drift;
    const base = world.treePos.length ? 0 : 0;
    if (p[i * 3 + 1] > top + 3 || p[i * 3 + 1] < -3 + base) seed(world, p, i);
  }
  s.geometry.attributes.position.needsUpdate = true;
}
