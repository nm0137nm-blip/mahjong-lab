"""Fixed-sample three-arm arena, one observation per starting seed."""
import hashlib,json,sys
from pathlib import Path
import numpy as np
EXPECTED={'pure':'b4ff0a420061b1202e0d7717c7cdea4d6ef7ac0971fff45e0e70f1a49da8edd8','reaction':'11d5699e20319f23040a9e7584e25179615ca8228089de0dce38c527dd7aa42f','special':'0617e41120d1918d69302bf564d294659692e4c35d2a8015c162d003b94a2ff5'}
ARMS=('learned','s42')
UTILITY=np.array([90,45,0,-135])
def seed_for(i):return int.from_bytes(hashlib.sha256(f'coach-arena-v1:{i}'.encode()).digest()[:4],'little') or 1
def evaluate(docs,split):
    expected=set(range(1,6) if split=='smoke' else range(6,106))
    pairs={}
    for x in docs:
        i=x['pair']
        assert i in expected and i not in pairs and x['seed']==seed_for(i) and x['split']==split
        assert all(x['weights']['models'][k]['model_hash']==v and x['weights']['models'][k]['byte_parity'] for k,v in EXPECTED.items())
        assert x['opponents']=='basic' and len(x['rows'])==2 and {r['policy'] for r in x['rows']}==set(ARMS)
        d={r['policy']:r for r in x['rows']}
        for k,row in d.items():
            assert row['pair']==i and row['seed']==seed_for(i) and row['rank'] in (1,2,3,4) and row['hands']>0 and row['decisions']>0
            a=row['opponentAudit']; assert row['opponents']=='basic' and len(a)==3 and all(c['invalid']==0 and c['actions']>0 for c in a)
            assert 0<=row['wins']<=row['hands'] and 0<=row['dealIns']<=row['hands']
            if k=='basic':
                b=row['standardAudit'];assert b['invalid']==0 and b['actions']==row['decisions']
        pairs[i]=d
    assert set(pairs)==expected,('missing assigned pairs',sorted(expected-set(pairs)))
    data={k:[pairs[i][k] for i in sorted(pairs)] for k in ARMS}
    ranks={k:np.array([r['rank'] for r in rows]) for k,rows in data.items()}
    def basic_stats(k,rows):
        rank=ranks[k]; hands=sum(r['hands'] for r in rows)
        return dict(n=len(rows),mean_rank=float(rank.mean()),rank_rates=[float((rank==i).mean()) for i in range(1,5)],mean_score=float(np.mean([r['score'] for r in rows])),custom_rank_utility=float(UTILITY[rank-1].mean()),win_rate=sum(r['wins'] for r in rows)/hands,deal_in_rate=sum(r['dealIns'] for r in rows)/hands,hands=hands)
    report={k:basic_stats(k,v) for k,v in data.items()}
    rng=np.random.default_rng(261119);idx=rng.integers(len(pairs),size=(20000,len(pairs)))
    for other in ('s42',):
        a,b=ranks['learned'],ranks[other]
        delta=np.column_stack([UTILITY[a-1]-UTILITY[b-1],a-b,(a==4).astype(int)-(b==4).astype(int)])
        means=delta[idx].mean(1)
        report['learned_minus_'+other]={name:{'mean':float(delta[:,j].mean()),'ci95':np.percentile(means[:,j],[2.5,97.5]).tolist()} for j,name in enumerate(['custom_rank_utility','rank','last_rate'])}
    report['interpretation']='Operational smoke only; no skill claim.' if split=='smoke' else 'Fixed 100 independent starting-seed pairs against three standard CPUs; primary comparison is learned vs S42. No optional stopping. Custom utility is not official Tenhou points.'
    return report
if __name__=='__main__':
    split=sys.argv[1];assert split in ('smoke','prospective')
    print(json.dumps(evaluate([json.loads(p.read_text()) for root in sys.argv[2:] for p in sorted(Path(root).rglob('paired-*.json'))],split),indent=2))
