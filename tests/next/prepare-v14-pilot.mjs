// Select development-only natural cases without reading reference/oracle/paipu.
// This is transport QA, not the 30-question tactical trial; legal contrasts remain pending.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {loadEngine} from '../../src/coach/v14-public-calculations.mjs';
import {independentRequest} from '../../src/coach/v14-pilot-boundary.mjs';
const root=process.argv[2],out=process.argv[3],engine=loadEngine();
const dirs=fs.readdirSync(root).filter(d=>/^p1-v2-dev-data-\d+$/.test(d)).sort((a,b)=>Number(a.split('-').at(-1))-Number(b.split('-').at(-1)));
assert.equal(dirs.length,96);
const groups={discard:[],reach:[],reaction:[]};const seeds=new Set();
for(const d of dirs){
 const dir=path.join(root,d),m=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
 assert.equal(m.split,'development-only');assert(!seeds.has(m.seed));seeds.add(m.seed);
 const rows=JSON.parse(fs.readFileSync(path.join(dir,'public.json'),'utf8'));
 for(const x of rows){
  const ids=x.actions.map(a=>a.action),s=x.scene;
  const group=x.phase==='reaction'&&ids.includes(45)&&ids.some(i=>i>=38&&i<=42)?'reaction':x.phase==='turn'&&ids.includes(37)&&ids.some(i=>i<37)?'reach':x.phase==='turn'&&ids.filter(i=>i<37).length>=2&&!ids.includes(37)&&!ids.includes(43)&&!s.pendingReach?'discard':null;
  if(!group)continue;
  const opp=s.rivers.filter((r,i)=>i!==s.ownSeat),threat=opp.some(r=>r.riichi),multi=opp.some(r=>r.melds.length>=2),late=s.remaining<=20;
  groups[group].push({x,seed:m.seed,shard:m.shard,group,threat,multi,late});
 }
}
// Fixed slots: each group 4 riichi, 3 multiple meld, 3 late as available.
// fallback uses fixed public-only order, and missed quota is recorded.
const chosen=[],used=new Set(),missing=[];
for(const group of ['reach','reaction','discard']){
 for(const target of ['threat','multi','late','threat','multi','late','threat','multi','late','threat']){
  const pool=groups[group].filter(r=>!used.has(r.shard));
  let pick=pool.find(r=>r[target]);if(!pick){pick=pool[0];missing.push({group,target});}
  assert(pick,'development support missing');used.add(pick.shard);chosen.push({...pick,target});
 }
}
assert.equal(chosen.length,30);assert.equal(used.size,30);
const envelopes=[],lineage=[],failures=[];
for(const [i,row] of chosen.entries()){
 const id='pilot-'+String(i+1).padStart(2,'0');
 try{
  const e=independentRequest(row.x,id,engine);
  const evil=structuredClone(row.x);Object.assign(evil,{oracle:{hand:'PRIVATE'},mortalOpinion:{q:[999]},reference:{best:99},facts:{future:'PRIVATE'},discard:'z7'});
  Object.assign(evil.scene,{wall:['z7'],ura:['z7'],privateHands:['PRIVATE']});
  assert.deepEqual(independentRequest(evil,id,engine),e);
  envelopes.push(e);lineage.push({pilotId:id,requestHash:e.requestHash,seed:row.seed,shard:row.shard,decisionId:row.x.id,group:row.group,threat:row.threat,multi:row.multi,late:row.late,target:row.target});
 }catch(err){failures.push({id,shard:row.shard,decisionId:row.x.id,error:String(err),stack:err.stack?.split('\n').slice(0,5)});}
}
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'independent-requests.json'),JSON.stringify(envelopes,null,2)+'\n');
fs.writeFileSync(path.join(out,'lineage.json'),JSON.stringify(lineage,null,2)+'\n');
const summary={status:'transport_preparation_only_not_tactical_evaluation',planned:30,prepared:envelopes.length,distinctShards:used.size,missingTarget:missing,failures,coverage:Object.fromEntries(Object.keys(groups).map(k=>[k,lineage.filter(x=>x.group===k).length])),threat:lineage.filter(x=>x.threat).length,multi:lineage.filter(x=>x.multi).length,late:lineage.filter(x=>x.late).length,limitations:['No legal contrast labels yet','Public candidate calculations recomputed; independent audit required','No model inference executed','No reference or outcome data inspected','No tactical pass']};
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));assert.equal(failures.length,0);
