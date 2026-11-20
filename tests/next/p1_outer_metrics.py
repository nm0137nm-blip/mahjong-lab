"""Frozen outer metrics; no optional stopping or candidate-selection logic.
Rows contain public-predictor output and separately joined audited labels."""
import collections,math
import numpy as np
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'phase0'))
from p1_metrics import binary_metrics,reliability,within_decision_auc
FAMILIES=('s42','basic','self','efficiency')
def support(y,g):
 return len(set(g))>=30 and sum(y)>=100 and len(y)-sum(y)>=100
def paired(a,b,g,f,root=False,draws=20000):
 # Equal family weighting, whole-match paired bootstrap within each family.
 a,b,g,f=map(np.asarray,(a,b,g,f))
 rng=np.random.default_rng(261120);point=[];boot=[]
 fn=np.sqrt if root else lambda x:x
 for fam in sorted(set(f)):
  mask=f==fam;s=np.unique(g[mask]);n=np.array([sum(mask&(g==k)) for k in s])
  x=np.array([a[mask&(g==k)].sum() for k in s]);y=np.array([b[mask&(g==k)].sum() for k in s])
  ix=rng.integers(0,len(s),size=(draws,len(s)));den=n[ix].sum(1)
  point.append(float(fn(x.sum()/n.sum())-fn(y.sum()/n.sum())))
  boot.append(fn(x[ix].sum(1)/den)-fn(y[ix].sum(1)/den))
 if not point:return None
 return {'estimate':float(np.mean(point)),'ci95':[float(x) for x in np.quantile(np.mean(boot,axis=0),(.025,.975))]}
def losses(y,p):
 p=np.clip(p,1e-12,1-1e-12)
 return -y*np.log(p)-(1-y)*np.log1p(-p)
def prob_eval(rows):
 if not rows:return {'supported':False,'pass':False}
 y,p,b,g,f=[np.asarray([r[k] for r in rows]) for k in ('y','p','baseline','seed','family')]
 assert np.isin(y,[0,1]).all() and np.isfinite(p).all() and np.isfinite(b).all() and ((p>=0)&(p<=1)&(b>=0)&(b<=1)).all()
 z=support(y,g);bins=reliability(y.tolist(),p.tolist(),g.tolist())
 gaps=[abs(v['observed']-v['predicted']) for v in bins if v['supported']]
 ll=paired(losses(y,p),losses(y,b),g,f);br=paired((p-y)**2,(b-y)**2,g,f)
 ok=z and bool(gaps) and max(gaps)<=.05 and ll['estimate']<=0 and br['estimate']<=0
 return {'supported':z,'pass':bool(ok),'metrics':binary_metrics(y.tolist(),p.tolist()),'baseline':binary_metrics(y.tolist(),b.tolist()),'logloss_delta':ll,'brier_delta':br,'reliability':bins,'max_supported_gap':max(gaps) if gaps else None,'matches':len(set(g))}
def rank_eval(rows):
 d=collections.defaultdict(list)
 for r in rows:d[(r['seed'],r['id'],r['seat'])].append(r)
 mixed=[(k,v) for k,v in d.items() if len({x['y'] for x in v})==2]
 if not mixed:return {'supported':False,'pass':False}
 y=[r['y'] for r in rows];k=[(r['seed'],r['id'],r['seat']) for r in rows]
 a=within_decision_auc(y,[r['p'] for r in rows],k);b=within_decision_auc(y,[r['baseline'] for r in rows],k)
 enough=len(mixed)>=100 and len({k[0] for k,v in mixed})>=30
 return {'supported':enough,'pass':bool(enough and a['macro_auc']>=b['macro_auc']),'candidate':a,'baseline':b,'mixed_matches':len({k[0] for k,v in mixed})}
