"""Read-only audit of development-only Mahjong LAB match artifacts. No training."""
import hashlib, json, sys, zipfile
from pathlib import Path

EXPECTED = {
    1: '595859cdfe52a08391cb2fb11bc7ec1e724142fbb3dee29f88fc696b1c02f3e1',
    33: 'df97d88b7375a12fc2becb8fcc80436b3c0d84a151e79f7fabc581adca5f244b',
    65: '3ac0e74e795332e82de79c75f48e61aca91311219dd9b6ad7d688afb1956f078',
    90: 'ad6b0e67c73ae91ff0e2d92d83de260671177a689135c798063d892576baa5cb',
}

def fixed_seats(values, dealer):
    return [values[(p-dealer)%4] for p in range(4)]

def finish(scores, next_round, repeat, abortive, dealer, rounds):
    return (min(scores)<0 or next_round>=4*rounds or
            (next_round==4*rounds-1 and repeat and not abortive and
             all(scores[dealer]>scores[p] for p in range(4) if p!=dealer)))

def audit(path):
    digest=hashlib.sha256(Path(path).read_bytes()).hexdigest()
    with zipfile.ZipFile(path) as z:
        manifest=json.loads(z.read('manifest.json'))
        p=json.loads(z.read('paipu.json'))
    assert manifest['split']=='development-only'
    assert digest==EXPECTED[manifest['shard']]
    row,=manifest['rows']
    assert p['score']==row['allScores'] and p['rank']==row['allRanks']
    assert sum(p['score'])==100000 and sorted(p['rank'])==[1,2,3,4]
    initial=p['qijia']; logs=p['log']; accepted=0; win=0; draw=0; abort=0
    # Historical campaign is hanchan. This scope is not a general rules audit.
    for i,events in enumerate(logs):
        q=events[0]['qipai']; oya=(initial+q['jushu'])%4
        assert sum(q['defen'])+1000*q['lizhibang']==100000
        results=[(k,e[k]) for e in events for k in ('hule','pingju') if k in e]
        assert results and (all(k=='hule' for k,e in results) or len(results)==1)
        deduct=[0]*4
        for n,e in enumerate(events):
            d=e.get('dapai')
            if not d or not d['p'].endswith('*'): continue
            nxt=events[n+1] if n+1<len(events) else {}
            if 'hule' in nxt or nxt.get('pingju',{}).get('name')=='三家和': continue
            deduct[d['l']]+=1000; accepted+=1
        local=[q['defen'][l]-deduct[l]+sum(e['fenpei'][l] for k,e in results) for l in range(4)]
        scores=fixed_seats(local,oya); balance=100000-sum(scores)
        assert balance>=0 and balance%1000==0
        kyotaku=balance//1000
        if results[0][0]=='hule':
            win+=1; repeat=any(e['l']==0 for k,e in results); abortive=False
            assert kyotaku==0
        else:
            draw+=1; e=results[0][1]; abortive=e['name']!='荒牌平局'
            abort+=abortive; repeat=abortive or bool(e['shoupai'][0])
            # This check is restricted to recorded normal draws without nagashi mangan.
            assert e['name']!='流し満貫'
        current=4*q['zhuangfeng']+q['jushu']; nr=current+(not repeat)
        ended=finish(scores,nr,repeat,abortive,oya,2)
        if i+1<len(logs):
            assert not ended
            nxt=logs[i+1][0]['qipai']; next_oya=(initial+nxt['jushu'])%4
            assert scores==fixed_seats(nxt['defen'],next_oya)
            assert kyotaku==nxt['lizhibang'] and nr==4*nxt['zhuangfeng']+nxt['jushu']
            next_honba=q['changbang']+1 if repeat or results[0][0]=='pingju' else 0
            assert next_honba==nxt['changbang']
        else:
            assert ended
            order=sorted(range(4),key=lambda p:(-scores[p],(p-initial)%4))
            ranks=[order.index(p)+1 for p in range(4)]
            scores[order[0]]+=1000*kyotaku
            assert scores==p['score'] and ranks==p['rank']
    return dict(shard=manifest['shard'],family=row['opponentFamily'],policy=row['policy'],hands=len(logs),continuing=len(logs)-1,terminal=1,wins=win,draws=draw,abortive=abort,acceptedRiichi=accepted,sha256=digest)

if __name__=='__main__':
    # Source-level finish boundary checks, not an independent engine parity claim.
    assert finish([38000,0,31000,31000],1,False,False,0,1)==False
    assert finish([38000,-100,31100,31000],1,False,False,0,1)==True
    assert finish([28000,27000,24000,21000],3,True,False,0,1)==True
    assert finish([28000,28000,24000,20000],3,True,False,0,1)==False
    assert finish([28000,27000,24000,21000],3,True,True,0,1)==False
    assert finish([25000]*4,4,False,False,0,1)==True
    assert finish([25000]*4,7,True,False,0,2)==False
    assert fixed_seats([1,2,3,4],2)==[3,4,1,2]
    rows=[audit(path) for path in sys.argv[1:]]
    assert set(r['shard'] for r in rows)==set(EXPECTED) and len(rows)==len(EXPECTED)
    print(json.dumps({'matches':len(rows),'hands':sum(r['hands'] for r in rows),'boundaryChecks':8,'rows':rows},indent=2))
