"""Inspect exact already-public corrected encoder archive and preserve source (not executable)."""
import hashlib, io, zipfile, tarfile, json, os, pathlib, urllib.request, urllib.error
root=pathlib.Path(__file__).resolve().parents[1]
e=json.loads((root/'archive/results/phase0-corrected-20261120.json').read_text())['encoder']
sha=lambda b:hashlib.sha256(b).hexdigest()
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*a,**k):return None
req=urllib.request.Request('https://api.github.com/repos/nm0137nm-blip/mahjong-lab/actions/artifacts/'+str(e['artifact_id'])+'/zip',headers={'Authorization':'Bearer '+os.environ['GH_TOKEN'],'Accept':'application/vnd.github+json'})
try:
    with urllib.request.build_opener(NoRedirect).open(req,timeout=60) as rr:blob=rr.read()
except urllib.error.HTTPError as err:
    assert err.code in (301,302,303,307,308) and err.headers['Location'].startswith('https://')
    with urllib.request.urlopen(err.headers['Location'],timeout=120) as rr:blob=rr.read()
assert sha(blob)==e['zip_sha256']
with zipfile.ZipFile(io.BytesIO(blob)) as z:
    found={}
    for name,key in [('encoder.js','js_sha256'),('encoder_bg.wasm','wasm_sha256'),('encoder-corresponding-source.tar.gz','source_tar_sha256')]:
        a=[p for p in z.namelist() if pathlib.PurePosixPath(p).name==name]
        assert len(a)==1
        b=z.read(a[0]); assert sha(b)==e[key];found[name]=b
source=found['encoder-corresponding-source.tar.gz']
with tarfile.open(fileobj=io.BytesIO(source),mode='r:gz') as t:
    names=set(t.getnames())
    required={'browser-encoder/Cargo.toml','browser-encoder/Cargo.lock','browser-encoder/LICENSE','browser-encoder/BUILD-ENV.txt','browser-encoder/src/lib.rs'}
    assert required<=names
    assert all(not p.startswith('/') and '..' not in pathlib.PurePosixPath(p).parts for p in names)
    assert all(m.isdir() or m.isfile() for m in t.getmembers())
    lib=t.extractfile('browser-encoder/src/lib.rs').read()
    assert b'clone_state' in lib and b'encode_kan_state' in lib
    env=t.extractfile('browser-encoder/BUILD-ENV.txt').read().decode()
    print(env)
    t.extractall('/tmp/phase0-source',filter='data')
dest=root/'archive/versions/s42-corrected-encoder-v1'
dest.mkdir(parents=True,exist_ok=True)
for p,b in [(dest/'encoder-corresponding-source.tar.gz',source),(dest/'BUILD-ENV.txt',env.encode())]:
    if p.exists():assert p.read_bytes()==b
    else:p.write_bytes(b)
print(json.dumps({'status':'source_archive_verified','source_tar_sha256':sha(source),'members':len(names),'binary_hashes_checked':True},indent=2))
