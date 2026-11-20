"""Development-only probability retraining: old 120 matches + 3 families.
Each outer development fold and each calibration fold are whole, distinct matches.
No reserved formal/outer seed is used. Historical labels lack new independent replay.
"""
import json,sys,collections,hashlib,math
from pathlib import Path
import numpy as np
import lightgbm as lgb
from sklearn.linear_model import LogisticRegression
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'arena'))
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'phase0'))
from belief_features import features
from policy_features import norm
from rebuild_belief import SHARDS,EXPECTED
from rebuild_policy import load
from p1_metrics import binary_metrics,within_decision_auc,reliability
def extra(x,seat,tiles):
 s=x['scene'];r=s['rivers'][seat];d=r['discards'];vis=x['facts']['見え枚数'];seen=[norm(v['tile']) for v in d];hand=[norm(v['tile']) for v in d if not v['tsumogiri']]
 ev=s['publicEvents']; disc=[(i,z) for i,z in enumerate(ev) if z.get('種類')=='打牌' and z.get('席')==seat]
 assert len(disc)==len(d),(len(disc),len(d))
 seq=[]
 for j in range(1,7):
  if len(d)>=j:
   p=seen[-j];seq.extend([*map(int,[p[0]==u for u in 'mpsz']),int(p[1]),int(d[-j]['tsumogiri']),1])
  else:seq.extend([0]*7)
 g=[*seq,sum(z['ツモ切り'] for _,z in disc[-6:]),sum(p[0]=='z' for p in hand[:4]),sum(p[1] in '19' for p in hand[:4]),len(ev)-1-disc[-1][0] if disc else len(ev),*[sum(m[0]==u for m in r['melds']) for u in 'mpsz']]
 out=[]
 for t in tiles:
  z=norm(t);u=z[0];n=int(z[1]);adj=lambda k:u+str(n+k) if u!='z' and 1<=n+k<=9 else ''
  seq2=[]
  for j in range(1,7):
   if len(d)>=j:
    v=seen[-j];seq2.extend([int(v[0]==u),int(v[0]==u and v[0]!='z' and abs(int(v[1])-n)<=2),int(v in (adj(-3),adj(3)))])
   else:seq2.extend([0,0,0])
  # Visibility, sequential public evidence, and same-suit calls only.
  out.append([*g,*seq2,sum(v[0]==u for v in seen[:4]),sum(v[0]==u for v in hand[:4]),sum(v[0]==u for v in hand[-6:]),sum(v[0]==u and v[1] in '456' for v in hand[-6:]),sum(m[0]==u for m in r['melds']),*[int(vis.get(adj(k),0)==4) for k in (-3,-2,-1,1,2,3)]])
 return g,out
TX=[];RX=[];TY=[];RY=[];TG=[];RG=[];RI=[];SAFE=[];TF=[];RF=[];KEY=[];hist_seeds=set();development_seeds=set()
def add(x,labels,seed,family,ident):
 o=x['scene']['ownSeat'];tiles=sorted({v[:2] for a in x['actions'] if a['action']<37 for v in a['details']})
 assert set(z['seat'] for z in labels)==set(range(4))-{o}
 for lab in labels:
  seat=lab['seat'];g,c,safe=features(x,seat,tiles);eg,ec=extra(x,seat,tiles)
  y=int(lab['tenpai']);r=[int(lab['legalRon'][t]) for t in tiles]
  assert not (g[0] and not y) and all(not a or y for a in r) and not any(a and b for a,b in zip(r,safe))
  i=len(TY);TX.append(g+eg);TY.append(y);TG.append(seed);TF.append(family)
  RX.extend([v+u for v,u in zip(c,ec)]);RY.extend(r);RG.extend([seed]*len(r));RI.extend([i]*len(r));SAFE.extend(safe);RF.extend([family]*len(r));KEY.extend([(seed,ident,seat)]*len(r))
for qi,ri,mi,ti in SHARDS:
 qs=load(qi,'blind.json')['items'];teacher={r['id']:r for r in load(ti,'belief-teacher.json')};sm={v['prefix']:v['matchSeed'] for v in load(mi,'manifest.json')['matches']}
 assert len(sm)==10 and not hist_seeds.intersection(sm.values());hist_seeds.update(sm.values())
 for x in qs:
  if x['phase']!='turn':continue
  prefix,_=x['id'].rsplit('-',1);add(x,teacher[x['id']]['opponents'],sm[prefix],'historical',x['id'])
 print('HISTORICAL',qi,flush=True)
