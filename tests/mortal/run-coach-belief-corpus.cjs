// TEST ONLY: modify a disposable CI checkout; never deploy this HTML.
// Labels from true simulation state are separated from blind questions.
const fs=require('node:fs');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const path=require('node:path');
function capture(game,M,own,pending,tileList,human){
 const model=game.model;
 const norm=t=>t.slice(0,2).replace('0','5');
 const sortTiles=h=>tileList(h).map(t=>t.slice(0,2)).sort().join(',');
 if(sortTiles(model.shoupai[own])!==sortTiles(human.shoupai))throw Error('own hand alignment');
 const candidates=[...new Set((pending.options||[]).map(t=>t.slice(0,2)))].sort();
 const opponents=[];
 for(let seat=0;seat<4;seat++){
  if(seat===own)continue;
  const h=model.shoupai[seat];
  if(!h||!h._fulou||tileList(h).length+3*h._fulou.length!==13||h._zimo)throw Error('opponent not in stable 13-tile state: '+seat);
  const shanten=M.Util.xiangting(h);
  if(!Number.isInteger(shanten)||shanten<0)throw Error('invalid shanten');
  const structuralWaits=shanten===0?[...new Set((M.Util.tingpai(h)||[]).map(norm))].sort():[];
  if(shanten===0&&!structuralWaits.length)throw Error('empty tenpai waits');
  const river=new Set((model.he[seat]?._pai||[]).map(norm));
  const riverFuriten=structuralWaits.some(t=>river.has(t));
  const canRon=game._neng_rong?.[seat];
  if(![true,false,0,1].includes(canRon))throw Error('missing ron eligibility');
  const legalRon={};
  for(const t of candidates){
   const p=t+'_+=-'[(4+own-seat)%4];
   legalRon[t]=shanten===0&&!riverFuriten&&!!canRon&&!!M.Game.allow_hule(game._rule,h,p,model.zhuangfeng,seat,!!h.lizhi||model.shan.paishu===0,!!canRon);
   if(legalRon[t]&&!structuralWaits.includes(norm(t)))throw Error('ron without structural wait');
  }
  opponents.push({seat,shanten,tenpai:shanten===0,structuralWaits,riverFuriten,canRon:!!canRon,legalRon});
 }
 return {version:'belief-teacher-v1',phase:'turn',ownSeat:own,opponents};
}
function replaceOne(src,key,replacement){
 if(src.split(key).length!==2)throw Error('nonunique patch anchor: '+key);
 return src.replace(key,replacement);
}
const root=path.resolve(__dirname,'../..');
if(process.env.COACH_BELIEF_LOCAL_QA!=='1'||root!=='/tmp/lab'||!process.env.GITHUB_ACTIONS)throw Error('CI disposable checkout only');
const htmlPath=path.join(root,'index.html');
const anchor='  window.MahjongLabCoachAudit=async(prefix)=>{';
const injection=`
  // LOCAL QA ONLY, never included in production.
  const captureBeliefLabels=${capture.toString()};
  const originalAuditStep=window.MahjongLabCoachAuditStep;
  let beliefRows=[];
  window.MahjongLabCoachAuditStep=(...args)=>{
    if(!game||gameEnded||!pending)return originalAuditStep(...args);
    const before=decisionLog.length;
    if(before===0)beliefRows=[];
    const row=pending.type==='turn'?captureBeliefLabels(game,M,ownSeat(),pending,tileList,human):null;
    const acted=originalAuditStep(...args);
    if(acted){
      if(decisionLog.length!==before+1)throw Error('belief decision alignment failed');
      if(row)beliefRows.push({index:before+1,...row});
    }
    return acted;
  };
  window.MahjongLabBeliefAudit=(prefix,ids)=>{
    if(!gameEnded||!debugUsed)throw Error('finished QA match required');
    const map=new Map(beliefRows.map(r=>[prefix+'-'+String(r.index).padStart(3,'0'),r]));
    if(map.size!==beliefRows.length)throw Error('duplicate belief label');
    return ids.map(id=>{const r=map.get(id);if(!r)throw Error('missing aligned label '+id);return {id,...r};});
  };
`;
const source=fs.readFileSync(htmlPath,'utf8');
fs.writeFileSync(htmlPath,replaceOne(source,anchor,injection+anchor));
const original=path.join(__dirname,'run-coach-benchmark.cjs');
let runner=fs.readFileSync(original,'utf8');
runner=replaceOne(runner,'const all={blind:[],keys:[],matches:[]};','const all={blind:[],keys:[],matches:[],belief:[]};');
// Independently hashed match seeds, rather than adjacent LCG starting states.
runner=replaceOne(runner,'(seed+g)>>>0','(require("node:crypto").createHash("sha256").update("belief-v1:"+seed+":"+g).digest().readUInt32LE(0)||1)');
runner=replaceOne(runner,'all.blind.push(...data.blind);','const turns=data.blind.filter(x=>x.phase==="turn");\n   const labels=await page.evaluate(([p,ids])=>MahjongLabBeliefAudit(p,ids),[prefix,turns.map(x=>x.id)]);\n   if(labels.length!==turns.length)throw Error("label count mismatch");\n   for(let j=0;j<labels.length;j++){const x=turns[j],y=labels[j];if(x.id!==y.id||x.scene.ownSeat!==y.ownSeat||y.opponents.length!==3)throw Error("public/teacher alignment");for(const o of y.opponents){if(o.seat===y.ownSeat||o.tenpai!==(o.shanten===0))throw Error("invalid teacher");const expected=[...new Set(x.actions.filter(a=>a.action<37).flatMap(a=>a.details).map(t=>t.slice(0,2)))].sort();if(JSON.stringify(Object.keys(o.legalRon).sort())!==JSON.stringify(expected))throw Error("candidate label mask mismatch");}}\n   all.belief.push(...labels);all.blind.push(...data.blind);');
runner=replaceOne(runner,"fs.writeFileSync('/tmp/coach-bench/reference.json',JSON.stringify(all.keys,null,2));","fs.writeFileSync('/tmp/coach-bench/reference.json',JSON.stringify(all.keys,null,2));\n  fs.writeFileSync('/tmp/coach-bench/belief-teacher.json',JSON.stringify(all.belief));\n  if(all.belief.length!==counts.turn||new Set(all.belief.map(x=>x.id)).size!==counts.turn)throw Error('teacher coverage');\n  if(new Set(all.matches.map(x=>x.matchSeed)).size!==all.matches.length)throw Error('seed collision');\n  console.log('BELIEF_COUNTS='+JSON.stringify({turn:all.belief.length,opponents:all.belief.length*3,tenpai:all.belief.flatMap(x=>x.opponents).filter(x=>x.tenpai).length,ron:all.belief.flatMap(x=>x.opponents).flatMap(x=>Object.values(x.legalRon)).filter(Boolean).length}));");
runner=replaceOne(runner,"if(errors.length)throw Error(JSON.stringify(errors));","if(errors.length)throw Error(JSON.stringify(errors));\n  if(all.matches.some(x=>x.fallbacks))throw Error('progression fallback: quarantine entire shard');");
const temp=path.join(__dirname,'_belief_runner.local.cjs');
fs.writeFileSync(temp,runner);
require(temp);
