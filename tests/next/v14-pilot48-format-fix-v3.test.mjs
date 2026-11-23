import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createV3IndependentDevelopmentRequest,verifyV3IndependentDevelopmentAnswer,makeV3SyntheticAnswer} from '../../src/coach/v14-independent-request-v3.mjs';
import {createV3PublicContrastFixture,verifyV3PublicContrast} from '../../src/coach/v14-evidence-proof-v3.mjs';
import {renderV3PublicScene} from '../../src/coach/v14-human-public-preview-v3.mjs';
const cases=process.env.V14_FOLLOWUP_PUBLIC?JSON.parse(fs.readFileSync(process.env.V14_FOLLOWUP_PUBLIC,'utf8')):[];
const clone=x=>structuredClone(x);
function get(i,key){return i.evidence.find(x=>x.id===key)?.value;}
function check42(){
 const source=cases.find(x=>x.request.input.id==='pilot-48');
 const p=createV3IndependentDevelopmentRequest(source),i=p.request.input;
 const recommendation={key:'a37-1',afterCallDiscard:null},alternative={key:'a13-0',afterCallDiscard:null};
 const proof=createV3PublicContrastFixture(p,recommendation,alternative);
 // Crucial: riichi with p5 gets a different conditional scoring mode
 // from an otherwise identical silent p5 discard. These scores existed
 // in the public input before the ChatGPT trial and are NOT model labels.
 const score=(key,tile,mode)=>{
  const f=get(i,'calc-'+key).conditionalNormalWins.find(x=>x.tile===tile)?.[mode];
  return f?{status:'conditionally_scored',basePoints:f.basePoints,yaku:[...f.yaku]}:
   {status:'no_scored_win_under_assumptions'};
 };
 for(const tile of ['m6','m9']){
  const a=score('a37-1',tile,'hypotheticalRiichiRon'),b=score('a13-0',tile,'ron');
  proof.comparisons.push({type:'conditionalRonByChoice',tile,
   recommendedMode:'hypotheticalRiichiRon',alternativeMode:'ron',
   recommended:a,alternative:b,relation:JSON.stringify(a)===JSON.stringify(b)?'same':'different'});
 }
 const field=(seat,k,assessment)=>({seat,field:k,value:get(i,'public-value-'+seat)[k],assessment});
 proof.opponentObservations=[
  field(0,'meldCount','potentially_relevant'),field(0,'exposedYakuhaiHan','potentially_relevant'),
  field(1,'points','potentially_relevant'),field(3,'riichi','not_established')];
 const answer=makeV3SyntheticAnswer(p,proof);
 answer.importantSeats=[
  {seat:0,whyMatters:'副露と確実に見えている役牌を区別し、聴牌かどうかは断定しない。',
   changeCondition:'現物以外を切ることが重大だと判断できた場合はダマで守備の自由を残す。'},
  {seat:1,whyMatters:'点差を公開点棒から確認できるが、今後の聴牌速度は推測にとどまる。',
   changeCondition:'この相手が押してきた場合は放銃回避の価値を改めて見積もる。'}];
 answer.uncertainSeats=[{seat:3,reason:'立直なしでも安全とは断定できず、相手の手の内は未確認である。'}];
 return {p,proof,answer};
}
test('pilot-48 case-specific same-tile reach/dama m6/m9 exact yaku and 4 public fields across 3 opponents',()=>{
 if(!cases.length)return;
 const {p,proof,answer}=check42();
 const r=verifyV3IndependentDevelopmentAnswer(p,answer);
 assert.equal(r.publicFacts,'verified');
 assert.equal(r.semanticQuality,'not_certified');
 assert.equal(r.distinctVerifiableDifferences>=3,true);
 assert.equal(r.mechanicallyVerifiedFacts,6);
 assert.equal(proof.opponentObservations.length,4);
 assert.equal(proof.comparisons.find(x=>x.tile==='m6').recommended.basePoints,5200);
 assert.equal(proof.comparisons.find(x=>x.tile==='m6').alternative.basePoints,2600);
 assert.equal(proof.comparisons.find(x=>x.tile==='m9').alternative.status,'no_scored_win_under_assumptions');
});
test('tampered mode, yaku, status, repeated public seat-field, conflicting importance all fail closed',()=>{
 if(!cases.length)return;
 const {p,proof,answer}=check42();
 const muts=[
  x=>x.comparisons.find(c=>c.tile==='m6').recommendedMode='ron',
  x=>x.comparisons.find(c=>c.tile==='m6').alternativeMode='hypotheticalRiichiRon',
  x=>x.comparisons.find(c=>c.tile==='m6').recommended.yaku=['役牌'],
  x=>x.comparisons.find(c=>c.tile==='m6').recommended.status='supplied',
  x=>x.comparisons.find(c=>c.tile==='m6').alternative.basePoints=5300,
  x=>x.opponentObservations.push(clone(x.opponentObservations[0])),
  x=>x.opponentObservations[1].assessment='not_established',
  x=>x.opponentObservations[1].value=99
 ];
 for(const mutate of muts){
  const bad=clone(proof);mutate(bad);
  assert.throws(()=>verifyV3PublicContrast(p,bad),/v3-proof/);
 }
 const bad=clone(answer);
 bad.importantSeats=[{seat:0,whyMatters:'長文で具体性あるように装う根拠は未検証である。',
  changeCondition:'誤った場況の重大性が判明した場合に判断を変えるべきである。'}];
 assert.throws(()=>verifyV3IndependentDevelopmentAnswer(p,bad),/independent-v3/);
 const noReclassification=clone(answer);noReclassification.evidenceProof.opponentObservations[0].assessment='observed';
 assert.throws(()=>verifyV3IndependentDevelopmentAnswer(p,noReclassification),/v3-proof/);
});
test('old initial ChatGPT question cannot bind to newly versioned answer schema',()=>{
 if(!cases.length)return;
 const {p,answer}=check42();
 const wrong=clone(answer);wrong.version='p2a-v3-independent-public-explanation-1';
 assert.throws(()=>verifyV3IndependentDevelopmentAnswer(p,wrong),/invalid answer contract/);
 const wrong2=clone(answer);wrong2.requestHash='old_sha';
 assert.throws(()=>verifyV3IndependentDevelopmentAnswer(p,wrong2),/invalid answer contract/);
});
test('human display includes own hand, score, public rivers, viable actions but no private or future info',()=>{
 if(!cases.length)return;
 const {p}=check42(),text=renderV3PublicScene(p);
 assert(text.includes('東3局'));
 assert(text.includes('32,800点'));
 assert(text.includes('赤5筒'));
 assert(text.includes('a37-1'));
 assert(text.includes('a13-0'));
 assert(text.includes('席0'));
 assert(!text.includes('MortalのQ値'));
 assert(!text.includes('封じられた相手の手牌'));
 assert(text.length<11000,'a readable preview should be much smaller than machine JSON');
});


test('post-real-pilot correction explicitly says max nine opponent observations and stays fail-closed',()=>{
 if(!cases.length)return;
 const {p,answer}=check42();
 assert.match(p.request.system,/opponentObservationsは合計1〜9件のみ/);
 assert.match(p.request.system,/各席の観測事実は最大3件/);
 const bad=clone(answer);
 const i=p.request.input;
 const obs=bad.evidenceProof.opponentObservations;
 for(const seat of [0,1,3]){
  for(const field of ['riichi','meldCount','points','pointGapFromOwn']){
   if(!obs.some(x=>x.seat===seat&&x.field===field)){
    obs.push({seat,field,value:get(i,'public-value-'+seat)[field],
     assessment:seat===3?'not_established':'potentially_relevant'});
   }
  }
 }
 // 13 exact, nonfabricated public facts are STILL an invalid raw answer contract.
 assert(obs.length>9);
 assert.throws(()=>verifyV3IndependentDevelopmentAnswer(p,bad),/missing opponent observations/);
 // The actual original user response is never silently normalized or upgraded to a pass.
 assert.equal(verifyV3IndependentDevelopmentAnswer(p,answer).publicFacts,'verified');
});
