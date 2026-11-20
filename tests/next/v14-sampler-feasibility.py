"""Feasibility pilot ONLY: reconstruct hidden histories for closed, no-call turns.
Not a posterior and not a rollout. No oracle, completed paipu, reference or outcome
access. The deliberately restricted subset tests physical/temporal constraints first.
"""
import collections, json, math, random, re, sys, time
from pathlib import Path
from mahjong.shanten import Shanten
SH=Shanten()
T=[s+str(n) for s in 'mpsz' for n in range(1,8 if s=='z' else 10)]
I={t:i for i,t in enumerate(T)}
def norm(t):return t.replace('0','5')
def count(h):
    c=[0]*34
    for t in h:c[I[norm(t)]]+=1
    return c
def sh(h):return SH.calculate_shanten(count(h))
def ready(h):
    if len(h)!=13:return False
    c=count(h)
    if SH.calculate_shanten(c)!=0:return False
    for i,n in enumerate(c):
        if n==4:continue
        a=c.copy();a[i]+=1
        if SH.calculate_shanten(a)==-1:return True
    return False
def stock():
    out=[]
    for t in T:
        out.extend([t]* (3 if t[1]=='5' and t[0]!='z' else 4))
        if t[1]=='5' and t[0]!='z':out.append(t[0]+'0')
    assert len(out)==136
    return out
def remove(h,t):
    if t not in h:raise ValueError('tile unavailable')
    h.remove(t)
def draw_ready(pool,rng):
    # constructive proposal, NOT uniform over ready hands; geometry bias recorded.
    for _ in range(40):
        left=pool.copy();h=[]
        try:
            for k in range(4):
                shape=[]
                if rng.random()<.30:
                    opt=[t for t,n in collections.Counter(map(norm,left)).items() if n>=3]
                    if opt:shape=[rng.choice(sorted(opt))]*3
                if not shape:
                    n=collections.Counter(map(norm,left))
                    opt=[(s,i) for s in 'mps' for i in range(1,8) if all(n[s+str(j)] for j in (i,i+1,i+2))]
                    if not opt:raise ValueError('no set')
                    s,i=rng.choice(opt);shape=[s+str(j) for j in (i,i+1,i+2)]
                for t in shape:
                    raw=rng.choice([p for p in left if norm(p)==t]);remove(left,raw);h.append(raw)
            opt=[t for t,n in collections.Counter(map(norm,left)).items() if n>=2]
            if not opt:raise ValueError('no pair')
            t=rng.choice(sorted(opt))
            for _ in range(2):
                raw=rng.choice([p for p in left if norm(p)==t]);remove(left,raw);h.append(raw)
            left.append(h.pop(rng.randrange(14)))
            if ready(h):return h,left
        except (ValueError,IndexError):pass
    raise ValueError('ready proposal exhausted')
def reconstruct(s,rng):
    own=s['ownSeat'];ev=s['publicEvents'];pool=stock()
    for t in s['hand']+s['dora']+[d['tile'] for r in s['rivers'] for d in r['discards']]:remove(pool,t)
    h=[None]*4;h[own]=s['hand'].copy()
    order=[i for i in range(4) if i!=own];rng.shuffle(order)
    for i in sorted(order,key=lambda i:not s['rivers'][i]['riichi']):
        if s['rivers'][i]['riichi']:h[i],pool=draw_ready(pool,rng)
        else:
            h[i]=rng.sample(pool,13)
            for t in h[i]:remove(pool,t)
    assert len(pool)==s['remaining']+13
    rng.shuffle(pool);wall=pool[:s['remaining']];dead=pool[s['remaining']:]
    current=[sorted(x) for x in h];past={};pending={}
    # No calls, no kans subset; last event is own current draw.
    for j,e in reversed(list(enumerate(ev))):
        i=e['席'];k=e['種類']
        if k=='打牌':
            if i in pending or len(h[i])!=13:raise ValueError('reverse discard arity')
            if e['立直宣言'] and not ready(h[i]):raise ValueError('riichi not ready')
            pre=h[i].copy();h[i].append(e['牌']);pending[i]=(e,pre)
        elif k=='自摸':
            if len(h[i])!=14:raise ValueError('reverse draw arity')
            if i not in pending:
                if j!=len(ev)-1 or i!=own:raise ValueError('unpaired draw')
                p=s['drawn']
            else:
                d,pre=pending.pop(i)
                p=d['牌'] if d['ツモ切り'] else rng.choice(pre)
            remove(h[i],p);past[j]=p
        else:raise ValueError('unsupported event')
    if pending or any(len(x)!=13 for x in h):raise ValueError('initial arity')
    initial=[x.copy() for x in h]
    # Independent forward replay check and heuristic prior-action consistency.
    declared=set();last={};penalty=0;hand_discards=0;draws=[]
    for j,e in enumerate(ev):
        i=e['席'];k=e['種類']
        if k=='自摸':
            if len(h[i])!=13:raise ValueError('forward draw arity')
            t=past[j];h[i].append(t);last[i]=t;draws.append(t)
            continue
        t=e['牌']
        if len(h[i])!=14 or i not in last:raise ValueError('forward discard arity')
        d=last.pop(i)
        if e['ツモ切り'] and t!=d:raise ValueError('tsumogiri mismatch')
        if not e['ツモ切り'] and t==d and h[i].count(t)<2:raise ValueError('tedashi mismatch')
        if i in declared and (not e['ツモ切り'] or e['立直宣言']):raise ValueError('riichi lock')
        if not e['ツモ切り'] and i!=own:
            # Diagnostic only: shanten deterioration is not a probability.
            best=min(sh([p for k,p in enumerate(h[i]) if k!=idx]) for idx in range(14))
            hh=h[i].copy();remove(hh,t);penalty+=max(0,sh(hh)-best);hand_discards+=1
        remove(h[i],t)
        if e['立直宣言']:
            if not ready(h[i]):raise ValueError('forward riichi not ready')
            declared.add(i)
    if [sorted(x) for x in h]!=current:raise ValueError('history mismatch')
    if set(i for i,r in enumerate(s['rivers']) if r['riichi'])!=declared:raise ValueError('riichi flag mismatch')
    # Verify full physical inventory both at round start and current state.
    if collections.Counter(sum(initial,[])+draws+wall+dead+s['dora'])!=collections.Counter(stock()):raise ValueError('initial inventory')
    if collections.Counter(sum(h,[])+[d['tile'] for r in s['rivers'] for d in r['discards']]+wall+dead+s['dora'])!=collections.Counter(stock()):raise ValueError('current inventory')
    return {'ready':[ready(h[i]) if i!=own else None for i in range(4)],'penalty':penalty,'hand_discards':hand_discards,'weight':math.exp(-.25*penalty)}
