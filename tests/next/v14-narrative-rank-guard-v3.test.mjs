// Run against the SAME frozen development case, but numeric error appeared
// in an already-seen ChatGPT response: regression only, not blind evaluation.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createV3IndependentDevelopmentRequest} from '../../src/coach/v14-independent-request-v3.mjs';
import {auditV3NarrativeRankClaims} from '../../src/coach/v14-narrative-rank-guard-v3.mjs';
const frozen=process.env.V14_FOLLOWUP_PUBLIC?JSON.parse(fs.readFileSync(process.env.V14_FOLLOWUP_PUBLIC,'utf8')):[];
function packet(){
 const case48=frozen.find(x=>x.request.input.id==='pilot-48');
 return case48?createV3IndependentDevelopmentRequest(case48):null;
}
const answer=whyMatters=>({importantSeats:[{seat:0,whyMatters}]});
test('actual schema-v3 ChatGPT pilot-48 claim 3900 on dealer seat0 misstates 5800 resultant score',()=>{
 const p=packet();if(!p)return;
 const raw='現在21400点で自分より11400点下だが、仮の3900点放銃なら席0が27200点、自分が27000点となり順位が逆転する。';
 const r=auditV3NarrativeRankClaims(p,answer(raw));
 assert.equal(r.verdict,'KNOWN_ARITHMETIC_CONTRADICTION');
 assert.equal(r.mismatchedClaims,1);
 assert.equal(r.mismatches[0].claimedDealIn,3900);
 assert.deepEqual(r.mismatches[0].actual,{ownPoints:27000,opponentPoints:27200});
 assert.equal(r.mismatches[0].expected.ownPoints,28900);
 assert.equal(r.mismatches[0].expected.opponentPoints,25300);
 assert.equal(r.mismatches[0].expected.ownRank,1);
});
test('correct 5800 dealer deal-in claim and correctly quoted seat1, seat3 settle exactly',()=>{
 const p=packet();if(!p)return;
 const scenarios=[
 '仮の5800点放銃なら席0が27200点、自分が27000点となり逆転する。',
 '仮の3900点放銃なら席1が29100点、自分が28900点となり逆転する。',
 '仮の7700点放銃なら自分25100点、席3が28300点となる。'
 ];
 const r=auditV3NarrativeRankClaims(p,answer(scenarios.join('')));
 assert.equal(r.checkedClaims,3);
 assert.equal(r.mismatchedClaims,0);
 assert.equal(r.matchedClaims,3);
});
test('insufficient claim is unverified not silently scored correct',()=>{
 const p=packet();if(!p)return;
 const r=auditV3NarrativeRankClaims(p,answer('席0が本当に聴牌していても3900点放銃になる確率は不明。'));
 assert.equal(r.checkedClaims,0);
 assert.equal(r.mismatchedClaims,0);
 assert.notEqual(r.unparsedCount,0);
 assert.match(r.verdict,/NO_CONTRADICTION_IN_PARSED_CLAIMS_ONLY/);
});
