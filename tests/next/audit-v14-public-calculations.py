"""Independent candidate shape and visible-material audit, dev packets only.
Read no archived key, private hand or oracle. Not all score/yaku or legal action audit.
"""
import collections,json,sys
from pathlib import Path
from mahjong.shanten import Shanten
from mahjong.meld import Meld
from mahjong.hand_calculating.hand import HandCalculator
from mahjong.hand_calculating.hand_config import HandConfig,OptionalRules
SH=Shanten();HC=HandCalculator()
T=[s+str(n) for s in 'mpsz' for n in range(1,8 if s=='z' else 10)]
I={t:i for i,t in enumerate(T)}
def norm(t):return t[:2].replace('0','5')
def meld(m):return [m[0]+n for n in m[1:] if n.isdigit()]
def counts(tiles):
 c=[0]*34
 for t in tiles:c[I[norm(t)]]+=1
 return c
def sh(c,n):return SH.calculate_shanten(c,use_chiitoitsu=not n,use_kokushi=not n)
def dora(t):
 s=t[0];n=int(t[1]) or 5
 return s+str((n%4+1 if n<5 else (n-4)%3+5) if s=='z' else n%9+1)
def han(ts,ds):return sum((t[1]=='0')+ds.count(norm(t)) for t in ts)
def win_score(hand,ms,tile,indicators,own,wind,tsumo=False,riichi=False,include_yaku=False):
 used=set()
 def allocate(t):
  base=I[norm(t)]*4
  ids=[base] if t[1]=='0' else list(range(base+1,base+4)) if norm(t) in ('m5','p5','s5') else list(range(base,base+4))
  a=next(i for i in ids if i not in used);used.add(a);return a
 ts=[allocate(t) for t in hand];mm=[]
 for m in ms:
  raw=meld(m);ids=[allocate(t) for t in raw];ts+=ids
  kind=Meld.KAN if len(raw)==4 else Meld.PON if len(set(map(norm,raw)))==1 else Meld.CHI
  mm.append(Meld(meld_type=kind,tiles=ids,opened=bool(set(m)&set('+-='))))
 w=allocate(tile);ts.append(w)
 ds=[allocate(t) for t in indicators]
 cfg=HandConfig(is_tsumo=tsumo,is_riichi=riichi,player_wind=27+own,round_wind=27+wind,options=OptionalRules(has_open_tanyao=True,has_aka_dora=True,has_double_yakuman=True,kiriage=False,limit_to_sextuple_yakuman=False))
 res=HC.estimate_hand_value(ts,w,melds=mm,dora_indicators=ds,config=cfg)
 if res.error or not res.cost:return None
 points=(res.cost['main']*3 if own==0 else res.cost['main']+2*res.cost['additional']) if tsumo else res.cost['main']
 if include_yaku:return {'points':points,'yaku':sorted(y.name for y in res.yaku or [])}
 return points
