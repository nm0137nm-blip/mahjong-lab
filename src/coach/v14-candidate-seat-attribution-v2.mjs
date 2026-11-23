// Development-only evaluator v2, MEASURABLE LEVEL 2:
// Verifies that a candidate-specific, opponent-specific tradeoff is *actually*
// cited for the recommended-vs-alternative choice, not merely that citations
// appear somewhere. Does not score explanatory prose or tactical correctness.
import {createHash} from 'node:crypto';
import {verifyV2IndependentDevelopmentAnswer} from './v14-independent-request-v2.mjs';
import {buildTradeoffWitness,verifyTradeoffWitness} from './v14-public-tradeoff-witness-v2.mjs';
export const ATTRIBUTION_VERSION='p2a-v2-candidate-seat-factual-attribution-1';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fail=s=>{throw Error('factual-attribution-v2: '+s);};
const exact=(x,k)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join('|')===k.slice().sort().join('|');
function recommendationSide(w,proof){
 if(w.genbutsuAction===proof.recommendation&&w.otherAction===proof.alternative)
  return 'recommended_genbutsu_with_shape_sacrifice';
 if(w.genbutsuAction===proof.alternative&&w.otherAction===proof.recommendation)
  return 'alternative_genbutsu_with_shape_sacrifice';
 fail('tradeoff witness unrelated to recommended-vs-alternative action pair');
}
export function attachCandidateSeatTradeoff(envelope,answer,witness){
 // The answer must first pass independent structural/citation/typed-fact QA.
 verifyV2IndependentDevelopmentAnswer(envelope,answer);
 verifyTradeoffWitness(envelope,witness);
 const side=recommendationSide(witness,answer.evidenceProof);
 const seat=witness.seat,proof=answer.evidenceProof;
 if(!answer.importantSeats.some(x=>x.seat===seat)||
    !proof.opponentObservations.some(x=>x.seat===seat&&x.assessment==='potentially_relevant'))fail('witness seat not linked to a potentially relevant opponent');
 const metric=proof.comparisons.find(x=>x.metric===witness.metric);
 if(!metric)fail('witness numeric tradeoff is not cited in the actual answer');
 const safeIsRec=side==='recommended_genbutsu_with_shape_sacrifice';
 const safeCalc=safeIsRec?metric.recommended:metric.alternative;
 const otherCalc=safeIsRec?metric.alternative:metric.recommended;
 if(safeCalc!==witness.genbutsuValue||otherCalc!==witness.otherValue)fail('witness fact does not match answer candidate comparison');
 return {
  version:ATTRIBUTION_VERSION,requestHash:envelope.requestHash,
  answerHash:hash(answer),witnessHash:hash(witness),
  seat,recommendation:proof.recommendation,alternative:proof.alternative,
  metric:witness.metric,genbutsuSide:side,
  safeValue:witness.genbutsuValue,nonGenbutsuValue:witness.otherValue,
  seatScopedMeaning:'only this opponent cannot ron the genbutsu action',
  factualTradeoff:'verified',
  semanticExplanation:'not_certified',
  actualSeatCausality:'not_certified',
  longRunUtility:'not_measured',
  purpose:'factual_claim_coverage_development_only'
 };
}
export function verifyCandidateSeatTradeoff(envelope,answer,witness,claim){
 if(!exact(claim,['version','requestHash','answerHash','witnessHash','seat','recommendation','alternative','metric','genbutsuSide','safeValue','nonGenbutsuValue','seatScopedMeaning','factualTradeoff','semanticExplanation','actualSeatCausality','longRunUtility','purpose']))fail('invalid linked claim schema');
 const expected=attachCandidateSeatTradeoff(envelope,answer,witness);
 if(hash(expected)!==hash(claim))fail('fabricated action/seat/cost attribution');
 return {seat:claim.seat,concreteCandidateOpponentTradeoff:'verified',
  semanticLanguageQuality:'not_certified',
  bestAction:'not_certified',
  riskProbability:'unknown'};
}
export function diagnoseFactualTradeoffCoverage(envelope,answer,witnesses){
 verifyV2IndependentDevelopmentAnswer(envelope,answer);
 if(!Array.isArray(witnesses))fail('invalid witnesses');
 const results=[];
 for(const w of witnesses){
  try{
   const c=attachCandidateSeatTradeoff(envelope,answer,w);
   results.push({witnessHash:c.witnessHash,seat:c.seat,metric:c.metric,genbutsuSide:c.genbutsuSide});
  }catch(error){
   if(!String(error).includes('factual-attribution-v2:'))throw error;
  }
 }
 return {
  requestHash:envelope.requestHash,
  candidateSeatFactualLinks:results.length,
  linkedOpponents:[...new Set(results.map(x=>x.seat))].sort(),
  links:results,
  answerProseSemantics:'unmeasured',
  tacticalChoiceTruth:'unmeasured',
  coverageInterpretation:'Number of supportable specific tradeoffs, NOT explanation quality',
  noLinksIsFailureOfEvidenceNotProofOfWrongPlay:true
 };
}
