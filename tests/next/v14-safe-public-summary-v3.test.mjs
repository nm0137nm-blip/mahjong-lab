// Post-observation safety regression, not unseen LLM competency validation.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createV3IndependentDevelopmentRequest,makeV3SyntheticAnswer} from '../../src/coach/v14-independent-request-v3.mjs';
import {createV3PublicContrastFixture} from '../../src/coach/v14-evidence-proof-v3.mjs';
import {renderV3ConstrainedPublicSummary} from '../../src/coach/v14-safe-public-summary-v3.mjs';
const data=process.env.V14_FOLLOWUP_PUBLIC?JSON.parse(fs.readFileSync(process.env.V14_FOLLOWUP_PUBLIC,'utf8')):[];
function sample(){
 const source=data.find(x=>x.request.input.id==='pilot-48');if(!source)return null;
 const e=createV3IndependentDevelopmentRequest(source);
 const proof=createV3PublicContrastFixture(e,{key:'a37-1',afterCallDiscard:null},{key:'a13-0',afterCallDiscard:null});
 const a=makeV3SyntheticAnswer(e,proof);
 return {e,a};
}
test('safe summary omits model false rank narrative even when valid typed proof accepts it',()=>{
 const s=sample();if(!s)return;
 s.a.importantSeats=[];
 s.a.evidenceProof.explanation='合法な事実の後に、3900点放銃なら席0が27200点、自分27000点と誤って書いている。';
 s.a.educational.lesson='3900点放銃なら席0が27200点、自分27000点になり順位が逆転すると捏造する。';
 const out=renderV3ConstrainedPublicSummary(s.e,s.a);
 assert.equal(out.verdict,'PUBLIC_FACT_SUMMARY_ONLY_NOT_COACH_CERTIFIED');
 assert.equal(out.modelProposalNotCertified,true);
 assert.equal(out.safeToShowUnverifiedFreeProse,false);
 assert.equal(out.recommended.key,'a37-1');
 const rendered=JSON.stringify(out);
 assert(!rendered.includes('27200'), 'the unsupported changed dealer points must not be carried into safe view');
 assert(!rendered.includes('27000'), 'the unsupported changed focal points must not be carried into safe view');
 assert(!rendered.includes('捏造する'));
 assert(!rendered.includes('誤って書いている'));
 assert(out.verifiedComparisons.length>=1);
 assert(out.verifiedOpponentObservations.length>=1);
});
test('fabricated structured public opponent fact cannot be rendered',()=>{
 const s=sample();if(!s)return;
 s.a.evidenceProof.opponentObservations[0].value='invented';
 assert.throws(()=>renderV3ConstrainedPublicSummary(s.e,s.a),/v3-proof/);
});
test('non-source illegal concrete recommendation cannot be rendered',()=>{
 const s=sample();if(!s)return;
 s.a.evidenceProof.recommendation.key='nonexistent';
 assert.throws(()=>renderV3ConstrainedPublicSummary(s.e,s.a),/v3-proof/);
});
test('immutable input hash mismatch cannot be rendered',()=>{
 const s=sample();if(!s)return;
 s.e.requestHash='tampered';
 assert.throws(()=>renderV3ConstrainedPublicSummary(s.e,s.a),/independent-v3/);
});
