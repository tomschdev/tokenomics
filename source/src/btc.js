// ================= Bitcoin primitives: RIPEMD-160, secp256k1 (ECDSA + BIP340 Schnorr), tx parsing, sighashes =================
// ---- byte helpers
const cat = (...arrs) => { const n = arrs.reduce((a, b) => a + b.length, 0); const o = new Uint8Array(n); let p = 0; for (const a of arrs) { o.set(a, p); p += a.length; } return o; };
const u32le = v => Uint8Array.of(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255);
const u64le = v => { let b = BigInt(v); const o = new Uint8Array(8); for (let i = 0; i < 8; i++) { o[i] = Number(b & 255n); b >>= 8n; } return o; };
const varint = n => n < 0xfd ? Uint8Array.of(n) : n <= 0xffff ? Uint8Array.of(0xfd, n & 255, n >> 8) : cat(Uint8Array.of(0xfe), u32le(n));
const pushData = b => b.length < 0x4c ? cat(Uint8Array.of(b.length), b) : b.length < 256 ? cat(Uint8Array.of(0x4c, b.length), b) : cat(Uint8Array.of(0x4d, b.length & 255, b.length >> 8), b);
const bytesEq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const b2n = b => b.length ? BigInt('0x' + hex(b)) : 0n;
const n2b = (n, len = 32) => unhex(n.toString(16).padStart(len * 2, '0'));

// ---- RIPEMD-160 (for HASH160 = RIPEMD160(SHA256(x)))
function ripemd160(msg) {
  const zl = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,7,4,13,1,10,6,15,3,12,0,9,5,2,14,11,8,3,10,14,4,9,15,8,1,2,7,0,6,13,11,5,12,1,9,11,10,0,8,12,4,13,3,7,15,14,5,6,2,4,0,5,9,7,12,2,10,14,1,3,8,11,6,15,13];
  const zr = [5,14,7,0,9,2,11,4,13,6,15,8,1,10,3,12,6,11,3,7,0,13,5,10,14,15,8,12,4,9,1,2,15,5,1,3,7,14,6,9,11,8,12,2,10,0,4,13,8,6,4,1,3,11,15,0,5,12,2,13,9,7,10,14,12,15,10,4,1,5,8,7,6,2,13,14,0,3,9,11];
  const sl = [11,14,15,12,5,8,7,9,11,13,14,15,6,7,9,8,7,6,8,13,11,9,7,15,7,12,15,9,11,7,13,12,11,13,6,7,14,9,13,15,14,8,13,6,5,12,7,5,11,12,14,15,14,15,9,8,9,14,5,6,8,6,5,12,9,15,5,11,6,8,13,12,5,12,13,14,11,8,5,6];
  const sr = [8,9,9,11,13,15,15,5,7,7,8,11,14,14,12,6,9,13,15,7,12,8,9,11,7,7,12,7,6,15,13,11,9,7,15,11,8,6,6,14,12,13,5,14,13,13,7,5,15,5,8,11,14,14,6,14,6,9,12,9,12,5,15,8,8,5,12,9,12,5,14,6,8,13,6,5,15,13,11,11];
  const KL = [0, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xa953fd4e], KR = [0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0x7a6d76e9, 0];
  const f = (j, x, y, z) => j < 16 ? x ^ y ^ z : j < 32 ? (x & y) | (~x & z) : j < 48 ? (x | ~y) ^ z : j < 64 ? (x & z) | (y & ~z) : x ^ (y | ~z);
  const rotl = (x, n) => (x << n) | (x >>> (32 - n));
  const len = msg.length, nb = ((len + 8) >> 6) + 1, buf = new Uint8Array(nb * 64);
  buf.set(msg); buf[len] = 0x80; const bits = len * 8;
  for (let i = 0; i < 4; i++) buf[nb * 64 - 8 + i] = (bits >>> (8 * i)) & 255;
  buf[nb * 64 - 4] = Math.floor(bits / 2 ** 32) & 255;
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  const X = new Int32Array(16);
  for (let k = 0; k < nb; k++) {
    for (let i = 0; i < 16; i++) { const o = k * 64 + i * 4; X[i] = buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16) | (buf[o + 3] << 24); }
    let al = h0, bl = h1, cl = h2, dl = h3, el = h4, ar = h0, br = h1, cr = h2, dr = h3, er = h4;
    for (let j = 0; j < 80; j++) {
      const r = j >> 4;
      let t = (rotl((al + f(j, bl, cl, dl) + X[zl[j]] + KL[r]) | 0, sl[j]) + el) | 0; al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
      t = (rotl((ar + f(79 - j, br, cr, dr) + X[zr[j]] + KR[r]) | 0, sr[j]) + er) | 0; ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    }
    const t = (h1 + cl + dr) | 0; h1 = (h2 + dl + er) | 0; h2 = (h3 + el + ar) | 0; h3 = (h4 + al + br) | 0; h4 = (h0 + bl + cr) | 0; h0 = t;
  }
  const out = new Uint8Array(20); [h0, h1, h2, h3, h4].forEach((h, i) => { for (let b = 0; b < 4; b++) out[i * 4 + b] = (h >>> (8 * b)) & 255; });
  return out;
}
const hash160 = b => ripemd160(sha256(b));
function taggedHash(tag, ...msgs) { const t = sha256(new TextEncoder().encode(tag)); return sha256(cat(t, t, ...msgs)); }

