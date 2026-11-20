"""Public-only inference contract. No oracle argument, file or model access other than frozen package."""
import hashlib,json,sys
from pathlib import Path
import numpy as np
import lightgbm as lgb
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'arena'))
from belief_features import features
class Predictor:
 def __init__(self,root):
  p=Path(root);self.meta=json.loads((p/'manifest.json').read_text())
  assert self.meta['status']=='frozen_candidate_for_independent_review_not_released'
  assert hashlib.sha256((Path(__file__).resolve().parents[1]/'arena'/'belief_features.py').read_bytes()).hexdigest()==self.meta['feature_contract']['feature_source_sha256']
  self.models={}
  for name,digest in self.meta['files'].items():
   assert hashlib.sha256((p/name).read_bytes()).hexdigest()==digest
   self.models[name]=lgb.Booster(model_file=str(p/name))
 def predict(self,x):
  assert set(x)=={'id','phase','scene','actions','facts'} and x['phase']=='turn'
  assert set(x['scene'])<= {'snapshotVersion','round','mode','ownSeat','honba','kyotaku','hand','drawn','selfMelds','dora','rivers','scores','remaining','ownDiscards','activeSeat','initialOrder','pendingReach','publicEvents'}
  tiles=sorted({v[:2] for a in x['actions'] if a['action']<37 for v in a['details']})
  assert tiles
  own=x['scene']['ownSeat'];seats=[(own+i)%4 for i in (1,2,3)]
  all_scores=[];rows=[]
  def p(name,X):return self.models[name+'.lgb'].predict(X,num_threads=1)
  for seat in seats:
   g,c,safe=features(x,seat,tiles);G=np.asarray([g],np.float32);C=np.asarray(c,np.float32);mask=np.asarray(safe,bool)
   assert G.shape==(1,26) and C.shape==(len(tiles),57) and np.isfinite(G).all() and np.isfinite(C).all()
   t=1. if g[0] else float(p('frozen-t',G)[0])
   base=p('frozen-r',C);raw=p('ron-conditional',C);z=np.clip(raw,1e-6,1-1e-6)
   v=self.meta['ron_platt'];rr=.5*np.minimum(base,t)+.5*t/(1+np.exp(-(v['coef']*np.log(z/(1-z))+v['intercept'])))
   rr[mask]=0
   mean=np.maximum(0,p('payment-mean',C))
   q=np.sort(np.stack([np.maximum(0,p('payment-q'+str(i),C)) for i in range(3)],axis=1),axis=1)
   q[:,0]=np.maximum(0,q[:,0]-self.meta['payment_interval']['widen_points']);q[:,2]+=self.meta['payment_interval']['widen_points']
   assert np.all((rr>=0)&(rr<=t+1e-12)) and np.all(rr[mask]==0)
   all_scores.append(C)
   rows.append({'seat':seat,'tenpai':t,'ron':rr.tolist(),'visible_conditional_mean':mean.tolist(),'visible_conditional_interval':q.tolist(),'opportunity_exposure':(rr*mean).tolist()})
  D=np.column_stack([*all_scores,np.full(len(tiles),x['scene']['honba'])])
  assert D.shape==(len(tiles),172)
  direct=np.maximum(0,p('direct-exposure',D));decomp=np.sum([r['opportunity_exposure'] for r in rows],axis=0)
  settlement=np.maximum(0,p('direct-visible-settlement',D))
  assert all(np.isfinite(v).all() for v in (direct,decomp,settlement))
  return {'tiles':tiles,'opponents':rows,'direct_base_exposure':direct.tolist(),'decomposed_base_exposure':decomp.tolist(),'direct_visible_all_accept':settlement.tolist(),'release':'blocked'}
