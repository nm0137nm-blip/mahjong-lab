import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createV43FrozenStage1} from './v14-v43-stage1-freeze.mjs';
import {createV4DeterministicSourceComparison} from '../../src/coach/v14-source-comparison-proof-v4.mjs';
import {verifyAndRenderV43CompactModelResponse,V43_COMPACT_RESPONSE}
 from '../../src/coach/v14-compact-model-contract-v43.mjs';
const raw=process.env.V14_FOLLOWUP_PUBLIC?JSON.parse(fs.readFileSync(process.env.V14_FOLLOWUP_PUBLIC,'utf8')):[];
function choices(input){
 return input.actions.flatMap(a=>{
  const calc=input.evidence.find(e=>e.id==='calc-'+a.key)?.value;
  if(a.group===39||a.group===40||a.group===41){
   if(!Array.isArray(calc?.afterCallDiscards))return [];
   const xs=calc.afterCallDiscards.slice().sort((x,y)=>x.shanten-y.shanten||
    x.discard.localeCompare(y.discard));
   return xs.slice(0,3).map(x=>({key:a.key,afterCallDiscard:x.discard}));
  }
  return [{key:a.key,afterCallDiscard:null}];
 });
}
test('all eight frozen questions possess at least one source-distinguishable legal concrete pair with fully anchored opponent-specific schema',()=>{
 if(!raw.length)return;
 const pack=createV43FrozenStage1(raw);
 let validated=0;
 for(const row of pack.questions){
  const list=choices(row.envelope.request.input);
  let accepted=null;
  outer:for(const a of list)for(const b of list){
   if(a.key===b.key)continue;
   try{
    const p=createV4DeterministicSourceComparison(row.envelope,a,b);
    if(p.publicDifferences<1)continue;
    const fields=row.envelope.request.input.evidence;
    const calca=fields.find(x=>x.id==='calc-'+a.key)?.value;
    const calcb=fields.find(x=>x.id==='calc-'+b.key)?.value;
    const scalar=(calca&&Object.hasOwn(calca,'shanten'))?a.key:
     (calcb&&Object.hasOwn(calcb,'shanten'))?b.key:null;
    if(scalar===null)continue;
    const own=fields.find(x=>x.id==='board').value.ownSeat,
    seats=[0,1,2,3].filter(x=>x!==own);
    const as=key=>'[[candidate:'+key+':kind]]';
    let comparison=as(a.key)+'と'+as(b.key)+'を比べ、[[candidate:'+scalar+
      ':shanten]]を確認する。';
    for(const choice of [a,b])
     if(choice.afterCallDiscard!==null)
      comparison+=' 選択した鳴きは[[candidate:'+choice.key+':afterCallDiscard]]で牌を切る。';
    const answer={
     version:V43_COMPACT_RESPONSE,requestHash:row.packet.requestHash,
     recommendation:a,alternative:b,
     tactics:{
      comparison,
      opponents:seats.map(seat=>({
       seat,importance:'potentially_relevant',
       analysis:'[[opponent:seat'+seat+':pointGapFromOwn]]と[[opponent:seat'+seat+':meldCount]]を比べる。',
       tradeoff:as(a.key)+'の押し引きを[[opponent:seat'+seat+':riichi]]の公開進行と比べる。',
       changeCondition:'もし[[opponent:seat'+seat+':riichi]]が変われば、押し引き判断を見直す。'
      })),
      bottomLine:as(a.key)+'の選択は公開情報と守備余地を比べる。',
      reversal:'もし[[opponent:seat'+seats[0]+':riichi]]が変われば、戦術を見直す。',
      lesson:'定量証明は公開資料のプログラムによる出典から再計算する。'
     }};
    const out=verifyAndRenderV43CompactModelResponse(row.envelope,row.packet,answer);
    if(out.output.sourceBasedPublicProof.gate!=='pass')continue;
    accepted={a,b};
    break outer;
   }catch(_){continue;}
  }
  assert(accepted,'No source-cited syntactically valid action pair for '+row.caseId);
  validated++;
 }
 assert.equal(validated,8);
});
