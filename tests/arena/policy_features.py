"""Frozen public-input feature contract for the 200-game LightGBM policy.
No access to Q, opponent hands, wall, model output or unplayed events in inference.
"""
import numpy as np
import re
from collections import Counter
def norm(t):return t[:2].replace('0','5')
def tiles(s):return [m[0]+c for m in re.findall(r'[mpsz][0-9+\-=]+',s) for c in m[1:] if c.isdigit()]
def category(x):return 'reaction' if x['phase']=='reaction' else 'special' if any(a['action']>=37 for a in x['actions']) else 'pure'
def pure(x):
 a=x['actions'];s=x['scene'];f=x['facts'];o=s['ownSeat'];h=Counter(map(norm,s['hand']));vis=f['見え枚数'];dora=Counter(f['実ドラ']);pts=[z['points'] for z in s['scores']];rs=s['rivers'];ops=[(o+j)%4 for j in (1,2,3)];cs={c['打牌']:c for c in f['候補別牌姿']};cs=[cs[z['details'][0]] for z in a];mi=min(c['向聴'] for c in cs);mx=max(c['受け入れ'] for c in cs if c['向聴']==mi);safe=[];B=[];E=[]
 for j in ops:
  rr=rs[j];st={norm(d['tile']) for d in rr['discards']};ev=s['publicEvents'];pos=[k for k,e in enumerate(ev) if e.get('種類')=='打牌' and e.get('席')==j and e.get('立直宣言')]
  if rr['riichi'] and len(pos)==1:st.update(norm(e['牌']) for e in ev[pos[0]+1:] if e.get('種類')=='打牌')
  safe.append(st)
 for z,c in zip(a,cs):
  t=norm(z['details'][0]);su=t[0];n=int(t[1]);hon=su=='z';sh=c['形と和了条件']['向聴内訳'];w=c['形と和了条件'].get('形式待ち',[]);near=lambda k:h[su+str(n+k)] if not hon and 1<=n+k<=9 else 0
  B.append([n,hon,not hon and n in (1,9),int(hon and (n>=5 or n==o+1 or n==(1 if s['round'].startswith('東') else 2))),int('0' in z['details'][0][:2]),dora[t],vis[t],h[t],near(-2),near(-1),near(1),near(2),c['向聴'],c['向聴']-mi,c['受け入れ'],c['受け入れ']-mx,c['保持ドラ翻'],len(c['有効牌']),*(sh[k] if sh[k] is not None else 15 for k in ['一般形','七対子','国士無双']),len(w),sum(y['残上限'] for y in w if y.get('通常ロン役')),sum(y['残上限'] for y in w if y.get('通常ツモ役')),int(c['形と和了条件'].get('自己河フリテン',False)),len(s['selfMelds']),o,s['remaining'],s['ownDiscards'],int(s['round'].startswith('南')),int(s['round'][1]),s['honba'],s['kyotaku'],pts[o]/1000,*[(pts[o]-pts[j])/1000 for j in ops],sum(p>pts[o] for p in pts),len(a)])
  e=[]
  for j,st in zip(ops,safe):
   rr=rs[j];ds=rr['discards'];ff=f['各家公開事実'][j];hh=[norm(d['tile']) for d in ds if not d['tsumogiri']];adj=[su+str(n+k) for k in (-3,3) if not hon and 1<=n+k<=9]
   e += [int(rr['riichi']),len(rr['melds']),ff['公開ドラ翻'],ff['公開役牌翻'],len(ds),len(hh),sum(d['tsumogiri'] for d in ds[-4:]),int(t in st),len(st),sum(u in st for u in adj),len(adj),sum(u[0]==su for u in hh),sum(u[0]=='z' for u in hh),sum(u[0]==su for u in hh[-4:]),sum(h[u] for u in st),int(j==0)]
  E.append(e)
 e=np.array(E,np.float32).reshape(-1,3,16);r=e[:,:,0];m=e[:,:,1];safe=e[:,:,7];th=r>0;mf=m>0;count=lambda a:np.sum(a,axis=1);mx=lambda a:np.max(a,axis=1);mn=lambda a:np.min(a,axis=1)
 ag=np.column_stack([count(th),count(th*(1-safe)),count(th*safe),count(mf),count(mf*(1-safe)),count(safe),count(safe*e[:,:,15]),count(th*e[:,:,15]),count(th*(1-safe)*e[:,:,15]),mx((1-safe)*(r*3+m/2+e[:,:,2]/2+e[:,:,3]/2)),mx(th*(1-safe)*e[:,:,9]),mx(th*(1-safe)*e[:,:,8]),mx(mf*(1-safe)*e[:,:,2]),mx(th*safe*e[:,:,14]),mx(th*e[:,:,14]),mn(np.where(th,e[:,:,14],99)),count(th*(1-safe)*(e[:,:,9]>0)),count(mf*(1-safe)*(e[:,:,9]>0))])
 return np.column_stack([np.asarray(B,np.float32),e.reshape(-1,48),ag])
