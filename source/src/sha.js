// ---- SHA-256 (FIPS 180-4) with midstate support, as used by Bitcoin miners ----
const K256 = new Uint32Array([
0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
const H0 = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
const _W = new Uint32Array(64);
// compress one 16-word block into a copy of `st`, writing result to `out`
function compress(st, blk, out){
  const W=_W; for(let i=0;i<16;i++) W[i]=blk[i];
  for(let i=16;i<64;i++){ const a=W[i-15], b=W[i-2];
    const s0=((a>>>7)|(a<<25))^((a>>>18)|(a<<14))^(a>>>3);
    const s1=((b>>>17)|(b<<15))^((b>>>19)|(b<<13))^(b>>>10);
    W[i]=(W[i-16]+s0+W[i-7]+s1)|0; }
  let a=st[0],b=st[1],c=st[2],d=st[3],e=st[4],f=st[5],g=st[6],h=st[7];
  for(let i=0;i<64;i++){
    const S1=((e>>>6)|(e<<26))^((e>>>11)|(e<<21))^((e>>>25)|(e<<7));
    const t1=(h+S1+((e&f)^(~e&g))+K256[i]+W[i])|0;
    const S0=((a>>>2)|(a<<30))^((a>>>13)|(a<<19))^((a>>>22)|(a<<10));
    const t2=(S0+((a&b)^(a&c)^(b&c)))|0;
    h=g; g=f; f=e; e=(d+t1)|0; d=c; c=b; b=a; a=(t1+t2)|0; }
  out[0]=(st[0]+a)|0; out[1]=(st[1]+b)|0; out[2]=(st[2]+c)|0; out[3]=(st[3]+d)|0;
  out[4]=(st[4]+e)|0; out[5]=(st[5]+f)|0; out[6]=(st[6]+g)|0; out[7]=(st[7]+h)|0;
}
// general SHA-256 of a byte array -> Uint8Array(32)
function sha256(bytes){
  const n=bytes.length, nb=((n+9+63)>>6), buf=new Uint8Array(nb*64);
  buf.set(bytes); buf[n]=0x80; const bits=n*8;
  buf[nb*64-4]=(bits>>>24)&255; buf[nb*64-3]=(bits>>>16)&255; buf[nb*64-2]=(bits>>>8)&255; buf[nb*64-1]=bits&255;
  buf[nb*64-5]=Math.floor(bits/2**32)&255;
  let st=new Uint32Array(H0); const blk=new Uint32Array(16), out=new Uint32Array(8);
  for(let k=0;k<nb;k++){ for(let i=0;i<16;i++){const o=k*64+i*4; blk[i]=(buf[o]<<24)|(buf[o+1]<<16)|(buf[o+2]<<8)|buf[o+3];}
    compress(st,blk,out); st.set(out); }
  const r=new Uint8Array(32); for(let i=0;i<8;i++){r[i*4]=st[i]>>>24;r[i*4+1]=(st[i]>>>16)&255;r[i*4+2]=(st[i]>>>8)&255;r[i*4+3]=st[i]&255;}
  return r;
}
const sha256d = b => sha256(sha256(b));
const hex = b => Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
const unhex = s => { const r=new Uint8Array(s.length/2); for(let i=0;i<r.length;i++) r[i]=parseInt(s.substr(i*2,2),16); return r; };
const rev = b => Uint8Array.from(b).reverse();
const bswap = x => (((x&255)<<24)|(((x>>>8)&255)<<16)|(((x>>>16)&255)<<8)|(x>>>24))>>>0;
function le32(arr,off,v){ arr[off]=v&255; arr[off+1]=(v>>>8)&255; arr[off+2]=(v>>>16)&255; arr[off+3]=(v>>>24)&255; }

// 80-byte header. prev/merkle given in display (big-endian) hex, stored reversed (internal order)
function buildHeader(version, prevHex, merkleHex, time, bits, nonce){
  const h=new Uint8Array(80); le32(h,0,version); h.set(rev(unhex(prevHex)),4); h.set(rev(unhex(merkleHex)),36);
  le32(h,68,time); le32(h,72,bits); le32(h,76,nonce); return h;
}
// Miner fast path: midstate of the first 64 bytes is computed once per template;
// each nonce costs 2 compressions (chunk 2 of pass 1, then pass 2).
function makeHasher(header){
  const blk1=new Uint32Array(16); for(let i=0;i<16;i++){const o=i*4; blk1[i]=(header[o]<<24)|(header[o+1]<<16)|(header[o+2]<<8)|header[o+3];}
  const mid=new Uint32Array(8); compress(H0,blk1,mid);
  const blk2=new Uint32Array(16); for(let i=0;i<4;i++){const o=64+i*4; blk2[i]=(header[o]<<24)|(header[o+1]<<16)|(header[o+2]<<8)|header[o+3];}
  blk2[4]=0x80000000; blk2[15]=640;
  const s1=new Uint32Array(8), blk3=new Uint32Array(16), s2=new Uint32Array(8);
  blk3[8]=0x80000000; blk3[15]=256;
  return { mid, s2,
    setTime(t){ blk2[1]=bswap(t)|0; },
    // returns s2 (8 words, digest big-endian words). Number value = digest bytes reversed.
    hash(nonce){ blk2[3]=bswap(nonce)|0; compress(mid,blk2,s1); for(let i=0;i<8;i++) blk3[i]=s1[i]; compress(H0,blk3,s2); return s2; } };
}
// digest words -> display hex (reversed byte order, as block explorers show)
function digestDisplayHex(s){ let out=''; for(let i=7;i>=0;i--){ const w=bswap(s[i]); out+=w.toString(16).padStart(8,'0'); } return out; }
// top 32 bits of the hash-as-number are bswap(s[7]); count leading zero bits
function leadingZeroBits(s){ let z=0; for(let i=7;i>=0;i--){ const w=bswap(s[i]); if(w===0){z+=32;continue;} return z+Math.clz32(w);} return 256; }
function bitsToTargetHex(bits){ const exp=bits>>>24, mant=bits&0xffffff; return (BigInt(mant)<<BigInt(8*(exp-3))).toString(16).padStart(64,'0'); }

// Instrumented compression for the under-the-hood view: records every round.
function traceCompress(st, blk) {
  const W = new Uint32Array(64); for (let i = 0; i < 16; i++) W[i] = blk[i];
  for (let i = 16; i < 64; i++) { const a = W[i-15], b = W[i-2];
    const s0 = ((a>>>7)|(a<<25))^((a>>>18)|(a<<14))^(a>>>3);
    const s1 = ((b>>>17)|(b<<15))^((b>>>19)|(b<<13))^(b>>>10);
    W[i] = (W[i-16]+s0+W[i-7]+s1)|0; }
  let a=st[0],b=st[1],c=st[2],d=st[3],e=st[4],f=st[5],g=st[6],h=st[7];
  const states = [Uint32Array.of(a,b,c,d,e,f,g,h)], rounds = [];
  for (let i = 0; i < 64; i++) {
    const S1=((e>>>6)|(e<<26))^((e>>>11)|(e<<21))^((e>>>25)|(e<<7));
    const ch=(e&f)^(~e&g);
    const t1=(h+S1+ch+K256[i]+W[i])|0;
    const S0=((a>>>2)|(a<<30))^((a>>>13)|(a<<19))^((a>>>22)|(a<<10));
    const maj=(a&b)^(a&c)^(b&c);
    const t2=(S0+maj)|0;
    rounds.push({ S1:S1>>>0, ch:ch>>>0, t1:t1>>>0, S0:S0>>>0, maj:maj>>>0, t2:t2>>>0, h:h>>>0, K:K256[i], W:W[i]>>>0 });
    h=g; g=f; f=e; e=(d+t1)|0; d=c; c=b; b=a; a=(t1+t2)|0;
    states.push(Uint32Array.of(a,b,c,d,e,f,g,h));
  }
  const out = new Uint32Array(8); const fin = states[64];
  for (let i = 0; i < 8; i++) out[i] = (st[i] + fin[i]) | 0;
  return { W, states, rounds, init: Uint32Array.from(st), out };
}
