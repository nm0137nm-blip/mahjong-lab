// P2a-v4.2: deterministic second sequential replacement of an answered
// original reach case. Old pilot42 and pilot50 remain permanently seen.
import {createHash} from 'node:crypto';
import {selectV41ProspectiveSmoke} from './v14-v41-smoke-selection.mjs';
const h=s=>createHash('sha256').update(s).digest('hex');
const fail=s=>{throw Error('v42-smoke: '+s);};
export const V42_SMOKE_VERSION='p2a-v42-public-stage1-pilot50-replaced-1';
export const V42_EIGHT=['pilot-52','pilot-47','pilot-59','pilot-62',
 'pilot-63','pilot-71','pilot-70','pilot-67'];
const excluded=new Set(['pilot-48','pilot-42','pilot-50']);
const salt='p2a-v4-proposed-smoke-20261123|';
export function selectV42ProspectiveSmoke(frozen){
 const previous=selectV41ProspectiveSmoke(frozen);
 if(previous.selectedIds[0]!=='pilot-50')fail('original v41 selection drift');
 const eligible=frozen.slice(0,12).filter(x=>{
  const id=x.request.input.id;
  const board=x.request.input.evidence.find(e=>e.id==='board')?.value;
  return !excluded.has(id)&&board?.honba>0&&x.request.input.actions.some(a=>a.group===37);
 }).map(x=>x.request.input.id).sort((a,b)=>h(salt+a).localeCompare(h(salt+b)));
 const first=eligible[0];
 const ids=[first,...previous.selectedIds.slice(1)];
 if(JSON.stringify(ids)!==JSON.stringify(V42_EIGHT)||new Set(ids).size!==8||
    ids.some(id=>excluded.has(id)))
  fail('new prospective first question not source-SHA chosen');
 const cases=ids.map(caseId=>{
  const src=frozen.find(x=>x.request.input.id===caseId);
  const board=src?.request.input.evidence.find(e=>e.id==='board')?.value;
  if(!board)fail('missing board');
  return {caseId,originalRequestHash:src.requestHash,
   honba:board.honba,kyotaku:board.kyotaku,ownSeat:board.ownSeat,
   priorIndependentModelResults:0};
 });
 if(cases.filter(c=>c.honba>0).length<3||!cases.some(c=>c.kyotaku>0))
  fail('stratification lost');
 return {
  version:V42_SMOKE_VERSION,originalSourceHash:previous.sourceSetHash,
  method:'source-only same fixed SHA salt, pick next unattempted honba-positive reach after prior answered pilot42 and pilot50, keep seven other scenes unchanged',
  excludedAnswered:['pilot-48','pilot-42','pilot-50'],
  selectedIds:ids,cases,firstQuestion:first,
  priorHistoricalPhaseOutcomes:'v3 NO_GO; v4 NO_GO; v41 1 first answer contract-not-accepted; NONE regraded',
  newModelAnswerCountAtFreeze:0,firstCaseSelectedWithoutS42:true
 };
}
