"""Exact public-only belief feature contract, from frozen 120-game experiment."""
import collections
import numpy as np
from policy_features import norm

def features(x,seat,tiles):
 s=x['scene']; rr=s['rivers'][seat]; ds=rr['discards']; o=s['ownSeat']; vis=x['facts']['見え枚数']; own=collections.Counter(map(norm,s['hand'])); dora=collections.Counter(x['facts']['実ドラ']); mine={norm(d['tile']) for d in ds};safe=set(mine);ev=s['publicEvents']; reach=[i for i,e in enumerate(ev) if e.get('種類')=='打牌' and e.get('席')==seat and e.get('立直宣言')]
 if rr['riichi'] and len(reach)==1:safe.update(norm(e['牌']) for e in ev[reach[0]+1:] if e.get('種類')=='打牌')
 dis=[norm(d['tile']) for d in ds];hands=[norm(d['tile']) for d in ds if not d['tsumogiri']];ff=x['facts']['各家公開事実'][seat];md=rr['melds'];pts=[v['points'] for v in s['scores']];r=int(rr['riichi']);m=len(md)
 g=[r,m,len(ds),s['remaining'],s['ownDiscards'],int(seat==0),(seat-o)%4,(pts[seat]-pts[o])/1000,sum(p>pts[seat] for p in pts),ff['公開ドラ翻'],ff['公開役牌翻'],len(hands),sum(d['tsumogiri'] for d in ds[-3:]),sum(d['tsumogiri'] for d in ds[-6:]),sum(t[0]=='z' for t in dis),sum(t[0]!='z' and t[1] in '19' for t in dis),sum(t[0]!='z' and t[1] in '456' for t in hands[-4:]),len(set(dis)),*[sum(t[0]==u for t in hands) for u in 'mpsz'],*[sum(t[0]==u for t in hands[-4:]) for u in 'mpsz']]
 cand=[];guards=[]
 for t in tiles:
  z=norm(t);u=z[0];n=int(z[1]);hon=u=='z'; adj=lambda k:u+str(n+k) if not hon and 1<=n+k<=9 else None
  suji=[adj(k) for k in [-3,3] if adj(k)];last=hands[-1] if hands else '';isSafe=z in safe
  a=[n,hon,int(n in [1,9] and not hon),int('0' in t),int(hon and (n>=5 or n==seat+1 or n==(1 if s['round'][0]=='東' else 2))),vis.get(z,0),own[z],dora[z],int(isSafe),int(z in mine),sum(a in safe for a in suji),len(suji),sum(t[0]==u for t in hands),sum(t[0]==u for t in hands[-4:]),sum(t[0]==u for t in md),int(last[:1]==u),len(ds)-max([i for i,v in enumerate(dis) if v==z],default=-1),*[vis.get(adj(k),-1) for k in [-2,-1,1,2,3,-3]],*[int(adj(k) in safe) for k in [-2,-1,1,2]],*[int(adj(k) in hands[-4:]) for k in [-2,-1,1,2]]]
  cand.append(g+a);guards.append(isSafe)
 return g,cand,guards

def tile(a):
 if a<27:return 'mps'[a//9]+str(a%9+1)
 if a<34:return 'z'+str(a-26)
 if a<37:return 'mps'[a-34]+'0'
 raise ValueError(a)

def inputs(x,acts):
 ts=[tile(int(a)) for a in acts]
 g=[];c=[];safe=[]
 for j in (1,2,3):
  a,b,d=features(x,(x['scene']['ownSeat']+j)%4,ts)
  g.append(a);c.extend(b);safe.extend(d)
 g=np.array(g,np.float32);c=np.array(c,np.float32);safe=np.asarray(safe,bool)
 assert g.shape==(3,26) and c.shape==(3*len(ts),57) and np.isfinite(g).all() and np.isfinite(c).all()
 return g,c,safe

def aggregate(p,q):
 p=np.asarray(p);q=np.asarray(q).reshape(3,-1).T
 assert p.shape==(3,) and np.isfinite(p).all() and np.isfinite(q).all() and ((p>=0)&(p<=1)).all() and ((q>=0)&(q<=1)).all()
 return np.asarray([[*p,*v,p.max(),p.sum(),v.max(),v.sum()] for v in q],np.float32)

def predict(m,x,acts):
 g,c,safe=inputs(x,acts)
 p=m['t'].predict(g,num_threads=1);p[g[:,0]>0]=1
 q=m['r'].predict(c,num_threads=1);q[safe]=0
 return aggregate(p,q)
