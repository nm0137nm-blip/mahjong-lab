// P2a-v4.4 new prospective public-only blind panel selected before any
// v4.4 GPT-6 answer; never inspect Mortal labels, model choices or hidden tiles.
// All 13 prior GPT-exposed v3/v4/v41/v42/v43 cases are excluded.
import {createHash} from 'node:crypto';
const h=x=>createHash('sha256').update(x).digest('hex');
const fail=x=>{throw Error('v44-smoke: '+x);};
const SALT='p2a-v44-prospective-unseen-20261123|';
export const V44_EXCLUDED_ANSWERED=[
 'pilot-48','pilot-42','pilot-50','pilot-52','pilot-47','pilot-59',
 'pilot-43','pilot-49','pilot-57','pilot-62','pilot-63','pilot-71','pilot-70'];
export const V44_EIGHT=['pilot-46','pilot-51','pilot-56','pilot-64',
 'pilot-53','pilot-69','pilot-65','pilot-74'];
const excluded=new Set(V44_EXCLUDED_ANSWERED);
const n=x=>Number(x.replace('pilot-',''));
const board=x=>x.request.input.evidence.find(z=>z.id==='board')?.value;
const byHash=(a,b)=>h(SALT+a.id).localeCompare(h(SALT+b.id));
export function selectV44ProspectiveSmoke(frozen){
 if(!Array.isArray(frozen)||frozen.length!==36||new Set(frozen.map(x=>x.request?.input?.id)).size!==36)
  fail('immutable 36 source set expected');
 const rows=frozen.map(source=>({source,id:source.request.input.id,b:board(source)}));
 if(rows.some(x=>!x.b))fail('missing source board');
 const fresh=rows.filter(x=>!excluded.has(x.id));
 const reach=fresh.filter(x=>n(x.id)>=41&&n(x.id)<=52);
 const call=fresh.filter(x=>n(x.id)>=53&&n(x.id)<=64);
 const discard=fresh.filter(x=>n(x.id)>=65&&n(x.id)<=76);
 if(reach.some(x=>!x.source.request.input.actions.some(a=>a.group===37))||
    call.some(x=>!x.source.request.input.actions.some(a=>[39,40,41].includes(a.group)))||
    discard.some(x=>!x.source.request.input.actions.some(a=>a.group<=36)))
  fail('source category not confirmed by legal action mask');
 const take=(pool,cond,count,chosen=[])=>{
  const out=pool.filter(x=>!chosen.some(y=>y.id===x.id)&&cond(x)).sort(byHash).slice(0,count);
  if(out.length!==count)fail('not enough unexposed source panel for fixed stratum');
  return out;
 };
 const r=take(reach,x=>x.b.kyotaku>0,2);
 const c0=take(call,x=>x.b.honba>0,2);
 const c1=take(call,x=>x.b.kyotaku>0,1,c0);
 const d0=take(discard,x=>x.b.honba>0,1);
 const d1=take(discard,x=>x.b.kyotaku>0,1,d0);
 const d2=take(discard,()=>true,1,[...d0,...d1]);
 const selected=[...r,...c0,...c1,...d0,...d1,...d2],ids=selected.map(x=>x.id);
 if(JSON.stringify(ids)!==JSON.stringify(V44_EIGHT)||new Set(ids).size!==8||
    ids.some(id=>excluded.has(id)))fail('source-only SHA-selection drift');
 const info=selected.map(x=>({caseId:x.id,sourceRequestHash:x.source.requestHash,
  honba:x.b.honba,kyotaku:x.b.kyotaku,remaining:x.b.remaining,
  ownSeat:x.b.ownSeat}));
 if(info.filter(x=>x.honba>0).length!==3||info.filter(x=>x.kyotaku>0).length<4)
  fail('public stratification drift');
 return {version:'p2a-v44-8-new-source-only-prospective-1',salt:SALT,
  originalSourceSHA256:h(JSON.stringify(frozen)),selectedIds:ids,
  excludedPreviouslyGPTAnswered:V44_EXCLUDED_ANSWERED,
  selectionMethod:'SHA-ranked public facts only: 2 unexposed reach with kyotaku, 2 unexposed honba-positive calls, 1 separate kyotaku-positive call, 1 honba-positive discard, 1 different kyotaku-positive discard, 1 SHA-next remaining discard',
  categoryCounts:{reach:2,call:3,discard:3},
  selectionUsesMortal:false,selectionUsesPastModelReplies:false,
  sourceOnlyCases:info,newGPT6AnswersAtFreeze:0,
  history:'v42 closed NO_GO after third real reply 2/3; v43 closed NO_GO after seventh real reply 6/7. Never regrade former answers with v44 verifier.'};
}
