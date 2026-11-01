// ============================================================ 3D world (Three.js r128)
const V = {}; // view state
const RING = 15, TOWER_N = 8, SLOT_H = 1.5;
function pixTex(size, draw) { const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); draw(g, size); const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; return t; }
function noiseFill(g, size, cols, seed = 1) { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { g.fillStyle = cols[Math.floor(hash2(x + seed * 31, y + seed * 17) * cols.length)]; g.fillRect(x, y, 1, 1); } }
function hash2(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
// Draw text inside a box maxW wide: wrap at spaces onto up to `lines` lines, shrink the font only if it still
// does not fit. Never clips or drops text. y is the first line (or the block's centre when mid). Returns the height used.
function fitText(g, text, x, y, maxW, font, { lines = 2, lh = 1.2, mid = false } = {}) {
  const f = font.match(/^(.*?)(\d+(?:\.\d+)?)px (.*)$/); let size = +f[2], out;
  for (;;) {
    g.font = `${f[1]}${size}px ${f[3]}`; out = []; let cur = '';
    for (const w of String(text).split(' ')) { const t = cur ? cur + ' ' + w : w; if (cur && g.measureText(t).width > maxW) { out.push(cur); cur = w; } else cur = t; }
    out.push(cur);
    if ((out.length <= lines && out.every(l => g.measureText(l).width <= maxW)) || size <= 8) break;
    size--;
  }
  const step = size * lh, y0 = mid ? y - (out.length - 1) * step / 2 : y;
  out.forEach((l, i) => g.fillText(l, x, y0 + i * step));
  return out.length * step;
}
const FEE_COLS = [['#a9c8e8', 0], ['#7be06a', 1], ['#ffd23d', 2], ['#ff7a3d', 5]];
const feeBucket = r => r >= 5 ? 3 : r >= 2 ? 2 : r >= 1 ? 1 : 0;
function feeColor(r) { return FEE_COLS[feeBucket(r)][0]; }

function initScene() {
  const wrap = $('stage3d');
  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); // full resolution for the sharp text pass; the scene itself goes through the pixel pipeline
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const pipe = SkyStyle.makePixelPipeline(renderer, { overlayLayer: 1, bgLayer: BG_LAYER }); pipe.setPixel(1, 2, 2); pipe.setBgPixel(4); pipe.setBands(16); // sharp foreground, pixel-art background
  wrap.prepend(renderer.domElement); renderer.domElement.id = 'cv3';
  const scene = new THREE.Scene();
  SkyStyle.makeSky(scene); // the sky gradient is painted by the pixel pipeline behind the scene
  scene.fog = new THREE.Fog(SkyStyle.PAL.haze, 80, 200);
  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 400);
  camera.position.set(0, 40, 58);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 7, 0); controls.enableDamping = true; controls.dampingFactor = 0.08; controls.maxPolarAngle = Math.PI * 0.49; controls.minDistance = 8; controls.maxDistance = 80;
  controls.autoRotate = !reduceMotion; controls.autoRotateSpeed = 0.35;
  // a drag or zoom takes the camera back; while following, only a real drag (see pointermove) or the wheel ends it, so a click can still pick a node
  controls.addEventListener('start', () => { if (FOLLOW.on) FOLLOW.grab = true; else V.camGoal = null; });
  controls.addEventListener('end', () => { FOLLOW.grab = false; });
  renderer.domElement.addEventListener('wheel', () => { if (FOLLOW.on) stopFollow(); }, { passive: true });
  const rig = SkyStyle.makeLights(scene), sh = rig.sun.shadow;
  sh.mapSize.set(2048, 2048); Object.assign(sh.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 160 }); sh.camera.updateProjectionMatrix();
  sh.bias = -0.0008; sh.normalBias = 0.06;
  rig.aim(140, 52, new THREE.Vector3(0, 0, 0), 75); rig.shadowDepth(0.55);
  Object.assign(V, { renderer, pipe, rig, scene, camera, controls, wrap, t: 0, anims: [], nodes: {}, flyers: new Map(), splashes: [] });
  // shared textures & materials
  const T = V.tex = {
    grassTop: pixTex(16, (g, s) => noiseFill(g, s, ['#52b043', '#4aa63c', '#5cbf4b', '#3e9a35'], 2)),
    grassSide: pixTex(16, (g, s) => { noiseFill(g, s, ['#8a5a32', '#7a4e2b', '#6b4426', '#946339'], 3); for (let x = 0; x < s; x++) { const d = 3 + (hash2(x, 9) > 0.5 ? 1 : 0); g.fillStyle = '#52b043'; g.fillRect(x, 0, 1, d); } }),
    dirt: pixTex(16, (g, s) => noiseFill(g, s, ['#8a5a32', '#7a4e2b', '#6b4426', '#946339', '#8e8e98'], 4)),
    stone: pixTex(16, (g, s) => noiseFill(g, s, ['#8e8e98', '#7d7d87', '#9a9aa4', '#6f6f78'], 5)),
    water: pixTex(32, (g, s) => { noiseFill(g, s, ['#3d8bff', '#3480f0', '#4a96ff', '#2f74e0'], 6); g.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 18; i++) g.fillRect(Math.floor(hash2(i, 1) * s), Math.floor(hash2(i, 2) * s), 3, 1); }),
    metal: pixTex(16, (g, s) => noiseFill(g, s, ['#2a3142', '#262c3b', '#313a4e', '#20262f'], 7)),
  };
  T.water.wrapS = T.water.wrapT = THREE.RepeatWrapping; T.water.repeat.set(2, 2);
  const L = (m) => new THREE.MeshLambertMaterial(m);
  V.mat = {
    grass: [L({ map: T.grassSide }), L({ map: T.grassSide }), L({ map: T.grassTop }), L({ map: T.dirt }), L({ map: T.grassSide }), L({ map: T.grassSide })],
    dirt: L({ map: T.dirt }), stone: L({ map: T.stone }), metal: L({ map: T.metal }),
    water: new THREE.MeshLambertMaterial({ map: T.water, transparent: true, opacity: 0.78 }),
    fee: FEE_COLS.map(([c]) => L({ color: c, emissive: new THREE.Color(c).multiplyScalar(0.15) })),
    feeHot: FEE_COLS.map(([c]) => L({ color: c, emissive: new THREE.Color(c).multiplyScalar(0.6) })),
    ok: L({ color: '#5fe07c', emissive: '#2a8a40' }), bad: L({ color: '#ff5468', emissive: '#a3243a' }),
    gold: L({ color: '#ffcf3a', emissive: '#8a6a10' }),
    leaf: L({ map: pixTex(16, (g, s) => noiseFill(g, s, ['#2f8a2a', '#3e9a35', '#4aa63c', '#287a24'], 9)) }), trunk: L({ map: pixTex(16, (g, s) => noiseFill(g, s, ['#6b4426', '#7a4e2b', '#5a3a1a'], 10)) }),
    dsA: L({ color: '#ff2e63', emissive: '#801030' }), dsB: L({ color: '#c84dff', emissive: '#5a1a80' }),
    threadOk: new THREE.MeshBasicMaterial({ color: '#4dff7a' }),
    threadPend: new THREE.LineDashedMaterial({ color: 0xdfe8f5, dashSize: 0.1, gapSize: 0.12, transparent: true, opacity: 0.55 }),
    threadChecked: new THREE.MeshBasicMaterial({ color: 0x5fe07c, transparent: true, opacity: 0.92, depthWrite: false }),
    threadOld: new THREE.LineBasicMaterial({ color: 0xcfe0ff, transparent: true, opacity: 0.22, depthWrite: false }),
    threadNew: new THREE.LineBasicMaterial({ color: 0xffe9a6, transparent: true, opacity: 0.7, depthWrite: false }),
    link: new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.5, gapSize: 0.45, transparent: true, opacity: 0.75 }),
  };
  V.geo = { cube: new THREE.BoxGeometry(1, 1, 1), tx: new THREE.BoxGeometry(0.34, 0.34, 0.34), blk: new THREE.BoxGeometry(1.3, 1.3, 1.3), bead: new THREE.BoxGeometry(0.13, 0.13, 0.13) };
  buildClouds(); buildGround(); initStars();
  buildRainbow(34, -16, -78, 34, -0.35, 1); buildRainbow(-58, -16, -40, 22, 0.9, 1);
  NODES.forEach((n, i) => buildNode(n, i));
  buildLinks(); buildStepsBoard(); buildUserPlatform();
  // input
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(); if (ray.layers) ray.layers.enableAll(); // labels live on layer 1
  let downAt = null;
  // notes: each clickable part is tagged with userData.part on itself or an ancestor; hidden sprites/meshes still raycast, so skip them
  const shown = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
  const partOf = o => { for (; o; o = o.parent) if (o.userData.part) return o.userData.part; return null; };
  // which part the note is about: skip see-through pixels of text sprites, and prefer solid meshes over lines (lines pick within 1 unit)
  const px = document.createElement('canvas').getContext('2d', { willReadFrequently: true }); px.canvas.width = px.canvas.height = 1;
  const opaque = h => { const c = h.object.isSprite && h.uv && h.object.userData.canvas; if (!c) return true; px.clearRect(0, 0, 1, 1); px.drawImage(c, Math.min(c.width - 1, Math.floor(h.uv.x * c.width)), Math.min(c.height - 1, Math.floor((1 - h.uv.y) * c.height)), 1, 1, 0, 0, 1, 1); return px.getImageData(0, 0, 1, 1).data[3] > 8; };
  const noteHit = hits => { const ok = hits.filter(h => shown(h.object) && opaque(h)); return ok.find(h => !h.object.isLine && !h.object.isPoints) || ok[0]; };
  renderer.domElement.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect(); mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    if (ray.intersectObject(V.board.s).length) { showNote('board'); return; } // the board is drawn over everything, so it wins the click
    // while following, a click picks the featured node (or flashes a wallet) without opening notes over the board
    const ph = ray.intersectObjects(V.people.map(p => p.root), true);
    if (ph.length) { let o = ph[0].object; while (o && o.userData.personIdx === undefined) o = o.parent; if (o) { flashWallet(o.userData.personIdx); if (!FOLLOW.on) showNote('wallets'); return; } }
    const hits = ray.intersectObjects(NODES.map(n => V.nodes[n.id].group), true);
    if (hits.length) { let o = hits[0].object; while (o && !o.userData.nodeId) o = o.parent; if (o) openNode(o.userData.nodeId); if (FOLLOW.on) return; const nh = noteHit(hits); showNote(nh && partOf(nh.object)); return; }
    showNote(!FOLLOW.on && noteHit(ray.intersectObject(V.plat, true)) ? 'wallets' : null); // empty sky (or scenery) closes the note
  });
  renderer.domElement.addEventListener('pointermove', e => {
    if (FOLLOW.grab && downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) stopFollow(); // dragging ends follow-along
    const r = renderer.domElement.getBoundingClientRect(); mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const onBoard = ray.intersectObject(V.board.s).length > 0;
    const hits = onBoard ? [] : ray.intersectObjects(NODES.map(n => V.nodes[n.id].group), true); let o = hits.length ? hits[0].object : null; while (o && !o.userData.nodeId) o = o.parent;
    V.hover = o ? o.userData.nodeId : null; // the hovered node shows its full label card
    renderer.domElement.style.cursor = onBoard || V.hover || (V.plat && ray.intersectObject(V.plat, true).length) ? 'pointer' : 'grab';
  });
  renderer.domElement.addEventListener('pointerleave', () => { V.hover = null; });
  let rq = 0; new ResizeObserver(() => { cancelAnimationFrame(rq); rq = requestAnimationFrame(resize3); }).observe(wrap); resize3();
  const ov = overviewView(); camera.position.copy(ov.pos); controls.target.copy(ov.target);
}
function resize3() { if (V.wrap.clientWidth === V.lastW) return; V.lastW = V.wrap.clientWidth; const w = V.wrap.clientWidth, h = Math.round(w * (w < 700 ? 0.9 : 9 / 16)); V.pipe.setSize(w, h); V.renderer.domElement.style.width = w + 'px'; V.renderer.domElement.style.height = h + 'px'; V.camera.aspect = w / h; V.camera.updateProjectionMatrix(); }

