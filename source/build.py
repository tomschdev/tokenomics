# Rebuilds the page from src/ and data/. Usage: python3 build.py
import json, os
here = os.path.dirname(os.path.abspath(__file__))
rd = lambda *p: open(os.path.join(here, *p), encoding='utf-8').read()
src = rd('src', 'src3.html')
d = json.loads(rd('data', 'snapshot.json')); snap = dict(d['meta']); snap['txs'] = d['txs']
js = rd('src', 'sha.js') + '\n' + rd('src', 'btc.js') + '\nconst SNAP = ' + json.dumps(snap, separators=(',', ':')) + ';\n' + ''.join(rd('src', f) + '\n' for f in ['core3.js', 'env.js', 'scene3.js', 'workers.js', 'details.js', 'main3.js'])
out = src.replace('/*__JS__*/', js)
os.makedirs(os.path.join(here, 'dist'), exist_ok=True)
open(os.path.join(here, 'dist', 'artifact-page.html'), 'w', encoding='utf-8').write(out)
open(os.path.join(here, 'dist', 'bitcoin-pow-workshop.html'), 'w', encoding='utf-8').write('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png"><link rel="apple-touch-icon" href="apple-touch-icon.png"></head><body>' + out + '</body></html>')
# The GitHub Pages site: the artifact host's page shell (with favicon links) around the page.
open(os.path.join(here, '..', 'index.html'), 'w', encoding='utf-8').write(rd('src', 'page-head.html') + out + '</body></html>')
print('built', len(out), 'bytes')
