// ============================================================ 3D world (Three.js r128)
const V = {}; // view state
const RING = 15, TOWER_N = 8, SLOT_H = 1.5;
function pixTex(size, draw) { const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); draw(g, size); const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; return t; }
function noiseFill(g, size, cols, seed = 1) { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { g.fillStyle = cols[Math.floor(hash2(x + seed * 31, y + seed * 17) * cols.length)]; g.fillRect(x, y, 1, 1); } }
function hash2(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
const FEE_COLS = [['#a9c8e8', 0], ['#7be06a', 1], ['#ffd23d', 2], ['#ff7a3d', 5]];
const feeBucket = r => r >= 5 ? 3 : r >= 2 ? 2 : r >= 1 ? 1 : 0;
function feeColor(r) { return FEE_COLS[feeBucket(r)][0]; }

function initScene() {
  const wrap = $('stage3d');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.max(1, (window.devicePixelRatio || 1) * 0.6)); // slightly below native on high-density screens, crisp text and scale up with hard edges: chunky pixels
  wrap.prepend(renderer.domElement); renderer.domElement.id = 'cv3';
  const scene = new THREE.Scene();
  const sky = document.createElement('canvas'); sky.width = 2; sky.height = 256; const sg = sky.getContext('2d');
  const grd = sg.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, '#3f9ef0'); grd.addColorStop(0.6, '#7cc6ff'); grd.addColorStop(1, '#bfe6ff'); sg.fillStyle = grd; sg.fillRect(0, 0, 2, 256);
  scene.background = new THREE.CanvasTexture(sky);
  scene.fog = new THREE.Fog(0xbfe6ff, 80, 200);
  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 400);
  camera.position.set(0, 40, 58);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 7, 0); controls.enableDamping = true; controls.dampingFactor = 0.08; controls.maxPolarAngle = Math.PI * 0.49; controls.minDistance = 8; controls.maxDistance = 80;
  controls.autoRotate = !reduceMotion; controls.autoRotateSpeed = 0.35;
  controls.addEventListener('start', () => { V.camGoal = null; });
  scene.add(new THREE.HemisphereLight(0xdff1ff, 0x5a4a30, 0.95));
  const sun = new THREE.DirectionalLight(0xffffff, 0.65); sun.position.set(25, 45, 15); scene.add(sun);
  Object.assign(V, { renderer, scene, camera, controls, wrap, t: 0, anims: [], nodes: {}, flyers: new Map(), splashes: [] });
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
    threadChecked: new THREE.LineDashedMaterial({ color: 0x5fe07c, dashSize: 0.16, gapSize: 0.08, transparent: true, opacity: 1 }),
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
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  let downAt = null;
  renderer.domElement.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect(); mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const ph = ray.intersectObjects(V.people.map(p => p.root), true);
    if (ph.length) { let o = ph[0].object; while (o && o.userData.personIdx === undefined) o = o.parent; if (o) { flashWallet(o.userData.personIdx); return; } }
    const hits = ray.intersectObjects(NODES.map(n => V.nodes[n.id].group), true);
    if (hits.length) { let o = hits[0].object; while (o && !o.userData.nodeId) o = o.parent; if (o) openNode(o.userData.nodeId); }
  });
  renderer.domElement.addEventListener('pointermove', e => {
    const r = renderer.domElement.getBoundingClientRect(); mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera); renderer.domElement.style.cursor = ray.intersectObjects(NODES.map(n => V.nodes[n.id].group).concat(V.people ? V.people.map(p => p.root) : []), true).length ? 'pointer' : 'grab';
  });
  let rq = 0; new ResizeObserver(() => { cancelAnimationFrame(rq); rq = requestAnimationFrame(resize3); }).observe(wrap); resize3();
}
function resize3() { if (V.wrap.clientWidth === V.lastW) return; V.lastW = V.wrap.clientWidth; const w = V.wrap.clientWidth, h = Math.round(w * (w < 700 ? 0.9 : 9 / 16)); V.renderer.setSize(w, h, false); V.renderer.domElement.style.width = w + 'px'; V.renderer.domElement.style.height = h + 'px'; V.camera.aspect = w / h; V.camera.updateProjectionMatrix(); }

