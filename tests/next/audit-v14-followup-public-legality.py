"""Independent PYTHON subset-audit of new 36 public mahjong legal actions.

This deliberately does NOT import the JavaScript engine or any raw/private case.
It checks public physical feasibility of discard/riichi and basic call options,
but DOES NOT assert completeness of the legal action mask or certify ron/kan
timing, yaku validity or all Mahjong rule subtleties.
"""
import collections,json,re,sys
from pathlib import Path
from mahjong.shanten import Shanten
from mahjong.hand_calculating.hand import HandCalculator
from mahjong.hand_calculating.hand_config import HandConfig, OptionalRules
from mahjong.meld import Meld
SH=Shanten(); HC=HandCalculator()
TYPES=[s+str(n) for s in "mps" for n in range(1,10)]+["z"+str(n) for n in range(1,8)]
TI={s:i for i,s in enumerate(TYPES)}
def norm(t):
    return t[:1]+("5" if t[1:2]=="0" else t[1:2])
def add(c,t):
    t=norm(t)
    if t not in TI:raise ValueError("invalid public tile "+str(t))
    c[t]+=1
def counts(ts):
    c=collections.Counter()
    for t in ts:add(c,t)
    return c
def tiles(m):
    if not isinstance(m,str) or m[0] not in "mpsz":raise ValueError("invalid public meld")
    return [m[0]+n for n in re.findall(r"\d",m[1:])]
def one(ev):
    inp=ev["request"]["input"]; x={z["id"]:z["value"] for z in inp["evidence"]}; own=x["own"];board=x["board"]
    seat=board["ownSeat"]; ownriver=x["seat-"+str(seat)]
    hand=counts(own["hand"]); melds=own["melds"]
    phase=inp["phase"]
    if len(own["hand"])+3*len(melds)!=(14 if phase=="turn" else 13):raise ValueError("wrong physical own hand size")
    if any(v>4 for v in hand.values()):raise ValueError("more than four same-type own tiles")
    for m in melds:
        if len(tiles(m)) not in (3,4):raise ValueError("malformed own public meld")
    if phase=="reaction":
        reaction=own["reaction"]
        if reaction is None or reaction["from"]==seat:raise ValueError("no opponent reaction source")
        reaction_tile=norm(reaction["tile"])
    else:reaction=None;reaction_tile=None
    stats=collections.Counter()
    unverified=[]
    groups={a["group"] for a in inp["actions"]}
    for a in inp["actions"]:
        g=a["group"];detail=a["detail"];stats["legal_options_seen"]+=1
        if 0<=g<37 or g==37:
            if phase!="turn":raise ValueError("discard action on reaction")
            p=detail.split(" ")[-1] if g==37 else detail
            tile=norm(p)
            if hand[tile]<1:raise ValueError("discard absent from own hand")
            if g==37:
                if not detail.startswith("立直 "):raise ValueError("bad riichi option")
                if ownriver["riichi"]:raise ValueError("already riichi")
                if any(any(c in "+=-" for c in m) for m in melds):raise ValueError("riichi after open meld")
                if board["scores"][seat]["points"]<1000 or board["remaining"]<4:raise ValueError("riichi point or remaining condition")
                if not melds:
                    raw=hand.copy();raw[tile]-=1
                    vec=[raw[t] for t in TYPES]
                    if SH.calculate_shanten(vec)!=0:raise ValueError("riichi without structural tenpai after discard")
                else:stats["riichi_with_kans_not_independently_shanten_checked"]+=1
                stats["riichi_option_feasible"]+=1
            else:stats["discard_option_feasible"]+=1
        elif 38<=g<=42 and phase=="reaction":
            p=tiles(detail)
            if g<=40:
                if len(p)!=3 or p[0][0]=="z":raise ValueError("invalid chi tiles")
                nums=sorted(int(norm(t)[1]) for t in p)
                if nums!=list(range(nums[0],nums[0]+3)):raise ValueError("invalid chi sequence")
                if reaction["from"]!=(seat+3)%4:raise ValueError("chi not from left player")
                stats["chi_option_feasible"]+=1
            elif g==41:
                if len(p)!=3 or len({norm(t) for t in p})!=1:raise ValueError("invalid pon")
                stats["pon_option_feasible"]+=1
            else:
                if len(p)!=4 or len({norm(t) for t in p})!=1:raise ValueError("invalid open kan")
                stats["open_kan_option_feasible"]+=1
            if reaction_tile not in [norm(t) for t in p]:raise ValueError("called tile not in meld")
            needed=[norm(t) for t in p]
            needed.remove(reaction_tile)
            h=hand.copy()
            for t in needed:
                h[t]-=1
                if h[t]<0:raise ValueError("called tile material not in own concealed hand")
            if ownriver["riichi"]:raise ValueError("called while already riichi")
        elif g==45:
            if phase!="reaction":raise ValueError("pass on turn")
            stats["reaction_pass_option"]+=1
        elif g==42 and phase=="turn":
            # Independently check four concealed tiles and no illegal state
            # but keep the post-riichi same-wait rule explicitly unverified.
            raw=tiles(detail)
            if len(raw)!=4 or len({norm(t) for t in raw})!=1:
                raise ValueError("turn kan cannot be anything but four same-type tiles")
            t=norm(raw[0])
            if hand[t]!=4:raise ValueError("closed-kan material absent")
            if any(norm(u)!=t for u in raw):raise ValueError("kan tile mismatch")
            if ownriver["riichi"]:
                unverified.append({"caseId":inp["id"],"group":g,"detail":detail,
                  "phase":phase,"reason":"riichi same-wait-kan legality independently unproven"})
                stats["not_independently_reconstructed_legal_option"]+=1
            else:
                stats["closed_kan_public_material_feasible"]+=1
        elif g==43 and phase=="reaction":
            # Independent scoring and structural completion. Full ron
            # legality also depends on temporary furiten not available here.
            t=reaction_tile
            if t in {norm(d["tile"]) for d in ownriver["discards"]}:
                raise ValueError("own river would impose structural furiten")
            raw=hand.copy();raw[t]+=1
            if raw[t]>4:raise ValueError("ron target makes fifth identical tile")
            if SH.calculate_shanten([raw[k] for k in TYPES],use_chiitoitsu=not bool(melds),
                                    use_kokushi=not bool(melds))!=-1:
                raise ValueError("ron would not complete structural winning hand")
            alltiles=own["hand"].copy()+[reaction["tile"][:2]]
            used=set()
            def allocate(tile):
                t=norm(tile);base=TI[t]*4
                alternatives=([base] if tile[1]=="0" else
                    list(range(base+1,base+4)) if t[0] in "mps" and t[1]=="5" else
                    list(range(base,base+4)))
                n=next((v for v in alternatives if v not in used),None)
                if n is None:raise ValueError("invalid allocation for physical winning tiles")
                used.add(n);return n
            concealed=[allocate(x) for x in alltiles]
            meldobjects=[]
            for m in melds:
                mt=tiles(m);ids=[allocate(x) for x in mt]
                concealed+=ids
                kind=Meld.KAN if len(mt)==4 else Meld.PON if len({norm(x) for x in mt})==1 else Meld.CHI
                meldobjects.append(Meld(meld_type=kind,tiles=ids,opened=any(c in "+=-" for c in m)))
            win=concealed[len(own["hand"])]
            # Indicator allocation belongs to dora calculation and cannot
            # share used ids with concealed hand; rely on calculator's own
            # indicator interpretation only where physically available.
            indicators=[]
            for dt in own["doraIndicators"]:
                tnorm=norm(dt)
                base=TI[tnorm]*4
                z=next((v for v in range(base,base+4) if v not in used),None)
                if z is None:raise ValueError("dora indicator collides with complete physical hand")
                used.add(z);indicators.append(z)
            conf=HandConfig(is_tsumo=False,is_riichi=bool(ownriver["riichi"]),
              player_wind=27+seat,round_wind=27+"東南西北".index(board["round"][0]),
              options=OptionalRules(has_open_tanyao=True,has_aka_dora=True,
                 has_double_yakuman=True,kiriage=False))
            res=HC.estimate_hand_value(concealed,win,melds=meldobjects,
                                      dora_indicators=indicators,config=conf)
            if res.error or not res.cost or res.cost["main"]<=0:
                raise ValueError("ron has no independently recognized yaku: "+str(res.error))
            stats["ron_physical_completed_yaku_feasible"]+=1
            stats["ron_temporary_furiten_not_independently_verified"]+=1
        else:
            stats["not_independently_reconstructed_legal_option"]+=1
            unverified.append({"caseId":inp["id"],"group":g,"detail":detail,
                 "phase":phase,"reason":"not physically reconstructed"})
    stats["cases"]+=1
    if phase=="turn":stats["turn_cases"]+=1
    else:stats["reaction_cases"]+=1
    if phase=="reaction" and 45 not in groups:raise ValueError("reaction without pass")
    return stats,unverified
