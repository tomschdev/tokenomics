// ============================================================
//  Bitcoin PoW Sky Mine · v2: every node has its own mempool
// ============================================================
const W = 960, H = 540;
const SUBSIDY = 312500000;          // sats per block since height 840,000
const CAP_WU = 12000;               // miniature block weight limit (real: 4,000,000)
const BASE_RATE = 4800;             // combined simulated hashes/sec at 1x
const SPEEDS = [0.1, 0.25, 0.5, 1, 2, 4, 8];
const INCR_RELAY = 1;               // sat/vB incremental relay fee used by the RBF rule (illustrative)
const API = 'https://mempool.space';
const $ = id => document.getElementById(id);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmt = n => Number(n).toLocaleString('en-US');
const short = (h, n = 8) => h.slice(0, n) + '…';
const btc = s => (s / 1e8).toFixed(8).replace(/0+$/, '').replace(/\.$/, '') + ' BTC';
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const h8 = w => (w >>> 0).toString(16).padStart(8, '0');
function siHash(h) { const u = ['H/s','kH/s','MH/s','GH/s','TH/s','PH/s','EH/s','ZH/s']; let i = 0; while (h >= 1000 && i < u.length - 1) { h /= 1000; i++; } return (h >= 100 ? h.toFixed(0) : h.toFixed(h >= 10 ? 1 : 2)) + ' ' + u[i]; }
const nowUnix = () => Math.floor(Date.now() / 1000);
const clock = () => new Date().toTimeString().slice(0, 8);
function randHex(n) { const b = new Uint8Array(n); crypto.getRandomValues(b); return hex(b); }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// ------------------------------------------------------------ global state
const S = {
  source: 'snapshot', fetchedAt: SNAP.fetchedAt,
  bits: SNAP.blocks[0].bits, difficulty: SNAP.difficulty, hashrate: SNAP.hashrate,
  memCount: SNAP.mempool.count, diff: SNAP.diff, poolsTotal: SNAP.pools.blockCount, poolsHashrate: SNAP.pools.lastEstimatedHashrate,
  demoBits: 5, speed: 1, running: true, simTime: 0, selected: 'M0', log: [], realTip: null,
};
const TXS = new Map();      // every tx object ever seen, by txid
const BASE = new Map();     // confirmed coins on the real chain (outpoint -> {value,type,src}) as reported by mempool.space
const BLOCKS = new Map();   // hash -> block (real and simulated)
let NODES = [], NODE = {}, LINKS = [];
let particles = [];

// ------------------------------------------------------------ transactions
function txFromRaw(bytes, prevouts, extra = {}) {
  const raw = parseTx(bytes);
  const prev = prevouts.map(p => ({ spk: p.spk instanceof Uint8Array ? p.spk : unhex(p.spk), value: p.value }));
  const inSum = prev.reduce((a, p) => a + p.value, 0), outSum = raw.vout.reduce((a, o) => a + o.value, 0);
  const fee = inSum - outSum;
  return Object.assign({ txid: raw.txid, raw, prev, hex: hex(bytes), fee, weight: raw.weight, vsize: raw.vsize, feerate: fee / raw.vsize,
    nin: raw.vin.length, nout: raw.vout.length, inSum, outSum,
    vin: raw.vin.map((v, i) => ({ txid: v.txid, vout: v.vout, value: prev[i].value, spk: prev[i].spk, type: scriptType(prev[i].spk) })),
    vout: raw.vout.map(o => ({ value: o.value, spk: o.spk, type: scriptType(o.spk) })), real: true }, extra);
}
// signature checks are deterministic, so each tx is verified once and cached (Bitcoin Core keeps a signature cache too)
let sigChecks = 0;
function verifySigs(tx) { if (!tx.sigs) { tx.sigs = tx.raw.vin.map((_, i) => verifyInput(tx.raw, i, tx.prev)); sigChecks += tx.sigs.length; } return tx.sigs; }
const sigsOk = tx => verifySigs(tx).every(r => r.ok);
function registerTx(tx) {
  if (TXS.has(tx.txid)) return TXS.get(tx.txid);
  TXS.set(tx.txid, tx);
  if (tx.real) for (const v of tx.vin) { const op = v.txid + ':' + v.vout; if (!TXS.has(v.txid) && !BASE.has(op)) BASE.set(op, { value: v.value, spk: v.spk, type: v.type, src: 'chain' }); }
  return tx;
}
const ops = tx => tx.vin.map(v => v.txid + ':' + v.vout);

// ------------------------------------------------------------ blocks, chain state, work
const EMPTY = { spent: new Map(), created: new Map(), conf: new Set() };
const stateMemo = new Map(), workMemo = new Map();
function stateOf(hash) {
  if (stateMemo.has(hash)) return stateMemo.get(hash);
  const b = BLOCKS.get(hash);
  if (!b || b.real) { stateMemo.set(hash, EMPTY); return EMPTY; }
  const p = stateOf(b.prev);
  const st = { spent: new Map(p.spent), created: new Map(p.created), conf: new Set(p.conf) };
  for (const t of b.txs) {
    for (const op of ops(t)) { st.spent.set(op, t.txid); }
    t.vout.forEach((o, i) => { if (o.type !== 'op_return') st.created.set(t.txid + ':' + i, { value: o.value, spk: o.spk, type: o.type, src: 'block #' + b.height }); });
    st.conf.add(t.txid);
  }
  stateMemo.set(hash, st); return st;
}
// cumulative work: a real block's work ~ 2^(its zero bits); a demo block's only 2^demoBits
function workOf(hash) {
  if (workMemo.has(hash)) return workMemo.get(hash);
  const b = BLOCKS.get(hash); if (!b) return 0n;
  const w = (b.prev && BLOCKS.has(b.prev) ? workOf(b.prev) : 0n) + (1n << BigInt(b.real ? b.zbits || 78 : b.zbits)); // exact integer work
  workMemo.set(hash, w); return w;
}
function lookupCoin(st, op) {
  if (st.spent.has(op)) return { spentBy: st.spent.get(op) };
  const c = st.created.get(op) || BASE.get(op);
  return c ? { coin: c } : null;
}
function ancestors(hash) { const out = []; let b = BLOCKS.get(hash); while (b) { out.push(b.hash); b = BLOCKS.get(b.prev); } return out; }

