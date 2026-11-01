// ============================================================ the workshop: candidate block, worker, crank, cord, readouts
const CBS = 2.2;                                  // candidate block size
const CB_POS = new THREE.Vector3(-5.9, 1.45, 4.4);
const SPOT_FRONT = { p: new THREE.Vector3(-5.9, 0.25, 6.35), r: Math.PI };
const SPOT_CRANK = { p: new THREE.Vector3(-3.55, 0.25, 4.4), r: -Math.PI / 2 };
const HOLD_POS = new THREE.Vector3(-5.9, 1.9, 5.75);
function textSprite(w, h, sw, sh) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); s.scale.set(sw, sh, 1); s.renderOrder = 9;
  s.userData.canvas = c; return s;
}
function cyl(a, b, r, mat) {
  const d = b.clone().sub(a), len = d.length(); const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return m;
}
// the ₿ logo for the hard hats: white symbol on an orange disc
let _btcTex = null;
function btcLogoTex() {
  if (_btcTex) return _btcTex;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#f7931a'; g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 6; g.stroke();
  g.save(); g.translate(64, 66); g.rotate(-0.24); g.fillStyle = '#fff'; g.font = 'bold 86px Arial, Helvetica, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('₿', 0, 2); g.restore();
  _btcTex = new THREE.CanvasTexture(c); return _btcTex;
}
function buildWorker(n) {
  // a voxel miner: Bitcoin-orange hard hat with the ₿ logo, orange reflective vest, shirt sleeves in the pool's colour
  const root = new THREE.Group(); root.userData.nodeId = n.id;
  const L = c => new THREE.MeshLambertMaterial({ color: c });
  const BTC = '#f7931a', SKIN = '#e0b48a';
  const box = (parent, w, h, d, m, x, y, z) => { const o = new THREE.Mesh(V.geo.cube, typeof m === 'string' ? L(m) : m); o.scale.set(w, h, d); o.position.set(x, y, z); parent.add(o); return o; };
  const legL = new THREE.Group(), legR = new THREE.Group(); legL.position.set(-0.12, 0.62, 0); legR.position.set(0.12, 0.62, 0); root.add(legL, legR);
  for (const lg of [legL, legR]) { box(lg, 0.2, 0.56, 0.22, '#34405a', 0, -0.3, 0); box(lg, 0.22, 0.1, 0.28, '#5a3a22', 0, -0.58, 0.03); }
  const vest = new THREE.MeshLambertMaterial({ color: BTC });
  box(root, 0.52, 0.6, 0.3, vest, 0, 0.93, 0);
  const refl = new THREE.MeshLambertMaterial({ color: '#e8eef6', emissive: '#4a5260' });
  box(root, 0.54, 0.06, 0.32, refl, 0, 0.86, 0); box(root, 0.54, 0.06, 0.32, refl, 0, 1.04, 0);
  box(root, 0.06, 0.42, 0.32, refl, -0.13, 0.97, 0); box(root, 0.06, 0.42, 0.32, refl, 0.13, 0.97, 0);
  box(root, 0.36, 0.36, 0.34, SKIN, 0, 1.42, 0);
  box(root, 0.06, 0.06, 0.02, '#1b1b1b', -0.08, 1.45, 0.18); box(root, 0.06, 0.06, 0.02, '#1b1b1b', 0.08, 1.45, 0.18);
  const hat = new THREE.MeshLambertMaterial({ color: BTC });
  box(root, 0.42, 0.16, 0.42, hat, 0, 1.67, 0); box(root, 0.5, 0.04, 0.56, hat, 0, 1.6, 0.04); box(root, 0.08, 0.06, 0.44, hat, 0, 1.77, 0);
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.15), new THREE.MeshBasicMaterial({ map: btcLogoTex(), transparent: true }));
  logo.position.set(0, 1.67, 0.212); root.add(logo);
  const arm = x => { const g = new THREE.Group(); g.position.set(x, 1.18, 0); box(g, 0.14, 0.3, 0.16, vest, 0, -0.12, 0); box(g, 0.13, 0.22, 0.15, n.color, 0, -0.36, 0); box(g, 0.13, 0.13, 0.13, SKIN, 0, -0.54, 0); root.add(g); return g; };
  const armL = arm(-0.34), armR = arm(0.34);
  const clip = new THREE.Group(); clip.position.set(0, -0.6, 0.12); armL.add(clip);
  box(clip, 0.34, 0.03, 0.44, '#8a5a32', 0, 0, 0); box(clip, 0.28, 0.035, 0.36, '#ffffff', 0, 0.005, 0); box(clip, 0.12, 0.05, 0.05, '#b8bcc8', 0, 0.02, -0.2);
  const pen = box(armR, 0.03, 0.22, 0.03, '#1f6fa8', 0, -0.66, 0.06);
  return { root, armL, armR, legL, legR, clip, pen };
}
function buildWorkshop(n, v, g) {
  const slab = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.4, 4.6), V.mat.stone); slab.position.set(-5.4, 0.05, 5.0); g.add(slab);
  const cb = new THREE.Group(); cb.position.copy(CB_POS); g.add(cb); v.fb = cb;
  v.cbMat = new THREE.MeshLambertMaterial({ color: n.color, transparent: true, opacity: 0.16, emissive: n.dark, depthWrite: false, side: THREE.DoubleSide });
  const hidden = new THREE.MeshBasicMaterial({ visible: false });
  cb.add(new THREE.Mesh(new THREE.BoxGeometry(CBS, CBS, CBS), [v.cbMat, v.cbMat, v.cbMat, v.cbMat, hidden, v.cbMat]));
  cb.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(CBS, CBS, CBS)), new THREE.LineBasicMaterial({ color: n.color })));
  // the door is the front face, hinged on its left edge; it carries the block's face readout
  const hinge = new THREE.Group(); hinge.position.set(-CBS / 2, 0, CBS / 2); cb.add(hinge); v.hinge = hinge;
  const fc = document.createElement('canvas'); fc.width = fc.height = 256; v.faceCanvas = fc; v.faceTex = new THREE.CanvasTexture(fc);
  v.doorMat = new THREE.MeshLambertMaterial({ map: v.faceTex, transparent: true, opacity: 0.9, side: THREE.DoubleSide, emissive: '#222' });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(CBS, CBS), v.doorMat); door.position.set(CBS / 2, 0, 0.01); hinge.add(door);
  // the crank on the right-hand face
  const crank = new THREE.Group(); crank.position.set(CBS / 2, 0, 0); cb.add(crank);
  const steel = new THREE.MeshLambertMaterial({ color: '#b8bcc8' });
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.42, 8), steel); axle.rotation.z = Math.PI / 2; axle.position.x = 0.21; crank.add(axle);
  const armG = new THREE.Group(); armG.position.x = 0.42; crank.add(armG); v.crankArm = armG;
  const carm = new THREE.Mesh(V.geo.cube, steel); carm.scale.set(0.07, 0.6, 0.1); carm.position.y = 0.28; armG.add(carm);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 8), new THREE.MeshLambertMaterial({ color: n.color })); knob.rotation.z = Math.PI / 2; knob.position.set(0.15, 0.56, 0); armG.add(knob);
  // the cord: this block commits to the hash of the block below the tower (the previous block)
  const top = CB_POS.clone().add(new THREE.Vector3(0, CBS / 2, 0)), prev = v.towerBase.clone().add(new THREE.Vector3(0, -0.65, 0.66));
  const mid = top.clone().lerp(prev, 0.5).add(new THREE.Vector3(0, -1.4, 1.2));
  v.cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(top, mid, prev), 48, 0.035, 6), new THREE.MeshLambertMaterial({ color: '#ffcf3a', emissive: '#6a4a00' }));
  v.cord.visible = false; g.add(v.cord);
  // readouts: the hash next to the block, and a vertical scale of leading zero bits with the target line
  v.hashSprite = textSprite(640, 150, 5.4, 1.27); v.hashSprite.position.set(-5.9, 3.45, 4.4); g.add(v.hashSprite);
  v.scaleSprite = textSprite(170, 420, 1.0, 2.5); v.scaleSprite.position.set(-8.75, 1.75, 4.4); g.add(v.scaleSprite);
  v.worker = buildWorker(n); g.add(v.worker.root); v.worker.root.position.copy(SPOT_FRONT.p); v.worker.root.rotation.y = SPOT_FRONT.r;
  v.fbCubes = []; v.pend = new THREE.Group(); v.state.add(v.pend); v.pendKey = '';
  v.lastZ = null; v.lastHex = null; v.lastNonce = null; v.hashKey = ''; v.faceKey = '';
}
function fbSlot(i) { const k = i % 27; return new THREE.Vector3((k % 3 - 1) * 0.6, (Math.floor(k / 9) - 1) * 0.6, (Math.floor(k / 3) % 3 - 1) * 0.6); }

