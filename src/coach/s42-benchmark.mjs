// Experimental, offline benchmark. No upload, no reference label in blind items.
import {buildEvidence} from './phoenix-coach.mjs';
import {actionForDiscard,actionForCall} from '../mortal/s42-analytics.mjs';
export const BENCH_VERSION='S42-coach-blind-v1';
export const MODEL_SHA256='30381bf21389e2d25d3edf48fed11bf772336ef3daeee67d1bdae7fb9dd30cb4';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const labels={37:'リーチ（打牌は別段階）',38:'チー（下）',39:'チー（中）',40:'チー（上）',41:'ポン',42:'カン',43:'和了',44:'九種九牌',45:'スルー'};
const label=i=>i<27?'打'+['m','p','s'][Math.floor(i/9)]+(i%9+1):i<34?'打z'+(i-26):i<37?'打'+['m','p','s'][i-34]+'0':labels[i];
function options(c){
 const map=new Map();
 const add=(i,p)=>{if(!Number.isInteger(i)||i<0||i>45)throw Error('unsupported action');if(!map.has(i))map.set(i,new Set());map.get(i).add(p);};
 if(c?.phase==='turn'){
  for(const p of c.discards||[])add(actionForDiscard(p),p);
  if(c.riichiDiscards?.length)add(37,'立直');for(const p of c.kan||[])add(42,p);
  if(c.tsumo)add(43,'ツモ');if(c.nine)add(44,'九種九牌');
 }else if(c?.phase==='reaction'){
  for(const p of [...(c.chi||[]),...(c.pon||[]),...(c.kan||[])])add(actionForCall(p),p);
  if(c.ron)add(43,'ロン');if(c.pass)add(45,'スルー');
 }else throw Error('unsupported phase');
 return [...map].sort((a,b)=>a[0]-b[0]).map(([action,details])=>({action,label:label(action),details:[...details].sort()}));
}
function publicScene(v){
 return {snapshotVersion:2,round:v.round,mode:v.mode,ownSeat:v.ownSeat,honba:v.honba,kyotaku:v.kyotaku,
 hand:v.hand.slice(),drawn:v.drawn,selfMelds:v.selfMelds.slice(),dora:v.dora.slice(),
 rivers:v.rivers.map(r=>({riichi:!!r.riichi,discards:r.discards.map(d=>({tile:d.tile,tsumogiri:!!d.tsumogiri,riichi:!!d.riichi,called:!!d.called})),melds:r.melds.slice()})),
 scores:v.scores.map(x=>({points:x.points})),remaining:v.remaining,ownDiscards:v.ownDiscards,activeSeat:v.activeSeat,
 initialOrder:v.initialOrder.slice(),pendingReach:!!v.pendingReach,
 publicEvents:v.publicEvents?.map(e=>e.種類==='ドラ表示追加'?{種類:e.種類,牌:e.牌}:['自摸','嶺上自摸'].includes(e.種類)?{種類:e.種類,席:e.席}:e.種類==='打牌'?{種類:e.種類,席:e.席,牌:e.牌,ツモ切り:!!e.ツモ切り,立直宣言:!!e.立直宣言}:{種類:e.種類,席:e.席,面子:e.面子})??null};
}
export function makeCase(entry,M,id){
 if(!entry?.scene||entry.scene.snapshotVersion!==2||entry.mortalDecision==null)return {excluded:'snapshot_or_decision_missing'};
 const op=entry.mortalOpinion;
 if(!op||op.id!==entry.mortalDecision||op.source!=='Mortal-S42'||op.qLegal?.length!==46)return {excluded:'missing_matched_s42'};
 const opts=options(entry.legalChoices), ids=opts.map(x=>x.action), qs=op.qLegal.flatMap((q,i)=>finite(q)?[i]:[]);
 if(ids.length<2)return {excluded:'forced_action'};
 if(JSON.stringify(ids)!==JSON.stringify(qs))return {excluded:'mask_mismatch'};
 if(!ids.includes(op.best)||op.qLegal[op.best]!==Math.max(...qs.map(i=>op.qLegal[i])))return {excluded:'bad_reference'};
 const scene=publicScene(entry.scene);
 // Use all recorded candidate facts, but neither player action nor model
 // action determines which candidates receive a two-step calculation.
 const candidates=(entry.candidates||[]).map(x=>({p:x.p,shanten:x.shanten,ukeire:x.ukeire,handTiles:x.handTiles?.slice(),melds:x.melds?.slice()}));
 if(entry.legalChoices.phase==='turn'&&ids.some(i=>i<37&&!candidates.some(x=>actionForDiscard(x.p)===i)))return {excluded:'turn_candidate_missing'};
 const clean={scene,candidates,legalChoices:entry.legalChoices};
 const facts=buildEvidence(clean,M);
 if(!facts?.見え枚数)return {excluded:'invalid_visible_counts'};
 if(facts.二次変化の定義)facts.二次変化の定義='直接牌効率上位最大4牌種（向聴・受け入れ・牌コード順）の二連続向聴改善組合せ。和了率・期待値ではない。';
 const blind={id,phase:entry.legalChoices.phase,scene,actions:opts,facts};
 if(entry.legalChoices.phase==='reaction')blind.reaction={from:entry.legalChoices.from,tile:entry.legalChoices.tile};
 const key={id,phase:blind.phase,best:op.best,q:op.qLegal.map(x=>finite(x)?x:null),model_sha256:MODEL_SHA256};
 return {blind,key};
}
export function collect(entries,M,prefix){
 const blind=[],keys=[],excluded={};
 for(let i=0;i<entries.length;i++){
  let r;try{r=makeCase(entries[i],M,prefix+'-'+String(i+1).padStart(3,'0'));}catch(e){r={excluded:'invalid_snapshot'};}
  if(r.excluded){excluded[r.excluded]=(excluded[r.excluded]||0)+1;continue;}
  blind.push(r.blind);keys.push(r.key);
 }
 return {version:BENCH_VERSION,blind,keys,excluded,total:entries.length};
}
export function gradeBlind(keys,answers){
 if(!Array.isArray(keys)||!keys.length||!Array.isArray(answers))throw Error('invalid dataset');
 const seen=new Map();
 for(const r of answers){if(!r||typeof r.id!=='string'||seen.has(r.id))throw Error('duplicate or missing answer ID');seen.set(r.id,r);}
 const keyIds=new Set(keys.map(k=>k.id));if(keyIds.size!==keys.length||[...seen.keys()].some(k=>!keyIds.has(k)))throw Error('unexpected or duplicate ID');
 const rows=keys.map(k=>{
  if(k.model_sha256!==MODEL_SHA256||k.q?.length!==46)throw Error('reference provenance');
  const legal=k.q.flatMap((v,i)=>finite(v)?[{i,v}]:[]).sort((a,b)=>b.v-a.v||a.i-b.i);
  if(legal.length<2||k.q[k.best]!==legal[0].v)throw Error('invalid reference key');
  const a=seen.get(k.id),pick=legal.find(x=>x.i===a?.action);
  const valid=!!pick&&typeof a.reason==='string'&&a.reason.trim().length>0&&['high','medium','low'].includes(a.confidence)&&typeof a.alternative==='number'&&a.alternative!==a.action&&legal.some(x=>x.i===a.alternative);
  const gap=valid?legal[0].v-pick.v:null,range=legal[0].v-legal.at(-1).v;
  return {id:k.id,phase:k.phase,valid,exact:valid&&a.action===k.best,tiedBest:valid&&gap===0,top2:valid&&legal.filter(x=>x.v>pick.v).length<2,gap,relativeGap:valid?(range>0?gap/range:0):null,reference:k.best,manualReviewRequired:true};
 });
 const valid=rows.filter(x=>x.valid),sum=(a,k)=>a.reduce((s,r)=>s+r[k],0);
 const summary=a=>{const v=a.filter(r=>r.valid);return {n:a.length,valid:v.length,top1:v.filter(r=>r.exact).length,tiedBest:v.filter(r=>r.tiedBest).length,top2:v.filter(r=>r.top2).length,meanQGap:v.length?sum(v,'gap')/v.length:null,meanRelativeGap:v.length?sum(v,'relativeGap')/v.length:null};};
 return {all:summary(rows),turn:summary(rows.filter(r=>r.phase==='turn')),reaction:summary(rows.filter(r=>r.phase==='reaction')),coverage:valid.length/rows.length,comparable:valid.length===rows.length,rows};
}
export const blindInstruction='各局面についてMortalの回答を見ず、合法actionsのaction番号から最善手を一つ選び、別の有力な合法候補の番号も選ぶ。phase=turnは打牌・立直・槓・和了等の段階を区別。立直の打牌や同一行動ID内の赤牌差等は別途説明。JSON配列のみ: id, action, alternative, confidence (high/medium/low), reason（具体的な牌姿・場況と代償）, prediction（判断を変える具体的条件）。事実と仮説を分け、未知の確率を捏造しない。';