assert len(hist_seeds)==120 and len(TY)==40395 and len(RY)==445449
for root,fam_expected,n in [(Path(sys.argv[1]),None,48),(Path(sys.argv[2]),'self',24)]:
 paths=sorted(p.parent for p in root.rglob('manifest.json'));assert len(paths)==n
 for p in paths:
  m=json.loads((p/'manifest.json').read_text());seed=m['seed'];fam=m['rows'][0]['opponentFamily']
  assert m['split']=='development-only' and seed not in hist_seeds and seed not in development_seeds
  assert fam in ('s42','basic','self') and (fam_expected is None or fam==fam_expected)
  development_seeds.add(seed);x={z['id']:z for z in json.loads((p/'public.json').read_text())}
  for q in json.loads((p/'oracle.json').read_text()):add(x[q['id']],q['opponents'],seed,fam,q['id'])
assert len(development_seeds)==72
T=np.asarray(TX,np.float32);R=np.asarray(RX,np.float32);ty=np.asarray(TY,int);ry=np.asarray(RY,int);tg=np.asarray(TG,np.uint32);rg=np.asarray(RG,np.uint32);ri=np.asarray(RI,int);safe=np.asarray(SAFE,bool);tf=np.array(TF);rf=np.array(RF)
del TX,RX,TY,RY,TG,RG,RI,SAFE,TF,RF
assert np.isfinite(T).all() and np.isfinite(R).all()
assert np.array_equal(tg[ri],rg) and np.array_equal(tf[ri],rf)
known=T[:,0]>0
dev=tf!='historical';rd=rf!='historical';families=('s42','basic','self')
folds=[set() for _ in range(6)]
for f in families:
 seeds=sorted(set(tg[tf==f]));assert len(seeds)==24
 for k,s in enumerate(seeds):folds[k%6].add(s)
assert len(set.union(*folds))==72 and all(len(f)==12 for f in folds)
root=Path('/tmp/belief-model')
for k in ('t','r'):assert hashlib.sha256((root/(k+'.lgb')).read_bytes()).hexdigest()==EXPECTED[k]
T0=lgb.Booster(model_file=str(root/'t.lgb'));R0=lgb.Booster(model_file=str(root/'r.lgb'))
ft=T0.predict(T[:,:26],num_threads=3);ft[known]=1
fr=R0.predict(R[:,:57],num_threads=3);fr[safe]=0
tnames=('frozen','retrained','retrained_platt')
rnames=('frozen','frozen_clamp','retrained_direct','retrained_direct_platt','retrained_factor_platt','enriched_direct_platt','enriched_factor_platt')
tp={n:np.full(len(ty),np.nan) for n in tnames};rp={n:np.full(len(ry),np.nan) for n in rnames}
tp['frozen']=ft.copy();rp['frozen']=fr.copy();rp['frozen_clamp']=np.minimum(fr,ft[ri])
def fit(X,y,mask,fam):
 assert mask.any() and len(set(y[mask]))==2
 # Equal contribution of each new development family, retain historical base
 # and use weight 3 on new rows; fixed before test, not performance tuned.
 w=np.where(fam[mask]=='historical',1.,3.)
 p=lgb.LGBMClassifier(n_estimators=100,num_leaves=15,learning_rate=.05,min_child_samples=100,reg_lambda=8,n_jobs=3,random_state=20261119,verbosity=-1)
 return p.fit(X[mask],y[mask],sample_weight=w)
def logit(p):
 p=np.clip(p,1e-6,1-1e-6);return np.log(p/(1-p))
def cal(a,b,y):
 assert len(set(y))==2
 m=LogisticRegression(C=1.,max_iter=500,random_state=261120)
 m.fit(logit(a)[:,None],y);return m.predict_proba(logit(b)[:,None])[:,1]
