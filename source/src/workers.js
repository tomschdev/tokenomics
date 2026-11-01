// ============================================================ the workshop: candidate block, worker, crank, cord, readouts
const CBS = 2.2;                                  // candidate block size
const CB_POS = new THREE.Vector3(-5.9, 1.45, 4.4);
const SPOT_FRONT = { p: new THREE.Vector3(-5.9, 0.25, 6.35), r: Math.PI };
const SPOT_CRANK = { p: new THREE.Vector3(-3.55, 0.25, 4.4), r: -Math.PI / 2 };
const HOLD_POS = new THREE.Vector3(-5.9, 1.9, 5.75);
function textSprite(w, h, sw, sh) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); s.scale.set(sw, sh, 1); s.renderOrder = 9; s.layers.set(1);
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
  const BTC = '#f7931a', SKIN = '#ffa45c'; // miners have orange skin, a shade lighter than their Bitcoin-orange vests
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
  const slab = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.4, 4.6), V.mat.stone); slab.position.set(-5.4, 0.05, 5.0); slab.userData.part = 'block'; g.add(slab);
  const cb = new THREE.Group(); cb.position.copy(CB_POS); cb.userData.part = 'block'; g.add(cb); v.fb = cb;
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
  const crank = new THREE.Group(); crank.position.set(CBS / 2, 0, 0); crank.userData.part = 'crank'; cb.add(crank);
  const steel = new THREE.MeshLambertMaterial({ color: '#b8bcc8' });
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.42, 8), steel); axle.rotation.z = Math.PI / 2; axle.position.x = 0.21; crank.add(axle);
  const armG = new THREE.Group(); armG.position.x = 0.42; crank.add(armG); v.crankArm = armG;
  const carm = new THREE.Mesh(V.geo.cube, steel); carm.scale.set(0.07, 0.6, 0.1); carm.position.y = 0.28; armG.add(carm);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 8), new THREE.MeshLambertMaterial({ color: n.color })); knob.rotation.z = Math.PI / 2; knob.position.set(0.15, 0.56, 0); armG.add(knob);
  // the cord: this block commits to the hash of the block below the tower (the previous block)
  const top = CB_POS.clone().add(new THREE.Vector3(0, CBS / 2, 0)), prev = v.towerBase.clone().add(new THREE.Vector3(0, -0.65, 0.66));
  const mid = top.clone().lerp(prev, 0.5).add(new THREE.Vector3(0, -1.4, 1.2));
  v.cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(top, mid, prev), 48, 0.035, 6), new THREE.MeshLambertMaterial({ color: '#ffcf3a', emissive: '#6a4a00' }));
  v.cord.visible = false; v.cord.userData.part = 'block'; g.add(v.cord);
  // readouts: the hash next to the block, and a vertical scale of leading zero bits with the target line
  v.hashSprite = textSprite(640, 150, 5.4, 1.27); v.hashSprite.position.set(-5.9, 3.45, 4.4); v.hashSprite.userData.part = 'crank'; g.add(v.hashSprite);
  v.scaleSprite = textSprite(170, 420, 1.0, 2.5); v.scaleSprite.position.set(-8.75, 1.75, 4.4); v.scaleSprite.userData.part = 'crank'; g.add(v.scaleSprite);
  v.worker = buildWorker(n); v.worker.root.userData.part = 'block'; g.add(v.worker.root); v.worker.root.position.copy(SPOT_FRONT.p); v.worker.root.rotation.y = SPOT_FRONT.r;
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
    fitText(g, 'PREV HASH', 128, 36, 232, '20px "Pixelify Sans", sans-serif', { lines: 1 }); fitText(g, '…' + prevShort, 128, 64, 232, '29px VT323, monospace', { lines: 1 });
    fitText(g, 'NONCE', 128, 112, 232, '22px "Pixelify Sans", sans-serif', { lines: 1 });
    fitText(g, String(n.stage === 'won' && n.lastWin ? n.lastWin.nonce : n.nonce), 128, 172, 232, 'bold 96px VT323, monospace', { lines: 1 });
    fitText(g, n.stage === 'won' ? 'PROVEN ✓' : `${t.chosen.length + 1} TXS INSIDE`, 128, 228, 232, '18px "Pixelify Sans", sans-serif', { lines: 1 });
  } else {
    fitText(g, { template: 'FILLING', verify: 'CHECKING', merkle: 'MERKLE ROOT', validate: 'NEW TIP' }[n.stage] || '', 128, 70, 232, '22px "Pixelify Sans", sans-serif', { lines: 1 });
    fitText(g, n.stage === 'merkle' ? t.merkle.slice(0, 6) : n.stage === 'verify' ? `${n.verified}/${t.chosen.length}` : `${Math.min(n.landed, t.chosen.length)}/${t.chosen.length}`, 128, 140, 232, 'bold 70px VT323, monospace', { lines: 1 });
    fitText(g, n.stage === 'merkle' ? 'TIED TO PREV BLOCK' : 'TRANSACTIONS', 128, 200, 232, '18px "Pixelify Sans", sans-serif', { lines: 1 });
  }
  v.faceTex.needsUpdate = true;
}
function drawHashReadout(n, v) {
  const show = (n.stage === 'hash' || n.stage === 'won') && v.lastHex;
  v.hashSprite.visible = show || V.t < (v.extraUntil || 0); v.scaleSprite.visible = n.stage === 'hash' || n.stage === 'won';
  const key = [v.lastHex, S.demoBits, n.stage, V.t < (v.extraUntil || 0)].join('|'); if (key === v.hashKey) return; v.hashKey = key;
  const c = v.hashSprite.userData.canvas, g = c.getContext('2d'); g.clearRect(0, 0, 640, 150);
  g.fillStyle = 'rgba(14,23,38,.88)'; g.fillRect(4, 4, 632, 142);
  if (V.t < (v.extraUntil || 0)) { g.fillStyle = '#ffe9a6'; fitText(g, 'NONCES 0–100 USED UP', 20, 46, 600, '24px "Pixelify Sans", sans-serif', { lines: 1 }); fitText(g, 'new extranonce in the coinbase → new merkle root → start again at 0', 20, 86, 600, '22px "Pixelify Sans", sans-serif', { lines: 2 }); v.hashSprite.material.map.needsUpdate = true; }
  if (show) {
    // the real double SHA-256 of the 80-byte header, printed the way block explorers show it
    const hx = v.lastHex, z = v.lastZ, hit = z >= S.demoBits, zh = hx.match(/^0*/)[0].length;
    g.fillStyle = '#9ab0cc'; fitText(g, `SHA-256d(HEADER) WITH NONCE ${v.lastNonce}`, 20, 30, 600, '20px "Pixelify Sans", sans-serif', { lines: 1 });
    g.font = '32px VT323, monospace';
    const line = (str, off, y) => { let x = 20; for (let i = 0; i < str.length; i++) { g.fillStyle = off + i < zh ? '#ffcf3a' : '#cfe0ff'; g.fillText(str[i], x, y); x += 18.5; } };
    line(hx.slice(0, 32), 0, 64); line(hx.slice(32), 32, 94);
    g.fillStyle = hit ? '#5fe07c' : '#ff8a96';
    fitText(g, `${z} LEADING ZERO BITS ${hit ? '≥' : '<'} TARGET ${S.demoBits} · ${hit ? 'HIT!' : 'WIND AGAIN'}`, 20, 130, 600, '20px "Pixelify Sans", sans-serif', { lines: 1 });
  }
  v.hashSprite.material.map.needsUpdate = true;
  // the scale: a column of zero-bit counts with the target line
  const sc = v.scaleSprite.userData.canvas, s = sc.getContext('2d'); const W = 170, H = 420, top = 54, bot = 380;
  const max = Math.max(S.demoBits + 3, 8), y = k => bot - (k / max) * (bot - top);
  s.clearRect(0, 0, W, H); s.fillStyle = 'rgba(14,23,38,.88)'; s.fillRect(4, 4, W - 8, H - 8);
  s.fillStyle = '#9ab0cc'; s.textAlign = 'center'; fitText(s, 'ZEROS', W / 2, 30, W - 20, '18px "Pixelify Sans", sans-serif', { lines: 1 });
  s.fillStyle = '#16243a'; s.fillRect(70, top, 40, bot - top);
  s.fillStyle = 'rgba(95,224,124,.22)'; s.fillRect(70, top, 40, y(S.demoBits) - top);
  const z = v.lastZ || 0, hit = z >= S.demoBits;
  if (v.lastHex) { s.fillStyle = hit ? '#5fe07c' : '#ff8a96'; s.fillRect(74, y(Math.min(z, max)), 32, bot - y(Math.min(z, max))); }
  s.font = '21px VT323, monospace'; s.textAlign = 'right';
  for (let k = 0; k <= max; k++) { s.fillStyle = k === S.demoBits ? '#5fe07c' : '#7f93b0'; s.fillText(String(k), 62, y(k) + 5); s.fillRect(64, y(k), 6, 2); }
  s.strokeStyle = '#5fe07c'; s.lineWidth = 4; s.beginPath(); s.moveTo(58, y(S.demoBits)); s.lineTo(122, y(S.demoBits)); s.stroke();
  s.textAlign = 'left'; s.fillStyle = '#5fe07c'; fitText(s, 'TARGET', 112, y(S.demoBits) - 6, W - 10 - 112, '14px "Pixelify Sans", sans-serif', { lines: 1 });
  v.scaleSprite.material.map.needsUpdate = true;
}
// dotted threads for this block's transactions in the state cube; each turns into a solid green strand once checked
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
    // checked threads: a thin solid green strand, a touch bolder than the coin-history threads, kept until the block is mined
    const parts = [], up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), m4 = new THREE.Matrix4(), one = new THREE.Vector3(1, 1, 1);
    for (let k = 0; k < checked.length; k += 2) {
      const a = checked[k], b = checked[k + 1], len = a.distanceTo(b); if (len < 1e-4) continue;
      const g = new THREE.CylinderGeometry(0.024, 0.024, len, 6, 1, true); g.deleteAttribute('uv');
      q.setFromUnitVectors(up, b.clone().sub(a).normalize()); g.applyMatrix4(m4.compose(a.clone().add(b).multiplyScalar(0.5), q, one)); parts.push(g);
    }
    if (parts.length) v.pend.add(new THREE.Mesh(SkyStyle.merge(parts), V.mat.threadChecked));
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
  const spot = atCrank ? SPOT_CRANK : SPOT_FRONT; w.root.userData.part = atCrank ? 'crank' : 'block'; // clicking the worker explains what it is doing
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

