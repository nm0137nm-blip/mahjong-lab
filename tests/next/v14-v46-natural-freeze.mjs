// Before-model source panel lock; selection is public-only and deterministic.
// No L4 controls, seed/lineage identifiers or source policy outcomes in prompts.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {SEEDS} from './v14-v46-natural-source.mjs';
import {createV3IndependentDevelopmentRequest} from '../../src/coach/v14-independent-request-v3.mjs';
import {createV46CompactDevelopmentPacket} from '../../src/coach/v14-compact-model-contract-v46.mjs';
import {createV46BlindControlBatch} from '../../src/coach/v14-l4-blind-controls-v46.mjs';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fail=x=>{throw Error('v46-panel: '+x)};
const salt='p2a-v46-natural-panel-20261124-v1';
const source=(p,id)=>p.request.input.evidence.find(e=>e.id===id)?.value;
const slots=[['reach',true],['reach',false],['reaction',true],['reaction',false],['reaction',false],['discard',true],['discard',false],['discard',false]];
export function freezeV46NaturalPanel(shards,seedAudit){
 if(!Array.isArray(shards)||shards.length!==SEEDS.length||JSON.stringify(seedAudit.newSeeds)!==JSON.stringify(SEEDS))fail('complete predeclared seed pool required');
 if(!Number.isInteger(seedAudit.priorSeeds)||seedAudit.priorSeeds<96)fail('prior seed audit absent');
 const all=[],seen=new Set();
 for(const s of shards){
  const e=SEEDS.find(x=>x.shard===s.entry?.shard);
  if(!e||e.seed!==s.entry.seed||seen.has(e.shard)||s.version!=='v46-natural-source-public-1'||s.modelCalls!==0||s.privateHandsRead!==false)fail('invalid collection');
  seen.add(e.shard);
  for(const c of s.accepted){
   const p=c.packet;
   if(p.requestHash!==sha(p.request)||!['reach','reaction','discard'].includes(c.group))fail('source hash or group');
   const input=p.request.input,board=source(p,'board'),own=board.ownSeat,groups=input.actions.map(a=>a.group);
   const valid=c.group==='reach'?groups.includes(37)&&groups.some(g=>g<37):
    c.group==='reaction'?groups.includes(45)&&groups.some(g=>g>=38&&g<=41)&&!groups.includes(42)&&!groups.includes(43):
    groups.filter(g=>g<37).length>=2&&!groups.some(g=>g>=37);
   if(!valid||board.pendingReach||board.remaining<4||board.remaining>60||board.round==='東1局')fail('public eligibility mismatch');
   const digest=sha({...input,id:'masked'});
   const threat=[0,1,2,3].some(i=>i!==own&&source(p,'public-value-'+i).riichi===true);
   all.push({shard:e.shard,seed:e.seed,group:c.group,decisionId:c.decisionId,publicHash:c.publicHash,digest,threat,packet:p,
    order:sha([salt,e.shard,c.decisionId,digest])});
  }
 }
 all.sort((a,b)=>a.order.localeCompare(b.order));
 // Deterministic lexicographic first complete assignment. No outcome or tactical score.
 function search(i,used,digests,chosen){
  if(i===slots.length)return chosen;
  const [group,requiredThreat]=slots[i];
  for(const a of all){
   if(a.group!==group||requiredThreat&&!a.threat||used.has(a.shard)||digests.has(a.digest))continue;
   const r=search(i+1,new Set([...used,a.shard]),new Set([...digests,a.digest]),[...chosen,a]);
   if(r)return r;
  }
  return null;
 }
 const selected=search(0,new Set(),new Set(),[]);
 if(!selected)fail('no complete fixed-strata assignment; no ad hoc resampling');
 const sources=selected.map((s,i)=>{
  const request=structuredClone(s.packet.request);request.input.id='pilot-'+(81+i);
  return {request,requestHash:sha(request)};
 });
 const envelopes=sources.map(createV3IndependentDevelopmentRequest);
 const questions=envelopes.map(e=>({caseId:e.request.input.id,packet:createV46CompactDevelopmentPacket(e)}));
 const controls=createV46BlindControlBatch(envelopes,questions.map(x=>x.caseId));
 const publicManifest={version:'p2a-v46-frozen-eight-natural-1',modelRepliesAtFreeze:0,sourceSHA256:sha(sources),
  fixedOrder:questions.map(q=>q.caseId),packetHashes:questions.map(q=>q.packet.requestHash),
  publicPacketSetHash:sha(questions),weakControlDigest:sha(controls),
  groups:selected.map(s=>s.group),threatCounts:slots.length,distinctOriginalMatches:new Set(selected.map(s=>s.shard)).size,
  seedAuditHash:sha(seedAudit),allPublicOnly:true};
 publicManifest.threatCounts=Object.fromEntries(['reach','reaction','discard'].map(g=>[g,selected.filter(s=>s.group===g&&s.threat).length]));
 const lineage={...publicManifest,selectionAlgorithm:salt,sourcePoolCandidates:all.length,
  bundleHash:shards[0].bundleHash,sourceLineage:selected.map(({packet,...s},i)=>({...s,caseId:questions[i].caseId,requestHash:sources[i].requestHash})),
  collection:shards.map(s=>({entry:s.entry,counts:s.counts,accepted:s.accepted.length,rejects:s.rejects}))};
 if(new Set(shards.map(x=>x.bundleHash)).size!==1||publicManifest.distinctOriginalMatches!==8)fail('engine/shard uniqueness');
 return {sources,questions,controls,publicManifest,lineage};
}
if(process.argv[1]?.endsWith('v14-v46-natural-freeze.mjs')){
 const [root,seedFile,out]=process.argv.slice(2);
 const shards=SEEDS.map(e=>JSON.parse(fs.readFileSync(path.join(root,'v46-natural-source-'+e.shard,'source.json'),'utf8')));
 const result=freezeV46NaturalPanel(shards,JSON.parse(fs.readFileSync(seedFile,'utf8')));
 fs.mkdirSync(path.join(out,'public/questions'),{recursive:true});fs.mkdirSync(path.join(out,'verifier'),{recursive:true});
 const write=(p,x)=>fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n');
 write(path.join(out,'verifier/independent-requests.json'),result.sources);
 write(path.join(out,'verifier/lineage.json'),result.lineage);
 write(path.join(out,'verifier/weak-controls.json'),result.controls);
 write(path.join(out,'public/manifest.json'),result.publicManifest);
 for(const q of result.questions)write(path.join(out,'public/questions',q.caseId+'.json'),q.packet);
 console.log(JSON.stringify(result.publicManifest));
}
