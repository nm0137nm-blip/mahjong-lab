import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createV3IndependentDevelopmentRequest} from '../../src/coach/v14-independent-request-v3.mjs';
import {createV4DeterministicSourceComparison} from '../../src/coach/v14-source-comparison-proof-v4.mjs';
import {createV44SourceShapeContrast} from '../../src/coach/v14-source-shape-contrast-v44.mjs';
import {createV44CompactDevelopmentPacket,verifyAndRenderV44CompactModelResponse,V44_COMPACT_RESPONSE}
 from '../../src/coach/v14-compact-model-contract-v44.mjs';
const raw=process.env.V14_FOLLOWUP_PUBLIC?
 JSON.parse(fs.readFileSync(process.env.V14_FOLLOWUP_PUBLIC,'utf8')):[];
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const envelope=id=>{
 const r=raw.find(x=>x.request.input.id===id);
 if(!r)throw Error('missing immutable source '+id);
 return createV3IndependentDevelopmentRequest(r);
};
const pair={recommendation:{key:'a24-0',afterCallDiscard:null},
 alternative:{key:'a21-0',afterCallDiscard:null}};
test('v43 history remains original NO-GO and v44 public shape has two real independent distinctions in pilot70',()=>{
 if(!raw.length)return;
 const e=envelope('pilot-70');
 assert.equal(sha(raw),'271b4a304ed86dc41be2e72766e2b5cc496966bdf8a0ce5a8d5a5d0334e6103a');
 assert.equal(createV4DeterministicSourceComparison(e,pair.recommendation,pair.alternative).publicDifferences,0);
 const contrast=createV44SourceShapeContrast(e,pair.recommendation,pair.alternative);
 assert.equal(contrast.verifiedAdditionalDifferences,2);
 assert.equal(contrast.witnesses[0].type,'standardShanten');
 assert.equal(contrast.witnesses[0].recommended,2);
 assert.equal(contrast.witnesses[0].alternative,3);
 assert.equal(contrast.witnesses[1].type,'improvingComposition');
 assert.deepEqual(contrast.witnesses[1].recommended.map(x=>x.tile),['s2','s3','s4']);
 assert.deepEqual(contrast.witnesses[1].alternative.map(x=>x.tile),['s2','s3','s7']);
});
const fixture=()=>{
 const e=envelope('pilot-70'),p=createV44CompactDevelopmentPacket(e);
 const seat=x=>({
   seat:x,importance:'potentially_relevant',
   analysis:'[[opponent:seat'+x+':pointGapFromOwn]]の点差と[[opponent:seat'+x+':meldCount]]の進行を照合する。',
   tradeoff:'[[candidate:a24-0:kind]]は[[opponent:seat'+x+':riichi]]の現状に照らして判断する。',
   changeCondition:'もし[[opponent:seat'+x+':meldCount]]が増えれば、守備優先へ判断を見直す。'
 });
 return {e,p,
  response:{version:V44_COMPACT_RESPONSE,requestHash:p.requestHash,
   ...pair,tactics:{
    comparison:'[[candidate:a24-0:kind]]と[[candidate:a21-0:kind]]は[[candidate:a24-0:shanten]]と[[candidate:a21-0:shanten]]が同じでも、[[candidate:a24-0:standardShanten]]と[[candidate:a21-0:standardShanten]]で通常手の速さが異なる。改善牌の詳細は[[candidate:a24-0:improvingSummary]]と[[candidate:a21-0:improvingSummary]]で照合する。',
    opponents:[seat(0),seat(2),seat(3)],
    bottomLine:'[[candidate:a24-0:kind]]で公開された形の差を評価する。',
    reversal:'もし[[opponent:seat0:meldCount]]が増えれば、[[candidate:a21-0:kind]]も含めて守備の選択を再検討する。',
    lesson:'公開された候補の総受け入れが同じでも、個々の改善牌の構成や通常手の向聴数を比べる。'
   }}
 };
};
test('v44 prospective synthetic valid tie case can be source-proofed, without retroactive v43 user answer regrade',()=>{
 if(!raw.length)return;
 const {e,p,response}=fixture();
 const result=verifyAndRenderV44CompactModelResponse(e,p,response);
 assert.equal(result.output.outcome,'typed_facts_verified_qualitative_tactics_unverified');
 assert.equal(result.output.sourceBasedPublicProof.legacyDistinctFacts,0);
 assert.equal(result.output.sourceBasedPublicProof.additionalShapeDifferences,2);
 assert.equal(result.output.sourceBasedPublicProof.distinctPublicFacts,2);
 assert.equal(result.output.sourceBasedPublicProof.verifiedOpponentFacts,6);
 assert.equal(result.output.experimentalModelChoice.isProductionRecommendation,false);
 assert(p.request.availableFactIds.includes('candidate:a24-0:standardShanten'));
 assert(p.request.availableFactIds.includes('candidate:a21-0:improvingSummary'));
 assert(p.request.availableFactIds.includes('candidate:a24-0:discardTile'));
 assert.equal(p.request.delivery.filename,'mahjong_P2a_v44_stage1_pilot-70_response.json');
});
test('tie candidates may not silently pass unless model actually cites both true shape witnesses',()=>{
 if(!raw.length)return;
 const {e,p,response}=fixture(),bad=structuredClone(response);
 bad.tactics.comparison='[[candidate:a24-0:kind]]と[[candidate:a21-0:kind]]の[[candidate:a24-0:shanten]][[candidate:a21-0:shanten]]だけを比較し、通常手の完成度が違うと説明する。';
 assert.throws(()=>verifyAndRenderV44CompactModelResponse(e,p,bad),
  /comparison did not cite both sides of source-verified shape or concrete tile difference/);
 const one=structuredClone(response);
 one.tactics.comparison='[[candidate:a24-0:kind]]と[[candidate:a21-0:kind]]には[[candidate:a24-0:standardShanten]]で差があると感じる。[[candidate:a24-0:ukeireUpperBound]]を見る。';
 assert.throws(()=>verifyAndRenderV44CompactModelResponse(e,p,one),/did not cite both sides/);
});
test('fabricated source-shape token and raw numerical shanten must remain rejected',()=>{
 if(!raw.length)return;
 const {e,p,response}=fixture(),bad=structuredClone(response);
 bad.tactics.comparison+=' [[candidate:a24-0:standardShanten999]]の公開差も参照。';
 assert.throws(()=>verifyAndRenderV44CompactModelResponse(e,p,bad),/unknown fact ID/);
 const f=structuredClone(response);
 f.tactics.lesson+=' 完全に根拠のない3900点を断言する。';
 assert.throws(()=>verifyAndRenderV44CompactModelResponse(e,p,f),/unanchored/);
});
test('source packet tampering and identical concrete action pairs never produce synthetic difference',()=>{
 if(!raw.length)return;
 const {e,p,response}=fixture();
 const same=structuredClone(response);
 same.alternative={key:'a24-0',afterCallDiscard:null};
 assert.throws(()=>verifyAndRenderV44CompactModelResponse(e,p,same),/identical concrete choices/);
 const bad=structuredClone(e);
 const entry=bad.request.input.evidence.find(x=>x.id==='calc-a24-0');
 entry.value.forms.standard=0;
 assert.throws(()=>createV44SourceShapeContrast(bad,pair.recommendation,pair.alternative),/source packet not immutable/);
});
test('positive and negative fallback proof: source-correct different concrete tile identity, not arbitrary subjective danger',()=>{
 if(!raw.length)return;
 const e=envelope('pilot-70'),i=e.request.input;
 const exactA={key:'a24-0',afterCallDiscard:null},exactB={key:'a21-0',afterCallDiscard:null};
 const rows=createV44SourceShapeContrast(e,exactA,exactB).witnesses;
 assert(rows.every(x=>x.sourceFactIds.length===2));
 assert(!rows.some(x=>x.type==='concreteDiscardTile'));
});
