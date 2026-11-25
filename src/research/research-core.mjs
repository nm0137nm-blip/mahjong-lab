// Experimental research adapter; no game-model reference or opponent private inputs.
import {classifyStructuralWaits} from './classify-waits.mjs';
const assert=(v,m='research invariant violation')=>{if(!v)throw Error(m)};
const equal=(a,b)=>assert(JSON.stringify(a)===JSON.stringify(b),'research mismatch');
const round100=x=>Math.ceil(x/100)*100;
export function basicPoints(fu,han,yakuman=0){
 if(yakuman){assert(Number.isInteger(yakuman)&&yakuman>0);return 8000*yakuman}
 assert(Number.isInteger(han)&&han>=1&&Number.isInteger(fu)&&fu>=20);
 if(han>=13)return 8000;if(han>=11)return 6000;if(han>=8)return 4000;if(han>=6)return 3000;if(han===5)return 2000;
 return Math.min(2000,fu*2**(han+2));
}
const band=v=>v<=2900?'low':v<=5200?'mid':'high';
export function referenceScore(M,hand,rule,wind,seat,indicators,waits){
 assert(rule['数え役満あり']&&!rule['切り上げ満貫あり']);
 const own={};for(const m of hand.toString().matchAll(/[mpsz]\d+/g))for(const n of m[0].slice(1))own[m[0][0]+n]=(own[m[0][0]+n]||0)+1;
 let scores=[],variants=0;
 for(const t of waits){const suit='mpsz'[Math.floor(t/9)],rank=t%9+1,normal=suit+rank;const tiles=[normal];if(suit!=='z'&&rank===5&&rule['赤牌'][suit])tiles.push(suit+'0');
  for(const tile of tiles){const cap=rank!==5||suit==='z'?4:tile.endsWith('0')?rule['赤牌'][suit]:4-rule['赤牌'][suit];if((own[tile]||0)>=cap)continue;
   const res=M.Util.hule(hand,tile+'+',M.Util.hule_param({rule,zhuangfeng:wind,menfeng:seat,lizhi:1,baopai:indicators}));assert(res?.defen>0&&res.hupai?.length);assert(!res.hupai.some(h=>h.baojia),'pao unsupported');
   const base=basicPoints(res.fu,res.fanshu,res.damanguan);const actual=round100(base*(seat===0?6:4));equal(res.defen,actual);let payments=[0,0,0,0];payments[seat]=actual;payments[(seat+1)%4]=-actual;equal(res.fenpei,payments);scores.push(round100(base*4));variants++;
  }
 }
 assert(scores.length);const min=Math.min(...scores),max=Math.max(...scores);return {min,max,band:band(min),crossBand:band(min)!==band(max),variants};
}
const tile=p=>typeof p==='string'&&/^(?:[mps][0-9]|z[1-7])$/.test(p);
const ix=p=>'mpsz'.indexOf(p[0])*9+(+p[1]||5)-1;
const counts=s=>{const a=Array(34).fill(0);for(const m of s.matchAll(/[mpsz]\d+/g))for(const n of m[0].slice(1))a[ix(m[0][0]+n)]++;return a};
const keys=['hand','drawn','selfMelds','dora','round','ownSeat','ownDiscards','otherRiichi','pendingReach','remaining','ownPoints','candidate'];
export function projectPublicRiichi(caseData,candidate){
 const s=caseData.scene, a=caseData.actions.find(x=>x.action===37);
 assert(caseData.phase==='turn'&&a&&Array.isArray(a.details));
 assert(Array.isArray(s.rivers)&&s.rivers.length===4&&s.rivers.every(r=>typeof r.riichi==='boolean')&&!s.rivers[s.ownSeat].riichi);
 return {hand:s.hand,drawn:s.drawn,selfMelds:s.selfMelds,dora:s.dora,round:s.round,ownSeat:s.ownSeat,ownDiscards:s.ownDiscards,otherRiichi:s.rivers.filter((_,i)=>i!==s.ownSeat).map(r=>r.riichi),pendingReach:s.pendingReach,remaining:s.remaining,ownPoints:s.scores[s.ownSeat].points,candidate};
}
export function deriveRiichiFilter(M,rule,input){
 assert(input&&Object.keys(input).sort().join('|')===keys.slice().sort().join('|'),'unexpected input field');
 const {hand,drawn,selfMelds,dora,round,ownSeat,ownDiscards,otherRiichi,pendingReach,remaining,ownPoints,candidate}=input;
 assert(Number.isInteger(ownSeat)&&ownSeat>=0&&ownSeat<4&&Number.isInteger(ownDiscards)&&ownDiscards>=0&&ownDiscards<25);
 assert(Array.isArray(otherRiichi)&&otherRiichi.length===3&&otherRiichi.every(x=>typeof x==='boolean')&&pendingReach===false,'pending declaration or invalid flags');
 assert(Array.isArray(selfMelds)&&selfMelds.every(m=>/^[mpsz]\d{4}$/.test(m)&&M.Shoupai.valid_mianzi(m)===m));
 assert(Array.isArray(hand)&&hand.length+3*selfMelds.length===14&&hand.every(tile)&&tile(drawn)&&hand.includes(drawn));
 assert(Array.isArray(dora)&&dora.length>=1&&dora.length<=5&&dora.every(tile));
 assert(Number.isInteger(remaining)&&remaining>=0&&remaining<=70&&Number.isInteger(ownPoints)&&/^(?:[mps][0-9]|z[1-7])_?\*$/.test(candidate));
 const wind='東南西'.indexOf(round?.[0]);assert(wind>=0&&/^[東南西][1-4]局$/.test(round));
 const before=hand.slice();before.splice(before.lastIndexOf(drawn),1);const h=new M.Shoupai(before);h._fulou=selfMelds.slice();h.zimo(drawn);
 assert((M.Game.allow_lizhi(rule,h,null,remaining,ownPoints)||[]).includes(candidate.slice(0,-1)),'illegal concrete riichi discard');h.dapai(candidate);const parts=h.toString().split(',');const r=classifyStructuralWaits(counts(parts[0]),counts(parts.slice(1).join(',')),parts.length-1);assert(r.waits.length);
 const score=referenceScore(M,h,rule,wind,ownSeat,dora,r.waits.map(w=>w.tile));const turn=ownDiscards+1;
 return {filter:{role:otherRiichi.some(Boolean)?'chase':'first',shape:r.ryanmenOnly?'ryanmen_only':r.anyRyanmen?'mixed':'no_ryanmen',dealer:ownSeat===0,band:turn<=6?'early':turn<=12?'mid':'late',scoreBand:score.band},score,turn};
}
const allowed={role:['first','chase'],shape:['ryanmen_only','mixed','no_ryanmen',null],dealer:[true,false,null],band:['early','mid','late',null],scoreBand:['low','mid','high',null]};
const metrics=['win','deal','tsumo'];
const exact=(o,ks)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join('|')===ks.slice().sort().join('|');
export function buildResearchQuery(v3,v4){
 if(v3?.meta?.matches!==970||v4?.meta?.matches!==970||v4?.schema!=='l1-v4-visible-reference-ron-v1'||v3.bootstrap!==2000||v4.bootstrap!==2000)throw Error('research version mismatch');
 const indexes=[new Map(),new Map()];
 for(const [i,data] of [v3,v4].entries())for(const cell of data.cells){
  const key={role:cell.role,shape:cell.shape,dealer:cell.dealer,band:cell.band,scoreBand:i===0?null:cell.scoreBand};
  if(Object.entries(key).some(([k,v])=>!allowed[k].includes(v)))throw Error('invalid cell');
  const id=JSON.stringify(key);if(indexes[i].has(id))throw Error('duplicate cell');
  if(![cell.n,cell.matches,cell.hands].every(Number.isSafeInteger)||cell.matches>970||cell.matches>cell.hands||cell.hands>cell.n||cell.matches<=0)throw Error('invalid counts');
  const out={};
  for(const m of metrics){const z=cell.metrics[m];if(!z)throw Error('missing metric');
   if(!Number.isFinite(z.value)||z.value<0||z.value>100||!Array.isArray(z.ci)||z.ci.length!==2||!z.ci.every(x=>Number.isFinite(x)&&x>=0&&x<=100)||z.ci[0]>z.ci[1]||z.denominator!==cell.n||!Number.isSafeInteger(z.numerator)||z.numerator<0||z.numerator>cell.n||Math.abs(z.value-100*z.numerator/z.denominator)>0.000051)throw Error('invalid metric');
   const supported=z.support===true&&cell.matches>=100&&cell.hands>=200&&z.numerator>=10&&cell.n-z.numerator>=10&&z.ci[1]-z.ci[0]<=10;
   out[m]=supported?Object.freeze({status:'supported_descriptive',percent:z.value,ci95:Object.freeze([...z.ci])}):Object.freeze({status:'insufficient_support'});
  }
  indexes[i].set(id,Object.freeze({n:cell.n,matches:cell.matches,hands:cell.hands,metrics:Object.freeze(out)}));
 }
 return function query(request){
  if(!exact(request,['mode','timing','filter']))throw Error('invalid request fields');
  if(!['coach','self','assessment'].includes(request.mode)||!['during','after'].includes(request.timing))throw Error('invalid mode/timing');
  if(request.mode==='assessment'&&request.timing==='during')return {status:'disabled_during_assessment'};
  const f=request.filter;if(!exact(f,Object.keys(allowed))||Object.entries(f).some(([k,v])=>!allowed[k].includes(v)))throw Error('invalid or private filter');
  const key={role:f.role,shape:f.shape,dealer:f.dealer,band:f.band,scoreBand:f.scoreBand};
  const cell=indexes[f.scoreBand===null?0:1].get(JSON.stringify(key));
  if(!cell)return {status:'no_exact_cell',filter:key,broaderQueryRequired:true};
  return {status:'descriptive_only',population:'S42 selfplay, initial 970 development hanchan',humanValidated:false,causal:false,filter:key,...cell};
 };
}
export function createDecisionResearch({M,rule,query,mode}){
 if(!['coach','self','assessment'].includes(mode)||typeof query!=='function')throw Error('invalid research configuration');
 let active=null,ended=false,seq=0;
 const checkToken=token=>{if(!active||token!==active.token||active.timing!==(ended?'after':'during'))throw Error('stale research decision');return active};
 function begin(read,timing){if(typeof read!=='function')throw Error('invalid public reader');const token=++seq;active={token,read,timing,cache:null};return token}
 function access(token){
  const a=checkToken(token);
  if(mode==='assessment'&&a.timing==='during')return {status:'disabled_during_assessment'};
  if(a.cache)return a.cache;
  const input=a.read();if(!exact(input,['publicCase','legalRiichiDiscards']))throw Error('invalid research snapshot envelope');
  const {publicCase,legalRiichiDiscards}=input;
  if(publicCase?.scene?.mode!=='半荘')return a.cache={status:'unsupported_rule_profile'};
  if(publicCase?.phase!=='turn'||!Array.isArray(legalRiichiDiscards)||!legalRiichiDiscards.length)return a.cache={status:'unsupported_no_riichi'};
  if(new Set(legalRiichiDiscards).size!==legalRiichiDiscards.length)throw Error('duplicate candidate');
  const candidates=legalRiichiDiscards.map(p=>{
    if(typeof p!=='string'||!/^(?:[mps][0-9]|z[1-7])_?$/.test(p))throw Error('invalid concrete candidate');
    const detail=deriveRiichiFilter(M,rule,projectPublicRiichi(publicCase,p+'*'));
    return Object.freeze({discard:p,filter:Object.freeze({...detail.filter}),score:Object.freeze({...detail.score}),turn:detail.turn});
  });
  return a.cache=Object.freeze({status:'ready',candidates:Object.freeze(candidates)});
 }
 function lookup(token,discard,omit=[]){
  const result=access(token);if(result.status!=='ready')return result;
  if(!Array.isArray(omit)||new Set(omit).size!==omit.length||omit.some(k=>!['shape','dealer','band','scoreBand'].includes(k)))throw Error('invalid broadening');
  const candidate=result.candidates.find(x=>x.discard===discard);if(!candidate)throw Error('unknown candidate');
  const filter={...candidate.filter};for(const k of omit)filter[k]=null;
  const data=query({mode,timing:checkToken(token).timing,filter});
  return {status:data.status,candidate,broadened:[...omit],data};
 }
 return Object.freeze({beginDecision(read){if(ended)throw Error('match finished');return begin(read,'during')},invalidate(){active=null},finishMatch(){ended=true;active=null},beginReview(read){if(!ended)throw Error('review before finish');return begin(read,'after')},access,lookup});
}
