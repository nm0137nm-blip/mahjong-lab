// Development-only archive QA. No oracle/paipu access, no prior outer data.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {factsOnly,attachMortalReference} from '../../src/coach/p2a-facts-only.mjs';
const root=process.argv[2];
const dirs=fs.readdirSync(root).filter(s=>/^p1-v2-dev-data-\d+$/.test(s)).sort();
assert.equal(dirs.length,96);
const summary={status:'preparation_only',matches:0,cases:0,valid:0,turn:0,reaction:0,matchedGroups:0,failures:[],groups:{}};
const seeds=new Set();
for(const d of dirs){
 const dir=path.join(root,d);
 const read=p=>JSON.parse(fs.readFileSync(path.join(dir,p),'utf8'));
 const m=read('manifest.json');assert.equal(m.split,'development-only');assert.equal(m.shard,Number(d.split('-').at(-1)));assert(!seeds.has(m.seed));seeds.add(m.seed);
 const pub=read('public.json'),refs=read('reference.json');assert.equal(pub.length,refs.length);const ids=new Set();
 summary.matches++;
 for(let i=0;i<pub.length;i++){
  const x=pub[i],r=refs[i];assert.equal(x.id,r.id);assert(!ids.has(x.id));ids.add(x.id);
  summary.cases++;summary[x.phase]++;
  try{
   const f=factsOnly(x);
   const perturbed={...x,oracle:{secret:'hidden'},facts:{probability:0.99},scene:{...x.scene,wall:['z7'],ura:['z7'],privateHand:'hidden'}};
   assert.deepEqual(factsOnly(perturbed),f);
   assert.equal(f.externalEstimate.status,'suppressed_unvalidated_P1');
   // Archived reference does not contain a sha field; only this QA adapter
   // supplies the hash independently frozen and checked in original CI.
   // Production provenance / global match identity are still integration gates.
   const out=attachMortalReference(f,{id:r.id,phase:r.phase,best:r.best,q:r.q,model_sha256:'30381bf21389e2d25d3edf48fed11bf772336ef3daeee67d1bdae7fb9dd30cb4'},x.id);
   assert.equal(out.mortalReference.status,'matched_group_only');
   assert.equal(out.mortalReference.recommendedAction,r.best);
   assert(!Object.hasOwn(out.mortalReference,'q'));
   assert.equal(attachMortalReference(f,{...r,id:'stale'},x.id).mortalReference.status,'unavailable');
   for(const a of f.publicFacts.legalActions)summary.groups[a.id]=(summary.groups[a.id]||0)+1;
   summary.matchedGroups++;summary.valid++;
  }catch(e){summary.failures.push({shard:m.shard,id:x.id,phase:x.phase,error:String(e).slice(0,220)});}
 }
}
assert.equal(seeds.size,96);
fs.writeFileSync('/tmp/p2a-facts-only-audit.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({...summary,failures:summary.failures.slice(0,20)},null,2));
assert.equal(summary.failures.length,0);
assert.equal(summary.valid,summary.cases);