def audit(e,stats,errors):
 inp=e['request']['input'];eid=inp['id'];ev={x['id']:x['value'] for x in inp['evidence']}
 def check(name,a,b):
  stats[name]+=1
  if a!=b:errors.append({'id':eid,'check':name,'got':a,'expected':b})
 def metric(name,v,expect_hand,expect_meld,discard=None):
  stats['shape_rows']+=1
  check(name+'/hand',sorted(v['hand']),sorted(expect_hand));check(name+'/meld',v['melds'],expect_meld)
  c=counts(expect_hand);n=len(expect_meld);alltiles=expect_hand+sum(map(meld,expect_meld),[]);total=counts(alltiles)
  check(name+'/closed',v['closed'],not any(set(m)&set('+-=') for m in expect_meld))
  check(name+'/physical_size',len(expect_hand)+3*n,13)
  s=sh(c,n);improve=[]
  for i,t in enumerate(T):
   if total[i]>=4:continue
   cc=c.copy();cc[i]+=1
   if sh(cc,n)<s:improve.append({'tile':t,'remainingUpperBound':4-visible[t]})
  if v['shanten'] is None:
   stats['withheld_shape']+=1
   # A withheld ambiguity is not a value match, retain and inspect.
   errors.append({'id':eid,'check':name+'/withheld_shape','got':None,'expected':s})
  else:
   check(name+'/shanten',v['shanten'],s)
   check(name+'/improving',v['improving'],improve)
   check(name+'/ukeire',v['ukeireUpperBound'],sum(r['remainingUpperBound'] for r in improve))
   ownriver={norm(d['tile']) for d in ev['seat-'+str(own)]['discards']}
   if discard:ownriver.add(norm(discard))
   check(name+'/riverFuriten',v['ownRiverFuriten'],bool(ownriver&{t['tile'] for t in improve}) if s==0 else None)
  check(name+'/dora',v['retainedDoraHan'],han(alltiles,ds))
  if discard:
   check(name+'/genbutsu',v['safety'],[{'seat':i,'ownRiverGenbutsu':any(norm(d['tile'])==norm(discard) for d in ev['seat-'+str(i)]['discards'])} for i in range(4) if i!=own])
  wins=v.get('conditionalNormalWins',[])
  variants=[]
  if s==0 and v['shanten'] is not None:
   for z in improve:
    t=z['tile']
    if visible[t]>=4:continue
    if t[0]!='z' and t[1]=='5':
     r=ev['visible']['redVisible'][t[0]]
     if visible[t]-r<3:variants.append(t)
     if r<1:variants.append(t[0]+'0')
    else:variants.append(t)
  check(name+'/score_variants',[z['tile'] for z in wins],variants)
  for z in wins:
   for k,tsumo,riichi in [('ron',False,False),('tsumo',True,False),('hypotheticalRiichiRon',False,True)]:
    expected=win_score(expect_hand,expect_meld,z['tile'],ev['own']['doraIndicators'],own,'東南西北'.index(board['round'][0]),tsumo,riichi) if not riichi or v['closed'] else None
    got=z[k]['basePoints'] if z[k] else None
    check(name+'/score_'+k,got,expected);stats['score_values_checked']+=1
 board=ev['board'];own=board['ownSeat'];h=ev['own']['hand'];ms=ev['own']['melds'];ds=list(map(dora,ev['own']['doraIndicators']))
 visible=dict(zip(T,counts(h+ev['own']['doraIndicators']+sum(([d['tile'] for d in ev['seat-'+str(i)]['discards'] if not d['called']]+sum(map(meld,ev['seat-'+str(i)]['melds']),[]) for i in range(4)),[]))))
 check('visible',ev['visible']['counts'],visible);check('dora',ev['dora']['actualDora'],ds)
 ranks=ev['rank-scenarios'];base=[z['points'] for z in board['scores']]
 def rank(p):
  order=sorted(range(4),key=lambda i:(-p[i],board['initialOrder'].index(i)))
  return [order.index(i)+1 for i in range(4)]
 if board['pendingReach']:check('rank_withheld',ranks,{'status':'withheld_pending_riichi'})
 else:
  check('current_ranks',ranks['currentRanks'],rank(base))
  check('rank_ron_count',len(ranks['ron']),15);check('rank_tsumo_count',len(ranks['tsumo']),12)
  for z in ranks['ron']:
   for iswin,k in [(True,'win'),(False,'loss')]:
    p=base.copy();winner,loser=(own,z['other']) if iswin else (z['other'],own)
    pay=z[k+'Base']+300*board['honba'];p[loser]-=pay;p[winner]+=pay+1000*board['kyotaku']
    check('rank_transfer',z[k+'Points'],p);check('rank_order',z[k+'Ranks'],rank(p))
  for z in ranks['tsumo']:
   p=base.copy();winner=z['winner']
   for i in range(4):
    if i==winner:continue
    pay=(z['parentPay'] if i==0 else z['childPay'])+100*board['honba']
    p[i]-=pay;p[winner]+=pay
   p[winner]+=1000*board['kyotaku'];check('rank_transfer',z['points'],p);check('rank_order',z['ranks'],rank(p))
 for i in range(4):
  if i==own:continue
  r=ev['seat-'+str(i)];v=ev['public-value-'+str(i)]
  check('exposedDora',v['exposedDoraHan'],han(sum(map(meld,r['melds']),[]),ds))
 for a in inp['actions']:
  stats['action_rows']+=1
  k=a['key'];g=a['group'];p=a['detail'];v=ev['calc-'+k]
  if g<37 or g==37:
   discard=(p.split(' ')[-1] if g==37 else p);hh=h.copy();hh.remove(discard[:2])
   metric(k,v,hh,ms,discard)
  elif g==45:metric(k,v,h,ms)
  elif 38<=g<=41 or g==42 and inp['phase']=='reaction':
   hh=h.copy();called=next(n for n,c in zip(p,p[1:]) if c in '+-=')
   ts=meld(p);ts.remove(p[0]+called)
   for t in ts:hh.remove(t)
   mm=ms+[p]
   if g==42:metric(k,v,hh,mm)
   else:
    for x in v['afterCallDiscards']:
     discard=x['discard'];hhh=hh.copy();hhh.remove(discard[:2]);metric(k+'/'+discard,x,hhh,mm,discard)
  elif g==42:
   hh=h.copy();mm=ms.copy()
   if p[-1] in '1234567890' and p[:-1] in mm:
    hh.remove(p[0]+p[-1]);mm[mm.index(p[:-1])]=p
   else:
    for t in meld(p):hh.remove(t)
    mm.append(p)
   metric(k,v,hh,mm)
  else:check(k+'/terminal',v,{'status':'terminal_action_no_future_shape'})
 stats['cases']+=1
def main(src,out,cases_expected=30):
 es=json.loads(src.read_text());stats=collections.Counter();errors=[]
 for e in es:
  try:audit(e,stats,errors)
  except Exception as err:errors.append({'id':e['request']['input']['id'],'exception':repr(err)})
 result={'status':'dev_candidate_shape_audit_only','cases_expected':cases_expected,'counts':dict(stats),'failures':errors,'limitations':['candidate score amounts independently checked; yaku names not individually aligned yet','legal availability checked by source engine, not fully independent','no tactical validation']}
 out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({**result,'counts':{k:v for k,v in stats.items() if '/' not in k},'failures':errors[:15]},ensure_ascii=False))
 assert stats['cases']==cases_expected and not errors
if __name__=='__main__':main(Path(sys.argv[1]),Path(sys.argv[2]),int(sys.argv[3]) if len(sys.argv)>3 else 30)
