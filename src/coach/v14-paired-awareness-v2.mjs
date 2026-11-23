// Paired P2a-v2 LEGAL PUBLIC-EVENT sensitivity diagnostic.
// Stage1 responses are checked separately against their *own* public inputs.
// Reference-only Mortal behavior is never supplied to either independent model.
// Recognizing the changed riichi event is a factual/attention measure,
// NOT evidence the chosen action or explanation is strategically optimal.
import {createHash} from 'node:crypto';
import {verifyPairedPackages} from './v14-paired-contrast-v2.mjs';
import {verifyV2IndependentDevelopmentAnswer} from './v14-independent-request-v2.mjs';
import {createV2IndependentDevelopmentRequest} from './v14-independent-request-v2.mjs';

const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const fail=s=>{throw Error('paired-awareness-v2: '+s);};
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===keys.slice().sort().join('|');
export const PAIR_AWARENESS_VERSION='p2a-v2-public-riichi-pair-awareness-1';

export function evaluatePairedStage1Awareness(frozenStage1, lineage, referenceOnly, responseRecords){
 const verified=verifyPairedPackages(frozenStage1,lineage,referenceOnly);
 if(!Array.isArray(responseRecords))fail('response records must be supplied independently');
 const original=new Map(frozenStage1.map(e=>[e.request.input.id,e]));
 const answers=new Map();
 for(const item of responseRecords){
  if(!exact(item,['id','requestHash','answer'])||typeof item.id!=='string'||
     !original.has(item.id)||answers.has(item.id))fail('unknown, duplicate or unbound model case');
  const frozen=original.get(item.id);
  const expected=createV2IndependentDevelopmentRequest(frozen);
  if(item.requestHash!==expected.requestHash)fail('answer v2 request hash does not match this original public case');
  const valid=verifyV2IndependentDevelopmentAnswer(expected,item.answer);
  if(valid.calculationProof.deterministicGate!=='pass')fail('model case lacks deterministic proof');
  answers.set(item.id,{packet:expected,answer:item.answer,group:expected.request.input.actions.find(a=>a.key===item.answer.evidenceProof.recommendation)?.group});
 }
 const rows=verified.rows.map(pair=>{
  const a=answers.get(pair.caseA),b=answers.get(pair.caseB);
  const both=Boolean(a&&b);
  function seen(o,expectRiichi){
   if(!o)return null;
   const proof=o.answer.evidenceProof;
   const observed=proof.opponentObservations.filter(x=>x.seat===pair.seat&&x.field==='riichi');
   return observed.length===1&&observed[0].value===expectRiichi;
  }
  const ackA=seen(a,true),ackB=seen(b,false),aware=both&&ackA===true&&ackB===true;
  const groupA=a?.group??null,groupB=b?.group??null;
  return {
   pair:pair.pair,caseA:pair.caseA,caseB:pair.caseB,
   sourceHashes:[pair.requestHashA,pair.requestHashB],
   changedOpponent:pair.seat,intervention:pair.package,
   bothModelResponsesPresent:both,
   recognizedRiichiOn:ackA,recognizedRiichiOff:ackB,
   changedPublicFactorExplicitlyGrounded:aware,
   chosenGroupA:groupA,chosenGroupB:groupB,
   chosenGroupChanged:both?groupA!==groupB:null,
   mortalGroupChanged:pair.reference.changed,
   modelMatchesMortalChangePattern:both?(groupA!==groupB)===pair.reference.changed:null,
   bothGroupsMatchMortal:both&&groupA===pair.reference.bestA&&groupB===pair.reference.bestB,
   explanationSemantics:'not_certified',
   responseChangeIsRequired:'NO, public change need not change the rational action',
   frozenSameHandAndLegalActions:true,
   modelPerformance:'cannot_be_derived_from_legal_fact_awareness_alone'
  };
 });
 const available=rows.filter(x=>x.bothModelResponsesPresent);
 const changed=rows.filter(x=>x.mortalGroupChanged),same=rows.filter(x=>!x.mortalGroupChanged);
 const count=xs=>xs.filter(x=>x.bothModelResponsesPresent&&x.modelMatchesMortalChangePattern).length;
 const result={
  version:PAIR_AWARENESS_VERSION,sourceInputHash:verified.frozenInputHash,
  nPairs:rows.length,availablePairedResponses:available.length,
  missingPairedResponses:rows.length-available.length,
  bothSidesExplicitRiichiGrounding:rows.filter(x=>x.changedPublicFactorExplicitlyGrounded).length,
  referenceChangedPairs:changed.length,referenceMaintainedPairs:same.length,
  matchedReferenceChangePairs:count(changed),matchedReferenceMaintainPairs:count(same),
  bothReferenceGroupsExact:rows.filter(x=>x.bothGroupsMatchMortal).length,
  rows,interpretation:{
   factualAttention:'Can independently name opposite public riichi values in both coupled scenarios',
   referenceSensitivity:'Diagnostic agreement with Mortal S42 group change and maintain behavior, not a correctness oracle',
   causalIsolation:'Not single-factor: riichi announcement is coupled with a 1000-point stick and point changes',
   modelReasoning:'NOT CERTIFIED',
   modelRepeatability:'NOT MEASURED',
   formalPerformance:'NOT CERTIFIED'
  }
 };
 return result;
}

export function validatePairedAwarenessResult(stage1,lineage,reference,modelAnswers,report){
 if(!exact(report,['version','sourceInputHash','nPairs','availablePairedResponses','missingPairedResponses','bothSidesExplicitRiichiGrounding','referenceChangedPairs','referenceMaintainedPairs','matchedReferenceChangePairs','matchedReferenceMaintainPairs','bothReferenceGroupsExact','rows','interpretation']))fail('invalid report shape');
 const expected=evaluatePairedStage1Awareness(stage1,lineage,reference,modelAnswers);
 if(hash(report)!==hash(expected))fail('tampered paired diagnostic');
 return {pairedFactAudit:'pass',strategy:'unproven',intervention:'coupled_riichi_plus_deposit'};
}
