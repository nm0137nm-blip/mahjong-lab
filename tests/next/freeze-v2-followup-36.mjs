// P2a-v2: fixed public-only selection of 36 follow-up development scenes.
// The criteria were preregistered in project-handoff on 2026-11-23,
// commit cd7b933b42a97325c69551eae7171edee4d738a8.
// Do NOT use/reference outcome, private/oracle, S42, test responses or gradients.
// Any quota failure is a FAILED freeze gate, not permission for post hoc tuning.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {loadEngine} from '../../src/coach/v14-public-calculations.mjs';
import {independentRequest} from '../../src/coach/v14-pilot-boundary.mjs';
import {makeOneCaseExport,verifyOneCaseExport} from './v14-onecase-export-v2.mjs';

export const SELECTION_VERSION='p2a-v2-followup-dev-36-public-only-20261123';
const PREREG='cd7b933b42a97325c69551eae7171edee4d738a8';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const textHash=x=>createHash('sha256').update(x).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,obj)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(obj,null,2)+'\n');};
const fail=s=>{throw Error('p2a-v2-preregistered-freeze: '+s);};

function classification(x){
 if(!x?.scene||!Array.isArray(x.actions))return null;
 const ids=x.actions.map(a=>a.action),s=x.scene;
 if(x.phase==='reaction'&&ids.includes(45)&&ids.some(v=>v>=38&&v<=42))return 'reaction';
 if(x.phase==='turn'&&ids.includes(37)&&ids.some(v=>v<37))return 'reach';
 if(x.phase==='turn'&&ids.filter(v=>v<37).length>=2&&
    !ids.includes(37)&&!ids.includes(43)&&!s.pendingReach)return 'discard';
 return null;
}
function traits(x){
 const s=x.scene,others=s.rivers.filter((r,i)=>i!==s.ownSeat);
 return {threat:others.some(r=>r.riichi===true),
  multi:others.some(r=>r.melds?.length>=2),late:s.remaining<=20};
}
export function freezeFollowupDevelopment36(sourceRoot,oldStage1File,oldLineageFile,outputRoot){
 const prior=read(oldStage1File),lineage=read(oldLineageFile);
 if(prior.length!==30||lineage.length!==30)fail('prior frozen 30 missing');
 if(!lineage.every((l,i)=>l.pilotId===prior[i].request.input.id&&
     l.requestHash===prior[i].requestHash&&
     sha(prior[i].request)===prior[i].requestHash))fail('existing 30 source lineage mismatch');
 const seenPrior=new Set(lineage.map(x=>x.shard));
 if(seenPrior.size!==26)fail('older 30 expected 26 separate source matches');
 const pools={reach:[],reaction:[],discard:[]},sourceSeeds=new Set(),sourceShards=new Set();
 const dirs=fs.readdirSync(sourceRoot,{withFileTypes:true}).filter(x=>x.isDirectory()&&/^p1-v2-dev-data-\d+$/.test(x.name));
 if(dirs.length!==96)fail('expected all 96 previously frozen development source shards');
 for(const dir of dirs){
  const p=path.join(sourceRoot,dir.name),m=read(path.join(p,'manifest.json'));
  if(m.split!=='development-only'||!Number.isInteger(m.shard)||m.shard<1||m.shard>96||
     !Number.isInteger(m.seed)||sourceSeeds.has(m.seed)||sourceShards.has(m.shard))fail('bad or duplicate development-only source manifest');
  sourceSeeds.add(m.seed);sourceShards.add(m.shard);
  if(seenPrior.has(m.shard))continue;
  const rows=read(path.join(p,'public.json'));
  if(!Array.isArray(rows)||rows.length<1)fail('missing public-only source scene list');
  const chosenPerShard=new Set();
  for(const x of rows){
   const group=classification(x);if(!group||typeof x.id!=='string'||chosenPerShard.has(x.id))continue;
   chosenPerShard.add(x.id);
   pools[group].push({x,shard:m.shard,seed:m.seed,group,...traits(x)});
  }
 }
 if(sourceShards.size!==96||sourceSeeds.size!==96)fail('incomplete previous development source pool');
 const used=new Set(seenPrior),rows=[],shortages=[];
 for(const group of ['reach','reaction','discard']){
  // Three riichi-threat, two multi-meld, two late-game, five public-any per group.
  const slots=['threat','threat','threat','multi','multi','late','late','any','any','any','any','any'];
  for(let n=0;n<slots.length;n++){
   const target=slots[n];
   const eligible=pools[group].filter(x=>!used.has(x.shard)&&(target==='any'||x[target]));
   const scored=eligible.map(x=>({...x,orderHash:textHash(
    'p2a-v2-dev-followup-v1|'+group+'|'+target+'|'+x.shard+'|'+x.x.id)}));
   scored.sort((a,b)=>a.orderHash.localeCompare(b.orderHash)||a.shard-b.shard||a.x.id.localeCompare(b.x.id));
   if(!scored.length){shortages.push({group,target,slot:n});continue;}
   const c=scored[0];used.add(c.shard);rows.push({...c,slot:n,target});
  }
 }
 if(shortages.length||rows.length!==36)fail('preregistered public quota failed: '+JSON.stringify(shortages));
 if(new Set(rows.map(x=>x.shard)).size!==36||rows.some(x=>seenPrior.has(x.shard)))fail('nonoverlap quota broken');
 const counts=Object.fromEntries(['reach','reaction','discard'].map(g=>[g,rows.filter(x=>x.group===g).length]));
 if(Object.values(counts).some(n=>n!==12))fail('12-per-group preregistered quota not met');
 const engine=loadEngine(),stage1=[],newLineage=[];
 for(let n=0;n<rows.length;n++){
  const row=rows[n],id='pilot-'+String(41+n).padStart(2,'0');
  const e=independentRequest(row.x,id,engine);
  if(sha(e.request)!==e.requestHash)fail('corrupt projected public request');
  stage1.push(e);
  newLineage.push({id,group:row.group,shard:row.shard,sourceSeed:row.seed,
   decisionId:row.x.id,requestHash:e.requestHash,
   publicSceneHash:sha(row.x.scene),sourceActionHash:sha(row.x.actions),
   publicTraits:{threat:row.threat,multi:row.multi,late:row.late},
   selectionTarget:row.target,selectionHash:row.orderHash,
   modelHasThisMetadata:false});
 }
 if(new Set(stage1.map(x=>x.requestHash)).size!==36||
    new Set(newLineage.map(x=>x.sourceSeed)).size!==36||
    new Set(newLineage.map(x=>x.shard)).size!==36)fail('new source uniqueness failed');
 for(const group of Object.keys(counts)){
  const selected=rows.filter(x=>x.group===group);
  for(const [key,min] of [['threat',3],['multi',2],['late',2]])
   if(selected.filter(x=>x[key]).length<min)fail('minimum stratum failed: '+group+' '+key);
 }
 // No verifier-only metadata enters public independent requests.
 for(const e of stage1){
  const request=e.request;
  if('reference' in request||'lineage' in request||'teacher' in request||
     'private' in request||'model' in request||'answer' in request)fail('verifier-only data in public projection');
 }
 const artifact={status:'followup_development_public_prepared_no_model',
  preregisteredCommit:PREREG,selectionVersion:SELECTION_VERSION,
  previousFrozenInputHash:sha(prior),previousLineageHash:sha(lineage),
  newPublicInputHash:sha(stage1),verifierLineageHash:sha(newLineage),
  newCases:stage1.length,newOriginalShards:new Set(newLineage.map(x=>x.shard)).size,
  overlappingOriginalShards:0,priorDistinctShards:seenPrior.size,
  sourcePoolShards:sourceShards.size,
  stratification:counts,
  stratumTrueCounts:Object.fromEntries(['reach','reaction','discard'].map(g=>[g,{
   threat:rows.filter(x=>x.group===g&&x.threat).length,
   multi:rows.filter(x=>x.group===g&&x.multi).length,
   late:rows.filter(x=>x.group===g&&x.late).length}])),
  modelCalls:0,answersPresent:0,contrastPairs:0,
  sourceRestrictions:'only source manifest.json + public.json; prior frozen stage1 and verifier-only lineage for exact overlap exclusion',
  modelExposure:'only independent v2 packets, public facts, no lineage/labels',
  limitations:['Original pool is already development-only; unused source matches are not an independent external exam',
    'New scenarios are natural, not yet matched contrast pairs',
    'No independent model calls and no tactical skill measured',
    'New 36 frozen scenes must pass additional independent calculation and legality QA before inference']};
 write(path.join(outputRoot,'stage1','independent-requests.json'),stage1);
 write(path.join(outputRoot,'verifier-only','lineage.json'),newLineage);
 write(path.join(outputRoot,'verifier-only','manifest.json'),artifact);
 const bundle=makeOneCaseExport(stage1);verifyOneCaseExport(stage1,bundle);
 write(path.join(outputRoot,'stage1','one-case-manifest.json'),bundle.manifest);
 for(const m of bundle.messages)write(path.join(outputRoot,'stage1','onecase',m.caseId+'.json'),m);
 console.log(JSON.stringify(artifact,null,2));
 return artifact;
}
if(process.argv[1]&&import.meta.url===new URL('file://'+path.resolve(process.argv[1])).href){
 const [root,old,oldLineage,out]=process.argv.slice(2);
 if(!root||!old||!oldLineage||!out)fail('usage: node freeze-v2-followup-36.mjs /tmp/96 /tmp/old30.json /tmp/oldlineage.json /tmp/out');
 freezeFollowupDevelopment36(root,old,oldLineage,out);
}
