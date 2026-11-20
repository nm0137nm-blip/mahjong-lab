"""Audit P1 label integrity and summarize frozen-policy actual on-policy R1 deviations.
Diagnostic development only. No final holdout or estimated physical loss from Q."""
import json,sys,collections,math
from pathlib import Path
import numpy as np
import lightgbm as lgb
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'arena'))
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'phase0'))
from belief_features import features
from p1_metrics import binary_metrics,within_decision_auc
from policy_features import norm
def load(p,n):return json.loads((p/n).read_text())
def cls(x,q):
 a,b=q['chosen'],q['best'];s=x['scene'];o=s['ownSeat'];facts=x['facts']
 if a==43 or b==43:return 'win_decision'
 if any(k==37 for k in (a,b)):return 'riichi'
 if any(38<=k<=42 or k==45 for k in (a,b)):return 'call_or_pass'
 if 44 in (a,b):return 'abort'
 if x['phase']!='turn':return 'other'
 ts={k['action']:k['details'][0] for k in x['actions'] if k['action']<37}
 cs={c['打牌']:c for c in facts['候補別牌姿']}
 if a in ts and b in ts and ts[a] in cs and ts[b] in cs:
  ca,cb=cs[ts[a]],cs[ts[b]]
  if ca['向聴']!=cb['向聴'] or ca['受け入れ']!=cb['受け入れ']:return 'efficiency_difference'
 if any(r['riichi'] for j,r in enumerate(s['rivers']) if j!=o):return 'push_fold_candidate'
 if s['round'].startswith('南') and int(s['round'][1])>=3:return 'placement_candidate'
 return 'other_discard'
root=Path(sys.argv[1]);paths=sorted(p.parent for p in root.rglob('manifest.json'))
assert len(paths)==48
manifest=json.loads(Path(sys.argv[2]).read_text());known=manifest['seeds'];seen=set()
T=lgb.Booster(model_file='/tmp/belief-model/t.lgb');R=lgb.Booster(model_file='/tmp/belief-model/r.lgb')
pred=collections.defaultdict(lambda:collections.defaultdict(list));dev=[];warnings=collections.Counter();game_summaries=[]
for p in paths:
 m=load(p,'manifest.json');sh=m['shard'];assert m['split']=='development-only' and m['seed']==known[sh-1] and m['seed'] not in seen;seen.add(m['seed'])
 row=m['rows'][0];assert len(m['rows'])==1 and row['cpuAudit']['fallbacks']==0
 policy=row['policy'];family=row['opponentFamily'];assert policy==('learned' if sh%2 else 's42') and family==('s42' if sh<=24 else 'basic')
 xs,qs,ts=[load(p,k+'.json') for k in ('public','reference','oracle')];assert len(xs)==len(qs)==row['publicDecisions']
 truth={t['id']:t for t in ts};assert len(truth)==len(ts)==row['teacherTurns']
 assert len({v['id'] for v in xs})==len(xs)
 for x,q in zip(xs,qs):
  assert set(x)==({'id','phase','scene','actions','facts'}|({'reaction'} if x['phase']=='reaction' else set()))
  assert q['id']==x['id'] and len(q['q'])==46
  acts=[a['action'] for a in x['actions']];assert acts==[i for i,v in enumerate(q['q']) if v is not None]
  assert all(math.isfinite(q['q'][a]) for a in acts) and q['chosen'] in acts and q['best'] in acts
  qq=[q['q'][a] for a in acts];assert q['q'][q['best']]==max(qq)
  if policy=='s42':assert q['chosen']==q['best']
  gap=max(qq)-q['q'][q['chosen']];relative=gap/max(1e-6,max(qq)-min(qq));assert 0<=relative<=1+1e-9
  if policy=='learned':
   category=cls(x,q);importance=3 if category in ('win_decision','riichi','call_or_pass','abort') else 2 if category in ('push_fold_candidate','placement_candidate') else 1
   dev.append({'seed':m['seed'],'family':family,'id':x['id'],'category':category,'q_gap':gap,'normalized_gap':relative,'importance':importance,'chosen':q['chosen'],'reference':q['best'],'legal_actions':len(acts),'phase':x['phase'],'public_case':x})
  if x['phase']!='turn':continue
  t=truth.pop(x['id']);o=t['ownSeat'];assert o==x['scene']['ownSeat'] and len(t['opponents'])==3
  tiles=sorted({v[:2] for a in x['actions'] if a['action']<37 for v in a['details']});assert tiles==t['tiles'];assert set(z['seat'] for z in t['opponents'])==set(range(4))-{o}
  for lab in t['opponents']:
   seat=lab['seat'];g,c,safe=features(x,seat,tiles)
   yt=int(lab['tenpai']);ys=[int(lab['legalRon'][v]) for v in tiles]
   assert all(not v or yt for v in ys) and all(not (safe0 and v) for safe0,v in zip(safe,ys))
   assert not (g[0] and not yt)
   p_t=float(T.predict(np.array([g],np.float32),num_threads=1)[0]);p_t=1. if g[0] else p_t
   p_r=R.predict(np.array(c,np.float32),num_threads=1) if tiles else []
   z=pred[family+':'+policy]
   z['ty'].append(yt);z['tp'].append(p_t)
   for i,tile in enumerate(tiles):
    y=ys[i];v=0. if safe[i] else float(p_r[i]);assert 0<=v<=1
    if v>p_t:warnings['frozen_ron_gt_tenpai']+=1
    a,b=lab['baseLoss'][tile],lab['firstLoss'][tile]
    assert (a is None and b is None) if not y else (a>0 and b>=a)
    z['ry'].append(y);z['rp'].append(v);z['group'].append((m['seed'],x['id'],seat))
    if y:z['payment'].append(a)
   if t['pendingKanDora']:warnings['pending_kan_dora_turn_rows']+=1
  for tile in tiles:
   eligible=[z for z in t['opponents'] if z['legalRon'][tile]]
   cap=t['multipleRonCap'];eligible=[] if cap==2 and len(eligible)==3 else eligible[:1] if cap==1 else eligible
   expected=sum((a['baseLoss'] if i else a['firstLoss'])[tile] for i,a in enumerate(eligible))
   assert expected==t['allAcceptVisibleLoss'][tile]
 assert not truth
 game_summaries.append({'seed':m['seed'],'family':family,'policy':policy,'decisions':len(xs),'teacher_turns':len(ts),'rank':row['rank']})
