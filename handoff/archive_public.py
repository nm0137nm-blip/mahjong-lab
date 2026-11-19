"""Archive explicitly listed, already-public Actions artifacts. Never overwrite a differing file."""
import hashlib,json,os, pathlib,urllib.request,zipfile,io
ROOT=pathlib.Path(__file__).resolve().parents[1]
state=json.loads((ROOT/'handoff/state.json').read_text())
assert state['archive_policy']['public_only'] and not state['archive_policy']['raw_private_data']
def sha(x):return hashlib.sha256(x).hexdigest()
def download(a):
    # Disable token forwarding across hosts by using an explicit first redirect.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self,*args,**kwargs):return None
    req=urllib.request.Request('https://api.github.com/repos/'+state['repository']+'/actions/artifacts/'+str(a)+'/zip',headers={'Authorization':'Bearer '+os.environ['GH_TOKEN'],'Accept':'application/vnd.github+json'})
    try:
        with urllib.request.build_opener(NoRedirect).open(req,timeout=60) as r:return r.read()
    except urllib.error.HTTPError as e:
        if e.code not in (301,302,303,307,308):raise
        url=e.headers['Location']
        if not url.startswith('https://'):raise RuntimeError('non-https download')
        with urllib.request.urlopen(url,timeout=120) as r:return r.read()
def store(p,b):
    p=ROOT/p
    if p.exists():
        assert p.read_bytes()==b, 'immutable archive mismatch: '+str(p)
    else:
        p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
for model in state['models']:
    dest=pathlib.Path(model['archive_target'])
    names={k+'.lgb':h for k,h in model['hashes'].items()}
    if all((ROOT/dest/k).exists() and sha((ROOT/dest/k).read_bytes())==h for k,h in names.items()) and (ROOT/dest/'freeze.json').exists():
        print('verified existing',model['id']);continue
    blob=download(model['artifact_id'])
    assert sha(blob)==model['zip_sha256']
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        assert set(z.namelist())==set(names)|{'freeze.json'}
        for k,h in names.items():
            b=z.read(k);assert sha(b)==h;store(dest/k,b)
        f=z.read('freeze.json');json.loads(f);store(dest/'freeze.json',f)
    print('archived',model['id'])
dest=pathlib.Path('archive/results/threeway-fixed-100-20261119.json')
if not (ROOT/dest).exists():
    blob=download(14533213685)
    assert sha(blob)=='02d8f2f1103399054e77a3d6cc1623e15e3016a7e5a6ed7c94f633c4be254fd1'
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        assert z.namelist()==['threeway-results.json']
        b=z.read('threeway-results.json');json.loads(b);store(dest,b)
print('public artifact archive verified')
