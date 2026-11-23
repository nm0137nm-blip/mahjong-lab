// P2a-v2 DEV transport for Stage2. Pinned Q is read ONLY by verifier and
// translated to legal action GROUP order; no hidden hands, Q values or model
// inner rationale are shown to an independent model.
// Fake recommendations belong to isolated tests, never to this entry point.
import {createHash} from 'node:crypto';
import {verifySingleInference} from './v14-inference-record-v2.mjs';
import {verifyV2IndependentDevelopmentAnswer} from './v14-independent-request-v2.mjs';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fail=s=>{throw Error('stage2-boundary-v2: '+s);};
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join('|')===keys.slice().sort().join('|');
const pinnedModel='30381bf21389e2d25d3edf48fed11bf772336ef3daeee67d1bdae7fb9dd30cb4';
const groupsFrom=(stage1,reference)=>{
 const i=stage1.request.input;
 if(!exact(reference,['caseId','requestHash','modelSHA256','q','best','origin'])||
    reference.caseId!==i.id||reference.requestHash!==stage1.requestHash||
    reference.modelSHA256!==pinnedModel||reference.origin!=='verifier_only_pinned_model'||
    !Array.isArray(reference.q)||reference.q.length!==46||
    !Number.isInteger(reference.best))fail('unverifiable pinned group ref');
 const groups=[...new Set(i.actions.map(a=>a.group))].sort((a,b)=>a-b);
 const present=reference.q.flatMap((x,k)=>x===null?[]:[k]);
 if(hash(groups)!==hash(present)||!present.every(g=>Number.isFinite(reference.q[g])))fail('reference group mask mismatch');
 const top=Math.max(...present.map(g=>reference.q[g]));
 if(reference.q[reference.best]!==top)fail('reference best not maximum');
 const ranked=groups.slice().sort((a,b)=>reference.q[b]-reference.q[a]||a-b);
 return {rankedGroups:ranked,bestGroups:ranked.filter(x=>reference.q[x]===top),modelSHA256:pinnedModel,
  scope:'Mortal S42 group ranking only, not a specific discard/chi variant or internal model rationale'};
};
export function makeStage2VerifiedDevelopmentRequest(stage1,locked,reference){
 if(stage1?.request?.stage!=='independent-v2-dev'||hash(stage1.request)!==stage1.requestHash)fail('untrusted stage1');
 const id=stage1.request.input.id,receipt=verifySingleInference(stage1,locked);
 if(receipt.caseId!==id||receipt.requestHash!==stage1.requestHash)fail('locked independent case mismatch');
 const response=locked.packet.answerEnvelope.answer;
 verifyV2IndependentDevelopmentAnswer(stage1,response);
 const referencePublic=groupsFrom(stage1,reference);
 const request={stage:'comparison-v2-dev',kind:'genuine_verifier_reference_only',
  caseId:id,stage1RequestHash:stage1.requestHash,stage1AnswerHash:receipt.answerHash,
  independent:{answer:structuredClone(response),lockedRecordHash:receipt.recordHash},
  input:structuredClone(stage1.request.input),
  reference:referencePublic,
  system:'第1段階独立回答は絶対に書換えない。Mortalはグループ順位のみで内部理由は不明。自分とMortalの違いを公開根拠に基づき説明し、仮説と計算事実を区別する。迎合や根拠なき正当化を避ける。'};
 return {request,requestHash:hash(request)};
}
export function verifyStage2AgainstPinnedOriginal(stage1,locked,reference,comparison){
 if(!exact(comparison,['request','requestHash'])||hash(comparison.request)!==comparison.requestHash)fail('stage2 transport mutated');
 const expected=makeStage2VerifiedDevelopmentRequest(stage1,locked,reference);
 if(hash(expected)!==hash(comparison))fail('stage2 reference or first-stage answer was substituted');
 return {stage2TransportIntegrity:'pass',pinnedModelGroupOnly:true,independentAnswerImmutable:true,
  sourceModelInternals:'unknown',contentSemanticQuality:'not_certified',appRelease:'not_authorized'};
}
export function storeStage2DevelopmentAnswer(stage1,locked,reference,comparison,answer){
 verifyStage2AgainstPinnedOriginal(stage1,locked,reference,comparison);
 if(!exact(answer,['text','diagnosis'])||typeof answer.text!=='string'||answer.text.trim().length<20||
    answer.text.length>12000||!exact(answer.diagnosis,['referenceInterpretation','whatCouldRefute'])||
    typeof answer.diagnosis.referenceInterpretation!=='string'||
    typeof answer.diagnosis.whatCouldRefute!=='string'||
    answer.diagnosis.referenceInterpretation.length<8||answer.diagnosis.whatCouldRefute.length<8)fail('invalid stage2 answer fields');
 const record={stage1AnswerHash:comparison.request.stage1AnswerHash,
  stage2RequestHash:comparison.requestHash,stage2Answer:structuredClone(answer),
  certification:'dev_transport_only_no_semantic_or_expert_certification'};
 return {record,recordHash:hash(record)};
}
