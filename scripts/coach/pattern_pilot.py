"""Experimental S42 discard-only imitation; coefficients are associations, not explanations.
Usage: python ... blind.zip reference.zip [report.json]
"""
import json, zipfile, sys
from collections import Counter
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
def read(path,name):
    with zipfile.ZipFile(path) as z: return json.loads(z.read(name))
def norm(p): return p[0]+('5' if p[1]=='0' else p[1])
def tile(a): return ('mps'[a//9]+str(a%9+1) if a<27 else 'z'+str(a-26) if a<34 else 'mps'[a-34]+'0')
NAMES=['shanten','ukeire','retained_dora','honor','terminal','center','own_copies','connected_neighbors','yakuhai','visible_count','red','genbutsu_riichi','non_genbutsu_riichi','shanten_under_riichi','ukeire_under_riichi','dora_under_riichi','genbutsu_late','shanten_late','ukeire_late','same_suit_count','terminal_early','isolated_early','ordinary_shanten','chiitoi_shanten','kokushi_shanten']
def features(x,a,r):
    s=x['scene']; f=x['facts']; p=tile(a); t=norm(p); n=int(t[1]); h=Counter(map(norm,s['hand'])); suited=t[0]!='z'; threats=[i for i,v in enumerate(s['rivers']) if i!=s['ownSeat'] and v['riichi']]; safe={v['席']:v['現物'] for v in r['相手別現物']}; g=sum(safe.get(i,False) for i in threats); ng=len(threats)-g; sh=r['向聴']; u=r['受け入れ']; d=r['保持ドラ翻']; late=1-(s.get('remaining') or 0)/70; connected=sum(h[t[0]+str(k)] for k in range(max(1,n-2),min(9,n+2)+1) if k!=n) if suited else 0; yak=not suited and (n>=5 or n==s['ownSeat']+1 or n==(1 if s['round'][0]=='東' else 2)); forms=r['形と和了条件']['向聴内訳']
    return [sh,u,d,int(not suited),int(suited and n in (1,9)),min(n-1,9-n) if suited else 0,h[t],connected,int(yak),f['見え枚数'][t],int(p[1]=='0'),g,ng,sh*len(threats),u*len(threats),d*len(threats),g*late,sh*late,u*late,sum(v for k,v in h.items() if k[0]==t[0]),int(suited and n in (1,9))*(1-late),int(h[t]==1 and connected==0)*(1-late),*[forms[k] if forms[k] is not None else 14 for k in ('一般形','七対子','国士無双')]]
def load(blind,key):
    keys={k['id']:k for k in key}; out=[]; skipped=Counter()
    for x in blind:
        k=keys[x['id']]; ids=[a['action'] for a in x['actions']]
        if x['phase']!='turn' or any(a>=37 for a in ids): skipped['not_discard_only']+=1;continue
        q=k['q']; rows={}
        for r in x['facts']['候補別牌姿']:
            if '向聴' in r: rows[r['打牌'][:2]]=r
        if any(tile(a) not in rows for a in ids): skipped['missing_candidate']+=1;continue
        out.append(dict(id=x['id'],group=x['id'].rsplit('-',1)[0],ids=ids,best=k['best'],q=np.array([q[a] for a in ids]),F=np.array([features(x,a,rows[tile(a)]) for a in ids],float)))
    return out,dict(skipped)
def fit(train):
    scaler=StandardScaler().fit(np.vstack([r['F'] for r in train])); X=[]; y=[]; w=[]
    for r in train:
        F=scaler.transform(r['F']); best=np.argmax(r['q']); opponents=[i for i,v in enumerate(r['q']) if v<r['q'][best]-1e-8]
        for i in opponents:
            diff=F[best]-F[i]; X.extend([diff,-diff]); y.extend([1,0]); w.extend([1/max(1,len(opponents))]*2)
    model=LogisticRegression(C=0.1,max_iter=1000,fit_intercept=False,random_state=0).fit(X,y,sample_weight=w)
    return scaler,model
def evaluate(rows,pick):
    gaps=[]; normal=[]; exact=0; tied=0
    for r in rows:
        i=pick(r); q=r['q']; gap=float(q.max()-q[i]); width=float(q.max()-q.min()); gaps.append(gap); normal.append(gap/width if width else 0); exact+=r['ids'][i]==r['best']; tied+=gap<1e-8
    return {'n':len(rows),'exact':int(exact),'tied_best':int(tied),'mean_q_gap':float(np.mean(gaps)),'mean_normalized_gap':float(np.mean(normal))}
def main():
    rows,skip=load(read(sys.argv[1],'blind.json')['items'],read(sys.argv[2],'reference.json')); groups=sorted(set(r['group'] for r in rows)); result={'scope':'discard-only; heuristic proxy; not a coach or causal explanation','excluded':skip,'folds':[]}
    if len(groups)<2: raise ValueError('need at least two independent matches')
    for group in groups:
        train=[r for r in rows if r['group']!=group]; test=[r for r in rows if r['group']==group]; sc,model=fit(train)
        base=evaluate(test,lambda r:min(range(len(r['ids'])),key=lambda i:(r['F'][i,0],-r['F'][i,1],-r['F'][i,2],r['ids'][i])))
        learned=evaluate(test,lambda r:int(np.argmax(model.decision_function(sc.transform(r['F'])))))
        result['folds'].append({'heldout_match':group,'training_cases':len(train),'baseline':base,'learned':learned,'standardized_coefficients':dict(zip(NAMES,map(float,model.coef_[0])))})
    result['limitations']='Pilot uses two matches; development has seen parts of corpus. No independent final test, explanation score or deployment. Coefficients are associations.'
    print(json.dumps(result,ensure_ascii=False,indent=2))
    if len(sys.argv)>3: open(sys.argv[3],'w').write(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__': main()
