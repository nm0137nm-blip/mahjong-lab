// Frozen after source-only selection and audits, before any model answers.
import {createHash} from 'node:crypto';
import {createV3IndependentDevelopmentRequest} from './v14-independent-request-v3.mjs';
import {createV46CompactDevelopmentPacket,verifyAndRenderV46CompactModelResponse} from './v14-compact-model-contract-v46.mjs';
export const IDS=Object.freeze(["pilot-81","pilot-82","pilot-83","pilot-84","pilot-85","pilot-86","pilot-87","pilot-88"]);
export const HASHES=Object.freeze(["5aa6e8a6549327524d31f477cbc4d6b30e6e12c354f75d883966c1afacb434b2","1f91d400019f7b859f9af960bb5020842598f6568edef5d814a439b7ecceda7d","75885c1da5079b588cc0cb83eca681d3fb6f815e94b74654d981167d6847742b","2b2190a1382193c2b6a1095c197d51286728bf62387f237f90aa586f29ee7184","520072930ac2555276ad7a58f37e0f66d8505655af471fed61494ce36f74be37","02dd3ad054dbe69c04e1d857e22e898c30dd63bfef42de6349f27dbe86708069","7e871befcdb1e6e041f37749b634fb3228af21e2b22556c7e60fd1d7a492acf8","f0fb658cb59c382f05ccf6bbe159389b3a5e1ec08ac899f0d8e8621139f0c867"]);
export const SOURCE_SHA='529102d7db69fca9bef26d04adee2240a3b3cd20d6085238133b8934beda310c';
export const PLAN='p2a-v46-frozen-eight-natural-1';
const h=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const fail=x=>{throw Error('v46-receipt: '+x)};
export function assertFrozenV46Source(source){
 if(!Array.isArray(source)||source.length!==8||h(source)!==SOURCE_SHA||
   source.some((s,i)=>s.request.input.id!==IDS[i]||h(s.request)!==s.requestHash))fail('frozen source mismatch');
 return source.map((s,i)=>{
  const envelope=createV3IndependentDevelopmentRequest(s),packet=createV46CompactDevelopmentPacket(envelope);
  if(packet.requestHash!==HASHES[i]||h(packet.request)!==HASHES[i])fail('frozen packet mismatch');
  return {envelope,packet};
 });
}
export function assessV46FirstRealStage1(source,caseId,raw,metadata={}){
 if(!IDS.includes(caseId)||typeof raw!=='string')fail('case or raw missing');
 const i=IDS.indexOf(caseId),{envelope,packet}=assertFrozenV46Source(source)[i];
 const r={phase:PLAN,caseId,orderedIndex:i,packetHash:packet.requestHash,rawReplySha256:h(raw),
  originMetadata:metadata,actualIndependentModelAttemptCount:1,rawReplyPreserved:raw,semanticGrade:'NOT_ASSESSED_BY_MACHINE',noAutomaticRepair:true};
 let a;
 try{a=JSON.parse(raw);}catch(e){return {...r,verdict:'STAGE1_NO_GO_INVALID_JSON',failure:String(e)};}
 try{
  const v=verifyAndRenderV46CompactModelResponse(envelope,packet,a);
  return {...r,verdict:'CONTRACT_AND_PUBLIC_FACT_GATE_PASS',mostImportantOpponent:v.mostImportantOpponent,
   modelProposal:v.output.experimentalModelChoice,output:v.output,transportMode:'strict_json',
   actualTacticalSkill:'NOT_CERTIFIED'};
 }catch(e){return {...r,verdict:'STAGE1_NO_GO_INVALID_PUBLIC_CONTRACT',failure:String(e)};}
}
export function summarizeV46Stage1Receipts(records){
 if(!Array.isArray(records)||records.length>8||records.some((r,i)=>r.caseId!==IDS[i]||r.packetHash!==HASHES[i]))fail('invalid order');
 const failed=records.filter(r=>r.verdict!=='CONTRACT_AND_PUBLIC_FACT_GATE_PASS').length;
 if(records.slice(0,-1).some(r=>r.verdict!=='CONTRACT_AND_PUBLIC_FACT_GATE_PASS'))fail('attempt after first fatal');
 return {phase:PLAN,planned:8,attempted:records.length,passed:records.length-failed,failed,missing:8-records.length,
  canExpand:!failed&&records.length===8,verdict:failed?'NO_GO_FIRST_FATAL':records.length===8?'STAGE1_PASS_ONLY':'INCOMPLETE',semanticCertification:false};
}
