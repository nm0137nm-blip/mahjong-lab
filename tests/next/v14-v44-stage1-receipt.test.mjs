import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createV44CompactDevelopmentPacket,V44_COMPACT_RESPONSE}
 from '../../src/coach/v14-compact-model-contract-v44.mjs';
import {createV3IndependentDevelopmentRequest} from '../../src/coach/v14-independent-request-v3.mjs';
import {assessV44FirstRealStage1,summarizeV44Stage1Receipts}
 from '../../src/coach/v14-v44-stage1-receipt.mjs';
const frozen=process.env.V14_FOLLOWUP_PUBLIC?
 JSON.parse(fs.readFileSync(process.env.V14_FOLLOWUP_PUBLIC,'utf8')):[];
function fixture(){
 const row=frozen.find(x=>x.request.input.id==='pilot-46');if(!row)return null;
 const e=createV3IndependentDevelopmentRequest(row),p=createV44CompactDevelopmentPacket(e);
 const answer={version:V44_COMPACT_RESPONSE,requestHash:p.requestHash,
  recommendation:{key:'a37-0',afterCallDiscard:null},
  alternative:{key:'a30-0',afterCallDiscard:null},
  tactics:{
   comparison:'[[candidate:a37-0:kind]]と[[candidate:a30-0:kind]]を比べ、[[candidate:a37-0:ronSummary]]で仮の和了形を検討する。',
   opponents:[1,2,3].map(seat=>({
    seat,importance:'potentially_relevant',
    analysis:'[[opponent:seat'+seat+':pointGapFromOwn]]と[[opponent:seat'+seat+':meldCount]]の公開事実を比べる。',
    tradeoff:'[[candidate:a37-0:kind]]で押す代償と[[opponent:seat'+seat+':riichi]]の公開状況を個別に比較する。',
    changeCondition:'もし[[opponent:seat'+seat+':riichi]]が変われば、押し引きを見直す。'
   })),
   bottomLine:'[[candidate:a37-0:kind]]の条件付き打点を検討する。',
   reversal:'もし[[opponent:seat2:riichi]]が立直済みになれば、攻め方を見直す。',
   lesson:'打点と守備自由度は別の検討要因である。'
  }};
 return {p,answer};
}
test('first pilot43 exact frozen hash and file attachment metadata with no tactical-certification claim',()=>{
 const f=fixture();if(!f)return;
 const text=JSON.stringify(f.answer);
 const r=assessV44FirstRealStage1(frozen,'pilot-46',text,{
  provider:'ChatGPT',modelDisplay:'GPT-6 user-reported',
  independentTemporaryChat:true,replySubmittedAsJsonFile:true});
 assert.equal(r.verdict,'CONTRACT_AND_PUBLIC_FACT_GATE_PASS');
 assert.equal(r.originMetadata.replySubmittedAsJsonFile,true);
 assert.equal(r.rawReplyPreserved,text);
 assert.equal(r.output.experimentalModelChoice.isProductionRecommendation,false);
 assert.equal(r.semanticGrade,'NOT_ASSESSED_BY_MACHINE');
 assert.equal(summarizeV44Stage1Receipts([r]).verdict,'INCOMPLETE_STAGE1_NOT_GO');
});
test('first fatal numeric fabrication and missing opponent citation remain hard NO-GO',()=>{
 const f=fixture();if(!f)return;
 let bad=structuredClone(f.answer);
 bad.tactics.lesson+=' 3900点という勝手な数値を付ける。';
 const a=assessV44FirstRealStage1(frozen,'pilot-46',JSON.stringify(bad),{});
 assert.equal(a.verdict,'STAGE1_NO_GO_INVALID_PUBLIC_CONTRACT');
 assert.equal(summarizeV44Stage1Receipts([a]).verdict,'PREDECLARED_PHASE_NO_GO_AFTER_FIRST_FATAL');
 bad=structuredClone(f.answer);
 bad.tactics.opponents[1].tradeoff='[[candidate:a37-0:kind]]の危険を一般的に考える。';
 const b=assessV44FirstRealStage1(frozen,'pilot-46',JSON.stringify(bad),{});
 assert.equal(b.verdict,'STAGE1_NO_GO_INVALID_PUBLIC_CONTRACT');
 assert.match(b.failure,/opponent tradeoff needs both/);
});
