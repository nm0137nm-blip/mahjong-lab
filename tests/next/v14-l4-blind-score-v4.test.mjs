import test from 'node:test';
import assert from 'node:assert/strict';
import {gradeV4MaskedL4} from '../../src/coach/v14-l4-blind-score-v4.mjs';
import {P2A_V4_RESEARCH_PLAN} from '../../src/coach/v14-v4-evaluation-plan.mjs';
const plan=P2A_V4_RESEARCH_PLAN,keys=plan.l4.axes.map(x=>x.key);
function fixture(highReal=10,weakControl=3){
 const map=[],submissions=[];
 for(const id of plan.trialCases)for(const kind of ['real','control']){
  const maskedId='sealed-'+id+'-'+kind;
  map.push({maskedId,caseId:id,kind,lockedTextHash:'test-only-'+id});
  for(const rater of plan.l4.raters){
   const n=kind==='real'?highReal:weakControl;
   const a=[3,3,2,2],b=[1,1,1,0];
   submissions.push({maskedId,rater,axes:keys.map((key,i)=>({key,score:(kind==='real'?a:b)[i]}))});
  }
 }
 return {map,submissions};
}
test('perfectly separated real8 versus control8 and all3 judges qualifies rubric only',()=>{
 const f=fixture();
 const r=gradeV4MaskedL4(f.map,f.submissions);
 assert.equal(r.result,'L4_BLINDED_RUBRIC_PASS_ONLY_NOT_PHASE_CERTIFICATION');
 assert.equal(r.allRatersComplete,true);
 assert.equal(r.realMeets9,8);assert.equal(r.falseExperts,0);
 assert.equal(r.controlledContrast,8);
});
test('injected high-rating controls triggers 0 false-expert tolerance',()=>{
 const f=fixture();
 for(const s of f.submissions)if(s.maskedId==='sealed-pilot-42-control')
  s.axes=keys.map((key,i)=>({key,score:[3,3,2,2][i]}));
 const r=gradeV4MaskedL4(f.map,f.submissions);
 assert.equal(r.result,'L4_FAIL');
 assert.equal(r.falseExperts,1);
});
test('generic model answer failing the tactical threshold cannot ride perfect numeric verification',()=>{
 const f=fixture();
 for(const s of f.submissions)if(s.maskedId.includes('-real'))
  s.axes=keys.map((key,i)=>({key,score:[3,1,0,1][i]}));
 const r=gradeV4MaskedL4(f.map,f.submissions);
 assert.equal(r.result,'L4_FAIL');
 assert.equal(r.realMeets9,0);
 assert.equal(r.realAll6,false);
});
test('partial judge record, duplicated score, same class twice and unverified anonymous IDs always fail closed',()=>{
 const f=fixture();
 assert.throws(()=>gradeV4MaskedL4(f.map,f.submissions.slice(1)),/16 masked cases/);
 const double=fixture();double.submissions[0]=double.submissions[1];
 assert.throws(()=>gradeV4MaskedL4(double.map,double.submissions),/duplicate rating/);
 const wrong=fixture();wrong.map[0]={...wrong.map[0],kind:'control'};
 assert.throws(()=>gradeV4MaskedL4(wrong.map,wrong.submissions),/multiple identities/);
 const tampered=fixture();tampered.submissions[0].axes[0].score=4;
 assert.throws(()=>gradeV4MaskedL4(tampered.map,tampered.submissions),/score vector/);
});
