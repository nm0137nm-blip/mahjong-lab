"""Preregistered two-stage decision; no candidate selection using formal data."""
import hashlib,json,random,math,sys
from pathlib import Path
KEYS=('model_weights_hash','feature_contract_hash','preprocess_hash','hyperparameters_hash','inference_code_hash','decision_threshold_hash','runtime_hash','baseline_hash','opponent_hash','rule_hash')
def identity(run):
    obj=run['identity']
    assert set(obj)==set(KEYS) and all(isinstance(x,str) and len(x)==64 and all(c in '0123456789abcdef' for c in x) for x in obj.values())
    return obj
def pair_deltas(run,expected):
    assert run['split']=='formal_primary' and run['condition']=='s42x3'
    assert run['seed_manifest_sha256']==expected['sha256']
    assert run['phase']==expected['phase']
    assert len(run['blocks'])==160
    found={}
    for block in run['blocks']:
        s=block['seed'];assert s not in found and s in expected['seeds']
        rows=block['rows'];assert len(rows)==8
        by={}
        for r in rows:
            k=(r['arm'],r['seat']);assert k not in by
            assert k[0] in ('candidate','baseline') and k[1] in range(4)
            assert r['valid'] is True and r['fallbacks']==0 and r['rank'] in (1,2,3,4)
            assert isinstance(r['initial_wall_hash'],str) and len(r['initial_wall_hash'])==64
            assert isinstance(r['replay_hash'],str) and len(r['replay_hash'])==64
            by[k]=r
        assert len({r['initial_wall_hash'] for r in rows})==1
        u=[90,45,0,-135]
        found[s]=sum(u[by['candidate',seat]['rank']-1]-u[by['baseline',seat]['rank']-1] for seat in range(4))/4
    assert set(found)==set(expected['seeds'])
    return [found[s] for s in expected['seeds']]
def interval(d):
    assert len(d) in (160,320)
    rng=random.Random(261120)
    n=len(d)
    b=sorted(sum(rng.choices(d,k=n))/n for _ in range(20000))
    return sum(d)/n,b[499],b[19499]
def decide(d,phase):
    m,lo,hi=interval(d)
    status=('freeze_futility' if hi<15 else 'continue_same_candidate') if phase=='interim' else ('promote_research' if m>=15 and lo>0 else 'freeze_futility' if hi<15 else 'freeze_inconclusive')
    return {'stage':phase,'n_blocks':len(d),'estimate':m,'ci95':[lo,hi],'decision':status,'scope':'research only, no product release'}
def evaluate(first,manifest,second=None):
    i=identity(first);a=pair_deltas(first,manifest['primary_interim'])
    interim=decide(a,'interim')
    if second is None:return interim
    assert interim['decision']=='continue_same_candidate'
    assert identity(second)==i,'changed candidate or comparison identity'
    b=pair_deltas(second,manifest['primary_second'])
    assert not set(manifest['primary_interim']['seeds'])&set(manifest['primary_second']['seeds'])
    return {'interim':interim,'final':decide(a+b,'final')}
if __name__=='__main__':
    x=[json.loads(Path(p).read_text()) for p in sys.argv[1:]]
    print(json.dumps(evaluate(*x),indent=2))
