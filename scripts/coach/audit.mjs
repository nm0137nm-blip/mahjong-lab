import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {Script} from 'node:vm';
import {cases} from '../../tests/coach/fixtures.mjs';
import {strategyCases} from '../../tests/coach/strategy-fixtures.mjs';
import {expertCases} from '../../tests/coach/expert-fixtures.mjs';
import {strategyInstructions} from './strategy-curriculum.mjs';
import {relativeCases,relativeInstructions} from './relative-value.mjs';
export const relative=relativeCases;
const page=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const source=page.match(/<script>([\s\S]*?)<\/script>/)[1];
const boundary='})(typeof window!=="undefined"?window:globalThis);';
const ctx={window:{}};
new Script(source.slice(0,source.indexOf(boundary)+boundary.length)).runInNewContext(ctx);
const M=ctx.window.MajiangCore;
const tileTypes=[...('mps')].flatMap(s=>Array.from({length:9},(_,i)=>s+(i+1))).concat(Array.from({length:7},(_,i)=>'z'+(i+1)));
const norm=p=>p[0]+(p[1]==='0'?'5':p[1]);
function expand(s){return [...s.matchAll(/[mpsz][0-9]+/g)].flatMap(([v])=>[...v.slice(1)].map(n=>v[0]+n));}
function counts(tiles){const n=Object.fromEntries(tileTypes.map(p=>[p,0]));for(const p of tiles){if(!(norm(p) in n))throw Error('bad tile '+p);n[norm(p)]++;}if(Object.values(n).some(x=>x>4))throw Error('five copies');return n;}
function direct(sh,seen){
  const shanten=M.Util.xiangting(sh);
  const waits=Array.from(M.Util.tingpai(sh)||[]).filter(p=>seen[p]<4).sort();
  return {shanten,waits,ukeire:waits.reduce((v,p)=>v+4-seen[p],0)};
}
function followup(sh,seen,draw){
  if(seen[draw]>=4)return null;
  const after=sh.clone().zimo(draw);
  if(M.Util.xiangting(after)===-1)return {draw,agari_shape:true};
  const known={...seen,[draw]:seen[draw]+1};
  const rows=Array.from(after.get_dapai()).map(p=>{const h=after.clone().dapai(p);return {discard:p,after:h.toString(),...direct(h,known)}});
  rows.sort((a,b)=>a.shanten-b.shanten||b.ukeire-a.ukeire||a.discard.localeCompare(b.discard));
  return {draw,remaining_upper_bound:4-seen[draw],best_by_shanten_then_ukeire:rows.filter(x=>x.shanten===rows[0].shanten&&x.ukeire===rows[0].ukeire)};
}
// Counts ordered two-draw paths that lower shanten on both draws.
// A uniform unseen pool is a deliberately simplified shape model; it
// excludes calls, opponents, yaku, draw-position knowledge and tile danger.
export function twoDrawProgress(hand,discard,visible=[]){
 const tiles=expand(hand);
 if(tiles.length!==14)throw Error('expected 14 tiles');
 const seen=counts([...tiles,...visible]);
 const sh=M.Shoupai.fromString(hand).dapai(discard);
 const base=direct(sh,seen);
 if(base.shanten<1)return null;
 const paths=base.waits.map(draw=>{
   const next=followup(sh,seen,draw);
   const best=next?.best_by_shanten_then_ukeire?.[0];
   if(!best||best.shanten!==base.shanten-1)throw Error('effective draw mismatch '+draw);
   return {draw,firstCopies:4-seen[draw],nextShanten:best.shanten,secondCopies:best.ukeire,orderedPaths:(4-seen[draw])*best.ukeire};
 });
 return {discard,baseShanten:base.shanten,firstUkeire:base.ukeire,orderedPaths:paths.reduce((n,p)=>n+p.orderedPaths,0),paths};
}
export function materialize(c){
  let expected=structuredClone(c.expected),verified=null;
  if(c.engine?.kind==='dora'){
    const actual=M.Shan.zhenbaopai(c.engine.indicator);
    if(actual!==expected.dora)throw Error(c.id+' dora key mismatch');
    verified={実ドラ:actual};
  }
  if(c.engine?.kind==='efficiency'){
    const e=c.engine,tiles=expand(e.hand);
    if(tiles.length!==14)throw Error(c.id+' hand length '+tiles.length);
    const seen=counts([...tiles,...e.visible]);
    const hand=M.Shoupai.fromString(e.hand);
    const choices=e.discard.map(p=>{
      const sh=hand.clone().dapai(p);
      const metric=direct(sh,seen);
      expected[p]=metric;
      const dora=(c.scene.ドラ表示牌||[]).map(p=>M.Shan.zhenbaopai(p));
      // Local deterministic two-step facts, not EV, win rate or global optimality.
      const relevant=c.id==='E01'?['m3','m6','s2','s3']:metric.waits.slice(0,3);
      return {discard:p,after:sh.toString(),...metric,followup:relevant.map(d=>followup(sh,seen,d)).filter(Boolean),実ドラ:dora};
    });
    verified={各候補:choices,...(c.id==='E01'?{二連続向聴改善:e.discard.map(p=>twoDrawProgress(e.hand,p,e.visible)),二連続向聴改善の意味:'直後の2回の自ツモで向聴を連続して下げる順序付き牌組合せ数。各ツモ後は向聴最小・受け入れ最大の打牌。未知牌を同質に扱う近似で実戦の和了率・期待値ではない。'}:{}),注記:'直接有効牌は向聴を下げる牌のうち残枚数上限が正のもの。followupは指定ツモ後に向聴最小・受け入れ最大となる打牌候補のみ。赤5の新規ツモは通常5として形を評価。和了率・打点・期待値は未計算。'};
  }
  if(c.id==='B09'||c.id==='B10'){
    const sh=M.Shoupai.fromString(c.scene.打牌前).dapai(c.scene.選択);verified={打牌後:sh.toString()};
  }
  return {...c,expected,verified};
}
export const materialized=cases.map(materialize);
export const expert=expertCases.map(c=>{
 if(c.engine?.kind==='discard'){
  const e=materialize({id:c.id,engine:{...c.engine,kind:'efficiency'},scene:c.scene,expected:{}});
  return {...c,verified:e.verified};
 }
 if(c.engine?.kind==='pon'){
  const h=M.Shoupai.fromString(c.engine.hand),seen=counts([...expand(c.engine.hand),'s1']);
  if(!Array.from(h.get_peng_mianzi('s1=')||[]).includes(c.engine.meld))throw Error(c.id+' illegal pon');
  const after=h.clone().fulou(c.engine.meld).dapai(c.engine.discard);
  const facts=direct(after,seen);
  if(facts.shanten!==c.expected.pon_shanten||JSON.stringify(facts.waits)!==JSON.stringify(c.expected.pon_waits))throw Error(c.id+' call shape mismatch');
  return {...c,verified:{ポン打牌後:after.toString(),...facts}};
 }
 return {...c,verified:null};
});
export const strategic=strategyCases.map(c=>({...c,verified:c.id.startsWith('T07')?materialized.find(x=>x.id==='E01').verified:null})).map(c=>{
  // B changes the indicator, so do not accidentally carry the A-case
  // dora or visible-count results into it. Recompute with its own indicator.
  if(c.id!=='T07B')return c;
  const e=materialize({id:'E01',engine:{kind:'efficiency',hand:'m1245999p45s18899',discard:['m1','s1'],visible:['m2']},scene:{ドラ表示牌:['m2']},expected:{}});
  return {...c,verified:e.verified};
});
// Baseline uses the actual deployed instruction text, not an abbreviated caricature.
const buildStart=source.indexOf('function buildPhoenixPrompt(');
const instructionsStart=source.indexOf('const instructions=[',buildStart);
const instructionsEnd=source.indexOf('return instructions.join',instructionsStart);
if(instructionsStart<0||instructionsEnd<0)throw Error('baseline instructions not found');
const V1=new Script(source.slice(instructionsStart,instructionsEnd)+';instructions.join("\\n")').runInNewContext({});
const V2='あなたは天鳳の鳳凰位レベルの知識・判断力を目標とする四人麻雀コーチです。まず牌姿と実ドラを確認し、打牌後に存在しない牌を根拠にしない。エンジンの数値と戦術的推論を区別する。二度受けは同じ牌を複数の面子に使わない。変化を述べるなら具体的なツモ・打牌・変化後牌姿を示す。危険度は相手別に考える。期待値を捏造しない。候補が与えられた場合は独立した推奨を必ず一つ選び、僅差なら確信度を下げる。最善手を決めた戦術的理由と別候補の不利を具体的に述べ、プレイヤーの考えに反論もする。S42不一致だけで格下げしない。回答前に自己矛盾を点検する。';
function schema(c){return Object.fromEntries(Object.entries(c.expected).map(([k,v])=>[k,typeof v==='object'&&!Array.isArray(v)?{shanten:'number',waits:'tile[]',ukeire:'number'}:Array.isArray(v)?'array':typeof v]));}
export function prompt(batch,variant='v2'){
  const relativeOutput=batch.some(c=>c.group==='相対価値')?' 相対価値問題は relative_value（高い/中程度/低い）, main_threat（最大の脅威または確認できない旨）, tradeoff（具体的な代償）, reversal_condition（結論が変わる条件）も含める。':'';
  return (variant==='v1'?V1:V2)+(['v3','v4'].includes(variant)?'\n'+strategyInstructions():'')+(variant==='v4'?'\n'+relativeInstructions:'')+'\n以下は独立した麻雀問題です。牌コード m萬 p筒 s索 z1〜7東南西北白發中 0赤5。各問題を混同しない。JSON配列のみで回答。各要素は id, facts（指定フィールドに回答）, recommendation（選択肢から一つ、選択肢なしならnull）, confidence（high/medium/low）, reasoning（具体的根拠）, next_rule（応用可能な判断基準）を持つ。'+relativeOutput+'\n'+JSON.stringify(batch.map(c=>({id:c.id,scene:c.scene,question:c.ask,options:c.options,fact_fields:schema(c),...(variant!=='v1'&&c.verified?{engine_facts:c.verified}:{})})),null,2);
}
function canonical(v){if(Array.isArray(v))return v.map(canonical).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));return v;}
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
export function grade(rows,selected=materialized){
  if(!Array.isArray(rows))throw Error('answer must be JSON array');
  const seen=new Map();for(const r of rows){if(!r||typeof r.id!=='string'||seen.has(r.id))throw Error('missing or duplicate id');seen.set(r.id,r);}
  const results=selected.map(c=>{
    const r=seen.get(c.id);
    const fields=Object.entries(c.expected).map(([key,expected])=>({key,pass:equal(r?.facts?.[key],expected),expected,actual:r?.facts?.[key]??null}));
    const legal=c.options.length?c.options.includes(r?.recommendation):r?.recommendation===null;
    const oraclePass=c.oracle===null?null:r?.recommendation===c.oracle;
    const complete=!!r&&typeof r.reasoning==='string'&&r.reasoning.trim().length>0&&typeof r.next_rule==='string'&&r.next_rule.trim().length>0&&['high','medium','low'].includes(r.confidence);
    const relativeComplete=c.group!=='相対価値'||(['高い','中程度','低い'].includes(r?.relative_value)&&['main_threat','tradeoff','reversal_condition'].every(k=>typeof r?.[k]==='string'&&r[k].trim().length>0));
    return {id:c.id,fields,legal,oraclePass,complete,relativeComplete,objectivePass:fields.every(f=>f.pass)&&legal&&oraclePass!==false&&complete&&relativeComplete,manualReview:{required:true,rubric:c.rubric,reasoning:r?.reasoning||'',recommendation:r?.recommendation??null,relative_value:r?.relative_value??null,main_threat:r?.main_threat??null,tradeoff:r?.tradeoff??null,reversal_condition:r?.reversal_condition??null}};
  });
  return {cases:results.length,objectivePass:results.filter(r=>r.objectivePass).length,criticalFactErrors:results.reduce((n,r)=>n+r.fields.filter(f=>!f.pass).length,0),legalFailures:results.filter(r=>!r.legal).length,manualReviewPending:results.length,results};
}
if(process.argv[2]==='generate'){
  const out=process.argv[3]||'/tmp/coach-audit';
  mkdirSync(out,{recursive:true});
  for(const variant of ['v1','v2','v3'])for(let i=0;i<60;i+=5)writeFileSync(out+'/'+variant+'-'+String(i/5+1).padStart(2,'0')+'.txt',prompt(materialized.slice(i,i+5),variant));
  for(const variant of ['v1','v2','v3'])for(let i=0;i<strategic.length;i+=2)for(let j=i;j<i+2;j++)writeFileSync(out+'/'+variant+'-strategy-'+strategic[j].id+'.txt',prompt([strategic[j]],variant));
  for(const variant of ['v1','v2','v3'])for(const c of expert)writeFileSync(out+'/'+variant+'-expert-'+c.id+'.txt',prompt([c],variant));
  for(const variant of ['v3','v4'])for(const c of relative)writeFileSync(out+'/'+variant+'-relative-'+c.id+'.txt',prompt([c],variant));
  writeFileSync(out+'/answer-key.json',JSON.stringify([...materialized,...strategic,...expert,...relative],null,2));
  console.log('Generated basic batches and individual paired strategic prompts; no LLM invoked.');
}
if(process.argv[2]==='grade'){
  const batch=Number(process.argv[4]);const id=process.argv[4];const selected=id==='relative'?relative:relative.some(c=>c.id===id)?relative.filter(c=>c.id===id):id==='expert'?expert:expert.some(c=>c.id===id)?expert.filter(c=>c.id===id):id==='strategy'?strategic:strategic.some(c=>c.id===id)?strategic.filter(c=>c.id===id):Number.isInteger(batch)&&batch>=1&&batch<=12?materialized.slice((batch-1)*5,batch*5):materialized;
  console.log(JSON.stringify(grade(JSON.parse(readFileSync(process.argv[3],'utf8')),selected),null,2));
}
