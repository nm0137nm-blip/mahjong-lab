import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createV3IndependentDevelopmentRequest} from '../../src/coach/v14-independent-request-v3.mjs';
import {createV42CompactDevelopmentPacket,verifyAndRenderV42CompactModelResponse,V42_COMPACT_RESPONSE}
 from '../../src/coach/v14-compact-model-contract-v42.mjs';
import {parseV42ManualJSON} from '../../src/coach/v14-json-transport-v42.mjs';
import {findV42UnanchoredQuantity} from '../../src/coach/v14-numeric-guard-v42.mjs';
const frozen=process.env.V14_FOLLOWUP_PUBLIC?
 JSON.parse(fs.readFileSync(process.env.V14_FOLLOWUP_PUBLIC,'utf8')):[];
function scene(){
 const row=frozen.find(x=>x.request.input.id==='pilot-50');if(!row)return null;
 const e=createV3IndependentDevelopmentRequest(row);
 const p=createV42CompactDevelopmentPacket(e);
 const opponents=[0,1,2].map(seat=>({
  seat:String(seat),importance:'potentially_relevant',
  analysis:'[[opponent:seat'+seat+':points]]の点棒と[[opponent:seat'+seat+':meldCount]]の副露を考える。',
  tradeoff:'[[opponent:seat'+seat+':riichi]]と[[candidate:a37-0:kind]]の立直の代償を比べる。',
  changeCondition:'もし[[opponent:seat'+seat+':riichi]]が変わる場合、押し引きを見直す。'
 }));
 const answer={
  version:V42_COMPACT_RESPONSE,requestHash:p.requestHash,
  recommendation:{key:'a37-0',afterCallDiscard:null},
  alternative:{key:'a1-0',afterCallDiscard:null},
  tactics:{
   comparison:'[[candidate:a37-0:kind]]と[[candidate:a1-0:kind]]を比べる。[[candidate:a37-0:shanten]]が一致する一方、[[candidate:a37-0:ronSummary]]と[[candidate:a1-0:ronSummary]]でロン経路が異なる。',
   opponents,
   bottomLine:'[[candidate:a37-0:kind]]を条件付きで選ぶ。',
   reversal:'もし[[opponent:seat1:meldCount]]から公開脅威が変わる場合、評価を見直す。',
   lesson:'判断モデル：GPT-6。自己申告によるモデル名は採点根拠にならない。'
  }};
 return {e,p,answer};
}
test('v42 accepts metadata-like GPT-6, natural 一致/一方/役名 but still blocks raw amounts',()=>{
 for(const x of ['GPT-6','判断モデル：GPT-6','GPT-5.6','一致、一方、一盃口、三色同順'])assert.equal(findV42UnanchoredQuantity(x),null,x);
 for(const x of ['3900点','三千九百点','五筒','四巡','GPT-3900点','GPT-6で3900点','GPT-5.6.123'])
  assert.notEqual(findV42UnanchoredQuantity(x),null,x);
});
test('v42 model prompt uses numeric seat example and no model-self-report instruction',()=>{
 const f=scene();if(!f)return;
 assert.equal(typeof f.p.request.responseShape.tactics.opponents[0].seat,'number');
 assert(f.p.request.system.includes('席番号seatは数値'));
 assert(f.p.request.system.includes('モデル自身の名称を戦術説明へ書かず'));
});
test('digit-only opponent seat strings interpreted without changing original answer, 3 public seats verified',()=>{
 const f=scene();if(!f)return;
 const out=verifyAndRenderV42CompactModelResponse(f.e,f.p,f.answer);
 assert.equal(out.output.caseId,'pilot-50');
 assert.equal(out.opponentSeatRepresentationNormalizedOnly,3);
 assert.deepEqual(out.output.opponents.map(x=>x.seat),[0,1,2]);
 assert.equal(out.directModelMessage.tactics.opponents[0].seat,'0');
 assert.equal(out.modelResponseAlteredForGrade,false);
 assert.equal(out.actualTacticalSkill,'not_certified_pending_independent_anonymous_blind_review');
 assert.match(out.output.comparison,/嵌張|立直/);
});
test('unknown or fractional seat strings remain prohibited',()=>{
 const f=scene();if(!f)return;
 for(const malformed of ['00','seat0','2.0','-1','3','９']){
  const x=structuredClone(f.answer);x.tactics.opponents[0].seat=malformed;
  assert.throws(()=>verifyAndRenderV42CompactModelResponse(f.e,f.p,x),/invalid importance or duplicate seat/);
 }
});
test('strict JSON first; limited logged quote, fact-bracket or full fenced transport only, never alteration of action choices',()=>{
 const f=scene();if(!f)return;
 const strict=JSON.stringify(f.answer);
 const a=parseV42ManualJSON(strict);
 assert.equal(a.parseMode,'strict_json');assert.deepEqual(a.methods,[]);
 let curved=strict.replace(/"/g,'“').replace(/\[\[/g,'\\[\\[').replace(/\]\]/g,'\\]\\]');
 const b=parseV42ManualJSON(curved);
 assert.equal(b.parseMode,'logged_copy_only_normalization');
 assert.deepEqual(b.value,f.answer);
 assert(b.methods.includes('curly_quotes_to_ascii_json_quotation_marks'));
 assert(b.methods.includes('escaped_fact_bracket_transport_only'));
 assert.equal(b.rawPreserved,curved);
 const fence=String.fromCharCode(96).repeat(3);
 const c=parseV42ManualJSON(fence+'json\n'+strict+'\n'+fence);
 assert.deepEqual(c.value,f.answer);
 const broken=strict.replace('"a37-0"','"nonexistent"');
 const d=parseV42ManualJSON(broken);
 assert.equal(d.value.recommendation.key,'nonexistent');
 assert.throws(()=>verifyAndRenderV42CompactModelResponse(f.e,f.p,d.value),/unknown action/);
 assert.throws(()=>parseV42ManualJSON(strict.slice(0,-4)+'garbage'),/invalid unmodified JSON/);
});
