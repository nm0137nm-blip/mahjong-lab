import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createV2IndependentDevelopmentRequest} from '../../src/coach/v14-independent-request-v2.mjs';
import {makeOneCaseExport,verifyOneCaseExport} from './v14-onecase-export-v2.mjs';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const required=['V14_FOLLOWUP_PUBLIC','V14_FOLLOWUP_LINEAGE','V14_FOLLOWUP_MANIFEST','V14_FOLLOWUP_CASE_DIR','V14_STAGE1','V14_LINEAGE'];
const ready=required.every(x=>process.env[x]);
const pub=ready?read(process.env.V14_FOLLOWUP_PUBLIC):[],map=ready?read(process.env.V14_FOLLOWUP_LINEAGE):[],
 manifest=ready?read(process.env.V14_FOLLOWUP_MANIFEST):{},prior=ready?read(process.env.V14_STAGE1):[],
 oldLineage=ready?read(process.env.V14_LINEAGE):[];
test('new 36 source scenes are preregistered, development-only and share zero original matches with frozen 30',()=>{
 if(!ready)return;
 assert.equal(manifest.status,'followup_development_public_prepared_no_model');
 assert.equal(manifest.preregisteredCommit,'cd7b933b42a97325c69551eae7171edee4d738a8');
 assert.equal(pub.length,36);assert.equal(map.length,36);
 assert.equal(manifest.newCases,36);
 assert.equal(manifest.newOriginalShards,36);
 assert.equal(manifest.overlappingOriginalShards,0);
 assert.equal(manifest.priorDistinctShards,26);
 assert.deepEqual(manifest.stratification,{reach:12,reaction:12,discard:12});
 assert.equal(sha(pub),manifest.newPublicInputHash);
 assert.equal(sha(map),manifest.verifierLineageHash);
 assert.equal(sha(prior),manifest.previousFrozenInputHash);
 assert.equal(sha(oldLineage),manifest.previousLineageHash);
 assert.equal(manifest.modelCalls,0);assert.equal(manifest.answersPresent,0);assert.equal(manifest.contrastPairs,0);
 const old=new Set(oldLineage.map(x=>x.shard));
 assert.equal(old.size,26);
 assert.equal(new Set(map.map(x=>x.shard)).size,36);
 assert.equal(new Set(map.map(x=>x.sourceSeed)).size,36);
 assert.equal(map.filter(x=>old.has(x.shard)).length,0);
 for(const g of ['reach','reaction','discard']){
  const rows=map.filter(x=>x.group===g);
  assert.equal(rows.length,12);
  for(const [trait,minimum] of [['threat',3],['multi',2],['late',2]]){
   assert(rows.filter(x=>x.publicTraits[trait]).length>=minimum);
  }
 }
});
test('frozen public projection for 36 examples is hash-locked and cannot include verifier-only labels, private state or S42 reference',()=>{
 if(!ready)return;
 for(let n=0;n<36;n++){
  const e=pub[n],l=map[n],id='pilot-'+String(41+n).padStart(2,'0');
  assert.equal(e.request.input.id,id);assert.equal(l.id,id);
  assert.equal(e.requestHash,sha(e.request));assert.equal(l.requestHash,e.requestHash);
  assert.equal(e.request.stage,'independent');
  assert.equal(e.request.input.version,'v14-pilot-calculated-1');
  assert(e.request.input.actions.length>=2);
  assert(!('reference' in e.request));
  assert(!('lineage' in e.request));
  assert(!('model' in e.request));
  assert(!('truth' in e.request));
  assert(!('oracle' in e.request.input));
  assert(!('privateHands' in e.request.input));
  assert(!('future' in e.request.input));
  assert(!('teacher' in e.request.input));
  const b=createV2IndependentDevelopmentRequest(e);
  assert.equal(b.request.stage,'independent-v2-dev');
  assert.equal(sha(b.request.input),sha(e.request.input));
  assert.equal(l.modelHasThisMetadata,false);
 }
});
test('every 36 development-only independent message exports exactly one case and is manifest bound',()=>{
 if(!ready)return;
 const bundle=makeOneCaseExport(pub);
 const outManifest=read(path.join(path.dirname(process.env.V14_FOLLOWUP_PUBLIC),'one-case-manifest.json'));
 assert.deepEqual(outManifest,bundle.manifest);
 assert.equal(verifyOneCaseExport(pub,bundle).actualModelCalls,0);
 for(const m of bundle.messages){
  const stored=read(path.join(process.env.V14_FOLLOWUP_CASE_DIR,m.caseId+'.json'));
  assert.deepEqual(stored,m);
  assert.equal(m.answerTemplate.answer,'REPLACE_WITH_ONE_JSON_OBJECT_PER_CASE');
  assert.equal(m.request.stage,'independent-v2-dev');
  assert.equal(m.formalAssessment,'not_authorized_development_only');
  assert.equal(Object.hasOwn(m,'mortalBest'),false);
  assert.equal(Object.hasOwn(m.request,'oracle'),false);
 }
});
