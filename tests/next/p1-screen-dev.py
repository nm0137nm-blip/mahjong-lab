"""Development smoke only: leave entire match out, constrain Ron probability, fit visible-only loss.
No final holdout, no model promotion, no Q/teacher-derived input."""
import sys,json,collections,math
from pathlib import Path
import numpy as np
import lightgbm as lgb
from sklearn.linear_model import LogisticRegression
from sklearn.dummy import DummyRegressor

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'arena'))
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'phase0'))
from belief_features import features
from p1_metrics import binary_metrics,within_decision_auc,reliability,payment_metrics
T=lgb.Booster(model_file='/tmp/belief-model/t.lgb');R=lgb.Booster(model_file='/tmp/belief-model/r.lgb')
root=Path(sys.argv[1]);paths=sorted(p.parent for p in root.rglob('manifest.json'));assert len(paths)==48
turn=[];ts=[];rs=[];direct=[]
for p in paths:
 m=json.loads((p/'manifest.json').read_text());seed=m['seed'];policy=m['rows'][0]['opponentFamily']+':'+m['rows'][0]['policy']
 xs={x['id']:x for x in json.loads((p/'public.json').read_text())}
 for t in json.loads((p/'oracle.json').read_text()):
  x=xs[t['id']];o=x['scene']['ownSeat'];tiles=sorted({v[:2] for a in x['actions'] if a['action']<37 for v in a['details']})
  assert tiles==t['tiles']
  features_by_tile={v:[] for v in tiles};index_by_tile={v:[] for v in tiles}
  for lab in t['opponents']:
   # Features use public x and seat/tiles only, labels appended separately.
   seat=lab['seat'];g,cs,safe=features(x,seat,tiles)
   pt=float(T.predict(np.array([g],np.float32),num_threads=1)[0]);pt=1. if g[0] else pt
   pr=R.predict(np.array(cs,np.float32),num_threads=1)
   ti=len(ts);yt=int(lab['tenpai']);ts.append((seed,policy,pt,yt,bool(g[0])))
   for j,v in enumerate(tiles):
    f=np.asarray(cs[j],np.float32);yr=int(lab['legalRon'][v]);yp=lab['baseLoss'][v];pred=0. if safe[j] else float(pr[j])
    assert not yr or yt
    idx=len(rs);rs.append((seed,policy,ti,pred,yr,yp,bool(safe[j]),f,(seed,x['id'],seat)))
    features_by_tile[v].append(f);index_by_tile[v].append(idx)
  for v in tiles:
   ix=index_by_tile[v];assert len(ix)==3
   # Explicit comparable exposure target: sum legal per-opponent base loss,
   # NOT final payout. Separate all-eligible-accept settlement target.
   y=sum(rs[i][5] or 0 for i in ix)
   f=np.concatenate([*features_by_tile[v],[x['scene']['honba']]]).astype(np.float32)
   direct.append((seed,policy,ix,y,t['allAcceptVisibleLoss'][v],f))
seeds=sorted({v[0] for v in ts});assert len(seeds)==48
families={v[1] for v in ts};assert len(families)==4
folds=[set() for _ in range(6)]
for k in sorted(families):
 fs=sorted({v[0] for v in ts if v[1]==k});assert len(fs)==12
 for i,v in enumerate(fs):folds[i%6].add(v)
assert all(len(f)==8 for f in folds) and len(set.union(*folds))==48
def logit(v):
 v=np.clip(v,1e-6,1-1e-6);return np.log(v/(1-v))
def fit_logit(x,y):
 assert len(set(y))==2
 return LogisticRegression(C=.1,max_iter=500,random_state=261120).fit(np.asarray(x),np.asarray(y))
def loss_reg(X,y,objective='regression',alpha=None):
 pars=dict(n_estimators=35,num_leaves=7,min_child_samples=20,reg_lambda=10,learning_rate=.05,n_jobs=1,random_state=261120,verbosity=-1,objective=objective)
 if alpha is not None:pars['alpha']=alpha
 return lgb.LGBMRegressor(**pars).fit(X,y)