def eligible(x):
    s=x['scene'];ev=s['publicEvents'];own=s['ownSeat']
    if x['phase']!='turn' or not s['drawn'] or s['pendingReach'] or len(s['hand'])!=14 or len(s['dora'])!=1 or s['remaining']<8 or not ev:return False
    if any(r['melds'] or any(d['called'] for d in r['discards']) for r in s['rivers']):return False
    if any(e['種類'] not in ('自摸','打牌') for e in ev):return False
    if ev[-1]!={'種類':'自摸','席':own}:return False
    if s['rivers'][own]['riichi'] or s['activeSeat']!=own:return False
    # Require at least two real legal concrete discard groups.
    return sum(a['action']<37 for a in x['actions'])>=2
def main(root,out):
    paths=sorted(root.glob('p1-v2-dev-data-*/manifest.json'),key=lambda p:int(p.parent.name.split('-')[-1]));assert len(paths)==96
    choices={False:[],True:[]}
    for p in paths:
        m=json.loads(p.read_text());assert m['split']=='development-only'
        for x in json.loads((p.parent/'public.json').read_text()):
            if not eligible(x):continue
            s=x['scene'];riichi=any(r['riichi'] for i,r in enumerate(s['rivers']) if i!=s['ownSeat'])
            if (riichi and s['remaining']<=45) or (not riichi and 30<=s['remaining']<=55):
                choices[riichi].append((m['shard'],m['seed'],x))
    used=set();selected=[]
    for riichi in (True,False):
        for j in range(4):
            rec=next((r for r in choices[riichi] if r[0] not in used),None)
            if not rec:break
            used.add(rec[0]);selected.append((riichi,*rec))
    result=[]
    for riichi,shard,seed,x in selected:
        s=x['scene'];rng=random.Random(810044+shard);start=time.perf_counter();rows=[];errors=collections.Counter();attempts=0
        for _ in range(120):
            if len(rows)==16:break
            attempts+=1
            try:rows.append(reconstruct(s,rng))
            except ValueError as e:errors[str(e)]+=1
        elapsed=time.perf_counter()-start;weights=[r['weight'] for r in rows];ess=sum(weights)**2/sum(v*v for v in weights) if weights and sum(v*v for v in weights) else 0
        # Descriptive readiness sensitivity: no posterior/certification claim.
        other=[i for i in range(4) if i!=s['ownSeat']]
        u={str(i):sum(r['ready'][i] for r in rows)/len(rows) for i in other} if rows else {}
        w={str(i):sum(r['weight']*r['ready'][i] for r in rows)/sum(weights) for i in other} if rows and sum(weights)>0 else {}
        result.append({'shard':shard,'seed':seed,'decision':x['id'],'riichi':riichi,'remaining':s['remaining'],'attempts':attempts,'accepted':len(rows),'seconds':elapsed,'errors':dict(errors),'effective_sample_size':ess,'unweighted_ready':u,'heuristic_weighted_ready':w})
        print('SAMPLER',shard,len(rows),round(elapsed,3),flush=True)
    summary={'status':'restricted_feasibility_only_no_rollout','planned':8,'selected':len(result),'accepted_samples':sum(x['accepted'] for x in result),'cases':result,'limitations':['closed no-call own turn only','constructive ready proposal biased; weights are heuristic not policy likelihood','unknown history of own prior draws reconstructed not observed','temporary furiten and legal win availability not replayed','no candidate continuation or score','no formal inference, no product use']}
    out.write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(summary,ensure_ascii=False))
if __name__=='__main__':main(Path(sys.argv[1]),Path(sys.argv[2]))
