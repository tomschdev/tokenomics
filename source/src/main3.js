// ============================================================ page glue
const hoodDirty = {}; function engineReset() {} function buildTabs() {}
const MQ = { text: '', color: '#57e4ff', t: 99, queue: [], idle: 0, stats: [] };
function marquee(t, c) { MQ.queue.push({ text: t, color: c }); if (MQ.queue.length > 4) MQ.queue.shift(); }
function renderStats() {
  const tip = S.realTip;
  // network stats live in the LED ticker rotation as [label, value]
  MQ.stats = [
    ['REAL CHAIN TIP', '#' + fmt(tip.height)],
    ['NETWORK HASHRATE', siHash(S.hashrate)],
    ['DIFFICULTY', (S.difficulty / 1e12).toFixed(2) + ' T'],
    ["MEMPOOL.SPACE'S MEMPOOL", fmt(S.memCount) + ' TXS'],
    ['NEXT RETARGET', S.diff ? `${fmt(S.diff.remainingBlocks)} BLOCKS · EST ${S.diff.difficultyChange >= 0 ? '+' : ''}${S.diff.difficultyChange.toFixed(1)}%` : '—'],
    ['BLOCK SUBSIDY', '3.125 BTC'],
  ];
  $('realZeros').textContent = 256 - BigInt('0x' + bitsToTargetHex(S.bits)).toString(2).length;
  if (S.source === 'snapshot') $('srcText').textContent = 'Snapshot · ' + S.fetchedAt.slice(11, 16) + ' UTC ' + new Date(S.fetchedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
function setupVerifyReal() {
  const b = S.realTip; if (!b || !b.merkle) return;
  $('verifyReal').innerHTML = [['Block', '#' + fmt(b.height) + ' · ' + esc(b.pool)], ['Nonce', String(b.nonce)], ['Time', String(b.time)], ['nBits', '0x' + b.bits.toString(16)], ['Explorer hash', b.hash.match(/^0*/)[0].length + ' zeros, then ' + b.hash.replace(/^0+/, '').slice(0, 14) + '…'], ['Your browser', '<span id="vrOut" class="dim">press the button</span>']]
    .map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  $('bVerify').onclick = () => {
    const out = hex(rev(sha256d(buildHeader(b.version, b.prev, b.merkle, b.time, b.bits, b.nonce))));
    $('vrOut').innerHTML = `<span class="${out === b.hash ? 'ok' : 'bad'}">${out.match(/^0*/)[0].length} zeros, then ${out.replace(/^0+/, '').slice(0, 14)}… ${out === b.hash ? '✓ matches' : '✗ mismatch'}</span>`;
  };
}
// ---- click-to-learn notes: what the clicked object does in real Bitcoin, told in this scene's terms.
// The page's scaled-down values and the scene key live in the full notes at the bottom (the card's "Full notes" link).
const realZeroBits = () => 256 - BigInt('0x' + bitsToTargetHex(S.bits)).toString(2).length;
const NOTES = {
  state: { title: 'UTXO state cube',
    text: "Every node keeps the UTXO set: all unspent coins, each locked to an address. This cube is that set, coins grouped by owner and sized by value. A block's transactions spend coins, which vanish, and create new ones; threads show where each came from. The gold mint is the coinbase creating new bitcoin." },
  mempool: { title: 'Mempool',
    text: "This pool is the node's mempool: valid transactions waiting for a block. Before keeping or relaying one, the node checks its signatures and that every input is unspent. If two spend the same coin, the first one seen wins, unless the newcomer pays a higher fee and replaces it (replace-by-fee). Miners pick the highest fee rates first." },
  tower: { title: 'Block tower',
    text: "The node's chain: each block carries the previous block's hash, linking back to the genesis block. The newest sits on the cube. The node follows the branch with the most cumulative work; if a heavier branch arrives, it reorgs onto it and the losing block tips off. Its transactions return to the mempool." },
  block: { title: 'Workshop: the candidate block',
    text: "The worker takes transactions from the mempool, verifies each signature and replays each one against the cube's UTXO set: every input must be an unspent coin. It adds a coinbase paying itself and puts the merkle root and the previous block's hash into an 80-byte header. Then it cranks: new nonce, double SHA-256, below the target? A hit is a valid block." },
  crank: { title: 'Workshop: crank and hash readout',
    text: () => `Each turn of the crank writes a new nonce into the header and hashes it with double SHA-256. A valid block needs about ${realZeroBits()} leading zero bits today, roughly 6 × 10<sup>23</sup> tries. The 32-bit nonce runs out after about 4.3 billion tries, so the worker rolls the extranonce in the coinbase, which gives a new merkle root.` },
  wallets: { title: 'Wallet platform',
    text: 'Each person holds a private key and a wallet. To pay, they sign a transaction spending coins their key controls and broadcast it to a node: here, they throw it into a pool. Nodes relay it peer to peer until every mempool has it. Click a person to see their coins flash in every cube.' },
  ticker: { title: 'LED ticker and live data',
    text: "The ticker shows the real network: the chain tip, hashrate (every miner's guesses per second combined) and difficulty, which sets how many leading zero bits a hash needs. Every 2,016 blocks difficulty retargets to keep blocks about 10 minutes apart. The subsidy, 3.125 BTC, is the new bitcoin each coinbase may claim." },
  board: { title: 'Whitepaper §5 board',
    text: "Satoshi's six steps for running the network (whitepaper §5); the lit one is happening now. Nodes always treat the chain with the most proof-of-work as correct. Proof-of-work (§4): bump a nonce until the block's hash is below a target; anyone verifies it with one hash. Transactions (§2): an owner passes a coin on by signing it to the next owner's key." },
};
function showNote(part) {
  const n = NOTES[part]; if (!n) { hideNote(); return; }
  $('noteTitle').textContent = n.title;
  $('noteBody').innerHTML = `<p>${typeof n.text === 'function' ? n.text() : n.text}</p>`;
  $('note').hidden = false; $('note').scrollTop = 0;
}
function hideNote() { $('note').hidden = true; }
function updateParticles() {
  for (const p of particles) if (!p.done && S.simTime >= p.t1) { p.done = true; p.onDone && p.onDone(); }
  particles = particles.filter(p => !p.done);
}
let last = performance.now(), uiT = 0;
function frame(ts) {
  const dtReal = Math.min(0.05, (ts - last) / 1000); last = ts;
  let dtSim = 0;
  if (S.running) {
    dtSim = dtReal * S.speed; S.simTime += dtSim;
    for (const n of NODES) { if (S.freeze && D.open && n.id !== D.open && n.stage === 'hash') continue; updateMiner(n, dtSim); }
    updateParticles(); maybeArrivals(dtSim);
  }
  render3(dtReal, dtSim);
  if (TL.dirty) renderTimeline();
  if (D.open) { drawGauge(dtReal); uiT += dtReal; if (uiT > 0.1) { uiT = 0; renderDetails(false); } }
  requestAnimationFrame(frame);
}

// ---- controls
$('bPlay').onclick = () => { S.running = !S.running; $('bPlay').textContent = S.running ? 'Pause' : 'Play'; };
$('rSpeed').oninput = e => { S.speed = SPEEDS[+e.target.value]; $('oSpeed').textContent = S.speed + '×'; };
$('rBits').oninput = e => { S.demoBits = +e.target.value; $('oBits').textContent = S.demoBits + ' bits'; };
$('bRace').onclick = doubleSpendRace;
$('bLive').onclick = () => mcp && pullViaBrowser();
$('bOverview').onclick = () => { stopFollow(); closeNode(); };
$('bFollow').onclick = () => { if (FOLLOW.on) { stopFollow(); overview(); } else startFollow(); };
$('bHelp').onclick = () => { const h = $('hint'); h.hidden = !h.hidden; $('bHelp').setAttribute('aria-expanded', !h.hidden); };
$('dClose').onclick = closeNode;
$('noteClose').onclick = hideNote;
$('noteFull').onclick = e => { e.preventDefault(); const d = $('fullNotes'); d.open = true; d.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }); };
$('srcChip').onclick = () => showNote('ticker');
$('bMenu').onclick = () => { const off = $('wrap').classList.toggle('menu-off'), b = $('bMenu'), t = off ? 'Show info and controls' : 'Hide info and controls'; b.setAttribute('aria-expanded', !off); b.setAttribute('aria-label', t); b.title = t; };
window.onTipChanged = () => { TL.dirty = true; }; // a node switching tip changes the timeline's x/4 counts
window.onHash = (m, nonce, hx, z) => { detailsOnHash(m, nonce, hx, z); if (window.sceneOnHash) sceneOnHash(m, nonce, hx, z); };
$('cFreeze').onchange = e => { S.freeze = e.target.checked; };
document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (!$('note').hidden) hideNote(); else if (D.open) closeNode(); }); // Esc closes the note first, then the details panel
$('nodeChips').innerHTML = '';