// ---- per-hash hook from the core
window.sceneOnHash = (m, nonce, hx, z) => { const v = V.nodes[m.id]; v.lastZ = z; v.lastHex = hx; v.lastNonce = nonce; v.hashAt = V.t; };
window.onExtranonce = m => { V.nodes[m.id].extraUntil = V.t + 2.2; };

function drawFace(n, v) {
  const t = n.tpl; if (!t) return;
  const key = [n.stage, n.landed, n.verified, n.nonce, t.id, n.stage === 'won'].join('|'); if (key === v.faceKey) return; v.faceKey = key;
  const g = v.faceCanvas.getContext('2d'); g.clearRect(0, 0, 256, 256);
  g.fillStyle = n.stage === 'won' ? n.color : 'rgba(14,23,38,.55)'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = n.color; g.lineWidth = 6; g.strokeRect(3, 3, 250, 250);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = n.stage === 'won' ? '#0b0d12' : '#fff';
  const prevShort = t.prev.replace(/^0+/, '').slice(0, 8);
  if (n.stage === 'hash' || n.stage === 'won') {
    g.font = '20px Silkscreen, monospace'; g.fillText('PREV HASH', 128, 36); g.font = '22px "JetBrains Mono", monospace'; g.fillText('…' + prevShort, 128, 64);
    g.font = '22px Silkscreen, monospace'; g.fillText('NONCE', 128, 112); g.font = 'bold 96px VT323, monospace';
    g.fillText(String(n.stage === 'won' && n.lastWin ? n.lastWin.nonce : n.nonce), 128, 172);
    g.font = '18px Silkscreen, monospace'; g.fillText(n.stage === 'won' ? 'PROVEN ✓' : `${t.chosen.length + 1} TXS INSIDE`, 128, 228);
  } else {
    g.font = '22px Silkscreen, monospace'; g.fillText({ template: 'FILLING', verify: 'CHECKING', merkle: 'MERKLE ROOT', validate: 'NEW TIP' }[n.stage] || '', 128, 70);
    g.font = 'bold 70px VT323, monospace';
    g.fillText(n.stage === 'merkle' ? t.merkle.slice(0, 6) : n.stage === 'verify' ? `${n.verified}/${t.chosen.length}` : `${Math.min(n.landed, t.chosen.length)}/${t.chosen.length}`, 128, 140);
    g.font = '18px Silkscreen, monospace'; g.fillText(n.stage === 'merkle' ? 'TIED TO PREV BLOCK' : 'TRANSACTIONS', 128, 200);
  }
  v.faceTex.needsUpdate = true;
}
function drawHashReadout(n, v) {
  const show = (n.stage === 'hash' || n.stage === 'won') && v.lastHex;
  v.hashSprite.visible = show || V.t < (v.extraUntil || 0); v.scaleSprite.visible = n.stage === 'hash' || n.stage === 'won';
  const key = [v.lastHex, S.demoBits, n.stage, V.t < (v.extraUntil || 0)].join('|'); if (key === v.hashKey) return; v.hashKey = key;
  const c = v.hashSprite.userData.canvas, g = c.getContext('2d'); g.clearRect(0, 0, 640, 150);
  g.fillStyle = 'rgba(14,23,38,.88)'; g.fillRect(4, 4, 632, 142);
  if (V.t < (v.extraUntil || 0)) { g.fillStyle = '#ffe9a6'; g.font = '24px Silkscreen, monospace'; g.fillText('NONCES 0–100 USED UP', 20, 46); g.font = '22px "Pixelify Sans", sans-serif'; g.fillText('new extranonce in the coinbase → new merkle root → start again at 0', 20, 96); v.hashSprite.material.map.needsUpdate = true; }
  if (show) {
    // the real double SHA-256 of the 80-byte header, printed the way block explorers show it
    const hx = v.lastHex, z = v.lastZ, hit = z >= S.demoBits, zh = hx.match(/^0*/)[0].length;
    g.font = '20px Silkscreen, monospace'; g.fillStyle = '#9ab0cc'; g.fillText(`SHA-256d(HEADER) WITH NONCE ${v.lastNonce}`, 20, 30);
    g.font = 'bold 25px "JetBrains Mono", monospace';
    const line = (str, off, y) => { let x = 20; for (let i = 0; i < str.length; i++) { g.fillStyle = off + i < zh ? '#ffcf3a' : '#cfe0ff'; g.fillText(str[i], x, y); x += 18.5; } };
    line(hx.slice(0, 32), 0, 64); line(hx.slice(32), 32, 94);
    g.font = '20px Silkscreen, monospace'; g.fillStyle = hit ? '#5fe07c' : '#ff8a96';
    g.fillText(`${z} LEADING ZERO BITS ${hit ? '≥' : '<'} TARGET ${S.demoBits} · ${hit ? 'HIT!' : 'WIND AGAIN'}`, 20, 130);
  }
  v.hashSprite.material.map.needsUpdate = true;
  // the scale: a column of zero-bit counts with the target line
  const sc = v.scaleSprite.userData.canvas, s = sc.getContext('2d'); const W = 170, H = 420, top = 54, bot = 380;
  const max = Math.max(S.demoBits + 3, 8), y = k => bot - (k / max) * (bot - top);
  s.clearRect(0, 0, W, H); s.fillStyle = 'rgba(14,23,38,.88)'; s.fillRect(4, 4, W - 8, H - 8);
  s.font = '18px Silkscreen, monospace'; s.fillStyle = '#9ab0cc'; s.textAlign = 'center'; s.fillText('ZEROS', W / 2, 30);
  s.fillStyle = '#16243a'; s.fillRect(70, top, 40, bot - top);
  s.fillStyle = 'rgba(95,224,124,.22)'; s.fillRect(70, top, 40, y(S.demoBits) - top);
  const z = v.lastZ || 0, hit = z >= S.demoBits;
  if (v.lastHex) { s.fillStyle = hit ? '#5fe07c' : '#ff8a96'; s.fillRect(74, y(Math.min(z, max)), 32, bot - y(Math.min(z, max))); }
  s.font = '16px "JetBrains Mono", monospace'; s.textAlign = 'right';
  for (let k = 0; k <= max; k++) { s.fillStyle = k === S.demoBits ? '#5fe07c' : '#7f93b0'; s.fillText(String(k), 62, y(k) + 5); s.fillRect(64, y(k), 6, 2); }
  s.strokeStyle = '#5fe07c'; s.lineWidth = 4; s.beginPath(); s.moveTo(58, y(S.demoBits)); s.lineTo(122, y(S.demoBits)); s.stroke();
  s.textAlign = 'left'; s.fillStyle = '#5fe07c'; s.font = '14px Silkscreen, monospace'; s.fillText('TARGET', 116, y(S.demoBits) - 6);
  v.scaleSprite.material.map.needsUpdate = true;
}
// dotted threads for this block's transactions in the state cube; each turns bold green once checked
function syncPending(n, v) {
  const t = n.tpl; const active = t && ['template', 'verify', 'merkle', 'hash', 'won'].includes(n.stage);
  const upto = !active ? 0 : n.stage === 'template' ? Math.min(n.landed, t.chosen.length) : t.chosen.length;
  const green = !active ? 0 : n.stage === 'template' ? 0 : n.stage === 'verify' ? n.verified : t.chosen.length;
  const key = active ? [t.id, upto, green, n.tip].join('|') : 'none';
  if (key === v.pendKey) return; v.pendKey = key;
  while (v.pend.children.length) { const c = v.pend.children.pop(); c.geometry && c.geometry.dispose(); }
  if (!active) return;
  const dotted = [], checked = [];
  t.chosen.slice(0, upto).forEach((c, i) => {
    const tx = c.tx; const outs = tx.vout.map((o, j) => o.type === 'op_return' ? null : coinPos(hex(o.spk), tx.txid + ':' + j)).filter(Boolean);
    for (const vin of tx.vin) { const a = coinPos(hex(vin.spk), vin.txid + ':' + vin.vout);
      for (const b of outs) (i < green ? checked : dotted).push(a.clone(), b.clone()); }
  });
  if (dotted.length) { const l = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(dotted), V.mat.threadPend); l.computeLineDistances(); v.pend.add(l); }
  if (checked.length) {
    // bold dotted line: a chain of bright green beads along each checked thread, kept until the block is mined
    const beads = []; for (let k = 0; k < checked.length; k += 2) { const a = checked[k], b = checked[k + 1], n2 = Math.max(2, Math.floor(a.distanceTo(b) / 0.22)); for (let j = 0; j <= n2; j++) beads.push(a.clone().lerp(b, j / n2)); }
    const im = new THREE.InstancedMesh(V.geo.bead, V.mat.threadOk, beads.length); const o = new THREE.Object3D();
    beads.forEach((p, k) => { o.position.copy(p); o.updateMatrix(); im.setMatrixAt(k, o.matrix); }); v.pend.add(im);
  }
}
function syncForming(n) {
  const v = V.nodes[n.id]; const t = n.tpl;
  const want = t && ['template', 'verify', 'merkle', 'hash'].includes(n.stage) ? Math.min(27, n.landed) : 0;
  while (v.fbCubes.length > want) v.fb.remove(v.fbCubes.pop());
  while (v.fbCubes.length < want) { const i = v.fbCubes.length; const c = new THREE.Mesh(V.geo.tx, txMat(t.chosen[i].tx)); c.scale.setScalar(1.1); c.position.copy(fbSlot(i)); v.fb.add(c); v.fbCubes.push(c); }
  v.fbCubes.forEach((c, i) => { const done = n.stage !== 'template' && (n.stage !== 'verify' || i < n.verified); c.material = done ? V.mat.ok : txMat(t.chosen[i].tx); });
  // the door: open while transactions stream in, closed otherwise
  const n2 = t ? t.chosen.length : 0; const open = n.stage === 'template' && n.t > 0.05 && n.t < n2 * 0.22 + 0.55;
  v.hinge.rotation.y += ((open ? -1.85 : 0) - v.hinge.rotation.y) * 0.15;
  // opaque once proven
  const op = n.stage === 'won' ? 0.97 : 0.16; v.cbMat.opacity += (op - v.cbMat.opacity) * 0.2; v.doorMat.opacity = Math.max(0.9, v.cbMat.opacity);
  v.fb.visible = n.stage !== 'validate' || V.t < 0;
  // the crank turns one full revolution per hash
  const ang = n.stage === 'hash' && n.turnDur ? (n.turnT / n.turnDur) * Math.PI * 2 : 0; v.crankArm.rotation.x = -ang;
  v.cord.visible = !!t && ['merkle', 'hash', 'won'].includes(n.stage);
  drawFace(n, v); drawHashReadout(n, v); syncPending(n, v); poseWorker(n, v, ang);
}
function poseWorker(n, v, ang) {
  const w = v.worker; const held = v.held && S.simTime < v.held.until;
  const atCrank = n.stage === 'hash' || (n.stage === 'won' && n.t < 0.2);
  const spot = atCrank ? SPOT_CRANK : SPOT_FRONT;
  const d = spot.p.clone().sub(w.root.position); const moving = d.length() > 0.05;
  w.root.position.add(d.multiplyScalar(0.12));
  let dr = spot.r - w.root.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); w.root.rotation.y += dr * 0.15;
  const walk = moving ? Math.sin(V.t * 14) * 0.5 : 0; w.legL.rotation.x = walk; w.legR.rotation.x = -walk;
  let aL = 0, aR = 0, zR = 0; let clip = false;
  if (n.stage === 'template') { const n2 = n.tpl ? n.tpl.chosen.length : 0; const reaching = n.t < 0.7 || (n.t > n2 * 0.22 + 0.2 && n.t < n2 * 0.22 + 0.9); aR = reaching ? -1.5 : -0.2; aL = -0.1; }
  else if (n.stage === 'verify' || n.stage === 'merkle' || n.stage === 'validate') { clip = true; aL = -1.15; aR = -1.0 + Math.sin(V.t * 18) * 0.12; zR = 0.25; }
  else if (n.stage === 'hash') { aR = -1.25 - Math.sin(ang) * 0.45; aL = -0.2; zR = -0.1 + Math.cos(ang) * 0.2; }
  else if (n.stage === 'won') { const k = Math.min(1, n.t / 0.7); aR = k < 0.45 ? -2.9 * (k / 0.45) : -2.9 + (k - 0.45) / 0.55 * 2.4; aL = -0.4; }
  w.armL.rotation.x += (aL - w.armL.rotation.x) * 0.25; w.armR.rotation.x += (aR - w.armR.rotation.x) * (n.stage === 'hash' ? 0.6 : 0.25); w.armR.rotation.z += (zR - w.armR.rotation.z) * 0.3;
  w.clip.visible = clip; w.pen.visible = clip;
}