// ------------------------------------------------------------ nodes & links
const POOL_COLORS = [['#ffae3b', '#a8641a'], ['#ff5468', '#a3243a'], ['#4fc3ff', '#1f6fa8'], ['#9be14f', '#4f8a1f']];
function makeNode(id, kind, name, box, extra = {}) {
  return Object.assign({ id, kind, name, box, peers: [], mempool: new Map(), spends: new Map(), slots: new Array(36).fill(null),
    tip: null, known: new Set(), log: [], minFee: 0.1, memVersion: 0, received: 0, relayed: 0 }, extra);
}
function setupNodes(pools) {
  const total = pools.reduce((a, p) => a + p.blockCount, 0);
  NODES = pools.slice(0, 4).map((p, i) => makeNode('M' + i, 'miner', p.name, null, {
    color: POOL_COLORS[i][0], dark: POOL_COLORS[i][1], share: p.blockCount / S.poolsTotal, rel: p.blockCount / total, policy: 'minrelaytxfee 0.1 sat/vB',
    stage: 'template', t: 0, won: 0, earned: 0, discarded: 0, hashes: 0, swing: 0, hand: false, landed: 0, verified: 0 }));
  NODE = Object.fromEntries(NODES.map(n => [n.id, n]));
  const L = [['M0', 'M1', 0.45], ['M1', 'M2', 0.55], ['M2', 'M3', 0.5], ['M3', 'M0', 0.6], ['M0', 'M2', 0.7]];
  LINKS = L.map(([a, b, lat]) => ({ a: NODE[a], b: NODE[b], lat, busyUntil: { [a]: 0, [b]: 0 } }));
  for (const l of LINKS) { l.a.peers.push({ node: l.b, link: l }); l.b.peers.push({ node: l.a, link: l }); }
}
function nlog(node, msg, cls = '') { node.log.unshift({ t: clock(), msg, cls }); if (node.log.length > 80) node.log.pop(); if (node.id === S.selected) hoodDirty.log = true; }
// Timeline: blocks and network events in one newest-first list. Each entry takes a sequence number when it
// first appears, so block rows and event lines interleave in the order they happened.
const TL = { seq: 0, blockSeq: new Map(), dirty: false };
function log(msg, cls = '') {
  S.log.unshift({ t: clock(), msg, cls, seq: ++TL.seq }); if (S.log.length > 60) S.log.pop();
  renderTimeline();
}
// hook: whitepaper §5 step n just happened at some node (the steps board in workers.js wraps this to outline it)
function wp(n) {}

// send a message along a link; each direction is FIFO so a block never overtakes its parent
function send(from, to, kind, payload, extraDelay = 0) {
  const link = from.peers.find(p => p.node === to).link;
  const start = S.simTime + extraDelay;
  const arrive = Math.max(start + link.lat * rnd(0.85, 1.15), link.busyUntil[to.id] + 0.02);
  link.busyUntil[to.id] = arrive;
  particles.push({ k: kind, from, to, t0: start, t1: arrive, payload, onDone: () => kind === 'tx' ? acceptTx(to, payload, from) : receiveBlock(to, payload, from) });
  from.relayed++;
}

// ------------------------------------------------------------ mempool acceptance (per node)
function acceptTx(node, tx, from, opts = {}) {
  const fromName = from ? (from.name || from) : 'wallet';
  if (node.mempool.has(tx.txid)) return 'have';
  const st = stateOf(node.tip);
  if (st.conf.has(tx.txid)) return 'confirmed';
  node.received++;
  const reject = reason => { nlog(node, `✗ rejected ${tag(tx)} from ${esc(fromName)}: ${reason}`, 'bad'); return 'rejected'; };
  if (tx.feerate < node.minFee) return reject(`fee rate ${tx.feerate.toFixed(2)} sat/vB is below this node's ${node.minFee} sat/vB minimum (policy)`);
  const conflicts = new Set();
  for (const v of tx.vin) {
    const op = v.txid + ':' + v.vout;
    const c = lookupCoin(st, op);
    if (c && c.spentBy) return reject(`input ${short(v.txid, 6)}:${v.vout} already spent by confirmed tx ${short(c.spentBy, 6)}`);
    const parent = node.mempool.get(v.txid);
    if (!c && !parent) return reject(`input ${short(v.txid, 6)}:${v.vout} not found (unknown or unconfirmed parent)`);
    const coin = c ? c.coin : parent.tx.vout[v.vout];
    if (!coin) return reject(`input ${short(v.txid, 6)}:${v.vout} does not exist`);
    if (coin.value !== v.value || (coin.spk && hex(coin.spk) !== hex(v.spk))) return reject('signed amount or script does not match the coin being spent');
    if (node.spends.has(op)) conflicts.add(node.spends.get(op));
  }
  if (tx.inSum < tx.outSum) return reject('outputs exceed inputs');
  const cached = !!tx.sigs;
  if (!sigsOk(tx)) return reject('signature check failed: ' + verifySigs(tx).filter(r => !r.ok).map(r => r.steps.slice(-1)[0].msg).join('; '));
  if (conflicts.size) {
    // full-RBF (Bitcoin Core 28+ default): replace only if the new tx pays more, at a higher rate
    const olds = [...conflicts].map(id => node.mempool.get(id).tx);
    const oldFee = olds.reduce((a, t) => a + t.fee, 0), maxRate = Math.max(...olds.map(t => t.feerate));
    const needFee = oldFee + INCR_RELAY * tx.vsize;
    if (tx.fee < needFee || tx.feerate <= maxRate)
      return reject(`double-spends ${olds.map(t => short(t.txid, 6)).join(', ')} already in this mempool; replacement needs ≥ ${fmt(needFee)} sat fee and a higher rate (pays ${fmt(tx.fee)})`);
    olds.forEach(o => { removeTx(node, o.txid); nlog(node, `↻ ${tag(o)} replaced by ${tag(tx)} (RBF: higher fee)`, 'gold'); });
  }
  node.mempool.set(tx.txid, { tx, from: fromName, at: S.simTime });
  for (const op of ops(tx)) node.spends.set(op, tx.txid);
  const free = node.slots.indexOf(null); if (free >= 0) node.slots[free] = tx.txid;
  node.memVersion++;
  if (!opts.quiet) nlog(node, `✓ accepted ${tag(tx)} from ${esc(fromName)} · ${tx.feerate.toFixed(2)} sat/vB · ${tx.nin} signature${tx.nin > 1 ? 's' : ''} ${cached ? 'valid (cached)' : 'verified'}`, 'ok');
  if (window.onTxAccepted) window.onTxAccepted(node, tx, from);
  if (opts.relay !== false) for (const p of node.peers) if (p.node !== from) send(node, p.node, 'tx', tx, rnd(0.05, 0.6)); // inv trickle delay
  return 'accepted';
}
function removeTx(node, txid) {
  const e = node.mempool.get(txid); if (!e) return;
  node.mempool.delete(txid);
  for (const op of ops(e.tx)) if (node.spends.get(op) === txid) node.spends.delete(op);
  const i = node.slots.indexOf(txid); if (i >= 0) node.slots[i] = null;
  if (window.onTxRemoved) window.onTxRemoved(node, txid);
  const shown = new Set(node.slots.filter(Boolean));
  for (const id of node.mempool.keys()) { if (shown.has(id)) continue; const f = node.slots.indexOf(null); if (f < 0) break; node.slots[f] = id; }
  node.memVersion++;
}
function tag(tx) { return `<span class="mono">${short(tx.txid, 6)}</span>${tx.ds ? ` <span class="chip ds${tx.ds}">${tx.ds === 'A' ? 'PAY' : 'REFUND'}</span>` : tx.synthetic ? ' <span class="chip gold">SIM</span>' : ''}`; }

