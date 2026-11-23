// Deliberately weak controls; no reference data read in the selection process.
// These are diagnostics, not a coach or a calibrated policy.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function metricOf(a,e){
 const v=e.get('calc-'+a.key);
 if(v.afterCallDiscards)return v.afterCallDiscards.slice().sort(compare)[0];
 return v;
}
function compare(a,b){return (a.shanten??99)-(b.shanten??99)||(b.ukeireUpperBound??0)-(a.ukeireUpperBound??0)||(b.retainedDoraHan??0)-(a.retainedDoraHan??0);}
export function control(envelope,kind){
 assert.equal(sha(envelope.request),envelope.requestHash);
 const i=envelope.request.input,e=new Map(i.evidence.map(x=>[x.id,x.value])),a=i.actions;
 const win=a.find(x=>x.group===43);if(win)return win.key;
 if(kind==='efficiency'){
  const candidates=a.filter(x=>x.group!==42&&x.group!==44);
  return candidates.slice().sort((x,y)=>compare(metricOf(x,e),metricOf(y,e))||Number(y.group===37)-Number(x.group===37)||Number(y.group===45)-Number(x.group===45)||x.key.localeCompare(y.key,'en'))[0].key;
 }
 if(kind==='pass_or_first'){
  return (a.find(x=>x.group===45)||a[0]).key;
 }
 throw Error('unknown control');
}
const modes=['efficiency','pass_or_first'],[mode,...args]=process.argv.slice(2);
if(mode==='select'){
 const [infile,out]=args,es=JSON.parse(fs.readFileSync(infile,'utf8'));
 const records=es.map(e=>({id:e.request.input.id,requestHash:e.requestHash,choices:Object.fromEntries(modes.map(m=>[m,control(e,m)]))}));
 const packet={status:'weak_controls_only',records};fs.writeFileSync(out,JSON.stringify({packet,hash:sha(packet)},null,2)+'\n');
}else if(mode==='grade'){
 const [infile,lockedfile,lineagefile,root,out]=args,es=JSON.parse(fs.readFileSync(infile,'utf8')),l=JSON.parse(fs.readFileSync(lockedfile,'utf8')),lineage=JSON.parse(fs.readFileSync(lineagefile,'utf8'));
 assert.equal(sha(l.packet),l.hash);assert.equal(l.packet.records.length,30);
 const rows=[];
 for(const [k,e] of es.entries()){
  const lin=lineage[k],rec=l.packet.records[k],input=e.request.input;
  assert.equal(e.requestHash,rec.requestHash);assert.equal(e.requestHash,lin.requestHash);assert.equal(input.id,rec.id);assert.equal(input.id,lin.pilotId);
  const dir=path.join(root,'p1-v2-dev-data-'+lin.shard),m=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
  assert.equal(m.seed,lin.seed);assert.equal(m.split,'development-only');
  const ref=JSON.parse(fs.readFileSync(path.join(dir,'reference.json'),'utf8')).filter(x=>x.id===lin.decisionId);
  assert.equal(ref.length,1);const q=ref[0].q;assert.equal(q.length,46);
  const g=[...new Set(input.actions.map(a=>a.group))].sort((a,b)=>a-b);
  assert.deepEqual(q.flatMap((v,j)=>v===null?[]:[j]),g);assert(g.every(i=>Number.isFinite(q[i])));assert.equal(q[ref[0].best],Math.max(...g.map(i=>q[i])));
  const choices=Object.fromEntries(modes.map(m=>{const act=input.actions.find(x=>x.key===rec.choices[m]);assert(act);return [m,{group:act.group,gap:q[ref[0].best]-q[act.group],best:q[act.group]===q[ref[0].best]}]}));
  rows.push({id:input.id,group:lin.group,threat:lin.threat,multi:lin.multi,late:lin.late,choices});
 }
 function summary(a,m){return {n:a.length,exactOrTied:a.filter(x=>x.choices[m].best).length,meanGap:a.reduce((n,x)=>n+x.choices[m].gap,0)/a.length};}
 const result={status:'natural_case_weak_control_descriptive_only',lockHash:l.hash,summary:Object.fromEntries(modes.map(m=>[m,{all:summary(rows,m),reach:summary(rows.filter(x=>x.group==='reach'),m),reaction:summary(rows.filter(x=>x.group==='reaction'),m),discard:summary(rows.filter(x=>x.group==='discard'),m),threat:summary(rows.filter(x=>x.threat),m)}])),rows,limitations:['no B2 threshold set before pilot','group-level archived reference; not concrete riichi tile comparison','no B3/B4 yet','not a model or certification']};
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.summary));
}else if(mode==='contrast'){
 const [infile,out]=args,ps=JSON.parse(fs.readFileSync(infile,'utf8'));
 const rows=ps.map(p=>({lineage:p.lineage,choices:Object.fromEntries(modes.map(m=>[m,{a:control(p.a,m),b:control(p.b,m)}]))}));
 const result={status:'weak_control_context_invariance_descriptive_only',n:rows.length,unchanged:Object.fromEntries(modes.map(m=>[m,rows.filter(r=>r.choices[m].a===r.choices[m].b).length])),rows,limitations:['no gold direction yet, cannot claim B3 failure']};
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}else throw Error('invalid mode');
