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
TX=[];RX=[];TY=[];RY=[];TG=[];RG=[];RI=[];SAFE=[];TF=[];RF=[];KEY=[];hist_seeds=set();development_seeds=set()
def add(x,labels,seed,family,ident):
 o=x['scene']['ownSeat'];tiles=sorted({v[:2] for a in x['actions'] if a['action']<37 for v in a['details']})
 assert set(z['seat'] for z in labels)==set(range(4))-{o}
 for lab in labels:
  seat=lab['seat'];g,c,safe=features(x,seat,tiles)
  y=int(lab['tenpai']);r=[int(lab['legalRon'][t]) for t in tiles]
  assert not (g[0] and not y) and all(not a or y for a in r) and not any(a and b for a,b in zip(r,safe))
  i=len(TY);TX.append(g);TY.append(y);TG.append(seed);TF.append(family)
  RX.extend(c);RY.extend(r);RG.extend([seed]*len(r));RI.extend([i]*len(r));SAFE.extend(safe);RF.extend([family]*len(r));KEY.extend([(seed,ident,seat)]*len(r))
for qi,ri,mi,ti in SHARDS:
 qs=load(qi,'blind.json')['items'];teacher={r['id']:r for r in load(ti,'belief-teacher.json')};sm={v['prefix']:v['matchSeed'] for v in load(mi,'manifest.json')['matches']}
 assert len(sm)==10 and not hist_seeds.intersection(sm.values());hist_seeds.update(sm.values())
 for x in qs:
  if x['phase']!='turn':continue
  prefix,_=x['id'].rsplit('-',1);add(x,teacher[x['id']]['opponents'],sm[prefix],'historical',x['id'])
 print('HISTORICAL',qi,flush=True)
assert len(hist_seeds)==120 and len(TY)==40395 and len(RY)==445449
for root,fam_expected,n in [(Path(sys.argv[1]),None,48),(Path(sys.argv[2]),'self',24),(Path(sys.argv[3]),None,96)]:
 paths=sorted(p.parent for p in root.rglob('manifest.json'));assert len(paths)==n
 for p in paths:
  m=json.loads((p/'manifest.json').read_text());seed=m['seed'];fam=m['rows'][0]['opponentFamily']
  assert m['split']=='development-only' and seed not in hist_seeds and seed not in development_seeds
  assert fam in ('s42','basic','self') and (fam_expected is None or fam==fam_expected)
  development_seeds.add(seed);x={z['id']:z for z in json.loads((p/'public.json').read_text())}
  for q in json.loads((p/'oracle.json').read_text()):add(x[q['id']],q['opponents'],seed,fam,q['id'])
assert len(development_seeds)==168
old_outer=json.loads(Path(sys.argv[4]).read_text());assert len(old_outer['entries'])==160
assert not (hist_seeds|development_seeds)&{e['seed'] for e in old_outer['entries']}
new_manifest=json.loads(Path(sys.argv[5]).read_text());new_seeds={e['seed'] for e in new_manifest['entries']};assert len(new_seeds)==96 and new_seeds<=development_seeds
assert new_manifest['status']=='locked_v2_development_only'
T=np.asarray(TX,np.float32);R=np.asarray(RX,np.float32);ty=np.asarray(TY,int);ry=np.asarray(RY,int);tg=np.asarray(TG,np.uint32);rg=np.asarray(RG,np.uint32);ri=np.asarray(RI,int);safe=np.asarray(SAFE,bool);tf=np.array(TF);rf=np.array(RF)
del TX,RX,TY,RY,TG,RG,RI,SAFE,TF,RF
assert np.isfinite(T).all() and np.isfinite(R).all()
assert np.array_equal(tg[ri],rg) and np.array_equal(tf[ri],rf)
known=T[:,0]>0
root=Path('/tmp/belief-model')
for k in ('t','r'):assert hashlib.sha256((root/(k+'.lgb')).read_bytes()).hexdigest()==EXPECTED[k]
T0=lgb.Booster(model_file=str(root/'t.lgb'));R0=lgb.Booster(model_file=str(root/'r.lgb'))
ft=T0.predict(T[:,:26],num_threads=3);ft[known]=1
fr=R0.predict(R[:,:57],num_threads=3);fr[safe]=0
# Only fresh v2 development matches are held out in nested development CV.
# Four folds: 24 matches evaluation, 24 calibration, 48 new training
# plus all 72 prior development and 120 historical (probability heads).
dev=np.isin(tg,list(new_seeds));rd=np.isin(rg,list(new_seeds));families=('s42','basic','self')
folds=[set() for _ in range(4)]
for f in families:
 ss=sorted(set(tg[dev&(tf==f)]));assert len(ss)==32
 for k,v in enumerate(ss):folds[k%4].add(v)