// ------------------------------------------------------------ tip changes & reorgs (per node)
function setTip(node, newHash, why) {
  const old = node.tip;
  if (old === newHash) return;
  const newAnc = ancestors(newHash), oldAnc = old ? ancestors(old) : [];
  const newSet = new Set(newAnc);
  const fork = oldAnc.find(h => newSet.has(h));
  const disconnected = oldAnc.slice(0, oldAnc.indexOf(fork)).map(h => BLOCKS.get(h));
  const connected = newAnc.slice(0, newAnc.indexOf(fork)).map(h => BLOCKS.get(h)).reverse();
  node.tip = newHash;
  if (window.onTipChanged) window.onTipChanged(node, disconnected, connected);
  const st = stateOf(newHash);
  // drop mempool txs that are now confirmed or conflict with confirmed spends
  for (const { tx } of [...node.mempool.values()]) {
    if (st.conf.has(tx.txid)) { removeTx(node, tx.txid); continue; }
    const clash = ops(tx).find(op => st.spent.has(op));
    if (clash) { removeTx(node, tx.txid); nlog(node, `✗ evicted ${tag(tx)}: conflicts with confirmed tx ${short(st.spent.get(clash), 6)}`, 'bad'); }
  }
  // a reorg returns the disconnected blocks' txs to the mempool (if still valid)
  if (disconnected.length && disconnected.some(b => !b.real)) {
    nlog(node, `⟲ reorg: ${disconnected.length} block(s) disconnected, ${connected.length} connected (more cumulative work)`, 'gold');
    for (const b of disconnected) for (const t of (b.txs || [])) acceptTx(node, t, 'reorg', { relay: false, quiet: true });
    // children whose parents just failed are dropped by the next validation pass
    for (const { tx } of [...node.mempool.values()]) for (const v of tx.vin) { const op = v.txid + ':' + v.vout; if (!lookupCoin(st, op) && !node.mempool.has(v.txid)) { removeTx(node, tx.txid); break; } }
  }
  if (node.kind === 'miner' && !node.handBusy) {
    if (node.stage === 'hash') node.discarded += node.hashes;
    node.pendingRebuild = true;
  }
}

