"""Independent shape, wait, yaku and visible-only Ron score audit.
MahjongRepository/mahjong v1.4.0, not the embedded Majiang engine.
Temporal furiten is supplied by existing snapshot, NOT independently replayed here."""
import re,json,sys,collections
from pathlib import Path
from mahjong.shanten import Shanten
from mahjong.meld import Meld
from mahjong.hand_calculating.hand import HandCalculator
from mahjong.hand_calculating.hand_config import HandConfig,OptionalRules
SH=Shanten();HC=HandCalculator()
ALL=[s+str(n) for s in 'mpsz' for n in range(1,8 if s=='z' else 10)]
def idx(t):return ALL.index(t[:2].replace('0','5'))
def parse(hand):
    parts=hand.split(',');head=parts[0].rstrip('*')
    assert re.fullmatch(r'(?:[mpsz][0-9]+)+',head),hand
    concealed=[g[0]+n for g in re.findall(r'[mpsz][0-9]+',head) for n in g[1:]]
    ms=[]
    for m in parts[1:]:
        assert re.fullmatch(r'[mpsz][0-9+=-]+',m),m
        tiles=[m[0]+n for n in m[1:] if n.isdigit()]
        assert len(tiles) in (3,4)
        group=Meld.KAN if len(tiles)==4 else Meld.PON if len(set(map(idx,tiles)))==1 else Meld.CHI
        opened=any(x in m for x in '+-=')
        ms.append((tiles,group,opened))
    assert len(concealed)+3*len(ms)==13
    return concealed,ms
def counts(ts):
    out=[0]*34
    for t in ts:out[idx(t)]+=1
    return out
def shanten(c,open_n):
    return SH.calculate_shanten(c,use_chiitoitsu=not open_n,use_kokushi=not open_n)
def score(concealed,ms,tile,lab,truth):
    used=set()
    def alloc(t):
        n=idx(t)*4; choices=[n] if t[1]=='0' else list(range(n+1,n+4)) if n in (16,52,88) else list(range(n,n+4))
        v=next((x for x in choices if x not in used),None);assert v is not None,('physical tile collision',t,concealed,ms,tile)
        used.add(v);return v
    tiles=[alloc(t) for t in concealed];melds=[]
    for ts,k,opened in ms:
        ids=[alloc(t) for t in ts];tiles.extend(ids);melds.append(Meld(meld_type=k,tiles=ids,opened=opened))
    win=alloc(tile);tiles.append(win)
    dora=[alloc(t) for t in truth['visibleIndicators']]
    cfg=HandConfig(is_riichi=lab['lizhi']==1,is_daburu_riichi=lab['lizhi']==2,is_ippatsu=lab['ippatsu'],is_houtei=truth['remaining']==0,player_wind=27+lab['seat'],round_wind=27+truth['roundWind'],options=OptionalRules(has_open_tanyao=True,has_aka_dora=True,has_double_yakuman=True,kiriage=False,limit_to_sextuple_yakuman=False))
    return HC.estimate_hand_value(tiles,win,melds=melds,dora_indicators=dora,config=cfg)

# Independent event replay from completed synthetic paipu, using concealed tile
# multisets rather than the original game state machine or its furiten flag.
def meld_tiles(m):return [m[0]+v for v in m[1:] if v.isdigit()]
def public(k,e):
 if k=='kaigang':return {'種類':'ドラ表示追加','牌':e['baopai']}
 if k in ('zimo','gangzimo'):return {'種類':'自摸' if k=='zimo' else '嶺上自摸','席':e['l']}
 if k=='dapai':return {'種類':'打牌','席':e['l'],'牌':e['p'][:2],'ツモ切り':'_' in e['p'],'立直宣言':'*' in e['p']}
 if k in ('fulou','gang'):return {'種類':'副露' if k=='fulou' else '槓','席':e['l'],'面子':e['m']}
 raise ValueError(k)
def canon(v):return json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False)
def waitset(hand,meld):
 c=counts(hand)
 if shanten(c,len(meld))!=0:return set()
 out=set()
 for i,t in enumerate(ALL):
  if c[i]>=4:continue
  a=c.copy();a[i]+=1
  if shanten(a,len(meld))==-1:out.add(t)
 return out
def norm(t):return t[:2].replace('0','5')
def remove(hand,t):
 assert t in hand,('missing exact tile',t,hand)
 hand.remove(t)