// ============================================================ whitepaper §5 board, suspended in the sky above the ring
const WP_STEPS = ['New transactions are broadcast to all nodes.', 'Each node collects new transactions into a block.', 'Each node works on finding a difficult proof-of-work for its block.',
  'When a node finds a proof-of-work, it broadcasts the block to all nodes.', 'Nodes accept the block only if all transactions in it are valid and not already spent.',
  "Nodes express their acceptance of the block by working on creating the next block in the chain, using the hash of the accepted block as the previous hash."];
const stepFlash = {}; const _wp = wp; wp = function (k) { _wp(k); stepFlash[k] = V.t || 0; };
const BOARD_W = 1024, BOARD_H = 840;
function buildStepsBoard() {
  const host = NODES[0]; const c = document.createElement('canvas'); c.width = BOARD_W; c.height = BOARD_H;
  const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false })); s.scale.set(22, 22 * BOARD_H / BOARD_W, 1); s.layers.set(1); s.renderOrder = 12;
  // home: on the axis the overview camera orbits around, so it hangs in the sky above the ring however far the view has turned
  s.position.set(0, 32, 0); s.userData.part = 'board'; s.userData.canvas = c; V.scene.add(s);
  const home = { pos: s.position.clone(), scale: s.scale.clone() };
  V.board = { s, c, t, host, key: '', acceptUntil: 0, home, goal: home };
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
// the step the board's node is on, from its stage (step 1 has no stage of its own: it happens whenever a wallet throws)
function stageStep(n) { return n.stage === 'validate' ? 5 : n.stage === 'won' ? 4 : n.stage === 'merkle' || n.stage === 'hash' ? 3 : V.board.acceptUntil > S.simTime ? 6 : 2; }
// one line for the board: what step k looks like right now at node x (h is the board's node)
function stepCaption(k, x, h) {
  const t = h.tpl, n = t ? t.chosen.length : 0;
  if (k === 1) return `A wallet throws a transaction to ${h.name}: ${h.mempool.size} waiting in its mempool`;
  if (k === 2) return h.stage === 'verify' ? `${h.name}'s worker checks transaction ${h.verified} of ${n} on the clipboard` : `${h.name}'s worker fills block #${fmt(t ? t.height : 0)}: ${Math.min(h.landed, n)} of ${n} transactions in`;
  if (k === 3) return h.stage === 'merkle' ? `${h.name} hashes ${n + 1} txids into the merkle root` : `${h.name}'s worker is cranking: nonce ${h.last ? h.last.nonce : h.nonce} of 0–100`;
  if (k === 4) { const b = h.lastWin; if (!b) return ''; const left = NODES.filter(o => o !== h && !o.known.has(b.hash)).length;
    return left ? `Block #${fmt(b.height)} is on its way to ${left} node${left > 1 ? 's' : ''}` : `Block #${fmt(b.height)} has reached all ${NODES.length - 1} other nodes`; }
  if (k === 5) { const c = x.lastChecks; return c ? `${x.name} checks block #${fmt(c.blk.height)} from ${c.blk.pool}: ${c.checks.filter(r => r.ok).length} of ${c.checks.length} checks pass` : `${x.name} checks the new block`; }
  if (k === 6) { const tip = BLOCKS.get(h.tip); return `${h.name} builds block #${fmt(t ? t.height : tip.height + 1)} on top of #${fmt(tip.height)}, the block it just accepted`; }
  return '';
}
function updateStepsBoard() {
  const B = V.board; if (!B) return; const n = B.host;
  if (n.stage === 'validate') B.acceptUntil = S.simTime + 4.5;
  updateFollow();
  B.s.position.lerp(B.goal.pos, 0.06); B.s.scale.lerp(B.goal.scale, 0.06); // glide between home and the follow-along spot
  // following: the lit step is the one on screen; otherwise every step the node is doing
  const on = FOLLOW.on ? new Set([FOLLOW.step]) : activeSteps(n);
  const cap = FOLLOW.on ? (FOLLOW.step ? stepCaption(FOLLOW.step, FOLLOW.node, n) : '') : stepCaption(stageStep(n), n, n);
  const flash = new Set(Object.keys(stepFlash).filter(k => V.t - stepFlash[k] < 1.2).map(Number));
  const key = [...on].join(',') + '|' + [...flash].join(',') + '|' + n.name + '|' + cap; if (key === B.key) return; B.key = key;
  const g = B.c.getContext('2d'); const W = BOARD_W, H = BOARD_H;
  g.clearRect(0, 0, W, H); g.fillStyle = 'rgba(20,32,52,.93)'; g.fillRect(0, 0, W, H); g.strokeStyle = '#2b4466'; g.lineWidth = 6; g.strokeRect(3, 3, W - 6, H - 6);
  // chains hanging the board from the sky
  g.fillStyle = '#9ab0cc'; g.textBaseline = 'top';
  fitText(g, 'WHITEPAPER §5 · NETWORK', 34, 30, W - 68, '34px "Pixelify Sans", sans-serif', { lines: 1 });
  g.fillStyle = '#9ab0cc'; fitText(g, `Live at ${n.name}: each step lights up as this node does it.`, 34, 80, W - 68, '24px "Pixelify Sans", sans-serif', { lines: 1 });
  const wrap = (txt, max) => { const words = txt.split(' '), lines = []; let cur = ''; for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (g.measureText(t2).width > max) { lines.push(cur); cur = w; } else cur = t2; } lines.push(cur); return lines; };
  let y = 128;
  WP_STEPS.forEach((txt, i) => {
    const k = i + 1, active = on.has(k), fl = flash.has(k);
    g.font = '27px "Pixelify Sans", sans-serif'; const lines = wrap(txt, W - 230); const h = 30 + lines.length * 34; // right gutter keeps 'NOW' clear of the text
    g.fillStyle = active ? '#3a3216' : fl ? '#26324a' : '#1b2d47'; g.fillRect(28, y, W - 56, h);
    if (active || fl) { g.strokeStyle = active ? '#ffcf3a' : '#7f93b0'; g.lineWidth = active ? 5 : 3; g.strokeRect(30, y + 2, W - 60, h - 4); }
    g.fillStyle = '#ffcf3a'; g.font = '28px "Pixelify Sans", sans-serif'; g.fillText(String(k), 56, y + 16);
    g.font = '27px "Pixelify Sans", sans-serif'; g.fillStyle = active ? '#fff6d6' : '#e9f1ff';
    lines.forEach((ln, j) => g.fillText(ln, 110, y + 15 + j * 34));
    if (active) { g.fillStyle = '#ffcf3a'; g.font = '20px "Pixelify Sans", sans-serif'; g.textAlign = 'right'; g.fillText('NOW', W - 50, y + 18); g.textAlign = 'left'; }
    y += h + 10;
  });
  // under the steps: what is on screen now, from live state
  g.fillStyle = '#2b4466'; g.fillRect(28, y + 2, W - 56, 3);
  g.fillStyle = '#ffe9a6'; fitText(g, cap, 34, y + 18, W - 68, '26px "Pixelify Sans", sans-serif', { lines: 2 });
  B.t.needsUpdate = true;
}

