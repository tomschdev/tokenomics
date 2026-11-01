// ============================================================ environment styling: floating islands, ground, rainbows, sparkles
// Islands, valley and trees come from the SkyStyle module (pixel-art sky look).
// x0..x1 / z0..z1 are inclusive 1-unit cells in the parent's space; the grass surface sits at topY.
// spots (parent coords) place trees and grass; without them the island gets the default pair of trees.
// Background scenery lives on its own layer and is drawn as pixel art (pixel size 4); the nodes, wallet platform and board stay sharp.
const BG_LAYER = 2;
function toBg(o) { o.traverse(c => c.layers.set(BG_LAYER)); return o; }
function buildIsland(parent, x0, x1, z0, z1, topY, seed, spots) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const isl = SkyStyle.makeIsland(seed, { w: x1 - x0 + 1, d: z1 - z0 + 1, spots: spots ? spots.map(p => Object.assign({}, p, { x: p.x - cx, z: p.z - cz })) : null });
  isl.position.set(cx, topY - isl.userData.top, cz); parent.add(isl); return isl;
}
function buildGround() {
  const P = SkyStyle.PAL;
  const grassBig = pixTex(16, (g, s) => noiseFill(g, s, [P.grass, P.grass, P.grass, '#66ae4b', '#66ae4b', '#74bb53'], 2));
  grassBig.wrapS = grassBig.wrapT = THREE.RepeatWrapping; grassBig.repeat.set(24, 24);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(360, 360), new THREE.MeshStandardMaterial({ map: grassBig, roughness: 1, metalness: 0 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -16; ground.receiveShadow = true; V.scene.add(toBg(ground));
  // a handful of tree shapes, reused around the valley
  const kinds = [0, 1, 2, 3, 4, 5].map(k => SkyStyle.makeTree(500 + k, { height: 1.1 + (k % 3) * 0.15 }));
  const tree = (k, x, y, z, s) => { const t = kinds[k % kinds.length].clone(); t.position.set(x, y, z); t.scale.setScalar(s); t.rotation.y = hash2(k, 31) * 6.28; V.scene.add(toBg(t)); };
  // earth cliffs with a grass cap around the edge, like a valley wall
  const parts = [], dl = new THREE.Color(P.dirtLight), dd = new THREE.Color(P.dirtDeep), gm = new THREE.Color(P.grass), gd = new THREE.Color(P.grassDark);
  for (let k = 0; k < 70; k++) {
    const a = k / 70 * Math.PI * 2 + hash2(k, 3) * 0.08, r = 62 + hash2(k, 4) * 26;
    const x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r), h = 3 + Math.floor(hash2(k, 5) * 9), H = h * 2, top = -16 + H;
    const rock = SkyStyle.roundedBox(6, H, 2, 0.25, 1); rock.translate(x + 2, -16 + H / 2, z);
    const tint = 0.92 + hash2(k, 6) * 0.14;
    SkyStyle.paint(rock, (c, px, py) => c.copy(dd).lerp(dl, Math.max(0, Math.min(1, (py + 16) / 18))).multiplyScalar(tint));
    const cap = SkyStyle.roundedBox(6.4, 0.7, 2.4, 0.2, 1); cap.translate(x + 2, top + 0.1, z);
    SkyStyle.paint(cap, (c, px, py, pz, nx, ny) => c.copy(ny > 0.5 ? gm : gd));
    parts.push(rock, cap);
    if (k % 3 === 0) tree(k, x + 2, top + 0.45, z, 1.7);
  }
  V.scene.add(toBg(SkyStyle.mesh(SkyStyle.merge(parts))));
  for (let k = 0; k < 40; k++) { const x = (hash2(k, 11) - 0.5) * 120, z = (hash2(k, 12) - 0.5) * 120; if (Math.hypot(x, z) < 26) continue; tree(k + 3, x, -16, z, 1.9 + hash2(k, 13) * 0.5); }
  // small decorative floating islands, each with its own trees
  for (let k = 0; k < 5; k++) { const g = new THREE.Group(); const a = k / 5 * Math.PI * 2 + 0.5; g.position.set(Math.cos(a) * 44, 6 + hash2(k, 21) * 10, Math.sin(a) * 44); g.rotation.y = -a; buildIsland(g, -2, 2, -2, 2, 0, 40 + k); V.scene.add(toBg(g)); V.decoIslands = (V.decoIslands || []).concat(g); }
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
  V.scene.add(toBg(g));
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
// coins are coloured by who owns them: a wallet's coins match the colour its owner wears; real-world addresses are muted by type; coinbase is gold
const REAL_COL = { p2wpkh: '#9db3d6', p2tr: '#b9a8dc', p2pkh: '#cbb999', p2sh: '#c8c08f', p2wsh: '#9fcfae', other: '#b8bcc8' };
const ownerMats = {};
function coinMatFor(c) {
  const w = c.cb ? null : WALLET_BY_SPK.get(c.spk);
  const k = c.cb ? 'cb' : w ? 'w' + WALLETS.indexOf(w) : 'r' + (c.type || 'other');
  if (!ownerMats[k]) { const col = c.cb ? '#ffcf3a' : w ? HOODIES[WALLETS.indexOf(w) % 12] : REAL_COL[c.type] || REAL_COL.other; ownerMats[k] = new THREE.MeshLambertMaterial({ color: col, emissive: new THREE.Color(col).multiplyScalar(w || c.cb ? 0.3 : 0.08) }); }
  return ownerMats[k];
}
