// PREPARED AFTER a predeclared class-stratification rule; never tells ChatGPT
// whether the source-disjoint pair changed Mortal S42 top group. Sixteen
// independent single-question ChatGPT sessions are required for actual L3.5
// behavior. The verifier-only mapping carries source cluster and pair class.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createV3IndependentDevelopmentRequest} from '../../src/coach/v14-independent-request-v3.mjs';
import {createV4CompactDevelopmentPacket} from '../../src/coach/v14-compact-model-contract-v4.mjs';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fail=s=>{throw Error('v4-l35-public-pack: '+s);};
export function buildV4SourceDisjointL35BlindPack(prelabel,sourcePairs,grade){
 if(prelabel?.labelStatus!=='UNSCORED_S42_NOT_YET_CALLED'||
    prelabel.publicPairHash!==hash(sourcePairs)||
    grade?.selectionInputHash!==prelabel.publicPairHash||
    !grade.predeclaredClassBalancedSelection?.strictEligible||
    !Array.isArray(grade.predeclaredClassBalancedSelection.selectedPairCaseIds)||
    grade.predeclaredClassBalancedSelection.selectedPairCaseIds.length!==8)
  fail('unfrozen source pool or no valid fixed 4+4 sealed classification');
 const selected=grade.predeclaredClassBalancedSelection.selectedPairCaseIds;
 if(new Set(selected).size!==8)fail('duplicate ref-class pair');
 const output=[],map=[];
 const seen=new Set();
 for(const pairId of selected){
  const row=sourcePairs.find(x=>x.caseId===pairId),
   scored=grade.rows.find(x=>x.pairCaseId===pairId);
  if(!row||!scored||scored.sourceCluster!==row.originCluster||
     seen.has(row.originCluster))fail('invalid original cluster or duplicate');
  seen.add(row.originCluster);
  for(const [form,part] of [['A',row.publicInput.baseline],['B',row.publicInput.variant]]){
   const src=structuredClone(part);
   if(src?.request?.stage!=='independent'||typeof src.requestHash!=='string'||
      hash(src.request)!==src.requestHash)fail('untrusted paired public source');
   const blindId='p4-'+hash('v4-heldout-opaque-no-class|'+src.requestHash).slice(0,15);
   src.request.input.id=blindId;
   src.requestHash=hash(src.request);
   const v3=createV3IndependentDevelopmentRequest(src),
    packet=createV4CompactDevelopmentPacket(v3);
   if(packet.request.publicBrief.caseId!==blindId)fail('public blindId mismatch');
   if(JSON.stringify(packet).includes('modelSHA256')||
      JSON.stringify(packet).includes('referenceChanged')||
      JSON.stringify(packet).includes('sourceCluster'))
    fail('verifier S42 data leaked into model-visible prompt');
   output.push({blindId,packet,packetHash:packet.requestHash});
   map.push({blindId,sourceCluster:row.originCluster,pairId,form,
    classLabel:scored.classification,originalPacketHash:part.requestHash,
    publicPacketHash:packet.requestHash,
    provenance:'locked prelabel public intervention plus source-disjoint original game'});
  }
 }
 if(output.length!==16||new Set(output.map(x=>x.blindId)).size!==16||
    seen.size!==8)fail('not 8 independent paired clusters');
 const sorted=output.slice().sort((a,b)=>hash('v4-l35-masked-order|'+a.blindId)
   .localeCompare(hash('v4-l35-masked-order|'+b.blindId)));
 const publicManifest={
  version:'p2a-v4-l35-16-masked-public-packets-1',
  stage:'L3.5_NOT_RUN_NO_CHATGPT_ANSWERS',
  questionOrder:sorted.map(x=>({blindId:x.blindId,packetHash:x.packetHash})),
  fileCount:16,
  exposedReferenceQ:false,exposedReferenceChangedLabels:false,
  fixedOriginalSources:8,
  observedChatGPTReplies:0,
  note:'One fresh temporary chat per file. Do not share counterpart answers, S42 labels, verifier map or private origins with the answering model.'
 };
 const verifier={
  version:publicManifest.version,sourcePoolHash:prelabel.publicPairHash,
  sealedS42ReferenceModel:grade.modelSHA256,
  selectedByPredeclaredSourceDisjointRule:true,
  sourceClusters:8,changed:map.filter(x=>x.classLabel==='changed_clear_internal_ranking').length/2,
  maintained:map.filter(x=>x.classLabel==='maintained_clear_internal_ranking').length/2,
  map,publicPromptHash:hash(sorted),
  limitations:['Internal S42 rankings are not expected value or expert truth',
   'Score transfers describe hypothetical other previous-round outcomes',
   'No actual ChatGPT paired sensitivity measurement yet']
 };
 if(verifier.changed!==4||verifier.maintained!==4)fail('class ratio not 4+4');
 return {sorted,publicManifest,verifier};
}
if(process.argv.length>4){
 const [poolDir,sealedFile,out]=process.argv.slice(2);
 if(!out)fail('usage: prelabelDir sealedResult.json outputDir');
 const prelabel=JSON.parse(fs.readFileSync(path.join(poolDir,'prelabel-manifest.json'),'utf8')),
  pairs=JSON.parse(fs.readFileSync(path.join(poolDir,'public-pairs.json'),'utf8')),
  grade=JSON.parse(fs.readFileSync(sealedFile,'utf8'));
 const res=buildV4SourceDisjointL35BlindPack(prelabel,pairs,grade);
 for(const d of ['public/questions','verifier'])fs.mkdirSync(path.join(out,d),{recursive:true});
 for(const x of res.sorted)fs.writeFileSync(path.join(out,'public/questions',x.blindId+'.json'),
   JSON.stringify(x.packet,null,2)+'\n');
 fs.writeFileSync(path.join(out,'public/manifest.json'),JSON.stringify(res.publicManifest,null,2)+'\n');
 fs.writeFileSync(path.join(out,'verifier/paired-mapping.json'),JSON.stringify(res.verifier,null,2)+'\n');
 console.log(JSON.stringify({status:res.publicManifest.stage,
  publicQuestions:res.sorted.length,independentSourceClusters:res.verifier.sourceClusters,
  sourceDisjointChanged:res.verifier.changed,sourceDisjointMaintained:res.verifier.maintained,
  realModelReplies:0,
  publicFileLabelsNeverLeak:true}));
}
