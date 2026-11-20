"""Repair only independently proven impossible own-fifth-tile ready labels.
The source match artifacts are immutable. This script operates on a disposable
downloaded copy, after recording its original SHA256. The ordinary audits must
then pass unchanged. No V1 outer data or policy outcomes are touched.
"""
import collections, hashlib, json, re, sys
from pathlib import Path
from mahjong.shanten import Shanten

ALL=[s+str(n) for s in 'mpsz' for n in range(1,8 if s=='z' else 10)]
SH=Shanten()
def index(t): return ALL.index(t[:2].replace('0','5'))
def parse(raw):
    parts=raw.rstrip('*').split(',')
    c=[0]*34
    total=[0]*34
    for g in re.findall(r'[mpsz][0-9]+',parts[0]):
        for n in g[1:]: c[index(g[0]+n)]+=1
    total=c.copy()
    for m in parts[1:]:
        for n in m[1:]:
            if n.isdigit(): total[index(m[0]+n)]+=1
    assert sum(c)+3*(len(parts)-1)==13 and max(total)<=4
    return c,total,len(parts)-1
def complete(c,n):
    if sum(c)!=3*n: return False
    if not n: return not any(c)
    i=next(j for j,v in enumerate(c) if v)
    if c[i]>=3:
        a=c.copy();a[i]-=3
        if complete(a,n-1): return True
    if i<27 and i%9<7 and c[i+1] and c[i+2]:
        a=c.copy()
        for j in (i,i+1,i+2): a[j]-=1
        if complete(a,n-1): return True
    return False
def virtual_win(c,n,i):
    a=c.copy();a[i]+=1
    for j,v in enumerate(a):
        if v>=2:
            b=a.copy();b[j]-=2
            if complete(b,4-n):return True
    return False
def shanten(c,n):
    return SH.calculate_shanten(c,use_chiitoitsu=not n,use_kokushi=not n)
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def main(root,manifest):
    lock=json.loads(manifest.read_text())
    entries={e['seed']:e for e in lock['entries']}
    paths=sorted(root.rglob('manifest.json'));assert len(paths)==len(entries)==96
    assert len({json.loads(p.read_text())['seed'] for p in paths})==96
    corrections=[];count=0;files=[]
    for p in paths:
        seed=json.loads(p.read_text())['seed'];assert seed in entries
        q=p.parent/'oracle.json';before=sha(q);rows=json.loads(q.read_text());changed=False
        for row in rows:
            for lab in row['opponents']:
                count+=1
                c,total,n=parse(lab['privateHand'])
                independent=shanten(c,n)
                if independent==lab['shanten']:continue
                # No special pleading: any other disagreement is a hard failure.
                assert independent==1 and lab['shanten']==0 and lab['tenpai'] is True
                assert not lab['lizhi'] and not lab['structuralWaits'] and not lab['riverFuriten']
                assert not any(lab['legalRon'].values()) and all(x is None for x in lab['baseLoss'].values()) and all(x is None for x in lab['firstLoss'].values())
                completions=[i for i in range(34) if virtual_win(c,n,i)]
                assert completions and all(c[i]==4 and total[i]==4 for i in completions)
                lab['shanten']=independent;lab['tenpai']=False;changed=True
                corrections.append({'seed':seed,'decision':row['id'],'seat':lab['seat'],'hand':lab['privateHand'],'impossible_waits':[ALL[i] for i in completions],'before':[0,True],'after':[1,False]})
        if changed:q.write_text(json.dumps(rows,ensure_ascii=False,separators=(',',':')))
        files.append({'seed':seed,'original_oracle_sha256':before,'derived_oracle_sha256':sha(q)})
    assert count==30693
    assert len(corrections)==3 and {(x['seed'],x['decision'],x['seat']) for x in corrections}=={(3794127802,x,2) for x in ('d-51','d-53','d-54')}
    out={'status':'derived_physical_tenpai_labels_pending_unchanged_independent_audits','matches':96,'states':count,'corrections':corrections,'files':files,'scope':'Only v2 development teacher T/shanten. Original artifacts retained. No Ron/wait/payment/trajectory alterations. V1 outer untouched. Historical training labels not newly audited.'}
    Path('/tmp/p1-v2-label-recovery.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in out.items() if k!='files'},ensure_ascii=False))
if __name__=='__main__':main(Path(sys.argv[1]),Path(sys.argv[2]))