# Development candidate screening only. All feature matrices built from public
# snapshots and frozen model predictions; labels separated from features.
seed_t=np.array([v[0] for v in ts]);seed_r=np.array([v[0] for v in rs])
it=np.array([v[2] for v in rs]);yt=np.array([v[3] for v in ts],dtype=int)
yr=np.array([v[4] for v in rs],dtype=int);safe=np.array([v[6] for v in rs],dtype=bool)
known_t=np.array([v[4] for v in ts],dtype=bool);ft=np.array([v[2] for v in ts]);fr=np.array([v[3] for v in rs])
X=np.column_stack([np.stack([v[7] for v in rs]),logit(fr),logit(ft[it])]).astype(np.float32)
assert np.isfinite(X).all() and len(X)==len(yr)
family=np.array([v[1].split(':')[0] for v in rs]);family_t=np.array([v[1].split(':')[0] for v in ts])
payment=np.array([v[5] or 0 for v in rs],dtype=float)
names=('frozen','clamp','direct_logistic','factor_logistic','direct_boost','factor_boost')
pred={n:np.full(len(rs),np.nan) for n in names};pred['frozen']=fr.copy();pred['clamp']=np.minimum(fr,ft[it])
ten=np.full(len(ts),np.nan);cond=np.full(len(rs),np.nan);cond_mean=cond.copy();cond_median=cond.copy()
qpred=np.full((len(rs),3),np.nan);qbase=qpred.copy();direct_pred=np.full(len(direct),np.nan)
direct_X=np.stack([v[5] for v in direct]);direct_y=np.array([v[3] for v in direct])
seedd=np.array([v[0] for v in direct])
def clf(X,y):
 assert len(set(y))==2
 return lgb.LGBMClassifier(n_estimators=60,num_leaves=15,min_child_samples=80,learning_rate=.04,reg_lambda=12,n_jobs=1,random_state=261120,verbosity=-1).fit(X,y)
for f,held in enumerate(folds):
 train=~np.isin(seed_r,list(held));test=~train;tt=~np.isin(seed_t,list(held));te=~tt
 assert not set(seed_r[train])&set(seed_r[test])
 m=fit_logit(logit(ft[tt&~known_t])[:,None],yt[tt&~known_t]);ten[te]=m.predict_proba(logit(ft[te])[:,None])[:,1];ten[te&known_t]=1
 fits=train&~safe;factors=fits&(yt[it]==1)
 pte=ten[it[test]]
 for name,mask,kind,factor in [('direct_logistic',fits,'logistic',False),('factor_logistic',factors,'logistic',True),('direct_boost',fits,'boost',False),('factor_boost',factors,'boost',True)]:
  feat=X[:,-2:] if kind=='logistic' else X
  m=fit_logit(feat[mask],yr[mask]) if kind=='logistic' else clf(feat[mask],yr[mask])
  p=m.predict_proba(feat[test])[:,1]
  pred[name][test]=p*pte if factor else np.minimum(p,pte)
  pred[name][test&safe]=0
 cp=train&(yr==1);assert cp.sum()>0
 m=loss_reg(X[cp],payment[cp]);cond[test]=np.maximum(0,m.predict(X[test]));cond_mean[test]=payment[cp].mean();cond_median[test]=np.median(payment[cp])
 for j,a in enumerate((.1,.5,.9)):
  m=loss_reg(X[cp],payment[cp],'quantile',a);qpred[test,j]=np.maximum(0,m.predict(X[test]));qbase[test,j]=np.quantile(payment[cp],a)
 tr=~np.isin(seedd,list(held));de=~tr
 direct_pred[de]=np.maximum(0,loss_reg(direct_X[tr],direct_y[tr]).predict(direct_X[de]))
 print('DEVELOPMENT_FOLD',f+1,flush=True)
