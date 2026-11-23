// P2a-v4.3 prospective first-eight panel selected from public 36 only,
// BEFORE any v4.3 independent model response. Three already answered scenes
// (v4.2 pilot52/pilot47/pilot59) are replaced in the same decision strata.
// Never inspect Mortal Q, former GPT choices or hidden opponent tiles.
import {createHash} from 'node:crypto';
const hash=x=>createHash('sha256').update(x).digest('hex');
const fail=x=>{throw Error('v43-smoke: '+x);};
const SALT='p2a-v4-proposed-smoke-20261123|';
const exclusions=['pilot-48','pilot-42','pilot-50','pilot-52','pilot-47','pilot-59'];
const excluded=new Set(exclusions);
export const V43_SELECTION_VERSION='p2a-v43-prospective-unseen-source-only-1';
export const V43_FROZEN_IDS=['pilot-43','pilot-49','pilot-57','pilot-62','pilot-63','pilot-71','pilot-70','pilot-67'];
const sortids=(a,b)=>hash(SALT+a).localeCompare(hash(SALT+b));
const board=row=>row.request.input.evidence.find(x=>x.id==='board')?.value;
export function selectV43ProspectiveSmoke(frozen){
 if(!Array.isArray(frozen)||frozen.length!==36||new Set(frozen.map(x=>x.request?.input?.id)).size!==36)
  fail('untrusted public 36 source set');
 const rows=frozen.map(row=>({row,id:row.request.input.id,b:board(row)}));
 if(rows.some(x=>!x.b))fail('missing public board');
 const reach=rows.filter(x=>!excluded.has(x.id)&&
    x.row.request.input.actions.some(a=>a.group===37)&&
    Number(x.id.slice(6))>=41&&Number(x.id.slice(6))<=52);
 const call=rows.filter(x=>!excluded.has(x.id)&&
    Number(x.id.slice(6))>=53&&Number(x.id.slice(6))<=64&&
    x.row.request.input.actions.some(a=>a.group===39||a.group===41));
 const honbaReach=reach.filter(x=>x.b.honba>0).map(x=>x.id).sort(sortids);
 const secondReach=reach.filter(x=>x.id!==honbaReach[0]).map(x=>x.id).sort(sortids);
 const honbaCall=call.filter(x=>x.b.honba>0).map(x=>x.id).sort(sortids);
 if(!honbaReach.length||!secondReach.length||!honbaCall.length)
  fail('lack 2 unseen reach or 1 unseen call with original published honba');
 const ids=[honbaReach[0],secondReach[0],honbaCall[0],
  'pilot-62','pilot-63','pilot-71','pilot-70','pilot-67'];
 if(JSON.stringify(ids)!==JSON.stringify(V43_FROZEN_IDS)||
   new Set(ids).size!==8||ids.some(id=>excluded.has(id)))
  fail('selection drift; must re-freeze under new version before any reply');
 const cases=ids.map(id=>{
  const x=rows.find(r=>r.id===id);
  if(!x)fail('missing selected case');
  return {caseId:id,sourceHash:x.row.requestHash,
   honba:x.b.honba,kyotaku:x.b.kyotaku,ownSeat:x.b.ownSeat};
 });
 if(cases.filter(x=>x.honba>0).length<3||cases.filter(x=>x.kyotaku>0).length<3)
  fail('source-only honba/kyotaku stratification regressed');
 return {
  version:V43_SELECTION_VERSION,
  originalPublicSourceHash:hash(JSON.stringify(frozen)),
  selectionMethod:'one-for-one same-stratum replacements: SHA-first unseen positive-honba reach, SHA-first second unseen reach, SHA-first unseen positive-honba call, then 5 untouched prior questions',
  salt:SALT,
  excludedPreviouslyAnswered:exclusions,
  selectedIds:ids,cases,
  originalPriorPanel:['pilot-52','pilot-47','pilot-59','pilot-62','pilot-63','pilot-71','pilot-70','pilot-67'],
  priorModelResponseUse:false,teacherS42LabelsUsed:false,
  independentModelAnswersAtFreeze:0,
  archivedOlderOutcomes:'P2a-v4 NO_GO, v4.1 NO_GO, v4.2 CLOSED 2/3 public-contract PASS, pilot59 fail, no retroactive scoring'
 };
}
