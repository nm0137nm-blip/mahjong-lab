import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createV3IndependentDevelopmentRequest} from '../../src/coach/v14-independent-request-v3.mjs';
import {createV4CompactDevelopmentPacket,V4_COMPACT_RESPONSE}
 from '../../src/coach/v14-compact-model-contract-v4.mjs';
import {assessV4FirstRealStage1,summarizeV4Stage1Receipts}
 from '../../src/coach/v14-v4-stage1-receipt.mjs';
const frozen=process.env.V14_FOLLOWUP_PUBLIC?
 JSON.parse(fs.readFileSync(process.env.V14_FOLLOWUP_PUBLIC,'utf8')):[];
function mock(){
 const s=frozen.find(x=>x.request.input.id==='pilot-42');if(!s)return null;
 const p=createV4CompactDevelopmentPacket(createV3IndependentDevelopmentRequest(s)),
 own=p.request.publicBrief.board.ownSeat;
 const seats=[0,1,2,3].filter(i=>i!==own);
 return {packet:p,answer:{
  version:V4_COMPACT_RESPONSE,requestHash:p.requestHash,
  recommendation:{key:'a37-0',afterCallDiscard:null},
  alternative:{key:'a16-0',afterCallDiscard:null},
  tactics:{
   comparison:'[[candidate:a37-0:kind]]と[[candidate:a16-0:kind]]を[[candidate:a37-0:shanten]]の形と合わせて比較する。',
   opponents:seats.map(seat=>({
    seat,importance:'not_established',
    analysis:'[[opponent:seat'+seat+':pointGapFromOwn]]の点差と[[opponent:seat'+seat+':meldCount]]の副露を分けて判断する。',
    tradeoff:'[[opponent:seat'+seat+':riichi]]の立直状況と[[candidate:a37-0:kind]]の守備自由度の代償を比較する。',
    changeCondition:'もし[[opponent:seat'+seat+':riichi]]が変わる場合、攻撃と守備の選択が変化する。'
   })),
   bottomLine:'[[candidate:a37-0:kind]]を候補とするが、勝率・相手の隠し手は断定できない。',
   reversal:'もし[[opponent:seat2:riichi]]が変わる場合、放銃の代償を優先して判断を変更する。',
   lesson:'点棒の価値と和了手段の違いを個別に考える。'
  }}
 };
}
test('independent raw JSON answer preserved and judged against exact frozen packet hash',()=>{
 const f=mock();if(!f)return;
 const text=JSON.stringify(f.answer);
 const r=assessV4FirstRealStage1(frozen,'pilot-42',text,{
  provider:'OpenAI ChatGPT',modelDisplay:'GPT-6',
  observedLocalTimestamp:'2026-11-23T15:00:00+09:00',
  independentTemporaryChat:true,effort:'high'});
 assert.equal(r.verdict,'CONTRACT_AND_PUBLIC_FACT_GATE_PASS');
 assert.equal(r.rawReplyPreserved,text);
 assert.equal(r.output.experimentalModelChoice.isProductionRecommendation,false);
 assert.equal(r.semanticGrade,'NOT_ASSESSED_BY_MACHINE');
 assert.equal(summarizeV4Stage1Receipts([r]).canExpand,false);
});
test('raw malformed answer, invented points and unbound request close phase without retry',()=>{
 if(!frozen.length)return;
 const codeFence=String.fromCharCode(96).repeat(3);
 const bad=assessV4FirstRealStage1(frozen,'pilot-42',codeFence+'json\n{}\n'+codeFence,{});
 assert.equal(bad.verdict,'STAGE1_NO_GO_INVALID_JSON');
 assert.equal(summarizeV4Stage1Receipts([bad]).verdict,'PREDECLARED_PHASE_NO_GO_AFTER_FIRST_FATAL');
 const f=mock(),modified=structuredClone(f.answer);
 modified.tactics.comparison+=' 3900点放銃は必ず首位陥落';
 const wrong=assessV4FirstRealStage1(frozen,'pilot-42',JSON.stringify(modified),{});
 assert.equal(wrong.verdict,'STAGE1_NO_GO_INVALID_PUBLIC_CONTRACT');
 const old=structuredClone(f.answer);old.requestHash='old';
 const x=assessV4FirstRealStage1(frozen,'pilot-42',JSON.stringify(old),{});
 assert.equal(x.verdict,'STAGE1_NO_GO_INVALID_PUBLIC_CONTRACT');
});
test('zero observations, duplicate and out-of-order case never count as successful stage1',()=>{
 assert.equal(summarizeV4Stage1Receipts([]).verdict,'INCOMPLETE_STAGE1_NOT_GO');
 assert.throws(()=>summarizeV4Stage1Receipts([{caseId:'pilot-47',verdict:'CONTRACT_AND_PUBLIC_FACT_GATE_PASS'}]),/preregistered order/);
 assert.throws(()=>summarizeV4Stage1Receipts([
  {caseId:'pilot-42',verdict:'CONTRACT_AND_PUBLIC_FACT_GATE_PASS'},
  {caseId:'pilot-42',verdict:'CONTRACT_AND_PUBLIC_FACT_GATE_PASS'}]),/preregistered order or repeated/);
});
