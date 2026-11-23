// P2a-v4 dev gate: strict, versioned overlay on v3 public-source arithmetic.
// v3 remains frozen for reproducibility; changing its pass criteria would
// retroactively alter the historical model evaluation.
import {verifyV3PublicContrast} from './v14-evidence-proof-v3.mjs';
const fail=x=>{throw Error('v4-public-proof: '+x);};
export const V4_PUBLIC_PROOF_GATE='p2a-v4-verifier-aligned-public-proof-1';
export function verifyV4StrictPublicProof(envelope,proof){
 const old=verifyV3PublicContrast(envelope,proof);
 const evidence=envelope.request.input.evidence;
 const board=evidence.find(x=>x.id==='board')?.value;
 if(!board||![0,1,2,3].includes(board.ownSeat))
  fail('missing public own seat');
 const obs=proof.opponentObservations;
 const seats=[0,1,2,3].filter(s=>s!==board.ownSeat);
 const counts=new Map(seats.map(x=>[x,0]));
 for(const x of obs){
  if(!counts.has(x.seat))fail('invalid opponent seat');
  counts.set(x.seat,counts.get(x.seat)+1);
 }
 if(seats.some(x=>counts.get(x)<1||counts.get(x)>3))
  fail('exactly three opponents must each have 1-3 observations');
 if(obs.length>9)fail('too many opponent observations');
 const actions=proof.comparisons.filter(x=>x.type==='actionKind');
 if(actions.length!==1)fail('exactly one actionKind proof is mandatory');
 if(old.meaningfullyDistinctPublicFacts<1)
  fail('must prove one public difference between recommendation and alternative');
 return {version:V4_PUBLIC_PROOF_GATE,verifiedFacts:old.candidateFactsVerified,
  verifiedOpponentFacts:old.opponentFactsVerified,
  distinctPublicFacts:old.meaningfullyDistinctPublicFacts,
  seatsCovered:seats,observationsBySeat:Object.fromEntries(counts),
  guaranteedByTest:'typed_public_fact_consistency_only',
  notCertified:['tactical_top_choice','rationale','risk_probabilities','rank_utility'],
  gate:'pass'};
}
