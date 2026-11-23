// P2a-v4.2 separate strict Stage1 receipt; archived v4 is NOT retroactively regraded. A response with any major contract
// defect cannot be repaired and counted as the same independent test.
// Research gate only; public-number verification != tactical expertise.
import {createHash} from 'node:crypto';
import {parseV42ManualJSON} from './v14-json-transport-v42.mjs';
import {createV3IndependentDevelopmentRequest} from './v14-independent-request-v3.mjs';
import {createV42CompactDevelopmentPacket,verifyAndRenderV42CompactModelResponse}
 from './v14-compact-model-contract-v42.mjs';
import {P2A_V42_RESEARCH_PLAN as plan,P2A_V42_FIXED_EIGHT as ids,
 P2A_V42_PACKET_HASHES as hashes} from './v14-v42-evaluation-plan.mjs';
const h=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const fail=s=>{throw Error('v42-stage1-receipt: '+s);};
export function assessV42FirstRealStage1(frozen,caseId,rawText,metadata){
 if(!Array.isArray(frozen)||!ids.includes(caseId)||typeof rawText!=='string')
  fail('case not in fixed eight or missing raw answer bytes');
 const caseIndex=ids.indexOf(caseId),
  source=frozen.find(x=>x.request.input.id===caseId);
 if(!source)fail('frozen source case missing');
 const envelope=createV3IndependentDevelopmentRequest(source),
  packet=createV42CompactDevelopmentPacket(envelope);
 if(packet.requestHash!==hashes[caseIndex])fail('not the preregistered exact prompt');
 const rawReplySha256=h(rawText),receipt={
  phase:plan.version,caseId,orderedIndex:caseIndex,
  packetHash:packet.requestHash,
  rawReplySha256,
  rawReplyPreserved:rawText,
  originMetadata:{
   observedProvider:metadata?.provider??'not-recorded',
   modelDisplay:metadata?.modelDisplay??'not-recorded',
   observedLocalTimestamp:metadata?.observedLocalTimestamp??'not-recorded',
   effort:metadata?.effort??'unavailable',
   independentTemporaryChat:metadata?.independentTemporaryChat??'not-recorded',
   seed:'unavailable',
   temperature:'unavailable'
  },
  humanProviderMetadataUnverified:true,
  actualIndependentModelAttemptCount:1
 };
 let parsed;
 try{
  const transport=parseV42ManualJSON(rawText);
  parsed=transport.value;
  receipt.transportMode=transport.parseMode;
  receipt.transportOnlyCorrections=transport.methods;
 }
 catch(error){
  return {...receipt,verdict:'STAGE1_NO_GO_INVALID_JSON',
   failure:String(error),semanticGrade:'NOT_ASSESSED',
   noAutomaticRepair:true};
 }
 try{
  const validated=verifyAndRenderV42CompactModelResponse(envelope,packet,parsed);
  return {...receipt,verdict:'CONTRACT_AND_PUBLIC_FACT_GATE_PASS',
   output:validated.output,
   modelProposal:validated.output.experimentalModelChoice,
   semanticGrade:'NOT_ASSESSED_BY_MACHINE',
   independentReference:'UNKNOWN_NOT_SUPPLIED',
   missingMetadata:metadata?.provider===undefined||metadata?.modelDisplay===undefined||
    metadata?.independentTemporaryChat!==true,
   status:'Research Stage1 fact-only pass, no L4 or S42 certification'};
 }catch(error){
  return {...receipt,verdict:'STAGE1_NO_GO_INVALID_PUBLIC_CONTRACT',
   failure:String(error),
   semanticGrade:'NOT_ASSESSED',
   noAutomaticRepair:true};
 }
}
export function summarizeV42Stage1Receipts(records){
 if(!Array.isArray(records)||records.length>8)fail('invalid response count');
 const seen=new Set(),expected=ids.slice(0,records.length);
 for(const [i,r] of records.entries()){
  if(!r||!ids.includes(r.caseId)||seen.has(r.caseId)||r.caseId!==expected[i])
   fail('responses not in preregistered order or repeated');
  seen.add(r.caseId);
 }
 const failures=records.filter(x=>x.verdict!=='CONTRACT_AND_PUBLIC_FACT_GATE_PASS');
 return {
  version:plan.version,originalPlannedCases:8,actualAttempts:records.length,
  missing:8-records.length,contractPass:records.length-failures.length,
  failed:failures.length,
  fatal:failures.length>0,canExpand:records.length===8&&failures.length===0,
  verdict:failures.length?'PREDECLARED_PHASE_NO_GO_AFTER_FIRST_FATAL':
    records.length===8?'STAGE1_NUMERIC_CONTRACT_PASS_L4_AND_L35_PENDING':'INCOMPLETE_STAGE1_NOT_GO',
  noDroppingFailures:true,
  probabilityAndExpertise:'NOT_CERTIFIED'
 };
}
