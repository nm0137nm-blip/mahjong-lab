// Official-style scoring uses the same S42 implementation as the app.
// Usage: node scripts/coach/grade-coach-ab.mjs audit_key.json blind|explain answers.json [report.json]
import {readFileSync,writeFileSync} from 'node:fs';
import {analyzeAction} from '../../src/mortal/s42-analytics.mjs';
const [keyFile,stage,answerFile,reportFile]=process.argv.slice(2);
if(!['blind','explain'].includes(stage))throw Error('stage must be blind or explain');
const source=JSON.parse(readFileSync(keyFile,'utf8')),answers=JSON.parse(readFileSync(answerFile,'utf8')),keys=source[stage];
if(!Array.isArray(answers)||!Array.isArray(keys))throw Error('expected JSON arrays');
const m=new Map(),errors=[],details=[];
for(const a of answers){
 if(typeof a?.id!=='string'||m.has(a.id)){errors.push({id:a?.id??null,error:'invalid or duplicate answer ID'});continue;}
 m.set(a.id,a);
}
const keyIds=new Set(keys.map(k=>k.id));
for(const id of m.keys())if(!keyIds.has(id))errors.push({id,error:'unexpected answer'});
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
for(const k of keys){
 const a=m.get(k.id),picked=k.actions.find(x=>x.action===a?.action);
 let why=null;
 if(!a)why='missing';
 else if(!picked)why='illegal action';
 else if(picked.details?.length?!picked.details.includes(a.detail):a.detail!==null)why='illegal or missing specific execution';
 else if(stage==='blind'&&(a.action===a.alternative||!k.actions.some(x=>x.action===a.alternative)))why='illegal alternative';
 else if(!['high','medium','low'].includes(a.confidence)||typeof a.reasoning!=='string'||!a.reasoning.trim()||typeof a.next_rule!=='string'||!a.next_rule.trim())why='missing reasoning/lesson/confidence';
 if(why){errors.push({id:k.id,error:why});details.push({id:k.id,stratum:k.stratum,group:k.group,valid:false});continue;}
 const r=analyzeAction({qLegal:k.q,best:k.best},a.action);
 if(!r)throw Error('invalid benchmark label '+k.id);
 let facts=null;
 if(stage==='explain'){
  const supplied=new Map(),extra=[];
  for(const f of (Array.isArray(a.facts)?a.facts:[])){
   if(typeof f?.path!=='string'||supplied.has(f.path)||!Object.hasOwn(k.facts,f.path)){extra.push(f?.path??null);continue;}
   supplied.set(f.path,f.value);
  }
  const mismatch=Object.entries(k.facts).filter(([p,v])=>!supplied.has(p)||!same(supplied.get(p),v)).map(([p])=>p);
  facts={expected:Object.keys(k.facts).length,correct:Object.keys(k.facts).length-mismatch.length,mismatch,extra};
 }
 details.push({id:k.id,stratum:k.stratum,group:k.group,valid:true,action:a.action,best:k.best,strictMatch:r.agreement,tiedBest:r.gap<=1e-8,top2:r.rank<=2,relativeGap:r.relativeGap,bad:r.badMove,ratingContribution:r.ratingContribution,pureDiscard:k.phase==='turn'&&k.actions.every(x=>x.action<37),facts});
}
function agg(ds){
 const valid=ds.filter(x=>x.valid),n=valid.length,disc=valid.filter(x=>x.pureDiscard);
 const mean=f=>n?valid.reduce((s,d)=>s+f(d),0)/n:null;
 const expectedFacts=ds.reduce((s,d)=>s+(d.facts?.expected??0),0);
 return {expected:ds.length,valid:n,coverage:ds.length?n/ds.length:null,rating:n?100*mean(d=>d.ratingContribution)**2:null,strictMatch:mean(d=>Number(d.strictMatch)),tiedBest:mean(d=>Number(d.tiedBest)),top2:mean(d=>Number(d.top2)),relativeGap:mean(d=>d.relativeGap),badAll:mean(d=>Number(d.bad)),pureDiscardN:disc.length,pureDiscardBadRate:disc.length?disc.filter(x=>x.bad).length/disc.length:null,explicitFactChecks:expectedFacts,correctFacts:ds.reduce((s,d)=>s+(d.facts?.correct??0),0)};
}
const complete=errors.length===0&&details.length===keys.length,report={stage,complete,errors,all:agg(details),strata:Object.fromEntries([...new Set(keys.map(x=>x.stratum))].map(s=>[s,agg(details.filter(x=>x.stratum===s))])),details,notes:'Stratified diagnostic, not a human rank estimate. Incomplete runs fail coverage; do not compare their partial metrics. Explain stage sees Q; its agreement is not skill evidence. Pure-discard bad-rate only; temperature .1, softmax <.05. Explicit factual fields do not establish prose correctness. Independent masked pairwise evaluation needed.'};
if(reportFile)writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({stage,complete,errors,all:report.all,strata:report.strata},null,2));
if(!complete)process.exitCode=2;
