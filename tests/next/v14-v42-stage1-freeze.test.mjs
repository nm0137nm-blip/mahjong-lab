import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createV42FrozenStage1} from './v14-v42-stage1-freeze.mjs';
import {selectV42ProspectiveSmoke,V42_EIGHT} from '../../src/coach/v14-v42-smoke-selection.mjs';
import {P2A_V42_RESEARCH_PLAN as p,P2A_V42_FIXED_EIGHT as ids,
 P2A_V42_PACKET_HASHES as hashes,P2A_V42_BASE_SOURCE_HASH}
 from '../../src/coach/v14-v42-evaluation-plan.mjs';
import {createV3IndependentDevelopmentRequest} from '../../src/coach/v14-independent-request-v3.mjs';
import {createV42CompactDevelopmentPacket,V42_COMPACT_RESPONSE}
 from '../../src/coach/v14-compact-model-contract-v42.mjs';
import {assessV42FirstRealStage1,summarizeV42Stage1Receipts}
 from '../../src/coach/v14-v42-stage1-receipt.mjs';
const frozen=process.env.V14_FOLLOWUP_PUBLIC?
 JSON.parse(fs.readFileSync(process.env.V14_FOLLOWUP_PUBLIC,'utf8')):[];
const h=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
test('eight new source fixed prompts hash lock and first SHA-next honba reach pilot52 before new model response',()=>{
 if(!frozen.length)return;
 assert.equal(h(frozen),P2A_V42_BASE_SOURCE_HASH);
 const s=selectV42ProspectiveSmoke(frozen),a=createV42FrozenStage1(frozen);
 assert.deepEqual(s.selectedIds,V42_EIGHT);
 assert.deepEqual(ids,s.selectedIds);
 assert.equal(ids[0],'pilot-52');
 assert(!ids.some(x=>['pilot-42','pilot-48','pilot-50'].includes(x)));
 assert.equal(a.questions.length,8);assert.equal(a.verifierManifest.weakControls.controls.length,8);
 assert.equal(a.publicManifest.newV42ModelAttemptsAtFreeze,0);
 assert.equal(a.publicManifest.originalV4ModelAttempts,1);
 assert.equal(a.publicManifest.originalV41ModelAttempts,1);
 for(let i=0;i<8;i++){
  assert.equal(a.publicManifest.rows[i].packetHash,hashes[i]);
  assert.equal(a.questions[i].packet.requestHash,hashes[i]);
  assert.equal(a.questions[i].packet.request.version,'p2a-v42-independent-public-brief-1');
  assert(!JSON.stringify(a.questions[i].packet).includes('DECOY_NOT_ALLOWED'));
 }
 assert.equal(a.publicManifest.counts.honbaPositive,3);
});
test('v42 preregistration retains strict tactical L4 and first real error stop independent of copy normalization',()=>{
 assert.match(p.historicalV41,/pilot50/);
 assert.equal(p.stage1.requiredContractPassCount,8);
 assert.equal(p.stage1.toleratedMaterialArithmeticOrFactualErrors,0);
 assert.match(p.stage1.firstCriticalFailure,/immediate_NO_GO/);
 assert.match(p.stage1.allowedReadOnlyTransport,/curly-quotes/);
 assert.equal(p.stability.plannedManualChats,8);
 assert.equal(p.stage2.plannedManualChats,8);
 assert.equal(p.l35.changedMin,4);assert.equal(p.l35.maintainedMin,4);
 assert.equal(p.l4.raters.length,3);
 assert.equal(p.l4.allowedWeakControlsMisratedExpertByAtLeast2of3Raters,0);
});
function sample(){
 const row=frozen.find(x=>x.request.input.id==='pilot-52');if(!row)return null;
 const e=createV3IndependentDevelopmentRequest(row),packet=createV42CompactDevelopmentPacket(e);
 const opponents=[0,1,3].map(seat=>({
  seat:String(seat),importance:'potentially_relevant',
  analysis:'[[opponent:seat'+seat+':pointGapFromOwn]]という点差と[[opponent:seat'+seat+':meldCount]]という公開進行を区別する。',
  tradeoff:'[[opponent:seat'+seat+':riichi]]と[[candidate:a37-1:kind]]の攻撃と撤退自由度を比べる。',
  changeCondition:'もし[[opponent:seat'+seat+':riichi]]の観測が変わる場合、押し引きの方針を再考する。'
 }));
 const ans={version:V42_COMPACT_RESPONSE,requestHash:packet.requestHash,
  recommendation:{key:'a37-1',afterCallDiscard:null},
  alternative:{key:'a0-0',afterCallDiscard:null},
  tactics:{
   comparison:'[[candidate:a37-1:kind]]と[[candidate:a0-0:kind]]は[[candidate:a37-1:shanten]]で一致する一方、[[candidate:a37-1:ronSummary]]と[[candidate:a0-0:ronSummary]]で和了役を比較する。',
   opponents,
   bottomLine:'[[candidate:a37-1:kind]]の和了可能性と防御制約を考える。',
   reversal:'もし[[opponent:seat1:meldCount]]が変わる場合、選択の条件を見直す。',
   lesson:'判断モデル：GPT-6。ただしモデル名は未検証で、戦術能力の証拠にはしない。'
  }};
 return {packet,ans};
}
test('v42 Stage1 reads mobile copy-normalized JSON, string seat and model name without lifting strategic fact constraints',()=>{
 const f=sample();if(!f)return;
 const raw=JSON.stringify(f.ans).replace(/"/g,'“')
  .replace(/\[\[/g,'\\[\\[').replace(/\]\]/g,'\\]\\]');
 const out=assessV42FirstRealStage1(frozen,'pilot-52',raw,{provider:'unverified',modelDisplay:'unverified',independentTemporaryChat:true});
 assert.equal(out.verdict,'CONTRACT_AND_PUBLIC_FACT_GATE_PASS');
 assert.equal(out.output.caseId,'pilot-52');
 assert.equal(out.output.experimentalModelChoice.isProductionRecommendation,false);
 assert.equal(out.rawReplyPreserved,raw);
 assert.equal(out.transportMode,'logged_copy_only_normalization');
 assert.equal(out.transportOnlyCorrections.length,2);
 assert.equal(summarizeV42Stage1Receipts([out]).canExpand,false);
});
test('v42 invalid unanchored scores still trigger permanent first fatal, no out-of-order promotion',()=>{
 const f=sample();if(!f)return;
 const a=structuredClone(f.ans);a.tactics.lesson+=' 3900点放銃しても良い。';
 const out=assessV42FirstRealStage1(frozen,'pilot-52',JSON.stringify(a),{});
 assert.equal(out.verdict,'STAGE1_NO_GO_INVALID_PUBLIC_CONTRACT');
 assert.equal(summarizeV42Stage1Receipts([out]).verdict,'PREDECLARED_PHASE_NO_GO_AFTER_FIRST_FATAL');
 assert.throws(()=>summarizeV42Stage1Receipts([{caseId:'pilot-47',verdict:'CONTRACT_AND_PUBLIC_FACT_GATE_PASS'}]),/preregistered order/);
});
