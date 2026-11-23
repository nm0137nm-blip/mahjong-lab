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
# Name-equivalence dictionary fixed from publicly named mahjong rules, not
# inferred from point totals or responses. Strictly for the 12 yaku observed
# in this frozen 36-development input; unseen names must fail closed.
JP_TO_PY={
 '断幺九':'Tanyao', '門前清自摸和':'Menzen Tsumo', '立直':'Riichi',
 '翻牌 白':'Yakuhai (haku)', '平和':'Pinfu', '七対子':'Chiitoitsu',
 '一盃口':'Iipeiko', '一気通貫':'Ittsu', '翻牌 發':'Yakuhai (hatsu)',
 '対々和':'Toitoi', '混一色':'Honitsu', '翻牌 中':'Yakuhai (chun)'}
BONUS_YAKU={'Aka Dora','Dora','Ura Dora'}

def main(src,out):
    es=json.loads(Path(src).read_text())
    pairs=collections.Counter()
    japanese=collections.Counter();python=collections.Counter()
    errors=[];examined=0;scored=0;yaku_name_failures=[];unknown_names=set()
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
                        for name in jp:
                            if name not in JP_TO_PY:unknown_names.add(name)
                        if not unknown_names:
                            mapped=tuple(sorted(JP_TO_PY[x] for x in jp))
                            actual=tuple(sorted(y for y in py if y not in BONUS_YAKU))
                            if mapped!=actual:
                                yaku_name_failures.append({'case':i['id'],'action':eid,
                                    'tile':z['tile'],'mode':k,'japanese':list(jp),
                                    'expectedMapped':list(mapped),'python':list(actual)})
                        for v in jp:japanese[v]+=1
                        for v in py:python[v]+=1
                        pairs[(jp,py)]+=1
                        if len(samples)<25:samples.append({'case':i['id'],'action':eid,'mode':k,
                                                         'jp':list(jp),'python':list(py)})
    result={'status':'yaku_identity_mapping_diagnostic_not_certified',
        'cases':len(es),'scoredComparisons':scored,'allModesExamined':examined,
        'scoreDisagreements':errors,'unknownEngineYakuNames':sorted(unknown_names),
        'roleNameDisagreements':yaku_name_failures,
        'mappingScope':'only the 12 named regular yaku present in frozen development 36',
        'engineNameFrequency':dict(japanese),
        'independentPythonNameFrequency':dict(python),
        'nameCombinationPairs':[{'engineNames':list(a),'pythonNames':list(b),'count':n}
             for (a,b),n in pairs.most_common()],
        'samples':samples,
        'notCertified':['mapping covers only 12 observed regular yaku; unrelated yaku and exceptional rules not audited',
                        'actual agari legality, situational yaku and stage1 strategic quality',
                        'excluded groups with no conditional score']}
    Path(out).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'status':result['status'],'cases':len(es),'scored':scored,
          'examined':examined,'errors':errors,'yakuNameErrors':yaku_name_failures,'unknownNames':sorted(unknown_names),'jp':dict(japanese),'py':dict(python),
          'pairs':result['nameCombinationPairs'][:45]},ensure_ascii=False))
    assert len(es)==36 and not errors and scored>0 and not unknown_names and not yaku_name_failures
if __name__=='__main__':main(sys.argv[1],sys.argv[2])