// ------------------------------------------------------------ block validation & relay
function verifyTxAgainst(tx, st, ctx) {
  const checks = []; let ok = true;
  tx.vin.forEach(v => {
    const op = v.txid + ':' + v.vout; let res;
    if (ctx.spentInBlock.has(op)) res = { ok: false, msg: `${short(v.txid, 6)}:${v.vout} spent twice in this block` };
    else if (ctx.created.has(op)) res = { ok: true, msg: `${short(v.txid, 6)}:${v.vout} created earlier in this block` };
    else { const c = lookupCoin(st, op);
      if (!c) res = { ok: false, msg: `${short(v.txid, 6)}:${v.vout} not in UTXO set` };
      else if (c.spentBy) res = { ok: false, msg: `${short(v.txid, 6)}:${v.vout} already spent` };
      else res = { ok: c.coin.value === v.value, msg: `${short(v.txid, 6)}:${v.vout} unspent · ${fmt(c.coin.value)} sat` + (c.coin.src !== 'chain' ? ` (${c.coin.src})` : '') }; }
    if (!res.ok) ok = false; checks.push(res);
  });
  const sg = verifySigs(tx); if (!sg.every(r => r.ok)) ok = false;
  checks.push({ ok: sg.every(r => r.ok), msg: sg.map(r => `${r.type.toUpperCase()} · ${r.algo || 'n/a'} ${r.ok ? '✓' : '✗'}`).join(', '), sig: true });
  const feeOk = tx.inSum - tx.outSum === tx.fee && tx.fee >= 0; if (!feeOk) ok = false;
  return { ok, checks, extra: tx.nin - tx.vin.length, feeOk };
}
function commit(tx, ctx) { ops(tx).forEach(op => ctx.spentInBlock.add(op)); tx.vout.forEach((o, i) => ctx.created.set(tx.txid + ':' + i, o)); }
function validateBlock(node, blk) {
  const res = [];
  const h = hex(rev(sha256d(blk.header)));
  res.push({ ok: h === blk.hash, msg: 'recomputed SHA-256d(header) = ' + short(h, 12) });
  const z = zbitsHex(h);
  res.push({ ok: z >= blk.zbits, msg: `${z} leading zero bits ≥ ${blk.zbits} required` });
  res.push({ ok: node.known.has(blk.prev), msg: `parent #${fmt(blk.height - 1)} ${short(blk.prev.replace(/^0+/, ''), 6)} is known` });
  const lv = merkleLevels([blk.cbTxid, ...blk.txs.map(t => t.txid)]);
  res.push({ ok: lv[lv.length - 1][0] === blk.merkle, msg: 'merkle root rebuilt from the tx list matches the header' });
  const st = stateOf(blk.prev), ctx = { spentInBlock: new Set(), created: new Map() };
  let all = true; for (const t of blk.txs) { if (!verifyTxAgainst(t, st, ctx).ok) all = false; commit(t, ctx); }
  res.push({ ok: all, msg: `all ${blk.txs.length} txs replayed: signatures valid, inputs exist and unspent, Σin ≥ Σout` });
  res.push({ ok: blk.reward <= SUBSIDY + blk.fees, msg: `coinbase ${btc(blk.reward)} ≤ subsidy + fees` });
  return res;
}
function zbitsHex(h) { let c = 0; for (const ch of h) { const v = parseInt(ch, 16); if (v === 0) { c += 4; continue; } return c + Math.clz32(v) - 28; } return c; }
function receiveBlock(node, blk, from) {
  if (node.known.has(blk.hash)) return;
  const checks = validateBlock(node, blk);
  const ok = checks.every(c => c.ok);
  if (!ok) { nlog(node, `✗ rejected block #${fmt(blk.height)} from ${esc(from.name)}`, 'bad'); return; }
  node.known.add(blk.hash);
  if (window.onBlockAccepted) window.onBlockAccepted(node, blk, from);
  nlog(node, `▣ block #${fmt(blk.height)} by ${esc(blk.pool)} from ${esc(from.name)}: all ${checks.length} checks pass`, 'ok');
  wp(5);
  // relay onward (compact-block style: right after validation)
  for (const p of node.peers) if (p.node !== from) send(node, p.node, 'block', blk, 0.15);
  // fork choice: follow the chain with the most cumulative work; on a tie keep the first one seen
  if (workOf(blk.hash) > workOf(node.tip)) {
    const wasHashing = node.kind === 'miner' && node.stage === 'hash';
    if (node.kind === 'miner') { node.lastChecks = { blk, checks }; }
    setTip(node, blk.hash);
    if (node.kind === 'miner') { node.stage = 'validate'; node.t = 0; if (wasHashing) wp(6); }
  } else if (blk.height === BLOCKS.get(node.tip).height) {
    nlog(node, `⑂ competing block at height #${fmt(blk.height)}: same work as my tip, so I keep the first one I saw`, 'gold');
  }
}

// ------------------------------------------------------------ block templates
function selectTxs(m) {
  const st = stateOf(m.tip);
  const pool = [...m.mempool.values()].map(e => e.tx);
  const byId = new Map(pool.map(t => [t.txid, t]));
  const score = t => { const ps = t.vin.map(v => byId.get(v.txid)).filter(Boolean); if (!ps.length) return t.feerate;
    return Math.max(t.feerate, (t.fee + ps.reduce((a, x) => a + x.fee, 0)) / (t.vsize + ps.reduce((a, x) => a + x.vsize, 0))) * 0.999; };
  pool.sort((a, b) => score(b) - score(a));
  const chosen = [], ids = new Set(); let wu = 1000; const ctx = { spentInBlock: new Set(), created: new Map() };
  const tryAdd = t => {
    if (ids.has(t.txid) || wu + t.weight > CAP_WU) return false;
    for (const v of t.vin) { const p = byId.get(v.txid); if (p && !ids.has(p.txid) && !tryAdd(p)) return false; }
    if (wu + t.weight > CAP_WU) return false;
    const r = verifyTxAgainst(t, st, ctx); if (!r.ok) return false;
    commit(t, ctx); chosen.push({ tx: t, check: r }); ids.add(t.txid); wu += t.weight; return true;
  };
  for (const t of pool) { if (wu > CAP_WU - 430) break; tryAdd(t); }
  return { chosen, wu };
}
function serializeCoinbase(height, tag, extranonce, value) {
  const bytes = []; const push = (...b) => bytes.push(...b);
  const u32 = v => push(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255);
  u32(2); push(1); for (let i = 0; i < 32; i++) push(0); u32(0xffffffff);
  const hb = []; let h = height; while (h > 0) { hb.push(h & 255); h = Math.floor(h / 256); } if (hb[hb.length - 1] & 0x80) hb.push(0);
  const tagB = [...new TextEncoder().encode('/' + tag + '/')], en = [...unhex(extranonce)];
  const script = [hb.length, ...hb, tagB.length, ...tagB, en.length, ...en];
  push(script.length, ...script); u32(0xffffffff);
  push(1); let v = BigInt(value); for (let i = 0; i < 8; i++) { push(Number(v & 255n)); v >>= 8n; }
  const pkh = sha256(new TextEncoder().encode('payout:' + tag)).slice(0, 20);
  push(22, 0x00, 0x14, ...pkh); u32(0);
  return new Uint8Array(bytes);
}
function merkleLevels(ids) {
  let level = ids.map(id => rev(unhex(id))); const levels = [ids.slice()];
  while (level.length > 1) {
    if (level.length % 2) level.push(level[level.length - 1]);
    const next = []; for (let i = 0; i < level.length; i += 2) { const c = new Uint8Array(64); c.set(level[i]); c.set(level[i + 1], 32); next.push(sha256d(c)); }
    level = next; levels.push(level.map(b => hex(rev(b))));
  }
  return levels;
}
function buildTemplate(m) {
  const { chosen, wu } = selectTxs(m);
  const tip = BLOCKS.get(m.tip), height = tip.height + 1;
  const fees = chosen.reduce((a, c) => a + c.tx.fee, 0);
  const extranonce = randHex(8);
  const cb = serializeCoinbase(height, m.name, extranonce, SUBSIDY + fees);
  const cbTxid = hex(rev(sha256d(cb)));
  const levels = merkleLevels([cbTxid, ...chosen.map(c => c.tx.txid)]);
  const merkle = levels[levels.length - 1][0];
  const time = Math.max(nowUnix(), (tip.time || 0) + 1);
  const header = buildHeader(0x20000000, m.tip, merkle, time, S.bits, 0);
  m.tpl = { height, prev: m.tip, chosen, wu: wu - 1000 + 320 + cb.length * 4, fees, reward: SUBSIDY + fees, extranonce, cbTxid, cbLen: cb.length, levels, merkle, time, header, hasher: makeHasher(header), memVersion: m.memVersion, id: (m.tplId = (m.tplId || 0) + 1) };
  m.nonce = 0; m.turnT = 0; // illustrative nonce range 0..100 (the real field is 32 bits)
  m.hashes = 0; m.best = { z: -1, hex: '' }; m.last = null; m.acc = 0;
  m.stage = 'template'; m.t = 0; m.launched = 0; m.landed = 0; m.verified = 0; m.wp2 = false; m.pendingRebuild = false;
  hoodDirty.tpl = true;
  if (m.hand) engineReset(m, 'new template');
}

