// Development pilot audit. Structural checks, not an automatic semantic judge.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {lockIndependent} from '../../src/coach/v14-pilot-boundary.mjs';
export const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,x)=>fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n');
export function auditAnswer(e,a){
 const i=e.request.input,own=i.evidence.find(x=>x.id==='board').value.ownSeat,opp=[0,1,2,3].filter(s=>s!==own);
 const useful=c=>c.evidenceIds.includes('calc-'+c.action)&&c.evidenceIds.includes('calc-'+c.against)&&c.evidenceIds.some(id=>id==='seat-'+c.seat||id==='public-value-'+c.seat);
 const cites=new Set(a.facts.map(f=>f.evidenceId));
 // These checks require a link to a concrete candidate contrast for each
 // opponent and a literal fact citation; they do not validate the prose.
 const linkedSeats=opp.filter(s=>a.claims.some(c=>c.seat===s&&useful(c)&&c.direction!=='unknown'&&(cites.has('seat-'+s)||cites.has('public-value-'+s))));
 const measurable=a.claims.filter(c=>['deal_in','win','round_net','rank_utility'].includes(c.metric)&&c.direction!=='unknown'&&c.evidenceIds.includes('calc-'+c.action)&&c.evidenceIds.includes('calc-'+c.against));
 return {linkedSeats,allOpponentsLinked:linkedSeats.length===3,measurableClaimShape:measurable.length>0,measurableClaims:measurable.length,semanticReview:'not_measured',rolloutVerification:'not_measured'};
}
export function ingest(es,submissions,meta){
 const by=new Map();for(const r of submissions){assert(r&&typeof r.id==='string'&&!by.has(r.id),'duplicate answer ID');by.set(r.id,r);}
 assert([...by.keys()].every(id=>es.some(e=>e.request.input.id===id)),'unexpected ID');
 const rows=es.map(e=>{const id=e.request.input.id,r=by.get(id);if(!r)return {id,status:'missing'};try{
  assert.deepEqual(Object.keys(r).sort(),['answer','id','requestHash']);
  assert.equal(r.requestHash,e.requestHash);
  const locked=lockIndependent(e,r.answer,meta);return {id,status:'locked',...locked,audit:auditAnswer(e,r.answer)};
 }catch(err){return {id,status:'invalid',reason:String(err)};}});
 const packet={inputHash:hash(es),submitted:submissions.length,expected:es.length,meta,rows};
 return {packet,packetHash:hash(packet)};
}
export function weakAnswer(e,kind){
 const i=e.request.input,v=new Map(i.evidence.map(x=>[x.id,x.value])),board=v.get('board'),own=board.ownSeat;
 const shape=a=>{const m=v.get('calc-'+a.key);return m.afterCallDiscards?m.afterCallDiscards.slice().sort((x,y)=>(x.shanten??99)-(y.shanten??99)||(y.improving?.length??0)-(x.improving?.length??0))[0]:m;};
 // Strict own-shape comparator uses number of improving types, not visible-wall
 // upper bound (which would indirectly include the other players' discards).
 const val=a=>{const m=shape(a);if(a.group===43)return -10000;if(a.group===44)return 10000;let q=(m.shanten??99)*100-(m.improving?.length??0)*3-(m.retainedDoraHan??0);
 if(kind==='own_points'&&a.group===37){q+=board.rank===1?4:-4;if(board.scores[own].points<5000)q+=12;}
 return q;};
 const ranked=i.actions.slice().sort((a,b)=>val(a)-val(b)||a.key.localeCompare(b.key)),pick=ranked[0],other=ranked[1];
 const fact=(evidenceId,path)=>({evidenceId,path,value:path.reduce((p,k)=>p[k],v.get(evidenceId))});
 const claims=[{type:'hypothesis',seat:own,action:pick.key,against:other.key,evidenceIds:['own','calc-'+pick.key,'calc-'+other.key],metric:'win',direction:'higher',condition:'自手形状のみ',falsifier:'和了率が低い',statement:'自手効率を優先する。'}];
 const facts=[fact('board',['ownSeat']),fact('board',['round'])];
 if(kind==='boilerplate'||kind==='boilerplate_cited'){
  // Valid schema and all seats named, but no concrete candidate/seat evidence.
  // This is a deliberately weak, generic explanation, never a real model output.
  for(const s of [0,1,2,3].filter(s=>s!==own)){
   const cited=kind==='boilerplate_cited';
   if(cited)facts.push(fact('seat-'+s,['riichi']));
   claims.push({type:'hypothesis',seat:s,action:pick.key,against:other.key,evidenceIds:['seat-'+s,'board',...(cited?['calc-'+pick.key,'calc-'+other.key]:[])],metric:'defense',direction:'higher',condition:'局面による',falsifier:'状況が変化する場合',statement:'相手の速度と打点に注意。'});
  }
 }
 return {recommendation:pick.key,confidence:'low',claims,facts,sections:{objective:'和了を目指す',relative:'状況に応じ判断する',comparison:'手牌効率優先',tradeoff:'安全と速度を考慮',reversal:'状況変化',lesson:'全体を見る'}};
}
export function attachReference(es,lin,paired,root){
 const qrows=[];
 for(const [k,e] of es.entries()){
  const l=lin[k],i=e.request.input;assert.equal(l.pilotId,i.id);assert.equal(l.requestHash,e.requestHash);assert.equal(hash(e.request),e.requestHash);
  let q,best,origin;
  if(l.kind==='contrast'){const r=paired.rows.find(r=>r.pair===l.pair);assert(r?.archiveAnchorMatched);({q,best}=r.variants[l.version]);origin='paired_pinned_onnx';}
  else{const d=path.join(root,'p1-v2-dev-data-'+l.shard),m=read(path.join(d,'manifest.json'));assert.equal(m.seed,l.seed);assert.equal(m.split,'development-only');const r=read(path.join(d,'reference.json')).filter(x=>x.id===l.decisionId);assert.equal(r.length,1);({q,best}=r[0]);origin='archived_dev_reference';}
  const groups=[...new Set(i.actions.map(a=>a.group))].sort((a,b)=>a-b);assert.equal(q.length,46);assert.deepEqual(q.flatMap((x,j)=>x===null?[]:[j]),groups);assert(groups.every(j=>Number.isFinite(q[j])));assert.equal(q[best],Math.max(...groups.map(j=>q[j])));
  qrows.push({id:i.id,requestHash:e.requestHash,kind:l.kind,pair:l.pair??null,variant:l.version??null,q,best,origin});
 }
 return {inputHash:hash(es),modelSHA256:'30381bf21389e2d25d3edf48fed11bf772336ef3daeee67d1bdae7fb9dd30cb4',rows:qrows};
}
export function comparisonPackets(es,locked,refs){
 // Must be called only after the complete actual independent submission is fixed.
 assert.equal(hash(locked.packet),locked.packetHash);assert.equal(locked.packet.inputHash,hash(es));assert.equal(refs.inputHash,hash(es));
 assert.equal(locked.packet.rows.length,es.length);assert.equal(refs.rows.length,es.length);
 assert(locked.packet.meta.provider!=='deterministic control','no control answers for actual comparison');
 assert(locked.packet.rows.every(r=>r.status==='locked'),'incomplete first-stage submission');
 return es.map((e,k)=>{
  const row=locked.packet.rows[k],r=refs.rows[k];assert.equal(row.id,e.request.input.id);assert.equal(r.id,row.id);assert.equal(r.requestHash,e.requestHash);
  assert.equal(lockIndependent(e,row.record.answer,row.record.meta).recordHash,row.recordHash);
  const groups=[...new Set(e.request.input.actions.map(a=>a.group))].sort((a,b)=>r.q[b]-r.q[a]||a-b);
  const request={stage:'comparison',input:e.request.input,independent:{recordHash:row.recordHash,answer:row.record.answer},reference:{source:'Mortal-S42 group-level',rankedGroups:groups,bestGroups:groups.filter(g=>r.q[g]===r.q[r.best]),modelSHA256:refs.modelSHA256,warning:'各グループの具体的な立直打牌・鳴き牌・槓の細部の優劣はこの参照から確定しない。Mortalの内部判断理由は不明。'},system:'独立回答は変更できない。Mortalと一致・不一致・判断の違いを区別し、公開根拠に基づく説明と条件付き仮説を別に記述する。内部理由の断定、未認証の確率・期待値の表示は禁止。'};
  return {request,requestHash:hash(request)};
 });
}
export function grade(es,locked,refs){
 assert.equal(hash(locked.packet),locked.packetHash);assert.equal(locked.packet.inputHash,hash(es));assert.equal(refs.inputHash,hash(es));assert.equal(locked.packet.rows.length,es.length);assert.equal(refs.rows.length,es.length);
 const rows=es.map((e,k)=>{const r=locked.packet.rows[k],q=refs.rows[k],i=e.request.input;assert.equal(r.id,i.id);assert.equal(q.id,i.id);assert.equal(q.requestHash,e.requestHash);if(r.status!=='locked')return {id:r.id,status:r.status,kind:q.kind,pair:q.pair,variant:q.variant};
 assert.equal(hash(r.record),r.recordHash);assert.equal(r.record.requestHash,e.requestHash);
 const again=lockIndependent(e,r.record.answer,r.record.meta);assert.equal(again.recordHash,r.recordHash);
 const a=i.actions.find(a=>a.key===r.record.answer.recommendation);assert(a);
 return {id:r.id,status:r.status,kind:q.kind,pair:q.pair,variant:q.variant,group:a.group,exactOrTie:q.q[a.group]===q.q[q.best],gap:q.q[q.best]-q.q[a.group],audit:auditAnswer(e,r.record.answer)};
 });
 const pairs=[...new Set(refs.rows.filter(r=>r.pair!==null).map(r=>r.pair))].map(n=>{const a=rows.find(r=>r.pair===n&&r.variant==='a'),b=rows.find(r=>r.pair===n&&r.variant==='b'),ra=refs.rows.find(r=>r.id===a.id),rb=refs.rows.find(r=>r.id===b.id);return {pair:n,referenceTopChanged:ra.best!==rb.best,answerGroupChanged:a.status==='locked'&&b.status==='locked'?a.group!==b.group:null,bothExactOrTie:!!a.exactOrTie&&!!b.exactOrTie,rolloutDirection:'undetermined_not_gold'};});
 return {status:'development_diagnostic_no_semantic_or_B3_B4_pass',total:rows.length,locked:rows.filter(r=>r.status==='locked').length,exactOrTie:rows.filter(r=>r.exactOrTie).length,allOpponentsLinked:rows.filter(r=>r.audit?.allOpponentsLinked).length,measurableClaimShape:rows.filter(r=>r.audit?.measurableClaimShape).length,semanticReviewCompleted:0,robustRolloutLabels:0,pairs,rows};
}
if(process.argv[2]){
 const [mode,...args]=process.argv.slice(2);
 if(mode==='refs'){const [e,l,p,r,o]=args;write(o,attachReference(read(e),read(l),read(p),r));}
 else if(mode==='ingest'){const [e,m,o,...files]=args;write(o,ingest(read(e),files.flatMap(f=>read(f)),read(m)));}
 else if(mode==='comparison'){const [e,l,r,o]=args;write(o,comparisonPackets(read(e),read(l),read(r)));}
 else if(mode==='grade'){const [e,l,r,o]=args;write(o,grade(read(e),read(l),read(r)));}
 else if(mode==='controls'){const [ep,out]=args,es=read(ep);fs.mkdirSync(out,{recursive:true});for(const k of ['efficiency_own_only','own_points','boilerplate','boilerplate_cited']){const m={provider:'deterministic control',model:k,version:'v1',temperature:null,seed:null,execution:'development negative control, not real inference'};const rows=es.map(e=>({id:e.request.input.id,requestHash:e.requestHash,answer:weakAnswer(e,k)}));const lock=ingest(es,rows,m);assert.equal(lock.packet.rows.filter(r=>r.status==='locked').length,30);write(path.join(out,k+'.json'),lock);}}
 else throw Error('unknown mode');
}
