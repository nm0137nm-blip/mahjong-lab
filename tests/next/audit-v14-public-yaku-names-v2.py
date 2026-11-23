"""Inspect candidate conditional-yaku identity against an independent mahjong package.

Development-only public projected input. Emits aggregate mapping candidates.
Does not decide identity equivalence without an explicit frozen mapping,
does not certify partial/conditional wins as actual outcomes.
"""
import importlib.util,json,collections,sys
from pathlib import Path
module=Path('tests/next/audit-v14-public-calculations.py')
spec=importlib.util.spec_from_file_location('independent_candidate_audit',module)
lib=importlib.util.module_from_spec(spec);spec.loader.exec_module(lib)
def main(src,out):
    es=json.loads(Path(src).read_text())
    pairs=collections.Counter()
    japanese=collections.Counter();python=collections.Counter()
    errors=[];examined=0;scored=0
    samples=[]
    for e in es:
        i=e['request']['input'];ev={x['id']:x['value'] for x in i['evidence']}
        own=ev['board']['ownSeat'];wind='東南西北'.index(ev['board']['round'][0])
        indicators=ev['own']['doraIndicators']
        for eid,val in ev.items():
            if not eid.startswith('calc-') or not isinstance(val,dict):continue
            candidates=[val]+val.get('afterCallDiscards',[])
            for candidate in candidates:
                for z in candidate.get('conditionalNormalWins',[]):
                    for k,tsumo,riichi in [('ron',False,False),('tsumo',True,False),
                                           ('hypotheticalRiichiRon',False,True)]:
                        examined+=1
                        original=z[k]
                        independent=lib.win_score(candidate['hand'],candidate['melds'],z['tile'],indicators,
                                                   own,wind,tsumo=tsumo,riichi=riichi,include_yaku=True)
                        if original is None and independent is None:continue
                        if (original is None)!=(independent is None):
                            errors.append({'case':i['id'],'action':eid,'tile':z['tile'],
                                           'mode':k,'difference':'one is null'});continue
                        if original['basePoints']!=independent['points']:
                            errors.append({'case':i['id'],'action':eid,'tile':z['tile'],'mode':k,
                                           'difference':'score mismatch'});continue
                        scored+=1
                        jp=tuple(sorted(original['yaku']));py=tuple(sorted(independent['yaku']))
                        for v in jp:japanese[v]+=1
                        for v in py:python[v]+=1
                        pairs[(jp,py)]+=1
                        if len(samples)<25:samples.append({'case':i['id'],'action':eid,'mode':k,
                                                         'jp':list(jp),'python':list(py)})
    result={'status':'yaku_identity_mapping_diagnostic_not_certified',
        'cases':len(es),'scoredComparisons':scored,'allModesExamined':examined,
        'scoreDisagreements':errors,'engineNameFrequency':dict(japanese),
        'independentPythonNameFrequency':dict(python),
        'nameCombinationPairs':[{'engineNames':list(a),'pythonNames':list(b),'count':n}
             for (a,b),n in pairs.most_common()],
        'samples':samples,
        'notCertified':['yaku name mapping has NOT yet been frozen or audited',
                        'actual agari legality, situational yaku and stage1 strategic quality',
                        'excluded groups with no conditional score']}
    Path(out).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'status':result['status'],'cases':len(es),'scored':scored,
          'examined':examined,'errors':errors,'jp':dict(japanese),'py':dict(python),
          'pairs':result['nameCombinationPairs'][:45]},ensure_ascii=False))
    assert len(es)==36 and not errors and scored>0
if __name__=='__main__':main(sys.argv[1],sys.argv[2])
