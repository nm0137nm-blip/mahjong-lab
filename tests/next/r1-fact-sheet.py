"""Prepare disaggregated facts for actual top100; not causal classification or promotion."""
import json,collections,sys
from pathlib import Path
data=json.loads(Path(sys.argv[1]).read_text())
assert len(data)==100
out=[]
for z in data:
 x=z['public_case'];s=x['scene'];o=s['ownSeat'];facts=x['facts']
 actions={a['action']:a for a in x['actions']}
 a,b=actions[z['chosen']],actions[z['reference']]
 cs={r['打牌']:r for r in facts.get('候補別牌姿',[])}
 ca=cs.get(a['details'][0]) if a['action']<37 else None;cb=cs.get(b['details'][0]) if b['action']<37 else None
 det={'seed':z['seed'],'id':z['id'],'diagnostic_category':z['category'],'normalized_teacher_gap':z['normalized_gap'],'raw_Q_gap':z['q_gap'],'priority':z['diagnostic_priority'],'chosen':a,'teacher':b,'round':s['round'],'remaining':s['remaining'],'own_points':s['scores'][o]['points'],'relative_points':[s['scores'][o]['points']-s['scores'][j]['points'] for j in range(4) if j!=o],'riichi_opponents':[j for j,r in enumerate(s['rivers']) if j!=o and r['riichi']],'own_hand':s['hand'],'own_melds':s['selfMelds'],'public_case':x}
 if ca and cb:
  det['efficiency']={'chosen_shanten':ca['向聴'],'teacher_shanten':cb['向聴'],'chosen_ukeire':ca['受け入れ'],'teacher_ukeire':cb['受け入れ'],'teacher_strict_efficiency_better':cb['向聴']<ca['向聴'] or cb['向聴']==ca['向聴'] and cb['受け入れ']>ca['受け入れ']}
  diff=det['efficiency'];det['hypothesis']='efficiency_or_missing_shape_signal' if diff['teacher_strict_efficiency_better'] and not det['riichi_opponents'] else 'tradeoff_or_threat_requires_review'
 else:det['hypothesis']='special_action_policy_or_grouping_requires_review'
 out.append(det)
freq=collections.Counter(x['hypothesis'] for x in out)
summary={'status':'R1_top100_fact_sheet_prepared_not_causal_or_complete','n':len(out),'hypotheses':dict(freq),'teacher_strict_efficiency_better':sum(x.get('efficiency',{}).get('teacher_strict_efficiency_better',False) for x in out),'discussion':'Manual/algorithmic causal validation and frequency on more fresh on-policy matches needed; no proof of available 15pt improvement. Do not select final candidate from these test seeds; these are declared development.'}
Path('/tmp/r1-fact-sheet.json').write_text(json.dumps(out,ensure_ascii=False));Path('/tmp/r1-fact-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2));print(json.dumps(summary,ensure_ascii=False,indent=2))
