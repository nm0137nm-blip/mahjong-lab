import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {Script} from 'node:vm';
import {cases} from '../../tests/coach/fixtures.mjs';
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
    verified={各候補:choices,注記:'直接有効牌は向聴を下げる牌のうち残枚数上限が正のもの。followupは指定ツモ後に向聴最小・受け入れ最大となる打牌候補のみ。赤5の新規ツモは通常5として形を評価。和了率・打点・期待値は未計算。'};
  }
  if(c.id==='B09'||c.id==='B10'){
    const sh=M.Shoupai.fromString(c.scene.打牌前).dapai(c.scene.選択);verified={打牌後:sh.toString()};
  }
  return {...c,expected,verified};
}
export const materialized=cases.map(materialize);
const V1='あなたは天鳳の鳳凰位レベルの知識・判断力を目標とする四人麻雀コーチです。独立した熟練者として考え、根拠を具体的に説明してください。S42は参考情報です。情報不足は明記してください。';
const V2='あなたは天鳳の鳳凰位レベルの知識・判断力を目標とする四人麻雀コーチです。まず牌姿と実ドラを確認し、打牌後に存在しない牌を根拠にしない。エンジンの数値と戦術的推論を区別する。二度受けは同じ牌を複数の面子に使わない。変化を述べるなら具体的なツモ・打牌・変化後牌姿を示す。危険度は相手別に考える。期待値を捏造しない。候補が与えられた場合は独立した推奨を必ず一つ選び、僅差なら確信度を下げる。最善手を決めた戦術的理由と別候補の不利を具体的に述べ、プレイヤーの考えに反論もする。S42不一致だけで格下げしない。回答前に自己矛盾を点検する。';
function schema(c){return Object.fromEntries(Object.entries(c.expected).map(([k,v])=>[k,typeof v==='object'&&!Array.isArray(v)?{shanten:'number',waits:'tile[]',ukeire:'number'}:Array.isArray(v)?'array':typeof v]));}
export function prompt(batch,variant='v2'){
  return (variant==='v1'?V1:V2)+'\n以下は独立した麻雀問題です。牌コード m萬 p筒 s索 z1〜7東南西北白發中 0赤5。各問題を混同しない。JSON配列のみで回答。各要素は id, facts（指定フィールドに回答）, recommendation（選択肢から一つ、選択肢なしならnull）, confidence（high/medium/low）, reasoning（具体的根拠）, next_rule（応用可能な判断基準）を持つ。\n'+JSON.stringify(batch.map(c=>({id:c.id,scene:c.scene,question:c.ask,options:c.options,fact_fields:schema(c),...(variant==='v2'&&c.verified?{engine_facts:c.verified}:{})})),null,2);
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
    return {id:c.id,fields,legal,oraclePass,complete,objectivePass:fields.every(f=>f.pass)&&legal&&oraclePass!==false&&complete,manualReview:{required:true,rubric:c.rubric,reasoning:r?.reasoning||'',recommendation:r?.recommendation??null}};
  });
  return {cases:results.length,objectivePass:results.filter(r=>r.objectivePass).length,criticalFactErrors:results.reduce((n,r)=>n+r.fields.filter(f=>!f.pass).length,0),legalFailures:results.filter(r=>!r.legal).length,manualReviewPending:results.length,results};
}
if(process.argv[2]==='generate'){
  const out=process.argv[3]||'/tmp/coach-audit';
  mkdirSync(out,{recursive:true});
  for(const variant of ['v1','v2'])for(let i=0;i<60;i+=5)writeFileSync(out+'/'+variant+'-'+String(i/5+1).padStart(2,'0')+'.txt',prompt(materialized.slice(i,i+5),variant));
  writeFileSync(out+'/answer-key.json',JSON.stringify(materialized,null,2));
  console.log('Generated 24 five-question batches and private key; no LLM invoked.');
}
if(process.argv[2]==='grade'){
  const batch=Number(process.argv[4]);const selected=Number.isInteger(batch)&&batch>=1&&batch<=12?materialized.slice((batch-1)*5,batch*5):materialized;
  console.log(JSON.stringify(grade(JSON.parse(readFileSync(process.argv[3],'utf8')),selected),null,2));
}