// ---- secp256k1 over BigInt, Jacobian coordinates
const P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const G = { x: 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n, y: 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n };
const md = (a, m = P) => { const r = a % m; return r >= 0n ? r : r + m; };
function powm(b, e, m) { let r = 1n; b = md(b, m); while (e > 0n) { if (e & 1n) r = r * b % m; b = b * b % m; e >>= 1n; } return r; }
const inv = (a, m = P) => powm(a, m - 2n, m);
const J0 = { X: 0n, Y: 1n, Z: 0n };
function jdbl(p) {
  if (p.Z === 0n || p.Y === 0n) return J0;
  const Y2 = p.Y * p.Y % P, S = 4n * p.X * Y2 % P, M = 3n * p.X * p.X % P;
  const X = md(M * M - 2n * S), Y = md(M * (S - X) - 8n * Y2 * Y2), Z = 2n * p.Y * p.Z % P;
  return { X, Y, Z };
}
function jadd(p, q) {
  if (p.Z === 0n) return q; if (q.Z === 0n) return p;
  const Z1Z1 = p.Z * p.Z % P, Z2Z2 = q.Z * q.Z % P;
  const U1 = p.X * Z2Z2 % P, U2 = q.X * Z1Z1 % P, S1 = p.Y * q.Z % P * Z2Z2 % P, S2 = q.Y * p.Z % P * Z1Z1 % P;
  if (U1 === U2) return S1 === S2 ? jdbl(p) : J0;
  const Hh = md(U2 - U1), R = md(S2 - S1), H2 = Hh * Hh % P, H3 = H2 * Hh % P, U1H2 = U1 * H2 % P;
  const X = md(R * R - H3 - 2n * U1H2), Y = md(R * (U1H2 - X) - S1 * H3), Z = Hh * p.Z % P * q.Z % P;
  return { X, Y, Z };
}
const toJ = a => ({ X: a.x, Y: a.y, Z: 1n });
function toA(p) { if (p.Z === 0n) return null; const zi = inv(p.Z), zi2 = zi * zi % P; return { x: p.X * zi2 % P, y: p.Y * zi2 % P * zi % P }; }
function mulG(k) { return toA(mul2(k, null, 0n)); }
// u1*G + u2*Q with Shamir's trick (one shared double-and-add pass)
function mul2(u1, Q, u2) {
  const g = toJ(G), q = Q ? toJ(Q) : J0, gq = Q ? jadd(g, q) : g;
  let r = J0; const bits = Math.max(u1.toString(2).length, u2.toString(2).length);
  for (let i = bits - 1; i >= 0; i--) {
    r = jdbl(r); const b1 = (u1 >> BigInt(i)) & 1n, b2 = (u2 >> BigInt(i)) & 1n;
    if (b1 && b2) r = jadd(r, gq); else if (b1) r = jadd(r, g); else if (b2) r = jadd(r, q);
  }
  return r;
}
function liftX(x) { if (x >= P) return null; const c = md(x * x % P * x + 7n); const y = powm(c, (P + 1n) / 4n, P); if (y * y % P !== c) return null; return { x, y: y & 1n ? P - y : y }; }
function decodePub(b) {
  if (b.length === 33 && (b[0] === 2 || b[0] === 3)) { const p = liftX(b2n(b.slice(1))); if (!p) return null; return (p.y & 1n) === BigInt(b[0] & 1) ? p : { x: p.x, y: P - p.y }; }
  if (b.length === 65 && b[0] === 4) return { x: b2n(b.slice(1, 33)), y: b2n(b.slice(33)) };
  return null;
}
const encodePub = p => cat(Uint8Array.of(p.y & 1n ? 3 : 2), n2b(p.x));
function parseDER(sig) {
  // strict-enough DER: 30 len 02 rlen r 02 slen s
  if (sig[0] !== 0x30) return null; let i = 2;
  if (sig[i++] !== 2) return null; const rl = sig[i++]; const r = b2n(sig.slice(i, i + rl)); i += rl;
  if (sig[i++] !== 2) return null; const sl = sig[i++]; const s = b2n(sig.slice(i, i + sl));
  return { r, s };
}
function ecdsaVerify(msg32, rs, pub) {
  const { r, s } = rs; if (r <= 0n || r >= N || s <= 0n || s >= N) return false;
  const z = b2n(msg32), w = inv(s, N), u1 = z * w % N, u2 = r * w % N;
  const R = toA(mul2(u1, pub, u2)); return !!R && md(R.x, N) === r;
}
function encodeDER(r, s) {
  const enc = n => { let b = n2b(n).slice(0); let i = 0; while (i < b.length - 1 && b[i] === 0) i++; b = b.slice(i); if (b[0] & 0x80) b = cat(Uint8Array.of(0), b); return cat(Uint8Array.of(2, b.length), b); };
  const body = cat(enc(r), enc(s)); return cat(Uint8Array.of(0x30, body.length), body);
}
// signing for the simulated wallets (deterministic nonce derived from key+message; low-S as policy requires)
function ecdsaSign(msg32, priv) {
  const z = b2n(msg32);
  for (let ctr = 0; ; ctr++) {
    const k = md(b2n(sha256(cat(n2b(priv), msg32, u32le(ctr)))), N); if (k === 0n) continue;
    const R = mulG(k); const r = md(R.x, N); if (r === 0n) continue;
    let s = inv(k, N) * (z + r * priv) % N; if (s === 0n) continue; if (s > N / 2n) s = N - s;
    return { r, s };
  }
}
function schnorrVerify(msg32, pubx32, sig64) {
  const Pp = liftX(b2n(pubx32)); if (!Pp) return false;
  const r = b2n(sig64.slice(0, 32)), s = b2n(sig64.slice(32)); if (r >= P || s >= N) return false;
  const e = md(b2n(taggedHash('BIP0340/challenge', sig64.slice(0, 32), pubx32, msg32)), N);
  const R = toA(mul2(s, Pp, md(N - e, N))); // s*G - e*P
  return !!R && (R.y & 1n) === 0n && R.x === r;
}