// ============================================================ follow along: the camera walks one node through the six steps
const FOLLOW = { on: false, pick: null, step: 0, node: null, since: -99, simSince: 0, oneTpl: null, thrower: 0, grab: false, prevHost: null };
const HOLD = 3.5; // real seconds each step stays on screen, however fast the simulation runs
const UP = new THREE.Vector3(0, 1, 0);
// per step: the action's centre and width in node-local units, and the camera's direction from it (+z faces the ring's centre)
const SHOTS = {
  2: { at: new THREE.Vector3(-3, 1.2, 4.8), span: 10, dir: new THREE.Vector3(0.15, 0.7, 1) },   // mempool and candidate block
  3: { at: new THREE.Vector3(-5.9, 2.2, 4.4), span: 8, dir: new THREE.Vector3(0.1, 0.35, 1) },  // worker, crank, hash readout
  5: { at: new THREE.Vector3(-5.9, 1.6, 5.9), span: 8, dir: new THREE.Vector3(-0.5, 0.5, 1) },  // worker checking the held block
  6: { at: new THREE.Vector3(-3.5, 4, 3), span: 15, dir: new THREE.Vector3(0.1, 0.45, 1) },     // newest block on the tower, new candidate block
};
function featuredNode() { return NODE[FOLLOW.pick] || NODES.reduce((a, b) => b.share > a.share ? b : a); }
function setHost(n) { if (V.board.host !== n) { V.board.host = n; V.board.acceptUntil = 0; } }
function startFollow() {
  if (FOLLOW.on) return;
  const pick = S.selected;
  if (D.open) closeNode(); // its panel would cover the action
  hideNote(); $('hint').hidden = true; $('bHelp').setAttribute('aria-expanded', 'false');
  Object.assign(FOLLOW, { on: true, pick, step: 0, node: null, since: -99, prevHost: V.board.host });
  S.selected = pick; setHost(featuredNode());
  V.follow = null; V.controls.autoRotate = false;
  $('bFollow').setAttribute('aria-pressed', 'true');
}
// clicking a node while following makes it the featured node
function followNode(id) { FOLLOW.pick = id; S.selected = id; setHost(NODE[id]); FOLLOW.step = 0; FOLLOW.since = -99; }
function stopFollow() {
  if (!FOLLOW.on) return;
  FOLLOW.on = false; FOLLOW.grab = false;
  setHost(FOLLOW.prevHost); V.board.goal = V.board.home;
  for (const n of NODES) V.nodes[n.id].label.visible = true;
  if (!D.open) S.selected = null;
  V.camGoal = null; // the camera is the user's again
  $('bFollow').setAttribute('aria-pressed', 'false');
}
// the step to show for the featured node h, and the node that shows it
function liveStep(h) {
  const k = stageStep(h);
  // h found a block while the crank was still on screen: show it leaving anyway (one step behind at most)
  if (FOLLOW.step === 3 && k !== 4 && h.lastWin && h.lastWin.foundAt >= FOLLOW.simSince) return { k: 4, node: h };
  // h's block has left: show a node that received it checking it, while one still is
  const peer = (k === 2 || k === 6) && FOLLOW.step === 4 && h.lastWin && NODES.find(x => x !== h && x.stage === 'validate' && x.lastChecks && x.lastChecks.blk === h.lastWin);
  if (peer) return { k: 5, node: peer };
  // a wallet's transaction is flying to h: show it once per block template, without cutting into a block being found or checked
  const calm = k === 2 || (k === FOLLOW.step && (k === 3 || k === 6));
  const fly = calm && FOLLOW.oneTpl !== h.tpl.id && particles.find(p => p.k === 'wallet' && p.to === h && p.t1 - S.simTime > 0.5);
  if (fly) return { k: 1, node: h, thrower: V.throwers.get(fly.payload.txid) || 0 };
  return { k, node: h };
}
function updateFollow() {
  if (!FOLLOW.on) return;
  const h = V.board.host;
  // hold each step, then jump straight to wherever the node is now (never replay a backlog)
  if (V.t - FOLLOW.since >= HOLD) {
    const live = liveStep(h);
    if (live.k !== FOLLOW.step || live.node !== FOLLOW.node) {
      Object.assign(FOLLOW, { step: live.k, node: live.node, since: V.t, simSince: S.simTime });
      if (live.k === 1) { FOLLOW.oneTpl = h.tpl.id; FOLLOW.thrower = live.thrower; }
      frameStep();
    }
  }
  // declutter: only the nodes in this step keep their pill or card
  const inv = FOLLOW.step === 4 ? NODES : [h, FOLLOW.node];
  for (const n of NODES) V.nodes[n.id].label.visible = inv.includes(n);
}
function frameStep() {
  const h = V.board.host, x = FOLLOW.node, k = FOLLOW.step, vh = V.nodes[h.id];
  if (k === 1) { // the wallet platform and the transaction's arc to h's mempool, seen from the side the people face
    const a = personHand(FOLLOW.thrower), b = worldOf(h, vh.poolCenter), d = a.distanceTo(b);
    const act = a.clone().lerp(b, 0.45).add(new THREE.Vector3(0, (9 + d * 0.12) * 0.35, 0));
    const side = b.clone().sub(a).cross(UP).setY(0).normalize(); if (side.z < 0) side.negate();
    return frameShot(act, d * 1.1 + 8, side.add(new THREE.Vector3(0, 0.55, 0)));
  }
  if (k === 4) { // a wide shot from high behind h: the block flies off towards the other nodes
    const out = vh.group.position.clone().setY(0).normalize();
    return frameShot(out.clone().multiplyScalar(RING * 0.3).add(new THREE.Vector3(0, 4, 0)), 46, out.multiplyScalar(0.8).add(UP.clone().multiplyScalar(0.8)));
  }
  const s = SHOTS[k];
  frameShot(worldOf(x, s.at), s.span, s.dir.clone().applyQuaternion(V.nodes[x.id].group.quaternion));
}
// aim the camera so the action sits left of centre and park the board beside it on the right (below it on a narrow canvas)
function frameShot(act, span, dir) {
  const cam = V.camera, tv = Math.tan(cam.fov * Math.PI / 360), th = tv * cam.aspect, wide = cam.aspect > 1.3;
  const dist = Math.min(78, Math.max(9, span / ((wide ? 0.9 : 1.7) * th)));
  const back = dir.clone().normalize(), right = UP.clone().cross(back).normalize(), up = back.clone().cross(right);
  const hw = dist * th, hh = dist * tv;
  const target = wide ? act.clone().addScaledVector(right, 0.45 * hw) : act.clone().addScaledVector(up, -0.45 * hh);
  const bw = (wide ? 0.7 : 1.1) * hw;
  const pos = wide ? target.clone().addScaledVector(right, 0.55 * hw) : target.clone().addScaledVector(up, -0.4 * hh);
  V.camGoal = { pos: target.clone().addScaledVector(back, dist), target };
  V.board.goal = { pos, scale: new THREE.Vector3(bw, bw * BOARD_H / BOARD_W, 1) };
}

