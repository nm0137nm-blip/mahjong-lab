#!/usr/bin/env python3
"""Independent Python audit of JS settlement math, not a tactical evaluation."""
import json
import sys

def rank(points, order):
    seats = sorted(range(4), key=lambda s: (-points[s], order.index(s)))
    return [seats.index(s)+1 for s in range(4)]

def audit(row):
    b,o,e=row["board"],row["options"],row["result"]
    p=[0]*4
    for s in b["scores"]: p[s["seat"]]=s["points"]
    own,opp=b["ownSeat"],o["opponentSeat"]
    is_win=o["kind"]=="hypotheticalOwnRon"
    winner=own if is_win else opp
    payer=opp if is_win else own
    deposit=1000 if o["postRiichi"] else 0
    payment=o["paymentBase"]+300*b["honba"]
    stick=(b["kyotaku"]*1000)+deposit
    after=p[:]
    after[own]-=deposit
    after[payer]-=payment
    after[winner]+=payment+stick
    assert sum(after)==sum(p)+b["kyotaku"]*1000
    rb=rank(p,b["initialOrder"])
    ra=rank(after,b["initialOrder"])
    expected={
      "pointsAfter":after,"ranksAfter":ra,"initialPoints":p,"initialRanks":rb,
      "ownPointsAfter":after[own],"opponentPointsAfter":after[opp],
      "ownRankAfter":ra[own],"opponentRankAfter":ra[opp],
      "rankChanged":rb[own]!=ra[own],"winnerSeat":winner,"payerSeat":payer,
      "winnerIsDealer":winner==o["dealerSeat"],"honbaExtra":300*b["honba"],
      "totalRonPayment":payment,"kyotakuBefore":b["kyotaku"],
      "riichiDeposit":deposit,"kyotakuAwarded":stick,
      "ownSeat":own,"opponentSeat":opp,"dealerSeat":o["dealerSeat"],
      "paymentBase":o["paymentBase"],"ownRiichiDeclared":o["postRiichi"],
      "kind":o["kind"]
    }
    for k,v in expected.items():
        assert e[k]==v, repr((k,e[k],v))
def main(path):
    v=json.load(open(path,encoding="utf-8"))
    assert v["version"]=="p2a-v4-independent-arithmetic-vectors-1"
    rows=v["vector"]
    assert len(rows)==4608
    assert set(x["board"]["ownSeat"] for x in rows)==set(range(4))
    assert set(x["options"]["dealerSeat"] for x in rows)==set(range(4))
    for i,row in enumerate(rows):
        try: audit(row)
        except Exception as ex: raise AssertionError("vector "+str(i)+": "+str(ex))
    print(json.dumps({"vectorsAudited":len(rows),"mismatches":0,
      "source":"independent Python arithmetic","realModelRuns":0,
      "verdict":"DEVELOPMENT_PUBLIC_SETTLEMENT_MATH_MATCH_ONLY"}))
if __name__=="__main__":
    assert len(sys.argv)==2
    main(sys.argv[1])
