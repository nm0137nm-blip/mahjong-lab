// P2a-v4.1 one-for-one replacement of the answered pilot-42 scene.
// This is a prospective, no-teacher public-only rule. All other seven
// unattempted v4 Stage1 cases and their order remain unchanged.
import {createHash} from 'node:crypto';
import {selectV4ProspectiveSmoke} from './v14-v4-smoke-selection.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const fail=s=>{throw Error('v41-smoke: '+s);};
export const V41_SMOKE_VERSION='p2a-v41-public-stage1-pilot42-replaced-1';
export const V41_EXPECTED_EIGHT=['pilot-50','pilot-47','pilot-59','pilot-62',
 'pilot-63','pilot-71','pilot-70','pilot-67'];
const exclusions=new Set(['pilot-48','pilot-42']);
const publicScore=id=>sha('p2a-v4-proposed-smoke-20261123|'+id);
export function selectV41ProspectiveSmoke(frozen){
 const v4=selectV4ProspectiveSmoke(frozen);
 if(v4.categories.reach[0]!=='pilot-42')
  fail('incompatible older v4 prospective panel');
 const reach=frozen.slice(0,12).filter(x=>!exclusions.has(x.request.input.id));
 const eligible=reach.filter(x=>{
  const board=x.request.input.evidence.find(y=>y.id==='board')?.value;
  return board?.honba>0&&x.request.input.actions.some(a=>a.group===37);
 }).map(x=>x.request.input.id).sort((a,b)=>publicScore(a).localeCompare(publicScore(b)));
 if(!eligible.length)fail('no prospective positive-honba reach replacement');
 const replacement=eligible[0];
 const selectedIds=[replacement,...v4.selectedIds.slice(1)];
 if(JSON.stringify(selectedIds)!==JSON.stringify(V41_EXPECTED_EIGHT)||
    selectedIds.length!==8||new Set(selectedIds).size!==8||
    selectedIds.some(x=>exclusions.has(x)))
  fail('v41 frozen eight-case identity changed');
 const cases=selectedIds.map(caseId=>{
  const row=frozen.find(x=>x.request.input.id===caseId);
  const board=row.request.input.evidence.find(x=>x.id==='board')?.value;
  if(!board)fail('source board unavailable');
  return {caseId,sourceRequestHash:row.requestHash,
    honba:board.honba,kyotaku:board.kyotaku,ownSeat:board.ownSeat,
    rawChatGPTAnswersAlreadySeen:0};
 });
 if(cases.filter(x=>x.honba>0).length<3||cases.every(x=>x.kyotaku===0))
  fail('honba/kyotaku stratification regressed');
 return {
  version:V41_SMOKE_VERSION,
  legacyPhase:'P2a-v4 already CLOSED_NO_GO and not regraded',
  basis:'one-for-one replacement by next SHA-ranked pre-answer reach scene with honba>0; retain seven unattempted cases',
  noTeacherOrPreviousModelAnswerUsed:true,
  excludedAlreadyAnswered:['pilot-48','pilot-42'],
  selectedIds,cases,
  sourceSetHash:sha(JSON.stringify(frozen)),
  firstReplacementCaseId:replacement,
  allNewResponseCountAtFreeze:0,
  requiresIndependentTemporaryChats:true
 };
}
