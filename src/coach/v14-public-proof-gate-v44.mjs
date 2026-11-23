// P2a-v4.4 versioned public proof. Keeps all v3/v4 strict arithmetic,
 // opponent observations and exact legal actions. The only new gate accepts
 // source-proved candidate-specific shape witnesses when v3 aggregates tie.
import {verifyV3PublicContrast} from './v14-evidence-proof-v3.mjs';
import {createV44SourceShapeContrast} from './v14-source-shape-contrast-v44.mjs';
const fail=x=>{throw Error('v44-public-proof: '+x);};
export const V44_PUBLIC_PROOF_GATE='p2a-v44-source-complete-public-proof-1';
export function verifyV44StrictPublicProof(envelope,proof){
 const old=verifyV3PublicContrast(envelope,proof);
 const evidence=envelope.request.input.evidence;
 const board=evidence.find(x=>x.id==='board')?.value;
 if(!board||![0,1,2,3].includes(board.ownSeat))
  fail('missing immutable source own seat');
 const seats=[0,1,2,3].filter(x=>x!==board.ownSeat);
 const counts=Object.fromEntries(seats.map(x=>[x,0]));
 for(const o of proof.opponentObservations){
  if(!seats.includes(o.seat))fail('unexpected opponent');
  counts[o.seat]++;
 }
 if(seats.some(x=>counts[x]<1||counts[x]>3)||
  proof.opponentObservations.length>9)
  fail('each opponent needs 1-3 exact observations');
 if(proof.comparisons.filter(x=>x.type==='actionKind').length!==1)
  fail('exactly one action-kind comparison mandatory');
 const shape=createV44SourceShapeContrast(envelope,proof.recommendation,proof.alternative);
 const distinct=old.meaningfullyDistinctPublicFacts+shape.verifiedAdditionalDifferences;
 if(distinct<1)fail('no source-proved difference in old numeric metrics, standard-form shanten, improving composition, or discarded tile');
 return {
  version:V44_PUBLIC_PROOF_GATE,
  verifiedFacts:old.candidateFactsVerified+shape.witnesses.length*2,
  verifiedOpponentFacts:old.opponentFactsVerified,
  distinctPublicFacts:distinct,
  legacyDistinctFacts:old.meaningfullyDistinctPublicFacts,
  additionalShapeDifferences:shape.verifiedAdditionalDifferences,
  additionalSourceWitnesses:shape.witnesses,
  sourceWitnessMustBeCitedByModel:old.meaningfullyDistinctPublicFacts===0,
  seatsCovered:seats,
  observationsBySeat:counts,gate:'pass',
  guaranteedByTest:'typed public fact and candidate-distinct proof only',
  notCertified:['tactical_top_choice','actual_danger','risk_probabilities','rank_utility','S42_policy_agreement','L4_quality']
 };
}
