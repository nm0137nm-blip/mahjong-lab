"""Private branch accounting. No raw inputs or per-case results in public CI logs."""
import sys,json,importlib.util
spec=importlib.util.spec_from_file_location('boundary','source-profile/handoff/learning-corpus/tenhou-boundary-audit.py');boundary=importlib.util.module_from_spec(spec);spec.loader.exec_module(boundary)
def actor_result(p,round_index,actor_id):
 q=p['log'][round_index][0]['qipai'];events=p['log'][round_index];dealer=(p['qijia']+q['jushu'])%4
 start=[q['defen'][(i-dealer)%4] for i in range(4)];points=start[:];sticks=q['lizhibang']
 assert sum(points)+sticks*1000==100000
 reach=0
 for i,event in enumerate(events):
  d=event.get('dapai')
  if d and d['p'].endswith('*'):
   following=next((x for x in events[i+1:] if 'kaigang' not in x),{})
   if 'hule' not in following and following.get('pingju',{}).get('name')!='三家和':
    points[(dealer+d['l'])%4]-=1000;sticks+=1
    reach+=int((dealer+d['l'])%4==actor_id)
 results=[(k,e[k]) for e in events for k in ('hule','pingju') if k in e]
 assert results and reach<=1
 for k,e in results:
  assert len(e['fenpei'])==4
  for l,v in enumerate(e['fenpei']):points[(dealer+l)%4]+=v
 rem=100000-sum(points);assert rem>=0 and rem%1000==0
 if results[0][0]=='hule':
  assert rem==0 and all(k=='hule' for k,e in results)
 if round_index+1<len(p['log']):
  n=p['log'][round_index+1][0]['qipai'];nd=(p['qijia']+n['jushu'])%4
  assert points==[n['defen'][(i-nd)%4] for i in range(4)] and rem==1000*n['lizhibang']
 else:
  rank=sorted(range(4),key=lambda i:(-points[i],(i-p['qijia'])%4));final=points[:];final[rank[0]]+=rem;assert final==p['score']
 assert sum(p['score'])==100000 and sorted(p['rank'])==[1,2,3,4]
 return dict(start=start[actor_id],roundNet=points[actor_id]-start[actor_id],finalScore=p['score'][actor_id],fourth=int(p['rank'][actor_id]==4))
try:
 x=json.load(sys.stdin);boundary.audit(x['riichi']);boundary.audit(x['dama']);r=actor_result(x['riichi'],x['roundIndex'],x['actorId']);d=actor_result(x['dama'],x['roundIndex'],x['actorId']);assert r['start']==d['start']
 print(json.dumps(dict(riichiRound=r['roundNet'],damaRound=d['roundNet'],deltaRound=r['roundNet']-d['roundNet'],deltaFinal=r['finalScore']-d['finalScore'],deltaFourth=r['fourth']-d['fourth'])))
except Exception:
 sys.exit(1)
