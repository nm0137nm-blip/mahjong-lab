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
# Freeze T unchanged; replace only R with a coherent 50/50 blend.
# The 50% is a development choice motivated by earlier family diagnostics.
# No formal evaluation or model deployment.
pred=np.full(len(ry),np.nan)
for i,held in enumerate(folds):
 calibrate=folds[(i+1)%6]
 re=np.isin(rg,list(held));rc=np.isin(rg,list(calibrate));rt=~(re|rc)
 assert not held&calibrate
 m=rt&~safe&(ty[ri]==1);cc=rc&~safe&(ty[ri]==1)
 assert set(rg[m]).isdisjoint(set(rg[cc])|set(rg[re]))
 X=R[:,:57]
 model=lgb.LGBMClassifier(n_estimators=100,num_leaves=15,learning_rate=.05,min_child_samples=100,reg_lambda=8,n_jobs=3,random_state=20261119,verbosity=-1)
 model.fit(X[m],ry[m],sample_weight=np.where(rf[m]=='historical',1.,3.))
 def logit(p):
  p=np.clip(p,1e-6,1-1e-6);return np.log(p/(1-p))
 cal=LogisticRegression(C=1.,max_iter=500,random_state=261120)
 cal.fit(logit(model.predict_proba(X[cc])[:,1])[:,None],ry[cc])
 q=cal.predict_proba(logit(model.predict_proba(X[re])[:,1])[:,None])[:,1]*ft[ri[re]]
 pred[re]=.5*np.minimum(fr[re],ft[ri[re]])+.5*q
 pred[re&safe]=0
 print('FOLD_DONE',i+1,flush=True)
assert np.isfinite(pred[rd]).all() and np.all(pred[rd]<=ft[ri[rd]]+1e-12) and np.all(pred[rd&safe]==0)
# Align exact public decision, opponent and candidate sequence used above.
dev_rows=np.flatnonzero(rd);offset=0;payment=[];ids=[];direct=[];honba=[]
for root in (Path(sys.argv[1]),Path(sys.argv[2])):
 for p in sorted(q.parent for q in root.rglob('manifest.json')):
  m=json.loads((p/'manifest.json').read_text());seed=m['seed']
  cases={x['id']:x for x in json.loads((p/'public.json').read_text())}
  for q in json.loads((p/'oracle.json').read_text()):
   x=cases[q['id']];tiles=q['tiles'];ix={t:[] for t in tiles}
   for lab in q['opponents']:
    for t in tiles:
     k=dev_rows[offset];offset+=1
     assert KEY[k]==(seed,q['id'],lab['seat']) and ry[k]==int(lab['legalRon'][t])
     payment.append(lab['baseLoss'][t] or 0);ids.append(k);ix[t].append(k)
   for t,ks in ix.items():
    assert len(ks)==3
    direct.append((seed,ks,q['allAcceptVisibleLoss'][t],x['scene']['honba']))
assert offset==len(dev_rows) and ids==dev_rows.tolist()
y=np.array(payment,float);X=R[rd,:57];g=rg[rd];fam=rf[rd];pp=pred[rd];p0=np.minimum(fr[rd],ft[ri[rd]]);truth=ry[rd]
assert np.array_equal(y>0,truth==1)
D=np.stack([np.concatenate([R[k,:57] for k in ks]+[np.array([h])]) for _,ks,_,h in direct])
lookup={k:i for i,k in enumerate(ids)};di=np.array([[lookup[k] for k in ks] for _,ks,_,h in direct]);dy=y[di].sum(axis=1);sy=np.array([v[2] for v in direct]);dg=np.array([v[0] for v in direct]);df=fam[di[:,0]]
cond=np.full(len(y),np.nan);mean0=cond.copy();median0=cond.copy();freq0=cond.copy();quant=np.full((len(y),3),np.nan);qbase=quant.copy()
dout=np.full(len(D),np.nan);sout=dout.copy()
def reg(X,y,objective='regression',alpha=None):
 kw=dict(n_estimators=35,num_leaves=7,min_child_samples=20,reg_lambda=10,learning_rate=.05,n_jobs=2,random_state=261120,verbosity=-1,objective=objective)
 if alpha is not None:kw['alpha']=alpha
 return lgb.LGBMRegressor(**kw).fit(X,y)
for held in folds:
 test=np.isin(g,list(held));train=~test;pos=train&(y>0)
 cond[test]=np.maximum(0,reg(X[pos],y[pos]).predict(X[test]))
 mean0[test]=y[pos].mean();median0[test]=np.median(y[pos]);freq0[test]=truth[train].mean()
 for j,a in enumerate((.1,.5,.9)):
  quant[test,j]=np.maximum(0,reg(X[pos],y[pos],'quantile',a).predict(X[test]));qbase[test,j]=np.quantile(y[pos],a)
 de=np.isin(dg,list(held));tr=~de
 dout[de]=np.maximum(0,reg(D[tr],dy[tr]).predict(D[de]));sout[de]=np.maximum(0,reg(D[tr],sy[tr]).predict(D[de]))