// ============================================================ whitepaper §5 board, suspended in the sky above one node
const WP_STEPS = ['New transactions are broadcast to all nodes.', 'Each node collects new transactions into a block.', 'Each node works on finding a difficult proof-of-work for its block.',
  'When a node finds a proof-of-work, it broadcasts the block to all nodes.', 'Nodes accept the block only if all transactions in it are valid and not already spent.',
  "Nodes express their acceptance of the block by working on creating the next block in the chain, using the hash of the accepted block as the previous hash."];
const stepFlash = {}; const _wp = wp; wp = function (k) { _wp(k); stepFlash[k] = V.t || 0; };
function buildStepsBoard() {
  const host = NODES[0]; const c = document.createElement('canvas'); c.width = 1024; c.height = 700;
  const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); s.scale.set(22, 15, 1);
  s.position.copy(worldOf(host, new THREE.Vector3(-11, 18.5, 7))); V.scene.add(s);
  V.board = { s, c, t, host, key: '', acceptUntil: 0 };
}
function activeSteps(n) {
  const on = new Set();
  if (n.stage === 'template' || n.stage === 'verify') on.add(2);
  if (n.stage === 'merkle' || n.stage === 'hash') on.add(3);
  if (n.stage === 'won') on.add(4);
  if (n.stage === 'validate') on.add(5);
  if (V.board.acceptUntil > S.simTime && (n.stage === 'template' || n.stage === 'verify')) on.add(6);
  if ((V.t - (n.lastTxAt || -9)) < 0.9) on.add(1);
  return on;
}
function updateStepsBoard() {
  const B = V.board; if (!B) return; const n = B.host;
  if (n.stage === 'validate') B.acceptUntil = S.simTime + 4.5;
  const on = activeSteps(n);
  const flash = new Set(Object.keys(stepFlash).filter(k => V.t - stepFlash[k] < 1.2).map(Number));
  const key = [...on].join(',') + '|' + [...flash].join(',') + '|' + n.name; if (key === B.key) return; B.key = key;
  const g = B.c.getContext('2d'); const W = 1024, H = 700;
  g.clearRect(0, 0, W, H); g.fillStyle = 'rgba(20,32,52,.93)'; g.fillRect(0, 0, W, H); g.strokeStyle = '#2b4466'; g.lineWidth = 6; g.strokeRect(3, 3, W - 6, H - 6);
  // chains hanging the board from the sky
  g.fillStyle = '#9ab0cc'; g.textBaseline = 'top';
  g.font = '34px Silkscreen, monospace'; g.fillText('WHITEPAPER §5 · NETWORK', 34, 30);
  g.font = '24px "Pixelify Sans", sans-serif'; g.fillStyle = '#9ab0cc'; g.fillText(`Live at ${n.name}: each step lights up as this node does it.`, 34, 80);
  const wrap = (txt, max) => { const words = txt.split(' '), lines = []; let cur = ''; for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (g.measureText(t2).width > max) { lines.push(cur); cur = w; } else cur = t2; } lines.push(cur); return lines; };
  let y = 128;
  WP_STEPS.forEach((txt, i) => {
    const k = i + 1, active = on.has(k), fl = flash.has(k);
    g.font = '27px "Pixelify Sans", sans-serif'; const lines = wrap(txt, W - 170); const h = 30 + lines.length * 34;
    g.fillStyle = active ? '#3a3216' : fl ? '#26324a' : '#1b2d47'; g.fillRect(28, y, W - 56, h);
    if (active || fl) { g.strokeStyle = active ? '#ffcf3a' : '#7f93b0'; g.lineWidth = active ? 5 : 3; g.strokeRect(30, y + 2, W - 60, h - 4); }
    g.fillStyle = '#ffcf3a'; g.font = '28px Silkscreen, monospace'; g.fillText(String(k), 56, y + 16);
    g.font = '27px "Pixelify Sans", sans-serif'; g.fillStyle = active ? '#fff6d6' : '#e9f1ff';
    lines.forEach((ln, j) => g.fillText(ln, 110, y + 15 + j * 34));
    if (active) { g.fillStyle = '#ffcf3a'; g.font = '20px Silkscreen, monospace'; g.textAlign = 'right'; g.fillText('NOW', W - 50, y + 18); g.textAlign = 'left'; }
    y += h + 10;
  });
  B.t.needsUpdate = true;
}

