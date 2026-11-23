// Three-rater masked L4 judgement. Structural correctness is a separate gate.
// A statistical certification is NOT inferred from 8 convenience cases.
// Graders do not get the private real/control mapping until scores lock.
import {P2A_V4_RESEARCH_PLAN} from './v14-v4-evaluation-plan.mjs';
const bad=s=>{throw Error('v4-l4-grade: '+s);};
const median=xs=>xs.slice().sort((a,b)=>a-b)[1];
const gradeAxes=P2A_V4_RESEARCH_PLAN.l4.axes.map(x=>x.key);
function validScore(x){
 return x&&Array.isArray(x.axes)&&x.axes.length===4&&
  x.axes.every((v,i)=>v&&v.key===gradeAxes[i]&&
    Number.isInteger(v.score)&&v.score>=0&&v.score<=3);
}
export function gradeV4MaskedL4(map,submissions){
 const raters=P2A_V4_RESEARCH_PLAN.l4.raters;
 if(!Array.isArray(map)||map.length!==16||
    new Set(map.map(x=>x.maskedId)).size!==16||
    !Array.isArray(submissions)||submissions.length!==48)
  bad('must have fixed 16 masked cases, 3 ratings each');
 const pairIds=new Set(P2A_V4_RESEARCH_PLAN.trialCases);
 const rowMap=new Map(),counts=new Map();
 for(const m of map){
  if(!m||typeof m.maskedId!=='string'||!pairIds.has(m.caseId)||
     !['real','control'].includes(m.kind)||!m.lockedTextHash||
     typeof m.lockedTextHash!=='string')
    bad('invalid sealed private identity map');
  const key=m.caseId+':'+m.kind;
  if(counts.has(key))bad('multiple identities for the same case and class');
  counts.set(key,true);rowMap.set(m.maskedId,m);
 }
 if(counts.size!==16)bad('missing paired control');
 const scores=new Map();
 for(const s of submissions){
  if(!s||!rowMap.has(s.maskedId)||!raters.includes(s.rater)||
     !validScore(s))
    bad('unknown submission, rater or score vector');
  const key=s.maskedId+':'+s.rater;
  if(scores.has(key))bad('duplicate rating');
  scores.set(key,s.axes.map(a=>a.score).reduce((a,b)=>a+b,0));
 }
 if(scores.size!==48)bad('missing or duplicate ratings');
 const totals=m=>raters.map(r=>{
  const n=scores.get(m.maskedId+':'+r);
  if(n===undefined)bad('missing rater');
  return n;
 });
 const byCase=[];
 for(const caseId of P2A_V4_RESEARCH_PLAN.trialCases){
  const a=map.find(x=>x.caseId===caseId&&x.kind==='real'),
        b=map.find(x=>x.caseId===caseId&&x.kind==='control');
  const real=totals(a),control=totals(b);
  byCase.push({caseId,realTotals:real,controlTotals:control,
   realMedian:median(real),controlMedian:median(control),
   contrast:median(real)-median(control),
   controlExpertVotes:control.filter(x=>x>=P2A_V4_RESEARCH_PLAN.l4.weakControlsMisratedExpertThreshold).length});
 }
 const l4=P2A_V4_RESEARCH_PLAN.l4;
 const realMeets9=byCase.filter(x=>x.realMedian>=9).length;
 const realAll6=byCase.every(x=>x.realMedian>=l4.stage1RealMinimumMedianPerScene);
 const controlledContrast=byCase.filter(x=>x.contrast>=l4.minimumMedianRealMinusMatchedControl).length;
 const falseExperts=byCase.filter(x=>x.controlExpertVotes>=2).length;
 const pass=realMeets9>=l4.stage1RealScenesMedianAtLeast9Needed&&
  realAll6&&controlledContrast>=l4.sceneCountMeetingMinimumContrast&&
  falseExperts<=l4.allowedWeakControlsMisratedExpertByAtLeast2of3Raters;
 return {
  version:'p2a-v4-fully-masked-l4-scoring-1',
  result:pass?'L4_BLINDED_RUBRIC_PASS_ONLY_NOT_PHASE_CERTIFICATION':'L4_FAIL',
  allRatersComplete:true,realMeets9,realAll6,controlledContrast,falseExperts,
  byCase,rawScoresPreserved:true,gradeOnly:'rater_assessments_not_verified_tactical_truth',
  note:'Can only be run after blinded experts independently assign all 48 scores. No partial or missing ratings omitted.'};
}
