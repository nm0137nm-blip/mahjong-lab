// Development-only provenance for one-case/one-session LLM runs.
// A JSON hash detects mutation; it never authenticates a human's claim about a
// provider/model. Manual ChatGPT sessions cannot be elevated to attested API runs.
import {createHash} from 'node:crypto';
import {verifyV3IndependentDevelopmentAnswer} from './v14-independent-request-v3.mjs';
export const INFERENCE_RECORD_VERSION='p2a-v3-single-case-record-1';
export const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const err=s=>{throw Error('inference-record: '+s);};
const keys=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===k.slice().sort().join('|');
const nonempty=x=>typeof x==='string'&&x.length>0&&x.length<512;
const iso=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(x);
export function sealSingleInference(envelope,answerEnvelope,meta){
 if(!keys(envelope,['request','requestHash'])||envelope.request?.stage!=='independent-v3-dev'||
    sha(envelope.request)!==envelope.requestHash)err('invalid immutable input');
 const id=envelope.request.input?.id;
 if(!nonempty(id)||!keys(answerEnvelope,['id','requestHash','answer'])||
    answerEnvelope.id!==id||answerEnvelope.requestHash!==envelope.requestHash||
    !answerEnvelope.answer||typeof answerEnvelope.answer!=='object')err('answer is not bound to this case');
 if(!keys(meta,['sessionId','transport','provider','modelId','modelVersion','effort','temperature','seed','startedAt','endedAt','providerRequestId','sourceAssertion','usage'])||
    !nonempty(meta.sessionId)||!['manual_chat','api'].includes(meta.transport)||
    !nonempty(meta.provider)||!nonempty(meta.modelId)||
    !(meta.modelVersion===null||nonempty(meta.modelVersion))||
    !(meta.effort===null||nonempty(meta.effort))||
    !(meta.temperature===null||typeof meta.temperature==='number'&&Number.isFinite(meta.temperature))||
    !(meta.seed===null||Number.isSafeInteger(meta.seed))||
    !(meta.providerRequestId===null||nonempty(meta.providerRequestId))||
    !['user_reported','provider_metadata'].includes(meta.sourceAssertion)||
    (meta.transport==='manual_chat'&&meta.sourceAssertion==='provider_metadata')||
    !(meta.usage===null||keys(meta.usage,['inputTokens','outputTokens','billedCostCurrency','billedCost'])&&
      Number.isSafeInteger(meta.usage.inputTokens)&&meta.usage.inputTokens>=0&&
      Number.isSafeInteger(meta.usage.outputTokens)&&meta.usage.outputTokens>=0&&
      (meta.usage.billedCostCurrency===null||nonempty(meta.usage.billedCostCurrency))&&
      (meta.usage.billedCost===null||typeof meta.usage.billedCost==='number'&&Number.isFinite(meta.usage.billedCost)&&meta.usage.billedCost>=0)))err('incomplete or unverifiable execution metadata');
 verifyV3IndependentDevelopmentAnswer(envelope,answerEnvelope.answer);
 if(!iso(meta.startedAt)||!iso(meta.endedAt))err('timestamps must be offset-aware ISO strings');
 const ms=Date.parse(meta.endedAt)-Date.parse(meta.startedAt);
 if(ms<0||ms>86400000)err('negative or implausibly long execution interval');
 const packet={
  version:INFERENCE_RECORD_VERSION,caseId:id,requestHash:envelope.requestHash,
  answerHash:sha(answerEnvelope),
  answerEnvelope:structuredClone(answerEnvelope),
  meta:structuredClone(meta),
  elapsedMs:ms,
  attestation:meta.sourceAssertion==='user_reported'?
   'user_reported_not_independently_authenticated':
   'provider_metadata_as_submitted_not_cryptographically_attested',
  gate:'dev_metadata_only_no_model_tactical_certification'
 };
 return {packet,packetHash:sha(packet)};
}
export function verifySingleInference(envelope,locked){
 if(!keys(locked,['packet','packetHash'])||sha(locked.packet)!==locked.packetHash)err('tampered record');
 const rebuilt=sealSingleInference(envelope,locked.packet.answerEnvelope,locked.packet.meta);
 if(rebuilt.packetHash!==locked.packetHash)err('record provenance mismatch');
 return {caseId:locked.packet.caseId,recordHash:locked.packetHash,requestHash:locked.packet.requestHash,
  answerHash:locked.packet.answerHash,attestation:locked.packet.attestation,elapsedMs:locked.packet.elapsedMs,
  gate:locked.packet.gate};
}
export function auditBatchSingleInference(envelopes,records,{strict=true}={}){
 if(!Array.isArray(envelopes)||!envelopes.length||!Array.isArray(records))err('invalid batch');
 const expected=new Map(envelopes.map(e=>[e.request?.input?.id,e]));
 if(expected.size!==envelopes.length)err('duplicate input case');
 const seen=new Set(),sessions=new Set(),providerIds=new Set(),out=[];
 for(const l of records){
  const id=l?.packet?.caseId;
  if(seen.has(id)||!expected.has(id))err('duplicate or unknown case');
  seen.add(id);
  const verified=verifySingleInference(expected.get(id),l),meta=l.packet.meta;
  if(sessions.has(meta.sessionId))err('reused session ID: per-case independence violated');
  sessions.add(meta.sessionId);
  if(meta.providerRequestId!==null){
   if(providerIds.has(meta.providerRequestId))err('reused provider request ID');
   providerIds.add(meta.providerRequestId);
  }
  out.push(verified);
 }
 const missing=[...expected.keys()].filter(id=>!seen.has(id));
 if(strict&&missing.length)err('missing cases');
 return {version:INFERENCE_RECORD_VERSION,expected:envelopes.length,received:records.length,missing,
  allOneCasePerSession:out.length===sessions.size,
  allExecutionFieldsRecorded:out.length===records.length,
  allProviderClaimsAuthenticated:false, // No signed provider assertion is present.
  stage2Run:false,independentTacticalGrade:'not_measured',
  items:out};
}