function buildClouds() {
  V.clouds = [];
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group();
    for (let k = 0; k < 6; k++) { const m = new THREE.Mesh(V.geo.cube, mat); m.scale.set(2 + hash2(i, k) * 3, 1, 2 + hash2(k, i) * 2); m.position.set((hash2(i, k + 3) - 0.5) * 5, (k % 2) * 0.6, (hash2(k + 5, i) - 0.5) * 3); g.add(m); }
    const a = i / 9 * Math.PI * 2, r = 48 + hash2(i, 77) * 22; g.position.set(Math.cos(a) * r, 24 + hash2(i, 9) * 12, Math.sin(a) * r); g.userData = { a, r, sp: 0.01 + hash2(i, 5) * 0.015 };
    V.scene.add(g); V.clouds.push(g);
  }
}
function makeLabelSprite() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160;
  const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.scale.set(6.4, 2, 1); s.renderOrder = 10;
  s.userData.canvas = c; s.userData.key = ''; return s;
}
function drawLabel(n) {
  const v = V.nodes[n.id], s = v.label, c = s.userData.canvas, g = c.getContext('2d');
  const tip = BLOCKS.get(n.tip); const onBest = ancestors(bestTip()).includes(n.tip);
  const stage = n.hand ? 'HAND' : { template: 'BUILDING BLOCK', verify: 'VERIFYING TXS', merkle: 'MERKLE ROOT', hash: 'HASHING', won: 'BLOCK FOUND!', validate: 'CHECKING PEER BLOCK' }[n.stage] || '';
  const key = [n.name, n.mempool.size, tip.height, onBest, stage, n.won, S.selected === n.id].join('|'); if (key === s.userData.key) return; s.userData.key = key;
  g.clearRect(0, 0, 512, 160);
  g.fillStyle = 'rgba(14,23,38,.86)'; g.fillRect(8, 8, 496, 144); g.fillStyle = S.selected === n.id ? '#ffcf3a' : n.color; g.fillRect(8, 8, 496, 8);
  g.font = 'bold 36px Silkscreen, monospace'; g.fillStyle = '#fff'; g.textBaseline = 'top'; g.fillText(n.name.toUpperCase().slice(0, 14), 22, 26);
  g.font = '26px Silkscreen, monospace'; g.fillStyle = '#9fe7b0'; g.fillText((n.share * 100).toFixed(1) + '%', 400, 32);
  g.font = '24px "JetBrains Mono", monospace'; g.fillStyle = '#cfe0ff'; g.fillText(`mempool ${n.mempool.size} · tip #${fmt(tip.height)}`, 22, 76);
  g.fillStyle = stage === 'BLOCK FOUND!' ? '#ffcf3a' : onBest ? '#6bff9c' : '#ff8a96'; g.fillText(onBest ? stage : 'ON A FORK · ' + stage, 22, 110);
  s.material.map.needsUpdate = true;
}
function rigScreen(n) {
  const v = V.nodes[n.id], c = v.screenCanvas, g = c.getContext('2d');
  g.fillStyle = '#07150f'; g.fillRect(0, 0, 128, 96);
  g.fillStyle = '#6bff9c'; g.font = '12px Silkscreen, monospace'; g.textBaseline = 'top';
  const lbl = { template: 'COLLECT', verify: 'VERIFY', merkle: 'MERKLE', hash: 'HASHING', won: 'FOUND!', validate: 'NEW TIP' }[n.stage] || '';
  g.fillText(lbl, 6, 6);
  if (n.stage === 'hash' && n.last) { g.font = '11px "JetBrains Mono", monospace'; g.fillText((n.last.nonce >>> 0).toString(16).padStart(8, '0'), 6, 28); g.fillStyle = '#2f8a50'; g.fillText(n.last.hex.slice(0, 14), 6, 46);
    const bz = Math.max(0, n.best.z); for (let b = 0; b < S.demoBits; b++) { g.fillStyle = b < bz ? '#6bff9c' : '#14301f'; g.fillRect(6 + b * 7, 70, 5, 10); } }
  v.screenTex.needsUpdate = true;
}
function buildNode(n, i) {
  const g = new THREE.Group(); g.userData.nodeId = n.id;
  const a = -Math.PI * 3 / 4 + i * Math.PI / 2; g.position.set(Math.cos(a) * RING, 0, Math.sin(a) * RING); g.lookAt(0, 0, 0);
  V.scene.add(g);
  const v = V.nodes[n.id] = { group: g, txMeshes: new Map(), tower: new Map(), spawnFrom: new Map(), bob: Math.random() * 6 };
  // the node itself: a glass cube holding this node's view of the UTXO set (coins = small cubes, coin history = thin threads)
  const st = new THREE.Group(); st.position.set(0, 3.6, -1); g.add(st); v.state = st;
  const glass = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 6), new THREE.MeshLambertMaterial({ color: n.color, transparent: true, opacity: 0.07, emissive: n.dark, depthWrite: false }));
  const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(6, 6, 6)), new THREE.LineBasicMaterial({ color: n.color }));
  st.add(glass, frame);
  const mint = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), V.mat.gold); mint.position.set(0, 2.55, 0); st.add(mint); v.mint = mint;
  v.coins = new Map(); v.stateKey = ''; v.threadsOld = null; v.threadsNew = null; v.pulses = [];
  // the mempool: a shallow pool in front of the cube
  const tray = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.35, 4.6), V.mat.stone); tray.position.set(0, -0.1, 5); g.add(tray);
  for (const [w, d, x, z] of [[4.6, 0.3, 0, 2.85], [4.6, 0.3, 0, 7.15], [0.3, 4.6, -2.15, 5], [0.3, 4.6, 2.15, 5]]) { const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, d), V.mat.stone); wall.position.set(x, 0.25, z); g.add(wall); }
  const water = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), V.mat.water); water.rotation.x = -Math.PI / 2; water.position.set(0, 0.2, 5); g.add(water);
  v.poolCenter = new THREE.Vector3(0, 0.3, 5);
  // the node's chain grows as a tower out of the top of the cube
  v.towerBase = new THREE.Vector3(0, 7.5, -1);
  v.label = makeLabelSprite(); v.label.position.set(4.2, 1.6, 5.2); g.add(v.label);
  buildWorkshop(n, v, g);
  buildIsland(g, -10, 6, -5, 8, -0.3, i * 13 + 3);
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
      const c = coins.get(op); const m = new THREE.Mesh(V.geo.cube, coinMatFor(c)); m.userData.nodeId = n.id; m.userData.spk = c.spk; m.userData.mat = m.material;
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
  const m = new THREE.Mesh(V.geo.tx, txMat(tx)); m.userData.nodeId = node.id;
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
window.onTipChanged = () => {};
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
  if (held && all.includes(held.hash)) { let e = v.tower.get(held.hash); if (!e) { const b = BLOCKS.get(held.hash); const m = blockMesh(b); m.userData.nodeId = n.id; v.group.add(m); m.position.copy(held.pos); e = { m, b }; v.tower.set(held.hash, e); v.spawnFrom.delete(held.hash); } e.m.position.lerp(held.pos.clone().add(new THREE.Vector3(0, Math.sin(V.t * 6) * 0.05, 0)), 0.2); e.m.scale.setScalar(0.8); }
  want.forEach((h, idx) => {
    let e = v.tower.get(h);
    if (!e) {
      const b = BLOCKS.get(h); const m = blockMesh(b); m.userData.nodeId = n.id; v.group.add(m);
      const from = v.spawnFrom.get(h) || v.towerBase.clone().add(new THREE.Vector3(2.5, 0, 0)); v.spawnFrom.delete(h);
      m.position.copy(from); e = { m, b }; v.tower.set(h, e);
      if (V.ready && !b.real) splash(worldOf(n, v.towerBase), n.color, false);
    }
    const goal = v.towerBase.clone().add(new THREE.Vector3(0, idx * SLOT_H, 0));
    e.m.position.lerp(goal, 0.12); e.m.rotation.y *= 0.9; e.m.scale.setScalar(e.m.scale.x + (1 - e.m.scale.x) * 0.15);
    if (idx === 0 && !e.plugged && V.ready && e.m.position.distanceTo(goal) < 0.25) { e.plugged = true; if (!e.b.real) { sparkle(worldOf(n, goal), e.b.color, 40, 5, 1.1); flashAt(worldOf(n, goal), e.b.color); } }
    if (idx !== 0 || !V.ready) e.plugged = e.plugged || !V.ready;
  });
  for (const [h, e] of v.tower) if (!wantSet.has(h)) {
    v.tower.delete(h);
    const reorged = !ancestors(n.tip).includes(h);
    V.anims.push({ t: 0, d: reorged ? 1.6 : 0.8, step: k => { if (reorged) { e.m.position.x += 0.06; e.m.position.y -= k * 0.35; e.m.rotation.z += 0.05; } else { e.m.position.y += 0.05; e.m.scale.setScalar(1 - k); } }, done: () => v.group.remove(e.m) });
  }
}
const blockMatCache = new Map();
function blockMesh(b) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const base = b.real ? '#b7bcc8' : b.color;
  g.fillStyle = base; g.fillRect(0, 0, 64, 64); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 56, 64, 8); g.fillRect(56, 0, 8, 64); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(0, 0, 64, 6);
  g.fillStyle = '#0b0d12'; g.font = 'bold 18px Silkscreen, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(b.pool.replace(/[^A-Za-z0-9 ]/g, '').split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase() || '?', 32, 24);
  g.font = '13px "JetBrains Mono", monospace'; g.fillText('#' + String(b.height).slice(-4), 32, 44);
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
    drawLabel(n); v.label.visible = S.selected !== n.id;
  }
  drawFlyers(); updateStepsBoard(); updatePeople(); applyFlash(); updateStars(dtReal);
  V.anims = V.anims.filter(a => { a.t += dtReal; const k = Math.min(1, a.t / a.d); a.step(k); if (k >= 1) { a.done && a.done(); return false; } return true; });
  V.splashes = V.splashes.filter(s => { s.t += dtReal; const k = s.t / (s.sphere ? 0.7 : s.big ? 1 : 0.7); if (s.sphere) s.m.scale.setScalar(1 + k * 3); else s.m.scale.setScalar(1 + k * (s.big ? 9 : 5)); s.m.material.opacity = Math.max(0, 0.8 * (1 - k)); if (k >= 1) { V.scene.remove(s.m); return false; } return true; });
  if (V.camGoal) { V.camera.position.lerp(V.camGoal.pos, 0.06); V.controls.target.lerp(V.camGoal.target, 0.08); if (V.camera.position.distanceTo(V.camGoal.pos) < 0.05) V.camGoal = null; }
  if (V.follow && !V.camGoal) { const tgt = worldOf(NODE[V.follow], new THREE.Vector3(-3.2, 3.2, 2.6)).add(V.followOff || new THREE.Vector3()); V.controls.target.lerp(tgt, 0.1); }
  V.controls.update();
  V.renderer.render(V.scene, V.camera);
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
function overview() { V.camGoal = { pos: new THREE.Vector3(0, 40, 58), target: new THREE.Vector3(0, 7, 0) }; V.controls.autoRotate = !reduceMotion; V.follow = null; }