// ------------------------------------------------------------ miner loop
function minerRate(m) { return S.slowNode === m.id ? 2.5 : BASE_RATE * m.rel; } // hashes per simulated second (the speed slider scales simulated time)
function updateMiner(m, dt) {
  m.t += dt; m.swing += dt;
  if (m.pendingRebuild && m.stage !== 'validate') { buildTemplate(m); }
  const n = m.tpl ? m.tpl.chosen.length : 0;
  if (m.stage === 'template') {
    if (!m.wp2 && m.t > 0) { m.wp2 = true; wp(2); }
    const step = 0.22;
    while (m.launched < n && m.t >= m.launched * step) { launchCollect(m, m.launched); m.launched++; }
    if (m.t >= n * step + 0.9) { m.stage = 'verify'; m.t = 0; }
  } else if (m.stage === 'verify') {
    m.verified = Math.min(n, Math.floor(m.t / 0.3));
    if (m.t >= n * 0.3 + 0.4) { m.stage = 'merkle'; m.t = 0; }
  } else if (m.stage === 'merkle') {
    if (m.t >= 1.2) { m.stage = 'hash'; m.t = 0; wp(3); }
  } else if (m.stage === 'hash') {
    if (m.hand) return;        // the under-the-hood engine drives this miner's nonces
    // pools hand out fresh jobs as their mempool changes (real pools: roughly every 30 s)
    // one real SHA-256d per turn of the handle; bigger pools crank faster (turn time ∝ 1 / hashrate share)
    m.turnDur = turnTime(m); m.turnT += dt;
    while (m.turnT >= m.turnDur && m.stage === 'hash') { m.turnT -= m.turnDur; turnOnce(m); }
  } else if (m.stage === 'won') {
    if (m.t >= 1.5) buildTemplate(m);
  } else if (m.stage === 'validate') {
    if (m.t >= 1.9) { m.pendingRebuild = false; buildTemplate(m); }
  }
}
const NONCE_MAX = 100;
function turnTime(m) { return 0.22 / m.rel; }
function turnOnce(m) {
  const tpl = m.tpl, hs = tpl.hasher;
  const t = Math.max(tpl.time, nowUnix()); if (t !== tpl.time) { tpl.time = t; hs.setTime(t); le32(tpl.header, 68, t); }
  const nonce = m.nonce, s = hs.hash(nonce); m.hashes++;
  const hx = digestDisplayHex(s), z = leadingZeroBits(s);
  if (m.hist) m.hist[Math.min(z, 40)]++;
  if (z > m.best.z) m.best = { z, hex: hx, nonce };
  m.last = { hex: hx, nonce, z };
  if (window.onHash) window.onHash(m, nonce, hx, z);
  if (z >= S.demoBits) { found(m, nonce, hx); return; }
  if (++m.nonce > NONCE_MAX) rollExtranonce(m);
}
// nonce range used up: change the extranonce in the coinbase, which changes the merkle root and so the whole header
function rollExtranonce(m) {
  const t = m.tpl; t.extranonce = randHex(8);
  const cb = serializeCoinbase(t.height, m.name, t.extranonce, t.reward); t.cbTxid = hex(rev(sha256d(cb)));
  t.levels = merkleLevels([t.cbTxid, ...t.chosen.map(c => c.tx.txid)]); t.merkle = t.levels[t.levels.length - 1][0];
  t.header = buildHeader(0x20000000, t.prev, t.merkle, t.time, S.bits, 0); t.hasher = makeHasher(t.header);
  m.nonce = 0; m.rolls = (m.rolls || 0) + 1;
  nlog(m, `nonces 0–${NONCE_MAX} used up: new extranonce ${t.extranonce.slice(0, 8)}… in the coinbase gives a new merkle root, so the nonce starts again at 0`, 'dim');
  if (window.onExtranonce) window.onExtranonce(m);
}
function hashBatch(m, n) {
  const tpl = m.tpl, hs = tpl.hasher;
  const t = Math.max(tpl.time, nowUnix()); if (t !== tpl.time) { tpl.time = t; hs.setTime(t); le32(tpl.header, 68, t); }
  m.acc += n; let todo = Math.floor(m.acc); m.acc -= todo;
  while (todo-- > 0) {
    const s = hs.hash(m.nonce >>> 0); m.hashes++;
    const top = bswap(s[7]); const z = top === 0 ? 32 + Math.clz32(bswap(s[6])) : Math.clz32(top);
    if (m.hist) m.hist[Math.min(z, 40)]++;
    if (z > m.best.z) m.best = { z, hex: digestDisplayHex(s), nonce: m.nonce >>> 0 };
    if (S.slowNode === m.id && window.onHash) window.onHash(m, m.nonce >>> 0, digestDisplayHex(s), z);
    if (z >= S.demoBits) { const hx = digestDisplayHex(s); m.last = { hex: hx, nonce: m.nonce >>> 0, z }; return { hit: true, nonce: m.nonce >>> 0, hex: hx }; }
    m.nonce = (m.nonce + 1) >>> 0;
  }
  const s = hs.hash(m.nonce >>> 0); m.last = { hex: digestDisplayHex(s), nonce: m.nonce >>> 0, z: leadingZeroBits(s) };
  return { hit: false };
}
// called by both auto mining and the engine
function hashFoundCheck(m, res) { if (res.hit) found(m, res.nonce, res.hex); }