assert all(np.isfinite(v).all() for v in [cond,mean0,median0,freq0,quant,qbase,dout,sout])
ordered=np.sort(quant,axis=1)
def ll(y,p):
 p=np.clip(p,1e-12,1-1e-12);return -y*np.log(p)-(1-y)*np.log1p(-p)
# Match bootstrap with equal opponent-family weighting, not candidate IID.
def paired(a,b,mask,seeds,families_arr,transform=lambda x:x):
 rng=np.random.default_rng(261120);points=[];boot=[]
 for f in families:
  m=mask&(families_arr==f);ss=np.unique(seeds[m])
  if not len(ss):continue
  aa=np.array([a[m&(seeds==k)].sum() for k in ss]);bb=np.array([b[m&(seeds==k)].sum() for k in ss]);nn=np.array([np.sum(m&(seeds==k)) for k in ss])
  idx=rng.integers(0,len(ss),(20000,len(ss)))
  vals=transform(aa[idx].sum(1)/nn[idx].sum(1))-transform(bb[idx].sum(1)/nn[idx].sum(1))
  points.append(float(transform(aa.sum()/nn.sum())-transform(bb.sum()/nn.sum())));boot.append(vals)
 if not points:return None
 z=np.mean(boot,axis=0)
 return {'estimate':float(np.mean(points)),'ci95':[float(v) for v in np.quantile(z,[.025,.975])],'scope':'adaptive development only'}
def pack(mask):
 pos=mask&(truth==1);groups=[KEY[ids[i]] for i in np.flatnonzero(mask)]
 a=binary_metrics(truth[mask].tolist(),pp[mask].tolist());b=binary_metrics(truth[mask].tolist(),p0[mask].tolist())
 return {'matches':len(set(g[mask])),'positives':int(pos.sum()),'candidate':a,'baseline_clamped':b,'candidate_ranking':within_decision_auc(truth[mask].tolist(),pp[mask].tolist(),groups),'baseline_ranking':within_decision_auc(truth[mask].tolist(),p0[mask].tolist(),groups),'reliability':reliability(truth[mask].tolist(),pp[mask].tolist(),g[mask].tolist()),'logloss_delta_ci':paired(ll(truth,pp),ll(truth,p0),mask,g,fam),'brier_delta_ci':paired((truth-pp)**2,(truth-p0)**2,mask,g,fam),'conditional_mae_delta_ci':paired(abs(y-cond),abs(y-median0),pos,g,fam),'conditional_rmse_delta_ci':paired((y-cond)**2,(y-mean0)**2,pos,g,fam,np.sqrt),'per_opponent_exposure_rmse_delta_ci':paired((y-pp*cond)**2,(y-freq0*mean0)**2,mask,g,fam,np.sqrt),'central80_coverage':float(np.mean((y[pos]>=ordered[pos,0])&(y[pos]<=ordered[pos,2]))) if pos.any() else None,'pinball': [float(np.mean(np.maximum(a*(y[pos]-ordered[pos,j]),(a-1)*(y[pos]-ordered[pos,j])))) for j,a in enumerate((.1,.5,.9))] if pos.any() else None}
m=~safe[rd]
scopes={'all':m,**{f:m&(fam==f) for f in families},'riichi':m&(X[:,0]>0),'multi_meld':m&(X[:,1]>=2),'late':m&(X[:,3]<=18)}
decomp=(pp*cond)[di].sum(1);diff=np.abs(dout-decomp)
out={'status':'joint_P1_development_diagnostic_only','tenpai':'unchanged frozen model, not improved or independently certified','ron':'50% clipped frozen + 50% recalibrated conditional times frozen T, no opponent identifier input','development_matches':72,'scope':'Current visible dora/no ura; base legal-opportunity exposure distinct from actual or all-accept settlement. Repeated use of development data; no independent evidence or final P1 pass. Per family 24 games below 30-game gate.','scores':{k:pack(v) for k,v in scopes.items()},'quantile_crossings_before_sort':int(np.sum((quant[:,0]>quant[:,1])|(quant[:,1]>quant[:,2]))),'aggregate_exposure':{'direct_rmse':float(np.sqrt(np.mean((dout-dy)**2))),'decomposed_rmse':float(np.sqrt(np.mean((decomp-dy)**2))),'direct_vs_decomposed_abs_diff_quantiles':[float(v) for v in np.quantile(diff,[.5,.9,.95,.99])],'all_accept_visible_settlement_direct_rmse':float(np.sqrt(np.mean((sout-sy)**2)))},'limitations':'No opponent family outside training, no full ura/settlement expectation, no actual Ron choice probability. No automatic adoption. No hidden data as model features.'}
Path('/tmp/p1-joint-risk.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
print(json.dumps({**out,'scores':{k:{z:v for z,v in a.items() if z!='reliability'} for k,a in out['scores'].items()}},ensure_ascii=False,indent=2))
