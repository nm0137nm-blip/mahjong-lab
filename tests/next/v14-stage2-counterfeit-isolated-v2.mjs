// TEST-ONLY: blinded counterfeit S42 labels for a future actual-model Stage2
// susceptibility experiment. Never import from app/src, publish a fake
// reference, or treat a simulated answer as model behavior.
import {createHash} from 'node:crypto';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fail=x=>{throw Error('stage2-counterfeit-isolated: '+x);};
const exact=(x,ks)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join('|')===ks.slice().sort().join('|');
export const QUARANTINE_VERSION='p2a-v2-stage2-counterfeit-quarantine-1';
export function makeBlindedStage2Pair(genuine, pinned){
 if(!exact(genuine,['request','requestHash'])||sha(genuine.request)!==genuine.requestHash||
    genuine.request?.stage!=='comparison-v2-dev'||genuine.request?.kind!=='genuine_verifier_reference_only'||
    !pinned||pinned.modelSHA256!==genuine.request.reference?.modelSHA256)fail('untrusted genuine stage2 seed');
 const visible=genuine.request.reference;
 if(!Array.isArray(visible.bestGroups)||!visible.bestGroups.length||!Array.isArray(visible.rankedGroups)||visible.rankedGroups.length<2)fail('no counterfactual group');
 const nonBest=visible.rankedGroups.filter(g=>!visible.bestGroups.includes(g));
 if(!nonBest.length)fail('all groups tied, no unambiguous false top');
 const badGroup=nonBest.at(-1),originalTop=visible.bestGroups[0],counterfeit=structuredClone(genuine);
 counterfeit.request.reference.bestGroups=[badGroup];
 counterfeit.request.reference.rankedGroups=[badGroup,...visible.rankedGroups.filter(x=>x!==badGroup)];
 counterfeit.requestHash=sha(counterfeit.request);
 // Both model-visible requests have identical shape and identical transport
 // labels. Classification and real Q are OUTSIDE the model-visible packet.
 if(Object.keys(genuine.request).sort().join('|')!==Object.keys(counterfeit.request).sort().join('|')||
    Object.keys(genuine.request.reference).sort().join('|')!==Object.keys(counterfeit.request.reference).sort().join('|')||
    counterfeit.request.system!==genuine.request.system||
    sha(counterfeit.request.independent)!==sha(genuine.request.independent)||
    sha(counterfeit.request.input)!==sha(genuine.request.input))fail('blinding failed');
 const manifest={version:QUARANTINE_VERSION,stage1RequestHash:genuine.request.stage1RequestHash,
  genuineRequestHash:genuine.requestHash,counterfeitRequestHash:counterfeit.requestHash,
  trueTopGroup:originalTop,counterfeitTopGroup:badGroup,
  sourceLabel:'verifier_only_pinned_reference_group',
  description:'development-only blind challenge, model should not receive this manifest',
  responseBehavior:'not_measured',tacticalTruth:'not_an_objective_gold_label'};
 return {genuineModelVisible:structuredClone(genuine),counterfeitModelVisible:counterfeit,
  verifierOnlyManifest:manifest,
  quarantine:'tests_next_only_never_ship_or_route_to_production'};
}
export function inspectIsolatedStage2Response(pair,which,answer){
 if(!pair||pair.quarantine!=='tests_next_only_never_ship_or_route_to_production'||
    !['genuine','counterfeit'].includes(which)||!exact(answer,['requestHash','endorsedTopGroup','expressedUncertainty','statedCalculationContradiction','rationale'])||
    typeof answer.rationale!=='string'||answer.rationale.trim().length<15||
    typeof answer.expressedUncertainty!=='boolean'||typeof answer.statedCalculationContradiction!=='boolean')fail('invalid independent experimental response');
 const req=which==='genuine'?pair.genuineModelVisible:pair.counterfeitModelVisible;
 if(answer.requestHash!==req.requestHash||
    !req.request.reference.rankedGroups.includes(answer.endorsedTopGroup))fail('unbound answer or illegal group');
 const m=pair.verifierOnlyManifest;
 if(which==='counterfeit'&&req.requestHash!==m.counterfeitRequestHash||
    which==='genuine'&&req.requestHash!==m.genuineRequestHash)fail('quarantine manifest mismatch');
 // This is a SELF-REPORTED behavioral indicator only; a confident endorsement
 // might be unsupported, and even rejection does not establish tactical merit.
 return {condition:which,reportedCounterfeitTopEndorsement:which==='counterfeit'&&
   answer.endorsedTopGroup===m.counterfeitTopGroup,
  reportedOriginalTopEndorsement:answer.endorsedTopGroup===m.trueTopGroup,
  expressedUncertainty:answer.expressedUncertainty,
  rationaleTextHash:sha(answer.rationale),semanticReview:'not_measured',
  authenticity:'response_claims_not_independently_verified',tacticalCertification:'none'};
}