function buildClouds() {
  V.clouds = [];
  for (let i = 0; i < 9; i++) {
    const g = SkyStyle.makeCloud(100 + i, { width: 9 + hash2(i, 3) * 7 }); g.scale.setScalar(i % 2 ? 1.1 : 1.8);
    // half drift high and far off on the horizon, half drift low beneath the floating islands, so none crosses the camera
    const low = i % 2 === 1, a = i / 9 * Math.PI * 2, r = low ? 34 + hash2(i, 77) * 24 : 82 + hash2(i, 77) * 30;
    g.position.set(Math.cos(a) * r, low ? -7 + hash2(i, 9) * 3 : 46 + hash2(i, 9) * 14, Math.sin(a) * r); g.userData = { a, r, sp: 0.01 + hash2(i, 5) * 0.015 };
    V.scene.add(toBg(g)); V.clouds.push(g);
  }
}
function makeLabelSprite() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160;
  const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.scale.set(6.4, 2, 1); s.renderOrder = 10; s.layers.set(1);
  s.userData.canvas = c; s.userData.key = ''; return s;
}
// Node card: a compact pill (pool name + hashrate share) by default; the full card for the hovered or selected node (pill again while its details panel is open)
function drawLabel(n) {
  const v = V.nodes[n.id], s = v.label, c = s.userData.canvas, g = c.getContext('2d');
  const tip = BLOCKS.get(n.tip); const onBest = ancestors(bestTip()).includes(n.tip);
  const stage = n.hand ? 'HAND' : { template: 'BUILDING BLOCK', verify: 'VERIFYING TXS', merkle: 'MERKLE ROOT', hash: 'HASHING', won: 'BLOCK FOUND!', validate: 'CHECKING PEER BLOCK' }[n.stage] || '';
  const sel = S.selected === n.id, full = D.open !== n.id && (sel || V.hover === n.id); // the details panel already shows the open node in full
  const key = [n.name, n.share, n.mempool.size, tip.height, onBest, stage, n.won, sel, full].join('|'); if (key === s.userData.key) return; s.userData.key = key;
  g.clearRect(0, 0, 512, 160); g.textBaseline = 'top';
  const name = n.name.toUpperCase(), share = (n.share * 100).toFixed(1) + '%';
  g.font = '34px VT323, monospace'; const sw = g.measureText(share).width;
  if (!full) {
    g.font = 'bold 30px "Pixelify Sans", sans-serif'; const nw = Math.min(g.measureText(name).width, 496 - 48 - sw);
    g.fillStyle = 'rgba(14,23,38,.86)'; g.fillRect(8, 8, 20 + nw + 14 + sw + 14, 52); g.fillStyle = n.color; g.fillRect(8, 8, 8, 52);
    g.fillStyle = '#fff'; fitText(g, name, 28, 20, nw, 'bold 30px "Pixelify Sans", sans-serif', { lines: 1 });
    g.font = '34px VT323, monospace'; g.fillStyle = '#9fe7b0'; g.fillText(share, 28 + nw + 14, 17);
  } else {
    g.fillStyle = 'rgba(14,23,38,.86)'; g.fillRect(8, 8, 496, 144); g.fillStyle = sel ? '#ffcf3a' : n.color; g.fillRect(8, 8, 496, 8);
    g.font = '34px VT323, monospace'; g.fillStyle = '#9fe7b0'; g.textAlign = 'right'; g.fillText(share, 490, 26); g.textAlign = 'left';
    g.fillStyle = '#fff'; fitText(g, name, 22, 26, 490 - sw - 16 - 22, 'bold 36px "Pixelify Sans", sans-serif', { lines: 1 });
    g.fillStyle = '#cfe0ff'; fitText(g, `mempool ${n.mempool.size} · tip #${fmt(tip.height)}`, 22, 74, 468, '31px VT323, monospace', { lines: 1 });
    g.fillStyle = stage === 'BLOCK FOUND!' ? '#ffcf3a' : onBest ? '#6bff9c' : '#ff8a96'; fitText(g, onBest ? stage : 'ON A FORK · ' + stage, 22, 112, 468, '26px "Pixelify Sans", sans-serif', { lines: 1 });
  }
  s.material.map.needsUpdate = true;
}
function rigScreen(n) {
  const v = V.nodes[n.id], c = v.screenCanvas, g = c.getContext('2d');
  g.fillStyle = '#07150f'; g.fillRect(0, 0, 128, 96);
  g.fillStyle = '#6bff9c'; g.font = '12px "Pixelify Sans", sans-serif'; g.textBaseline = 'top';
  const lbl = { template: 'COLLECT', verify: 'VERIFY', merkle: 'MERKLE', hash: 'HASHING', won: 'FOUND!', validate: 'NEW TIP' }[n.stage] || '';
  g.fillText(lbl, 6, 6);
  if (n.stage === 'hash' && n.last) { g.font = '14px VT323, monospace'; g.fillText((n.last.nonce >>> 0).toString(16).padStart(8, '0'), 6, 28); g.fillStyle = '#2f8a50'; g.fillText(n.last.hex.slice(0, 14), 6, 46);
    const bz = Math.max(0, n.best.z); for (let b = 0; b < S.demoBits; b++) { g.fillStyle = b < bz ? '#6bff9c' : '#14301f'; g.fillRect(6 + b * 7, 70, 5, 10); } }
  v.screenTex.needsUpdate = true;
}
function buildNode(n, i) {
  const g = new THREE.Group(); g.userData.nodeId = n.id;
  const a = -Math.PI * 3 / 4 + i * Math.PI / 2; g.position.set(Math.cos(a) * RING, 0, Math.sin(a) * RING); g.lookAt(0, 0, 0);
  V.scene.add(g);
  const v = V.nodes[n.id] = { group: g, txMeshes: new Map(), tower: new Map(), spawnFrom: new Map(), bob: Math.random() * 6 };
  // the node itself: a blueprint cube holding this node's view of the UTXO set (coins = small cubes, coin history = thin threads)
  const st = new THREE.Group(); st.position.set(0, 3.6, -1); st.userData.part = 'state'; g.add(st); v.state = st;
  buildStateCube(n, st);
  const mint = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), V.mat.gold); mint.position.set(0, 2.55, 0); st.add(mint); v.mint = mint;
  v.coins = new Map(); v.stateKey = ''; v.threadsOld = null; v.threadsNew = null; v.pulses = [];
  // the mempool: a shallow pool in front of the cube
  const tray = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.35, 4.6), V.mat.stone); tray.position.set(0, -0.1, 5); tray.userData.part = 'mempool'; g.add(tray);
  for (const [w, d, x, z] of [[4.6, 0.3, 0, 2.85], [4.6, 0.3, 0, 7.15], [0.3, 4.6, -2.15, 5], [0.3, 4.6, 2.15, 5]]) { const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, d), V.mat.stone); wall.position.set(x, 0.25, z); wall.userData.part = 'mempool'; g.add(wall); }
  const water = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), V.mat.water); water.rotation.x = -Math.PI / 2; water.position.set(0, 0.2, 5); water.userData.part = 'mempool'; g.add(water);
  v.poolCenter = new THREE.Vector3(0, 0.3, 5);
  // the node's chain grows as a tower out of the top of the cube
  v.towerBase = new THREE.Vector3(0, 7.5, -1);
  v.label = makeLabelSprite(); v.label.position.set(4.2, 1.6, 5.2); g.add(v.label);
  buildWorkshop(n, v, g);
  buildIsland(g, -10, 6, -5, 8, -0.3, i * 13 + 3, [{ x: -8.6, z: -3.9, kind: 'tree', h: 1.3, s: 1.6 }, { x: -7.1, z: -4.4, kind: 'tree', h: 1.05, s: 1.35 }, { x: 4.9, z: -4.0, kind: 'tuft', s: 1.4 }, { x: 4.7, z: 7.3, kind: 'tree', h: 1.0, s: 1.3 }, { x: -9.2, z: 0.8, kind: 'tuft', s: 1.2 }]);
}
// ---- state cube look: a blueprint hologram. Grid faces and white glowing edges are shared by all four cubes;
// the corner brackets and the label's strip carry the pool's colour, so the cubes still tell the pools apart.
function buildStateCube(n, st) {
  const H = 3;
  if (!V.bp) {
    const size = 256, c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
    g.fillStyle = 'rgba(10,46,122,.55)'; g.fillRect(0, 0, size, size);
    for (let i = 0; i <= 16; i++) { // 16 cells per face, a brighter major line every 4
      const major = i % 4 === 0, w = major ? 3 : 1, p = Math.min(size - w, Math.max(0, i * 16 - (w >> 1)));
      g.fillStyle = major ? 'rgba(220,240,255,.85)' : 'rgba(150,200,255,.35)'; g.fillRect(p, 0, w, size); g.fillRect(0, p, size, w);
    }
    const tex = new THREE.CanvasTexture(c); tex.anisotropy = V.renderer.capabilities.getMaxAnisotropy();
    const bar = (a, b, r) => { const d = b.clone().sub(a), geo = new THREE.CylinderGeometry(r, r, d.length(), 6, 1); return geo.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), new THREE.Vector3(1, 1, 1))); };
    const edges = []; // the 12 edges as [start, end]
    for (let ax = 0; ax < 3; ax++) for (const s1 of [-H, H]) for (const s2 of [-H, H]) { const a = new THREE.Vector3(); a.setComponent((ax + 1) % 3, s1); a.setComponent((ax + 2) % 3, s2); const b = a.clone(); a.setComponent(ax, -H - 0.04); b.setComponent(ax, H + 0.04); edges.push([a, b]); }
    const marks = [];
    for (const [a, b] of edges) { const d = b.clone().sub(a).normalize().multiplyScalar(1.3); marks.push(bar(a, a.clone().add(d), 0.11), bar(b.clone().sub(d), b, 0.11)); }
    for (const x of [-H, H]) for (const y of [-H, H]) for (const z of [-H, H]) marks.push(new THREE.BoxGeometry(0.36, 0.36, 0.36).translate(x, y, z));
    V.bp = {
      box: new THREE.BoxGeometry(2 * H, 2 * H, 2 * H),
      back: new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.BackSide, depthWrite: false }),
      front: new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.45, depthWrite: false }),
      edge: SkyStyle.merge(edges.map(([a, b]) => bar(a, b, 0.04))), edgeMat: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
      glow: SkyStyle.merge(edges.map(([a, b]) => bar(a, b, 0.14))), glowMat: new THREE.MeshBasicMaterial({ color: '#8fc8ff', transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending }),
      marks: SkyStyle.merge(marks), label: new THREE.PlaneGeometry(3.2, 0.8),
    };
  }
  const B = V.bp;
  // faces: inner walls first, then the coins and threads, then the outer walls over them (renderOrder), so nothing vanishes
  const back = new THREE.Mesh(B.box, B.back), front = new THREE.Mesh(B.box, B.front); front.renderOrder = 1;
  const glow = new THREE.Mesh(B.glow, B.glowMat); glow.renderOrder = 1;
  st.add(back, front, new THREE.Mesh(B.edge, B.edgeMat), glow, new THREE.Mesh(B.marks, new THREE.MeshBasicMaterial({ color: n.color })));
  // title block on each side: "UTXO STATE" in white, with the pool's colour as a strip
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = 'rgba(6,24,62,.92)'; g.fillRect(0, 0, 512, 128); g.fillStyle = n.color; g.fillRect(0, 0, 44, 128);
  g.strokeStyle = '#ffffff'; g.lineWidth = 6; g.strokeRect(3, 3, 506, 122);
  g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle'; fitText(g, 'UTXO STATE', 280, 68, 436, 'bold 66px "Pixelify Sans", sans-serif', { lines: 1, mid: true });
  const lt = new THREE.CanvasTexture(c); lt.anisotropy = V.renderer.capabilities.getMaxAnisotropy();
  const lm = new THREE.MeshBasicMaterial({ map: lt, transparent: true, depthWrite: false });
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, p = new THREE.Mesh(B.label, lm); p.position.set(Math.sin(a) * (H + 0.03), -H + 0.62, Math.cos(a) * (H + 0.03)); p.rotation.y = a; p.renderOrder = 2; st.add(p); }
}
// coins keep their owner colour (coinMatFor) and gain a thin white outline, drawn into the texture
const outlinedMats = new Map();
function coinMatOutlined(c) {
  const base = coinMatFor(c); let m = outlinedMats.get(base); if (m) return m;
  const cv = document.createElement('canvas'); cv.width = cv.height = 32; const g = cv.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#' + base.color.getHexString(); g.fillRect(3, 3, 26, 26);
  const t = new THREE.CanvasTexture(cv); t.magFilter = THREE.NearestFilter;
  const glow = Math.max(base.emissive.r, base.emissive.g, base.emissive.b) / Math.max(1e-3, base.color.r, base.color.g, base.color.b); // same self-light as the plain coin
  m = new THREE.MeshLambertMaterial({ map: t, emissive: new THREE.Color(glow, glow, glow), emissiveMap: t });
  outlinedMats.set(base, m); return m;
}
// ---- state cube: coins placed by address (one cluster per locking script), sized by value
function strHash(str, salt) { let h = 2166136261 ^ salt; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); return ((h ^ (h >>> 15)) >>> 0) / 4294967295; }
const TYPE_COL = { p2wpkh: '#4fc3ff', p2tr: '#c084ff', p2pkh: '#ffae3b', p2sh: '#ffd23d', p2wsh: '#5fe07c', other: '#cfd7e6' };
const coinMats = {}; function coinMat(type, cb) { const k = cb ? 'cb' : type; return coinMats[k] || (coinMats[k] = new THREE.MeshLambertMaterial({ color: cb ? '#ffcf3a' : TYPE_COL[type] || TYPE_COL.other, emissive: new THREE.Color(cb ? '#ffcf3a' : TYPE_COL[type] || '#888').multiplyScalar(0.25) })); }
function coinPos(spkHex, op) {
  const c = new THREE.Vector3(strHash(spkHex, 1) - 0.5, strHash(spkHex, 2) - 0.5, strHash(spkHex, 3) - 0.5).multiplyScalar(4.4);
  return c.add(new THREE.Vector3(strHash(op, 4) - 0.5, strHash(op, 5) - 0.5, strHash(op, 6) - 0.5).multiplyScalar(0.7));
}
const coinSize = v => Math.min(0.55, Math.max(0.1, 0.065 * Math.log10(v + 1) - 0.05));
const COIN_CAP = 320;
function desiredState(n) {
  const st = stateOf(n.tip), coins = new Map();
  for (const [op, c] of BASE) if (!st.spent.has(op)) coins.set(op, { value: c.value, spk: hex(c.spk), type: c.type || scriptType(c.spk) });
  for (const [op, c] of st.created) if (!st.spent.has(op)) coins.set(op, { value: c.value, spk: hex(c.spk), type: c.type });
  const threads = [], blocks = ancestors(n.tip).map(h => BLOCKS.get(h)).filter(b => !b.real).reverse();
  for (const b of blocks) {
    // the coinbase mints new coins: a thread from the mint to the pool's payout
    const cbSpk = 'cb:' + b.pool, cbOp = b.cbTxid + ':0';
    coins.set(cbOp, { value: b.reward, spk: cbSpk, type: 'p2wpkh', cb: true });
    threads.push({ a: null, b: coinPos(cbSpk, cbOp), blk: b.hash, cb: true });
    for (const t of b.txs) t.vout.forEach((o, j) => { if (o.type === 'op_return') return; const to = coinPos(hex(o.spk), t.txid + ':' + j); t.vin.forEach(v => threads.push({ a: coinPos(hex(v.spk), v.txid + ':' + v.vout), b: to, blk: b.hash })); });
  }
  return { coins, threads, newest: blocks.length ? blocks[blocks.length - 1].hash : null };
}
function syncState(n) {
  const v = V.nodes[n.id]; const key = n.tip + ':' + BASE.size;
  if (key !== v.stateKey) {
    v.stateKey = key;
    const { coins, threads, newest } = desiredState(n);
    const keep = [...coins.keys()].slice(-COIN_CAP); const want = new Set(keep);
    for (const op of keep) if (!v.coins.has(op)) {
      const c = coins.get(op); const m = new THREE.Mesh(V.geo.cube, coinMatOutlined(c)); m.userData.nodeId = n.id; m.userData.spk = c.spk; m.userData.mat = m.material;
      m.position.copy(coinPos(c.spk, op)); m.userData.size = coinSize(c.value); m.scale.setScalar(0.001); m.userData.born = V.t; v.state.add(m); v.coins.set(op, m);
    }
    for (const [op, m] of v.coins) if (!want.has(op)) { v.coins.delete(op); V.anims.push({ t: 0, d: 0.8, step: k => m.scale.setScalar(m.userData.size * (1 - k)), done: () => v.state.remove(m) }); }
    // threads: faint history plus a brighter set for the newest block, all 1px lines
    const MINT = v.mint.position;
    const seg = arr => { const pts = []; for (const t of arr) pts.push((t.a || MINT).clone(), t.b.clone()); return new THREE.BufferGeometry().setFromPoints(pts); };
    if (v.threadsOld) v.state.remove(v.threadsOld); if (v.threadsNew) v.state.remove(v.threadsNew);
    const fresh = threads.filter(t => t.blk === newest), old = threads.filter(t => t.blk !== newest);
    v.threadsOld = new THREE.LineSegments(seg(old), V.mat.threadOld); v.threadsNew = new THREE.LineSegments(seg(fresh), V.mat.threadNew);
    v.state.add(v.threadsOld, v.threadsNew);
    if (newest && newest !== v.lastNewest) { v.lastNewest = newest; fresh.forEach((t, k) => v.pulses.push({ a: (t.a || MINT).clone(), b: t.b.clone(), t: -k * 0.04 })); }
    v.coinCount = coins.size; v.addrCount = new Set([...coins.values()].map(c => c.spk)).size; v.threadCount = threads.length;
  }
  for (const m of v.coins.values()) { const age = V.t - m.userData.born; if (age < 0.8) m.scale.setScalar(m.userData.size * Math.min(1, age / 0.6)); else if (m.scale.x !== m.userData.size) m.scale.setScalar(m.userData.size); }
  // pulses run along the newest threads: value moving from the spent coin to the new one
  if (!v.pulseMesh) { v.pulseMesh = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xffffff, size: 0.2, sizeAttenuation: true })); v.state.add(v.pulseMesh); }
  v.pulses = v.pulses.filter(p => (p.t += 1 / 60) < 1.4);
  const pts = v.pulses.filter(p => p.t >= 0).map(p => p.a.clone().lerp(p.b, Math.min(1, p.t / 1.2)));
  v.pulseMesh.geometry.setFromPoints(pts.length ? pts : [new THREE.Vector3(0, -99, 0)]);
}
function worldOf(n, local) { return V.nodes[n.id].group.localToWorld(local.clone()); }
function poolSlotLocal(i) { const c = i % 6, r = Math.floor(i / 6); return new THREE.Vector3(-1.65 + c * 0.66, 0.32, 3.35 + r * 0.66); }
function arcPoint(a, b, k, lift) { const m = a.clone().add(b).multiplyScalar(0.5); m.y += lift; const p = new THREE.Vector3(); const u = 1 - k; p.x = u * u * a.x + 2 * u * k * m.x + k * k * b.x; p.y = u * u * a.y + 2 * u * k * m.y + k * k * b.y; p.z = u * u * a.z + 2 * u * k * m.z + k * k * b.z; return p; }
function buildLinks() {
  for (const l of LINKS) {
    const a = worldOf(l.a, V.nodes[l.a.id].poolCenter), b = worldOf(l.b, V.nodes[l.b.id].poolCenter);
    const pts = []; for (let k = 0; k <= 40; k++) pts.push(arcPoint(a, b, k / 40, 5 + a.distanceTo(b) * 0.12));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), V.mat.link); line.computeLineDistances(); V.scene.add(line);
  }
}
function txMat(tx, hot) { return tx.ds ? (tx.ds === 'A' ? V.mat.dsA : V.mat.dsB) : (hot ? V.mat.feeHot : V.mat.fee)[feeBucket(tx.feerate)]; }
function splash(pos, color, big) { const r = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.18, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide })); r.rotation.x = -Math.PI / 2; r.position.copy(pos); V.scene.add(r); V.splashes.push({ m: r, t: 0, big }); }

