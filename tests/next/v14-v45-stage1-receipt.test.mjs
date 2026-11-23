import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createV45FrozenStage1} from './v14-v45-stage1-freeze.mjs';
import {assessV45FirstRealStage1,summarizeV45Stage1Receipts} from '../../src/coach/v14-v45-stage1-receipt.mjs';
import {P2A_V45_FIXED_EIGHT,P2A_V45_PACKET_HASHES,P2A_V45_RESEARCH_PLAN} from '../../src/coach/v14-v45-evaluation-plan.mjs';
const source=process.env.V14_FOLLOWUP_PUBLIC?
 JSON.parse(fs.readFileSync(process.env.V14_FOLLOWUP_PUBLIC,'utf8')):null;
const hash=s=>createHash('sha256').update(s).digest('hex');
test('fixed eight and packet requestHash are hardcoded, validated from original 36',()=>{
 assert.equal(P2A_V45_FIXED_EIGHT.length,8);
 assert.equal(P2A_V45_PACKET_HASHES.length,8);
 assert.equal(P2A_V45_RESEARCH_PLAN.stage1.requiredContractPassCount,8);
 assert(P2A_V45_RESEARCH_PLAN.stage1.firstCriticalFailure.includes('NO_GO'));
 assert(P2A_V45_RESEARCH_PLAN.overall.cost.includes('first eight'));
 if(!source)return;
 const p=createV45FrozenStage1(source);
 for(const [i,q] of p.questions.entries()){
  assert.equal(q.caseId,P2A_V45_FIXED_EIGHT[i]);
  assert.equal(q.packet.requestHash,P2A_V45_PACKET_HASHES[i]);
  assert.equal(hash(JSON.stringify(q.packet.request)),P2A_V45_PACKET_HASHES[i]);
 }
});
test('malformed manual JSON remains a real first-fatal and no auto correction/retry',()=>{
 if(!source)return;
 const x=assessV45FirstRealStage1(source,P2A_V45_FIXED_EIGHT[0],'{invalid JSON',{
  provider:'ChatGPT manual',modelDisplay:'GPT-6',independentTemporaryChat:true,
  replySubmittedAsJsonFile:true,observedLocalTimestamp:'2026-11-24T07:00+09:00'});
 assert.equal(x.verdict,'STAGE1_NO_GO_INVALID_JSON');
 assert.equal(x.rawReplySha256,hash('{invalid JSON'));
 assert.equal(x.rawReplyPreserved,'{invalid JSON');
 assert.equal(x.noAutomaticRepair,true);
 assert.equal(x.actualIndependentModelAttemptCount,1);
 const sum=summarizeV45Stage1Receipts([x]);
 assert.equal(sum.fatal,true);
 assert.equal(sum.actualAttempts,1);
 assert.equal(sum.verdict,'PREDECLARED_PHASE_NO_GO_AFTER_FIRST_FATAL');
 assert.throws(()=>summarizeV45Stage1Receipts([{
  ...x,caseId:P2A_V45_FIXED_EIGHT[1]}]),/responses not in preregistered order/);
});
test('manual Stage1 contract does not count API attempts or claim skill from numeric gate',()=>{
 assert.equal(P2A_V45_RESEARCH_PLAN.modelRecording.provider,'ChatGPT manual one temporary chat per single question');
 assert.equal(P2A_V45_RESEARCH_PLAN.stage1.requiredContractPassCount,8);
 assert.equal(P2A_V45_RESEARCH_PLAN.l4.allThreeRatersRequired,true);
 assert.equal(P2A_V45_RESEARCH_PLAN.l35.changedMin,4);
 assert.equal(P2A_V45_RESEARCH_PLAN.l35.maintainedMin,4);
 assert(P2A_V45_RESEARCH_PLAN.overall.cost.includes('no paid model API'));
});

test('first pilot41 positive synthetic full three-seat contract and negative tampering',()=>{
 if(!source)return;
 const rows=[0,1,3],rec='a37-0',alt='a1-0';
 const example={
  version:'p2a-v45-compact-stage1-response-1',
  requestHash:P2A_V45_PACKET_HASHES[0],
  recommendation:{key:rec,afterCallDiscard:null},
  alternative:{key:alt,afterCallDiscard:null},
  tactics:{
   comparison:'[[candidate:a37-0:kind]]と[[candidate:a1-0:kind]]を比較し、[[candidate:a37-0:shanten]]と[[candidate:a1-0:shanten]]の公開差を考慮する。',
   opponents:rows.map(seat=>({
    seat,importance:'potentially_relevant',
    analysis:'[[opponent:seat'+seat+':pointGapFromOwn]]と[[opponent:seat'+seat+':meldCount]]から公開状況だけを把握する。',
    tradeoff:'[[candidate:a37-0:kind]]を選ぶ代償を[[opponent:seat'+seat+':riichi]]と照合して考える。',
    changeCondition:'もし[[opponent:seat'+seat+':riichi]]が先制なら、対案を選びやすくする。'
   })),
   bottomLine:'[[candidate:a37-0:kind]]を候補として採用する。',
   reversal:'もし[[opponent:seat0:riichi]]が先制なら、別案を選びやすくする。',
   lesson:'手組みと公開された進行を区別し、相手別の危険を比較する。'
  }
 };
 const meta={provider:'synthetic offline fixture',modelDisplay:'NO MODEL',
  independentTemporaryChat:false,replySubmittedAsJsonFile:false};
 const ok=assessV45FirstRealStage1(source,'pilot-41',JSON.stringify(example),meta);
 assert.equal(ok.verdict,'CONTRACT_AND_PUBLIC_FACT_GATE_PASS',ok.failure);
 assert.equal(ok.semanticGrade,'NOT_ASSESSED_BY_MACHINE');
 let bad=structuredClone(example);
 bad.tactics.lesson+=' 3900点と未確認数値をつける。';
 const invented=assessV45FirstRealStage1(source,'pilot-41',JSON.stringify(bad),meta);
 assert.equal(invented.verdict,'STAGE1_NO_GO_INVALID_PUBLIC_CONTRACT');
 bad=structuredClone(example);
 bad.tactics.opponents[1].tradeoff='[[candidate:a37-0:kind]]だけを述べる。';
 const noSeat=assessV45FirstRealStage1(source,'pilot-41',JSON.stringify(bad),meta);
 assert.equal(noSeat.verdict,'STAGE1_NO_GO_INVALID_PUBLIC_CONTRACT');
 assert.match(noSeat.failure,/opponent tradeoff needs both/);
});
