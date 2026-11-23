// Draft preregistration helper; no ChatGPT, Mortal, or user answers queried.
// The final v4 protocol is NOT frozen yet. This deterministic selector only
// fixes a prospective 8-case diagnostic panel from a frozen public set.
import {createHash} from 'node:crypto';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const h=x=>createHash('sha256').update(x).digest('hex');
const fail=s=>{throw Error('v4-smoke: '+s);};
export const V4_SMOKE_DRAFT='p2a-v4-prospective-8-case-selection-1';
const salt='p2a-v4-proposed-smoke-20261123|';
const score=id=>h(salt+id);
export function selectV4ProspectiveSmoke(frozen){
 if(!Array.isArray(frozen)||frozen.length!==36)fail('36 source public cases required');
 const ids=frozen.map(x=>x.request?.input?.id);
 if(new Set(ids).size!==36||ids.some((id,j)=>id!=='pilot-'+String(j+41)))
  fail('frozen input order, IDs or count changed');
 if(frozen.some(x=>x.request?.stage!=='independent'||hash(x.request)!==x.requestHash))
  fail('source public hash mismatch');
 const select=(arr,count)=>{
  const ranked=arr.map(x=>x.request.input.id)
   .sort((a,b)=>score(a).localeCompare(score(b)));
  // Reserve a nonzero-honba case in EACH action family. Without this
  // public-only stratification the draft hash-only selection had 0/8 honba
  // and would not exercise the accounting defects found in v3.
  const source=id=>arr.find(x=>x.request.input.id===id);
  const honba=ranked.find(id=>source(id).request.input.evidence.find(x=>x.id==='board')?.value.honba>0);
  if(!honba)fail('no positive-honba case for family');
  return [honba,...ranked.filter(id=>id!==honba).slice(0,count-1)];
 };
 const reach=frozen.slice(0,12).filter(x=>x.request.input.id!=='pilot-48');
 const react=frozen.slice(12,24).filter(x=>x.request.input.id!=='pilot-63');
 const discard=frozen.slice(24,36);
 for(const x of reach)if(!x.request.input.actions.some(a=>a.group===37))fail('reach group missing');
 for(const x of react)if(!x.request.input.actions.some(a=>a.group===45))fail('reaction group missing');
 for(const x of discard)if(x.request.input.actions.some(a=>a.group>=37))fail('discard group inconsistent');
 const ron=frozen.find(x=>x.request.input.id==='pilot-63');
 if(!ron?.request.input.actions.some(a=>a.group===43))
  fail('no frozen true ron endpoint');
 const categories={
  reach:select(reach,2),
  callOrPass:select(react,2),
  ron:['pilot-63'],
  discard:select(discard,3)
 };
 const selectedIds=Object.values(categories).flat();
 if(selectedIds.length!==8||new Set(selectedIds).size!==8||
    selectedIds.includes('pilot-48'))fail('duplicate or contaminated pilot48');
 const rows=selectedIds.map(caseId=>{
  const e=frozen.find(x=>x.request.input.id===caseId);
  const b=e.request.input.evidence.find(x=>x.id==='board')?.value;
  if(!b)fail('no public board');
  return {caseId,publicPacketHash:e.requestHash,round:b.round,
   honba:b.honba,kyotaku:b.kyotaku,ownSeat:b.ownSeat,
   priorChatGPTAnswersInThisTrial:0,
   status:'NOT_YET_RUN'};
 });
 if(rows.filter(x=>x.honba>0).length<3||rows.every(x=>x.kyotaku===0))
  fail('publicly stratified honba/kyotaku coverage absent');
 return {
  version:V4_SMOKE_DRAFT,stage:'prospective_development_pilot_not_formally_heldout',
  basedOnFrozenPublicSetHash:hash(frozen),
  previouslyAnsweredExcluded:['pilot-48'],
  selection:'public-honba-positive per reach/interact/discard family; SHA256 ID order within strata; no S42 or model answers',
  categories,selectedIds,cases:rows,
  positiveHonbaCaseCount:rows.filter(x=>x.honba>0).length,
  kyotakuPresentCaseCount:rows.filter(x=>x.kyotaku>0).length,
  stage1DiagnosticTarget:8,
  followupConditions:'freeze full protocol and validated source events before any manual LLM session',
  abortExpansionOn:'any major known numeric falsehood, illegal choice, fabricated hidden state or unsupported anchor',
  doNotAutomaticallyFinishEightAfterFailure:true,
  secondRoundStatus:'NOT_PLANNED_UNTIL_SEPARATE_PRE_REGISTRATION',
  actualNewModelCalls:0,
  reviewerClaimsUnseen:'not provider-authenticated; no known ChatGPT response for the chosen eight',
  unknown:'No teacher labels or true tactical quality have been used for selecting cases'
 };
}