// ---- hooks from the network core
window.onTxAccepted = (node, tx, from) => {
  const v = V.nodes[node.id]; if (!v || v.txMeshes.has(tx.txid)) return; node.lastTxAt = V.t;
  const m = new THREE.Mesh(V.geo.tx, txMat(tx)); m.userData.nodeId = node.id; m.userData.part = 'mempool';
  v.group.add(m); v.txMeshes.set(tx.txid, { m, born: V.t });
  const slot = node.slots.indexOf(tx.txid); const p = slot >= 0 ? poolSlotLocal(slot) : v.poolCenter.clone();
  m.position.copy(p).add(new THREE.Vector3(0, 0.6, 0)); m.visible = slot >= 0;
  if (slot >= 0 && from) { splash(worldOf(node, p), from.name === 'a wallet' ? 0xffffff : node.color, from.name === 'a wallet'); sparkle(worldOf(node, p), from.name === 'a wallet' ? '#ffffff' : node.color, 6, 2, 0.5); }
};
window.onTxRemoved = (node, txid) => {
  const v = V.nodes[node.id]; const e = v && v.txMeshes.get(txid); if (!e) return;
  v.txMeshes.delete(txid); V.anims.push({ t: 0, d: 0.6, step: k => { e.m.position.y -= 0.02; e.m.scale.setScalar(1 - k); }, done: () => v.group.remove(e.m) });
};
// the winner holds up its proven block, throws copies to the others, then slots it under its own tower
window.onBlockMined = (m, blk) => { const v = V.nodes[m.id]; sparkle(worldOf(m, v.fb.position), m.color, 50, 6, 1.2); v.spawnFrom.set(blk.hash, v.fb.position.clone()); v.held = { hash: blk.hash, until: S.simTime + 1.0, pos: v.fb.position.clone() }; flash(m, 0xffcf3a); };
// a receiving worker catches the block, checks it on the clipboard, then inserts it under its tower
window.onBlockAccepted = (node, blk) => { const v = V.nodes[node.id]; v.spawnFrom.set(blk.hash, HOLD_POS.clone()); v.held = { hash: blk.hash, until: S.simTime + 1.7, pos: HOLD_POS.clone() }; };
function flashAt(pos, color) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 })); s.position.copy(pos); V.scene.add(s); V.splashes.push({ m: s, t: 0, sphere: true }); }
function flash(n, color) { const v = V.nodes[n.id]; const s = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6 })); s.position.copy(worldOf(n, v.fb.position)); V.scene.add(s); V.splashes.push({ m: s, t: 0, sphere: true }); }
// template collection: a copy of each chosen tx is sucked up from the pool into the forming block
function launchCollect(m, i) {
  const v = V.nodes[m.id], tx = m.tpl.chosen[i].tx; const slot = m.slots.indexOf(tx.txid);
  const from = slot >= 0 ? poolSlotLocal(slot) : v.poolCenter.clone();
  const to = v.fb.position.clone().add(fbSlot(i));
  const c = new THREE.Mesh(V.geo.tx, txMat(tx, true)); c.scale.setScalar(0.8); v.group.add(c);
  V.anims.push({ t: 0, d: 0.75, step: k => { const sp = (1 - k) * 1.2; c.position.set(from.x + (to.x - from.x) * k + Math.cos(k * 9) * sp * 0.4, from.y + (to.y - from.y) * (k * k) + Math.sin(k * Math.PI) * 0.8, from.z + (to.z - from.z) * k + Math.sin(k * 9) * sp * 0.4); c.rotation.y += 0.3; },
    done: () => { v.group.remove(c); m.landed = Math.max(m.landed, i + 1); } });
}
function syncTower(n) {
  const v = V.nodes[n.id]; const all = ancestors(n.tip).slice(0, TOWER_N + 1);
  const held = v.held && S.simTime < v.held.until ? v.held : null;
  const want = all.filter(h => !held || h !== held.hash).slice(0, TOWER_N);
  const wantSet = new Set(held ? all : all.slice(0, TOWER_N));
  if (held && all.includes(held.hash)) { let e = v.tower.get(held.hash); if (!e) { const b = BLOCKS.get(held.hash); const m = blockMesh(b); m.userData.nodeId = n.id; m.userData.part = 'tower'; v.group.add(m); m.position.copy(held.pos); e = { m, b }; v.tower.set(held.hash, e); v.spawnFrom.delete(held.hash); } e.m.position.lerp(held.pos.clone().add(new THREE.Vector3(0, Math.sin(V.t * 6) * 0.05, 0)), 0.2); e.m.scale.setScalar(0.8); }
  want.forEach((h, idx) => {
    let e = v.tower.get(h);
    if (!e) {
      const b = BLOCKS.get(h); const m = blockMesh(b); m.userData.nodeId = n.id; m.userData.part = 'tower'; v.group.add(m);
      const from = v.spawnFrom.get(h) || v.towerBase.clone().add(new THREE.Vector3(2.5, 0, 0)); v.spawnFrom.delete(h);
      m.position.copy(from); e = { m, b }; v.tower.set(h, e);
      if (V.ready && !b.real) splash(worldOf(n, v.towerBase), n.color, false);
    }
    const goal = v.towerBase.clone().add(new THREE.Vector3(0, idx * SLOT_H, 0));
    e.m.position.lerp(goal, 0.12); e.m.rotation.y *= 0.9; e.m.scale.setScalar(e.m.scale.x + (1 - e.m.scale.x) * 0.15);
    if (idx === 0 && !e.plugged && V.ready && e.m.position.distanceTo(goal) < 0.25) { e.plugged = true; if (!e.b.real) { sparkle(worldOf(n, goal), e.b.color, 40, 5, 1.1); flashAt(worldOf(n, goal), e.b.color); } }
    if (idx !== 0 || !V.ready) e.plugged = e.plugged || !V.ready;
  });
  // the top of every stack: an ellipsis block (the many blocks not shown), then the genesis block, height 0
  if (!v.caps) { v.caps = [capBlockMesh('dots'), capBlockMesh('genesis')]; v.caps.forEach((m, k) => { m.position.copy(v.towerBase).add(new THREE.Vector3(0, (want.length + k) * SLOT_H, 0)); v.group.add(m); }); }
  v.caps.forEach((m, k) => m.position.lerp(v.towerBase.clone().add(new THREE.Vector3(0, (want.length + k) * SLOT_H, 0)), 0.12));
  for (const [h, e] of v.tower) if (!wantSet.has(h)) {
    v.tower.delete(h);
    const reorged = !ancestors(n.tip).includes(h);
    V.anims.push({ t: 0, d: reorged ? 1.6 : 0.8, step: k => { if (reorged) { e.m.position.x += 0.06; e.m.position.y -= k * 0.35; e.m.rotation.z += 0.05; } else { e.m.position.y += 0.05; e.m.scale.setScalar(1 - k); } }, done: () => v.group.remove(e.m) });
  }
}
const blockMatCache = new Map();
// cap blocks shared by every tower: '…' for the run of blocks not shown, and the genesis block (height 0)
const capMats = {};
function capBlockMesh(kind) {
  if (!capMats[kind]) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    if (kind === 'dots') {
      g.fillStyle = '#4b5568'; g.fillRect(0, 0, 64, 64); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, 56, 64, 8); g.fillRect(56, 0, 8, 64); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, 0, 64, 6);
      g.fillStyle = '#e9f1ff'; for (const x of [17, 29, 41]) g.fillRect(x, 28, 7, 7);
    } else {
      g.fillStyle = '#1d2230'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#ffcf3a'; g.lineWidth = 4; g.strokeRect(3, 3, 58, 58);
      g.fillStyle = '#ffcf3a'; g.font = 'bold 30px "Pixelify Sans", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('G', 32, 27);
      g.font = '16px VT323, monospace'; g.fillStyle = '#ffe9a6'; g.fillText('#0', 32, 49);
    }
    const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter;
    capMats[kind] = new THREE.MeshLambertMaterial({ map: t, emissive: kind === 'genesis' ? '#3a2e08' : '#000' });
  }
  const m = new THREE.Mesh(V.geo.blk, capMats[kind]); m.userData.cap = kind; m.userData.part = 'tower'; return m;
}
function blockMesh(b) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const base = b.real ? '#b7bcc8' : b.color;
  g.fillStyle = base; g.fillRect(0, 0, 64, 64); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 56, 64, 8); g.fillRect(56, 0, 8, 64); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(0, 0, 64, 6);
  g.fillStyle = '#0b0d12'; g.font = 'bold 18px "Pixelify Sans", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(b.pool.replace(/[^A-Za-z0-9 ]/g, '').split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase() || '?', 32, 24);
  g.font = '17px VT323, monospace'; g.fillText('#' + String(b.height).slice(-4), 32, 44);
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter;
  const m = new THREE.Mesh(V.geo.blk, new THREE.MeshLambertMaterial({ map: t, emissive: b.real ? '#000' : new THREE.Color(b.color).multiplyScalar(0.15) }));
  return m;
}
function syncPool(n) {
  const v = V.nodes[n.id];
  const inTpl = new Set(n.tpl && n.stage !== 'won' ? n.tpl.chosen.map(c => c.tx.txid) : []);
  for (const [id, e] of v.txMeshes) {
    const slot = n.slots.indexOf(id);
    if (slot < 0) { e.m.visible = false; continue; }
    e.m.visible = true;
    const p = poolSlotLocal(slot); const age = V.t - e.born;
    const drop = Math.max(0, 0.6 - age * 2);
    e.m.position.set(p.x, p.y + Math.sin(V.t * 2 + slot) * 0.05 + drop, p.z);
    e.m.rotation.y = slot + V.t * 0.3;
    const tx = TXS.get(id); if (tx) e.m.material = txMat(tx, inTpl.has(id));
  }
}
function drawFlyers() {
  const alive = new Set();
  for (const p of particles) {
    if (p.k !== 'tx' && p.k !== 'block' && p.k !== 'wallet') continue;
    if (S.simTime < p.t0) continue;
    alive.add(p);
    let f = V.flyers.get(p);
    if (!f) { f = p.k === 'block' ? blockMesh(p.payload) : new THREE.Mesh(V.geo.tx, txMat(p.payload)); if (p.k === 'block') f.scale.setScalar(0.6); V.scene.add(f); V.flyers.set(p, f); }
    const k = Math.min(1, (S.simTime - p.t0) / (p.t1 - p.t0));
    if (p.k === 'wallet') { const i = V.throwers.get(p.payload.txid) || 0; const a = personHand(i), b = worldOf(p.to, V.nodes[p.to.id].poolCenter); f.position.copy(arcPoint(a, b, k, 9 + a.distanceTo(b) * 0.12)); f.rotation.x += 0.15; f.rotation.y += 0.1; }
    else if (p.k === 'block') { const a = worldOf(p.from, V.nodes[p.from.id].fb.position), b = worldOf(p.to, HOLD_POS); f.position.copy(arcPoint(a, b, k, 7 + a.distanceTo(b) * 0.15)); f.rotation.x += 0.12; f.rotation.y += 0.1; if (Math.random() < 0.6) sparkle(f.position, p.payload.color || '#ffcf3a', 2, 0.8, 0.7); if (k > 0.97 && !p.caught) { p.caught = true; sparkle(f.position, '#ffffff', 18, 3, 0.6); } }
    else { const a = worldOf(p.from, V.nodes[p.from.id].poolCenter), b = worldOf(p.to, V.nodes[p.to.id].poolCenter); f.position.copy(arcPoint(a, b, k, 5 + a.distanceTo(b) * 0.12)); f.rotation.y += 0.08; }
  }
  for (const [p, f] of V.flyers) if (!alive.has(p)) { V.scene.remove(f); V.flyers.delete(p); }
}
function render3(dtReal, dtSim) {
  V.t += dtReal;
  V.tex.water.offset.x = (V.t * 0.03) % 1; V.tex.water.offset.y = (V.t * 0.017) % 1;
  for (const c of V.clouds) { c.userData.a += c.userData.sp * dtReal; c.position.x = Math.cos(c.userData.a) * c.userData.r; c.position.z = Math.sin(c.userData.a) * c.userData.r; }
  for (const n of NODES) {
    const v = V.nodes[n.id];
    v.group.position.y = Math.sin(V.t * 0.6 + v.bob) * 0.25;
    syncPool(n); syncForming(n); syncTower(n); syncState(n);
    v.mint.rotation.y += 0.02;
    drawLabel(n);
  }
  drawFlyers(); updateStepsBoard(); updatePeople(); applyFlash(); updateStars(dtReal);
  V.anims = V.anims.filter(a => { a.t += dtReal; const k = Math.min(1, a.t / a.d); a.step(k); if (k >= 1) { a.done && a.done(); return false; } return true; });
  V.splashes = V.splashes.filter(s => { s.t += dtReal; const k = s.t / (s.sphere ? 0.7 : s.big ? 1 : 0.7); if (s.sphere) s.m.scale.setScalar(1 + k * 3); else s.m.scale.setScalar(1 + k * (s.big ? 9 : 5)); s.m.material.opacity = Math.max(0, 0.8 * (1 - k)); if (k >= 1) { V.scene.remove(s.m); return false; } return true; });
  if (V.camGoal) { V.camera.position.lerp(V.camGoal.pos, 0.06); V.controls.target.lerp(V.camGoal.target, 0.08); if (V.camera.position.distanceTo(V.camGoal.pos) < 0.05) V.camGoal = null; }
  if (V.follow && !V.camGoal) { const tgt = worldOf(NODE[V.follow], new THREE.Vector3(-3.2, 3.2, 2.6)).add(V.followOff || new THREE.Vector3()); V.controls.target.lerp(tgt, 0.1); }
  V.controls.update();
  V.pipe.render(V.scene, V.camera);
  V.ready = true;
}
function focusNode(id) {
  const n = NODE[id]; const v = V.nodes[id];
  const target = worldOf(n, new THREE.Vector3(-3.2, 3.2, 2.6));
  const out = v.group.position.clone().setY(0).normalize();
  let pos = target.clone().add(out.clone().multiplyScalar(-23)).add(new THREE.Vector3(0, 10, 0)).add(new THREE.Vector3(-out.z, 0, out.x).multiplyScalar(3));
  // shift the view so the platform sits left of the details panel
  const wide = V.wrap.clientWidth >= 900; const fwd = target.clone().sub(pos).normalize(); const right = fwd.clone().cross(new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(wide ? 9.5 : 0);
  pos = pos.add(right); const tgt = target.clone().add(right);
  V.camGoal = { pos, target: tgt }; V.followOff = right; V.controls.autoRotate = false; V.follow = id;
}
// the overview leaves room for the steps board in the sky above the ring; a narrow (taller) canvas looks a little higher so the board clears the ticker
function overviewView() { return { pos: new THREE.Vector3(0, 48, 72), target: new THREE.Vector3(0, V.wrap.clientWidth < 700 ? 23.5 : 17.5, 0) }; }
function overview() { V.camGoal = overviewView(); V.controls.autoRotate = !reduceMotion; V.follow = null; }