// ============================================================ the wallet platform: people throwing their transactions to the pools
const PLAT_POS = new THREE.Vector3(0, 3.5, -33);
const HOODIES = ['#d33b3b', '#2f9a44', '#2e63c9', '#e6c229', '#c44fb0', '#3fb7b0', '#e07b2a', '#7d5cff', '#e8e8ee', '#2b2b33', '#9be14f', '#ff7a9c'];
function buildPerson(i) {
  const hc = HOODIES[i % 12], root = new THREE.Group(); const hood = new THREE.MeshLambertMaterial({ color: hc });
  const L = c => new THREE.MeshLambertMaterial({ color: c });
  const box = (p, w, h, d, m, x, y, z) => { const o = new THREE.Mesh(V.geo.cube, typeof m === 'string' ? L(m) : m); o.scale.set(w, h, d); o.position.set(x, y, z); p.add(o); return o; };
  box(root, 0.2, 0.6, 0.22, '#2d3a55', -0.12, 0.3, 0); box(root, 0.2, 0.6, 0.22, '#2d3a55', 0.12, 0.3, 0);
  box(root, 0.56, 0.66, 0.34, hood, 0, 0.92, 0);                                   // hoodie
  box(root, 0.24, 0.14, 0.02, new THREE.MeshLambertMaterial({ color: new THREE.Color(hc).multiplyScalar(0.75) }), 0, 0.78, 0.18); // pocket
  box(root, 0.46, 0.46, 0.44, hood, 0, 1.45, -0.01);                               // hood
  box(root, 0.3, 0.3, 0.04, '#1a1410', 0, 1.42, 0.21);                             // shadowed face
  box(root, 0.05, 0.05, 0.02, '#f2c79a', -0.07, 1.45, 0.235); box(root, 0.05, 0.05, 0.02, '#f2c79a', 0.07, 1.45, 0.235);
  const arm = x => { const g = new THREE.Group(); g.position.set(x, 1.16, 0); box(g, 0.14, 0.5, 0.16, hood, 0, -0.23, 0); box(g, 0.12, 0.12, 0.12, '#f2c79a', 0, -0.52, 0); root.add(g); return g; };
  const armL = arm(-0.34), armR = arm(0.34);
  // the private key in the left hand
  const key = new THREE.Group(); key.position.set(0, -0.62, 0.1); armL.add(key);
  const gold = new THREE.MeshLambertMaterial({ color: '#ffcf3a', emissive: '#7a5a00' });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.028, 6, 14), gold); ring.position.y = 0.02; key.add(ring);
  const shaft = new THREE.Mesh(V.geo.cube, gold); shaft.scale.set(0.035, 0.035, 0.26); shaft.position.set(0, 0.02, 0.2); key.add(shaft);
  for (const z of [0.26, 0.32]) { const tooth = new THREE.Mesh(V.geo.cube, gold); tooth.scale.set(0.03, 0.07, 0.035); tooth.position.set(0, -0.025, z); key.add(tooth); }
  // the wallet in the right hand (the throwing hand), same colour family as the hoodie
  const wallet = new THREE.Group(); wallet.position.set(0, -0.66, 0.1); armR.add(wallet);
  box(wallet, 0.32, 0.08, 0.24, new THREE.MeshLambertMaterial({ color: new THREE.Color(hc).multiplyScalar(0.85) }), 0, 0, 0);
  box(wallet, 0.32, 0.03, 0.12, new THREE.MeshLambertMaterial({ color: new THREE.Color(hc).multiplyScalar(0.65) }), 0, 0.05, -0.06);
  box(wallet, 0.07, 0.05, 0.05, '#ffcf3a', 0.16, 0.02, 0);
  root.userData.personIdx = i;
  return { root, armL, armR, key, wallet, hood, hc, throwAt: -9, phase: Math.random() * 6 };
}
function buildUserPlatform() {
  const g = new THREE.Group(); g.position.copy(PLAT_POS); V.scene.add(g); V.plat = g;
  const concrete = new THREE.MeshLambertMaterial({ color: '#9aa3ad' });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(36, 0.8, 5.2), concrete); slab.position.y = -0.4; g.add(slab);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(36, 0.06, 0.35), new THREE.MeshLambertMaterial({ color: '#ffd23d' })); edge.position.set(0, 0.03, 2.2); g.add(edge);
  buildIsland(g, -19, 19, -4, 4, -0.8, 7);
  for (let k = 0; k < 7; k++) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 4, 6), new THREE.MeshLambertMaterial({ color: '#4b5568' })); post.position.set(-16.5 + k * 5.5, 2, -2.1); g.add(post); }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(36, 0.25, 3.4), new THREE.MeshLambertMaterial({ color: '#3a4150' })); roof.position.set(0, 4.1, -1.0); roof.rotation.x = 0.08; g.add(roof);
  for (const x of [-12, 0, 12]) { const bench = new THREE.Mesh(V.geo.cube, new THREE.MeshLambertMaterial({ color: '#8a5a32' })); bench.scale.set(2.4, 0.45, 0.6); bench.position.set(x, 0.22, -1.6); g.add(bench); }
  const sign = textSprite(768, 120, 12, 1.9); sign.position.set(0, 5.5, -1); g.add(sign);
  const sg = sign.userData.canvas.getContext('2d'); sg.fillStyle = '#1f2a3a'; sg.fillRect(0, 0, 768, 120); sg.strokeStyle = '#ffd23d'; sg.lineWidth = 6; sg.strokeRect(3, 3, 762, 114);
  sg.fillStyle = '#fff'; sg.font = 'bold 40px Silkscreen, monospace'; sg.textAlign = 'center'; sg.fillText('WALLET PLATFORM', 384, 52);
  sg.font = '24px "Pixelify Sans", sans-serif'; sg.fillStyle = '#cfe0ff'; sg.fillText('each person signs with their own key and throws the transaction to a pool', 384, 92);
  sign.material.map.needsUpdate = true;
  V.people = WALLETS.map((_, i) => { const p = buildPerson(i); p.root.position.set(-15.4 + i * 2.8, 0, 1.0); g.add(p.root); return p; });
  V.throwers = new Map();
}
function personFor(tx) {
  const k = tx.vin[0] && WALLET_BY_SPK.get(hex(tx.vin[0].spk));
  return k ? WALLETS.indexOf(k) : Math.floor(strHash(tx.txid, 9) * WALLETS.length);
}
window.onWalletSend = (node, tx) => { const i = personFor(tx); V.throwers.set(tx.txid, i); V.people[i].throwAt = V.t; };
function personHand(i) { const p = V.people[i]; return p.root.localToWorld(new THREE.Vector3(0.35, 1.7, 0.3)); }
function updatePeople() {
  for (const p of V.people) {
    const dt = V.t - p.throwAt;
    if (dt < 0.7) { const k = dt / 0.7; p.armR.rotation.x = k < 0.4 ? -3.0 * (k / 0.4) : -3.0 + (k - 0.4) / 0.6 * 2.6; p.root.position.z = 1.0 + Math.sin(k * Math.PI) * 0.15; }
    else { p.armR.rotation.x = -1.0 + Math.sin(V.t * 1.3 + p.phase) * 0.06; p.armL.rotation.x = -1.1 + Math.sin(V.t * 0.9 + p.phase) * 0.06; }
    p.key.rotation.z = Math.sin(V.t * 2 + p.phase) * 0.25;
    p.root.rotation.y = Math.sin(V.t * 0.4 + p.phase) * 0.15;
  }
}

