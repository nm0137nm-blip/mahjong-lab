import hashlib, json, os, sys, time, zipfile, itertools, subprocess, math
from pathlib import Path
import numpy as np
import torch
from torch import nn
from sklearn.model_selection import GroupKFold
from scipy.optimize import minimize_scalar
torch.set_num_threads(1)
torch.manual_seed(261124)
P=list(itertools.permutations(range(4)))
# permutations contain players in descending rank order
R=np.argsort(P,axis=1)
M=np.eye(4)[R]
plan=json.loads(Path('handoff/q1/prereg-dev-20261124.json').read_text())
root=Path('/tmp/q1-data'); root.mkdir(exist_ok=True)
def seats(x,d): return [x[(p-d)%4] for p in range(4)]
def load(a):
 p=root/f"{a['shard']}.zip"
 if not p.exists():
  with p.open('wb') as f: subprocess.run(['gh','api',f"repos/{os.environ['GITHUB_REPOSITORY']}/actions/artifacts/{a['id']}/zip"],stdout=f,check=True,timeout=45)
 assert hashlib.sha256(p.read_bytes()).hexdigest()==a['digest'].split(':')[1]
 with zipfile.ZipFile(p) as z:
  m=json.loads(z.read('manifest.json')); q=json.loads(z.read('paipu.json'))
 assert m['split']=='development-only' and m['shard']==a['shard']
 r,=m['rows']; assert q['rank']==r['allRanks'] and q['score']==r['allScores']
 assert sum(q['score'])==100000
 return m,q,r
from concurrent.futures import ThreadPoolExecutor
with ThreadPoolExecutor(max_workers=6) as ex: raw=list(ex.map(load,plan['artifacts']))
assert len(raw)==96 and len(set(m['seed'] for m,q,r in raw))==96
X=[];Y=[];G=[];F=[];ST=[];H=[];counts={};audit_errors=[];n_accept=0
for m,p,r in raw:
 initial=p['qijia']; order=tuple(sorted(range(4),key=lambda j:p['rank'][j])); label=P.index(order); hist=[]
 for i,events in enumerate(p['log']):
  q=events[0]['qipai']; d=(initial+q['jushu'])%4; cur=4*q['zhuangfeng']+q['jushu']; scores=seats(q['defen'],d)
  assert sum(scores)+1000*q['lizhibang']==100000
  # Normalize to starting-dealer seat order to make tie-break deterministic.
  scores=scores[initial:]+scores[:initial]; order0=tuple((j-initial)%4 for j in order); y=P.index(order0)
  hist.append([cur/7,q['changbang']/5,q['lizhibang']/5,*[x/10000 for x in scores]])
  X.append(hist[-1]);H.append(np.array(hist,np.float32));Y.append(y);G.append(m['shard']);F.append(r['opponentFamily']);ST.append(cur)
  results=[(k,e[k]) for e in events for k in ('hule','pingju') if k in e]
  try:
   assert results
   deduct=[0]*4
   for n,e in enumerate(events):
    z=e.get('dapai')
    if z and z['p'].endswith('*'):
     nxt=events[n+1] if n+1<len(events) else {}
     if 'hule' not in nxt and nxt.get('pingju',{}).get('name')!='三家和':
      deduct[z['l']]+=1000;n_accept+=1
   post=seats([q['defen'][l]-deduct[l]+sum(e['fenpei'][l] for k,e in results) for l in range(4)],d)
   ky=(100000-sum(post))//1000
   assert ky>=0 and sum(post)+1000*ky==100000
   kind=results[0][0]
   if kind=='hule': repeat=any(e['l']==0 for k,e in results); abort=False; assert ky==0; cat='multiple_ron' if len(results)>1 else 'win'
   else:
    e=results[0][1]; cat=e['name']; abort=cat not in ('荒牌平局','流し満貫'); repeat=abort or bool(e['shoupai'][0]); assert cat!='流し満貫','nagashi unsupported by audit'
   counts[cat]=counts.get(cat,0)+1
   nr=cur+int(not repeat)
   end=min(post)<0 or nr>=8 or (nr==7 and repeat and not abort and all(post[d]>post[k] for k in range(4) if k!=d))
   if i+1<len(p['log']):
    nxt=p['log'][i+1][0]['qipai']; assert not end
    assert post==seats(nxt['defen'],(initial+nxt['jushu'])%4)
    assert ky==nxt['lizhibang'] and nr==4*nxt['zhuangfeng']+nxt['jushu']
    assert nxt['changbang']==(q['changbang']+1 if repeat or kind=='pingju' else 0)
   else:
    assert end
    rank=sorted(range(4),key=lambda k:(-post[k],(k-initial)%4));post[rank[0]]+=ky*1000
    assert post==p['score'] and [rank.index(k)+1 for k in range(4)]==p['rank']
  except (AssertionError,KeyError,IndexError,TypeError) as e: audit_errors.append({'shard':m['shard'],'hand':i,'reason':str(e)})
base={'matches':len(raw),'hands':len(X),'auditErrors':audit_errors,'acceptedRiichi':n_accept,'events':counts,'familyMatches':{f:sum(r['opponentFamily']==f for m,p,r in raw) for f in set(F)}}
if audit_errors:
 print(json.dumps(base));Path('q1-result.json').write_text(json.dumps(base,indent=2));sys.exit(0)