assert len(seen)==48
counts=collections.Counter(z['category'] for z in dev)
for z in dev:z['diagnostic_priority']=z['normalized_gap']*z['importance']*math.sqrt(counts[z['category']]/len(dev))
top=sorted((z for z in dev if z['q_gap']>0),key=lambda z:(-z['diagnostic_priority'],-z['q_gap'],z['seed'],z['id']))[:100]
score={k:{'tenpai':binary_metrics(v['ty'],v['tp']),'legal_ron':binary_metrics(v['ry'],v['rp']),'within_decision':within_decision_auc(v['ry'],v['rp'],v['group']),'conditional_payment_count':len(v['payment']),'payment_mean_no_honba_no_ura':sum(v['payment'])/len(v['payment']) if v['payment'] else None} for k,v in pred.items()}
out={'status':'development_pilot_audited_not_P1_or_R1_pass','matches':game_summaries,'frozen_belief_baseline':score,'warnings':dict(warnings),'r1':{'scope':'actual frozen200 on-policy choices; Q deviation not physical score or causal diagnosis; provisional category only','decisions':len(dev),'disagreements':sum(z['q_gap']>0 for z in dev),'category_counts':dict(counts),'top_count':len(top),'top_categories':dict(collections.Counter(z['category'] for z in top)),'ranking':'normalized teacher gap × predeclared importance × sqrt(category frequency); engineering diagnostic, not EV'},'p1':'Current-visible-dora/no-ura counterfactual; labels from same engine, independent replay validation still required. 48 development games in two families; no formal P1. Direct/decomposed model development not yet run; no outer holdout or promotion.'}
Path('/tmp/p1-r1-summary.json').write_text(json.dumps(out,ensure_ascii=False,indent=2));Path('/tmp/r1-top100-pilot.json').write_text(json.dumps(top,ensure_ascii=False))
print(json.dumps(out,ensure_ascii=False,indent=2))
