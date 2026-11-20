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
from p1_metrics import binary_metrics,within_decision_auc,reliability
T=lgb.Booster(model_file='/tmp/belief-model/t.lgb');R=lgb.Booster(model_file='/tmp/belief-model/r.lgb')
root=Path(sys.argv[1]);paths=sorted(p.parent for p in root.rglob('manifest.json'));assert len(paths)==8
turn=[];ts=[];rs=[];direct=[]
for p in paths:
 m=json.loads((p/'manifest.json').read_text());seed=m['seed'];policy=m['rows'][0]['policy']
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
seeds=sorted({v[0] for v in ts});assert len(seeds)==8
def logit(v):
 v=np.clip(v,1e-6,1-1e-6);return np.log(v/(1-v))
def fit_logit(x,y):
 assert len(set(y))==2
 return LogisticRegression(C=.1,max_iter=500,random_state=261120).fit(np.asarray(x),np.asarray(y))
def loss_reg(X,y,objective='regression',alpha=None):
 pars=dict(n_estimators=35,num_leaves=7,min_child_samples=20,reg_lambda=10,learning_rate=.05,n_jobs=1,random_state=261120,verbosity=-1,objective=objective)
 if alpha is not None:pars['alpha']=alpha
 return lgb.LGBMRegressor(**pars).fit(X,y)
tp=np.full(len(ts),np.nan);rp=np.full(len(rs),np.nan);cond=np.full(len(rs),np.nan);quant=np.full((len(rs),3),np.nan);dp=np.full(len(direct),np.nan);sp=dp.copy();baseline=np.full(len(rs),np.nan)
for held in seeds:
 ti=np.array([i for i,v in enumerate(ts) if v[0]!=held and not v[4]])
 te=np.array([i for i,v in enumerate(ts) if v[0]==held])
 cal=fit_logit([[logit(ts[i][2])] for i in ti],[ts[i][3] for i in ti])
 pp=cal.predict_proba([[logit(ts[i][2])] for i in te])[:,1]
 for i,p in zip(te,pp):tp[i]=1. if ts[i][4] else p
 # Conditional Ron given structural tenpai; train only true-tenpai rows outside held group.
 ri=[i for i,v in enumerate(rs) if v[0]!=held and ts[v[2]][3] and not v[6]]
 re=[i for i,v in enumerate(rs) if v[0]==held]
 model=fit_logit([[logit(rs[i][3]),logit(ts[rs[i][2]][2])] for i in ri],[rs[i][4] for i in ri])
 cr=model.predict_proba([[logit(rs[i][3]),logit(ts[rs[i][2]][2])] for i in re])[:,1]
 for i,p in zip(re,cr):rp[i]=0. if rs[i][6] else tp[rs[i][2]]*p
 # Conditional payment distribution trained on positive labels only.
 ci=[i for i,v in enumerate(rs) if v[0]!=held and v[4]]
 X=np.array([rs[i][7] for i in ci]);y=np.array([rs[i][5] for i in ci]);Xt=np.array([rs[i][7] for i in re])
 reg=loss_reg(X,y);cond[re]=np.maximum(0,reg.predict(Xt));baseline[re]=float(y.mean())
 for j,a in enumerate((.1,.5,.9)):quant[re,j]=np.maximum(0,loss_reg(X,y,'quantile',a).predict(Xt))
 tr=[i for i,v in enumerate(direct) if v[0]!=held];de=[i for i,v in enumerate(direct) if v[0]==held]
 X=np.array([direct[i][5] for i in tr]);Xt=np.array([direct[i][5] for i in de])
 dp[de]=np.maximum(0,loss_reg(X,np.array([direct[i][3] for i in tr])).predict(Xt))
 sp[de]=np.maximum(0,loss_reg(X,np.array([direct[i][4] for i in tr])).predict(Xt))
assert all(np.isfinite(x).all() for x in (tp,rp,cond,quant,dp,sp))
assert all(0<=rp[i]<=tp[v[2]]<=1 and (not v[6] or rp[i]==0) for i,v in enumerate(rs))
assert all(tp[i]==1 for i,v in enumerate(ts) if v[4])
def rmse(a,b):return float(np.sqrt(np.mean((np.array(a)-np.array(b))**2)))
y=[v[4] for v in rs];ty=[v[3] for v in ts];positives=[i for i,v in enumerate(rs) if v[4]]
decomp=[sum(rp[i]*cond[i] for i in v[2]) for v in direct]
qcross=int(np.sum((quant[:,0]>quant[:,1])|(quant[:,1]>quant[:,2])))
out={'status':'leave_match_out_development_smoke_only','matches':len(seeds),'tenpai_rows':len(ts),'ron_rows':len(rs),'payment_positives':len(positives),'frozen_contract_violations':sum(v[3]>ts[v[2]][2] for v in rs),'constrained_contract_violations':0,'frozen_tenpai':binary_metrics(ty,[v[2] for v in ts]),'calibrated_tenpai':binary_metrics(ty,tp.tolist()),'frozen_ron':binary_metrics(y,[v[3] for v in rs]),'constrained_ron':binary_metrics(y,rp.tolist()),'frozen_rank':within_decision_auc(y,[v[3] for v in rs],[v[8] for v in rs]),'constrained_rank':within_decision_auc(y,rp.tolist(),[v[8] for v in rs]),'conditional_payment_rmse':rmse([rs[i][5] for i in positives],cond[positives]),'conditional_mean_baseline_rmse':rmse([rs[i][5] for i in positives],baseline[positives]),'quantile_crossing_count_before_reconciliation':qcross,'decomposed_base_exposure_rmse':rmse([v[3] for v in direct],decomp),'direct_base_exposure_rmse':rmse([v[3] for v in direct],dp),'direct_all_accept_visible_loss_rmse':rmse([v[4] for v in direct],sp),'direct_vs_decomp_mean_abs_disagreement':float(np.mean(np.abs(dp-np.array(decomp)))),'limit':'Only eight development games from a single opponent family; out-of-fold diagnostic not final gating, no supported UI risk/score. No ura/temporal replay validation; quantile crossings reported, not hidden.'}
Path('/tmp/p1-calibration-smoke.json').write_text(json.dumps(out,ensure_ascii=False,indent=2));print(json.dumps(out,ensure_ascii=False,indent=2))