def special(x):
 s=x['scene'];f=x['facts'];a=x['actions'];o=s['ownSeat'];ops=[(o+j)%4 for j in (1,2,3)];h=Counter(map(norm,s['hand']));d=Counter(f['実ドラ']);rs=s['rivers'];pts=[z['points'] for z in s['scores']];ev=s['publicEvents'];sets=[];rf=[]
 def dc(ts):return sum(d[norm(t)]+('0' in t) for t in ts)
 for j in ops:
  rr=rs[j];ds=rr['discards'];st={norm(v['tile']) for v in ds};p=[k for k,e in enumerate(ev) if e.get('種類')=='打牌' and e.get('席')==j and e.get('立直宣言')]
  if rr['riichi'] and len(p)==1:st.update(norm(e['牌']) for e in ev[p[0]+1:] if e.get('種類')=='打牌' and not (x['phase']=='reaction' and e is ev[-1]))
  sets.append(st);ff=f['各家公開事実'][j];rf.extend([int(rr['riichi']),len(rr['melds']),ff['公開ドラ翻'],ff['公開役牌翻'],len(ds),sum(not v['tsumogiri'] for v in ds[-4:]),len(st),sum(h[t] for t in st),int(j==0),(pts[o]-pts[j])/1000])
 rr=[rs[j]['riichi'] for j in ops];mf=[len(rs[j]['melds']) for j in ops];own=f['各家公開事実'][o];alltiles=s['hand']+sum([tiles(t) for t in s['selfMelds']],[])
 common=[s['remaining'],s['ownDiscards'],o,s['round'][0]=='南',int(s['round'][1]),s['honba'],s['kyotaku'],pts[o]/1000,sum(p>pts[o] for p in pts),len(s['selfMelds']),dc(alltiles),own['公開役牌翻'],sum(rr),sum(mf),max(mf),len(a),sum(v==2 for v in h.values()),sum(v>=3 for v in h.values()),sum(h[t] for t in h if t[0]=='z' or t[1] in '19'),*rf]
 cs={c['打牌']:c for c in f['候補別牌姿']};calls={v['副露']:v.get('合法打牌',[]) for v in f.get('鳴き候補',[]) or []};p=f.get('スルー後');reaction=x['phase']=='reaction'
 def summary(c):
  z=c['形と和了条件'];w=z.get('形式待ち',[]);t=norm(c.get('打牌','z0'));ts=tiles(c['打牌後']) if '打牌後' in c else alltiles;safe=[t in st for st in sets]
  return [c['向聴'],c['受け入れ'],len(c['有効牌']),c.get('保持ドラ翻',dc(ts)),*[z['向聴内訳'][k] if z['向聴内訳'][k] is not None else 15 for k in ['一般形','七対子','国士無双']],int(z['門前']),sum(v['残上限'] for v in w if v.get('通常ロン役')),sum(v['残上限'] for v in w if v.get('通常ツモ役')),int(z.get('自己河フリテン',False)),sum(safe),sum(ri and sf for ri,sf in zip(rr,safe)),sum(ri and not sf for ri,sf in zip(rr,safe)),len(w),sum(v['残上限'] for v in w)]
 def pool(cands):
  if not cands:return [-1]*51
  u=np.array([summary(c) for c in cands]);u=u[u[:,0]==u[:,0].min()];best=u[np.argmax(u[:,1])];return [*best,*u.min(axis=0),*u.max(axis=0),len(cands),len(u),sum(u[:,8]>0)]
 base=pool([p] if reaction and p else list(cs.values()));result=[]
 for z in a:
  k=z['action'];detail=z['details'][0];t=norm(detail) if k<37 else norm(x.get('reaction',{}).get('tile','z0'));n=int(t[1]);hon=t[0]=='z';yak=hon and (n>=5 or n==o+1 or n==(1 if s['round'][0]=='東' else 2))
  cands=[cs[det] for det in z['details'] if det in cs] if k<37 else [c for c in cs.values() if c['向聴']==0] if k==37 else [c for det in z['details'] for c in calls.get(det,[])] if 38<=k<=41 else [p] if k==45 and p else []
  v=pool(cands);near=lambda off:h[t[0]+str(n+off)] if not hon and 1<=n+off<=9 else 0
  result.append([*common,*base,*v,v[0]-base[0],v[1]-base[1],v[3]-base[3],k<37,*[k==i for i in range(37,46)],n,hon,yak,n in (1,9) and not hon,d[t],f['見え枚数'].get(t,0),h[t],near(-2),near(-1),near(1),near(2),int('0' in detail[:2]),x.get('reaction',{}).get('from',-1)])
 return np.array(result,np.float32)
def public_features(x):
 if set(x)-{'id','phase','scene','actions','facts','reaction'}:raise ValueError('unknown public input keys')
 if x['phase'] not in ('turn','reaction'):raise ValueError('phase')
 if not isinstance(x['scene']['publicEvents'],list):raise ValueError('missing public history')
 if len(x['scene']['rivers'])!=4 or len(x['scene']['scores'])!=4:raise ValueError('bad public seat count')
 cat=category(x);a=[v['action'] for v in x['actions']]
 if a!=sorted(set(a)) or any(i<0 or i>=46 for i in a):raise ValueError('bad legal mask')
 X=pure(x) if cat=='pure' else special(x)
 if X.shape!=(len(a),105 if cat=='pure' else 177) or not np.isfinite(X).all():raise ValueError('bad public feature shape')
 return cat,X,np.array(a,dtype=np.int32)