def main(source,output):
    es=json.loads(Path(source).read_text())
    if len(es)!=36:raise ValueError("new dev freeze requires 36 distinct public cases")
    stats=collections.Counter();errors=[];not_reconstructed=[]
    for e in es:
        try:
            row,unsupported=one(e)
            stats.update(row)
            not_reconstructed.extend(unsupported)
        except Exception as exc:errors.append({"id":e["request"]["input"]["id"],"error":str(exc)})
    result={"status":"independent_public_material_and_action_feasibility_subset_only",
       "casesExpected":36,"checks":dict(stats),"errors":errors,
       "optionsNotIndependentlyReconstructed":not_reconstructed,
       "certified":["public own hand material 14/13 and 4-tile multiplicity",
                    "present discard/riichi options correspond to own tiles",
                    "basic physically valid chi/pon/open-kan material and source side where checked",
                    "pass action exists in reactions",
                    "closed-kan material when not riichi and physical ron completion with independent yaku when present"],
       "notCertified":["full set of legal options is complete",
         "full all-cases riichi/kan/ron/yaku/timing/furiten validation",
         "source engine's legal-option correctness beyond above subset",
         "tactical ability, opponent probabilities or long-term EV"]}
    Path(output).write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps(result,ensure_ascii=False))
    assert stats["cases"]==36 and len(errors)==0
if __name__=="__main__":
    main(sys.argv[1],sys.argv[2])