X=np.array(X,np.float32); Y=np.array(Y); G=np.array(G);F=np.array(F);ST=np.array(ST)
def pl(scores,beta):
 s=scores*beta; s=s-s.max(1,keepdims=True); w=np.exp(s); out=[]
 for p in P:
  u=w[:,list(p)];out.append(np.prod(u[:,:3]/np.flip(np.cumsum(np.flip(u,axis=1),axis=1),axis=1)[:,:3],axis=1))
 return np.array(out).T
def joint_loss(p,y):return float(-np.log(np.clip(p[np.arange(len(y)),y],1e-10,1)).mean())
def emp(train,test):
 counts={}
 for i in train:
  key=(int(ST[i]//2),tuple(np.argsort(-X[i,3:],kind='stable')))
  counts.setdefault(key,np.ones(24)*.5)[Y[i]]+=1
 return np.array([counts.get((int(ST[i]//2),tuple(np.argsort(-X[i,3:],kind='stable'))),np.ones(24)*.5) for i in test])
class GRP(nn.Module):
 def __init__(self):
  super().__init__();self.gru=nn.GRU(7,32,batch_first=True);self.head=nn.Linear(32,24)
 def forward(self,x,length):
  h,_=self.gru(x);return self.head(h[torch.arange(len(x)),length-1])
length=torch.tensor([len(x) for x in H]); pad=torch.zeros(len(H),int(length.max()),7)
for i,h in enumerate(H):pad[i,:len(h)]=torch.tensor(h)
yt=torch.tensor(Y); preds={k:np.zeros((len(Y),24)) for k in ('empirical','plackett_luce','grp')};timing=[]
# deterministic grouping, no case from same match in multiple folds
for fold,(tr,te) in enumerate(GroupKFold(4).split(X,Y,G)):
 assert not set(G[tr])&set(G[te])
 q=emp(tr,te);preds['empirical'][te]=q/q.sum(1,keepdims=True)
 beta=minimize_scalar(lambda b:joint_loss(pl(X[tr,3:],b),Y[tr]),bounds=(0,10),method='bounded').x
 preds['plackett_luce'][te]=pl(X[te,3:],beta)
 torch.manual_seed(261124+fold);model=GRP(); opt=torch.optim.AdamW(model.parameters(),lr=.003,weight_decay=.01); t=time.monotonic()
 for epoch in range(40):
  model.train(); rng=np.random.default_rng(261124+100*fold+epoch)
  for idx in np.array_split(rng.permutation(tr),max(1,len(tr)//64)):
   opt.zero_grad();loss=nn.functional.cross_entropy(model(pad[idx],length[idx]),yt[idx]);loss.backward();opt.step()
 model.eval()
 with torch.no_grad():preds['grp'][te]=model(pad[te],length[te]).softmax(1).numpy()
 timing.append({'fold':fold,'trainMatches':len(set(G[tr])),'testMatches':len(set(G[te])),'beta':float(beta),'seconds':time.monotonic()-t})
def metrics(p,idx):
 p=p[idx]; y=Y[idx];m=np.einsum('nc,cpr->npr',p,M); truth=M[y]
 assert np.allclose(m.sum(1),1,atol=1e-5) and np.allclose(m.sum(2),1,atol=1e-5)
 v=m[:,:,3].ravel();t=truth[:,:,3].ravel()
 bins=[]
 for lo in np.arange(0,1,.2):
  mask=(v>=lo)&(v<(lo+.2) if lo<.8 else v<=1)
  if mask.any():bins.append({'lo':float(lo),'rows':int(mask.sum()),'mean':float(v[mask].mean()),'observed':float(t[mask].mean()),'matches':int(len(set(np.repeat(G[idx],4)[mask])))})
 return {'logloss':joint_loss(p,y),'rankBrier':float(np.mean((m-truth)**2)),'fourthBrier':float(np.mean((v-t)**2)),'fourthBins':bins}
base['models']={k:{'overall':metrics(p,np.arange(len(Y))),'family':{f:metrics(p,np.flatnonzero(F==f)) for f in set(F)}} for k,p in preds.items()}
base['folds']=timing
base['grpImprovesBoth']=all(base['models']['grp']['overall'][k]<base['models']['plackett_luce']['overall'][k] for k in ('logloss','fourthBrier'))
base['scope']='development OOF only; 96 hanchan, mixed policies; no candidate EV or independent calibration certification'
# paired match bootstrap on fixed out-of-fold predictions, descriptive only
rng=np.random.default_rng(261124);groups=np.unique(G); deltas={}
for k in ['empirical','grp']:
 a=preds[k];b=preds['plackett_luce'];ma=np.einsum('nc,cpr->npr',a,M);mb=np.einsum('nc,cpr->npr',b,M);t=M[Y]
 d=np.mean((ma[:,:,3]-t[:,:,3])**2-(mb[:,:,3]-t[:,:,3])**2,axis=1)
 ll=-np.log(np.clip(a[np.arange(len(Y)),Y],1e-10,1))+np.log(np.clip(b[np.arange(len(Y)),Y],1e-10,1))
 for name,v in [('fourthBrier',d),('logloss',ll)]:
  sums=np.array([v[G==g].sum() for g in groups]);n=np.array([(G==g).sum() for g in groups]);s=rng.integers(0,len(groups),size=(2000,len(groups)));draw=sums[s].sum(1)/n[s].sum(1)
  deltas[k+'_'+name]={'delta':float(v.mean()),'descriptiveCI':np.quantile(draw,[.025,.975]).tolist()}
base['pairedBootstrap']=deltas
Path('q1-result.json').write_text(json.dumps(base,indent=2));print(json.dumps(base))