function found(m, nonce, hashHex) {
  le32(m.tpl.header, 76, nonce);
  const check = hex(rev(sha256d(m.tpl.header)));
  if (check !== hashHex) { log('internal hash mismatch', 'bad'); return; }
  const blk = { hash: hashHex, prev: m.tpl.prev, height: m.tpl.height, pool: m.name, color: m.color, real: false, zbits: S.demoBits,
    txs: m.tpl.chosen.map(c => c.tx), fees: m.tpl.fees, reward: m.tpl.reward, time: m.tpl.time, nonce, header: Uint8Array.from(m.tpl.header),
    merkle: m.tpl.merkle, cbTxid: m.tpl.cbTxid, minerId: m.id, foundAt: S.simTime, hashes: m.hashes };
  BLOCKS.set(blk.hash, blk);
  m.known.add(blk.hash);
  m.won++; m.earned += blk.reward; m.lastWin = blk;
  nlog(m, `★ found block #${fmt(blk.height)} at nonce ${nonce} after ${fmt(m.hashes)} hashes`, 'gold');
  log(`<b style="color:${m.color}">${esc(m.name)}</b> found block #${fmt(blk.height)} after ${fmt(m.hashes)} hashes · nonce ${nonce} · <span class="mono">${short(hashHex, 14)}</span>`, 'ok');
  wp(4);
  marquee(`${m.name.toUpperCase()} FOUND BLOCK #${fmt(blk.height)}  HASH ${hashHex.slice(0, 16)}…`, m.color);
  m.handBusy = true; setTip(m, blk.hash); m.handBusy = false;
  if (window.onBlockMined) window.onBlockMined(m, blk);
  m.stage = 'won'; m.t = 0; m.pendingRebuild = false;
  if (m.hand) { m.engine.status = `★ Block found! Broadcasting #${fmt(blk.height)} to peers.`; m.engine.justWon = blk; }
  for (const p of m.peers) send(m, p.node, 'block', blk, 0.7); // after the throw wind-up
  renderTimeline();
}

// ------------------------------------------------------------ wallets: new txs, double-spend race
let synthTimer = 0, arrivalQueue = [];
const WALLETS = Array.from({ length: 12 }, (_, i) => makeWalletKey('w' + i));
const WALLET_BY_SPK = new Map(WALLETS.map(k => [hex(k.spk), k]));
function entryNode() { return pick(NODES); }
function broadcastFromWallet(tx, node) {
  registerTx(tx);
  if (window.onWalletSend) window.onWalletSend(node, tx);
  particles.push({ k: 'wallet', to: node, t0: S.simTime + 0.35, t1: S.simTime + 1.9, payload: tx, onDone: () => { const r = acceptTx(node, tx, { name: 'a wallet' }); if (r === 'accepted') wp(1); } });
}
function newWalletCoin(value) {
  const key = pick(WALLETS), op = randHex(32) + ':0';
  BASE.set(op, { value, spk: key.spk, type: 'p2wpkh', src: 'sim wallet' }); return { op, coin: BASE.get(op), key };
}
function spendCoin(op, coin, key, feeRate, payTo, extra = {}) {
  const [pt, pv] = op.split(':');
  const vbytes = 141, fee = Math.max(15, Math.round(vbytes * feeRate));
  const pay = Math.floor((coin.value - fee) * rnd(0.2, 0.7));
  const outs = payTo === 'all' ? [{ value: coin.value - fee, spk: pick(WALLETS).spk }] : [{ value: pay, spk: pick(WALLETS).spk }, { value: coin.value - fee - pay, spk: key.spk }];
  const bytes = signP2WPKH([{ txid: pt, vout: +pv, value: coin.value, key }], outs);
  return txFromRaw(bytes, [{ spk: key.spk, value: coin.value }], Object.assign({ real: false, synthetic: true }, extra));
}
function maybeArrivals(dt) {
  if (arrivalQueue.length && Math.random() < dt * 0.7) broadcastFromWallet(arrivalQueue.shift(), entryNode());
  synthTimer -= dt; if (synthTimer > 0) return;
  const ref = NODES[0]; const size = Math.min(...NODES.map(n => n.mempool.size));
  synthTimer = size < 14 ? rnd(0.3, 0.7) : rnd(0.9, 2);
  if (size >= 28 || arrivalQueue.length) return;
  // the simulated wallets spend coins they actually hold keys for: outputs of earlier simulated blocks, or fresh coins
  const st = stateOf(bestTip());
  const spendable = [...st.created.entries()].filter(([op, u]) => u.spk && WALLET_BY_SPK.has(hex(u.spk)) && !st.spent.has(op) && u.value > 4000 && !NODES.some(n => n.spends.has(op)));
  let op, coin, key;
  if (spendable.length && Math.random() < 0.7) { [op, coin] = pick(spendable); key = WALLET_BY_SPK.get(hex(coin.spk)); }
  else ({ op, coin, key } = newWalletCoin(Math.floor(rnd(30000, 900000))));
  broadcastFromWallet(spendCoin(op, coin, key, Math.exp(rnd(-1.6, 2.4))), entryNode());
}
function doubleSpendRace() {
  const { op, coin, key } = newWalletCoin(250000);
  const A = spendCoin(op, coin, key, 2, 'all', { ds: 'A' }), B = spendCoin(op, coin, key, 8, 'all', { ds: 'B' });
  const [na, nb] = [NODES[0], NODES[2]];
  broadcastFromWallet(A, na); broadcastFromWallet(B, nb);
  log(`Double-spend race: one coin, two validly signed txs. <b>PAY</b> ${short(A.txid, 6)} (2 sat/vB) enters at ${esc(na.name)}; <b>REFUND</b> ${short(B.txid, 6)} (8 sat/vB) enters at ${esc(nb.name)}. Each node keeps the first it sees unless the newcomer pays enough more to replace it (RBF).`, 'gold');
  marquee('DOUBLE-SPEND RACE: SAME COIN, TWO SIGNED TXS', '#ff7ad9');
}

