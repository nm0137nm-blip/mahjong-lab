import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {buildV4SourceDisjointL35BlindPack} from './v14-v4-l35-blind-question-pack.mjs';
const dir=process.env.V14_L35_PRELABEL_DIR,gradeFile=process.env.V14_L35_S42;
function data(){
 return [JSON.parse(fs.readFileSync(path.join(dir,'prelabel-manifest.json'),'utf8')),
  JSON.parse(fs.readFileSync(path.join(dir,'public-pairs.json'),'utf8')),
  JSON.parse(fs.readFileSync(gradeFile,'utf8'))];
}
test('prelabel-selected four Mortal changes plus four nonchanges produce 16 independent source-blinded prompts',()=>{
 if(!dir||!gradeFile)return;
 const [a,b,c]=data(),p=buildV4SourceDisjointL35BlindPack(a,b,c);
 assert.equal(p.sorted.length,16);
 assert.equal(p.verifier.changed,4);
 assert.equal(p.verifier.maintained,4);
 assert.equal(p.verifier.sourceClusters,8);
 assert.deepEqual(p,buildV4SourceDisjointL35BlindPack(a,b,c));
 assert(p.sorted.every(x=>x.packet.request.stage==='p2a-v4-compact-independent-dev'));
 assert(p.sorted.every(x=>x.packet.request.publicBrief.caseId===x.blindId));
 assert.equal(new Set(p.sorted.map(x=>x.blindId)).size,16);
});
test('public prompts have no reference change labels or original match shard metadata',()=>{
 if(!dir||!gradeFile)return;
 const [a,b,c]=data(),p=buildV4SourceDisjointL35BlindPack(a,b,c);
 for(const x of p.sorted){
  const json=JSON.stringify(x.packet);
  for(const forbidden of ['changed_clear_internal_ranking','maintained_clear_internal_ranking',
    'archiveBest','archiveQ','sourceCluster','predeclaredClassBalancedSelection',
    'referenceChanged','privateHands','originalDecisionId'])
   assert(!json.includes(forbidden));
 }
});
test('tampered sealed eligibility and previously-used source cluster cannot bypass gate',()=>{
 if(!dir||!gradeFile)return;
 const [a,b,c]=data(),changed=structuredClone(c);
 changed.predeclaredClassBalancedSelection.strictEligible=false;
 assert.throws(()=>buildV4SourceDisjointL35BlindPack(a,b,changed),/no valid fixed 4\+4/);
 const broken=structuredClone(b);broken[0].originCluster=1;
 assert.throws(()=>buildV4SourceDisjointL35BlindPack(a,broken,c),/unfrozen source pool/);
});
