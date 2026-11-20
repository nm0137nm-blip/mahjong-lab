import json,sys,statistics,random
from pathlib import Path
from collections import defaultdict
root=Path(sys.argv[1]);manifest=json.loads(Path(sys.argv[2]).read_text());candidate=json.loads(Path(sys.argv[3]).read_text())
files=[p for p in root.rglob('rollout-*.json') if p.name!='rollout-seeds.json'];assert len(files)==64
pairs=defaultdict(dict)
for p in files:
 q=json.loads(p.read_text())
 assert len(q['rows'])==2 and q['seed']==manifest['seeds'][q['pair']-1]
 for r in q['rows']:
  k=(r['dealer'],r['arm']);assert k not in pairs[q['pair']] and r['seed']==q['seed'] and r['candidateSha']==candidate['files']['pure']
  assert r['rank']==r['allRanks'][0] and sorted(r['allRanks'])==[1,2,3,4]
  assert r['cpuAudit']['fallbacks']==0 and r['cpuAudit']['activeSeats']==3 and r['wallHashes'] and len(r['wallHashes'])==r['hands']
  pairs[q['pair']][k]=r
assert len(pairs)==16
U=[90,45,0,-135];blocks=[];allrows=[]
for i,rows in sorted(pairs.items()):
 assert set(rows)=={(s,a) for s in range(4) for a in ('baseline','candidate')}
 assert len({r['wallHashes'][0] for r in rows.values()})==1
 b=[rows[(s,'baseline')] for s in range(4)];c=[rows[(s,'candidate')] for s in range(4)]
 d=statistics.mean(U[x['rank']-1]-U[y['rank']-1] for x,y in zip(c,b))
 blocks.append({'block':i,'seed':manifest['seeds'][i-1],'delta':d,'baseline_ranks':[r['rank'] for r in b],'candidate_ranks':[r['rank'] for r in c]});allrows.extend(rows.values())
def pack(a):
 r=[x for x in allrows if x['arm']==a]
 return {'n':len(r),'mean_rank':statistics.mean(x['rank'] for x in r),'last_rate':statistics.mean(x['rank']==4 for x in r),'utility':statistics.mean(U[x['rank']-1] for x in r),'win_rate':sum(x['wins'] for x in r)/sum(x['hands'] for x in r),'deal_in_rate':sum(x['dealIns'] for x in r)/sum(x['hands'] for x in r)}
d=[x['delta'] for x in blocks];rng=random.Random(261120);boot=sorted(statistics.mean(rng.choices(d,k=16)) for _ in range(20000))
out={'status':'R1_rollout_extension_development_only','scope':'16 new extension blocks × 4 seats × 2 arms vs corrected S42x3. Candidate fitted using 24 development matches, not formal seed inventory. Exploratory CI; not proof +15pt or promotion. No opponent or formal changes.','candidate':candidate,'n_blocks':16,'n_matches':128,'baseline':pack('baseline'),'candidate_arm':pack('candidate'),'delta':statistics.mean(d),'ci95_descriptive':[boot[499],boot[19499]],'blocks':blocks}
# Report earlier pilot separately, and the combined descriptive estimate only.
# This adaptation is NOT the formal two-stage experiment.
prior=json.loads(Path(sys.argv[4]).read_text());assert prior['n_blocks']==8 and prior['candidate']['files']==candidate['files']
assert not set(b['seed'] for b in prior['blocks'])&set(b['seed'] for b in blocks)
all_d=[b['delta'] for b in prior['blocks']]+d
rng=random.Random(261120);bb=sorted(statistics.mean(rng.choices(all_d,k=24)) for _ in range(20000))
out['previous_pilot']={'delta':prior['delta'],'ci95_descriptive':prior['ci95_descriptive']}
out['combined_exploratory']={'n_blocks':24,'n_matches':192,'delta':statistics.mean(all_d),'ci95_descriptive':[bb[499],bb[19499]],'warning':'Adaptively extended development pilot; not independent confirmatory inference.'}
out['next_decision']='consider_preregistered_formal_trial_only_if_new_and_combined_point_estimates_at_least_15' if statistics.mean(d)>=15 and statistics.mean(all_d)>=15 else 'archive_candidate_no_formal_trial_on_current_evidence'
Path('/tmp/r1-dev-rollout-summary.json').write_text(json.dumps(out,indent=2));print(json.dumps(out,indent=2))
