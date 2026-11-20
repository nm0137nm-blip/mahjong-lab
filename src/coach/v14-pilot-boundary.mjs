// Development-only transport boundary. Not an inference engine or tactical certificate.
import {createHash} from 'node:crypto';
import {enrichPublic} from './v14-public-calculations.mjs';
import {factsOnly,attachMortalReference} from './p2a-facts-only.mjs';
export const VERSION='v14-pilot-boundary-1';
const fail=(x)=>{throw Error(x)};
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const exact=(v,ks)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===ks.slice().sort().join('|');
const string=x=>typeof x==='string'&&x.length>0&&x.length<=4000;
const norm=p=>p[0]+(p[1]==='0'?'5':p[1]);
const types=[...'mps'].flatMap(s=>Array.from({length:9},(_,i)=>s+(i+1))).concat(Array.from({length:7},(_,i)=>'z'+(i+1)));
const meldTiles=m=>[...m.slice(1)].filter(x=>/\d/.test(x)).map(x=>m[0]+x);
const ID=/^pilot-[0-9]{2}$/;
export function makeIndependent(raw,id,engine=null){
 if(!ID.test(id))fail('bad pilot id');
 const f=factsOnly(raw).publicFacts;
 const visible=Object.fromEntries(types.map(t=>[t,0]));
 const red={m:0,p:0,s:0};
 function add(t){const n=norm(t);if(!(n in visible))fail('unknown tile');visible[n]++;if(t[1]==='0')red[t[0]]++;}
 for(const t of f.hand)add(t);
 for(const r of f.rivers){for(const d of r.discards)if(!d.called)add(d.tile);for(const m of r.melds)for(const t of meldTiles(m))add(t);}
 for(const t of f.doraIndicators)add(t);
 if(Object.values(visible).some(n=>n>4)||Object.values(red).some(n=>n>1)||Object.keys(red).some(s=>visible[s+'5']-red[s]>3))fail('visible multiplicity');
 const actions=f.legalActions.slice().sort((a,b)=>a.id-b.id).flatMap(a=>a.details.slice().sort().map((detail,i)=>({key:'a'+a.id+'-'+i,group:a.id,detail})));
 const evidence=[
  {id:'board',kind:'public_record',value:{round:f.round,honba:f.honba,kyotaku:f.kyotaku,pendingReach:f.pendingReach,remaining:f.remaining,ownSeat:f.ownSeat,activeSeat:f.activeSeat,rank:f.rank,scores:f.scores}},
  {id:'own',kind:'public_record',value:{hand:f.hand,drawn:f.drawn,melds:f.ownMelds,doraIndicators:f.doraIndicators,reaction:f.reaction}},
  {id:'history',kind:'public_record',value:f.events},
  ...f.rivers.map(r=>({id:'seat-'+r.seat,kind:'public_record',value:r})),
  {id:'visible',kind:'derived_visible_count_preparation',value:{counts:visible,remainingUpperBound:Object.fromEntries(Object.entries(visible).map(([k,n])=>[k,4-n])),redVisible:red}},
  ...actions.map(a=>({id:a.key,kind:'legal_choice_record',value:{...a,ownRiverGenbutsuSeats:a.group<37?f.ownRiverGenbutsu.find(x=>x.action===a.group).ownRiverSameTypeSeats:[]}}))
 ];
 // This projection uses no raw facts, candidate shortlist, user choice, private payload or reference.
 const input={version:engine?'v14-pilot-calculated-1':VERSION,id,phase:raw.phase,actions,evidence};
 return engine?enrichPublic(input,{...f,phase:raw.phase},engine):input;
}
export const independentInstruction='四人麻雀の開発診断。公開記録のみで判断。全合法候補を公平に比較し、他家3人と自手の速度・打点・将来押す牌・局目的を具体的に比較する。確定情報以外は仮説として根拠ID・候補・方向・適用条件・反証条件を明記し、未計算の確率や打点を捏造しない。推奨はactionsのkey。JSONのみ、指定形に厳密に従う。根拠にない事実は不明。';
export const responseShape={recommendation:'a0-0',confidence:'low|medium|high',claims:[{type:'fact|hypothesis',seat:0,action:'a0-0',against:'a1-0',evidenceIds:['board'],metric:'speed|value|defense|rank|progress|deal_in|win|round_net|rank_utility',direction:'higher|lower|same|unknown',condition:'適用条件',falsifier:'反証条件',statement:'根拠に沿った主張'}],sections:{objective:'局目的',relative:'相対価値',comparison:'候補比較',tradeoff:'利益・代償',reversal:'変更条件',lesson:'教訓'}};
export function independentRequest(raw,id,engine=null){
 const input=makeIndependent(raw,id,engine);
 const request={stage:'independent',system:independentInstruction,responseShape,input};
 return {request,requestHash:hash(request)};
}
function validateAnswer(input,answer){
 if(!exact(answer,['recommendation','confidence','claims','sections'])||!input.actions.some(a=>a.key===answer.recommendation)||!['low','medium','high'].includes(answer.confidence)||!Array.isArray(answer.claims)||!answer.claims.length||answer.claims.length>80||!exact(answer.sections,['objective','relative','comparison','tradeoff','reversal','lesson'])||!Object.values(answer.sections).every(string))fail('invalid response structure');
 const ids=new Set(input.evidence.map(e=>e.id)),actions=new Set(input.actions.map(x=>x.key));
 for(const c of answer.claims){
  if(!exact(c,['type','seat','action','against','evidenceIds','metric','direction','condition','falsifier','statement'])||!['fact','hypothesis'].includes(c.type)||!Number.isInteger(c.seat)||c.seat<0||c.seat>3||!actions.has(c.action)||!actions.has(c.against)||!Array.isArray(c.evidenceIds)||!c.evidenceIds.length||new Set(c.evidenceIds).size!==c.evidenceIds.length||!c.evidenceIds.every(id=>ids.has(id))||!['speed','value','defense','rank','progress','deal_in','win','round_net','rank_utility'].includes(c.metric)||!['higher','lower','same','unknown'].includes(c.direction)||![c.condition,c.falsifier,c.statement].every(string))fail('invalid claim');
 }
 return true;
}
// Hashes detect accidental mutation, not authenticity; external source must be trusted.
export function lockIndependent(envelope,answer,meta){
 if(envelope.request.stage!=='independent'||hash(envelope.request)!==envelope.requestHash)fail('request integrity');
 if(!exact(meta,['provider','model','version','temperature','seed','execution'])||![meta.provider,meta.model,meta.version,meta.execution].every(string)||!(meta.temperature===null||Number.isFinite(meta.temperature))||!(meta.seed===null||Number.isSafeInteger(meta.seed)))fail('model metadata incomplete');
 validateAnswer(envelope.request.input,answer);
 const record={requestHash:envelope.requestHash,answer:structuredClone(answer),meta:structuredClone(meta)};
 return {record,recordHash:hash(record)};
}
export function comparisonRequest(envelope,locked,reference,raw,userAction=null,engine=null){
 if(hash(envelope.request)!==envelope.requestHash||hash(locked.record)!==locked.recordHash||locked.record.requestHash!==envelope.requestHash)fail('independent record integrity');
 const reconstructed=independentRequest(raw,envelope.request.input.id,engine);
 if(reconstructed.requestHash!==envelope.requestHash)fail('case mismatch');
 if(!exact(reference,['pilotId','requestHash','key'])||reference.pilotId!==envelope.request.input.id||reference.requestHash!==envelope.requestHash)fail('reference scope');
 const f=factsOnly(raw),r=attachMortalReference(f,reference.key,raw.id).mortalReference;
 if(r.status!=='matched_group_only')fail('reference unavailable');
 if(userAction!==null&&!envelope.request.input.actions.some(a=>a.key===userAction))fail('invalid user action');
 const request={stage:'comparison',independent:structuredClone(locked),input:structuredClone(envelope.request.input),reference:r,userAction,system:'保存した独立回答は変更しない。比較説明だけを別に出力する。Mortalの内部理由は断定しない。'};
 return {request,requestHash:hash(request)};
}
export function storeComparison(envelope,locked,comparison,answer){
 const request=comparison.request;
 if(hash(request)!==comparison.requestHash||hash(envelope.request)!==envelope.requestHash||hash(request.input)!==hash(envelope.request.input))fail('comparison request integrity');
 if(hash(locked.record)!==locked.recordHash||locked.record.requestHash!==envelope.requestHash||request.stage!=='comparison'||request.independent.recordHash!==locked.recordHash||hash(request.independent.record)!==locked.recordHash||!exact(answer,['comparison'])||!string(answer.comparison))fail('comparison integrity');
 return {independentHash:locked.recordHash,comparisonRequestHash:hash(request),comparison:answer.comparison};
}
