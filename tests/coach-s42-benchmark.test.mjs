import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import * as bm from '../src/coach/s42-benchmark.mjs';
const src=readFileSync(new URL('../index.html',import.meta.url),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const b='})(typeof window!=="undefined"?window:globalThis);';
const ctx={window:{}};new Script(src.slice(0,src.indexOf(b)+b.length)).runInNewContext(ctx);const M=ctx.window.MajiangCore;
test('synthetic Q fixture: split, blinding, grading and exclusions',()=>{

const clone=x=>JSON.parse(JSON.stringify(x));
const exp=s=>[...s.matchAll(/[mpsz][0-9]+/g)].flatMap(([x])=>[...x.slice(1)].map(n=>x[0]+n));
const hand=exp('m1245999p45s18899'),discards=['m1','s1','m2'];
const q=Array(46).fill(null);q[0]=0.11;q[18]=0.21;q[1]=0.0;
const entry={scene:{snapshotVersion:2,round:'東1局',mode:'半荘',ownSeat:1,hand,drawn:'m1',selfMelds:[],dora:['s2'],rivers:Array.from({length:4},()=>({discards:[],melds:[],riichi:false,name:'SECRET_NAME'})),scores:Array.from({length:4},()=>({points:25000,name:'SECRET_NAME'})),initialOrder:[0,1,2,3],honba:0,kyotaku:0,remaining:63,publicEvents:[],secret:'SECRET'},mortalDecision:10,mortalOpinion:{id:10,source:'Mortal-S42',best:18,qLegal:q},discard:'m1',legalChoices:{phase:'turn',discards,riichiDiscards:[],kan:[]},candidates:discards.map(p=>{const handTiles=hand.slice();handTiles.splice(handTiles.indexOf(p),1);return {p,handTiles,melds:[],shanten:2,ukeire:20}})};
const tests=[];const check=(name,t)=>{if(!t)throw Error(name);tests.push(name)};
const x=bm.makeCase(entry,M,"case1");check('split',!!x.blind&&x.key.best===18);
const altered=clone(entry);altered.mortalOpinion.best=0;altered.mortalOpinion.qLegal[0]=0.3;altered.discard='s1';
const y=bm.makeCase(altered,M,"case1");check('blind payload unchanged despite changed label and actual action',JSON.stringify(x.blind)===JSON.stringify(y.blind));
check('no hidden names or key fields',!JSON.stringify(x.blind).includes('SECRET')&&!JSON.stringify(x.blind).includes('qLegal')&&!Object.hasOwn(x.blind,'key'));
const ans={id:'case1',action:0,alternative:18,reason:'比較',prediction:'ドラなら反転',confidence:'medium'};
let g=bm.gradeBlind([x.key],[ans]);check('correct Q gap',Math.abs(g.all.meanQGap-.1)<1e-9&&g.all.top1===0&&g.all.top2===1);
g=bm.gradeBlind([x.key],[]);check('missing answer cannot enter comparison',!g.comparable&&g.coverage===0);
g=bm.gradeBlind([x.key],[{...ans,action:18,alternative:0}]);check('best recognized',g.all.top1===1&&g.all.meanQGap===0);
const mismatch=clone(entry);mismatch.mortalOpinion.qLegal[2]=.02;check('mask mismatch rejected',bm.makeCase(mismatch,M,'x').excluded==='mask_mismatch');
const stale=clone(entry);stale.mortalOpinion.id=11;check('stale Q rejected',bm.makeCase(stale,M,'x').excluded==='missing_matched_s42');
const r=bm.collect([entry,mismatch,stale],M,'match');check('exclusions counted',r.total===3&&r.blind.length===1&&Object.values(r.excluded).reduce((n,v)=>n+v,0)===2);

});

test('locked first answer, factual claim checks and contrast directions use synthetic labels',()=>{
 const key={id:'a',phase:'turn',best:18,q:Array(46).fill(null),model_sha256:bm.MODEL_SHA256};key.q[0]=.1;key.q[18]=.2;
 const blind={id:'a',facts:{ukeire:20,shanten:2}};
 const answer={id:'a',action:0,alternative:18,confidence:'medium',reason:'fixture',prediction:'fixture'};
 if(bm.revealCase(blind,key,answer).reference.action!==18)throw Error('reveal');
 let rejected=false;try{bm.revealCase(blind,key,{...answer,action:44});}catch{rejected=true;}if(!rejected)throw Error('invalid answer exposed');
 const claims=[{path:['facts','ukeire'],value:20},{path:['facts','shanten'],value:2}];
 if(!bm.gradeClaims(blind,claims).complete||bm.gradeClaims(blind,[claims[0],claims[0]]).complete||bm.gradeClaims(blind,[{path:['facts','ukeire'],value:19},claims[1]]).complete)throw Error('claim validation');
 const key2={...key,id:'b',q:key.q.slice(),best:0};key2.q[0]=.4;
 const r=bm.gradeContrast([key,key2],[{id:'pair',direction:'increase',reason:'fixture'}],[{id:'pair',a:'a',b:'b',action1:0,action2:18}]);
 if(r.correct!==1||r.valid!==1)throw Error('directional comparison');
});