def payment_eval(rows,baseline):
 if not rows:return {'supported':False,'pass':False}
 y,p,mean,lo,hi,g,f=[np.asarray([r[k] for r in rows]) for k in ('loss','p','mean','lo','hi','seed','family')]
 assert np.isfinite(np.stack([y,p,mean,lo,hi])).all() and np.all((y>=0)&(mean>=0)&(lo>=0)&(hi>=lo))
 ix=y>0
 if not ix.any():return {'supported':False,'pass':False}
 enough=int(ix.sum())>=100 and len(set(g[ix]))>=30
 mae=paired(abs(y[ix]-mean[ix]),abs(y[ix]-baseline['payment_median']),g[ix],f[ix])
 rmse=paired((y[ix]-mean[ix])**2,(y[ix]-baseline['payment_mean'])**2,g[ix],f[ix],root=True)
 ref=baseline['legal_ron_frequency']*baseline['payment_mean']
 ex=paired((y-p*mean)**2,(y-ref)**2,g,f,root=True)
 cov=float(np.mean((y[ix]>=lo[ix])&(y[ix]<=hi[ix])))
 # High-loss underestimation: not calibration on outcome-selected rows.
 # Descriptive safety gate: candidate vs frozen-risk times training mean.
 old=np.asarray([r['baseline'] for r in rows])*baseline['payment_mean']
 high=y>=8000
 under=None if not high.any() else float(np.mean(np.maximum(y[high]-p[high]*mean[high],0)-np.maximum(y[high]-old[high],0)))
 high_support=int(high.sum())>=100 and len(set(g[high]))>=30
 ok=enough and mae['estimate']<=0 and rmse['estimate']<=0 and ex['estimate']<=0 and cov>=.75
 return {'supported':enough,'pass':bool(ok),'positives':int(ix.sum()),'positive_matches':len(set(g[ix])),'mae_delta':mae,'rmse_delta':rmse,'exposure_rmse_delta':ex,'coverage80':cov,'mean_interval_width':float(np.mean(hi[ix]-lo[ix])),'high_loss_threshold':8000,'high_loss_n':int(high.sum()),'high_loss_supported':high_support,'high_loss_underestimate_delta':under,'high_loss_pass':bool(high_support and under is not None and under<=0)}
def evaluate(ten,ron,base,aggregate):
 # Known riichi T=1 and known safe R=0 separated from proper-score tests.
 assert all(0<=r['p']<=r['t']<=1 and (not r['safe'] or (r['y']==0 and r['p']==0)) for r in ron)
 assert all(not r['known'] or (r['y']==1 and r['p']==1) for r in ten)
 assert all(r['p']==r['baseline'] for r in ten),'T unchanged by design'
 assert set(r['family'] for r in ron)==set(FAMILIES)
 result={}
 for scope in ('all',*FAMILIES,'riichi','multi_meld','late'):
  filt=lambda r:scope=='all' or r['family']==scope or scope in r.get('strata',[])
  tr=[r for r in ten if filt(r) and not r['known']]
  rr=[r for r in ron if filt(r) and not r['safe']]
  allr=[r for r in ron if filt(r)]
  result[scope]={'tenpai':prob_eval(tr),'ron':prob_eval(rr),'ranking':rank_eval(rr),'payment':payment_eval(allr,base)}
 # Candidate vs original frozen R, family-weighted primary CI.
 primary=result['all']['ron']['logloss_delta']
 primary_pass=bool(primary and primary['ci95'][1]<0 and result['all']['ron']['pass'])
 fam_pass=all(all(result[f][k]['pass'] for k in ('tenpai','ron','ranking','payment')) for f in FAMILIES)
 risk={}
 for scope in ('riichi','multi_meld','late'):
  z=result[scope];risk[scope]=bool(z['ron']['pass'] and z['ranking']['pass'] and z['payment']['pass'] and z['payment']['high_loss_pass'])
 # Aggregate predictions use the same base exposure target. Do not silently average.
 div=[]
 for a in aggregate:
  d,c=a['direct'],a['decomp'];assert all(math.isfinite(v) and v>=0 for v in (d,c,a['actual'],a['settlement'],a['settlement_actual']))
  div.append(abs(d-c)>1000 and abs(d-c)>.5*max(100,d,c))
 # Deterministic suppression policy; no actual payment or any-Ron probability.
 return {'status':'P1_visible_outer_pass' if primary_pass and fam_pass and all(risk.values()) else 'P1_visible_outer_not_full_pass',
 'primary_pass':primary_pass,'all_family_gate':fam_pass,'high_risk_gate':risk,'scopes':result,'aggregate_divergence_suppressed':sum(div),'aggregate_rows':len(aggregate),
 'limitations':'Visible no-ura legal opportunity only. Unsupported strata or bins not certified; diagnostic aggregate not actual settlement. No production release by this result.'}
