"""Independent Python check of v3 candidate-specific score/rank and opponent
visible han. Uses only the sealed public projection and JS-produced tables;
does NOT import the JS scoring code, use hidden hands or run any model.
"""
import collections,json,sys
from pathlib import Path

def fail(msg):raise ValueError(msg)
def ranking(points,order,seat):
    return 1+sum(i!=seat and (v>points[seat] or
       (v==points[seat] and order.index(i)<order.index(seat)))
       for i,v in enumerate(points))
def evidence(inp,key):
    hits=[x['value'] for x in inp['evidence'] if x['id']==key]
    if len(hits)!=1:fail('missing/duplicate public evidence '+key)
    return hits[0]
def candidate_audit(inp,board,opp,candidate):
    key=candidate['choice']['key']
    a=[x for x in inp['actions'] if x['key']==key]
    if len(a)!=1:fail('illegal candidate')
    calc=evidence(inp,'calc-'+key)
    if 'afterCallDiscards' in calc:
        match=[x for x in calc['afterCallDiscards'] if x['discard']==candidate['choice']['afterCallDiscard']]
        if len(match)!=1:fail('invalid concrete postcall discard')
        calc=match[0]
    elif candidate['choice']['afterCallDiscard'] is not None:fail('not a call')
    if candidate['group']!=a[0]['group']:fail('wrong action group')
    if candidate['publicShanten']!=calc.get('shanten') or candidate['publicUkeireUpperBound']!=calc.get('ukeireUpperBound'):fail('wrong public shape')
    if candidate['visibleRetainedDoraHan']!=calc.get('retainedDoraHan'):fail('incorrect retained dora')
    if candidate['ownRiverFuriten']!=calc.get('ownRiverFuriten'):fail('incorrect river furiten')
    rows=calc.get('conditionalNormalWins')
    got=candidate['ronWinningForms']
    if rows is None:
        if got['status']!='not_quantified' or got['scored'] or got['unscored']!=0:fail('missing-ratio falsely scored')
        return 0
    allwins=[x for x in rows if isinstance(x.get('tile'),str)]
    expected=[x for x in allwins if x.get('ron') and isinstance(x['ron'].get('basePoints'),int) and x['ron']['basePoints']>0]
    if len(got['scored'])!=len(expected) or got['unscored']!=len(allwins)-len(expected):fail('wrong scored count')
    base=[z['points'] for z in board['scores']]
    own=board['ownSeat'];order=board['initialOrder']
    for original,actual in zip(expected,got['scored']):
        score=original['ron']['basePoints']
        payment=score+board['honba']*300
        gain=payment+board['kyotaku']*1000
        after=base.copy()
        after[own]+=gain;after[opp]-=payment
        if actual['tile']!=original['tile'] or actual['yaku']!=original['ron']['yaku']:fail('wrong candidate tile/yaku')
        if actual['calculatedDefen']!=score or actual['ownRonGainWithHonbaAndSticks']!=gain or actual['opponentRonLossWithHonba']!=payment:fail('incorrect candidate-specific ron score')
        if actual['ownRankAfter']!=ranking(after,order,own) or actual['pointsAfter']!=after or actual['ranksAfter']!=[ranking(after,order,s) for s in range(4)]:fail('incorrect rank after candidate-specific win')
    tsim=[x for x in allwins if x.get('tsumo') and isinstance(x['tsumo'].get('basePoints'),int) and x['tsumo']['basePoints']>0]
    actual=candidate['tsumoWinningForms']['tileScoreForms']
    if len(tsim)!=len(actual):fail('wrong tsumo score count')
    for w,z in zip(tsim,actual):
        if z!={'tile':w['tile'],'calculatedDefen':w['tsumo']['basePoints'],'yaku':w['tsumo']['yaku']}:fail('incorrect tsumo conditional form')
    if candidate['tsumoWinningForms']['rankSimulation']!='not_derived_no_payer_distribution':fail('invented tsumo rank')
    return len(expected)
def run(src_path,table_path,output):
    source=json.loads(Path(src_path).read_text()),tables=json.loads(Path(table_path).read_text())
    cases,tables=source
    if len(cases)!=36 or len(tables)!=36:fail('not all 36 input cases')
    stats=collections.Counter()
    for packet,t in zip(cases,tables):
        inp=packet['request']['input']
        if t['caseId']!=inp['id'] or t['requestHash']!=packet['requestHash']:fail('wrong case or request')
        board=evidence(inp,'board');opp=t['specification']['opponent']
        p=evidence(inp,'public-value-'+str(opp))
        if opp==board['ownSeat']:fail('cannot be own opponent')
        for field in ('riichi','meldCount','exposedDoraHan','exposedYakuhaiHan','pointGapFromOwn'):
            actual=t['opponent']['publicPointGapFromOwn' if field=='pointGapFromOwn' else field]
            if actual!=p[field]:fail('wrong opponent public observation '+field)
        if t['opponent']['guaranteedVisibleHanIfAnyLegalWin']!=p['exposedDoraHan']+p['exposedYakuhaiHan']:fail('false exposed han sum')
        if len(t['candidates'])!=2:fail('not two concrete choices')
        for c in t['candidates']:
            stats['conditional_ron_scored_forms']+=candidate_audit(inp,board,opp,c)
            stats['candidates']+=1
        base=[z['points'] for z in board['scores']];own=board['ownSeat'];order=board['initialOrder']
        tier=[1000,2000,3900,8000]
        if [z['illustrativeRonDefen'] for z in t['sensitivityOwnRonLossByTier']]!=tier:fail('changed registered tiers')
        for v in t['sensitivityOwnRonLossByTier']:
            pay=v['illustrativeRonDefen']+board['honba']*300
            points=base.copy();points[own]-=pay;points[opp]+=pay+1000*board['kyotaku']
            if v['pointsAfter']!=points or v['ownLossBeforeSticks']!=-pay or v['ownRankAfter']!=ranking(points,order,own) or v['opponentRankAfter']!=ranking(points,order,opp):fail('wrong independent opponent settlement')
            stats['loss_sensitivity_tiers']+=1
        if t['symbolicCandidateComparison']['verdict']!='not_calculated_no_EV_no_rank_utility':fail('pretended EV certainty')
        stats['scenes']+=1
    result={'status':'public_hypothetical_candidate_value_independently_rechecked_not_ev',
     'cases':stats['scenes'],'concreteCandidates':stats['candidates'],
     'scoredRonForms':stats['conditional_ron_scored_forms'],
     'independentOppLossRankScenarios':stats['loss_sensitivity_tiers'],'discrepancies':0,
     'modelCalls':0,'notCertified':['actual hidden opponent value','expected value','probability','correct tactical explanation']}
    Path(output).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(result,ensure_ascii=False))
if __name__=='__main__':run(*sys.argv[1:4])
