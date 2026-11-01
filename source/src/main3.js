// ============================================================ page glue
const hoodDirty = {}; function engineReset() {} function buildTabs() {}
const MQ = { text: '', color: '#57e4ff', t: 99, queue: [] };
function marquee(t, c) { MQ.queue.push({ text: t, color: c }); if (MQ.queue.length > 4) MQ.queue.shift(); }
function tickMarquee(dt) {
  MQ.t += dt;
  if (MQ.t > 7 && MQ.queue.length) { const q = MQ.queue.shift(); MQ.text = q.text; MQ.color = q.color; MQ.t = 0; const el = $('mq'); el.textContent = q.text; el.style.color = q.color; el.style.textShadow = `0 0 8px ${q.color}`; el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; }
  else if (MQ.t > 9 && !MQ.queue.length) marquee(`MEMPOOLS: ${NODES.map(n => n.name.toUpperCase() + ' ' + n.mempool.size).join(' · ')}`, '#ff5468');
}
function renderStats() {
  const tip = S.realTip;
  $('sTip').textContent = '#' + fmt(tip.height);
  $('sHash').textContent = siHash(S.hashrate);
  $('sDiff').textContent = (S.difficulty / 1e12).toFixed(2) + ' T';
  $('sMem').textContent = fmt(S.memCount);
  $('sRet').textContent = S.diff ? `${fmt(S.diff.remainingBlocks)} blocks` : '—';
  $('sRetL').textContent = S.diff ? `Next retarget · est ${S.diff.difficultyChange >= 0 ? '+' : ''}${S.diff.difficultyChange.toFixed(1)}%` : 'Next retarget';
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
  tickMarquee(dtReal);
  if (D.open) { drawGauge(dtReal); uiT += dtReal; if (uiT > 0.1) { uiT = 0; renderDetails(false); } }
  requestAnimationFrame(frame);
}

// ---- controls
$('bPlay').onclick = () => { S.running = !S.running; $('bPlay').textContent = S.running ? 'Pause' : 'Play'; };
$('rSpeed').oninput = e => { S.speed = SPEEDS[+e.target.value]; $('oSpeed').textContent = S.speed + '×'; };
$('rBits').oninput = e => { S.demoBits = +e.target.value; $('oBits').textContent = S.demoBits + ' bits'; };
$('bRace').onclick = doubleSpendRace;
$('bLive').onclick = () => mcp && pullViaBrowser();
$('bOverview').onclick = closeNode;
$('dClose').onclick = closeNode;
window.onHash = (m, nonce, hx, z) => { detailsOnHash(m, nonce, hx, z); if (window.sceneOnHash) sceneOnHash(m, nonce, hx, z); };
$('cFreeze').onchange = e => { S.freeze = e.target.checked; };
document.addEventListener('keydown', e => { if (e.key === 'Escape' && D.open) closeNode(); });
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
  renderStats(); renderBlocks(); setupVerifyReal();
  marquee(`CHAIN TIP #${fmt(S.realTip.height)} BY ${S.realTip.pool.toUpperCase()} · ${fmt(S.memCount)} TXS IN MEMPOOL.SPACE'S MEMPOOL`, '#57e4ff');
  log(`Started from the real chain tip #${fmt(S.realTip.height)} (${esc(S.realTip.pool)}). ${txs.length} real mempool transactions loaded; your browser checked all ${txs.reduce((a, t) => a + t.nin, 0)} signatures: ${txs.filter(t => t.sigs.every(r => r.ok)).length}/${txs.length} transactions valid.`, 'gold');
  requestAnimationFrame(t => { last = t; frame(t); });
  tryDirectLive().then(ok => { if (!ok) initMcp(); });
}
document.fonts && document.fonts.load('10px "Silkscreen"').finally(boot) || boot();
