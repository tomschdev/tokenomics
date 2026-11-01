// ============================================================ environment styling: floating islands, ground, rainbows, sparkles
function buildIsland(parent, x0, x1, z0, z1, topY, seed) {
  const top = [], dirt = [], stone = [];
  const w = x1 - x0, d = z1 - z0;
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
    // rounded corners on the top layer
    const cx = Math.min(x - x0, x1 - x), cz = Math.min(z - z0, z1 - z); if (cx + cz < 2 && hash2(x + seed, z) > 0.3) continue;
    top.push([x, topY - 0.5, z]);
    const depthMax = 2 + Math.floor(Math.min(cx, cz) * 0.9 + hash2(x * 3 + seed, z * 7) * 2.5);
    for (let k = 1; k <= Math.min(depthMax, 9); k++) (k > 2 && hash2(x + k, z + seed) > 0.55 ? stone : dirt).push([x, topY - 0.5 - k, z]);
  }
  const inst = (arr, mat) => { if (!arr.length) return; const m = new THREE.InstancedMesh(V.geo.cube, mat, arr.length); const o = new THREE.Object3D(); arr.forEach((p, k) => { o.position.set(p[0], p[1], p[2]); o.updateMatrix(); m.setMatrixAt(k, o.matrix); }); parent.add(m); };
  inst(top, V.mat.grass); inst(dirt, V.mat.dirt); inst(stone, V.mat.stone);
  // a few tufts of grass and a voxel bush
  for (let k = 0; k < Math.round(w * d / 40); k++) {
    const x = x0 + 1 + Math.floor(hash2(k, seed) * (w - 2)), z = z0 + 1 + Math.floor(hash2(seed, k) * (d - 2));
    const b = new THREE.Mesh(V.geo.cube, V.mat.leaf); b.scale.set(0.6, 0.5, 0.6); b.position.set(x + 0.3, topY + 0.25, z + 0.3); b.userData.deco = true; parent.add(b);
  }
}
function buildGround() {
  const T = V.tex;
  const grassBig = T.grassTop.clone(); grassBig.needsUpdate = true; grassBig.wrapS = grassBig.wrapT = THREE.RepeatWrapping; grassBig.repeat.set(90, 90);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(360, 360), new THREE.MeshLambertMaterial({ map: grassBig })); ground.rotation.x = -Math.PI / 2; ground.position.y = -16; V.scene.add(ground);
  // voxel cliffs and trees around the edge, like a blocky valley
  const cliffs = [], trunks = [], leaves = [];
  for (let k = 0; k < 70; k++) {
    const a = k / 70 * Math.PI * 2 + hash2(k, 3) * 0.08, r = 62 + hash2(k, 4) * 26;
    const x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r), h = 3 + Math.floor(hash2(k, 5) * 9);
    for (let y = 0; y < h; y++) for (let dx = 0; dx < 3; dx++) cliffs.push([x + dx * 2, -15 + y * 2, z]);
    if (k % 3 === 0) { trunks.push([x + 2, -15 + h * 2 + 1, z]); for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) leaves.push([x + 2 + dx * 1.2, -15 + h * 2 + 3, z + dz * 1.2]); leaves.push([x + 2, -15 + h * 2 + 4.2, z]); }
  }
  for (let k = 0; k < 40; k++) { const x = (hash2(k, 11) - 0.5) * 120, z = (hash2(k, 12) - 0.5) * 120; if (Math.hypot(x, z) < 26) continue; trunks.push([x, -14, z]); trunks.push([x, -13, z]); for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) leaves.push([x + dx, -11.5, z + dz]); leaves.push([x, -10.5, z]); }
  const inst = (arr, mat, s) => { const m = new THREE.InstancedMesh(V.geo.cube, mat, arr.length); const o = new THREE.Object3D(); arr.forEach((p, k) => { o.position.set(p[0], p[1], p[2]); o.scale.setScalar(s); o.updateMatrix(); m.setMatrixAt(k, o.matrix); }); V.scene.add(m); };
  inst(cliffs, V.mat.grass, 2); inst(trunks, V.mat.trunk, 1); inst(leaves, V.mat.leaf, 1.3);
  // small decorative floating islands
  for (let k = 0; k < 5; k++) { const g = new THREE.Group(); const a = k / 5 * Math.PI * 2 + 0.5; g.position.set(Math.cos(a) * 44, 6 + hash2(k, 21) * 10, Math.sin(a) * 44); buildIsland(g, -2, 2, -2, 2, 0, 40 + k); V.scene.add(g); V.decoIslands = (V.decoIslands || []).concat(g); }
}
function buildRainbow(cx, cy, cz, R, rotY, scale) {
  const cols = ['#ff3b3b', '#ff9a2e', '#ffe23d', '#4fd14f', '#3d8bff', '#5b4bff', '#b04bff'];
  const g = new THREE.Group(); g.position.set(cx, cy, cz); g.rotation.y = rotY; g.scale.setScalar(scale);
  cols.forEach((c, k) => {
    const r = R - k, n = Math.round(Math.PI * r / 0.9), pts = [];
    for (let i = 0; i <= n; i++) { const a = i / n * Math.PI; pts.push([Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r)]); }
    const uniq = [...new Set(pts.map(p => p.join(',')))].map(s => s.split(',').map(Number));
    const m = new THREE.InstancedMesh(V.geo.cube, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.82, fog: false }), uniq.length);
    const o = new THREE.Object3D(); uniq.forEach((p, i) => { o.position.set(p[0], p[1], 0); o.updateMatrix(); m.setMatrixAt(i, o.matrix); }); g.add(m);
  });
  V.scene.add(g);
}
// ---- sparkles: little pixel stars for broadcasts, block insertions and arrivals
function sparkle(pos, color, count = 24, speed = 4, life = 0.9) {
  for (let i = 0; i < count; i++) {
    const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 - 0.2, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8));
    V.stars.push({ p: pos.clone(), v: dir, t: 0, life: life * (0.6 + Math.random() * 0.6), c: new THREE.Color(Math.random() < 0.35 ? '#ffffff' : color) });
  }
}
function updateStars(dt) {
  V.stars = V.stars.filter(s => (s.t += dt) < s.life);
  for (const s of V.stars) { s.p.addScaledVector(s.v, dt); s.v.multiplyScalar(0.94); s.v.y -= dt * 1.5; }
  const n = V.stars.length, pos = new Float32Array(Math.max(1, n) * 3), col = new Float32Array(Math.max(1, n) * 3);
  V.stars.forEach((s, i) => { pos.set([s.p.x, s.p.y, s.p.z], i * 3); const k = 1 - s.t / s.life; col.set([s.c.r * k + 0.1, s.c.g * k + 0.1, s.c.b * k + 0.1], i * 3); });
  if (!n) pos.set([0, -999, 0]);
  const geo = V.starPts.geometry; geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setDrawRange(0, Math.max(1, n));
}
function initStars() {
  const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(6, 0, 4, 16); g.fillRect(0, 6, 16, 4); g.fillRect(4, 4, 8, 8); // a pixel star
  const tex = new THREE.CanvasTexture(c); tex.magFilter = THREE.NearestFilter;
  V.stars = []; V.starPts = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 0.55, map: tex, vertexColors: true, transparent: true, depthWrite: false, alphaTest: 0.3 }));
  V.scene.add(V.starPts);
}
// coins are coloured by who owns them: a wallet's coins match its owner's hoodie; real-world addresses are muted by type; coinbase is gold
const REAL_COL = { p2wpkh: '#9db3d6', p2tr: '#b9a8dc', p2pkh: '#cbb999', p2sh: '#c8c08f', p2wsh: '#9fcfae', other: '#b8bcc8' };
const ownerMats = {};
function coinMatFor(c) {
  const w = c.cb ? null : WALLET_BY_SPK.get(c.spk);
  const k = c.cb ? 'cb' : w ? 'w' + WALLETS.indexOf(w) : 'r' + (c.type || 'other');
  if (!ownerMats[k]) { const col = c.cb ? '#ffcf3a' : w ? HOODIES[WALLETS.indexOf(w) % 12] : REAL_COL[c.type] || REAL_COL.other; ownerMats[k] = new THREE.MeshLambertMaterial({ color: col, emissive: new THREE.Color(col).multiplyScalar(w || c.cb ? 0.3 : 0.08) }); }
  return ownerMats[k];
}