assert all(len(f)==24 for f in folds)
from p1_outer_metrics import paired, losses
def logit(p):
 p=np.clip(p,1e-6,1-1e-6);return np.log(p/(1-p))
def calibrate(a,b,y):
 lr=LogisticRegression(C=1,max_iter=500,random_state=261120)
 lr.fit(logit(a)[:,None],y)
 assert lr.coef_[0,0]>0
 return lr.predict_proba(logit(b)[:,None])[:,1]
def fit(X,y,mask,fam):
 return lgb.LGBMClassifier(n_estimators=100,num_leaves=15,learning_rate=.05,min_child_samples=100,reg_lambda=8,n_jobs=3,random_state=261120,verbosity=-1).fit(X[mask],y[mask],sample_weight=np.where(fam[mask]=='historical',1.,3.))
# Fit and compare two T calibrators and three coherent R variants, no
# opponent ID at inference. Scaling each decision's R vector preserves
# strictly monotone ranking, unlike per-candidate clipping.
tp={k:np.full(len(ty),np.nan) for k in ('frozen','platt_frozen','retrained_platt')}
rp={k:np.full(len(ry),np.nan) for k in ('frozen','rank_preserving_calibrated','conditional','blend_scaled')}
tp['frozen']=ft;rp['frozen']=fr
def coherent_scale(v,indices,t):
 maxima=np.zeros(len(ty));np.maximum.at(maxima,indices,v)
 scale=np.minimum(1,t[indices]/np.maximum(maxima[indices],1e-12))
 return v*scale
for i,held in enumerate(folds):
 cal=folds[(i+1)%4];te=np.isin(tg,list(held));tc=np.isin(tg,list(cal));tt=~(te|tc)
 re=np.isin(rg,list(held));rc=np.isin(rg,list(cal));rt=~(re|rc)
 assert set(tg[tt]).isdisjoint(set(tg[te])|set(tg[tc]))
 t=fit(T,ty,tt&~known,tf)
 for name,raw,calraw in [('platt_frozen',ft[te],ft[tc&~known]),('retrained_platt',t.predict_proba(T[te])[:,1],t.predict_proba(T[tc&~known])[:,1])]:
  tp[name][te]=calibrate(calraw,raw,ty[tc&~known]);tp[name][te&known]=1
 # Fixed candidate T used for R development; if it fails its own gate,
 # the joint hypothesis fails. No switching after formal results.
 tprob=tp['retrained_platt'];m=rt&~safe&(ty[ri]==1);cc=rc&~safe&(ty[ri]==1)
 model=fit(R,ry,m,rf)
 raw=calibrate(fr[rc&~safe],fr[re],ry[rc&~safe]);raw[safe[re]]=0
 rp['rank_preserving_calibrated'][re]=coherent_scale(raw,ri[re],tprob)
 q=calibrate(model.predict_proba(R[cc])[:,1],model.predict_proba(R[re])[:,1],ry[cc])*tprob[ri[re]]
 q[safe[re]]=0;rp['conditional'][re]=q
 v=.5*fr[re]+.5*q;v[safe[re]]=0
 rp['blend_scaled'][re]=coherent_scale(v,ri[re],tprob)
 print('FOLD_DONE',i+1,flush=True)
for k,v in rp.items():
 assert np.isfinite(v[rd]).all()
 if k!='frozen':assert np.all(v[rd]<=tp['retrained_platt'][ri[rd]]+1e-12) and np.all(v[rd&safe]==0)
assert all(np.isfinite(v[dev]).all() for v in tp.values())
def score(y,p,b,mask,g,f,keys=None):
 if not mask.any():return {'supported':False}
 Y=y[mask];P=p[mask];B=b[mask];G=g[mask];F=f[mask]
 z=binary_metrics(Y.tolist(),P.tolist());z['matches']=len(set(G));z['supported']=z['matches']>=30 and z['positives']>=100 and len(Y)-sum(Y)>=100
 z['bins']=reliability(Y.tolist(),P.tolist(),G.tolist());gaps=[abs(v['observed']-v['predicted']) for v in z['bins'] if v['supported']]
 z['max_gap']=max(gaps) if gaps else None
 z['ll_delta']=paired(losses(Y,P),losses(Y,B),G,F);z['brier_delta']=paired((Y-P)**2,(Y-B)**2,G,F)
 if keys is not None:
  kk=[keys[i] for i in np.flatnonzero(mask)]
  z['rank']=within_decision_auc(Y.tolist(),P.tolist(),kk);z['rank_base']=within_decision_auc(Y.tolist(),B.tolist(),kk)
 return z
