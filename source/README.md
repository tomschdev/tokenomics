# Bitcoin PoW Sky Mine (artifact version 10)

A 3D simulation of Bitcoin proof-of-work: four real mining pools as nodes, each with its own
UTXO-state cube, mempool pool, block tower and a voxel worker who fills, checks and hand-cranks
candidate blocks. Wallet owners on a platform throw signed transactions to the pools.

## Run it
Open `dist/bitcoin-pow-workshop.html` in any modern browser. It loads Three.js r128 from
cdnjs and OrbitControls from jsDelivr, and fetches live data from mempool.space when it can.
`dist/artifact-page.html` is the same page without the outer <html> skeleton (the form the
claude.ai artifact host expects).

## Rebuild
`python3 build.py` concatenates everything into the two files in `dist/`.

## Files
- `src/src3.html`: page shell, CSS, panels; scripts are inlined at `/*__JS__*/`.
- `src/sha.js`: SHA-256 with midstate, header building, round tracer.
- `src/btc.js`: RIPEMD-160, secp256k1 (ECDSA + BIP340 Schnorr), tx parser, legacy/BIP143/BIP341 sighash, input verification, wallet signing.
- `src/core3.js`: network simulation (per-node mempools, gossip, RBF, block templates, crank-driven hashing with nonce 0–100, block validation, forks/reorgs, live data).
- `src/env.js`: floating islands, valley, rainbows, sparkles, coin colours by owner.
- `src/scene3.js`: Three.js world (nodes, state cubes, pools, towers, arcs, labels, camera).
- `src/workers.js`: candidate block, ₿ hard-hat workers, crank, cord, hash readout, zero scale, verification threads, whitepaper board, wallet platform and people, bech32 addresses.
- `src/details.js`: the node details panel (block outline, nonce reels, target-range gauge).
- `src/main3.js`: boot, main loop, controls.
- `data/snapshot.json`: real chain tip, pools, difficulty and 28 real mempool transactions (raw bytes + prevouts) captured 2026-10-31 20:45 UTC.
