"""Read original historical manifest artifacts; no prospective formal match data.
Previously generated local namespace_audit.json was used only to recover manifest IDs.
Verify independently from original CI artifacts, retaining full historical seed IDs and hash inventory."""
import sys,json,hashlib
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'arena'))
from rebuild_policy import PAIRS,load
from rebuild_belief import SHARDS
from seed_manifest_v11 import make,seed
OLD=[14430011488,14430256741,14429707928,14429487544,14429758497,14429088588,14429908516,14431030874]
DEV=[(14510373256,14510782087),(14509909186,14510607341),(14510362462,14511075643)]
jobs=[('old-train',q,mid) for (q,r),mid in zip(PAIRS[:8],OLD)]
jobs += [('belief-train',q,mid) for q,r,mid,t in SHARDS]
jobs += [('development',q,mid) for q,mid in DEV]
known=json.loads(Path(sys.argv[1]).read_text())
prospective=make(known)
seen=set();public={};manifest=[];counts={'old-train':0,'belief-train':0,'development':0}
parts={k:[] for k in counts}
for family,qid,mid in jobs:
 m=load(mid,'manifest.json');xs=load(qid,'blind.json')['items']
 assert m['matchCount']==10 and len(m['matches'])==10 and len(xs)==sum(v['included'] for v in m['matches'])
 keys={v['prefix']:v['matchSeed'] for v in m['matches']}
 assert len(keys)==10 and len(set(keys.values()))==10 and all(isinstance(s,int) and 0<s<2**32 for s in keys.values())
 assert not seen.intersection(keys.values());seen.update(keys.values());parts[family]+=list(keys.values());counts[family]+=len(xs)
 for x in xs:
  prefix,idx=x['id'].rsplit('-',1);assert prefix in keys and idx.isdecimal()
  canon=json.dumps([x['phase'],x['scene'],x['actions']],sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()
  digest=hashlib.sha256(canon).hexdigest();assert digest not in public,('duplicate public decision',keys[prefix],x['id'])
  public[digest]=keys[prefix]
 manifest.append({'source_q_artifact':qid,'source_manifest_artifact':mid,'family':family,'cohort':m['cohort'],'code_sha':m.get('codeSha'),'seeds':sorted(keys.values()),'decisions':len(xs)})
 print(f'VERIFIED {family} {mid} {len(xs)}',flush=True)
assert len(parts['old-train'])==80 and len(parts['belief-train'])==120 and len(parts['development'])==30
assert set(parts['belief-train'])==set(known['training_seeds'])
arena_names={'coach-arena-v1':105,'coach-belief-arena-v1':105,'coach-phase0-duplicate-v1':4,'coach-phase0-duplicate-v2':4,'coach-phase0-variance-v1':12,'coach-phase0-variance-v2':12,'coach-phase0-live-v1':2,'coach-phase0-payload-v1':2,'coach-phase0-payload-v2':2}
arena={k:[seed(f'{k}:{i}') for i in range(1,n+1)] for k,n in arena_names.items()}
assert set(arena['coach-belief-arena-v1'])==set(known['arena_seeds'])
exclusion=seen|{s for v in arena.values() for s in v}
new=[s for v in prospective.values() if isinstance(v,dict) for s in v['seeds']]
assert len(new)==len(set(new))==808 and not exclusion.intersection(new)
def write(p,x):Path(p).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
out={'status':'all_available_historical_training_development_seed_inventory_verified','train_matches':200,'development_matches':30,'unique_excluded_seeds':len(exclusion),'formal_reserved_seeds':800,'pilot_development_seeds':8,'historical_public_hashes':len(public),'overlap':0,'counts':counts,'manifest':manifest,'arena_seed_namespaces':arena,'excluded_seeds':sorted(exclusion),'limitations':'Historical raw wall/trajectory hashes were not retained for all 700 games. Direct seed identity and exact public scene hash audit are verified; near-clones and all legacy wall hashes not established. Before formal evaluation require candidate identity, runtime/rule hashes, per-match initial wall/log hashes, prospective train/dev exclusion and exact collision check; no activation by this result alone.'}
write('/tmp/seed-history.json',out);write('/tmp/seed-history-public-sha256.json',public)
print(json.dumps({k:v for k,v in out.items() if k not in ('manifest','arena_seed_namespaces','excluded_seeds')},ensure_ascii=False,indent=2))