// ------------------------------------------------------------ chain view helpers
function bestTip() {
  let best = null;
  for (const b of BLOCKS.values()) if (!best || workOf(b.hash) > workOf(best.hash) || (workOf(b.hash) === workOf(best.hash) && (b.foundAt || 0) < (best.foundAt || 0))) best = b;
  return best.hash;
}
function renderTimeline() {
  TL.dirty = false;
  const tip = bestTip(), best = new Set(ancestors(tip)), topH = BLOCKS.get(tip).height;
  const list = [...BLOCKS.values()].sort((a, b) => b.height - a.height || (a.foundAt || 0) - (b.foundAt || 0)).slice(0, 14);
  for (const b of [...list].reverse()) if (!TL.blockSeq.has(b.hash)) TL.blockSeq.set(b.hash, ++TL.seq);
  const blocks = list.map(b => { const main = best.has(b.hash); const nodesOn = NODES.filter(n => ancestors(n.tip).includes(b.hash)).length;
    return { seq: TL.blockSeq.get(b.hash), html: `<li class="blk${b.real ? '' : ' sim'}${main ? '' : ' orphan'}"><span class="mono">#${fmt(b.height)}</span><span>${esc(b.pool)}${b.real ? '' : ' <span class="chip gold">SIM</span>'}${main ? '' : ' <span class="chip bad">' + (b.height >= topH ? 'competing' : 'stale') + '</span>'}</span><span class="mono dim">${nodesOn}/${NODES.length} nodes</span></li>` }; });
  const events = S.log.map(e => ({ seq: e.seq, html: `<li class="ev ${e.cls}"><time>${e.t}</time>${e.msg}</li>` }));
  $('timeline').innerHTML = blocks.concat(events).sort((a, b) => b.seq - a.seq).map(r => r.html).join('');
}