ts={'all':dev&~known,**{f:dev&~known&(tf==f) for f in families},'multi_meld':dev&~known&(T[:,1]>=2),'late':dev&~known&(T[:,3]<=18)}
rs={'all':rd&~safe,**{f:rd&~safe&(rf==f) for f in families},'riichi':rd&~safe&(R[:,0]>0),'multi_meld':rd&~safe&(R[:,1]>=2),'late':rd&~safe&(R[:,3]<=18)}
out={'status':'v2_nested_development_only','tenpai':{k:{f:score(ty,v,ft,m,tg,tf) for f,m in ts.items()} for k,v in tp.items()},'ron':{k:{f:score(ry,v,fr,m,rg,rf,KEY) for f,m in rs.items()} for k,v in rp.items()}}
# Conditional payment training uses only independently audited recent data.
# MAE is compared using the median head, not the mean head. Both output
# functions are distinct and never presented as actual payout.
dev_rows=np.flatnonzero(rf!='historical');offset=0;YP=[]
for directory in sys.argv[1:4]:
 for d in sorted(q.parent for q in Path(directory).rglob('manifest.json')):
  m=json.loads((d/'manifest.json').read_text());seed=m['seed']
  for q in json.loads((d/'oracle.json').read_text()):
   for lab in q['opponents']:
    for t in q['tiles']:
     k=dev_rows[offset];offset+=1
     assert KEY[k]==(seed,q['id'],lab['seat']) and ry[k]==int(lab['legalRon'][t])
     YP.append(lab['baseLoss'][t] or 0)
assert offset==len(dev_rows)
Y=np.array(YP,float);X=R[dev_rows];G=rg[dev_rows];F=rf[dev_rows];isnew=np.isin(G,list(new_seeds))
assert np.array_equal(Y>0,ry[dev_rows]==1)
mean=np.full(len(Y),np.nan);median=mean.copy();base_mean=mean.copy();base_median=mean.copy();base_freq=mean.copy()
def reg(objective):
 return lgb.LGBMRegressor(objective=objective,n_estimators=50,num_leaves=7,min_child_samples=25,reg_lambda=10,learning_rate=.05,n_jobs=3,random_state=261120,verbosity=-1)
for held in folds:
 cal=folds[(folds.index(held)+1)%4];test=np.isin(G,list(held));train=~(test|np.isin(G,list(cal)));pos=train&(Y>0)
 mean[test]=np.maximum(0,reg('regression').fit(X[pos],Y[pos]).predict(X[test]));median[test]=np.maximum(0,reg('regression_l1').fit(X[pos],Y[pos]).predict(X[test]))
 base_mean[test]=Y[pos].mean();base_median[test]=np.median(Y[pos]);base_freq[test]=np.mean(Y[train]>0)
assert np.isfinite(mean[isnew]).all() and np.isfinite(median[isnew]).all()
out['payment']={}
for f in ('all',*families,'riichi','multi_meld','late'):
 mask=isnew & (np.ones(len(Y),bool) if f=='all' else F==f if f in families else X[:,0]>0 if f=='riichi' else X[:,1]>=2 if f=='multi_meld' else X[:,3]<=18)
 pos=mask&(Y>0)
 out['payment'][f]={'positives':int(pos.sum()),'matches':len(set(G[pos])),'mae_delta':paired(abs(Y[pos]-median[pos]),abs(Y[pos]-base_median[pos]),G[pos],F[pos]),'rmse_delta':paired((Y[pos]-mean[pos])**2,(Y[pos]-base_mean[pos])**2,G[pos],F[pos],root=True),'exposure':{k:paired((Y[mask]-v[dev_rows][mask]*mean[mask])**2,(Y[mask]-base_freq[mask]*base_mean[mask])**2,G[mask],F[mask],root=True) for k,v in rp.items() if k!='frozen'}}
out['scope']='96 new development games, 4 grouped evaluation/calibration folds, old120+72 development training only. V1 independent outer manifest used only for seed exclusion; no outer labels, no final promotion. Interval/direct and new unseen policy still pending.'
def native(x):
 if isinstance(x,np.generic):return x.item()
 raise TypeError(type(x))
Path('/tmp/p1-v2-screen.json').write_text(json.dumps(out,ensure_ascii=False,indent=2,default=native))
print(json.dumps({**out,'tenpai':{k:{f:{z:v.get(z) for z in ('supported','max_gap','ll_delta','brier_delta')} for f,v in s.items()} for k,s in out['tenpai'].items()},'ron':{k:{f:{z:v.get(z) for z in ('supported','max_gap','ll_delta','brier_delta','rank','rank_base')} for f,v in s.items()} for k,s in out['ron'].items()}},ensure_ascii=False,indent=2,default=native))
