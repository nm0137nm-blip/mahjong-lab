"""Development-only proposal sensitivity on fixed public late-turn cases.
No oracle access. Neither proposal is claimed to be a posterior.
"""
import importlib.util,collections,json,random,sys,time,math
from pathlib import Path
spec=importlib.util.spec_from_file_location('base',Path(__file__).with_name('v14-sampler-feasibility.py'));base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
root=Path(sys.argv[1]);out=Path(sys.argv[2]);dirs=sorted(root.glob('p1-v2-dev-data-*/manifest.json'),key=lambda p:int(p.parent.name.split('-')[-1]));assert len(dirs)==96
pool={True:[],False:[]}
for p in dirs:
 m=json.loads(p.read_text());assert m['split']=='development-only'
 for x in json.loads((p.parent/'public.json').read_text()):
  if not base.eligible(x):continue
  s=x['scene']
  if not 8<=s['remaining']<=22:continue
  threat=any(r['riichi'] for i,r in enumerate(s['rivers']) if i!=s['ownSeat'])
  pool[threat].append((m,x))
used=set();chosen=[]
for threat in (True,False):
 for _ in range(4):
  m,x=next((m,x) for m,x in pool[threat] if m['shard'] not in used);used.add(m['shard']);chosen.append((m,x))
reports=[]
for m,x in chosen:
 s=x['scene'];row={'shard':m['shard'],'seed':m['seed'],'decision':x['id'],'remaining':s['remaining'],'proposals':{}}
 for mode in ('uniform','mixture'):
  rng=random.Random(835023+m['shard']);start=time.perf_counter();rows=[];errors=collections.Counter();attempts=0
  for _ in range(256):
   if len(rows)==32:break
   attempts+=1
   try:rows.append(base.reconstruct(s,rng,mode))
   except ValueError as e:errors[str(e)]+=1
  weights=[r['weight'] for r in rows];sw=sum(weights)
  seats={}
  for i in range(4):
   if i==s['ownSeat'] or not rows:continue
   seats[str(i)]={'riichi':s['rivers'][i]['riichi'],'ready':sum(r['ready'][i] for r in rows)/len(rows),'weightedReady':sum(r['weight']*r['ready'][i] for r in rows)/sw,'shanten':sum(r['shanten'][i] for r in rows)/len(rows),'waits':{t:sum(t in r['waits'][i] for r in rows)/len(rows) for t in base.T}}
  row['proposals'][mode]={'attempts':attempts,'accepted':len(rows),'errors':dict(errors),'seconds':time.perf_counter()-start,'ess':sw**2/sum(w*w for w in weights) if weights else 0,'seats':seats}
 reports.append(row);print('PROPOSAL',m['shard'],[(k,v['accepted'],round(v['seconds'],2),round(v['ess'],2)) for k,v in row['proposals'].items()],flush=True)
result={'status':'late_public_only_proposal_sensitivity','cases':reports,'limitations':['closed no-call late turns only','both proposals biased; non-riichi mixture deliberately broad, not calibrated','weights shanten deterioration heuristic, not policy likelihood','structural waits not legal ron probabilities']}
out.write_text(json.dumps(result,indent=2)+'\n')
assert len(reports)==8 and all(v['accepted']==32 for r in reports for v in r['proposals'].values())
