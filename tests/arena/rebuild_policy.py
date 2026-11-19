"""Rebuild 200-game LightGBM policy on CI from its fixed training artifacts.
No validation / final holdout / new opponent corpus is downloaded here.
"""
import hashlib,io,json,os,zipfile,time,requests
from pathlib import Path
import lightgbm as lgb
import numpy as np
from policy_features import public_features
PAIRS=[(14429527861,14429108662),(14430885198,14429867902),(14429388006,14429702066),(14429168308,14429487544),(14430506255,14429424368),(14429194653,14429163404),(14431150470,14430103079),(14431155620,14430671697),(14509506737,14508284908),(14509084068,14509960724),(14509438094,14509088835),(14509576388,14508953910),(14509334641,14510370934),(14509906917,14510390791),(14509433221,14508784762),(14510570370,14509499456),(14508978825,14510161142),(14510376604,14510296932),(14510990316,14510192619),(14510278160,14510616796)]
# The 4th old training shard's reference artifact is pinned explicitly.
PAIRS[3]=(14429168308,14429487544)
EXPECTED={
'pure':('ed615d9b1536e760291daa1ffe3d74a3f45df72ae37c5d813247bfc1443c45c7','46fe94fc1d46d1e2392d29460be1c24abf78e7db422b83d1bd00b53b6d655a50','ac73dc7609a650274a5a43fb2a19302841f6038c769edb784162d3911bebd65d','7230e2c857285fb274008dfbca392b33eedc5889e3724c042b1e4600aa0f3e2e','b4ff0a420061b1202e0d7717c7cdea4d6ef7ac0971fff45e0e70f1a49da8edd8'),
'reaction':('4b4289d3890573cad9a6bc15a539e70f1733a09fa14e472bdf925e5ca8aac05f','6cab4e11db9fb81fc6ff7cd349bc41e954c6d61e67997362af9d63ca0c9bed42','a6a973fc8e09c948c48f244f3dca121d82991c0765878dd34821099c6855715c','544226e7d70dea6cbc7fa76710c52080e1ef8895a1e1e9f1b2282e1617e392dd','11d5699e20319f23040a9e7584e25179615ca8228089de0dce38c527dd7aa42f'),
'special':('9f9a312dfcb0d1c01fed8c0f5742e2f18f5563fa2c6fd4084c1c711f376db033','34c3746cebd55f86dbefea0a65299dba6e7f8f404f8efe9ac608e9576e7131eb','46bfce7e2cd546ffa2bfc431846667020c564751fedb40f655562a0e4da823b7','0506eb179cb70616f38efd3d2aef256eacac307ca09e20419eebc717ec03bf10','0617e41120d1918d69302bf564d294659692e4c35d2a8015c162d003b94a2ff5')}
MODEL_SHA='30381bf21389e2d25d3edf48fed11bf772336ef3daeee67d1bdae7fb9dd30cb4'
def digest(x,dtype):return hashlib.sha256(np.ascontiguousarray(x,dtype=dtype).tobytes()).hexdigest()
def load(id,name):
 root=Path(os.environ.get('ARENA_TRAIN_CACHE','/tmp/arena-train'));root.mkdir(exist_ok=True,parents=True);p=root/f'{id}.zip'
 if not p.exists():
  url=f'https://api.github.com/repos/{os.environ["GITHUB_REPOSITORY"]}/actions/artifacts/{id}/zip'
  for attempt in range(3):
   try:
    r=requests.get(url,headers={'Authorization':f'Bearer {os.environ["GH_TOKEN"]}','Accept':'application/vnd.github+json'},allow_redirects=False,timeout=40)
    if r.status_code in (301,302,303,307,308):
     r=requests.get(r.headers['Location'],timeout=120)
    r.raise_for_status();p.write_bytes(r.content);break
   except Exception:
    if attempt==2:raise
    time.sleep(2)
 with zipfile.ZipFile(p) as z:return json.loads(z.read(name))
def get_rows():
 out={c:[] for c in EXPECTED}
 seen=set()
 for shard,(qid,rid) in enumerate(PAIRS):
  qs=load(qid,'blind.json')['items'];refs=load(rid,'reference.json')
  by={r['id']:r for r in refs};assert len(by)==len(refs)==len(qs)
  for x in qs:
   # IDs from different collection batches can share a string; shard is part of identity.
   k=(shard,x['id']);assert k not in seen;seen.add(k)
   c,X,a=public_features(x)
   ref=by[x['id']];assert ref['model_sha256']==MODEL_SHA
   assert set(a)=={j for j,v in enumerate(ref['q']) if v is not None}
   q=np.array([ref['q'][int(j)] for j in a],dtype=np.float64)
   loss=(q.max()-q)/max(1e-6,q.max()-q.min())
   label=np.maximum(0,np.floor(19*(1-loss))).astype(int)+(loss<1e-9)
   out[c].append((X,a,label))
  print('training shard',shard,'decisions',len(qs),flush=True)
 return out
def main():
 path=Path('/tmp/arena-model');path.mkdir(exist_ok=True)
 result={'source_pairs':PAIRS,'versions':{'numpy':np.__version__,'lightgbm':lgb.__version__},'models':{}}
 for cat,rows in get_rows().items():
  X=np.concatenate([x[0] for x in rows]);acts=np.concatenate([x[1] for x in rows]);labels=np.concatenate([x[2] for x in rows]);groups=np.array([len(x[1]) for x in rows])
  hashes=[digest(X,'<f8'),digest(groups,'<i4'),digest(labels,'<i4')]
  assert hashes==list(EXPECTED[cat][:3]),(cat,'training feature parity failed',hashes)
  pars=dict(n_estimators=160 if cat=='pure' else 100,num_leaves=31 if cat=='pure' else 15,min_child_samples=50 if cat=='pure' else 30,reg_lambda=2 if cat=='pure' else 3)
  m=lgb.LGBMRanker(objective='lambdarank',label_gain=list(range(21)),learning_rate=.05,n_jobs=3,random_state=259,verbosity=-1,lambdarank_truncation_level=5,**pars)
  m.fit(X,labels,group=groups);p=path/f'{cat}.lgb';m.booster_.save_model(str(p))
  score=m.predict(X);score[acts==43]=1e6
  picks=[];i=0
  for n in groups:picks.append(acts[i+score[i:i+n].argmax()]);i+=n
  predhash=digest(picks,'<i4'); modelhash=hashlib.sha256(p.read_bytes()).hexdigest()
  result['models'][cat]={'decisions':len(groups),'feature_hashes':hashes,'choice_hash':predhash,'choice_parity':predhash==EXPECTED[cat][3],'model_hash':modelhash,'byte_parity':modelhash==EXPECTED[cat][4]}
  print('ARENA_FREEZE',cat,result['models'][cat],flush=True)
  assert predhash==EXPECTED[cat][3],(cat,'training choice parity failure')
 (path/'freeze.json').write_text(json.dumps(result,indent=2))
if __name__=='__main__':main()