// ============================================================ the wallet platform: people throwing their transactions to the pools
const PLAT_POS = new THREE.Vector3(0, 3.5, -33);
const HOODIES = ['#d33b3b', '#2f9a44', '#2e63c9', '#e6c229', '#c44fb0', '#3fb7b0', '#e07b2a', '#7d5cff', '#e8e8ee', '#2b2b33', '#9be14f', '#ff7a9c'];
// Twelve wallet owners, twelve characters. Each wears its wallet colour (the `hood` material) on its biggest garment,
// so the coin colours still match and the click-to-flash still reads.
const PERSON_TYPES = ['civilian', 'dog', 'robot', 'wizard', 'gorilla', 'alien', 'astronaut', 'knight', 'businessman', 'pirate', 'football', 'chef'];
const PERSON_GEO = {};
function buildPerson(i) {
  const hc = HOODIES[i % 12], root = new THREE.Group(); const hood = new THREE.MeshLambertMaterial({ color: hc });
  const mats = {}, L = c => typeof c !== 'string' ? c : (mats[c] || (mats[c] = new THREE.MeshLambertMaterial({ color: c })));
  const glow = c => mats['g' + c] || (mats['g' + c] = new THREE.MeshBasicMaterial({ color: c }));
  const shade = k => new THREE.MeshLambertMaterial({ color: new THREE.Color(hc).multiplyScalar(k) });
  const rgeo = (w, h, d, r) => { const k = [w, h, d, r].join(); return PERSON_GEO[k] || (PERSON_GEO[k] = SkyStyle.roundedBox(w, h, d, Math.min(r, w / 2, h / 2, d / 2), 1)); };
  const sph = PERSON_GEO.sph || (PERSON_GEO.sph = new THREE.SphereGeometry(1, 16, 12));
  const put = (p, o, x, y, z) => { o.position.set(x, y, z); p.add(o); return o; };
  const rb = (p, w, h, d, m, x, y, z, r = 0.05) => put(p, new THREE.Mesh(rgeo(w, h, d, r), L(m)), x, y, z);
  const sp = (p, r, m, x, y, z, sx = 1, sy = 1, sz = 1) => { const o = put(p, new THREE.Mesh(sph, L(m)), x, y, z); o.scale.set(r * sx, r * sy, r * sz); return o; };
  const cy = (p, r0, r1, h, m, x, y, z, seg = 12) => put(p, new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), L(m)), x, y, z);
  const pair = f => { f(-1); f(1); };
  const arm = (x, sleeve, hand, w = 0.15, round = false) => {
    const g = new THREE.Group(); g.position.set(x, 1.16, 0);
    rb(g, w, 0.5, w + 0.01, sleeve, 0, -0.23, 0, 0.06);
    if (hand) round ? sp(g, 0.075, hand, 0, -0.52, 0) : rb(g, 0.13, 0.13, 0.13, hand, 0, -0.52, 0, 0.05);
    root.add(g); return g;
  };
  const eyes = (p, y, z, dx = 0.08, col = '#1b1b22', w = 0.05, h = 0.06) => pair(s => { rb(p, w, h, 0.02, col, s * dx, y, z, 0.015); rb(p, 0.018, 0.018, 0.01, '#ffffff', s * dx + 0.012, y + 0.015, z + 0.012, 0.005); });
  const legs = (pants, shoe, w = 0.19) => pair(s => { rb(root, w + 0.01, 0.1, 0.28, shoe, s * 0.12, 0.05, 0.03); rb(root, w, 0.52, w + 0.02, pants, s * 0.12, 0.36, 0); });
  const headSkin = (skin, y = 1.45) => rb(root, 0.36, 0.38, 0.34, skin, 0, y, 0.01, 0.1);
  const type = PERSON_TYPES[i % PERSON_TYPES.length];
  let armL, armR, tail = null, keyAt = [0, -0.62, 0.1], walletAt = [0, -0.66, 0.1];
  const skin = '#f0c29a';
  if (type === 'civilian') {
    const brown = '#6e4532', hair = '#17110d';
    legs('#34507a', '#f2f2f2');
    rb(root, 0.56, 0.64, 0.34, hood, 0, 0.92, 0, 0.09);                     // hoodie
    rb(root, 0.26, 0.13, 0.02, shade(0.75), 0, 0.8, 0.175, 0.02);          // pocket
    pair(s => rb(root, 0.02, 0.15, 0.02, '#f2f2f2', s * 0.06, 1.1, 0.18, 0.008)); // drawstrings
    rb(root, 0.44, 0.18, 0.2, hood, 0, 1.26, -0.12, 0.08);                  // hood bunched behind the neck
    headSkin(brown);
    rb(root, 0.38, 0.07, 0.36, hair, 0, 1.645, -0.005, 0.03); rb(root, 0.38, 0.13, 0.06, hair, 0, 1.585, -0.155, 0.025); // close-cropped hair
    pair(s => rb(root, 0.08, 0.07, 0.015, '#f4efe8', s * 0.08, 1.47, 0.172, 0.01)); // eye whites
    eyes(root, 1.47, 0.18, 0.08, '#1b1b22', 0.045, 0.055); rb(root, 0.1, 0.025, 0.02, '#3e2219', 0, 1.37, 0.18, 0.008);
    armL = arm(-0.34, hood, brown); armR = arm(0.34, hood, brown);
  } else if (type === 'dog') {
    // on all fours: the head is the throwing "arm" (the wallet rides in its mouth), the collar holds the key
    const fur = '#c99256', dark = '#8a5a2e', light = '#f1dcc0';
    for (const [x, z] of [[-0.14, 0.27], [0.14, 0.27], [-0.14, -0.27], [0.14, -0.27]]) { rb(root, 0.13, 0.42, 0.14, fur, x, 0.23, z, 0.05); rb(root, 0.15, 0.08, 0.18, dark, x, 0.04, z + 0.02, 0.03); }
    rb(root, 0.42, 0.34, 0.78, fur, 0, 0.58, 0, 0.12);                     // body
    rb(root, 0.46, 0.26, 0.5, hood, 0, 0.64, 0.02, 0.08);                   // vest
    rb(root, 0.3, 0.08, 0.36, light, 0, 0.42, 0.05, 0.04);                  // belly
    tail = new THREE.Group(); tail.position.set(0, 0.68, -0.38); root.add(tail);
    const t = rb(tail, 0.08, 0.34, 0.08, fur, 0, 0.14, -0.04, 0.04); t.rotation.x = -0.5;
    armL = new THREE.Group(); armL.position.set(0, 0.74, 0.36); root.add(armL);   // collar
    cy(armL, 0.15, 0.17, 0.07, '#2b2b33', 0, 0, 0, 14);
    keyAt = [0, -0.13, 0.12];
    armR = new THREE.Group(); armR.position.set(0, 0.8, 0.4); root.add(armR);     // neck pivot
    rb(armR, 0.38, 0.36, 0.36, fur, 0, 0.16, 0.08, 0.11);
    rb(armR, 0.22, 0.15, 0.2, light, 0, 0.08, 0.3, 0.06); rb(armR, 0.09, 0.07, 0.06, '#1b1b22', 0, 0.14, 0.4, 0.025);
    eyes(armR, 0.23, 0.265, 0.1);
    pair(s => { const e = rb(armR, 0.1, 0.28, 0.14, dark, s * 0.21, 0.13, 0.05, 0.05); e.rotation.z = s * 0.28; });
    walletAt = [0, 0.02, 0.42];
  } else if (type === 'robot') {
    const metal = '#b7c0cc', dark = '#5a6473';
    pair(s => { rb(root, 0.22, 0.1, 0.3, dark, s * 0.12, 0.05, 0.03); cy(root, 0.07, 0.08, 0.5, metal, s * 0.12, 0.35, 0); sp(root, 0.08, dark, s * 0.12, 0.4, 0.02); });
    rb(root, 0.4, 0.12, 0.28, dark, 0, 0.64, 0);
    rb(root, 0.56, 0.58, 0.36, hood, 0, 0.98, 0, 0.06);                     // painted chest plate
    rb(root, 0.3, 0.2, 0.02, '#1b2433', 0, 1.02, 0.185, 0.02);
    [['#5fe07c', -0.08], ['#ffcf3a', 0], ['#57e4ff', 0.08]].forEach(([c, x]) => rb(root, 0.045, 0.045, 0.02, glow(c), x, 1.05, 0.197, 0.01));
    cy(root, 0.06, 0.07, 0.08, dark, 0, 1.3, 0);
    rb(root, 0.42, 0.34, 0.36, metal, 0, 1.47, 0, 0.06);
    rb(root, 0.34, 0.12, 0.02, '#141a24', 0, 1.49, 0.185, 0.02);
    pair(s => { rb(root, 0.08, 0.045, 0.02, glow('#57e4ff'), s * 0.08, 1.49, 0.196, 0.01); const b = cy(root, 0.05, 0.05, 0.06, dark, s * 0.23, 1.47, 0); b.rotation.z = Math.PI / 2; });
    cy(root, 0.014, 0.014, 0.18, dark, 0, 1.72, 0, 6); sp(root, 0.045, hood, 0, 1.82, 0);
    pair(s => sp(root, 0.09, dark, s * 0.34, 1.18, 0));
    armL = arm(-0.36, metal, dark); armR = arm(0.36, metal, dark);
  } else if (type === 'wizard') {
    const beard = '#ecebf2', gold = '#e6b23a';
    pair(s => rb(root, 0.14, 0.08, 0.2, '#3a2a20', s * 0.1, 0.04, 0.2, 0.03));
    cy(root, 0.24, 0.37, 1.2, hood, 0, 0.6, 0, 14);                         // robe
    cy(root, 0.375, 0.375, 0.05, shade(0.7), 0, 0.03, 0, 14);
    cy(root, 0.29, 0.3, 0.06, gold, 0, 0.84, 0, 14);                         // belt
    rb(root, 0.54, 0.22, 0.36, hood, 0, 1.13, 0, 0.1);                       // shoulders
    rb(root, 0.32, 0.34, 0.32, skin, 0, 1.42, 0, 0.09);
    rb(root, 0.3, 0.26, 0.12, beard, 0, 1.28, 0.14, 0.06); rb(root, 0.16, 0.16, 0.1, beard, 0, 1.12, 0.16, 0.05);
    eyes(root, 1.46, 0.165, 0.07); pair(s => rb(root, 0.09, 0.03, 0.02, beard, s * 0.07, 1.51, 0.165, 0.01));
    cy(root, 0.33, 0.33, 0.04, hood, 0, 1.6, 0, 16); cy(root, 0.205, 0.215, 0.06, gold, 0, 1.65, 0, 14);
    const cone = put(root, new THREE.Mesh(new THREE.ConeGeometry(0.21, 0.58, 14), hood), 0.03, 1.9, -0.02); cone.rotation.z = -0.18;
    rb(root, 0.06, 0.06, 0.02, glow('#ffe27a'), 0.02, 1.8, 0.16, 0.01);
    const staff = new THREE.Group(); staff.position.set(0.16, 1.0, -0.26); staff.rotation.z = 0.35; root.add(staff);
    cy(staff, 0.025, 0.03, 1.6, '#7a5236', 0, 0, 0, 6);
    const crystal = put(staff, new THREE.Mesh(new THREE.OctahedronGeometry(0.09), glow('#8ff0ff')), 0, 0.86, 0); crystal.scale.y = 1.5;
    armL = arm(-0.33, hood, skin, 0.17); armR = arm(0.33, hood, skin, 0.17);
  } else if (type === 'gorilla') {
    const fur = '#3b3940', face = '#5a5562', muzzle = '#6d6876';
    pair(s => { rb(root, 0.22, 0.1, 0.28, face, s * 0.13, 0.05, 0.04); rb(root, 0.22, 0.42, 0.24, fur, s * 0.13, 0.29, 0, 0.07); });
    rb(root, 0.72, 0.62, 0.44, fur, 0, 0.86, 0, 0.14);
    rb(root, 0.66, 0.42, 0.47, hood, 0, 0.82, 0, 0.1);                      // tank top
    pair(s => sp(root, 0.2, fur, s * 0.36, 1.12, 0));
    rb(root, 0.42, 0.38, 0.38, fur, 0, 1.38, 0.06, 0.12); rb(root, 0.22, 0.1, 0.26, fur, 0, 1.58, 0.02, 0.05);
    rb(root, 0.38, 0.08, 0.1, fur, 0, 1.48, 0.22, 0.04);                     // brow
    rb(root, 0.3, 0.24, 0.04, face, 0, 1.38, 0.245, 0.03);
    rb(root, 0.26, 0.14, 0.08, muzzle, 0, 1.29, 0.27, 0.04);
    pair(s => { rb(root, 0.03, 0.025, 0.01, '#1b1b22', s * 0.04, 1.32, 0.312, 0.008); sp(root, 0.05, face, s * 0.22, 1.38, 0.04); });
    eyes(root, 1.42, 0.27, 0.075, '#2a1a10', 0.05, 0.04);
    armL = arm(-0.44, fur, face, 0.21); armR = arm(0.44, fur, face, 0.21);
  } else if (type === 'alien') {
    const askin = '#8fe07a', silver = '#cfd6e0';
    pair(s => { rb(root, 0.16, 0.1, 0.24, silver, s * 0.1, 0.05, 0.03); rb(root, 0.13, 0.5, 0.15, hood, s * 0.1, 0.35, 0); });
    rb(root, 0.44, 0.58, 0.3, hood, 0, 0.9, 0, 0.1);                         // jumpsuit
    rb(root, 0.46, 0.06, 0.32, silver, 0, 0.66, 0, 0.02); rb(root, 0.3, 0.06, 0.22, silver, 0, 1.2, 0, 0.02);
    const emb = cy(root, 0.06, 0.06, 0.02, glow('#d6ff6b'), 0, 1.02, 0.155, 14); emb.rotation.x = Math.PI / 2;
    cy(root, 0.055, 0.06, 0.12, askin, 0, 1.27, 0);
    sp(root, 0.27, askin, 0, 1.52, 0, 1, 1.05, 0.95); sp(root, 0.16, askin, 0, 1.37, 0.04);
    pair(s => { const e = sp(root, 0.085, '#121318', s * 0.1, 1.5, 0.215, 1.15, 0.65, 0.4); e.rotation.z = s * 0.45;
      const a = cy(root, 0.012, 0.012, 0.24, '#3f8a3c', s * 0.1, 1.86, 0, 6); a.rotation.z = -s * 0.3; sp(root, 0.042, glow('#d6ff6b'), s * 0.135, 1.98, 0); });
    rb(root, 0.06, 0.015, 0.01, '#2d5a2a', 0, 1.33, 0.19, 0.005);
    armL = arm(-0.29, hood, askin, 0.12, true); armR = arm(0.29, hood, askin, 0.12, true);
  } else if (type === 'astronaut') {
    const suit = '#eef1f5', grey = '#9aa3ad';
    pair(s => { rb(root, 0.22, 0.14, 0.3, grey, s * 0.12, 0.07, 0.03); rb(root, 0.22, 0.5, 0.24, suit, s * 0.12, 0.38, 0, 0.07); rb(root, 0.225, 0.06, 0.245, hood, s * 0.12, 0.5, 0, 0.02); });
    rb(root, 0.6, 0.64, 0.38, suit, 0, 0.94, 0, 0.1);
    rb(root, 0.3, 0.2, 0.04, hood, 0, 1.0, 0.2, 0.03);                       // chest panel
    [['#ff5468', -0.08], ['#5fe07c', 0], ['#57e4ff', 0.08]].forEach(([c, x]) => rb(root, 0.04, 0.04, 0.02, glow(c), x, 1.02, 0.222, 0.01));
    rb(root, 0.5, 0.6, 0.22, hood, 0, 1.0, -0.29, 0.07);                     // backpack
    pair(s => rb(root, 0.08, 0.3, 0.04, grey, s * 0.12, 1.0, -0.4, 0.02));
    cy(root, 0.2, 0.2, 0.06, grey, 0, 1.27, 0, 16);
    sp(root, 0.28, suit, 0, 1.5, 0);
    sp(root, 0.22, new THREE.MeshLambertMaterial({ color: '#1d2b4a', emissive: '#0d1730' }), 0, 1.49, 0.1, 1, 0.8, 0.75);
    rb(root, 0.05, 0.03, 0.02, glow('#ffffff'), -0.08, 1.56, 0.255, 0.01);
    armL = arm(-0.36, suit, grey, 0.17); armR = arm(0.36, suit, grey, 0.17);
  } else if (type === 'knight') {
    const steel = new THREE.MeshStandardMaterial({ color: '#dfe4ec', metalness: 0.55, roughness: 0.32, emissive: '#2a2f38' });
    const dark = '#6b7380', gold = '#e6b23a';
    pair(s => { rb(root, 0.22, 0.12, 0.3, steel, s * 0.12, 0.06, 0.03); rb(root, 0.2, 0.5, 0.22, steel, s * 0.12, 0.37, 0, 0.07); sp(root, 0.075, dark, s * 0.12, 0.42, 0.1); });
    rb(root, 0.58, 0.64, 0.38, steel, 0, 0.94, 0, 0.1);                      // breastplate
    rb(root, 0.44, 0.6, 0.02, hood, 0, 0.86, 0.195, 0.02);                   // tabard
    rb(root, 0.06, 0.3, 0.01, gold, 0, 0.92, 0.208, 0.005); rb(root, 0.2, 0.06, 0.01, gold, 0, 0.98, 0.208, 0.005); // cross
    rb(root, 0.6, 0.06, 0.4, dark, 0, 0.64, 0, 0.02);                        // belt
    pair(s => sp(root, 0.15, steel, s * 0.33, 1.2, 0, 1.1, 0.75, 1.1));      // pauldrons
    rb(root, 0.4, 0.42, 0.38, steel, 0, 1.48, 0.0, 0.11);                     // great helm
    rb(root, 0.3, 0.035, 0.02, '#14161b', 0, 1.5, 0.195, 0.01);              // visor slit
    rb(root, 0.035, 0.18, 0.02, '#14161b', 0, 1.4, 0.195, 0.01);
    rb(root, 0.42, 0.04, 0.4, gold, 0, 1.6, 0, 0.02);                         // crown band
    const plume = new THREE.Group(); plume.position.set(0, 1.7, -0.05); root.add(plume);
    [[0, 0.06, 0.08, 0], [0, 0.14, -0.02, -0.4], [0, 0.18, -0.13, -0.8]].forEach(([x, y, z, r]) => { const f = sp(plume, 0.09, hood, x, y, z, 0.8, 1.3, 1); f.rotation.x = r; });
    armL = arm(-0.36, steel, dark, 0.16); armR = arm(0.36, steel, dark, 0.16);
  } else if (type === 'businessman') {
    const shirt = '#f4f6fa', slacks = '#2c3140';
    legs(slacks, '#1b1b22', 0.18);
    rb(root, 0.54, 0.66, 0.34, hood, 0, 0.92, 0, 0.07);                      // suit jacket
    rb(root, 0.16, 0.3, 0.02, shirt, 0, 1.08, 0.172, 0.01);                  // shirt front
    rb(root, 0.06, 0.26, 0.02, '#8a1f2b', 0, 1.06, 0.183, 0.01); rb(root, 0.08, 0.06, 0.02, '#8a1f2b', 0, 1.2, 0.184, 0.01); // tie
    pair(s => { const lp = rb(root, 0.07, 0.3, 0.02, shade(0.8), s * 0.11, 1.07, 0.18, 0.01); lp.rotation.z = s * 0.25; });
    rb(root, 0.08, 0.04, 0.02, shirt, 0.17, 1.02, 0.176, 0.01);             // pocket square
    [0.86, 0.76].forEach(y => rb(root, 0.035, 0.035, 0.02, '#1b1b22', 0, y, 0.18, 0.01));
    headSkin(skin);
    rb(root, 0.38, 0.1, 0.36, '#2a2420', 0, 1.62, -0.01, 0.04); rb(root, 0.38, 0.16, 0.08, '#2a2420', 0, 1.55, -0.15, 0.03);
    rb(root, 0.16, 0.05, 0.05, '#2a2420', -0.08, 1.645, 0.12, 0.02);        // side parting
    eyes(root, 1.47, 0.18); rb(root, 0.12, 0.025, 0.02, '#a0523d', 0, 1.37, 0.18, 0.008);
    armL = arm(-0.33, hood, skin); armR = arm(0.33, hood, skin);
    pair(s => rb(root, 0.12, 0.04, 0.12, shirt, s * 0.33, 0.68, 0, 0.01));  // cuffs under the jacket sleeves
  } else if (type === 'pirate') {
    const shirtA = '#f2efe6', shirtB = '#b8303a', boots = '#2a1d16';
    pair(s => { rb(root, 0.2, 0.22, 0.28, boots, s * 0.12, 0.11, 0.03); rb(root, 0.19, 0.4, 0.21, '#3b3550', s * 0.12, 0.42, 0); });
    rb(root, 0.5, 0.6, 0.32, shirtA, 0, 0.92, 0.01, 0.08);
    [0.78, 0.92, 1.06].forEach(y => rb(root, 0.505, 0.05, 0.325, shirtB, 0, y, 0.01, 0.02)); // stripes
    rb(root, 0.6, 0.74, 0.36, hood, 0, 0.88, -0.03, 0.08);                   // long coat (open at the front)
    rb(root, 0.22, 0.74, 0.02, shirtA, 0, 0.88, 0.15, 0.01);
    rb(root, 0.62, 0.07, 0.38, '#3a2a20', 0, 0.68, -0.02, 0.02); rb(root, 0.09, 0.08, 0.02, '#e6b23a', 0, 0.68, 0.17, 0.01);
    headSkin('#e2b08a');
    rb(root, 0.3, 0.14, 0.08, '#4a2f1d', 0, 1.31, 0.16, 0.04);               // beard
    rb(root, 0.06, 0.06, 0.02, '#1b1b22', 0.08, 1.47, 0.18, 0.015); rb(root, 0.018, 0.018, 0.01, '#ffffff', 0.092, 1.485, 0.192, 0.005);
    rb(root, 0.08, 0.07, 0.02, '#14161b', -0.08, 1.47, 0.185, 0.015); const strap = rb(root, 0.4, 0.025, 0.36, '#14161b', 0, 1.52, 0.01, 0.01); strap.rotation.z = 0.35;
    rb(root, 0.52, 0.06, 0.46, '#1d1a22', 0, 1.65, 0, 0.03);                 // tricorn brim
    rb(root, 0.36, 0.16, 0.32, '#1d1a22', 0, 1.74, -0.02, 0.06);
    pair(s => { const flap = rb(root, 0.06, 0.16, 0.36, '#1d1a22', s * 0.24, 1.72, 0, 0.03); flap.rotation.z = s * 0.4; });
    rb(root, 0.53, 0.025, 0.47, '#e6b23a', 0, 1.685, 0, 0.01);
    armL = arm(-0.36, hood, '#e2b08a', 0.16); armR = arm(0.36, hood, '#e2b08a', 0.16);
  } else if (type === 'football') {
    const pants = '#e8e8ee', face = '#c99a74';
    pair(s => { rb(root, 0.21, 0.1, 0.3, '#1b1b22', s * 0.12, 0.05, 0.04); rb(root, 0.19, 0.22, 0.21, hood, s * 0.12, 0.2, 0, 0.05); rb(root, 0.21, 0.32, 0.23, pants, s * 0.12, 0.46, 0, 0.07); rb(root, 0.03, 0.32, 0.235, hood, s * 0.225, 0.46, 0, 0.01); });
    rb(root, 0.6, 0.6, 0.38, hood, 0, 0.9, 0, 0.09);                          // jersey
    rb(root, 0.82, 0.18, 0.46, hood, 0, 1.18, 0, 0.08);                       // shoulder pads
    pair(s => rb(root, 0.06, 0.18, 0.47, '#f4f6fa', s * 0.3, 1.18, 0, 0.02)); // pad stripes
    // jersey number 8, in white blocks
    [[0, 1.06, 0.1, 0.03], [0, 0.95, 0.1, 0.03], [0, 0.84, 0.1, 0.03], [-0.05, 1.005, 0.03, 0.09], [0.05, 1.005, 0.03, 0.09], [-0.05, 0.895, 0.03, 0.09], [0.05, 0.895, 0.03, 0.09]]
      .forEach(([x, y, w, h]) => rb(root, w, h, 0.02, '#f4f6fa', x, y, 0.195, 0.005));
    rb(root, 0.3, 0.3, 0.3, face, 0, 1.42, 0.05, 0.08);
    sp(root, 0.26, hood, 0, 1.52, -0.08);                          // helmet
    rb(root, 0.06, 0.32, 0.06, '#f4f6fa', 0, 1.66, -0.1, 0.03).rotation.x = -0.3;  // centre stripe
    pair(s => rb(root, 0.02, 0.08, 0.06, '#e8e8ee', s * 0.26, 1.48, -0.06, 0.01)); // ear holes
    eyes(root, 1.46, 0.205, 0.07);
    [1.4, 1.34].forEach(y => rb(root, 0.34, 0.025, 0.025, '#9aa3ad', 0, y, 0.24, 0.01)); // face mask bars
    rb(root, 0.025, 0.12, 0.025, '#9aa3ad', 0, 1.37, 0.245, 0.01);
    armL = arm(-0.42, hood, face, 0.17); armR = arm(0.42, hood, face, 0.17);
  } else {                                                                     // chef
    const white = '#f6f7fa', check = '#4a4f5c';
    legs(check, '#1b1b22');
    rb(root, 0.56, 0.66, 0.34, white, 0, 0.92, 0, 0.08);                     // chef jacket
    rb(root, 0.46, 0.6, 0.02, hood, 0, 0.82, 0.175, 0.02);                   // apron
    rb(root, 0.5, 0.04, 0.36, hood, 0, 0.98, 0, 0.01);                        // apron ties
    [1.05, 0.96].forEach(y => pair(s => rb(root, 0.035, 0.035, 0.02, '#c9ccd6', s * 0.12, y + 0.1, 0.178, 0.01)));
    rb(root, 0.24, 0.06, 0.24, hood, 0, 1.26, 0.04, 0.02);                    // neckerchief
    headSkin(skin);
    pair(s => { const m = rb(root, 0.11, 0.04, 0.03, '#4a2f1d', s * 0.06, 1.395, 0.185, 0.015); m.rotation.z = -s * 0.25; }); // moustache
    eyes(root, 1.48, 0.18);
    cy(root, 0.19, 0.19, 0.1, white, 0, 1.66, 0, 14);
    sp(root, 0.2, white, -0.08, 1.86, 0, 1, 0.85, 1); sp(root, 0.2, white, 0.08, 1.86, 0.02, 1, 0.85, 1); sp(root, 0.19, white, 0, 1.9, -0.06, 1, 0.85, 1); // toque
    armL = arm(-0.34, white, skin); armR = arm(0.34, white, skin);
  }
  // the private key in the left hand
  const key = new THREE.Group(); key.position.set(...keyAt); armL.add(key);
  const gold = new THREE.MeshLambertMaterial({ color: '#ffcf3a', emissive: '#7a5a00' });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.028, 6, 14), gold); ring.position.y = 0.02; key.add(ring);
  const shaft = new THREE.Mesh(V.geo.cube, gold); shaft.scale.set(0.035, 0.035, 0.26); shaft.position.set(0, 0.02, 0.2); key.add(shaft);
  for (const z of [0.26, 0.32]) { const tooth = new THREE.Mesh(V.geo.cube, gold); tooth.scale.set(0.03, 0.07, 0.035); tooth.position.set(0, -0.025, z); key.add(tooth); }
  // the wallet in the right hand (the throwing hand), same colour family as the owner's colour
  const wallet = new THREE.Group(); wallet.position.set(...walletAt); armR.add(wallet);
  rb(wallet, 0.32, 0.08, 0.24, shade(0.85), 0, 0, 0, 0.025);
  rb(wallet, 0.32, 0.03, 0.12, shade(0.65), 0, 0.05, -0.06, 0.01);
  rb(wallet, 0.07, 0.05, 0.05, '#ffcf3a', 0.16, 0.02, 0, 0.01);
  root.userData.personIdx = i;
  return { root, armL, armR, key, wallet, hood, hc, tail, kind: type, throwAt: -9, phase: Math.random() * 6 };
}
function buildUserPlatform() {
  const g = new THREE.Group(); g.position.copy(PLAT_POS); g.userData.part = 'wallets'; V.scene.add(g); V.plat = g;
  const concrete = new THREE.MeshLambertMaterial({ color: '#9aa3ad' });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(36, 0.8, 5.2), concrete); slab.position.y = -0.4; g.add(slab);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(36, 0.06, 0.35), new THREE.MeshLambertMaterial({ color: '#ffd23d' })); edge.position.set(0, 0.03, 2.2); g.add(edge);
  buildIsland(g, -19, 19, -4, 4, -0.8, 7, [{ x: -18.2, z: -3.2, kind: 'tree', h: 1.2, s: 1.5 }, { x: 18.1, z: -3.0, kind: 'tree', h: 1.1, s: 1.4 }, { x: -18.0, z: 3.0, kind: 'tuft', s: 1.2 }, { x: 18.2, z: 3.1, kind: 'tuft', s: 1.2 }]);
  for (let k = 0; k < 7; k++) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 4, 6), new THREE.MeshLambertMaterial({ color: '#4b5568' })); post.position.set(-16.5 + k * 5.5, 2, -2.1); g.add(post); }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(36, 0.25, 3.4), new THREE.MeshLambertMaterial({ color: '#3a4150' })); roof.position.set(0, 4.1, -1.0); roof.rotation.x = 0.08; g.add(roof);
  for (const x of [-12, 0, 12]) { const bench = new THREE.Mesh(V.geo.cube, new THREE.MeshLambertMaterial({ color: '#8a5a32' })); bench.scale.set(2.4, 0.45, 0.6); bench.position.set(x, 0.22, -1.6); g.add(bench); }
  const sign = textSprite(768, 120, 12, 1.9); sign.position.set(0, 5.5, -1); g.add(sign);
  const sg = sign.userData.canvas.getContext('2d'); sg.fillStyle = '#1f2a3a'; sg.fillRect(0, 0, 768, 120); sg.strokeStyle = '#ffd23d'; sg.lineWidth = 6; sg.strokeRect(3, 3, 762, 114);
  sg.fillStyle = '#fff'; sg.textAlign = 'center'; fitText(sg, 'WALLET PLATFORM', 384, 46, 732, 'bold 40px "Pixelify Sans", sans-serif', { lines: 1 });
  sg.fillStyle = '#cfe0ff'; fitText(sg, 'each person signs with their own key and throws the transaction to a pool', 384, 78, 732, '22px "Pixelify Sans", sans-serif', { lines: 2, lh: 1.15 });
  sign.material.map.needsUpdate = true;
  V.people = WALLETS.map((_, i) => { const p = buildPerson(i); p.root.position.set(-15.4 + i * 2.8, 0, 1.0); g.add(p.root); return p; });
  V.throwers = new Map();
}
function personFor(tx) {
  const k = tx.vin[0] && WALLET_BY_SPK.get(hex(tx.vin[0].spk));
  return k ? WALLETS.indexOf(k) : Math.floor(strHash(tx.txid, 9) * WALLETS.length);
}
window.onWalletSend = (node, tx) => { const i = personFor(tx); V.throwers.set(tx.txid, i); V.people[i].throwAt = V.t; };
function personHand(i) { const p = V.people[i]; return p.kind === 'dog' ? p.wallet.getWorldPosition(new THREE.Vector3()) : p.root.localToWorld(new THREE.Vector3(0.35, 1.7, 0.3)); }
function updatePeople() {
  for (const p of V.people) {
    const dt = V.t - p.throwAt;
    if (p.kind === 'dog') { // on all fours: tosses the wallet with a flick of the head, wags its tail
      if (dt < 0.7) { const k = dt / 0.7; p.armR.rotation.x = -Math.sin(k * Math.PI) * 0.8; p.root.position.z = 1.0 + Math.sin(k * Math.PI) * 0.15; }
      else p.armR.rotation.x = Math.sin(V.t * 1.3 + p.phase) * 0.06;
      if (p.tail) p.tail.rotation.z = Math.sin(V.t * 9 + p.phase) * 0.5;
    }
    else if (dt < 0.7) { const k = dt / 0.7; p.armR.rotation.x = k < 0.4 ? -3.0 * (k / 0.4) : -3.0 + (k - 0.4) / 0.6 * 2.6; p.root.position.z = 1.0 + Math.sin(k * Math.PI) * 0.15; }
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
  if (!p.tag) { p.tag = textSprite(560, 160, 4.6, 1.31); p.tag.position.set(0, 2.82, 0); p.root.add(p.tag); }
  const g = p.tag.userData.canvas.getContext('2d'); g.clearRect(0, 0, 560, 160);
  g.fillStyle = 'rgba(14,23,38,.92)'; g.fillRect(4, 4, 552, 152); g.strokeStyle = '#ff5468'; g.lineWidth = 5; g.strokeRect(4, 4, 552, 152);
  const addr = bech32Addr(key.h160);
  g.fillStyle = '#ff8a96'; fitText(g, `WALLET ${i + 1}`, 20, 40, 520, '22px "Pixelify Sans", sans-serif', { lines: 1 });
  g.fillStyle = '#e9f1ff'; fitText(g, addr.slice(0, 14) + '…' + addr.slice(-8), 20, 74, 520, '29px VT323, monospace', { lines: 1 });
  g.fillStyle = '#cfe0ff'; fitText(g, `${n} unspent coin${n === 1 ? '' : 's'} · ${btc(sum)} (flashing red in each node)`, 20, 106, 520, '22px "Pixelify Sans", sans-serif', { lines: 2 });
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
