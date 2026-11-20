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
root=Path(sys.argv[1]);paths=sorted(p.parent for p in root.rglob('manifest.json'));assert len(paths)==int(sys.argv[2])
n=collections.Counter();diff=[]
for p in paths:
    m=json.loads((p/'manifest.json').read_text());seed=m['seed'];xs={x['id']:x for x in json.loads((p/'public.json').read_text())}
    for truth in json.loads((p/'oracle.json').read_text()):
        x=xs[truth['id']]
        for lab in truth['opponents']:
            n['opponent_states']+=1
            co,ms=parse(lab['privateHand']);cv=counts(co)
            sh=shanten(cv,len(ms));ident={'seed':seed,'id':truth['id'],'seat':lab['seat'],'hand':lab['privateHand']}
            if sh!=lab['shanten']:diff.append({**ident,'kind':'shanten','embedded':lab['shanten'],'independent':sh})
            waits=[]
            if sh==0:
                for i,t in enumerate(ALL):
                    if cv[i]>=4:continue
                    a=cv.copy();a[i]+=1
                    if shanten(a,len(ms))==-1:waits.append(t)
            if set(waits)!=set(lab['structuralWaits']):diff.append({**ident,'kind':'waits','embedded':lab['structuralWaits'],'independent':waits})
            river={d['tile'][:2].replace('0','5') for d in x['scene']['rivers'][lab['seat']]['discards']}
            furiten=bool(river.intersection(waits))
            if furiten!=lab['riverFuriten']:diff.append({**ident,'kind':'river_furiten','embedded':lab['riverFuriten'],'independent':furiten})
            for t,legal in lab['legalRon'].items():
                n['candidate_ron_labels']+=1
                can=sh==0 and t[:2].replace('0','5') in waits and not furiten and lab['canRon']
                res=score(co,ms,t,lab,truth) if can else None
                got=bool(res is not None and res.error is None and res.cost is not None)
                if got!=legal:diff.append({**ident,'kind':'ron','tile':t,'embedded':legal,'independent':got,'result_error':res.error if res else None})
                if got and legal:
                    n['score_labels']+=1
                    base=res.cost['main'];honba=base+300*truth['honba']
                    if base!=lab['baseLoss'][t] or honba!=lab['firstLoss'][t]:
                        diff.append({**ident,'kind':'score','tile':t,'embedded':[lab['baseLoss'][t],lab['firstLoss'][t]],'independent':[base,honba],'han':res.han,'fu':res.fu,'pao_note':'independent main payment does not represent third-party responsibility; inspect discrepancy, never suppress'})
    print('INDEPENDENT_AUDIT_MATCH',seed,flush=True)
out={'status':'independent_snapshot_audit_pass' if not diff else 'independent_snapshot_audit_mismatch','counts':dict(n),'differences':diff,'scope':'Independent shanten/waits/river furiten/yaku/no-ura score using recorded snapshot. Temporal furiten and full replay, responsibility payment and new kan indicators need separate coverage. No actual Ron choice or full payout claim.'}
Path('/tmp/independent-p1-label-audit.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
print(json.dumps({k:v for k,v in out.items() if k!='differences'},ensure_ascii=False,indent=2));print('FIRST_DIFFERENCES',json.dumps(diff[:10],ensure_ascii=False))
assert not diff
