// Freeze actual pilot candidate set before any contrast reference or coach inference.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const [naturalDir,contrastFile,out]=process.argv.slice(2),read=p=>JSON.parse(fs.readFileSync(p,'utf8')),hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const natural=read(path.join(naturalDir,'independent-requests.json')),lineage=read(path.join(naturalDir,'lineage.json')),pairs=read(contrastFile);
assert.equal(natural.length,30);assert.equal(pairs.length,4);assert.equal(new Set(pairs.map(p=>p.lineage.shard)).size,4);
const contrastShards=new Set(pairs.map(p=>p.lineage.shard));
const rows=[];
for(const [group,n] of [['reach',7],['reaction',8],['discard',7]]){
 const idx=lineage.map((l,k)=>({l,k})).filter(({l})=>l.group===group&&!contrastShards.has(l.shard)).slice(0,n);assert.equal(idx.length,n);
 for(const {l,k} of idx)rows.push({env:natural[k],private:{kind:'natural',...l}});
}
for(const [i,p] of pairs.entries())for(const v of ['a','b'])rows.push({env:p[v],private:{kind:'contrast',pair:i+1,version:v,...p.lineage}});
assert.equal(rows.length,30);
for(const r of rows)assert.equal(hash(r.env.request),r.env.requestHash);
rows.sort((a,b)=>hash(['v14-fixed-order-20261121',a.env.requestHash]).localeCompare(hash(['v14-fixed-order-20261121',b.env.requestHash])));
const es=[],map=[];
for(const [i,r] of rows.entries()){
 const request=structuredClone(r.env.request);request.input.id='pilot-'+String(i+1).padStart(2,'0');
 const requestHash=hash(request);es.push({request,requestHash});map.push({...r.private,originalRequestHash:r.env.requestHash,pilotId:request.input.id,requestHash});
}
assert.equal(new Set(es.map(e=>e.requestHash)).size,30);
const publicDir=path.join(out,'stage1'),verifierDir=path.join(out,'verifier');fs.mkdirSync(publicDir,{recursive:true});fs.mkdirSync(verifierDir,{recursive:true});
const write=(p,x)=>fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n');
write(path.join(publicDir,'independent-requests.json'),es);write(path.join(verifierDir,'lineage.json'),map);
for(let i=0;i<6;i++){
 const batch=es.slice(i*5,i*5+5);
 // Model gets only independent request; no IDs of original source, pair grouping, scores or key.
 const text='麻雀LAB 開発用独立判断試験。添付JSON内の各request.systemとresponseShapeに従って、各局面を互いに独立に解析してください。他のチャット・記憶・外部資料は使わず、Mortalの推奨は推測せず、自分の判断を返してください。5局面すべてについて {id,requestHash,answer} のJSON配列を作成しファイルとして返してください。answer内のfact.valueは根拠の指定pathと完全に一致させること。confidenceはlow/medium/highのみ。仮説を事実として扱わない。数値の推定を捏造しない。判断できない場合は明記。問題同士の関係は仮定しない。\n\n'+JSON.stringify(batch);
 fs.writeFileSync(path.join(publicDir,'batch-'+(i+1)+'.txt'),text);
}
write(path.join(verifierDir,'manifest.json'),{status:'development_pilot_candidate_set_frozen_not_approved_for_scoring',n:30,natural:22,contrastPairs:4,distinctOriginalMatches:new Set(map.map(m=>m.shard)).size,inputHash:hash(es),lineageHash:hash(map),limitations:['contrast labels and counterfactual Mortal pending','no independent model inference yet','not formal B evaluation']});
console.log('PREPARED',es.length,'natural',22,'pairs',4,'distinct',new Set(map.map(m=>m.shard)).size);