// ---- boot
function boot() {
  const real = SNAP.blocks.map(normBlock); real.forEach(b => BLOCKS.set(b.hash, b));
  S.realTip = real[0]; S.selected = null; S.freeze = true;
  setupNodes(SNAP.pools.top);
  NODES.forEach(n => { real.forEach(b => n.known.add(b.hash)); n.tip = real[0].hash; });
  $('nodeChips').innerHTML = NODES.map(n => `<button data-id="${n.id}"><i style="background:${n.color}"></i>${esc(n.name)}</button>`).join('');
  $('nodeChips').querySelectorAll('button').forEach(b => b.onclick = () => openNode(b.dataset.id));
  initScene();
  const txs = SNAP.txs.map(([hx, pv]) => txFromRaw(unhex(hx), pv.map(([spk, value]) => ({ spk, value }))));
  txs.forEach(registerTx); txs.forEach(verifySigs);
  const now = txs.filter((_, i) => i % 4 !== 3), later = txs.filter((_, i) => i % 4 === 3);
  for (const n of NODES) for (const t of now) if (Math.random() > 0.1) acceptTx(n, t, null, { relay: false, quiet: true });
  arrivalQueue = later;
  NODES.forEach((m, i) => { buildTemplate(m); m.t = -i * 0.4; });
  renderStats(); renderTimeline(); setupVerifyReal();
  marquee(`CHAIN TIP #${fmt(S.realTip.height)} BY ${S.realTip.pool.toUpperCase()} · ${fmt(S.memCount)} TXS IN MEMPOOL.SPACE'S MEMPOOL`, '#57e4ff');
  log(`Started from the real chain tip #${fmt(S.realTip.height)} (${esc(S.realTip.pool)}). ${txs.length} real mempool transactions loaded; your browser checked all ${txs.reduce((a, t) => a + t.nin, 0)} signatures: ${txs.filter(t => t.sigs.every(r => r.ok)).length}/${txs.length} transactions valid.`, 'gold');
  requestAnimationFrame(t => { last = t; frame(t); });
  tryDirectLive().then(ok => { if (!ok) initMcp(); });
}
document.fonts && Promise.all([document.fonts.load('10px "Pixelify Sans"'), document.fonts.load('bold 10px "Pixelify Sans"'), document.fonts.load('10px VT323')]).finally(boot) || boot();