for i,held in enumerate(folds):
 calibrate=folds[(i+1)%6]
 assert not held&calibrate
 te=np.isin(tg,list(held));tc=np.isin(tg,list(calibrate));tt=~(te|tc)
 re=np.isin(rg,list(held));rc=np.isin(rg,list(calibrate));rt=~(re|rc)
 assert set(tg[tt]).isdisjoint(set(tg[tc])|set(tg[te])) and set(rg[rt]).isdisjoint(set(rg[rc])|set(rg[re]))
 # All models receive only public columns.
 t=fit(T[:,:26],ty,tt&~known,tf)
 ct=t.predict_proba(T[tc&~known,:26])[:,1];et=t.predict_proba(T[te,:26])[:,1]
 tp['retrained'][te]=et;tp['retrained'][te&known]=1
 tp['retrained_platt'][te]=cal(ct,et,ty[tc&~known]);tp['retrained_platt'][te&known]=1
 for enriched in (False,True):
  X=R if enriched else R[:,:57]
  for factor in (False,True):
   train=rt&~safe
   cc=rc&~safe
   if factor:train &=ty[ri]==1;cc &=ty[ri]==1
   model=fit(X,ry,train,rf)
   cp=model.predict_proba(X[cc])[:,1];ep=model.predict_proba(X[re])[:,1]
   raw=ep.copy();p=cal(cp,ep,ry[cc]);tprob=tp['retrained_platt'][ri[re]]
   name=('enriched' if enriched else 'retrained')+('_factor_platt' if factor else '_direct_platt')
   rp[name][re]=p*tprob if factor else np.minimum(p,tprob);rp[name][re&safe]=0
   if not enriched and not factor:
    rp['retrained_direct'][re]=np.minimum(raw,tp['retrained'][ri[re]]);rp['retrained_direct'][re&safe]=0
 print('FOLD_DONE',i+1,'train matches',len(set(tg[tt])),'calibration',len(set(tg[tc])),'dev test',len(set(tg[te])),flush=True)
assert all(np.isfinite(p[dev]).all() for p in tp.values()) and all(np.isfinite(p[rd]).all() for p in rp.values())
for name,p in rp.items():
 t=ft if name.startswith('frozen') else tp['retrained'] if name=='retrained_direct' else tp['retrained_platt']
 assert np.all(p[rd&safe]==0)
 if name!='frozen':assert np.all(p[rd]<=t[ri[rd]]+1e-12)
def summarize(y,p,mask,seeds,groups=None):
 ix=np.flatnonzero(mask)
 d=binary_metrics(y[mask].tolist(),p[mask].tolist())
 d['matches']=len(set(seeds[mask]))
 d['reliability']=reliability(y[mask].tolist(),p[mask].tolist(),seeds[mask].tolist())
 if groups is not None:d['ranking']=within_decision_auc(y[mask].tolist(),p[mask].tolist(),[groups[i] for i in ix])
 return d
strata={'all':rd&~safe,**{f:rd&~safe&(rf==f) for f in families},'riichi':rd&~safe&(R[:,0]>0),'multi_meld':rd&~safe&(R[:,1]>=2),'late':rd&~safe&(R[:,3]<=18)}
res={'status':'three_family_nested_development_screen_only','scope':'120 historical matches plus 72 new development matches, six outer development folds and disjoint calibration fold, no reserved outer/final seed. Each family has only 24 matches, below formal support gate. Historical labels not independently re-audited. Enriched public chronology only; no hidden or future features. No promotion or full P1 pass.','historical_matches':120,'development_matches':72,'tenpai':{n:{k:summarize(ty,p,dev&~known&(tf==k) if k!='all' else dev&~known,tg) for k in ('all',*families)} for n,p in tp.items()},'ron':{n:{k:summarize(ry,p,m,rg,KEY) for k,m in strata.items()} for n,p in rp.items()}}
Path('/tmp/p1-threefamily-screen.json').write_text(json.dumps(res,ensure_ascii=False,indent=2))
print(json.dumps({'status':res['status'],'tenpai':{n:{k:{z:v[z] for z in ('n','positives','brier','log_loss','auprc_ap')} for k,v in s.items()} for n,s in res['tenpai'].items()},'ron':{n:{k:{z:v[z] for z in ('n','positives','brier','log_loss','auprc_ap','ranking')} for k,v in s.items()} for n,s in res['ron'].items()}},ensure_ascii=False,indent=2))