// ---- bech32 (BIP173) so each wallet shows its real bc1q address
function bech32Addr(prog20) {
  const CH = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l', G = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  const poly = vals => { let c = 1; for (const v of vals) { const b = c >> 25; c = ((c & 0x1ffffff) << 5) ^ v; for (let i = 0; i < 5; i++) if ((b >> i) & 1) c ^= G[i]; } return c; };
  const data = [0]; let acc = 0, bits = 0; for (const x of prog20) { acc = (acc << 8) | x; bits += 8; while (bits >= 5) { bits -= 5; data.push((acc >> bits) & 31); } } if (bits) data.push((acc << (5 - bits)) & 31);
  const hrp = 'bc', exp = [...hrp].map(c => c.charCodeAt(0) >> 5).concat([0], [...hrp].map(c => c.charCodeAt(0) & 31));
  const pm = poly(exp.concat(data, [0, 0, 0, 0, 0, 0])) ^ 1; const chk = []; for (let i = 0; i < 6; i++) chk.push((pm >> (5 * (5 - i))) & 31);
  return hrp + '1' + data.concat(chk).map(d => CH[d]).join('');
}
// click a person: every coin their key controls flashes red in each node's state cube
function flashWallet(i) {
  const key = WALLETS[i], spk = hex(key.spk); V.flash = { spk, until: V.t + 3.5, person: i };
  const st = stateOf(bestTip()); let n = 0, sum = 0;
  for (const [op, c] of BASE) if (c.spk && hex(c.spk) === spk && !st.spent.has(op)) { n++; sum += c.value; }
  for (const [op, c] of st.created) if (c.spk && hex(c.spk) === spk && !st.spent.has(op)) { n++; sum += c.value; }
  const p = V.people[i];
  if (!p.tag) { p.tag = textSprite(560, 130, 4.6, 1.07); p.tag.position.set(0, 2.7, 0); p.root.add(p.tag); }
  const g = p.tag.userData.canvas.getContext('2d'); g.clearRect(0, 0, 560, 130);
  g.fillStyle = 'rgba(14,23,38,.92)'; g.fillRect(4, 4, 552, 122); g.strokeStyle = '#ff5468'; g.lineWidth = 5; g.strokeRect(4, 4, 552, 122);
  const addr = bech32Addr(key.h160);
  g.font = '22px Silkscreen, monospace'; g.fillStyle = '#ff8a96'; g.fillText(`WALLET ${i + 1}`, 20, 40);
  g.font = '22px "JetBrains Mono", monospace'; g.fillStyle = '#e9f1ff'; g.fillText(addr.slice(0, 14) + '…' + addr.slice(-8), 20, 74);
  g.font = '22px "Pixelify Sans", sans-serif'; g.fillStyle = '#cfe0ff'; g.fillText(`${n} unspent coin${n === 1 ? '' : 's'} · ${btc(sum)} (flashing red in each node)`, 20, 108);
  p.tag.material.map.needsUpdate = true; p.tag.visible = true;
  log(`Wallet ${i + 1} (${addr.slice(0, 12)}…) controls ${n} unspent coin${n === 1 ? '' : 's'} worth ${btc(sum)}; they flash red in every node's state cube.`, 'gold');
}
const flashMat = new THREE.MeshLambertMaterial({ color: '#ff3b4e', emissive: '#a3001a' });
function applyFlash() {
  const f = V.flash, on = f && V.t < f.until;
  for (const n of NODES) for (const m of V.nodes[n.id].coins.values()) {
    const hit = on && m.userData.spk === f.spk;
    if (hit) { m.material = flashMat; m.scale.setScalar(Math.max(0.42, m.userData.size * 2) * (1 + 0.18 * Math.sin(V.t * 12))); }
    else if (m.material === flashMat || m.userData.flashed) { m.material = m.userData.mat; m.scale.setScalar(m.userData.size); }
    m.userData.flashed = hit;
  }
  V.people.forEach((p, i) => { const me = on && f.person === i; p.hood.color.set(me && Math.sin(V.t * 14) > -0.2 ? '#ff2e46' : p.hc); if (p.tag && p.tag.visible && !me) p.tag.visible = false; });
}
