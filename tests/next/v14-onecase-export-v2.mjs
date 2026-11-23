// Development-only, one public decision per independent request.
// Exporting a file is NOT an LLM call. No oracle/lineage/Mortal reference,
// paired-condition labels, model claim or hidden hand enters this bundle.
import {createHash} from 'node:crypto';
import {createV2IndependentDevelopmentRequest} from '../../src/coach/v14-independent-request-v2.mjs';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fail=s=>{throw Error('onecase-export-v2: '+s);};
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join('|')===keys.slice().sort().join('|');
export const ONECASE_EXPORT_VERSION='p2a-v2-one-case-independent-transport-1';
export function makeOneCaseExport(frozen){
 if(!Array.isArray(frozen)||frozen.length===0)fail('empty source');
 const ids=new Set(),messages=[];
 for(const f of frozen){
  const p=createV2IndependentDevelopmentRequest(f),id=p.request.input.id;
  if(!/^pilot-[0-9]{2}$/.test(id)||ids.has(id))fail('invalid or duplicate case id');
  ids.add(id);
  if(Object.hasOwn(p.request,'reference')||Object.hasOwn(p.request,'oracle')||
     Object.hasOwn(p.request,'answer')||Object.hasOwn(p.request,'evaluation')||
     Object.hasOwn(p.request,'userAction'))fail('forbidden source in independent request');
  // A single chat should receive exactly one message object. Do not batch five
  // independent decisions in one LLM context.
  messages.push({version:ONECASE_EXPORT_VERSION,caseId:id,requestHash:p.requestHash,
   role:'user',request:p.request,answerTemplate:{
    id,requestHash:p.requestHash,answer:'REPLACE_WITH_ONE_JSON_OBJECT_PER_CASE'},
   instructions:'One independent public case in a new isolated session. Return exactly one answer envelope; no prior conversation, Mortal values, opponents hidden hands or next case. Model version and execution parameters must be logged separately.',
   formalAssessment:'not_authorized_development_only'});
 }
 const manifest={version:ONECASE_EXPORT_VERSION,kind:'development_public_only',
  n:messages.length,sourceBundleHash:hash(frozen),oneCasePerMessage:true,
  noModelExecuted:true,modelId:null,usage:null,
  manifestRows:messages.map(m=>({caseId:m.caseId,requestHash:m.requestHash,messageHash:hash(m)})),
  restrictions:['No S42 Q/teacher, no hidden hand or future result, no pilot reference lineage',
   'Old frozen pilot cases may be reused only for QA/regression, never to certify strategic skill',
   'One case must be run per new isolated model session and recorded with real metadata',
   'These exact files do not run an LLM or measure ability']};
 return {manifest,messages};
}
export function verifyOneCaseExport(frozen,exported){
 if(!exact(exported,['manifest','messages']))fail('malformed export');
 const expected=makeOneCaseExport(frozen);
 if(hash(expected)!==hash(exported))fail('export does not match audited public source');
 return {verifiedCases:expected.manifest.n,publicInputOnly:true,actualModelCalls:0,
  inferredMahjongSkill:'none',mayEnterFormalExam:false};
}