def replay(paipu):
 states={};coverage=collections.Counter()
 for hand_no,events in enumerate(paipu['log']):
  p=events[0]['qipai'];assert len(p['shoupai'])==4
  hs=[];ms=[]
  for raw in p['shoupai']:
   co,m=parse(raw);assert not m;hs.append(co);ms.append([])
  river=[set() for _ in range(4)];reach=[False]*4;can=[True]*4;hist=[]
  def settle_misses(actor,tile):
   for j in range(4):
    if j==actor:continue
    # Only continued hands are sampled later; all completed-shape passes,
    # including no-yaku passes, make temporary/permanent furiten per Lab rules.
    if norm(tile) in waitset(hs[j],ms[j]):
     can[j]=False;coverage['passed_complete_shape']+=1
     if reach[j]:coverage['passed_after_riichi']+=1
  for row in events[1:]:
   assert len(row)==1
   k,e=next(iter(row.items()))
   if k not in ('zimo','gangzimo','dapai','fulou','gang','kaigang'):continue
   l=e.get('l')
   if k in ('zimo','gangzimo'):
    hs[l].append(e['p'][:2])
   elif k=='dapai':
    t=e['p'][:2]
    if not reach[l]:
     if not can[l]:coverage['reset_on_nonriichi_discard']+=1
     can[l]=True
    remove(hs[l],t);river[l].add(norm(t))
    if waitset(hs[l],ms[l])&river[l]:can[l]=False;coverage['own_river_furiten']+=1
    if '*' in e['p']:reach[l]=True
    settle_misses(l,t)
   elif k=='fulou':
    m=e['m'];raw=meld_tiles(m);called=re.search(r'([0-9])[+=-]',m)
    assert called and len(raw) in (3,4),m
    raw.remove(m[0]+called.group(1))
    for t in raw:remove(hs[l],t)
    ms[l].append(m)
   elif k=='gang':
    m=e['m'];raw=meld_tiles(m)
    if re.fullmatch(r'[mpsz][0-9]{4}',m):
     for t in raw:remove(hs[l],t)
     ms[l].append(m)
    else:
     assert len(raw)==4 and m[-1].isdigit()
     old=m[:-1];assert old in ms[l],(m,ms[l])
     remove(hs[l],m[0]+m[-1]);ms[l][ms[l].index(old)]=m
     settle_misses(l,m[0]+m[-1]);coverage['added_kan']+=1
   hist.append(public(k,e))
   # Use exact ordered public event prefix + round and honba for alignment.
   # Duplicated keys are retained, not arbitrarily selected.
   key=(p['zhuangfeng'],p['jushu'],p['changbang'],canon(hist))
   states.setdefault(key,[]).append({'hand_no':hand_no,'hands':[list(x) for x in hs],'melds':[list(x) for x in ms],'can':can.copy(),'reach':reach.copy()})
 return states,coverage
root=Path(sys.argv[1]);paths=sorted(p.parent for p in root.rglob('manifest.json'));expected=int(sys.argv[2]);assert len(paths)==expected
counts_checked=collections.Counter();diff=[]
for p in paths:
 m=json.loads((p/'manifest.json').read_text());seed=m['seed']
 paipu=json.loads((p/'paipu.json').read_text())
 states,cover=replay(paipu);counts_checked.update(cover)
 xs={x['id']:x for x in json.loads((p/'public.json').read_text())}
 for truth in json.loads((p/'oracle.json').read_text()):
  x=xs[truth['id']];s=x['scene'];o=s['ownSeat']
  key=(truth['roundWind'],int(s['round'][1])-1,s['honba'],canon(s['publicEvents']))
  candidates=states.get(key,[])
  matches=[v for v in candidates if sorted(v['hands'][o])==sorted(s['hand']) and v['melds'][o]==s['selfMelds']]
  ident={'seed':seed,'id':truth['id']}
  if len(matches)!=1:
   diff.append({**ident,'kind':'alignment','prefix_matches':len(candidates),'own_matches':len(matches)});continue
  st=matches[0];counts_checked['turns_aligned']+=1
  for lab in truth['opponents']:
   j=lab['seat'];co,parsed=parse(lab['privateHand'])
   raw_ms=lab['privateHand'].split(',')[1:]
   counts_checked['opponent_states']+=1
   if sorted(st['hands'][j])!=sorted(co) or st['melds'][j]!=raw_ms:
    diff.append({**ident,'seat':j,'kind':'private_hand_replay','replayed':st['hands'][j],'recorded':co,'melds':[st['melds'][j],raw_ms]})
   if st['can'][j]!=lab['canRon']:
    diff.append({**ident,'seat':j,'kind':'temporal_furiten','replayed':st['can'][j],'recorded':lab['canRon'],'riichi':st['reach'][j]})
   if not lab['canRon']:counts_checked['ron_ineligible']+=1
 print('TEMPORAL_REPLAY_MATCH',seed,flush=True)
out={'status':'temporal_replay_pass' if not diff else 'temporal_replay_mismatch','matches':expected,'counts':dict(counts_checked),'differences':diff,'scope':'Independent concealed-multiset/public-prefix reconstruction and shape-pass temporal eligibility, in actual completed synthetic games. Not full engine identity or true human Ron choice.'}
Path('/tmp/p1-temporal-furiten.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
print(json.dumps({k:v for k,v in out.items() if k!='differences'},ensure_ascii=False,indent=2));print('FIRST_DIFFERENCES',json.dumps(diff[:10],ensure_ascii=False))
assert not diff