// ---- transactions
function parseTx(bytes) {
  let i = 0; const rd = n => { const b = bytes.slice(i, i + n); i += n; return b; };
  const rdU32 = () => { const v = bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24); i += 4; return v >>> 0; };
  const rdVar = () => { const f = bytes[i++]; if (f < 0xfd) return f; if (f === 0xfd) { const v = bytes[i] | (bytes[i + 1] << 8); i += 2; return v; } if (f === 0xfe) return rdU32(); throw new Error('varint'); };
  const rdU64 = () => { let v = 0n; for (let k = 7; k >= 0; k--) v = (v << 8n) | BigInt(bytes[i + k]); i += 8; return Number(v); };
  const version = rdU32();
  let segwit = false; if (bytes[i] === 0 && bytes[i + 1] === 1) { segwit = true; i += 2; }
  const nin = rdVar(), vin = [];
  for (let k = 0; k < nin; k++) { const prevHash = rd(32), vout = rdU32(), sl = rdVar(), scriptSig = rd(sl), sequence = rdU32(); vin.push({ txid: hex(rev(prevHash)), vout, scriptSig, sequence, witness: [] }); }
  const nout = rdVar(), vout = [];
  for (let k = 0; k < nout; k++) { const value = rdU64(), sl = rdVar(); vout.push({ value, spk: rd(sl) }); }
  if (segwit) for (const inp of vin) { const n = rdVar(); for (let k = 0; k < n; k++) inp.witness.push(rd(rdVar())); }
  const locktime = rdU32();
  const tx = { version, vin, vout, locktime, segwit };
  const base = serializeTx(tx, false), total = segwit ? serializeTx(tx, true) : base;
  tx.txid = hex(rev(sha256d(base))); tx.wtxid = hex(rev(sha256d(total)));
  tx.weight = base.length * 3 + total.length; tx.vsize = Math.ceil(tx.weight / 4); tx.size = total.length;
  return tx;
}
function serializeTx(tx, withWitness) {
  const parts = [u32le(tx.version)];
  const wit = withWitness && tx.vin.some(v => v.witness.length);
  if (wit) parts.push(Uint8Array.of(0, 1));
  parts.push(varint(tx.vin.length));
  for (const v of tx.vin) parts.push(rev(unhex(v.txid)), u32le(v.vout), varint(v.scriptSig.length), v.scriptSig, u32le(v.sequence));
  parts.push(varint(tx.vout.length));
  for (const o of tx.vout) parts.push(u64le(o.value), varint(o.spk.length), o.spk);
  if (wit) for (const v of tx.vin) { parts.push(varint(v.witness.length)); for (const w of v.witness) parts.push(varint(w.length), w); }
  parts.push(u32le(tx.locktime));
  return cat(...parts);
}
function scriptType(spk) {
  const h = hex(spk);
  if (spk.length === 22 && h.startsWith('0014')) return 'p2wpkh';
  if (spk.length === 34 && h.startsWith('0020')) return 'p2wsh';
  if (spk.length === 34 && h.startsWith('5120')) return 'p2tr';
  if (spk.length === 25 && h.startsWith('76a914') && h.endsWith('88ac')) return 'p2pkh';
  if (spk.length === 23 && h.startsWith('a914') && h.endsWith('87')) return 'p2sh';
  if (spk[0] === 0x6a) return 'op_return';
  return 'other';
}
function parsePushes(script) { const out = []; let i = 0; while (i < script.length) { const op = script[i++]; let n; if (op > 0 && op < 0x4c) n = op; else if (op === 0x4c) n = script[i++]; else if (op === 0x4d) { n = script[i] | (script[i + 1] << 8); i += 2; } else { out.push({ op }); continue; } out.push(script.slice(i, i + n)); i += n; } return out; }
// legacy sighash (SIGHASH_ALL family) for P2PKH
function sighashLegacy(tx, idx, scriptCode, ht) {
  const anyone = ht & 0x80, base = ht & 0x1f; if (base !== 1) return null;
  const ins = anyone ? [tx.vin[idx]] : tx.vin;
  const parts = [u32le(tx.version), varint(ins.length)];
  ins.forEach(v => { const me = v === tx.vin[idx]; parts.push(rev(unhex(v.txid)), u32le(v.vout), varint(me ? scriptCode.length : 0), me ? scriptCode : new Uint8Array(0), u32le(v.sequence)); });
  parts.push(varint(tx.vout.length)); tx.vout.forEach(o => parts.push(u64le(o.value), varint(o.spk.length), o.spk));
  parts.push(u32le(tx.locktime), u32le(ht));
  return sha256d(cat(...parts));
}
// BIP143 segwit v0 sighash
function sighashBIP143(tx, idx, scriptCode, amount, ht) {
  const anyone = ht & 0x80, base = ht & 0x1f, zero = new Uint8Array(32);
  const hashPrevouts = anyone ? zero : sha256d(cat(...tx.vin.map(v => cat(rev(unhex(v.txid)), u32le(v.vout)))));
  const hashSequence = anyone || base !== 1 ? zero : sha256d(cat(...tx.vin.map(v => u32le(v.sequence))));
  const outs = o => cat(u64le(o.value), varint(o.spk.length), o.spk);
  const hashOutputs = base === 1 ? sha256d(cat(...tx.vout.map(outs))) : base === 3 && idx < tx.vout.length ? sha256d(outs(tx.vout[idx])) : zero;
  const v = tx.vin[idx];
  const pre = cat(u32le(tx.version), hashPrevouts, hashSequence, rev(unhex(v.txid)), u32le(v.vout), varint(scriptCode.length), scriptCode, u64le(amount), u32le(v.sequence), hashOutputs, u32le(tx.locktime), u32le(ht));
  return { digest: sha256d(pre), preimage: pre };
}
// BIP341 taproot key-path sighash (SIGHASH_DEFAULT / ALL)
function sighashBIP341(tx, idx, prevouts, ht) {
  if (ht !== 0 && ht !== 1) return null;
  const shaPrevouts = sha256(cat(...tx.vin.map(v => cat(rev(unhex(v.txid)), u32le(v.vout)))));
  const shaAmounts = sha256(cat(...prevouts.map(p => u64le(p.value))));
  const shaSpks = sha256(cat(...prevouts.map(p => cat(varint(p.spk.length), p.spk))));
  const shaSeqs = sha256(cat(...tx.vin.map(v => u32le(v.sequence))));
  const shaOuts = sha256(cat(...tx.vout.map(o => cat(u64le(o.value), varint(o.spk.length), o.spk))));
  const annex = tx.vin[idx].witness.length > 1 && tx.vin[idx].witness[tx.vin[idx].witness.length - 1][0] === 0x50;
  if (annex) return null;
  const msg = cat(Uint8Array.of(0, ht), u32le(tx.version), u32le(tx.locktime), shaPrevouts, shaAmounts, shaSpks, shaSeqs, shaOuts, Uint8Array.of(0), u32le(idx));
  return taggedHash('TapSighash', msg);
}
// verify one input; returns a step-by-step record for the inspector
function verifyInput(tx, idx, prevouts) {
  const v = tx.vin[idx], prev = prevouts[idx], type = scriptType(prev.spk);
  const R = { idx, type, steps: [], ok: false, algo: '' };
  const step = (ok, msg) => { R.steps.push({ ok, msg }); return ok; };
  const htName = ht => ({ 0: 'DEFAULT', 1: 'ALL', 2: 'NONE', 3: 'SINGLE', 0x81: 'ALL|ANYONECANPAY', 0x82: 'NONE|ANYONECANPAY', 0x83: 'SINGLE|ANYONECANPAY' }[ht] || '0x' + ht.toString(16));
  try {
    if (type === 'p2wpkh' || (type === 'p2sh' && v.scriptSig.length === 23 && v.scriptSig[1] === 0 && v.scriptSig[2] === 0x14)) {
      if (type === 'p2sh') { const redeem = v.scriptSig.slice(1); if (!step(bytesEq(hash160(redeem), prev.spk.slice(2, 22)), 'HASH160(redeem script) matches the P2SH output')) return R; R.type = 'p2sh-p2wpkh'; }
      const prog = type === 'p2sh' ? v.scriptSig.slice(3, 23) : prev.spk.slice(2, 22);
      const [sigB, pubB] = v.witness; if (!sigB || !pubB) { step(false, 'witness must be [signature, pubkey]'); return R; }
      R.pubkey = hex(pubB);
      if (!step(bytesEq(hash160(pubB), prog), `HASH160(pubkey) = ${hex(prog).slice(0, 12)}… matches the locking script`)) return R;
      const ht = sigB[sigB.length - 1], rs = parseDER(sigB.slice(0, -1)); const pub = decodePub(pubB);
      if (!rs || !pub) { step(false, 'malformed signature or pubkey'); return R; }
      const scriptCode = unhex('76a914' + hex(prog) + '88ac');
      const { digest } = sighashBIP143(tx, idx, scriptCode, prev.value, ht);
      R.algo = 'BIP143 sighash · ECDSA'; R.sighash = hex(digest); R.sig = { r: rs.r.toString(16).padStart(64, '0'), s: rs.s.toString(16).padStart(64, '0'), ht: htName(ht) };
      step(true, `sighash (BIP143, ${htName(ht)}) commits to amount ${fmt(prev.value)} sat = ${hex(digest).slice(0, 16)}…`);
      R.ok = step(ecdsaVerify(digest, rs, pub), 'ECDSA signature valid for this pubkey and sighash');
    } else if (type === 'p2pkh') {
      const pushes = parsePushes(v.scriptSig); const [sigB, pubB] = pushes;
      if (!(sigB instanceof Uint8Array) || !(pubB instanceof Uint8Array)) { step(false, 'scriptSig must be <sig> <pubkey>'); return R; }
      R.pubkey = hex(pubB);
      if (!step(bytesEq(hash160(pubB), prev.spk.slice(3, 23)), 'HASH160(pubkey) matches OP_DUP OP_HASH160 <hash> OP_EQUALVERIFY')) return R;
      const ht = sigB[sigB.length - 1], rs = parseDER(sigB.slice(0, -1)), pub = decodePub(pubB);
      const digest = sighashLegacy(tx, idx, prev.spk, ht);
      if (!digest || !rs || !pub) { step(false, 'unsupported sighash type or malformed data'); return R; }
      R.algo = 'legacy sighash · ECDSA'; R.sighash = hex(digest); R.sig = { r: rs.r.toString(16).padStart(64, '0'), s: rs.s.toString(16).padStart(64, '0'), ht: htName(ht) };
      step(true, `legacy sighash (${htName(ht)}) = ${hex(digest).slice(0, 16)}…`);
      R.ok = step(ecdsaVerify(digest, rs, pub), 'ECDSA signature valid (OP_CHECKSIG)');
    } else if (type === 'p2tr') {
      if (v.witness.length !== 1) { step(false, 'script-path spend: not verified by this page'); R.unsupported = true; return R; }
      const sigB = v.witness[0]; const ht = sigB.length === 65 ? sigB[64] : 0;
      const digest = sighashBIP341(tx, idx, prevouts, ht);
      if (!digest) { step(false, 'unsupported taproot sighash type'); R.unsupported = true; return R; }
      R.algo = 'BIP341 sighash · Schnorr (BIP340)'; R.sighash = hex(digest); R.pubkey = hex(prev.spk.slice(2));
      R.sig = { r: hex(sigB.slice(0, 32)), s: hex(sigB.slice(32, 64)), ht: htName(ht) };
      step(true, `key-path spend; sighash commits to every input's amount and script = ${hex(digest).slice(0, 16)}…`);
      R.ok = step(schnorrVerify(digest, prev.spk.slice(2, 34), sigB.slice(0, 64)), 'Schnorr signature valid for the output key');
    } else { step(false, `${type} inputs are not verified by this page`); R.unsupported = true; }
  } catch (e) { step(false, 'error: ' + e.message); }
  return R;
}
// build & sign a P2WPKH spend for the simulated wallets
function makeWalletKey(seed) { const priv = md(b2n(sha256(new TextEncoder().encode('sim-wallet:' + seed))), N); const pub = encodePub(mulG(priv)); return { priv, pub, h160: hash160(pub), spk: unhex('0014' + hex(hash160(pub))) }; }
function signP2WPKH(inputs, outputs) {
  // inputs: [{txid, vout, value, key}], outputs: [{value, spk}]
  const tx = { version: 2, vin: inputs.map(i => ({ txid: i.txid, vout: i.vout, scriptSig: new Uint8Array(0), sequence: 0xfffffffd, witness: [] })), vout: outputs, locktime: 0, segwit: true };
  inputs.forEach((inp, idx) => {
    const scriptCode = unhex('76a914' + hex(inp.key.h160) + '88ac');
    const { digest } = sighashBIP143(tx, idx, scriptCode, inp.value, 1);
    const { r, s } = ecdsaSign(digest, inp.key.priv);
    tx.vin[idx].witness = [cat(encodeDER(r, s), Uint8Array.of(1)), inp.key.pub];
  });
  return serializeTx(tx, true);
}
