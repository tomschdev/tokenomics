// ============================================================ node details: block outline, nonce reels, target range
const D = { open: null, mode: 'slow', queue: [], cur: null, markers: [], hist: null, reel: { from: 0, to: 0, t: 1 }, hit: 0, sampleT: 0, lastKey: '' };
function openNode(id) {
  const n = NODE[id]; if (!n) return;
  if (D.open && D.open !== id) NODE[D.open].hist = null;
  D.open = id; S.selected = id; n.hist = new Array(41).fill(0); D.markers = []; D.queue = []; D.cur = null; D.hit = 0; D.lastKey = '';
  $('details').hidden = false; $('stage3d').classList.add('open'); $('dName').innerHTML = `<i style="background:${n.color}"></i>${esc(n.name)}`;
  focusNode(id); renderDetails(true);
  if (window.innerWidth < 900) $('details').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
}
function closeNode() { if (D.open) NODE[D.open].hist = null; D.open = null; S.selected = null; $('details').hidden = true; $('stage3d').classList.remove('open'); overview(); }
function setMode(mode) { D.mode = mode; S.slowNode = D.open && mode === 'slow' ? D.open : null; D.queue = []; document.querySelectorAll('#dMode button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === mode)); }
function detailsOnHash(m, nonce, hx, z) { if (m.id !== D.open) return; D.queue.push({ nonce, hex: hx, z }); if (D.queue.length > 6) D.queue.shift(); }

function renderDetails(force) {
  const n = NODE[D.open]; if (!n) return;
  const stageTxt = { template: 'Opening the empty block and letting transactions stream in from the pool', verify: 'Checking each transaction on the clipboard: signatures valid, coins exist and are unspent', merkle: 'Hashing the txids into a merkle root and tying the block to the previous one', hash: 'Turning the handle: every turn sets a new nonce (0–100) and hashes the whole header', won: 'Found a hash in the target range! Broadcasting the block', validate: 'A peer found a block. Checking it, then starting over on top of it' }[n.stage];
  $('dStage').textContent = stageTxt || '';
  const t = n.tpl; if (!t) return;
  // block outline: the 80-byte header that is hashed, and the transactions it commits to
  const L = n.last && n.stage === 'hash' ? n.last : null;
  const nonce = (D.cur ? D.cur.nonce : L ? L.nonce : n.nonce) >>> 0;
  const tip = BLOCKS.get(t.prev);
  const rows = [
    ['Version', '0x20000000', 'signals soft-fork readiness'],
    ['Previous block', `#${fmt(tip.height)} · ${t.prev.replace(/^0+/, '').slice(0, 10)}…`, 'links this block to the chain'],
    ['Merkle root', t.merkle.slice(0, 16) + '…', `fingerprint of the ${t.chosen.length + 1} transactions below`],
    ['Time', new Date(t.time * 1000).toISOString().slice(11, 19) + ' UTC', ''],
    ['nBits', '0x' + S.bits.toString(16), 'encodes the real target'],
    ['Nonce', '0x' + h8(nonce) + ' · ' + fmt(nonce), 'the 4 bytes that change every try'],
  ];
  $('dHdr').innerHTML = rows.map(([k, v, note], i) => `<div class="hrow${i === 5 ? ' nonce' : i === 2 ? ' mk' : ''}" title="${note}"><span>${k}</span><b>${v}</b></div>`).join('');
  const key = t.id + ':' + n.stage + ':' + n.verified + ':' + n.landed;
  if (force || key !== D.lastKey) {
    D.lastKey = key;
    const vis = n.stage === 'template' ? n.landed : t.chosen.length, ver = n.stage === 'template' ? 0 : n.stage === 'verify' ? n.verified : t.chosen.length;
    let body = `<div class="txr cb" title="3.125 BTC new coins + ${fmt(t.fees)} sat fees"><span>coinbase</span><b>${btc(t.reward)} → ${esc(n.name)}</b></div>`;
    const first = n.stage === 'verify' ? Math.max(0, Math.min(ver - 3, t.chosen.length - 5)) : 0;
    t.chosen.slice(first, first + 5).forEach((c, j) => { const i = first + j;
      const tx = c.tx, shown = i < vis, done = i < ver, sig = c.check.checks.find(k => k.sig);
      const sigTypes = (tx.sigs || []).map(r => r.type.toUpperCase()).join('+');
      body += `<div class="txr${shown ? '' : ' ghost'}${n.stage === 'verify' && i === ver - 1 ? ' now' : ''}"><span class="mono">${short(tx.txid, 7)}${tx.ds ? ` <span class="chip ds${tx.ds}">${tx.ds === 'A' ? 'PAY' : 'REF'}</span>` : tx.synthetic ? ' <span class="chip gold">SIM</span>' : ''}</span><b>${tx.feerate.toFixed(1)} sat/vB · ${sigTypes} ${!shown ? '' : !done ? '<span class="dim">· unchecked</span>' : '<span class="ok">· sig ✓ · replayed ✓</span>'}</b></div>`;
    });
    body += `<div class="txr sum" title="of the 12,000 WU demo limit (real blocks: 4,000,000)"><span>${t.chosen.length + 1} txs</span><b>${t.chosen.length > 5 ? `+ ${t.chosen.length - 5} more · ` : ''}${fmt(t.wu)} WU · ${fmt(t.fees)} sat fees</b></div>`;
    $('dBody').innerHTML = body;
    if (n.stage === 'verify' && ver > 0) { const c = t.chosen[ver - 1], s = (c.tx.sigs || [])[0]; $('dSig').innerHTML = s ? `<b>Checking ${short(c.tx.txid, 8)}</b> · ${s.algo}<br>${s.steps.map(st => `<span class="${st.ok ? 'ok' : 'bad'}">${st.ok ? '✓' : '✗'} ${st.msg}</span>`).join('<br>')}<br><span class="ok">✓ replay: spend ${c.tx.nin} input${c.tx.nin > 1 ? 's' : ''}, create ${c.tx.nout} output${c.tx.nout > 1 ? 's' : ''} in a scratch copy of the UTXO set</span>` : ''; }
    $('dSig').hidden = n.stage !== 'verify';
  }
  const tried = n.hashes || 0;
  $('dStats').innerHTML = `<span>tried <b>${fmt(tried)}</b></span><span>best <b>${Math.max(0, n.best.z)} zero bits</b></span><span>odds per try <b>1 in ${fmt(2 ** S.demoBits)}</b></span><span>state <b>${fmt(V.nodes[n.id].coinCount || 0)} coins · ${fmt(V.nodes[n.id].addrCount || 0)} addresses</b></span><span>crank <b>1 turn / ${turnTime(n).toFixed(2)} s</b> (bigger pool, faster hands)</span>`;
}

// ---- the spin → hash → land canvas
function drawGauge(dt) {
  const n = NODE[D.open]; if (!n) return;
  const cv = $('dCv'), g = cv.getContext('2d'); const W = cv.width, H = cv.height;
  g.clearRect(0, 0, W, H); g.fillStyle = '#0a111c'; g.fillRect(0, 0, W, H);
  const hashing = n.stage === 'hash';
  // feed: slow-mo plays every queued hash; full speed samples the stream
  if (!D.cur && D.queue.length && D.mode === 'slow') { D.cur = D.queue.shift(); D.cur.t = 0; D.reel = { from: D.reel.to, to: D.cur.nonce, t: 0 }; }
  if (D.mode === 'fast' && hashing && n.last) { D.sampleT += dt; D.reel = { from: n.last.nonce, to: n.last.nonce, t: 1 }; if (D.sampleT > 0.12) { D.sampleT = 0; D.markers.push({ z: n.last.z, t: 0, fast: true }); } }
  if (D.cur) { D.cur.t += dt; D.reel.t = Math.min(1, D.cur.t / 0.35);
    if (D.cur.t > 0.55 && !D.cur.sent) { D.cur.sent = true; D.markers.push({ z: D.cur.z, t: 0 }); }
    if (D.cur.t > 1.15) { if (D.cur.z >= S.demoBits) D.hit = 2.5; D.cur = null; } }
  // nonce reels
  g.font = '11px Silkscreen, monospace'; g.fillStyle = '#9ab0cc'; g.textBaseline = 'top'; g.fillText('1 · TURN THE HANDLE: NEW NONCE (0–100)', 12, 8);
  const rw = 30, rx0 = 12, ry = 26, rh = 40;
  const nonceHex = String(D.reel.to).padStart(3, '0');
  for (let i = 0; i < 3; i++) {
    const x = rx0 + i * (rw + 4); g.fillStyle = '#1b2d47'; g.fillRect(x, ry, rw, rh); g.strokeStyle = '#ffcf3a'; g.lineWidth = 2; g.strokeRect(x + 1, ry + 1, rw - 2, rh - 2);
    g.save(); g.beginPath(); g.rect(x + 2, ry + 2, rw - 4, rh - 4); g.clip();
    const spinning = D.reel.t < 1;
    g.font = '26px VT323, monospace'; g.textAlign = 'center'; g.fillStyle = '#ffcf3a';
    if (spinning) { const off = (V.t * (D.mode === 'fast' ? 900 : 300) + i * 37) % 34; for (let k = -1; k < 2; k++) g.fillText(((parseInt(nonceHex[i], 10) + k + Math.floor(V.t * 20)) % 10).toString(), x + rw / 2, ry + 6 + off + k * 34 - 17); }
    else g.fillText(nonceHex[i], x + rw / 2, ry + 8);
    g.restore();
  }
  g.textAlign = 'left'; g.font = '12px "JetBrains Mono", monospace'; g.fillStyle = '#cfe0ff';
  g.fillText(`→ written into the header's nonce field (real field: 0 to 4,294,967,295)`, rx0 + 3 * (rw + 4) + 6, ry + 14);
  // hash output
  g.font = '11px Silkscreen, monospace'; g.fillStyle = '#9ab0cc'; g.fillText('2 · SHA-256(SHA-256(80-BYTE HEADER))', 12, 78);
  const hx = D.cur && D.cur.t > 0.35 ? D.cur.hex : D.mode === 'fast' && n.last ? n.last.hex : D.cur ? null : (n.last ? n.last.hex : null);
  g.font = '11.5px "JetBrains Mono", monospace';
  if (hx) { const z = hx.match(/^0*/)[0]; g.fillStyle = '#ffcf3a'; g.fillText(z, 12, 96); g.fillStyle = '#cfe0ff'; g.fillText(hx.slice(z.length, 46 - z.length + z.length), 12 + g.measureText(z).width, 96); g.fillText('…', 12 + g.measureText(hx.slice(0, 46)).width, 96); }
  else { g.fillStyle = '#4b5f80'; g.fillText('hashing…', 12, 96); }
  // range gauge: each bucket = hashes with exactly z leading zero bits (each one half the size of the last)
  g.font = '11px Silkscreen, monospace'; g.fillStyle = '#9ab0cc'; g.fillText('3 · WHERE DOES THE HASH LAND?', 12, 118);
  const B = S.demoBits + 3, gx = 12, gw = W - 24, gy = 140, gh = H - 196, bw = gw / (B + 1);
  // target band
  const tx0 = gx + S.demoBits * bw;
  g.fillStyle = D.hit > 0 ? `rgba(95,224,124,${0.35 + 0.25 * Math.sin(V.t * 12)})` : 'rgba(95,224,124,.16)'; g.fillRect(tx0, gy - 6, gx + gw - tx0, gh + 6);
  g.strokeStyle = '#5fe07c'; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(tx0, gy - 8); g.lineTo(tx0, gy + gh); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#5fe07c'; g.font = '10px Silkscreen, monospace'; g.fillText('TARGET RANGE', Math.min(tx0 + 4, W - 90), gy - 4);
  const counts = n.hist || new Array(41).fill(0); const mx = Math.max(1, ...counts.slice(0, B + 1));
  for (let b = 0; b <= B; b++) {
    const x = gx + b * bw, cnt = b === B ? counts.slice(B).reduce((a, c) => a + c, 0) : counts[b];
    g.fillStyle = '#16243a'; g.fillRect(x + 1, gy + 12, bw - 2, gh - 12);
    const hgt = cnt ? Math.max(3, (Math.log2(cnt + 1) / Math.log2(mx + 1)) * (gh - 26)) : 0;
    g.fillStyle = b >= S.demoBits ? '#5fe07c' : '#4fa3ff'; g.fillRect(x + 2, gy + gh - hgt, bw - 4, hgt);
    if (cnt && bw > 14) { g.fillStyle = '#cfe0ff'; g.font = '9px "JetBrains Mono", monospace'; g.textAlign = 'center'; g.fillText(cnt > 999 ? Math.round(cnt / 1000) + 'k' : String(cnt), x + bw / 2, gy + gh - hgt - 11); }
    g.textAlign = 'center'; g.fillStyle = b >= S.demoBits ? '#5fe07c' : '#7f93b0'; g.font = '9px "JetBrains Mono", monospace';
    if (bw > 11 || b % 2 === 0) g.fillText(b === B ? b + '+' : String(b), x + bw / 2, gy + gh + 4);
  }
  g.textAlign = 'left'; g.fillStyle = '#7f93b0'; g.font = '10px "Pixelify Sans", sans-serif';
  g.fillText('leading zero bits →  each step right is half as likely (log scale of the hash value)', gx, gy + gh + 18);
  g.fillText(`real network target: ${256 - BigInt('0x' + bitsToTargetHex(S.bits)).toString(2).length} zero bits, ${256 - BigInt('0x' + bitsToTargetHex(S.bits)).toString(2).length - S.demoBits} halvings further right`, gx, gy + gh + 32);
  // flying markers from the hash readout into their bucket
  D.markers = D.markers.filter(mk => { mk.t += dt; const k = Math.min(1, mk.t / (mk.fast ? 0.35 : 0.55)); const b = Math.min(mk.z, B); const x1 = gx + b * bw + bw / 2, y1 = gy + gh - 8;
    const x = 40 + (x1 - 40) * k, y = 100 + (y1 - 100) * k - Math.sin(k * Math.PI) * 30; g.fillStyle = mk.z >= S.demoBits ? '#5fe07c' : '#ffcf3a'; g.fillRect(x - 3, y - 3, 7, 7); return k < 1; });
  if (D.hit > 0) { D.hit -= dt; g.fillStyle = 'rgba(14,23,38,.85)'; g.fillRect(W / 2 - 130, gy + 30, 260, 52); g.strokeStyle = '#5fe07c'; g.strokeRect(W / 2 - 130, gy + 30, 260, 52); g.fillStyle = '#5fe07c'; g.font = '16px Silkscreen, monospace'; g.textAlign = 'center'; g.fillText('HIT! HASH < TARGET', W / 2, gy + 40); g.font = '11px "Pixelify Sans", sans-serif'; g.fillText('valid proof-of-work: the block is broadcast', W / 2, gy + 62); g.textAlign = 'left'; }
  if (!hashing && !D.cur) { g.fillStyle = 'rgba(10,17,28,.7)'; g.fillRect(0, 22, W, 90); g.fillStyle = '#ffe9a6'; g.font = '12px "Pixelify Sans", sans-serif'; g.fillText(n.stage === 'won' ? 'Block found. A new template starts in a moment…' : 'Hashing starts once the block template is built and verified…', 12, 60); }
}
// a hit seen in full-speed mode should still flash
const _found = found; found = function (m, nonce, hx) { if (m.id === D.open) { D.hit = 2.5; } return _found(m, nonce, hx); };