assert all(np.isfinite(x).all() for x in [ten,cond,cond_mean,cond_median,qpred,qbase,direct_pred,*pred.values()])
for name,p in pred.items():
 assert np.all((p>=0)&(p<=1)) and np.all(p[safe]==0)
 if name!='frozen':assert np.all(p<=(ft[it] if name=='clamp' else ten[it])+1e-12)
def summarize(y,p,ix,groups=None):
 if not ix.any():return None
 d=binary_metrics(y[ix].tolist(),p[ix].tolist());d['matches']=len(set(seed_r[ix]))
 d['reliability']=reliability(y[ix].tolist(),p[ix].tolist(),seed_r[ix].tolist())
 if groups is not None: d['ranking']=within_decision_auc(y[ix].tolist(),p[ix].tolist(),[groups[i] for i in np.flatnonzero(ix)])
 return d
# Danger strata are public only: riichi, open threat and late.
riichi=np.array([bool(v[7][0]) for v in rs]);open_threat=np.array([v[7][1]>=2 for v in rs]);late=np.array([v[7][3]<=18 for v in rs])
groups=[v[8] for v in rs]
scopes={'all':~safe,'s42':(~safe)&(family=='s42'),'basic':(~safe)&(family=='basic'),'riichi':(~safe)&riichi,'multi_meld':(~safe)&open_threat,'late':(~safe)&late}
out={'status':'development_candidate_screen_not_formal','matches':48,'selection_warning':'Six-fold development estimates used to compare alternatives; not untouched outer evaluation. Opponent families only two. Do not promote or show calibrated values to users.','probability_contract_violations':{n:int(np.sum(p>(ft[it] if n in ('frozen','clamp') else ten[it])+1e-12)) for n,p in pred.items()},'ron':{n:{k:summarize(yr,p,ix,groups) for k,ix in scopes.items()} for n,p in pred.items()}}
out['tenpai']={n:{k:binary_metrics(yt[ix].tolist(),p[ix].tolist()) for k,ix in {'all':~known_t,'s42':(~known_t)&(family_t=='s42'),'basic':(~known_t)&(family_t=='basic')}.items()} for n,p in [('frozen',ft),('calibrated',ten)]}
pos=yr==1
def rmse(a,b):return float(np.sqrt(np.mean((a-b)**2)))
def pinball(y,p,a):return float(np.mean(np.maximum(a*(y-p),(a-1)*(y-p))))
ordered=np.sort(qpred,axis=1)
out['payment']={'positive_n':int(pos.sum()),'rmse':rmse(payment[pos],cond[pos]),'mean_baseline_rmse':rmse(payment[pos],cond_mean[pos]),'mae':float(np.mean(abs(payment[pos]-cond[pos]))),'median_baseline_mae':float(np.mean(abs(payment[pos]-cond_median[pos]))),'quantile_crossings_raw':int(np.sum((qpred[:,0]>qpred[:,1])|(qpred[:,1]>qpred[:,2]))),'quantile_pinball_ordered':[pinball(payment[pos],ordered[pos,j],a) for j,a in enumerate((.1,.5,.9))],'quantile_pinball_baseline':[pinball(payment[pos],qbase[pos,j],a) for j,a in enumerate((.1,.5,.9))],'central80_empirical_coverage':float(np.mean((payment[pos]>=ordered[pos,0])&(payment[pos]<=ordered[pos,2]))),'direct_base_exposure_rmse':rmse(direct_y,direct_pred)}
out['payment']['decomp_base_exposure_rmse']={name:rmse(direct_y,np.array([sum(p[i]*cond[i] for i in v[2]) for v in direct])) for name,p in pred.items()}
Path('/tmp/p1-screen.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
print(json.dumps({'status':out['status'],'matches':48,'ron':{n:{k:{z:v[z] for z in ('n','positives','brier','log_loss','auprc_ap')} for k,v in scopes.items() if v is not None} for n,scopes in out['ron'].items()},'probability_contract_violations':out['probability_contract_violations'],'tenpai':out['tenpai'],'payment':out['payment']},ensure_ascii=False,indent=2))