// ------------------------------------------------------------ live data
let polling = null;
async function fetchJSON(path, ms = 6000) {
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(API + path, { signal: ctl.signal }); if (!r.ok) throw new Error(r.status); return await r.json(); } finally { clearTimeout(to); }
}
async function fetchTxs(ids) {
  const out = [];
  await Promise.all(ids.map(async id => { try {
    const [j, hx] = await Promise.all([fetchJSON('/api/tx/' + id), fetch(API + '/api/tx/' + id + '/hex').then(r => r.text())]);
    if (j.status.confirmed) return;
    out.push(txFromRaw(unhex(hx.trim()), j.vin.map(v => ({ spk: v.prevout.scriptpubkey, value: v.prevout.value }))));
  } catch (e) {} }));
  return out;
}
async function tryDirectLive() {
  try {
    const blocks = await fetchJSON('/api/v1/blocks', 5000);
    const [pools, diff, mp, recent] = await Promise.all([fetchJSON('/api/v1/mining/pools/1w'), fetchJSON('/api/v1/difficulty-adjustment'), fetchJSON('/api/mempool'), fetchJSON('/api/mempool/recent')]);
    let hr = null; try { hr = await fetchJSON('/api/v1/mining/hashrate/3d'); } catch (e) {}
    const full = await fetchTxs(recent.slice(0, 10).map(t => t.txid));
    applyLive({ blocks, pools, diff, mp, hr, txs: full }, 'Live · mempool.space');
    polling = setInterval(pollDirect, 20000);
    return true;
  } catch (e) { return false; }
}
async function pollDirect() {
  try {
    const tipHash = await fetch(API + '/api/blocks/tip/hash').then(r => r.text());
    if (tipHash && S.realTip && tipHash !== S.realTip.hash) {
      const blocks = await fetchJSON('/api/v1/blocks');
      let confirmed = []; try { confirmed = await fetchJSON('/api/block/' + tipHash + '/txids'); } catch (e) {}
      realBlocksArrived(blocks, new Set(confirmed));
    }
    const recent = await fetchJSON('/api/mempool/recent');
    const fresh = recent.filter(t => !TXS.has(t.txid)).slice(0, 5);
    (await fetchTxs(fresh.map(t => t.txid))).forEach(t => broadcastFromWallet(t, entryNode()));
    const mp = await fetchJSON('/api/mempool'); S.memCount = mp.count; renderStats();
  } catch (e) { /* keep last good data */ }
}
function normBlock(b) {
  return { hash: b.id, prev: b.previousblockhash || b.prev, height: b.height, pool: (b.extras && b.extras.pool && b.extras.pool.name) || b.pool || 'Unknown', real: true,
    txCount: b.tx_count, fees: (b.extras && b.extras.totalFees) || b.totalFees || 0, time: b.timestamp, bits: b.bits, version: b.version, merkle: b.merkle_root, nonce: b.nonce, foundAt: -1e9 + b.height,
    zbits: 256 - BigInt('0x' + bitsToTargetHex(b.bits)).toString(2).length };
}
function addRealBlocks(raw) { const bs = raw.map(normBlock); bs.forEach(b => { if (!BLOCKS.has(b.hash)) BLOCKS.set(b.hash, b); }); NODES.forEach(n => bs.forEach(b => n.known.add(b.hash))); return bs; }
function realBlocksArrived(raw, confirmed, quiet) {
  const bs = addRealBlocks(raw); const tip = bs[0];
  if (S.realTip && tip.hash === S.realTip.hash) return;
  S.realTip = tip;
  for (const n of NODES) {
    for (const id of confirmed) if (n.mempool.has(id)) removeTx(n, id);
    if (workOf(tip.hash) > workOf(n.tip)) { n.handBusy = false; setTip(n, tip.hash); if (n.kind === 'miner') { n.stage = 'validate'; n.t = 0; n.lastChecks = null; } }
  }
  if (!quiet) {
    log(`Real network: block #${fmt(tip.height)} mined by ${esc(tip.pool)}. It carries ~2^${tip.zbits} work versus 2^${S.demoBits} for each simulated block, so every node reorgs onto it (most cumulative work).`, 'gold');
    marquee(`REAL BLOCK #${fmt(tip.height)} BY ${tip.pool.toUpperCase()} · ALL NODES REORG ONTO IT`, '#57e4ff');
  }
  renderTimeline(); renderStats(); setupVerifyReal();
}
function applyLive(d, label) {
  S.source = 'live'; S.fetchedAt = new Date().toISOString();
  $('srcChip').classList.add('live'); $('srcText').textContent = label;
  S.bits = d.blocks[0].bits; S.difficulty = d.hr ? d.hr.currentDifficulty : (d.blocks[0].difficulty || S.difficulty);
  if (d.hr) S.hashrate = d.hr.currentHashrate;
  S.memCount = d.mp.count; S.diff = d.diff; S.poolsTotal = d.pools.blockCount; S.poolsHashrate = d.pools.lastEstimatedHashrate;
  const top = d.pools.pools.slice(0, 4); const tot = top.reduce((a, p) => a + p.blockCount, 0);
  NODES.filter(n => n.kind === 'miner').forEach((m, i) => { if (top[i]) { m.name = top[i].name; m.share = top[i].blockCount / S.poolsTotal; m.rel = top[i].blockCount / tot; } });
  realBlocksArrived(d.blocks, new Set(), true);
  d.txs.forEach(t => broadcastFromWallet(t, entryNode()));
  buildTabs(); renderStats();
  log(`Loaded live data: tip #${fmt(S.realTip.height)} by ${esc(S.realTip.pool)}; mempool.space's own mempool holds ${fmt(S.memCount)} txs.`, 'ok');
}
let mcp = null;
async function initMcp() {
  try { if (!window.claude || !window.claude.use) return; mcp = await window.claude.use('mcp'); } catch (e) { mcp = null; }
  if (mcp && S.source === 'snapshot') { $('bLive').hidden = false; $('liveMsg').textContent = 'Reads mempool.space through the Claude desktop app’s browser.'; }
}
function payloadText(res) { if (!res) return ''; if (typeof res.payload === 'string') return res.payload; const t = (res.content || []).find(c => c.type === 'text'); return t ? t.text : (res.payload ? JSON.stringify(res.payload) : ''); }
function parseJsonFromText(txt) { const i = txt.search(/[\[{]/); if (i < 0) throw new Error('no json'); const j = Math.max(txt.lastIndexOf(']'), txt.lastIndexOf('}')); return JSON.parse(txt.slice(i, j + 1)); }
async function pullViaBrowser() {
  const btn = $('bLive'); btn.disabled = true; const msg = $('liveMsg'); const SV = 'host:claude_browser'; let tabId = null;
  const get = async (path, first) => {
    if (first) { const r = await mcp.callTool(SV, 'preview_start', { url: API + path }); const m = payloadText(r).match(/tabId\s+([\w-]+)/); tabId = m ? m[1] : null; }
    else await mcp.callTool(SV, 'navigate', tabId ? { url: API + path, tabId } : { url: API + path });
    const r = await mcp.callTool(SV, 'get_page_text', tabId ? { tabId, max_chars: 300000 } : { max_chars: 300000 });
    return parseJsonFromText(payloadText(r));
  };
  try {
    msg.textContent = 'Reading blocks…'; const blocks = await get('/api/v1/blocks', true);
    msg.textContent = 'Reading pools…'; const pools = await get('/api/v1/mining/pools/1w');
    msg.textContent = 'Reading difficulty…'; const diff = await get('/api/v1/difficulty-adjustment');
    msg.textContent = 'Reading mempool…'; const mp = await get('/api/mempool');
    let hr = null; try { hr = await get('/api/v1/mining/hashrate/3d'); } catch (e) {}
    const recent = await get('/api/mempool/recent'); const txs = [];
    for (const t of recent.slice(0, 5)) { msg.textContent = `Reading tx ${txs.length + 1}/5…`; try { const f = await get('/api/tx/' + t.txid); await mcp.callTool(SV, 'navigate', tabId ? { url: API + '/api/tx/' + t.txid + '/hex', tabId } : { url: API + '/api/tx/' + t.txid + '/hex' }); const hx = payloadText(await mcp.callTool(SV, 'get_page_text', tabId ? { tabId } : {})).trim().match(/[0-9a-f]{100,}/); if (!f.status.confirmed && hx) txs.push(txFromRaw(unhex(hx[0]), f.vin.map(v => ({ spk: v.prevout.scriptpubkey, value: v.prevout.value })))); } catch (e) {} }
    applyLive({ blocks, pools, diff, mp, hr, txs }, 'Live · via Claude app');
    msg.textContent = 'Updated ' + clock() + '. Pull again for newer blocks.';
  } catch (e) {
    const c = e && e.code;
    msg.textContent = c === 'server_not_connected' ? 'Live pull works only inside the Claude desktop app. Showing the snapshot.'
      : (c === 'not_in_manifest' || c === 'approval_required' || c === 'cancelled') ? 'Browser access was not allowed. Showing the snapshot.'
      : 'Could not read mempool.space right now. Showing the snapshot.';
  } finally { btn.disabled = false; }
}
