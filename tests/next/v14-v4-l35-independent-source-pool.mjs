// V4 L3.5 new disjoint original-shard source pool, PRE MORTAL LABEL.
// No S42 Q/reference/oracle/paipu reads. Archive paipu and private references
// are reserved for independent verifier-side physical replay in later CI job.
// One original match shard = one statistical cluster; interventions are not
// multiple independent cases even when they share the same physical context.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {loadEngine} from '../../src/coach/v14-public-calculations.mjs';
import {independentRequest} from '../../src/coach/v14-pilot-boundary.mjs';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fail=x=>{throw Error('v4-l35-public-pool: '+x);};
const get=(i,id)=>i.evidence.find(e=>e.id===id)?.value;
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const inter='p2a-v4-new-heldout-public-control-before-S42-20261123';
const fingerprint=row=>sha(inter+'|'+row.id+'|'+row.scene.round+'|'+row.scene.ownSeat+'|'+row.scene.remaining);
const scoreSum=scene=>scene.scores.reduce((n,x)=>n+x.points,0)+scene.kyotaku*1000;
const observedGroup=x=>new Set(x.actions.map(a=>a.action));
const eligible=x=>{
 const s=x.scene,g=observedGroup(x);
 return x.phase==='turn'&&s.round!=='東1局'&&!s.pendingReach&&
  s.remaining<=55&&s.scores[s.ownSeat].points>=12000&&
  [...g].filter(k=>k<37||k===37).length>=2&&
  s.hand.length===14&&!!s.drawn;
};
function modify(raw,operation){
 const x=structuredClone(raw),s=x.scene,own=s.ownSeat;
 const opp=[0,1,2,3].filter(i=>i!==own)
  .sort((a,b)=>Math.abs(s.scores[a].points-s.scores[own].points)-
    Math.abs(s.scores[b].points-s.scores[own].points)||a-b);
 const nearest=opp[0];
 if(operation==='own_loss_3900_nearest'||operation==='own_loss_7700_nearest'){
  const amount=operation==='own_loss_3900_nearest'?3900:7700;
  if(s.scores[own].points-amount<1000)fail('own transfer invalid');
  s.scores[own].points-=amount;s.scores[nearest].points+=amount;
 }else if(operation==='own_gain_7700_nearest'){
  const paying=opp.find(i=>s.scores[i].points>=7700);
  if(paying===undefined)fail('opponent cannot pay');
  s.scores[own].points+=7700;s.scores[paying].points-=7700;
 }else if(operation==='opp_riichi_removed'){
  const seat=opp.find(i=>s.rivers[i].riichi);
  if(seat===undefined||s.kyotaku<1)fail('no removable opponent reach');
  const r=s.rivers[seat],f=r.discards.filter(d=>d.riichi);
  const e=s.publicEvents.filter(e=>e.種類==='打牌'&&e.席===seat&&e.立直宣言);
  if(f.length!==1||e.length!==1||f[0].tile!==e[0].牌)fail('ambiguous public reach');
  r.riichi=false;f[0].riichi=false;e[0].立直宣言=false;
  s.scores[seat].points+=1000;s.kyotaku-=1;
 }else fail('unknown operation');
 if(scoreSum(s)!==scoreSum(raw.scene))fail('score and escrow not conserved');
 if(JSON.stringify(raw.actions)!==JSON.stringify(x.actions))
  fail('action modified');
 return x;
}
const BASE_ID='pilot-90';
function packet(raw,engine,caseId){
 const output=independentRequest(raw,BASE_ID,engine),r=output.request;
 r.input.id=caseId;
 return {request:r,requestHash:sha(r)};
}
export function createV4L35NewSourcePool(frozen36,lineage36,prior30,priorLineage,root){
 if(!Array.isArray(frozen36)||frozen36.length!==36||!Array.isArray(lineage36)||
    lineage36.length!==36||!Array.isArray(prior30)||prior30.length!==30||
    !Array.isArray(priorLineage)||priorLineage.length!==30)
  fail('old/new frozen input and lineage expected');
 const used=new Set([...lineage36,...priorLineage].map(x=>x.shard));
 if(used.size!==62)fail('source shard cardinality changed; cannot prove disjoint pool');
 for(const l of lineage36)if(!frozen36.some(v=>v.requestHash===l.requestHash))
  fail('new36 source and lineage disagree');
 const rest=Array.from({length:96},(_,i)=>i+1).filter(s=>!used.has(s));
 if(rest.length!==34)fail('expected 34 unused original match shards');
 const engine=loadEngine(),accepted=[],skipped=[],actions=[
  'own_loss_3900_nearest','own_loss_7700_nearest',
  'own_gain_7700_nearest','opp_riichi_removed'];
 for(const shard of rest){
  const dir=path.join(root,'p1-v2-dev-data-'+shard);
  if(!fs.existsSync(path.join(dir,'manifest.json'))||!fs.existsSync(path.join(dir,'public.json')))
   fail('missing original development archive '+shard);
  const meta=read(path.join(dir,'manifest.json')),rows=read(path.join(dir,'public.json'));
  if(meta.shard!==shard||meta.split!=='development-only'||!Array.isArray(rows))
   fail('wrong archived source shard');
  const considered=rows.filter(eligible).sort((a,b)=>fingerprint(a).localeCompare(fingerprint(b)));
  let chosen=null,reason=[];
  for(const raw of considered){
   try{
    const prefix='v4l35-'+String(shard).padStart(2,'0')+'-'+sha(raw.id).slice(0,8);
    const baseline=packet(raw,engine,prefix+'-base'),variants=[];
    for(const op of actions){
     try{
      const alt=modify(raw,op);
      const p=packet(alt,engine,prefix+'-'+op);
      if(JSON.stringify(baseline.request.input.actions)!==JSON.stringify(p.request.input.actions))
       throw Error('action list mismatch');
      if(sha(get(baseline.request.input,'visible'))!==sha(get(p.request.input,'visible')))
       throw Error('public visible count changed');
      if(baseline.requestHash===p.requestHash)throw Error('identical public state');
      variants.push({operation:op,request:p,amountScenarios:'source-only-conditional-not-expectation'});
     }catch(e){reason.push({caseId:raw.id,operation:op,error:String(e).slice(0,180)});}
    }
    if(variants.length>=2){
     chosen={shard,originalDecisionId:raw.id,originalCaseHash:sha(raw),
      sourceSelectionKey:fingerprint(raw),metaSeed:meta.seed,
      chosenBeforeS42:true,originalPhase:raw.phase,publicHistoryHash:sha(raw.scene.publicEvents),
      baseline,variants};
     break;
    }
    reason.push({caseId:raw.id,error:'fewer than two available legal public variations'});
   }catch(e){reason.push({caseId:raw.id,error:String(e).slice(0,180)});}
  }
  if(chosen)accepted.push(chosen);
  else skipped.push({shard,eligible:considered.length,errors:reason.slice(0,10)});
 }
 if(accepted.length<8)fail('insufficient independent original shards for even prospective 4+4 L3.5');
 const publicPairs=accepted.flatMap(c=>c.variants.map((v,i)=>({
  caseId:'v4l35-'+String(c.shard).padStart(2,'0')+'-'+i,
  sourceCaseId:c.baseline.request.input.id,
  publicInput:{baseline:c.baseline,variant:v.request},
  intervention:v.operation,
  originCluster:c.shard
 })));
 const registry={version:'p2a-v4-l35-new-source-before-S42-1',
  selectionBasis:'unused original development-only match shards; publicly eligible turn action; sha sort; up to four predetermined point/riichi interventions; never S42 labels',
  usedPriorOrV3Shards:[...used].sort((a,b)=>a-b),
  unusedCandidateShards:rest,
  selectedClusters:accepted.length,
  originalClustersIndependent:true,
  publicPairs:publicPairs.length,
  skipped,
  selected:accepted.map(c=>({shard:c.shard,originalDecisionId:c.originalDecisionId,
   originalCaseHash:c.originalCaseHash,sourceSelectionKey:c.sourceSelectionKey,
   publicHistoryHash:c.publicHistoryHash,baselineHash:c.baseline.requestHash,
   variants:c.variants.map(v=>({operation:v.operation,hash:v.request.requestHash}))})),
  sourceSetHash:sha(accepted.map(x=>[x.shard,x.originalDecisionId,x.originalCaseHash])),
  publicPairHash:sha(publicPairs),
  labelStatus:'UNSCORED_S42_NOT_YET_CALLED',
  noModelAnswers:true,
  noTeacherRead:true,
  allPublicActionsRebuiltFromEngine:true,
  heldoutAssurance:'original match shards disjoint from old30,new36 and exploratory58 source clusters; repeated variants within a shard are NOT independent' };
 return {registry,publicPairs,accepted};
}
if(process.argv.length>4){
 const [p36,l36,p30,l30,root,out]=process.argv.slice(2);
 if(!out)fail('usage: source36 lineage36 old30 oldLineage devRoot out');
 const all=createV4L35NewSourcePool(read(p36),read(l36),read(p30),read(l30),root);
 fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(path.join(out,'prelabel-manifest.json'),JSON.stringify(all.registry,null,2)+'\n');
 fs.writeFileSync(path.join(out,'public-pairs.json'),JSON.stringify(all.publicPairs,null,2)+'\n');
 fs.writeFileSync(path.join(out,'verifier-origin-map.json'),JSON.stringify(
  all.accepted.map(x=>({shard:x.shard,originalDecisionId:x.originalDecisionId,
   publicHistoryHash:x.publicHistoryHash,originalCaseHash:x.originalCaseHash,
   metaSeed:x.metaSeed,baselineRequestHash:x.baseline.requestHash,
   variantHashes:x.variants.map(v=>v.request.requestHash)})),null,2)+'\n');
 console.log(JSON.stringify({selectedClusters:all.registry.selectedClusters,
  publicPairs:all.registry.publicPairs,skippedShards:all.registry.skipped.map(x=>x.shard),
  labelStatus:all.registry.labelStatus,noModelAnswers:all.registry.noModelAnswers}));
}
